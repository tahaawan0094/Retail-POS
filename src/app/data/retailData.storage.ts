import { seedPurchases } from '../../features/purchases/purchases.seed'
import type { PurchaseRecord } from '../../features/purchases/purchases.types'
import { seedMovements, seedProducts } from '../../features/products/products.seed'
import type { InventoryMovementRecord, ProductRecord } from '../../features/products/products.types'
import { seedSupplierLedger, seedSupplierPayments, seedSuppliers } from '../../features/suppliers/suppliers.seed'
import type { CashTransactionRecord, SupplierLedgerEntry, SupplierPaymentRecord, SupplierRecord } from '../../features/suppliers/suppliers.types'

const STORAGE_KEY = 'vertexia.product-inventory.v1'

export type RetailDataSnapshot = {
  products: ProductRecord[]
  movements: InventoryMovementRecord[]
  purchases: PurchaseRecord[]
  suppliers: SupplierRecord[]
  supplierPayments: SupplierPaymentRecord[]
  supplierLedger: SupplierLedgerEntry[]
  cashTransactions: CashTransactionRecord[]
}

const cloneSeed = (): RetailDataSnapshot => ({
  products: seedProducts.map(product => ({ ...product })),
  movements: seedMovements.map(movement => ({ ...movement })),
  purchases: seedPurchases.map(purchase => ({ ...purchase, items: [...purchase.items] })),
  suppliers: seedSuppliers.map(supplier => ({ ...supplier })),
  supplierPayments: seedSupplierPayments.map(payment => ({ ...payment })),
  supplierLedger: seedSupplierLedger.map(entry => ({ ...entry })),
  cashTransactions: [],
})

export function loadRetailData(): RetailDataSnapshot {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return cloneSeed()
    const parsed = JSON.parse(saved) as Partial<RetailDataSnapshot>
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.movements)) return cloneSeed()
    const seed = cloneSeed()
    return {
      products: parsed.products,
      movements: parsed.movements,
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : seed.purchases,
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : seed.suppliers,
      supplierPayments: Array.isArray(parsed.supplierPayments) ? parsed.supplierPayments : seed.supplierPayments,
      supplierLedger: Array.isArray(parsed.supplierLedger) ? parsed.supplierLedger : seed.supplierLedger,
      cashTransactions: Array.isArray(parsed.cashTransactions) ? parsed.cashTransactions : [],
    }
  } catch {
    return cloneSeed()
  }
}

export function saveRetailData(snapshot: RetailDataSnapshot) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}
