import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { AgencyAuth, totp } from '../electron-dist/electron/licensing/agency-auth.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'

export async function localFixture(t, setupEnabled = true) {
  const directory = mkdtempSync(join(tmpdir(), 'vertexia-local-agency-test-')), privateKey = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const authority = new LicenseAuthority(join(directory, 'company.db'), privateKey), token = randomBytes(32).toString('hex')
  // Reserve a port before creating the server with its exact permitted origin.
  const { createServer } = await import('node:net'), probe = createServer()
  await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const origin = 'http://127.0.0.1:' + port, server = createLicenseServer(authority, { origin, allowLocal: true, ...(setupEnabled ? { localSetupToken: token } : {}) })
  await new Promise(r => server.listen(port, '127.0.0.1', r))
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); authority.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('vertexia-local-agency-test-')); rmSync(directory, { recursive: true, force: true }) })
  const post = (input, headers = {}) => fetch(origin + '/agency/api/setup', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'x-setup-token': token, ...headers }, body: JSON.stringify(input) })
  return { authority, token, origin, server, post }
}

test('first local account needs a private capability, exact origin and host; MFA login opens the existing dashboard', async t => {
  const s = await localFixture(t), input = { username: 'local.admin', password: 'Private isolated local onboarding password' }
  assert.equal((await s.post(input, { 'x-setup-token': '' })).status, 403)
  assert.equal((await s.post(input, { Origin: 'http://example.com' })).status, 403)
  const spoofedHost = await new Promise((done, reject) => {
    const request = httpRequest(s.origin + '/agency/api/setup', { method: 'POST', headers: { Host: 'example.com', Origin: s.origin, 'Content-Type': 'application/json', 'x-setup-token': s.token } }, response => { response.resume(); done(response.statusCode) })
    request.on('error', reject); request.end(JSON.stringify(input))
  })
  assert.equal(spoofedHost, 403)
  const page = await fetch(s.origin + '/agency/setup'); assert.equal(page.status, 200); assert.match(await page.text(), /Create agency account/)
  const response = await s.post(input); assert.equal(response.status, 201); const enrollment = await response.json(); assert.match(enrollment.secret, /^[A-Z2-7]+$/)
  const admin = s.authority.db.prepare('SELECT * FROM agency_admins').get(); assert.notEqual(admin.password_hash, input.password)
  const login = await fetch(s.origin + '/agency/api/login', { method: 'POST', headers: { Origin: s.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, code: totp(admin.totp_secret, Math.floor(Date.now() / 30000)) }) })
  assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie').split(';')[0]
  const dashboard = await fetch(s.origin + '/agency/api/dashboard', { headers: { Cookie: cookie } }); assert.equal(dashboard.status, 200); assert.ok(!JSON.stringify(await dashboard.json()).includes(enrollment.secret))
  assert.equal((await s.post({ ...input, username: 'second.admin' })).status, 409)
  assert.equal(s.authority.db.prepare('SELECT count(*) AS n FROM agency_admins').get().n, 1)
  const done = await fetch(s.origin + '/agency/setup', { redirect: 'manual' }); assert.equal(done.status, 303); assert.equal(done.headers.get('location'), '/agency/')
})

test('production serving has no public provisioning and HTTPS cannot enable local browser setup', async t => {
  const s = await localFixture(t, false)
  assert.equal((await fetch(s.origin + '/agency/setup')).status, 404)
  assert.equal((await fetch(s.origin + '/agency/setup.js')).status, 404)
  assert.equal((await s.post({ username: 'blocked.admin', password: 'Private production denial password' })).status, 404)
  assert.equal((await fetch(s.origin + '/agency/api/local-open', { method: 'POST', headers: { Origin: s.origin, 'x-local-control-token': s.token } })).status, 404)
  assert.throws(() => createLicenseServer(s.authority, { origin: 'https://license.vertexiaagency.com', localSetupToken: s.token }), /loopback/)
  assert.equal(s.authority.db.prepare('SELECT count(*) AS n FROM agency_admins').get().n, 0)
})

test('parallel first-run requests cannot create two administrators or replace an existing enrollment', async t => {
  const s = await localFixture(t), input = { username: 'first.admin', password: 'Private concurrent provisioning password' }
  const responses = await Promise.all([s.post(input), s.post({ ...input, username: 'other.admin' })])
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]); assert.equal(s.authority.db.prepare('SELECT count(*) AS n FROM agency_admins').get().n, 1)
  const current = s.authority.db.prepare('SELECT * FROM agency_admins').get()
  await assert.rejects(new AgencyAuth(s.authority.db).provision('later.admin', input.password, false, true), /already complete/)
  assert.deepEqual(s.authority.db.prepare('SELECT * FROM agency_admins').get(), current)
})

test('private full-navigation setup authorizes its browser cookie and clears it after provisioning', async t => {
  const s = await localFixture(t)
  assert.equal((await fetch(s.origin + '/agency/setup/start/' + '0'.repeat(64))).status, 403)
  assert.deepEqual(await (await fetch(s.origin + '/agency/api/setup-state')).json(), { pending: true, authorized: false })
  const opened = await fetch(s.origin + '/agency/setup/start/' + s.token, { redirect: 'manual' })
  assert.equal(opened.status, 303); assert.equal(opened.headers.get('location'), '/agency/setup')
  assert.match(opened.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=900/)
  const cookie = opened.headers.get('set-cookie').split(';')[0]
  assert.deepEqual(await (await fetch(s.origin + '/agency/api/setup-state', { headers: { Cookie: cookie } })).json(), { pending: true, authorized: true })
  const input = { username: 'cookie.admin', password: 'Private cookie bootstrap test password' }
  assert.equal((await s.post(input, { 'x-setup-token': '', Cookie: cookie, Origin: 'http://evil.test' })).status, 403)
  const created = await s.post(input, { 'x-setup-token': '', Cookie: cookie }); assert.equal(created.status, 201); assert.match(created.headers.get('set-cookie'), /Max-Age=0/)
  assert.deepEqual(await (await fetch(s.origin + '/agency/api/setup-state', { headers: { Cookie: cookie } })).json(), { pending: false, authorized: false })
})

test('agency setup and login accept short and long credentials with consistent username normalization', async t => {
  const s = await localFixture(t), auth = new AgencyAuth(s.authority.db)
  await assert.rejects(auth.provision('   ', '1'), /username and password/)
  await assert.rejects(auth.provision('T', ''), /username and password/)
  for (const [username, password] of [['T', '1'], ['Agency Name @ ' + 'X'.repeat(150), 'p'.repeat(256)]]) {
    const account = await auth.provision(username, password), stored = s.authority.db.prepare('SELECT * FROM agency_admins WHERE username=?').get(username.trim().toLowerCase())
    assert.equal(account.username, username.trim().toLowerCase())
    const session = await auth.login('  ' + username.toUpperCase() + '  ', password, totp(stored.totp_secret, Math.floor(Date.now() / 30000)))
    assert.equal(auth.session(session.token).username, account.username)
  }
})

test('one-command local runner initializes once, restarts without setup and preserves issuer and accounts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vertexia-local-agency-test-')), children = []
  const { createServer } = await import('node:net'), probe = createServer()
  await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
  const env = { ...process.env, VERTEXIA_COMPANY_DATA: directory }
  const start = async expectSetup => {
    const child = spawn(process.execPath, ['scripts/local-agency.mjs', String(port), '--no-open'], { env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child)
    const output = await new Promise((done, reject) => {
      let stdout = '', stderr = ''
      const timeout = setTimeout(() => reject(new Error('Local runner did not start')), 15000)
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', error => { clearTimeout(timeout); reject(error) })
      child.on('exit', code => { clearTimeout(timeout); reject(new Error('Local runner exited: ' + code + ' ' + stderr)) })
      child.stdout.on('data', chunk => {
        stdout += chunk
        if (expectSetup ? /#token=[a-f0-9]{64}/.test(stdout) : stdout.includes('This service is available on this PC only.')) { clearTimeout(timeout); done(stdout) }
      })
    })
    return { child, output }
  }
  const stop = child => child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise(done => { child.once('exit', done); child.kill('SIGTERM') })
  try {
    const first = await start(true), token = first.output.match(/#token=([a-f0-9]{64})/)[1], issuer = readFileSync(join(directory, 'issuer-private.pem'), 'utf8')
    const duplicatePending = await new Promise((done, reject) => {
      const child = spawn(process.execPath, ['scripts/local-agency.mjs', String(port), '--no-open'], { env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child); let output = '', error = ''
      child.stdout.on('data', chunk => { output += chunk }); child.stderr.on('data', chunk => { error += chunk }); child.on('error', reject); child.on('exit', code => done({ code, output, error }))
    })
    assert.equal(duplicatePending.code, 0, duplicatePending.error); assert.match(duplicatePending.output, /already running/); assert.ok(duplicatePending.output.includes('#token=' + token))
    assert.equal((await fetch('http://127.0.0.1:' + port + '/agency/api/local-open', { method: 'POST', headers: { Origin: 'http://127.0.0.1:' + port } })).status, 403)
    const response = await fetch('http://127.0.0.1:' + port + '/agency/api/setup', { method: 'POST', headers: { Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json', 'x-setup-token': token }, body: JSON.stringify({ username: 'runner.admin', password: 'Private isolated runner account password' }) })
    assert.equal(response.status, 201); await response.json(); await stop(first.child)
    const second = await start(false); assert.ok(!second.output.includes('#token='))
    const duplicateReady = await new Promise((done, reject) => {
      const child = spawn(process.execPath, ['scripts/local-agency.mjs', String(port), '--no-open'], { env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child); let output = '', error = ''
      child.stdout.on('data', chunk => { output += chunk }); child.stderr.on('data', chunk => { error += chunk }); child.on('error', reject); child.on('exit', code => done({ code, output, error }))
    })
    assert.equal(duplicateReady.code, 0, duplicateReady.error); assert.match(duplicateReady.output, /already running/); assert.ok(!duplicateReady.output.includes('#token='))
    assert.equal((await fetch('http://127.0.0.1:' + port + '/agency/setup')).status, 404)
    assert.equal(readFileSync(join(directory, 'issuer-private.pem'), 'utf8'), issuer); await stop(second.child)
    const wrongPort = spawnSync(process.execPath, ['scripts/local-agency.mjs', String(port === 65535 ? 8787 : port + 1), '--no-open'], { env, encoding: 'utf8' })
    assert.equal(wrongPort.status, 1); assert.match(wrongPort.stderr, /will not replace/); assert.equal(readFileSync(join(directory, 'issuer-private.pem'), 'utf8'), issuer)
  } finally {
    for (const child of children) await stop(child)
    assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('vertexia-local-agency-test-')); rmSync(directory, { recursive: true, force: true })
  }
})
