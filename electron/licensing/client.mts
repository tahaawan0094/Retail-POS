import { generateKeyPairSync, createPrivateKey, createPublicKey, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { LicenseClaims, LicenseStatus, LicenseTrust, SignedLicense, LicenseInventory } from '../../src/types/licensing.js'
import { CLOCK_TOLERANCE, publicKeyId, signDeviceRequest, validateTrust, verifyLease } from './protocol.mjs'
import { requiresTransactionLicense } from './policy.mjs'

export type LicenseProtector = { encrypt(value: string): Buffer; decrypt(value: Buffer): string }
type DeviceState = { version: 1; privateKey: string; publicKey: string; lease: SignedLicense | null; maxSequence: number; maxSeen: number; clockBlocked: boolean }
type Options = { path: string; trust: LicenseTrust | null; binding: () => string; inventory?: () => LicenseInventory; currentBranch?: () => string | undefined; protector: LicenseProtector; allowLocal?: boolean; clock?: () => number; monotonic?: () => number; transport?: typeof fetch }

export class LicenseClient {
  private state: DeviceState | null = null
  private trust: LicenseTrust | null = null
  private failure = ''
  private lastError = ''
  private busy = false
  private readonly clock: () => number
  private readonly monotonic: () => number
  private startedAt: number
  private startedMonotonic: number
  private persistedSeen = 0
  constructor(private readonly options: Options) {
    this.clock = options.clock ?? (() => Date.now())
    this.monotonic = options.monotonic ?? (() => performance.now())
    this.startedAt = this.clock(); this.startedMonotonic = this.monotonic()
    try {
      this.trust = options.trust ? validateTrust(options.trust, options.allowLocal) : null
      if (existsSync(options.path)) {
        this.state = JSON.parse(options.protector.decrypt(readFileSync(options.path))) as DeviceState
        const s = this.state
        if (!s || s.version !== 1 || typeof s.privateKey !== 'string' || typeof s.publicKey !== 'string' || typeof s.clockBlocked !== 'boolean' || !Number.isSafeInteger(s.maxSeen) || s.maxSeen < 1 || !Number.isSafeInteger(s.maxSequence) || s.maxSequence < 0) throw new Error('Invalid protected device state.')
        if (createPrivateKey(s.privateKey).asymmetricKeyType !== 'ed25519' || publicKeyId(createPublicKey(s.privateKey).export({ format: 'pem', type: 'spki' }).toString()) !== publicKeyId(s.publicKey)) throw new Error('Invalid protected device identity.')
        this.persistedSeen = s.maxSeen
      } else {
        const keys = generateKeyPairSync('ed25519')
        this.state = { version: 1, privateKey: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), publicKey: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString(), lease: null, maxSequence: 0, maxSeen: this.startedAt, clockBlocked: false }
        this.save()
      }
    } catch { this.state = null; this.failure = 'Device security state or company configuration could not be loaded. Contact the company; your business records are available.' }
  }
  private save() {
    if (!this.state) throw new Error('Device security state is unavailable.')
    mkdirSync(dirname(this.options.path), { recursive: true })
    const temporary = this.options.path + '.pending'
    writeFileSync(temporary, this.options.protector.encrypt(JSON.stringify(this.state)), { mode: 0o600, flush: true })
    renameSync(temporary, this.options.path)
    this.persistedSeen = this.state.maxSeen
  }
  status(branchId = this.options.currentBranch?.()): LicenseStatus {
    let installationId = ''
    try { installationId = this.options.binding() } catch { /* Restore can temporarily close the database. */ }
    const result: LicenseStatus = { state: 'invalid', canTransact: false, message: this.failure || 'License is invalid. Contact the company.', deviceId: this.state ? publicKeyId(this.state.publicKey) : '', installationId,
      tenantId: null, licenseId: null, customerName: null, expiresAt: null, refreshAfter: null, offlineUntil: null, lastCheckedAt: null, lastError: this.lastError, busy: this.busy }
    if (this.failure || !this.state) return result
    if (!this.trust) return { ...result, state: 'unconfigured', message: 'Company licensing service is not configured. Contact the company to provision this installation.' }
    if (!this.state.lease) return { ...result, state: 'unactivated', message: 'Activate this installation with the key supplied by the company. Records and backups remain accessible.' }
    try {
      const c = verifyLease(this.state.lease, this.trust.issuerPublicKey)
      if (c.deviceId !== result.deviceId || c.installationId !== installationId || c.sequence !== this.state.maxSequence) throw new Error('Device or restored installation does not match the registered license. Contact the company.')
      Object.assign(result, { tenantId: c.tenantId, licenseId: c.licenseId, customerName: c.customerName, expiresAt: new Date(c.expiresAt).toISOString(), refreshAfter: new Date(c.refreshAfter).toISOString(), offlineUntil: new Date(c.offlineUntil).toISOString(), lastCheckedAt: new Date(c.issuedAt).toISOString() })
      if (c.status !== 'active') return { ...result, state: c.status, message: 'Company license is ' + c.status + '. Contact the company to continue transactions.' }
      const wall = this.clock(), effectiveNow = Math.ceil(Math.max(wall, this.startedAt + this.monotonic() - this.startedMonotonic, this.state.maxSeen))
      if (this.state.clockBlocked || wall < this.state.maxSeen - CLOCK_TOLERANCE || wall < c.issuedAt - CLOCK_TOLERANCE) {
        if (!this.state.clockBlocked) { this.state.clockBlocked = true; this.save() }
        return { ...result, state: 'clock_error', message: 'Computer time moved backwards. Correct the clock and check the license online.' }
      }
      this.state.maxSeen = effectiveNow
      if (effectiveNow - this.persistedSeen >= 60000) this.save()
      if (effectiveNow >= c.expiresAt || effectiveNow >= c.offlineUntil) return { ...result, state: 'expired', message: effectiveNow >= c.expiresAt ? 'License has expired. Contact the company to renew it.' : 'Offline license validity has ended. Connect to the internet and check the license.' }
      if (this.options.inventory && c.version !== 2) return { ...result, message: 'Check the license online to register branch controls.' }
      if (c.version === 2 && branchId) {
        const branch = c.branches!.find(b => b.localId === branchId)
        if (!branch || branch.status !== 'active') return { ...result, branchId, state: branch?.status === 'suspended' ? 'suspended' : 'pending', message: branch?.status === 'suspended' ? 'This branch is locked by the company. Contact the company to unlock it.' : 'This branch needs company approval. Connect online and contact the company.' }
      }
      const grace = effectiveNow >= c.refreshAfter
      return { ...result, state: grace ? 'grace' : 'active', canTransact: true, message: grace ? 'Online license check is due. Transactions are allowed until offline validity ends.' : 'License active. Transactions are available offline until the displayed deadline.' }
    } catch (error) { return { ...result, message: error instanceof Error ? error.message : 'License could not be verified.' } }
  }
  authorize(channel: string, branchId = this.options.currentBranch?.()) {
    if (!requiresTransactionLicense(channel)) return
    const status = this.status(branchId)
    if (!status.canTransact) throw new Error('POS license locked: ' + status.message)
  }
  activate(key: unknown, reauthorize = () => {}) {
    if (typeof key !== 'string' || !/^VTX-[A-F0-9]{48}$/.test(key.trim().toUpperCase())) return Promise.reject(new Error('Enter the activation key supplied by the company.'))
    return this.exchange('activate', key.trim().toUpperCase(), reauthorize)
  }
  refresh(reauthorize = () => {}) { return this.exchange('refresh', undefined, reauthorize) }
  private async exchange(action: 'activate' | 'refresh', activationKey: string | undefined, reauthorize: () => void) {
    if (this.busy) throw new Error('A license check is already in progress.')
    if (this.failure || !this.state || !this.trust) throw new Error(this.status().message)
    const state = this.state, trust = this.trust, installationId = this.options.binding()
    if (!/^[a-f0-9]{32}$/.test(installationId)) throw new Error('Installation identity is unavailable.')
    let previous: LicenseClaims | null = null
    if (state.lease) previous = verifyLease(state.lease, trust.issuerPublicKey)
    if (action === 'refresh' && !previous) throw new Error('Activate the installation first.')
    const nonce = randomBytes(32).toString('hex')
    const request = signDeviceRequest({ action, publicKey: state.publicKey, installationId, nonce, timestamp: this.clock(), acceptedSequence: state.maxSequence, ...(this.options.inventory ? { inventory: this.options.inventory() } : {}), ...(action === 'activate' ? { activationKey } : { tenantId: previous!.tenantId, licenseId: previous!.licenseId }) }, state.privateKey)
    this.busy = true
    try {
      const response = await (this.options.transport ?? fetch)(trust.serviceUrl + '/v1/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), redirect: 'error', signal: AbortSignal.timeout(10000) })
      // Bound the response before parsing; proxies and unexpected servers must not exhaust memory.
      const reader = response.body?.getReader()
      if (!reader) throw new Error('License service returned an empty response.')
      const chunks: Uint8Array[] = []; let length = 0
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break
        length += chunk.value.length
        if (length > 16000) { await reader.cancel(); throw new Error('License service response is too large.') }
        chunks.push(chunk.value)
      }
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!response.ok) throw new Error(typeof value.error === 'string' && value.error.length < 300 ? value.error : 'Company license check failed.')
      const c = verifyLease(value, trust.issuerPublicKey)
      if (this.options.inventory && c.version !== 2 || previous?.version === 2 && c.version !== 2) throw new Error('Branch license scope is required; a legacy response cannot replace it.')
      if (c.nonce !== nonce || c.deviceId !== publicKeyId(state.publicKey) || c.installationId !== installationId || c.sequence <= state.maxSequence) throw new Error('License response does not match this request or is older than the accepted license.')
      if (previous && (c.tenantId !== previous.tenantId || c.licenseId !== previous.licenseId)) throw new Error('Registered business identity cannot change. Contact the company.')
      if (Math.abs(c.issuedAt - this.clock()) > CLOCK_TOLERANCE) throw new Error('Computer time does not match company time. Correct the clock and retry.')
      reauthorize()
      if (this.options.binding() !== installationId) throw new Error('Business records changed during the license check. Retry after signing in.')
      // Persist before enabling transactions. A storage failure locks this process.
      this.state = { ...state, lease: value as SignedLicense, maxSequence: c.sequence, maxSeen: Math.max(c.issuedAt, this.clock()), clockBlocked: false }
      try { this.save() } catch { this.failure = 'License security state could not be saved. Contact the company.'; throw new Error(this.failure) }
      this.startedAt = this.clock(); this.startedMonotonic = this.monotonic()
      this.lastError = ''
    } catch (error) {
      this.lastError = error instanceof SyntaxError ? 'Invalid response from the company licensing service.' : error instanceof TypeError && /fetch failed|Failed to fetch/.test(error.message) ? 'Company licensing service is unavailable. Check the connection and retry.' : error instanceof Error ? error.message : 'Company license service is unavailable.'
      throw new Error(this.lastError)
    } finally { this.busy = false }
    return this.status()
  }
  async automatic() {
    if (this.busy || !this.state?.lease || !this.trust || this.failure) return
    try { await this.refresh() } catch { /* Existing signed validity decides whether operations remain available. */ }
  }
}
