import assert from 'node:assert/strict'
import { app, BrowserWindow } from 'electron'
import { createServer } from 'node:net'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { join, resolve, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { totp } from '../electron-dist/electron/licensing/agency-auth.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'

const directory = resolve(process.env.VERTEXIA_AGENCY_SMOKE_DATA || '')
if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('vertexia-agency-smoke-') || app.isPackaged) throw new Error('Local setup smoke requires its isolated temporary directory.')
app.setPath('userData', join(directory, 'browser'))
let authority, server, window
app.whenReady().then(async () => {
  try {
    const privateKey = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    authority = new LicenseAuthority(join(directory, 'company.db'), privateKey)
    const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
    const origin = 'http://127.0.0.1:' + port, token = randomBytes(32).toString('hex')
    server = createLicenseServer(authority, { origin, allowLocal: true, localSetupToken: token }); await new Promise(r => server.listen(port, '127.0.0.1', r))
    window = new BrowserWindow({ width: 1280, height: 1000, show: false, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } })
    const evaluate = (fn, ...args) => window.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(a => JSON.stringify(a)).join(',') + ')')
    await window.loadURL(origin + '/agency/setup')
    assert.equal(await evaluate(() => document.querySelector('#setup-form button').disabled), true)
    await window.loadURL('about:blank')
    await window.loadURL(origin + '/agency/setup/start/' + token)
    await window.loadURL(origin + '/agency/')
    await evaluate(async () => {
      const end = Date.now() + 15000
      while (Date.now() < end) { if (!document.querySelector('#setup-account').hidden) return; await new Promise(r => setTimeout(r, 60)) }
      throw new Error('Create agency account button did not appear')
    })
    const setupNavigation = new Promise(r => window.webContents.once('did-finish-load', r))
    await evaluate(() => document.querySelector('#setup-account').click()); await setupNavigation
    assert.equal(await evaluate(() => location.hash), '')
    assert.equal(await evaluate(() => document.cookie.includes('vertexia_agency_setup')), false)
    await evaluate(async () => {
      const end = Date.now() + 15000
      while (Date.now() < end) { if (!document.querySelector('#setup-form button').disabled) return; await new Promise(r => setTimeout(r, 60)) }
      throw new Error('Private setup cookie was not accepted')
    })
    await evaluate(async () => {
      const form = document.querySelector('#setup-form'); form.elements.username.value = 'T'; form.elements.password.value = '1'; form.elements.confirmation.value = 'different'; form.requestSubmit()
      if (!document.querySelector('#error').textContent.includes('Passwords do not match')) throw new Error('Password confirmation missing')
      form.elements.confirmation.value = form.elements.password.value; form.requestSubmit()
      const end = Date.now() + 20000
      while (Date.now() < end) { if (!document.querySelector('#enrollment-form').hidden) return; await new Promise(r => setTimeout(r, 80)) }
      throw new Error('Enrollment did not open: ' + document.querySelector('#error').textContent)
    })
    assert.match(await evaluate(() => document.querySelector('#enrollment-key').value), /^[A-Z2-7]{32}$/)
    assert.equal(await evaluate(() => document.querySelector('#setup-form').elements.password.value), '')
    window.setSize(420, 1000); await new Promise(r => setTimeout(r, 150))
    const mobile = await evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))
    assert.ok(mobile.content <= mobile.width + 1)
    mkdirSync(join(process.cwd(), '.screenshots'), { recursive: true })
    await evaluate(() => { document.querySelector('#enrollment-key').value = 'TEST AUTHENTICATOR KEY HIDDEN' })
    writeFileSync(join(process.cwd(), '.screenshots/local-agency-setup.png'), (await window.webContents.capturePage()).toPNG())
    const admin = authority.db.prepare('SELECT * FROM agency_admins').get(), code = totp(admin.totp_secret, Math.floor(Date.now() / 30000))
    await evaluate(code => { const form = document.querySelector('#enrollment-form'); form.elements.code.value = code; form.requestSubmit() }, code)
    // Verification navigates to the existing dashboard, whose session must already be authenticated.
    const deadline = Date.now() + 20000
    let signedIn = false
    while (Date.now() < deadline) {
      try { signedIn = await evaluate(() => location.pathname === '/agency/' && document.querySelector('#dashboard') && !document.querySelector('#dashboard').hidden); if (signedIn) break } catch { /* Navigation may temporarily destroy the execution context. */ }
      await new Promise(r => setTimeout(r, 100))
    }
    assert.ok(signedIn, 'Enrollment verification did not open authenticated dashboard')
    assert.equal(await evaluate(() => document.querySelector('#admin-name').textContent), 't')
    await evaluate(async () => {
      document.querySelector('#new-license').click(); const form = document.querySelector('#issue-form'); form.elements.customerName.value = 'Local setup customer'; form.requestSubmit()
      const end = Date.now() + 15000
      while (Date.now() < end) { if (document.querySelector('#key-dialog').open) return; await new Promise(r => setTimeout(r, 80)) }
      throw new Error('Local customer creation failed')
    })
    assert.equal(authority.list().length, 1)
    await window.loadURL(origin + '/agency/setup'); assert.equal(new URL(window.webContents.getURL()).pathname, '/agency/')
    assert.equal(authority.db.prepare('SELECT count(*) AS n FROM agency_admins').get().n, 1)
    console.log('VERTEXIA_LOCAL_AGENCY_SMOKE', JSON.stringify({ privateSetupLink: true, passwordConfirmation: true, oneTimeAuthenticatorEnrollment: true, mobileLayout: true, mfaVerification: true, authenticatedDashboard: true, customerCreation: true, setupClosed: true }))
    window.destroy(); server.closeAllConnections(); await new Promise(r => server.close(r)); server = null; authority.close(); authority = null; app.exit(0)
  } catch (failure) { console.error('VERTEXIA_LOCAL_AGENCY_SMOKE_FAILED', failure); server?.closeAllConnections(); server?.close(); authority?.close(); app.exit(1) }
})
