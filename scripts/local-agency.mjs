import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { AgencyAuth } from '../electron-dist/electron/licensing/agency-auth.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'
import { publicKeyId, validateTrust } from '../electron-dist/electron/licensing/protocol.mjs'

// Local agency development only. Existing issuers and registrations are preserved.
const directory = resolve(process.env.VERTEXIA_COMPANY_DATA || '.company-licensing')
let authority, server, instanceToken
const instancePath = join(directory, 'local-instance.json')
async function openBrowser(url, args) {
  if (args.includes('--no-open')) { if (url.includes('#token=')) console.log('Private first-run setup (do not share): ' + url); return }
  // Establish the private setup cookie using a full navigation, rather than a fragment-only change.
  const target = url.replace(/\/agency\/setup#token=([a-f0-9]{64})$/, '/agency/setup/start/$1')
  if (process.platform === 'win32') {
    const command = "Start-Process -FilePath '" + target.replaceAll("'", "''") + "'", encoded = Buffer.from(command, 'utf16le').toString('base64')
    await new Promise(done => {
      const browser = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { stdio: 'ignore', windowsHide: true })
      browser.on('error', () => { console.error('Browser could not open. Run again with --no-open to get the private setup link.'); done() }); browser.on('exit', done)
    })
  } else {
    const browser = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { stdio: 'ignore', detached: true })
    browser.on('error', () => console.error('Browser could not open. Run again with --no-open to get the private setup link.')); browser.unref()
  }
}
async function reopenExisting(origin, trust, args) {
  if (!existsSync(instancePath)) return false
  let instance
  try { instance = JSON.parse(readFileSync(instancePath, 'utf8')) } catch { return false }
  if (instance.origin !== origin || instance.issuerKeyId !== publicKeyId(trust.issuerPublicKey) || !/^[a-f0-9]{64}$/.test(instance.token)) return false
  try {
    const response = await fetch(origin + '/agency/api/local-open', { method: 'POST', headers: { Origin: origin, 'x-local-control-token': instance.token }, redirect: 'error', signal: AbortSignal.timeout(3000) })
    if (response.status !== 200) return false
    const result = await response.json()
    if (result.issuerKeyId !== instance.issuerKeyId || !(result.path === '/agency/' || /^\/agency\/setup#token=[a-f0-9]{64}$/.test(result.path))) return false
    console.log('Agency is already running. Reusing existing service: ' + origin + '/agency/')
    await openBrowser(origin + result.path, args); return true
  } catch { return false }
}
function clearInstance() {
  try { if (JSON.parse(readFileSync(instancePath, 'utf8')).token === instanceToken) unlinkSync(instancePath) } catch { /* Preserve another instance's descriptor. */ }
}
try {
  const args = process.argv.slice(2), portArgument = args.find(value => !value.startsWith('--')), port = portArgument === undefined ? 8787 : Number(portArgument)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535 || args.some(value => value.startsWith('--') && value !== '--no-open')) throw new Error('Usage: npm run dev:agency -- [port=8787] [--no-open]')
  const origin = 'http://127.0.0.1:' + port
  if (!['issuer-private.pem', 'company.db', 'client-trust.json'].some(file => existsSync(join(directory, file)))) {
    const initialized = spawnSync(process.execPath, [fileURLToPath(new URL('./company-license.mjs', import.meta.url)), 'init', origin], { env: { ...process.env, VERTEXIA_COMPANY_DATA: directory }, encoding: 'utf8' })
    if (initialized.status !== 0) throw new Error('Company initialization failed. Existing files were preserved. ' + initialized.stderr.trim())
  }
  const trust = validateTrust(JSON.parse(readFileSync(join(directory, 'client-trust.json'), 'utf8')), true)
  if (trust.serviceUrl !== origin) throw new Error('Existing company URL is ' + trust.serviceUrl + '. Use its configured port or npm run company:license -- serve. Local startup will not replace an existing company origin.')
  if (await reopenExisting(origin, trust, args)) process.exit(0)
  authority = new LicenseAuthority(join(directory, 'company.db'), readFileSync(join(directory, 'issuer-private.pem'), 'utf8'))
  if (publicKeyId(trust.issuerPublicKey) !== publicKeyId(authority.publicKey)) throw new Error('Company signing identity does not match the public configuration.')
  new AgencyAuth(authority.db)
  const token = authority.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get() ? undefined : randomBytes(32).toString('hex')
  instanceToken = randomBytes(32).toString('hex')
  server = createLicenseServer(authority, { origin, allowLocal: true, localSetupToken: token, localControlToken: instanceToken })
  server.on('error', async failure => {
    authority.close()
    if (failure.code === 'EADDRINUSE' && await reopenExisting(origin, trust, args)) return
    console.error(failure.code === 'EADDRINUSE' ? 'Port ' + port + ' is occupied by another service. Existing company files were preserved.' : 'Local agency failed: ' + failure.message); process.exitCode = 1
  })
  server.listen(port, '127.0.0.1', () => {
    try { writeFileSync(instancePath, JSON.stringify({ pid: process.pid, origin, issuerKeyId: publicKeyId(trust.issuerPublicKey), token: instanceToken }), { mode: 0o600, flush: true }) }
    catch { console.error('Cannot save private local startup state. Service stopped.'); server.close(() => authority.close()); process.exitCode = 1; return }
    console.log('Agency dashboard: ' + origin + '/agency/')
    console.log('Public POS trust file: ' + join(directory, 'client-trust.json'))
    console.log('Keep this terminal running. This service is available on this PC only.')
    const url = token ? origin + '/agency/setup#token=' + token : origin + '/agency/'
    void openBrowser(url, args)
  })
  const close = () => { clearInstance(); server.close(() => authority.close()); server.closeAllConnections() }
  process.once('SIGINT', close); process.once('SIGTERM', close)
} catch (failure) { if (authority?.db.isOpen) authority.close(); console.error(failure.message); process.exitCode = 1 }
