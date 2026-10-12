import { createHash, createPrivateKey, createPublicKey, randomBytes, randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { LicenseClaims } from '../../src/types/licensing.js'
import { publicKeyId, signLease, verifyDeviceRequest } from './protocol.mjs'

const day = 24 * 60 * 60 * 1000
type Row = Record<string, string | number | null>
const keyHash = (key: string) => createHash('sha256').update(key).digest('hex')

// Company-side storage only. Never connect this database or signing key to the renderer.
export class LicenseAuthority {
  readonly db: DatabaseSync
  readonly publicKey: string
  private actor: string | null = null
  constructor(path: string, private readonly privateKey: string, private readonly clock = () => Date.now()) {
    const key = createPrivateKey(privateKey)
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('Company signing key must be Ed25519.')
    this.publicKey = createPublicKey(key).export({ format: 'pem', type: 'spki' }).toString()
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS licenses (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('active','suspended')),
        expires_at INTEGER NOT NULL, max_devices INTEGER NOT NULL CHECK(max_devices BETWEEN 1 AND 100),
        offline_days INTEGER NOT NULL CHECK(offline_days BETWEEN 1 AND 30), created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY, license_id TEXT NOT NULL REFERENCES licenses(id), installation_id TEXT NOT NULL,
        public_key TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)), sequence INTEGER NOT NULL,
        registered_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS request_nonces (device_id TEXT NOT NULL, nonce TEXT NOT NULL, timestamp INTEGER NOT NULL, PRIMARY KEY(device_id,nonce)) STRICT;
      CREATE TABLE IF NOT EXISTS company_audit (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL, occurred_at INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS company_branches (
        id TEXT PRIMARY KEY, license_id TEXT NOT NULL REFERENCES licenses(id), installation_id TEXT NOT NULL,
        local_id TEXT NOT NULL, name TEXT NOT NULL, code TEXT NOT NULL, city TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active','suspended','pending')), updated_at INTEGER NOT NULL,
        UNIQUE(license_id,installation_id,local_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS company_device_meta (
        device_id TEXT PRIMARY KEY REFERENCES devices(id), business_name TEXT NOT NULL, owner_name TEXT NOT NULL,
        inventory_json TEXT NOT NULL, issued_policy TEXT NOT NULL, accepted_policy TEXT NOT NULL
      ) STRICT;
    `)
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = work(); this.db.exec('COMMIT'); return result }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  private audit(action: string, id: string, detail: string) {
    if (this.actor) detail = JSON.stringify({ actor: this.actor, detail })
    this.db.prepare('INSERT INTO company_audit VALUES (?,?,?,?,?)').run(randomUUID(), action, id, detail, this.clock())
  }
  asAdmin<T>(actor: string, work: () => T): T {
    this.actor = actor
    try { return work() } finally { this.actor = null }
  }
  changeBranchStatus(id: string, status: 'active' | 'suspended', reason: string) {
    if (!['active', 'suspended'].includes(status) || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 250) throw new Error('A valid branch status and reason are required.')
    this.transaction(() => {
      if (!this.db.prepare('UPDATE company_branches SET status=?,updated_at=? WHERE id=?').run(status, this.clock(), id).changes) throw new Error('Branch not found.')
      this.audit('branch-' + status, id, reason.trim())
    })
  }
  dashboard() {
    const now = this.clock()
    const businesses = this.list().map(license => {
      const devices = this.db.prepare(`SELECT d.id,d.installation_id AS installationId,d.active,d.last_seen_at AS lastSeenAt,m.business_name AS businessName,m.owner_name AS ownerName,m.inventory_json,m.accepted_policy
        FROM devices d LEFT JOIN company_device_meta m ON m.device_id=d.id WHERE d.license_id=?`).all(license.licenseId!).map(d => {
        const inventory = d.inventory_json ? JSON.parse(String(d.inventory_json)) : null
        const accepted = d.accepted_policy ? JSON.parse(String(d.accepted_policy)) : null
        return { id: d.id, installationId: d.installationId, active: d.active === 1, lastSeenAt: d.lastSeenAt, online: now - Number(d.lastSeenAt) < 45000, businessName: d.businessName, ownerName: d.ownerName, branchIds: inventory?.branches.map((b: { id: string }) => b.id) ?? [], accepted }
      })
      const branches = this.db.prepare(`SELECT id,installation_id AS installationId,local_id AS localId,name,code,city,status,updated_at AS updatedAt FROM company_branches WHERE license_id=? ORDER BY code,name`).all(license.licenseId!).map(b => {
        const relevant = devices.filter(d => d.active && d.installationId === b.installationId && d.branchIds.includes(b.localId))
        const expected = license.status === 'suspended' ? 'suspended' : Number(license.expiresAt) <= now ? 'expired' : b.status
        const applied = relevant.length > 0 && relevant.every(d => d.accepted && d.accepted.installationId === d.installationId && (d.accepted.status !== 'active' ? d.accepted.status === expected : expected === b.status && d.accepted.branches?.some((a: { localId: string; status: string }) => a.localId === b.localId && a.status === b.status)))
        return { ...b, online: relevant.some(d => d.online), deviceCount: relevant.length, applied, effectiveStatus: expected }
      })
      return { ...license, devices, branches }
    })
    const audit = this.db.prepare('SELECT action,entity_id AS entityId,detail,occurred_at AS occurredAt FROM company_audit ORDER BY occurred_at DESC,rowid DESC LIMIT 50').all()
    return { businesses, audit, serverTime: now, heartbeatSeconds: 10 }
  }
  issue(customerName: string, expiresAt: number, maxDevices = 1, offlineDays = 7) {
    if (typeof customerName !== 'string' || !customerName.trim() || customerName.length > 120 || Array.from(customerName).some(character => character.charCodeAt(0) < 32)) throw new Error('A customer name of 1–120 characters is required.')
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.clock() || expiresAt > this.clock() + 10 * 366 * day) throw new Error('License expiry must be in the next ten years.')
    if (!Number.isSafeInteger(maxDevices) || maxDevices < 1 || maxDevices > 100 || !Number.isSafeInteger(offlineDays) || offlineDays < 1 || offlineDays > 30) throw new Error('Invalid device limit or offline validity.')
    const id = randomUUID(), tenantId = randomUUID(), activationKey = 'VTX-' + randomBytes(24).toString('hex').toUpperCase()
    return this.transaction(() => {
      this.db.prepare('INSERT INTO licenses VALUES (?,?,?,?,?,?,?,?,?)').run(id, tenantId, customerName.trim(), keyHash(activationKey), 'active', expiresAt, maxDevices, offlineDays, this.clock())
      this.audit('issue', id, JSON.stringify({ customerName: customerName.trim(), expiresAt, maxDevices, offlineDays }))
      return { licenseId: id, tenantId, activationKey }
    })
  }
  list() {
    return this.db.prepare(`SELECT l.id AS licenseId,l.tenant_id AS tenantId,l.customer_name AS customerName,l.status,l.expires_at AS expiresAt,l.max_devices AS maxDevices,l.offline_days AS offlineDays,
      (SELECT count(*) FROM devices d WHERE d.license_id=l.id AND d.active=1) AS registeredDevices FROM licenses l ORDER BY created_at DESC`).all()
  }
  devices(licenseId: string) { return this.db.prepare('SELECT id,installation_id AS installationId,active,registered_at AS registeredAt,last_seen_at AS lastSeenAt FROM devices WHERE license_id=?').all(licenseId) }
  changeStatus(id: string, status: 'active' | 'suspended', reason: string) {
    if (!['active', 'suspended'].includes(status) || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 250) throw new Error('A valid license status and reason are required.')
    this.transaction(() => {
      if (!this.db.prepare('UPDATE licenses SET status=? WHERE id=?').run(status, id).changes) throw new Error('License not found.')
      this.audit(status, id, reason.trim())
    })
  }
  renew(id: string, expiresAt: number, reason: string) {
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.clock() || expiresAt > this.clock() + 10 * 366 * day || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 250) throw new Error('A future expiry and renewal reason are required.')
    this.transaction(() => {
      if (!this.db.prepare('UPDATE licenses SET expires_at=? WHERE id=?').run(expiresAt, id).changes) throw new Error('License not found.')
      this.audit('renew', id, JSON.stringify({ expiresAt, reason: reason.trim() }))
    })
  }
  revokeDevice(id: string, reason: string) {
    if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 250) throw new Error('A revocation reason is required.')
    this.transaction(() => {
      if (!this.db.prepare('UPDATE devices SET active=0 WHERE id=?').run(id).changes) throw new Error('Device not found.')
      this.audit('revoke-device', id, reason.trim())
    })
  }
  rebindDevice(id: string, installationId: string, reason: string) {
    if (typeof installationId !== 'string' || !/^[a-f0-9]{32}$/.test(installationId) || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 250) throw new Error('A valid installation ID and rebind reason are required.')
    this.transaction(() => {
      const device = this.db.prepare('SELECT installation_id,active FROM devices WHERE id=?').get(id)
      if (!device || device.active !== 1) throw new Error('Active device not found. Revoked devices cannot be rebound.')
      this.db.prepare('UPDATE devices SET installation_id=? WHERE id=?').run(installationId, id)
      this.audit('rebind-device', id, JSON.stringify({ previousInstallationId: device.installation_id, installationId, reason: reason.trim() }))
    })
  }
  exchange(value: unknown) {
    const now = this.clock(), request = verifyDeviceRequest(value, now), deviceId = publicKeyId(request.publicKey)
    return this.transaction(() => {
      this.db.prepare('DELETE FROM request_nonces WHERE timestamp<?').run(now - 10 * 60 * 1000)
      if (this.db.prepare('SELECT 1 FROM request_nonces WHERE device_id=? AND nonce=?').get(deviceId, request.nonce)) throw new Error('Device request was already used.')
      let device = this.db.prepare('SELECT * FROM devices WHERE id=?').get(deviceId) as Row | undefined
      let license: Row | undefined
      if (request.action === 'activate') {
        if (typeof request.activationKey !== 'string' || !/^VTX-[A-F0-9]{48}$/.test(request.activationKey)) throw new Error('Activation key is invalid.')
        license = this.db.prepare('SELECT * FROM licenses WHERE key_hash=?').get(keyHash(request.activationKey)) as Row | undefined
        if (!license) throw new Error('Activation key is invalid.')
        if (device && (device.license_id !== license.id || device.installation_id !== request.installationId)) throw new Error('This device is already registered to another license or installation. Contact the company.')
        if (!device) {
          if (license.status !== 'active' || Number(license.expires_at) <= now) throw new Error('License is suspended or expired. Contact the company.')
          const count = Number(this.db.prepare('SELECT count(*) AS n FROM devices WHERE license_id=? AND active=1').get(license.id!)!.n)
          if (count >= Number(license.max_devices)) throw new Error('Device limit reached. Contact the company.')
          this.db.prepare('INSERT INTO devices VALUES (?,?,?,?,1,0,?,?)').run(deviceId, license.id!, request.installationId, request.publicKey, now, now)
          device = this.db.prepare('SELECT * FROM devices WHERE id=?').get(deviceId) as Row
          this.audit('register-device', deviceId, JSON.stringify({ licenseId: license.id, installationId: request.installationId }))
        }
      } else {
        if (!device || typeof request.licenseId !== 'string' || typeof request.tenantId !== 'string') throw new Error('Device is not registered.')
        license = this.db.prepare('SELECT * FROM licenses WHERE id=? AND tenant_id=?').get(request.licenseId, request.tenantId) as Row | undefined
        if (!license || device.license_id !== license.id || device.installation_id !== request.installationId) throw new Error('Device registration does not match this business.')
      }
      const sequence = Number(device!.sequence) + 1
      if (!Number.isSafeInteger(sequence)) throw new Error('Device sequence exhausted.')
      const expiresAt = Number(license!.expires_at)
      const status: LicenseClaims['status'] = !device!.active ? 'revoked' : license!.status === 'suspended' ? 'suspended' : expiresAt <= now ? 'expired' : 'active'
      const offlineUntil = status === 'active' ? Math.min(expiresAt, now + Number(license!.offline_days) * day) : now + day
      const meta = this.db.prepare('SELECT * FROM company_device_meta WHERE device_id=?').get(deviceId)
      if (meta && !request.inventory) throw new Error('Branch registration details are required for this device.')
      if (request.acceptedSequence !== undefined && request.acceptedSequence > Number(device!.sequence)) throw new Error('Invalid accepted license sequence.')
      let branches: LicenseClaims['branches']
      if (request.inventory) {
        const firstInventory = !this.db.prepare('SELECT 1 FROM company_branches WHERE license_id=? LIMIT 1').get(license!.id!)
        for (const branch of request.inventory.branches) {
          const known = this.db.prepare('SELECT id FROM company_branches WHERE license_id=? AND installation_id=? AND local_id=?').get(license!.id!, request.installationId, branch.id)
          if (!known) {
            const id = randomUUID(), branchStatus = firstInventory && device!.active && license!.status === 'active' ? 'active' : 'pending'
            this.db.prepare('INSERT INTO company_branches VALUES (?,?,?,?,?,?,?,?,?)').run(id, license!.id!, request.installationId, branch.id, branch.name, branch.code, branch.city, branchStatus, now)
            this.audit('register-branch', id, JSON.stringify({ licenseId: license!.id, installationId: request.installationId, localId: branch.id, status: branchStatus }))
          } else this.db.prepare('UPDATE company_branches SET name=?,code=?,city=? WHERE id=?').run(branch.name, branch.code, branch.city, known.id!)
        }
        branches = request.inventory.branches.map(b => {
          const row = this.db.prepare('SELECT status FROM company_branches WHERE license_id=? AND installation_id=? AND local_id=?').get(license!.id!, request.installationId, b.id)!
          return { localId: b.id, status: String(row.status) as 'active' | 'suspended' | 'pending' }
        })
      }
      const claims: LicenseClaims = { version: branches ? 2 : 1, licenseId: String(license!.id), tenantId: String(license!.tenant_id), customerName: String(license!.customer_name), deviceId, installationId: request.installationId,
        status, sequence, nonce: request.nonce, issuedAt: now, expiresAt, refreshAfter: Math.min(now + day, offlineUntil), offlineUntil, ...(branches ? { branches } : {}) }
      if (request.inventory) {
        // Receipt is reported only after the client persisted a signed lease. Never equate "sent" with "applied".
        const accepted = meta && request.acceptedSequence === Number(device!.sequence) ? String(meta.issued_policy) : String(meta?.accepted_policy ?? 'null')
        this.db.prepare(`INSERT INTO company_device_meta VALUES (?,?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET business_name=excluded.business_name,owner_name=excluded.owner_name,inventory_json=excluded.inventory_json,issued_policy=excluded.issued_policy,accepted_policy=excluded.accepted_policy`).run(deviceId, request.inventory.businessName, request.inventory.ownerName, JSON.stringify(request.inventory), JSON.stringify({ status, branches, installationId: request.installationId }), accepted)
      }
      const envelope = signLease(claims, this.privateKey)
      this.db.prepare('INSERT INTO request_nonces VALUES (?,?,?)').run(deviceId, request.nonce, now)
      this.db.prepare('UPDATE devices SET sequence=?,last_seen_at=? WHERE id=?').run(sequence, now, deviceId)
      return envelope
    })
  }
  close() { this.db.close() }
}
