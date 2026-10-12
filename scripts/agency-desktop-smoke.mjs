import assert from 'node:assert/strict'
import { app, BrowserWindow, safeStorage } from 'electron'
import { createServer } from 'node:http'
import { generateKeyPairSync } from 'node:crypto'
import { join, resolve, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync } from 'node:fs'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { LicenseClient } from '../electron-dist/electron/licensing/client.mjs'
import { AgencyAuth, totp } from '../electron-dist/electron/licensing/agency-auth.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'

const directory = resolve(process.env.VERTEXIA_AGENCY_SMOKE_DATA || '')
if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('vertexia-agency-smoke-') || app.isPackaged) throw new Error('Agency smoke requires its isolated temporary directory.')
app.setPath('userData', join(directory, 'browser'))
let authority, server, window
app.whenReady().then(async () => {
  try {
    const keys = generateKeyPairSync('ed25519')
    authority = new LicenseAuthority(join(directory, 'company.db'), keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
    const auth = new AgencyAuth(authority.db)
    await auth.provision('agency.test', 'Private browser smoke passphrase 2026')
    const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r))
    const origin = 'http://127.0.0.1:' + port
    server = createLicenseServer(authority, { origin, allowLocal: true }); await new Promise(r => server.listen(port, '127.0.0.1', r))
    const license = authority.issue('Taha Retail', Date.now() + 30 * 86400000, 2)
    const otherLicense = authority.issue('Second Owner', Date.now() + 30 * 86400000)
    const inventory = { businessName: 'Taha Mart', ownerName: 'Taha', branches: [{ id: 'branch-main', name: 'Main Branch', code: 'MAIN', city: 'Karachi' }, { id: 'branch-lahore', name: 'Lahore Branch', code: 'LHR', city: 'Lahore' }] }
    const options = { trust: { serviceUrl: origin, issuerPublicKey: authority.publicKey }, allowLocal: true, binding: () => 'a'.repeat(32), inventory: () => inventory, currentBranch: () => 'branch-main', protector: { encrypt: v => safeStorage.encryptString(v), decrypt: v => safeStorage.decryptString(v) } }
    const client = new LicenseClient({ ...options, path: join(directory, 'device.bin') })
    const remote = new LicenseClient({ ...options, path: join(directory, 'remote.bin') })
    const other = new LicenseClient({ ...options, binding: () => 'b'.repeat(32), inventory: () => ({ businessName: 'Second Store', ownerName: 'Second Owner', branches: [{ id: 'branch-main', name: 'Other Main', code: 'MAIN', city: 'Islamabad' }] }), path: join(directory, 'other.bin') })
    await client.activate(license.activationKey); await remote.activate(license.activationKey); await other.activate(otherLicense.activationKey)
    await client.refresh(); await remote.refresh(); await other.refresh()
    window = new BrowserWindow({ width: 1440, height: 1000, show: false, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } })
    await window.loadURL(origin + '/agency/')
    const evaluate = (fn, ...args) => window.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(a => JSON.stringify(a)).join(',') + ')')
    const code = totp(authority.db.prepare('SELECT totp_secret FROM agency_admins').get().totp_secret, Math.floor(Date.now() / 30000))
    await evaluate(async code => {
      const wait = async p => { const end = Date.now() + 15000; while (Date.now() < end) { if (p()) return; await new Promise(r => setTimeout(r, 80)) } throw new Error('Agency browser timed out: ' + document.body.innerText.slice(-900)) }
      await wait(() => !document.querySelector('#login-panel').hidden)
      const form = document.querySelector('#login-form'); form.elements.username.value = 'agency.test'; form.elements.password.value = 'Private browser smoke passphrase 2026'; form.elements.code.value = code; form.requestSubmit()
      await wait(() => document.querySelectorAll('.business-card').length === 2)
      if (document.querySelector('#admin-name').textContent !== 'agency.test' || document.querySelectorAll('.branch-table tbody tr').length !== 3) throw new Error('Owner/branch grouping did not render')
    }, code)
    const branch = authority.dashboard().businesses.find(b => b.licenseId === license.licenseId).branches.find(b => b.localId === 'branch-main')
    const toggleBranch = async expected => evaluate(async (id, expected) => {
      const selector = '[data-branch-id="' + id + '"] .branch-action button', button = document.querySelector(selector)
      if (!button || button.disabled) throw new Error('Missing branch control')
      button.click(); const end = Date.now() + 15000
      while (Date.now() < end) { const next = document.querySelector(selector); if (next?.textContent === expected && !next.disabled) return; await new Promise(r => setTimeout(r, 80)) }
      throw new Error('Branch control did not update: ' + document.querySelector('#error').textContent)
    }, branch.id, expected)
    await toggleBranch('Enable branch'); await client.refresh(); await remote.refresh(); await other.refresh()
    assert.equal(client.status().canTransact, false); assert.equal(remote.status().canTransact, false); assert.equal(client.status('branch-lahore').canTransact, true); assert.equal(other.status().canTransact, true)
    await client.refresh(); await remote.refresh()
    await evaluate(() => document.querySelector('#refresh').click())
    await evaluate(async id => { const end = Date.now() + 15000; while (Date.now() < end) { if (document.querySelector('[data-branch-id="' + id + '"]').textContent.includes('Applied')) return; await new Promise(r => setTimeout(r, 80)) } throw new Error('Device confirmation not displayed') }, branch.id)
    await toggleBranch('Disable branch'); await client.refresh(); assert.equal(client.status().canTransact, true)
    const toggleBusiness = async expected => evaluate(async (id, expected) => {
      const card = () => document.querySelector('[data-license-id="' + id + '"]'), control = [...card().querySelectorAll('button')].find(b => /business/.test(b.textContent)); control.click()
      const end = Date.now() + 15000; while (Date.now() < end) { const next = [...card().querySelectorAll('button')].find(b => b.textContent === expected); if (next && !next.disabled) return; await new Promise(r => setTimeout(r, 80)) } throw new Error('Business control did not update')
    }, license.licenseId, expected)
    await toggleBusiness('Enable business'); await client.refresh(); assert.equal(client.status('branch-main').canTransact, false); assert.equal(client.status('branch-lahore').canTransact, false)
    await toggleBusiness('Disable business'); await client.refresh(); assert.equal(client.status().canTransact, true)
    await evaluate(async () => {
      const search = document.querySelector('#search'); search.value = 'Lahore'; search.dispatchEvent(new Event('input')); if (document.querySelectorAll('.business-card').length !== 1) throw new Error('Branch/city search failed'); search.value = ''; search.dispatchEvent(new Event('input'))
      document.querySelector('#new-license').click(); const form = document.querySelector('#issue-form'); form.elements.customerName.value = 'Browser Created Owner'; form.elements.maxDevices.value = '2'; form.elements.offlineDays.value = '3'; form.requestSubmit()
      const end = Date.now() + 15000; while (Date.now() < end) { if (document.querySelector('#key-dialog').open) break; await new Promise(r => setTimeout(r, 80)) }
      if (!/^VTX-[A-F0-9]{48}$/.test(document.querySelector('#activation-key').value)) throw new Error('One-time activation key was not displayed')
      document.querySelector('[data-close="key-dialog"]').click(); await new Promise(r => setTimeout(r, 80)); if (document.querySelector('#activation-key').value) throw new Error('Activation key remained after closing')
    })
    assert.equal(authority.list().length, 3)
    await evaluate(async () => { const end = Date.now() + 15000; while (Date.now() < end) { if (document.querySelectorAll('.business-card').length === 3) return; await new Promise(r => setTimeout(r, 80)) } throw new Error('New customer was not rendered') })
    await new Promise(r => setTimeout(r, 250))
    writeFileSync(join(process.cwd(), '.screenshots', 'agency-dashboard.png'), (await window.webContents.capturePage()).toPNG())
    window.setSize(420, 900); await new Promise(r => setTimeout(r, 200))
    const mobile = await evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, controls: document.querySelectorAll('.branch-action button').length }))
    assert.ok(mobile.content <= mobile.width + 1); assert.equal(mobile.controls, 3)
    await evaluate(async () => { document.querySelector('#logout').click(); const end = Date.now() + 15000; while (Date.now() < end) { if (!document.querySelector('#login-panel').hidden) return; await new Promise(r => setTimeout(r, 80)) } throw new Error('Sign out failed') })
    console.log('VERTEXIA_AGENCY_SMOKE', JSON.stringify({ mfaLogin: true, ownerBranchGrouping: true, remoteDevicesLocked: 2, otherBranchAndOwnerAllowed: true, oneClickUnlock: true, businessOverride: true, deviceConfirmation: true, customerCreation: true, oneTimeActivationKey: true, mobileControls: true, signOut: true }))
    server.closeAllConnections(); await new Promise(r => server.close(r)); server = null; authority.close(); authority = null; app.exit(0)
  } catch (error) { console.error('VERTEXIA_AGENCY_SMOKE_FAILED', error); server?.closeAllConnections(); server?.close(); authority?.close(); app.exit(1) }
})
