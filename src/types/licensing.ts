export type LicenseState = 'unconfigured' | 'unactivated' | 'active' | 'grace' | 'expired' | 'suspended' | 'revoked' | 'clock_error' | 'invalid' | 'pending'
export type BranchLicense = { localId: string; status: 'active' | 'suspended' | 'pending' }
export type LicenseInventory = { businessName: string; ownerName: string; branches: { id: string; name: string; code: string; city: string }[] }
export type LicenseStatus = {
  state: LicenseState
  canTransact: boolean
  message: string
  deviceId: string
  installationId: string
  tenantId: string | null
  licenseId: string | null
  customerName: string | null
  expiresAt: string | null
  refreshAfter: string | null
  offlineUntil: string | null
  lastCheckedAt: string | null
  lastError: string
  busy: boolean
  branchId?: string
}
export type LicenseTrust = { serviceUrl: string; issuerPublicKey: string }
export type LicenseClaims = {
  version: 1 | 2
  licenseId: string
  tenantId: string
  customerName: string
  deviceId: string
  installationId: string
  status: 'active' | 'suspended' | 'revoked' | 'expired'
  sequence: number
  nonce: string
  issuedAt: number
  refreshAfter: number
  offlineUntil: number
  expiresAt: number
  branches?: BranchLicense[]
}
export type SignedLicense = { payload: string; signature: string }
export type DeviceRequest = {
  action: 'activate' | 'refresh'
  publicKey: string
  installationId: string
  nonce: string
  timestamp: number
  activationKey?: string
  tenantId?: string
  licenseId?: string
  inventory?: LicenseInventory
  acceptedSequence?: number
  proof: string
}
