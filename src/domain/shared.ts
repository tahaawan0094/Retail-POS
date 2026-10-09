export type EntityId = string
export type ISODate = string
export type ISODateTime = string

/** Integer paisa. Rs 125.50 is stored as 12_550. */
export type MoneyPaisa = number

/** Integer thousandths of a base unit. 0.750 kg is stored as 750. */
export type QuantityMilliUnits = number

export type RecordStatus = 'active' | 'inactive'
export type SyncStatus = 'synced' | 'pending' | 'failed'
export type PaymentMethod = 'cash' | 'card' | 'jazzcash' | 'easypaisa' | 'credit'

export type AuditedEntity = {
  id: EntityId
  createdAt: ISODateTime
  createdBy: EntityId
  updatedAt: ISODateTime
  updatedBy: EntityId
}

export type BranchScopedEntity = AuditedEntity & {
  businessId: EntityId
  branchId: EntityId
}
