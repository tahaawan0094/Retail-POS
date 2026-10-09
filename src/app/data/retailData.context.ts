import { createContext } from 'react'
import type { PurchaseDraft, PurchaseRecord } from '../../features/purchases/purchases.types'
import type { InventoryMovementRecord, ProductDraft, ProductRecord } from '../../features/products/products.types'
import type { CashTransactionRecord, SupplierLedgerEntry, SupplierPaymentMethod, SupplierPaymentRecord, SupplierRecord } from '../../features/suppliers/suppliers.types'

export type OperationResult = { ok: true } | { ok: false; error: string }
export type SaveProductResult = { ok: true; product: ProductRecord } | { ok: false; error: string }

export type RetailDataContextValue = {
  products: ProductRecord[]
  movements: InventoryMovementRecord[]
  purchases: PurchaseRecord[]
  suppliers: SupplierRecord[]
  supplierPayments: SupplierPaymentRecord[]
  supplierLedger: SupplierLedgerEntry[]
  cashTransactions: CashTransactionRecord[]
  saveProduct: (draft: ProductDraft, productId?: string) => SaveProductResult
  toggleProductStatus: (productId: string) => void
  adjustStock: (productId: string, quantityDelta: number, reason: string) => OperationResult
  receivePurchase: (draft: PurchaseDraft) => OperationResult
  paySupplier: (supplierId: string, amountRupees: number, method: SupplierPaymentMethod, reference: string) => OperationResult
}

export const RetailDataContext = createContext<RetailDataContextValue | null>(null)
