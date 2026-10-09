import type { BranchScopedEntity, EntityId, MoneyPaisa, PaymentMethod, QuantityMilliUnits } from './shared'

export type SaleStatus = 'completed' | 'partially_returned' | 'returned' | 'voided'

export type Sale = BranchScopedEntity & {
  invoiceNumber: string
  customerId: EntityId
  cashierId: EntityId
  shiftId: EntityId | null
  subtotal: MoneyPaisa
  discount: MoneyPaisa
  tax: MoneyPaisa
  total: MoneyPaisa
  paid: MoneyPaisa
  due: MoneyPaisa
  status: SaleStatus
}

export type SaleItem = AuditedSaleLine & {
  saleId: EntityId
  productId: EntityId
  productNameSnapshot: string
  skuSnapshot: string
  quantity: QuantityMilliUnits
  unitPrice: MoneyPaisa
  unitCost: MoneyPaisa
  discount: MoneyPaisa
  tax: MoneyPaisa
  lineTotal: MoneyPaisa
}

type AuditedSaleLine = {
  id: EntityId
  createdAt: string
  createdBy: EntityId
}

export type SalePayment = AuditedSaleLine & {
  saleId: EntityId
  method: PaymentMethod
  amount: MoneyPaisa
  reference: string | null
}

export type CompleteSaleCommand = {
  requestId: string
  branchId: EntityId
  customerId: EntityId
  cashierId: EntityId
  shiftId: EntityId | null
  items: Array<{ productId: EntityId; quantity: QuantityMilliUnits; discount: MoneyPaisa }>
  payments: Array<{ method: PaymentMethod; amount: MoneyPaisa; reference?: string }>
}
