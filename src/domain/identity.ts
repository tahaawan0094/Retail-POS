import type { AuditedEntity, EntityId, ISODateTime, RecordStatus } from './shared'

export type Permission =
  | 'pos.sale' | 'sale.return' | 'sale.void' | 'sale.manual_price' | 'sale.high_discount'
  | 'product.manage' | 'inventory.adjust' | 'purchase.manage' | 'customer.payment'
  | 'supplier.payment' | 'shift.close' | 'report.profit' | 'staff.manage' | 'settings.manage'

export type Role = AuditedEntity & {
  businessId: EntityId
  name: string
  permissions: Permission[]
}

export type StaffUser = AuditedEntity & {
  businessId: EntityId
  branchIds: EntityId[]
  roleId: EntityId
  name: string
  phone: string
  email: string | null
  passwordHash: string
  status: RecordStatus
  lastLoginAt: ISODateTime | null
}

export type AuditEvent = {
  id: EntityId
  businessId: EntityId
  branchId: EntityId | null
  userId: EntityId | null
  action: string
  entityType: string
  entityId: EntityId | null
  metadata: Record<string, unknown>
  occurredAt: ISODateTime
}
