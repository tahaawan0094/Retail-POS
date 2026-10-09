import type { BranchScopedEntity, EntityId, ISODate, MoneyPaisa, PaymentMethod, QuantityMilliUnits } from './shared'

export type PurchaseStatus = 'paid' | 'partial' | 'unpaid' | 'returned' | 'voided'

export type Purchase = BranchScopedEntity & {
  purchaseNumber: string
  supplierInvoiceNumber: string | null
  supplierId: EntityId
  purchaseDate: ISODate
  subtotal: MoneyPaisa
  discount: MoneyPaisa
  tax: MoneyPaisa
  total: MoneyPaisa
  paid: MoneyPaisa
  due: MoneyPaisa
  status: PurchaseStatus
  note: string | null
}

export type PurchaseItem = {
  id: EntityId
  purchaseId: EntityId
  productId: EntityId
  productNameSnapshot: string
  quantity: QuantityMilliUnits
  unitCost: MoneyPaisa
  discount: MoneyPaisa
  tax: MoneyPaisa
  lineTotal: MoneyPaisa
}

export type SupplierPayment = BranchScopedEntity & {
  supplierId: EntityId
  purchaseId: EntityId | null
  method: PaymentMethod
  amount: MoneyPaisa
  reference: string | null
}
