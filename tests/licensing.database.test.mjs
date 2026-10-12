import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { DatabaseSync, backup } from 'node:sqlite'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { LicenseClient } from '../electron-dist/electron/licensing/client.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'
import { publicKeyId, signDeviceRequest, signLease, validateTrust, verifyLease } from '../electron-dist/electron/licensing/protocol.mjs'
import { requiresTransactionLicense } from '../electron-dist/electron/licensing/policy.mjs'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'
import { AuthRepository } from '../electron-dist/electron/database/auth.mjs'
import { authorizeIpc } from '../electron-dist/electron/ipc-policy.mjs'

const day = 86400000, initialTime = Date.parse('2026-10-10T12:00:00Z'), binding = 'a'.repeat(32)
function keys() {
  const pair = generateKeyPairSync('ed25519')
  return { privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() }
}
async function fixture(t, settings = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'vertexia-license-test-')), issuer = keys(), protectionKey = randomBytes(32)
  const protector = {
    encrypt(value) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', protectionKey, iv), data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]) },
    decrypt(data) { const decipher = createDecipheriv('aes-256-gcm', protectionKey, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8') },
  }
  let time = initialTime, serverTime = initialTime, monotonic = 0, installation = binding
  let authority = new LicenseAuthority(join(directory, 'company.db'), issuer.privateKey, () => serverTime)
  const license = authority.issue('Test Retail Customer', initialTime + 30 * day, settings.maxDevices ?? 2, settings.offlineDays ?? 7)
  const server = createLicenseServer(authority)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const trust = { serviceUrl: 'http://127.0.0.1:' + server.address().port, issuerPublicKey: issuer.publicKey }
  const options = { path: join(directory, 'device.bin'), trust, protector, allowLocal: true, binding: () => installation, clock: () => time, monotonic: () => monotonic }
  const client = new LicenseClient(options)
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); if (authority.db.isOpen) authority.close(); rmSync(directory, { recursive: true, force: true }) })
  return { directory, issuer, protector, license, client, options, trust, server, get authority() { return authority },
    advance(ms) { time += ms; serverTime += ms; monotonic += ms }, setClock(value) { time = value }, setServerTime(value) { serverTime = value }, setMonotonic(value) { monotonic = value }, setBinding(value) { installation = value },
    readState() { return JSON.parse(protector.decrypt(readFileSync(options.path))) },
    writeState(state) { writeFileSync(options.path, protector.encrypt(JSON.stringify(state))) },
    reopenAuthority() { authority.close(); authority = new LicenseAuthority(join(directory, 'company.db'), issuer.privateKey, () => serverTime); return authority },
  }
}
const setupInput = { businessName: 'License Test Shop', branchName: 'Main', city: 'Karachi', ownerName: 'Owner', username: 'owner.test', password: 'License owner passphrase 2026' }

test('activation registers signed tenant/device identity and stores no activation key', async t => {
  const s = await fixture(t)
  assert.equal(s.client.status().state, 'unactivated')
  assert.throws(() => s.client.authorize('pos:complete-sale'), /license locked/)
  const result = await s.client.activate(s.license.activationKey)
  assert.equal(result.state, 'active'); assert.equal(result.tenantId, s.license.tenantId); assert.equal(result.licenseId, s.license.licenseId)
  assert.equal(result.deviceId, publicKeyId(s.readState().publicKey))
  assert.equal(result.offlineUntil, new Date(initialTime + 7 * day).toISOString())
  assert.ok(!JSON.stringify(s.readState()).includes(s.license.activationKey))
  assert.ok(!readFileSync(s.options.path).includes(Buffer.from('PRIVATE KEY')))
  assert.ok(!JSON.stringify(s.authority.db.prepare('SELECT * FROM licenses').all()).includes(s.license.activationKey))
  assert.ok(!JSON.stringify(result).includes('PRIVATE KEY'))
  assert.equal(new LicenseClient(s.options).status().state, 'active')
})

test('missing or invalid trust fails closed while read, login and backup stay available', async t => {
  const s = await fixture(t)
  const client = new LicenseClient({ ...s.options, trust: null })
  assert.equal(client.status().state, 'unconfigured')
  for (const channel of ['pos:complete-sale', 'cash:move', 'branches:create', 'unknown:write']) assert.throws(() => client.authorize(channel), /license locked/)
  for (const channel of ['auth:setup', 'auth:login', 'backup:create', 'backup:restore', 'reports:export-csv', 'sales:get-detail', 'cash:close-shift']) client.authorize(channel)
  assert.equal(new LicenseClient({ ...s.options, trust: { ...s.trust, serviceUrl: 'http://example.com' } }).status().state, 'invalid')
})

test('company trust only permits HTTPS or development loopback, with Ed25519 keys', async t => {
  const s = await fixture(t)
  for (const serviceUrl of ['http://example.com', 'http://localhost:8787', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?key=x', 'https://example.com/#fragment']) assert.throws(() => validateTrust({ ...s.trust, serviceUrl }, true))
  assert.throws(() => validateTrust(s.trust, false), /HTTPS/)
  assert.equal(validateTrust({ ...s.trust, serviceUrl: 'https://licenses.example.com' }).serviceUrl, 'https://licenses.example.com')
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' }).toString()
  assert.throws(() => publicKeyId(rsa), /Ed25519/)
})

test('invalid activation, activation retries and device limit do not create duplicate slots', async t => {
  const s = await fixture(t, { maxDevices: 1 })
  await assert.rejects(s.client.activate('VTX-' + 'F'.repeat(48)), /invalid/)
  assert.equal(s.authority.devices(s.license.licenseId).length, 0)
  await s.client.activate(s.license.activationKey); await s.client.activate(s.license.activationKey)
  assert.equal(s.authority.devices(s.license.licenseId).length, 1)
  const other = new LicenseClient({ ...s.options, path: join(s.directory, 'other.bin'), binding: () => 'b'.repeat(32) })
  await assert.rejects(other.activate(s.license.activationKey), /Device limit/)
  assert.equal(other.status().state, 'unactivated')
  assert.equal(s.authority.db.prepare('SELECT count(*) AS n FROM company_audit WHERE action=?').get('register-device').n, 1)
})

test('signed suspension locks immediately after refresh and survives restart and network failure', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  s.authority.changeStatus(s.license.licenseId, 'suspended', 'Unpaid subscription')
  assert.equal(s.client.status().canTransact, true)
  assert.equal((await s.client.refresh()).state, 'suspended')
  assert.throws(() => s.client.authorize('pos:complete-sale'), /suspended/)
  const offline = new LicenseClient({ ...s.options, transport: async () => { throw new Error('offline') } })
  await assert.rejects(offline.refresh(), /offline/)
  assert.equal(offline.status().state, 'suspended')
})

test('renewal preserves suspension, resume returns same tenant and enables operations', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  s.authority.changeStatus(s.license.licenseId, 'suspended', 'Overdue payment'); await s.client.refresh()
  s.authority.renew(s.license.licenseId, initialTime + 90 * day, 'Paid annual renewal')
  assert.equal((await s.client.refresh()).state, 'suspended')
  s.authority.changeStatus(s.license.licenseId, 'active', 'Payment settled')
  const next = await s.client.refresh()
  assert.equal(next.state, 'active'); assert.equal(next.tenantId, s.license.tenantId); assert.equal(next.expiresAt, new Date(initialTime + 90 * day).toISOString())
  s.client.authorize('pos:complete-sale')
})

test('active and offline grace end at signed boundaries without an internet connection', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  s.advance(day - 1); assert.equal(s.client.status().state, 'active')
  s.advance(1); assert.equal(s.client.status().state, 'grace'); s.client.authorize('pos:complete-sale')
  s.advance(6 * day); assert.equal(s.client.status().state, 'expired')
  assert.throws(() => s.client.authorize('products:save'), /Offline license validity/)
  assert.equal(new LicenseClient(s.options).status().state, 'expired')
})

test('license expiration caps offline validity and company renewal restores expired device', async t => {
  const s = await fixture(t)
  s.authority.renew(s.license.licenseId, initialTime + day / 2, 'Short test subscription')
  await s.client.activate(s.license.activationKey)
  assert.equal(s.client.status().offlineUntil, new Date(initialTime + day / 2).toISOString())
  s.advance(day / 2); assert.equal(s.client.status().state, 'expired')
  assert.equal((await s.client.refresh()).state, 'expired')
  s.authority.renew(s.license.licenseId, initialTime + 60 * day, 'Renew expired subscription')
  assert.equal((await s.client.refresh()).state, 'active')
})

test('clock rollback locks after persisted time and signed online verification recovers corrected clock', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  s.advance(2 * day); s.client.status()
  s.setClock(initialTime)
  assert.equal(s.client.status().state, 'clock_error')
  assert.equal(new LicenseClient(s.options).status().state, 'clock_error')
  await assert.rejects(s.client.refresh(), /clock/)
  s.setClock(initialTime + 2 * day)
  assert.equal(s.client.status().state, 'clock_error')
  assert.equal((await s.client.refresh()).state, 'active')
})

test('monotonic time prevents frozen wall clock from extending lease in a running process', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  s.setMonotonic(8 * day)
  assert.equal(s.client.status().state, 'expired')
  assert.equal(s.client.status().canTransact, false)
})

test('fractional monotonic milliseconds persist as integer timestamps that survive restart', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  s.setClock(initialTime + 60000); s.setMonotonic(60000.7)
  assert.equal(s.client.status().state, 'active')
  assert.ok(Number.isSafeInteger(s.readState().maxSeen))
  assert.equal(new LicenseClient(s.options).status().state, 'active')
})

test('offline service failure keeps valid lease and does not extend offline deadline', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const offline = new LicenseClient({ ...s.options, transport: async () => { throw new Error('Service unavailable') } })
  await assert.rejects(offline.refresh(), /unavailable/)
  assert.equal(offline.status().canTransact, true)
  assert.equal(offline.status().offlineUntil, new Date(initialTime + 7 * day).toISOString())
  s.advance(7 * day)
  assert.equal(offline.status().canTransact, false)
})

test('tampered envelope and wrong issuer are rejected without overwriting current signed lease', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const envelope = s.readState().lease
  const invalid = { ...envelope, payload: Buffer.from('{"status":"active"}').toString('base64url') }
  assert.throws(() => verifyLease(invalid, s.issuer.publicKey), /signature/)
  assert.throws(() => verifyLease(envelope, keys().publicKey), /signature/)
  const client = new LicenseClient({ ...s.options, transport: async () => new Response(JSON.stringify(invalid)) })
  await assert.rejects(client.refresh(), /signature/)
  assert.equal(client.status().state, 'active')
  assert.deepEqual(s.readState().lease, envelope)
})

test('older response and stale nonce cannot revive a suspended device', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const old = s.readState().lease
  s.authority.changeStatus(s.license.licenseId, 'suspended', 'Security hold'); await s.client.refresh()
  const replay = new LicenseClient({ ...s.options, transport: async () => new Response(JSON.stringify(old)) })
  await assert.rejects(replay.refresh(), /older|match/)
  assert.equal(replay.status().state, 'suspended')
  const sequenceReplay = new LicenseClient({ ...s.options, transport: async (_url, init) => {
    const request = JSON.parse(init.body), c = verifyLease(old, s.issuer.publicKey)
    return new Response(JSON.stringify(signLease({ ...c, nonce: request.nonce }, s.issuer.privateKey)))
  } })
  await assert.rejects(sequenceReplay.refresh(), /older/)
  assert.equal(sequenceReplay.status().state, 'suspended')
})

test('protected file corruption is locked and never silently creates a new device', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const file = readFileSync(s.options.path); file[35] ^= 1; writeFileSync(s.options.path, file)
  const damaged = new LicenseClient(s.options)
  assert.equal(damaged.status().state, 'invalid')
  await assert.rejects(damaged.activate(s.license.activationKey), /security state/)
  assert.deepEqual(readFileSync(s.options.path), file)
})

test('device and installation binding reject a transplanted lease or different business backup', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const state = s.readState(), pair = keys()
  s.writeState({ ...state, ...pair })
  assert.equal(new LicenseClient(s.options).status().state, 'invalid')
  s.writeState(state); s.setBinding('b'.repeat(32))
  assert.equal(s.client.status().state, 'invalid')
  await assert.rejects(s.client.refresh(), /match/)
  await assert.rejects(s.client.activate(s.license.activationKey), /another license or installation/)
})

test('revoked device stays revoked on reactivation and frees its company slot', async t => {
  const s = await fixture(t, { maxDevices: 1 })
  await s.client.activate(s.license.activationKey)
  s.authority.revokeDevice(s.client.status().deviceId, 'Lost computer')
  assert.equal((await s.client.refresh()).state, 'revoked')
  assert.equal((await s.client.activate(s.license.activationKey)).state, 'revoked')
  const replacement = new LicenseClient({ ...s.options, path: join(s.directory, 'replacement.bin') })
  assert.equal((await replacement.activate(s.license.activationKey)).state, 'active')
})

test('company explicitly rebinds a restored installation without changing tenant or reviving revoked devices', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const deviceId = s.client.status().deviceId
  s.setBinding('b'.repeat(32))
  assert.equal(s.client.status().state, 'invalid')
  s.authority.rebindDevice(deviceId, 'b'.repeat(32), 'Verified owner restored another installation')
  const result = await s.client.refresh()
  assert.equal(result.state, 'active'); assert.equal(result.tenantId, s.license.tenantId); assert.equal(result.deviceId, deviceId)
  assert.equal(s.authority.db.prepare("SELECT count(*) AS n FROM company_audit WHERE action='rebind-device'").get().n, 1)
  s.authority.revokeDevice(deviceId, 'Retired terminal')
  assert.throws(() => s.authority.rebindDevice(deviceId, binding, 'Unauthorized revival'), /Revoked/)
})

test('device proof authenticates requests and replay protection persists across company restart', async t => {
  const s = await fixture(t), pair = keys()
  const input = { action: 'activate', publicKey: pair.publicKey, installationId: binding, nonce: randomBytes(32).toString('hex'), timestamp: initialTime, activationKey: s.license.activationKey }
  const request = signDeviceRequest(input, pair.privateKey)
  const lease = s.authority.exchange(request)
  assert.equal(verifyLease(lease, s.issuer.publicKey).sequence, 1)
  assert.throws(() => s.authority.exchange(request), /already used/)
  assert.throws(() => s.reopenAuthority().exchange(request), /already used/)
  assert.throws(() => s.authority.exchange({ ...request, installationId: 'b'.repeat(32) }), /proof/)
  assert.throws(() => s.authority.exchange(signDeviceRequest({ ...input, nonce: randomBytes(32).toString('hex') }, keys().privateKey)), /proof/)
})

test('registered device cannot refresh against another tenant or activation key', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const other = s.authority.issue('Other customer', initialTime + 30 * day), state = s.readState()
  const request = signDeviceRequest({ action: 'refresh', publicKey: state.publicKey, installationId: binding, nonce: randomBytes(32).toString('hex'), timestamp: initialTime, licenseId: other.licenseId, tenantId: other.tenantId }, state.privateKey)
  assert.throws(() => s.authority.exchange(request), /match/)
  await assert.rejects(s.client.activate(other.activationKey), /another license/)
  assert.equal(s.client.status().tenantId, s.license.tenantId)
})

test('company audit failure rolls back device registration and nonce, leaving retry possible', async t => {
  const s = await fixture(t)
  s.authority.db.exec("CREATE TRIGGER fail_register BEFORE INSERT ON company_audit WHEN NEW.action='register-device' BEGIN SELECT RAISE(ABORT,'test audit failure'); END")
  await assert.rejects(s.client.activate(s.license.activationKey))
  assert.equal(s.authority.devices(s.license.licenseId).length, 0)
  assert.equal(s.authority.db.prepare('SELECT count(*) AS n FROM request_nonces').get().n, 0)
  s.authority.db.exec('DROP TRIGGER fail_register')
  assert.equal((await s.client.activate(s.license.activationKey)).state, 'active')
})

test('concurrent checks serialize and changed owner session cannot accept activation', async t => {
  const s = await fixture(t)
  let release, begun
  const ready = new Promise(resolve => { begun = resolve })
  const client = new LicenseClient({ ...s.options, transport: async (url, init) => { begun(); await new Promise(resolve => { release = resolve }); return fetch(url, init) } })
  const first = client.activate(s.license.activationKey, () => { throw new Error('Session changed') })
  await ready
  await assert.rejects(client.activate(s.license.activationKey), /already in progress/)
  release(); await assert.rejects(first, /Session changed/)
  assert.equal(client.status().state, 'unactivated'); assert.equal(s.readState().maxSequence, 0)
  assert.equal((await s.client.activate(s.license.activationKey)).state, 'active')
})

test('oversized, redirected and malformed service responses never replace a valid license', async t => {
  const s = await fixture(t)
  await s.client.activate(s.license.activationKey)
  const oversized = new LicenseClient({ ...s.options, transport: async () => new Response('x'.repeat(20000)) })
  await assert.rejects(oversized.refresh(), /too large/)
  assert.equal(oversized.status().state, 'active')
  const malformed = new LicenseClient({ ...s.options, transport: async (_url, init) => { assert.equal(init.redirect, 'error'); assert.ok(init.signal); return new Response('not JSON') } })
  await assert.rejects(malformed.refresh())
  assert.equal(malformed.status().state, 'active')
})

test('company HTTP service exposes only bounded device activation and refresh APIs', async t => {
  const s = await fixture(t)
  const admin = await fetch(s.trust.serviceUrl + '/admin/suspend', { method: 'POST', body: '{}' })
  assert.equal(admin.status, 404)
  const mismatch = await fetch(s.trust.serviceUrl + '/v1/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) })
  assert.equal(mismatch.status, 400)
  const plain = await fetch(s.trust.serviceUrl + '/v1/activate', { method: 'POST', body: '{}' })
  assert.equal(plain.status, 400)
  assert.equal(plain.headers.get('cache-control'), 'no-store')
  for (let i = 0; i < 30; i++) await fetch(s.trust.serviceUrl + '/v1/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  const limited = await fetch(s.trust.serviceUrl + '/v1/refresh', { method: 'POST', body: '{}' })
  assert.equal(limited.status, 429)
})

test('only owner manages licensing; signed-in staff can view status; signed-out callers are denied', async t => {
  const db = new VertexiaDatabase(':memory:'); t.after(() => db.close())
  const auth = new AuthRepository(db.connection)
  assert.throws(() => authorizeIpc(auth, db, 'licensing:status', []), /Sign in/)
  await auth.setup(setupInput)
  for (const channel of ['licensing:status', 'licensing:activate', 'licensing:refresh']) authorizeIpc(auth, db, channel, [])
  await auth.createUser({ name: 'Cashier', username: 'license.cashier', password: 'Cashier temporary password', role: 'Cashier', branchIds: ['branch-main'] })
  auth.logout(); await auth.login('license.cashier', 'Cashier temporary password'); await auth.changePassword('Cashier temporary password', 'Cashier personal passphrase')
  authorizeIpc(auth, db, 'licensing:status', [])
  for (const channel of ['licensing:activate', 'licensing:refresh']) assert.throws(() => authorizeIpc(auth, db, channel, []), /permission/)
})

test('license expiry during staff password hashing prevents late mutation without affecting owner password changes', async t => {
  const db = new VertexiaDatabase(':memory:'); t.after(() => db.close())
  let locked = false
  const auth = new AuthRepository(db.connection, undefined, () => { if (locked) throw new Error('POS license locked') })
  await auth.setup(setupInput)
  const work = auth.createUser({ name: 'Cashier', username: 'expiry.cashier', password: 'Cashier temporary password', role: 'Cashier', branchIds: ['branch-main'] })
  await new Promise(resolve => setImmediate(resolve)); locked = true
  await assert.rejects(work, /license locked/)
  assert.ok(!auth.listUsers().some(user => user.username === 'expiry.cashier'))
  await auth.changePassword(setupInput.password, 'Owner changed passphrase 2026')
  assert.equal(auth.current().role, 'Owner')
})

test('background license status polling does not extend authentication idle lifetime', async t => {
  const db = new VertexiaDatabase(':memory:'); t.after(() => db.close())
  let time = initialTime
  const auth = new AuthRepository(db.connection, () => new Date(time))
  await auth.setup(setupInput)
  for (let minute = 1; minute < 30; minute++) { time = initialTime + minute * 60000; authorizeIpc(auth, db, 'licensing:status', []) }
  time = initialTime + 30 * 60000
  assert.throws(() => authorizeIpc(auth, db, 'licensing:status', []), /Session expired/)
  assert.equal(auth.current(), null)
})

test('financial database backup excludes device keys and cannot roll back signed suspension', async t => {
  let db
  t.after(() => { if (db?.connection.isOpen) db.close() })
  const s = await fixture(t), path = join(s.directory, 'shop.db'), copy = join(s.directory, 'backup.sqlite')
  db = new VertexiaDatabase(path)
  s.setBinding(String(db.connection.prepare("SELECT value FROM app_meta WHERE key='installation_id'").get().value))
  await s.client.activate(s.license.activationKey)
  await backup(db.connection, copy)
  s.authority.changeStatus(s.license.licenseId, 'suspended', 'Disable before restore'); await s.client.refresh()
  const restored = new DatabaseSync(copy, { readOnly: true })
  try {
    assert.ok(!restored.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().some(row => /licens|device|tenant/.test(row.name)))
    s.setBinding(String(restored.prepare("SELECT value FROM app_meta WHERE key='installation_id'").get().value))
    assert.equal(new LicenseClient(s.options).status().state, 'suspended')
  } finally { restored.close() }
})

test('every existing mutation is gated and unknown future channels default to locked', () => {
  const writes = ['branches:create', 'branches:update', 'branches:set-active', 'transfers:dispatch', 'transfers:receive', 'transfers:cancel', 'customers:create', 'customers:update', 'customers:collect', 'expenses:post', 'expenses:reverse', 'cash:move', 'retail:adjust-stock', 'retail:receive-purchase', 'retail:pay-supplier', 'pos:complete-sale', 'pos:hold-sale', 'pos:resume-held-sale', 'pos:delete-held-sale', 'pos:open-shift', 'pos:create-product', 'pos:create-customer', 'products:save', 'products:toggle-status', 'products:import-csv', 'sales:create-return', 'auth:create-user', 'auth:update-user', 'auth:reset-password', 'future:mutation']
  for (const channel of writes) assert.equal(requiresTransactionLicense(channel), true, channel)
})

test('company CLI initializes once, issues keys and controls licenses without public administrator APIs', async t => {
  const s = await fixture(t), directory = join(s.directory, 'cli-company')
  const run = (...args) => spawnSync(process.execPath, ['scripts/company-license.mjs', ...args], { encoding: 'utf8', env: { ...process.env, VERTEXIA_COMPANY_DATA: directory } })
  assert.equal(run('init', 'http://127.0.0.1:8787').status, 0)
  const privateKey = readFileSync(join(directory, 'issuer-private.pem'))
  assert.equal(run('init', 'http://127.0.0.1:8787').status, 1)
  assert.deepEqual(readFileSync(join(directory, 'issuer-private.pem')), privateKey)
  const issued = run('issue', 'CLI test customer', new Date(Date.now() + 30 * day).toISOString(), '2', '7')
  assert.equal(issued.status, 0, issued.stderr)
  const license = JSON.parse(issued.stdout)
  assert.match(license.activationKey, /^VTX-[A-F0-9]{48}$/)
  const listed = run('list'); assert.equal(listed.status, 0); assert.ok(!listed.stdout.includes(license.activationKey))
  assert.equal(run('suspend', license.licenseId, 'Test payment pending').status, 0)
  assert.equal(JSON.parse(run('list').stdout)[0].status, 'suspended')
  assert.equal(run('renew', license.licenseId, new Date(Date.now() + 90 * day).toISOString(), 'Renewal paid').status, 0)
  assert.equal(JSON.parse(run('list').stdout)[0].status, 'suspended')
  assert.equal(run('resume', license.licenseId, 'Payment verified').status, 0)
  assert.equal(JSON.parse(run('list').stdout)[0].status, 'active')
  assert.equal(run('issue', 'Invalid expiry', 'not-a-date').status, 1)
})
