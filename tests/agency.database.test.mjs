import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer, request as httpRequest } from 'node:http'
import { generateKeyPairSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { LicenseClient } from '../electron-dist/electron/licensing/client.mjs'
import { AgencyAuth, totp } from '../electron-dist/electron/licensing/agency-auth.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'
import { signDeviceRequest, signLease, verifyLease } from '../electron-dist/electron/licensing/protocol.mjs'
import { licenseBranches } from '../electron-dist/electron/ipc-policy.mjs'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'

const day = 86400000, passphrase = 'Private agency test passphrase 2026'
const inventory = () => ({ businessName: 'Retail Network', ownerName: 'Taha Owner', branches: [{ id: 'branch-main', name: 'Main Store', code: 'MAIN', city: 'Karachi' }, { id: 'branch-lahore', name: 'Lahore Store', code: 'LHR', city: 'Lahore' }] })
test('authenticator output matches RFC 6238 SHA-1 vectors reduced to six digits, including post-2038 time', () => {
  const secret = Buffer.from('12345678901234567890').toString('hex')
  for (const [time, expected] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']]) assert.equal(totp(secret, Math.floor(time / 30)), expected)
})
async function fixture(t, settings = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'vertexia-agency-test-')), keys = generateKeyPairSync('ed25519'), privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  let now = Date.now(), current = 'branch-main', details = inventory()
  const authority = new LicenseAuthority(join(directory, 'company.db'), privateKey, () => now), license = authority.issue('Owner One', now + 30 * day, 4)
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve))
  const origin = 'http://127.0.0.1:' + port, publicOrigin = settings.https ? 'https://127.0.0.1:' + port : origin, server = createLicenseServer(authority, { origin: publicOrigin, allowLocal: true })
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  const protectionKey = randomBytes(32), protector = {
    encrypt(value) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', protectionKey, iv); return Buffer.concat([iv, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]) },
    decrypt(value) { const cipher = createDecipheriv('aes-256-gcm', protectionKey, value.subarray(0, 12)); cipher.setAuthTag(value.subarray(-16)); return Buffer.concat([cipher.update(value.subarray(12, -16)), cipher.final()]).toString('utf8') },
  }
  const options = { path: join(directory, 'client.bin'), trust: { serviceUrl: origin, issuerPublicKey: authority.publicKey }, allowLocal: true, binding: () => 'a'.repeat(32), inventory: () => details, currentBranch: () => current, protector, clock: () => now, monotonic: () => 0 }
  const client = new LicenseClient(options), auth = new AgencyAuth(authority.db, () => now)
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); authority.close(); const target = resolve(directory); assert.equal(dirname(target), resolve(tmpdir())); assert.ok(basename(target).startsWith('vertexia-agency-test-')); rmSync(target, { recursive: true, force: true }) })
  const request = (path, body, headers = {}) => fetch(origin + '/agency/api/' + path, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), headers: { 'Content-Type': 'application/json', Origin: publicOrigin, ...headers } })
  const login = async () => {
    await auth.provision('agency.admin', passphrase)
    const row = authority.db.prepare('SELECT totp_secret FROM agency_admins').get(), response = await request('login', { username: 'agency.admin', password: passphrase, code: totp(row.totp_secret, Math.floor(Date.now() / 30000)) })
    assert.equal(response.status, 200); const session = await response.json()
    return { Cookie: response.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': session.csrf, response, session }
  }
  return { directory, authority, license, client, options, auth, origin, request, login, privateKey, protector, advance(ms) { now += ms }, select(id) { current = id }, inventory(value) { details = value }, state() { return JSON.parse(protector.decrypt(readFileSync(options.path))) }, save(value) { writeFileSync(options.path, protector.encrypt(JSON.stringify(value))) } }
}

test('branch commands isolate Karachi and Lahore and survive restart/offline; unlock preserves global overrides', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey)
  const claims = verifyLease(s.state().lease, s.authority.publicKey); assert.equal(claims.version, 2); assert.equal(claims.branches.length, 2)
  const branch = s.authority.dashboard().businesses[0].branches.find(b => b.localId === 'branch-lahore')
  s.authority.changeBranchStatus(branch.id, 'suspended', 'Remote branch shutdown')
  assert.equal(s.client.status('branch-lahore').canTransact, true, 'Offline cached decision must not pretend to have received an unsent command')
  await s.client.refresh()
  s.client.authorize('pos:complete-sale', 'branch-main')
  assert.throws(() => s.client.authorize('pos:complete-sale', 'branch-lahore'), /branch is locked/)
  s.select('branch-lahore'); assert.equal(s.client.status().state, 'suspended')
  const offline = new LicenseClient({ ...s.options, transport: async () => { throw new Error('offline') } })
  await offline.automatic(); assert.equal(offline.status().state, 'suspended'); offline.authorize('backup:create'); offline.authorize('cash:close-shift')
  s.authority.changeStatus(s.license.licenseId, 'suspended', 'Business suspended')
  s.authority.changeBranchStatus(branch.id, 'active', 'Individual branch enabled')
  await s.client.refresh(); assert.equal(s.client.status('branch-main').canTransact, false); assert.equal(s.client.status().canTransact, false)
  s.authority.changeStatus(s.license.licenseId, 'active', 'Business resumed'); await s.client.refresh(); s.client.authorize('pos:complete-sale', 'branch-lahore')
})

test('new branches are pending; rename, reactivation and a replacement local ID cannot escape a company lock', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey)
  const branch = s.authority.dashboard().businesses[0].branches[0]
  s.authority.changeBranchStatus(branch.id, 'suspended', 'Subscription branch lock')
  const next = inventory(); next.branches.find(b => b.id === branch.localId).name = 'Renamed'; next.branches.push({ id: 'branch-replacement', name: 'Replacement', code: 'NEW', city: 'Karachi' })
  s.inventory(next); await s.client.refresh()
  assert.equal(s.client.status(branch.localId).state, 'suspended'); assert.equal(s.client.status('branch-replacement').state, 'pending')
  assert.equal(s.client.status('invented-branch').state, 'pending')
  const pending = s.authority.dashboard().businesses[0].branches.find(b => b.localId === 'branch-replacement')
  s.authority.changeBranchStatus(pending.id, 'active', 'Company approved extra branch'); await s.client.refresh(); assert.equal(s.client.status('branch-replacement').canTransact, true)
  assert.equal(s.client.status(branch.localId).canTransact, false)
})

test('another installation under the same owner requires approval; identical legacy local IDs are isolated across tenants', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey)
  const another = new LicenseClient({ ...s.options, path: join(s.directory, 'another.bin'), binding: () => 'b'.repeat(32) })
  assert.equal((await another.activate(s.license.activationKey)).state, 'pending')
  const otherLicense = s.authority.issue('Owner Two', Date.now() + 30 * day)
  const other = new LicenseClient({ ...s.options, path: join(s.directory, 'other.bin'), binding: () => 'c'.repeat(32) })
  assert.equal((await other.activate(otherLicense.activationKey)).state, 'active')
  const main = s.authority.dashboard().businesses.find(b => b.licenseId === s.license.licenseId).branches.find(b => b.installationId === 'a'.repeat(32) && b.localId === 'branch-main')
  s.authority.changeBranchStatus(main.id, 'suspended', 'Only owner one main branch'); await s.client.refresh(); await other.refresh()
  assert.equal(s.client.status().canTransact, false); assert.equal(other.status().canTransact, true)
})

test('dashboard distinguishes command sent from persisted command acknowledged by each device', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey); await s.client.refresh()
  let branch = s.authority.dashboard().businesses[0].branches.find(b => b.localId === 'branch-main'); assert.equal(branch.applied, true)
  s.authority.changeBranchStatus(branch.id, 'suspended', 'Remote command')
  assert.equal(s.authority.dashboard().businesses[0].branches.find(b => b.id === branch.id).applied, false)
  await s.client.refresh(); assert.equal(s.client.status().canTransact, false)
  assert.equal(s.authority.dashboard().businesses[0].branches.find(b => b.id === branch.id).applied, false)
  await s.client.refresh(); branch = s.authority.dashboard().businesses[0].branches.find(b => b.id === branch.id)
  assert.equal(branch.applied, true); assert.equal(branch.online, true)
  s.advance(45000); assert.equal(s.authority.dashboard().businesses[0].branches.find(b => b.id === branch.id).online, false)
})

test('offline expiry, renewal and device revocation take precedence over enabled branches', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey); s.advance(7 * day)
  assert.equal(s.client.status('branch-main').state, 'expired'); assert.equal(s.client.status('branch-lahore').state, 'expired')
  s.advance(-7 * day); s.authority.revokeDevice(s.client.status().deviceId, 'Device retired'); await s.client.refresh()
  assert.equal(s.client.status().state, 'revoked'); assert.equal(s.client.status('branch-lahore').canTransact, false)
})

test('branch claims cannot be tampered, downgraded or omitted after registration', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey)
  const state = s.state(), original = verifyLease(state.lease, s.authority.publicKey)
  const tampered = structuredClone(state); const claims = structuredClone(original); claims.branches[0].status = 'suspended'; tampered.lease.payload = Buffer.from(JSON.stringify(claims)).toString('base64url'); s.save(tampered)
  assert.equal(new LicenseClient(s.options).status().canTransact, false); s.save(state)
  const downgrade = new LicenseClient({ ...s.options, transport: async (_url, init) => {
    const req = JSON.parse(init.body), { branches: _branches, ...legacy } = original
    return Response.json(signLease({ ...legacy, version: 1, sequence: original.sequence + 1, nonce: req.nonce }, s.privateKey))
  } })
  await assert.rejects(downgrade.refresh(), /Branch license scope/); assert.equal(downgrade.status().canTransact, true)
  const request = signDeviceRequest({ action: 'refresh', publicKey: state.publicKey, installationId: s.options.binding(), tenantId: original.tenantId, licenseId: original.licenseId, nonce: randomBytes(32).toString('hex'), timestamp: Date.now() }, state.privateKey)
  assert.throws(() => s.authority.exchange(request), /registration details are required/)
})

test('strict registration bounds reject duplicate branches and unsigned inventory modifications', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey)
  const bad = inventory(); bad.branches.push(bad.branches[0]); s.inventory(bad); await assert.rejects(s.client.refresh(), /registration details/)
  const state = s.state(), old = verifyLease(state.lease, s.authority.publicKey)
  const req = signDeviceRequest({ action: 'refresh', publicKey: state.publicKey, installationId: s.options.binding(), tenantId: old.tenantId, licenseId: old.licenseId, inventory: inventory(), nonce: randomBytes(32).toString('hex'), timestamp: Date.now() }, state.privateKey)
  req.inventory.ownerName = 'Forged owner'; assert.throws(() => s.authority.exchange(req), /proof/)
})

test('posting scopes include destination, branch update target and the branch owning a held cart', t => {
  const db = new VertexiaDatabase(':memory:'); t.after(() => db.close())
  assert.deepEqual(licenseBranches(db, 'transfers:dispatch', [{ branchId: 'branch-main', destinationBranchId: 'locked' }], 'branch-main'), ['branch-main', 'locked'])
  assert.deepEqual(licenseBranches(db, 'branches:update', [{ branchId: 'branch-main', targetBranchId: 'locked' }], 'branch-main'), ['branch-main', 'locked'])
  assert.deepEqual(licenseBranches(db, 'products:save', ['locked', {}], 'branch-main'), ['branch-main', 'locked'])
  db.connection.prepare('INSERT INTO held_sales(id,branch_id,customer_id,cart_json,item_count,total_paisa,held_at) VALUES (?,?,?,?,1,0,?)').run('held-license', 'branch-main', 'customer-walk-in', '[]', new Date().toISOString())
  assert.deepEqual(licenseBranches(db, 'pos:resume-held-sale', ['held-license'], 'another'), ['another', 'branch-main'])
})

test('dashboard requires separate MFA login, hides private data, prevents CSRF and audits company actions', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey)
  assert.equal((await s.request('dashboard')).status, 401)
  const anonymous = await s.request('branch-status', { id: 'x', status: 'suspended' }); assert.equal(anonymous.status, 401)
  const html = await fetch(s.origin + '/agency/'); assert.equal(html.status, 200); assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  assert.equal((await fetch(s.origin + '/agency/../issuer-private.pem')).status, 404)
  assert.equal((await s.request('login', { username: 'owner', password: passphrase, code: '000000' })).status, 400)
  const headers = await s.login(); assert.match(headers.response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  const snapshot = await (await s.request('dashboard', undefined, headers)).json()
  assert.equal(snapshot.businesses[0].devices[0].ownerName, 'Taha Owner')
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE KEY')); assert.ok(!JSON.stringify(snapshot).includes(s.license.activationKey)); assert.ok(!JSON.stringify(snapshot).includes('password_hash'))
  const branch = snapshot.businesses[0].branches[0]
  assert.equal((await s.request('branch-status', { id: branch.id, status: 'suspended' }, { Cookie: headers.Cookie })).status, 403)
  assert.equal((await s.request('branch-status', { id: branch.id, status: 'suspended' }, { ...headers, Origin: 'https://evil.test' })).status, 403)
  assert.equal((await s.request('branch-status', { id: branch.id, status: 'suspended' }, headers)).status, 200)
  await s.client.refresh(); assert.equal(s.client.status(branch.localId).canTransact, false)
  const audit = s.authority.db.prepare("SELECT detail FROM company_audit WHERE action='branch-suspended'").get(); assert.match(audit.detail, /actor/)
  assert.equal((await s.request('license-status', { id: s.license.licenseId, status: 'suspended' }, headers)).status, 200)
  assert.equal((await s.request('branch-status', { id: branch.id, status: 'active' }, headers)).status, 200)
  await s.client.refresh(); assert.equal(s.client.status(branch.localId).canTransact, false)
  assert.equal((await s.request('logout', {}, headers)).status, 200); assert.equal((await s.request('dashboard', undefined, headers)).status, 401)
})

test('production origin sets secure host cookie and rejects a spoofed dashboard Host', async t => {
  const s = await fixture(t, { https: true }), headers = await s.login()
  assert.match(headers.response.headers.get('set-cookie'), /^__Host-vertexia_agency=/); assert.match(headers.response.headers.get('set-cookie'), /; Secure/)
  const spoofed = await new Promise((resolve, reject) => { const req = httpRequest(s.origin + '/agency/api/dashboard', { headers: { Cookie: headers.Cookie, Host: 'evil.test' } }, res => { res.resume(); resolve(res.statusCode) }); req.on('error', reject); req.end() })
  assert.equal(spoofed, 403)
  assert.match(headers.response.headers.get('strict-transport-security'), /31536000/)
})

test('administrator throttling persists, TOTP codes cannot be replayed, passive polling cannot extend sessions', async t => {
  const s = await fixture(t); await s.auth.provision('agency.admin', passphrase)
  const secret = s.authority.db.prepare('SELECT totp_secret FROM agency_admins').get().totp_secret
  for (let n = 0; n < 5; n++) await assert.rejects(s.auth.login('agency.admin', 'wrong password', '000000'), /Invalid/)
  await assert.rejects(new AgencyAuth(s.authority.db).login('agency.admin', passphrase, totp(secret, Math.floor(Date.now() / 30000))), /Too many/)
  s.advance(16 * 60000)
  const now = Date.now() + 16 * 60000, code = totp(secret, Math.floor(now / 30000)), session = await s.auth.login('agency.admin', passphrase, code)
  await assert.rejects(s.auth.login('agency.admin', passphrase, code), /Invalid/)
  assert.ok(s.auth.session(session.token)); assert.equal(s.authority.db.prepare('SELECT token_hash FROM agency_sessions').get().token_hash.includes(session.token), false)
  s.advance(29 * 60000); assert.ok(s.auth.session(session.token)); s.advance(60000); assert.equal(s.auth.session(session.token), null)
})

test('private administrator reset rotates MFA, invalidates sessions and records recovery', async t => {
  const s = await fixture(t); const headers = await s.login()
  const first = s.authority.db.prepare('SELECT totp_secret FROM agency_admins').get().totp_secret
  await s.auth.provision('agency.admin', 'Replacement agency passphrase 2026', true)
  assert.notEqual(s.authority.db.prepare('SELECT totp_secret FROM agency_admins').get().totp_secret, first)
  assert.equal((await s.request('dashboard', undefined, headers)).status, 401)
  assert.equal(s.authority.db.prepare("SELECT count(*) AS n FROM company_audit WHERE action='admin-reset'").get().n, 1)
})

test('old company registries migrate without replacing licenses, signing identity or device sequence', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey)
  const state = s.state(), id = s.client.status().deviceId, before = s.authority.db.prepare('SELECT sequence FROM devices WHERE id=?').get(id).sequence
  s.authority.db.exec('DROP TABLE company_device_meta; DROP TABLE company_branches;')
  const reopened = new LicenseAuthority(join(s.directory, 'company.db'), s.privateKey)
  assert.equal(reopened.publicKey, s.authority.publicKey); assert.equal(reopened.devices(s.license.licenseId).length, 1)
  assert.equal(reopened.db.prepare('SELECT sequence FROM devices WHERE id=?').get(id).sequence, before)
  assert.equal(verifyLease(state.lease, reopened.publicKey).tenantId, s.license.tenantId)
  reopened.close()
})

test('a company rebind cannot label the previous installation receipt as applied to its replacement', async t => {
  const s = await fixture(t); await s.client.activate(s.license.activationKey); await s.client.refresh()
  const id = s.client.status().deviceId
  s.authority.rebindDevice(id, 'b'.repeat(32), 'Approved new database recovery')
  const replacement = new LicenseClient({ ...s.options, binding: () => 'b'.repeat(32) })
  assert.equal(replacement.status().canTransact, false)
  await replacement.refresh()
  let branch = s.authority.dashboard().businesses[0].branches.find(b => b.installationId === 'b'.repeat(32) && b.localId === 'branch-main')
  s.authority.changeBranchStatus(branch.id, 'active', 'Company approves recovered branch')
  assert.equal(s.authority.dashboard().businesses[0].branches.find(b => b.id === branch.id).applied, false)
  await replacement.refresh(); assert.equal(replacement.status().canTransact, true)
  assert.equal(s.authority.dashboard().businesses[0].branches.find(b => b.id === branch.id).applied, false)
  await replacement.refresh(); branch = s.authority.dashboard().businesses[0].branches.find(b => b.id === branch.id)
  assert.equal(branch.applied, true)
})
