import { createContext } from 'react'
import type { PurchaseDraft, PurchaseRecord } from '../../features/purchases/purchases.types'
import type { InventoryMovementRecord, ProductRecord } from '../../features/products/products.types'
import type { SupplierLedgerEntry, SupplierPaymentMethod, SupplierPaymentRecord, SupplierRecord } from '../../features/suppliers/suppliers.types'

export type OperationResult = { ok: true } | { ok: false; error: string }

export type RetailDataContextValue = {
  loading: boolean
  busy: boolean
  error: string
  businessDate: string
  legacyDataAvailable: boolean
  refresh: () => Promise<void>
  products: ProductRecord[]
  movements: InventoryMovementRecord[]
  purchases: PurchaseRecord[]
  suppliers: SupplierRecord[]
  supplierPayments: SupplierPaymentRecord[]
  supplierLedger: SupplierLedgerEntry[]
  adjustStock: (productId: string, quantityDelta: number, reason: string, operationId: string) => Promise<OperationResult>
  receivePurchase: (draft: PurchaseDraft, operationId: string) => Promise<OperationResult>
  paySupplier: (supplierId: string, amountRupees: number, method: SupplierPaymentMethod, reference: string, operationId: string) => Promise<OperationResult>
}

export const RetailDataContext = createContext<RetailDataContextValue | null>(null)
