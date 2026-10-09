import type { AuditedEntity, EntityId, MoneyPaisa, RecordStatus } from './shared'

export type Customer = AuditedEntity & {
  businessId: EntityId
  name: string
  phone: string
  email: string | null
  address: string | null
  cnic: string | null
  groupId: EntityId | null
  creditLimit: MoneyPaisa | null
  outstanding: MoneyPaisa
  isWalkIn: boolean
  status: RecordStatus
}

export type Supplier = AuditedEntity & {
  businessId: EntityId
  name: string
  phone: string
  email: string | null
  address: string | null
  city: string | null
  cnicOrNtn: string | null
  outstanding: MoneyPaisa
  status: RecordStatus
}

export type LedgerEntryType = 'sale' | 'purchase' | 'payment' | 'return' | 'credit_note' | 'adjustment'

export type PartyLedgerEntry = AuditedEntity & {
  businessId: EntityId
  partyType: 'customer' | 'supplier'
  partyId: EntityId
  type: LedgerEntryType
  referenceId: EntityId
  debit: MoneyPaisa
  credit: MoneyPaisa
  runningBalance: MoneyPaisa
  note: string | null
}
