import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { LicenseAuthority } from '../electron-dist/electron/licensing/authority.mjs'
import { createLicenseServer } from '../electron-dist/electron/licensing/server.mjs'
import { validateTrust, publicKeyId } from '../electron-dist/electron/licensing/protocol.mjs'
import { AgencyAuth } from '../electron-dist/electron/licensing/agency-auth.mjs'

// Run on the company's private machine/server, never on customer installations.
const [command, ...args] = process.argv.slice(2)
const directory = resolve(process.env.VERTEXIA_COMPANY_DATA || '.company-licensing')
const keyPath = join(directory, 'issuer-private.pem')
const help = `Company licensing commands (npm run build:electron first):
  init <https://license.example.com OR http://127.0.0.1:8787>
  issue <customer-name> <expiry-ISO-date> [device-limit=1] [offline-days=7]
  list
  devices <license-id>
  suspend <license-id> <reason>
  resume <license-id> <reason>
  renew <license-id> <expiry-ISO-date> <reason>
  revoke-device <device-id> <reason>
  rebind-device <device-id> <installation-id> <reason>
  admin-create <username>  (reads VERTEXIA_AGENCY_PASSWORD; enroll authenticator from output)
  admin-reset <username>   (private recovery; replaces password/MFA and expires all sessions)
  branch-enable <company-branch-id> <reason>
  branch-disable <company-branch-id> <reason>
  configure-origin <https://agency.your-domain.com> (preserves the existing issuer and registrations)
  serve [port=8787]
Set VERTEXIA_COMPANY_DATA to a private directory outside the repo.
The init command writes public client-trust.json. Ship it as resources/licensing-trust.json.
For development set VERTEXIA_LICENSE_CONFIG to its absolute path.`
let authority
try {
  if (!command || command === 'help') { console.log(help) }
  else if (command === 'init') {
    if (existsSync(keyPath) || existsSync(join(directory, 'company.db'))) throw new Error('Company already initialized. Existing signing keys will not be replaced.')
    const keys = generateKeyPairSync('ed25519'), publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const trust = validateTrust({ serviceUrl: args[0], issuerPublicKey: publicKey }, true)
    mkdirSync(directory, { recursive: true })
    writeFileSync(keyPath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx', flush: true })
    writeFileSync(join(directory, 'client-trust.json'), JSON.stringify(trust, null, 2) + '\n', { flag: 'wx', flush: true })
    console.log('Company initialized. Public client config: ' + join(directory, 'client-trust.json'))
  } else {
    authority = new LicenseAuthority(join(directory, 'company.db'), readFileSync(keyPath, 'utf8'))
    if (command === 'issue') console.log(JSON.stringify(authority.issue(args[0], Date.parse(args[1]), args[2] === undefined ? 1 : Number(args[2]), args[3] === undefined ? 7 : Number(args[3])), null, 2))
    else if (command === 'list') console.log(JSON.stringify(authority.list(), null, 2))
    else if (command === 'devices') console.log(JSON.stringify(authority.devices(args[0]), null, 2))
    else if (command === 'suspend' || command === 'resume') { authority.changeStatus(args[0], command === 'suspend' ? 'suspended' : 'active', args.slice(1).join(' ')); console.log('License status updated.') }
    else if (command === 'renew') { authority.renew(args[0], Date.parse(args[1]), args.slice(2).join(' ')); console.log('License renewed; suspension status is preserved.') }
    else if (command === 'revoke-device') { authority.revokeDevice(args[0], args.slice(1).join(' ')); console.log('Device revoked.') }
    else if (command === 'rebind-device') { authority.rebindDevice(args[0], args[1], args.slice(2).join(' ')); console.log('Device binding updated. Check the license online in the restored app.') }
    else if (command === 'admin-create' || command === 'admin-reset') {
      const password = process.env.VERTEXIA_AGENCY_PASSWORD
      delete process.env.VERTEXIA_AGENCY_PASSWORD
      if (!password) throw new Error('Set VERTEXIA_AGENCY_PASSWORD to a private password. Never pass passwords as command arguments.')
      console.log(JSON.stringify(await new AgencyAuth(authority.db).provision(args[0], password, command === 'admin-reset'), null, 2))
      console.log('Add this secret/URI to your authenticator. Store the enrollment privately; it is not shown again.')
    }
    else if (command === 'branch-enable' || command === 'branch-disable') { authority.changeBranchStatus(args[0], command === 'branch-enable' ? 'active' : 'suspended', args.slice(1).join(' ')); console.log('Branch access updated.') }
    else if (command === 'configure-origin') {
      const trust = validateTrust({ serviceUrl: args[0], issuerPublicKey: authority.publicKey })
      const pending = join(directory, 'client-trust.json.pending')
      writeFileSync(pending, JSON.stringify(trust, null, 2) + '\n', { mode: 0o600, flush: true })
      renameSync(pending, join(directory, 'client-trust.json'))
      console.log('Public origin updated; issuer and registered licenses preserved. Restart the company service and distribute the public client-trust.json to updated POS builds.')
    }
    else if (command === 'serve') {
      const port = args[0] === undefined ? 8787 : Number(args[0])
      if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid service port.')
      const trust = validateTrust(JSON.parse(readFileSync(join(directory, 'client-trust.json'), 'utf8')), true)
      if (publicKeyId(trust.issuerPublicKey) !== publicKeyId(authority.publicKey)) throw new Error('Public client configuration does not match this company signing identity.')
      const url = new URL(trust.serviceUrl)
      new AgencyAuth(authority.db)
      if (url.protocol === 'https:' && !authority.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get()) throw new Error('Provision an agency administrator with admin-create before starting the production service.')
      if (url.protocol === 'http:' && Number(url.port || 80) !== port) throw new Error('Local service port must match client-trust.json. For production configure an HTTPS origin.')
      const server = createLicenseServer(authority, { origin: trust.serviceUrl, allowLocal: true })
      server.on('error', error => { console.error('License service failed: ' + error.message); process.exitCode = 1; authority.close() })
      server.listen(port, '127.0.0.1', () => console.log('Agency dashboard: ' + trust.serviceUrl + '/agency/\nLicense service listening on loopback port ' + port + '. Production requires an HTTPS reverse proxy preserving the public Host header.'))
      const close = () => { server.close(() => authority.close()); server.closeAllConnections() }
      process.once('SIGINT', close); process.once('SIGTERM', close)
    } else throw new Error(help)
    if (command !== 'serve') authority.close()
  }
} catch (error) { console.error(error instanceof Error ? error.message : 'Company license command failed.'); if (authority?.db.isOpen) authority.close(); process.exitCode = 1 }
