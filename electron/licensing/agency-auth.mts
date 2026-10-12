import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

type Row = Record<string, string | number | null>
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const idle = 30 * 60000, absolute = 8 * 3600000
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const normalizeUsername = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
function base32(bytes: Buffer) {
  let bits = 0, value = 0, output = ''
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { bits -= 5; output += alphabet[(value >>> bits) & 31] } }
  if (bits) output += alphabet[(value << (5 - bits)) & 31]
  return output
}
export function totp(secret: string, step: number) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step))
  const digest = createHmac('sha1', Buffer.from(secret, 'hex')).update(counter).digest(), offset = digest[19] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)))
}
export class AgencyAuth {
  private pendingLogins = 0
  constructor(private readonly db: DatabaseSync, private readonly clock = () => Date.now()) {
    db.exec(`CREATE TABLE IF NOT EXISTS agency_admins (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      totp_secret TEXT NOT NULL, last_step INTEGER NOT NULL DEFAULT -1
    ) STRICT;
    CREATE TABLE IF NOT EXISTS agency_sessions (
      token_hash TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES agency_admins(id), csrf TEXT NOT NULL,
      issued_at INTEGER NOT NULL, touched_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS agency_login_attempts (username TEXT PRIMARY KEY,start INTEGER NOT NULL,count INTEGER NOT NULL) STRICT;`)
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = work(); this.db.exec('COMMIT'); return result } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  private audit(action: string, adminId: string) { this.db.prepare('INSERT INTO company_audit VALUES (?,?,?,?,?)').run(randomUUID(), action, adminId, 'Agency administrator', this.clock()) }
  async provision(username: string, password: string, reset = false, firstOnly = false) {
    username = normalizeUsername(username)
    if (!username || typeof password !== 'string' || !password.length) throw new Error('Enter a username and password.')
    const salt = randomBytes(16).toString('hex'), encoded = (await derive(password, salt)).toString('hex'), secret = randomBytes(20)
    this.transaction(() => {
      if (firstOnly && this.db.prepare('SELECT 1 FROM agency_admins LIMIT 1').get()) throw new Error('Agency setup is already complete. Use your existing administrator account.')
      const existing = this.db.prepare('SELECT id FROM agency_admins WHERE username=?').get(username)
      if (reset && !existing) throw new Error('Administrator not found.')
      if (!reset && existing) throw new Error('Administrator already exists; use admin-reset for private recovery.')
      const id = existing ? String(existing.id) : randomUUID()
      if (existing) {
        this.db.prepare('DELETE FROM agency_sessions WHERE admin_id=?').run(id)
        this.db.prepare('UPDATE agency_admins SET salt=?,password_hash=?,totp_secret=?,last_step=-1 WHERE id=?').run(salt, encoded, secret.toString('hex'), id)
      } else this.db.prepare('INSERT INTO agency_admins(id,username,salt,password_hash,totp_secret) VALUES (?,?,?,?,?)').run(id, username, salt, encoded, secret.toString('hex'))
      this.db.prepare('DELETE FROM agency_login_attempts WHERE username=?').run(username)
      this.audit(reset ? 'admin-reset' : 'admin-created', id)
    })
    const enrollment = base32(secret)
    return { username, secret: enrollment, authenticatorUri: 'otpauth://totp/' + encodeURIComponent('Vertexia Agency:' + username) + '?secret=' + enrollment + '&issuer=Vertexia%20Agency&algorithm=SHA1&digits=6&period=30' }
  }
  async login(usernameInput: unknown, password: unknown, code: unknown) {
    const invalid = () => new Error('Invalid username, password or authenticator code.')
    const username = normalizeUsername(usernameInput)
    if (!username || typeof password !== 'string' || !password.length || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw invalid()
    const now = this.clock()
    this.db.prepare('DELETE FROM agency_login_attempts WHERE start<?').run(now - 15 * 60000)
    if (Number(this.db.prepare('SELECT count FROM agency_login_attempts WHERE username=?').get(username)?.count ?? 0) >= 5) throw new Error('Too many login attempts. Retry after fifteen minutes.')
    if (Number(this.db.prepare('SELECT count(*) AS n FROM agency_login_attempts').get()!.n) >= 10000) throw new Error('Too many login attempts. Retry later.')
    this.db.prepare(`INSERT INTO agency_login_attempts VALUES (?,?,1) ON CONFLICT(username) DO UPDATE SET count=count+1`).run(username, now)
    const admin = this.db.prepare('SELECT * FROM agency_admins WHERE username=?').get(username) as Row | undefined
    if (this.pendingLogins >= 2) throw new Error('Login service is busy. Retry shortly.')
    this.pendingLogins++
    let derived: Buffer
    try { derived = await derive(password, String(admin?.salt ?? '00'.repeat(16))) } finally { this.pendingLogins-- }
    if (!timingSafeEqual(derived, Buffer.from(String(admin?.password_hash ?? '00'.repeat(64)), 'hex')) || !admin) throw invalid()
    const step = Math.floor(this.clock() / 30000), secret = String(admin.totp_secret)
    const accepted = [step - 1, step, step + 1].find(s => s > Number(admin.last_step) && timingSafeEqual(Buffer.from(totp(secret, s)), Buffer.from(code)))
    if (accepted === undefined) throw invalid()
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex')
    return this.transaction(() => {
      // Recheck credentials after the asynchronous password work; CLI reset invalidates a pending login.
      if (!this.db.prepare('UPDATE agency_admins SET last_step=? WHERE id=? AND last_step<? AND password_hash=? AND totp_secret=?').run(accepted, admin.id!, accepted, admin.password_hash!, secret).changes) throw invalid()
      this.db.prepare('DELETE FROM agency_sessions WHERE issued_at<=? OR touched_at<=?').run(this.clock() - absolute, this.clock() - idle)
      this.db.prepare('INSERT INTO agency_sessions VALUES (?,?,?,?,?)').run(hash(token), admin.id!, csrf, this.clock(), this.clock())
      this.db.prepare('DELETE FROM agency_login_attempts WHERE username=?').run(username)
      this.audit('admin-login', String(admin.id))
      return { token, csrf, username }
    })
  }
  session(token: string | undefined, touch = false) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
    const row = this.db.prepare(`SELECT s.*,a.username FROM agency_sessions s JOIN agency_admins a ON a.id=s.admin_id WHERE token_hash=?`).get(hash(token))
    if (!row || this.clock() - Number(row.touched_at) >= idle || this.clock() - Number(row.issued_at) >= absolute) {
      this.db.prepare('DELETE FROM agency_sessions WHERE token_hash=?').run(hash(token)); return null
    }
    if (touch) this.db.prepare('UPDATE agency_sessions SET touched_at=? WHERE token_hash=?').run(this.clock(), hash(token))
    return { adminId: String(row.admin_id), username: String(row.username), csrf: String(row.csrf) }
  }
  logout(token: string) {
    this.transaction(() => {
      const session = this.session(token)
      this.db.prepare('DELETE FROM agency_sessions WHERE token_hash=?').run(hash(token))
      if (session) this.audit('admin-logout', session.adminId)
    })
  }
}
