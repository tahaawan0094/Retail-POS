import { createHash, createPublicKey, sign, verify } from 'node:crypto'
import type { DeviceRequest, LicenseClaims, LicenseTrust, SignedLicense } from '../../src/types/licensing.js'

export const CLOCK_TOLERANCE = 5 * 60 * 1000
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}'
  return JSON.stringify(value)
}
export function publicKeyId(publicKey: string) {
  const key = createPublicKey(publicKey)
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('An Ed25519 public key is required.')
  return createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex')
}
export function validateTrust(value: unknown, allowLocal = false): LicenseTrust {
  if (!value || typeof value !== 'object') throw new Error('Company licensing configuration is missing.')
  const trust = value as LicenseTrust
  if (typeof trust.serviceUrl !== 'string' || typeof trust.issuerPublicKey !== 'string') throw new Error('Invalid company licensing configuration.')
  const url = new URL(trust.serviceUrl)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' || allowLocal && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('License service requires HTTPS; development permits loopback HTTP only.')
  publicKeyId(trust.issuerPublicKey)
  return { serviceUrl: url.origin, issuerPublicKey: trust.issuerPublicKey }
}
export function signLease(claims: LicenseClaims, privateKey: string): SignedLicense {
  const payload = Buffer.from(canonical(claims)).toString('base64url')
  return { payload, signature: sign(null, Buffer.from(payload), privateKey).toString('base64url') }
}
export function verifyLease(value: unknown, publicKey: string): LicenseClaims {
  if (!value || typeof value !== 'object') throw new Error('Invalid signed license.')
  const envelope = value as SignedLicense
  if (typeof envelope.payload !== 'string' || envelope.payload.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(envelope.payload) || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)) throw new Error('Invalid signed license.')
  publicKeyId(publicKey)
  if (!verify(null, Buffer.from(envelope.payload), publicKey, Buffer.from(envelope.signature, 'base64url'))) throw new Error('License signature is invalid.')
  const c = JSON.parse(Buffer.from(envelope.payload, 'base64url').toString('utf8')) as LicenseClaims
  if (!c || ![1, 2].includes(c.version) || !['active', 'suspended', 'revoked', 'expired'].includes(c.status)) throw new Error('Invalid license claims.')
  if (c.version === 2) {
    if (!Array.isArray(c.branches) || c.branches.length > 50) throw new Error('Invalid branch license scope.')
    const ids = new Set<string>()
    for (const branch of c.branches) {
      if (!branch || typeof branch.localId !== 'string' || !branch.localId || branch.localId.length > 100 || ids.has(branch.localId) || !['active', 'suspended', 'pending'].includes(branch.status)) throw new Error('Invalid branch license scope.')
      ids.add(branch.localId)
    }
  }
  for (const key of ['licenseId', 'tenantId', 'customerName', 'deviceId', 'installationId', 'nonce'] as const) if (typeof c[key] !== 'string' || !c[key] || c[key].length > 200) throw new Error('Invalid license identity.')
  for (const key of ['sequence', 'issuedAt', 'refreshAfter', 'offlineUntil', 'expiresAt'] as const) if (!Number.isSafeInteger(c[key]) || c[key] < 1) throw new Error('Invalid license validity.')
  if (c.refreshAfter < c.issuedAt || c.offlineUntil < c.refreshAfter || c.offlineUntil > c.expiresAt && c.status === 'active' || c.sequence < 1) throw new Error('Invalid license validity.')
  return c
}
export function signDeviceRequest(input: Omit<DeviceRequest, 'proof'>, privateKey: string): DeviceRequest {
  return { ...input, proof: sign(null, Buffer.from(canonical(input)), privateKey).toString('base64url') }
}
export function verifyDeviceRequest(value: unknown, now: number): DeviceRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid device request.')
  const r = value as DeviceRequest
  if (!['activate', 'refresh'].includes(r.action) || typeof r.publicKey !== 'string' || r.publicKey.length > 1000 || typeof r.proof !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(r.proof)) throw new Error('Invalid device proof.')
  if (typeof r.installationId !== 'string' || !/^[a-f0-9]{32}$/.test(r.installationId) || typeof r.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(r.nonce) || !Number.isSafeInteger(r.timestamp) || Math.abs(now - r.timestamp) > CLOCK_TOLERANCE) throw new Error('Device time or request identity is invalid. Correct the computer clock.')
  publicKeyId(r.publicKey)
  const { proof, ...input } = r
  if (!verify(null, Buffer.from(canonical(input)), r.publicKey, Buffer.from(proof, 'base64url'))) throw new Error('Device proof is invalid.')
  if (r.acceptedSequence !== undefined && (!Number.isSafeInteger(r.acceptedSequence) || r.acceptedSequence < 0)) throw new Error('Invalid accepted license sequence.')
  if (r.inventory !== undefined) {
    const i = r.inventory
    const label = (value: unknown, limit: number, empty = false) => typeof value === 'string' && value.length <= limit && (empty || !!value.trim()) && !Array.from(value).some(c => c.charCodeAt(0) < 32)
    if (!i || !label(i.businessName, 120) || !label(i.ownerName, 120) || !Array.isArray(i.branches) || !i.branches.length || i.branches.length > 50) throw new Error('Invalid business registration details (maximum 50 branches).')
    const ids = new Set<string>()
    for (const b of i.branches) {
      if (!b || !label(b.id, 100) || !label(b.name, 120) || !label(b.code, 32) || !label(b.city, 120, true) || ids.has(b.id)) throw new Error('Invalid branch registration details.')
      ids.add(b.id)
    }
  }
  return r
}
