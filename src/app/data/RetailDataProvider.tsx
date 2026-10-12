import { useAuth } from '../auth/useAuth'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { RetailDataContext, type OperationResult, type RetailDataContextValue } from './retailData.context'
import type { PurchaseDraft, PurchaseRecord } from '../../features/purchases/purchases.types'
import type { InventoryMovementRecord, ProductRecord } from '../../features/products/products.types'
import type { SupplierLedgerEntry, SupplierPaymentMethod, SupplierPaymentRecord, SupplierRecord } from '../../features/suppliers/suppliers.types'
import type { RetailSnapshot } from '../../types/desktop-api'
import { RETAIL_DATA_CHANGED, notifyRetailDataChanged } from '../../services/retail-events'

type ViewData = Pick<RetailDataContextValue, 'products' | 'movements' | 'purchases' | 'suppliers' | 'supplierPayments' | 'supplierLedger' | 'businessDate'>
const empty: ViewData = { products: [], movements: [], purchases: [], suppliers: [], supplierPayments: [], supplierLedger: [], businessDate: '' }

function toFixedUnits(value: number, scale: number, label: string): number {
  const scaled = value * scale, rounded = Math.round(scaled)
  if (!Number.isFinite(value) || !Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 0.000001) throw new Error(label + ' has too many decimal places or is outside the supported range.')
  return rounded
}

function view(snapshot: RetailSnapshot): ViewData {
  return {
    businessDate: snapshot.businessDate,
    products: snapshot.products.map((item): ProductRecord => ({ id: item.id, kind: item.kind, name: item.name, barcode: item.barcode, sku: item.sku, category: item.category, subcategory: item.subcategory, brand: item.brand, unit: item.unit, purchasePriceRupees: item.purchasePricePaisa / 100, sellingPriceRupees: item.sellingPricePaisa / 100, mrpRupees: item.mrpPaisa / 100, minimumStock: item.minimumStockMilli / 1000, stock: item.stockMilli / 1000, status: item.status, imageDataUrl: item.imageDataUrl, createdAt: item.createdAt, updatedAt: item.updatedAt })),
    movements: snapshot.movements.map((item): InventoryMovementRecord => ({ id: item.id, productId: item.productId, productName: item.productName, type: item.type, quantityDelta: item.quantityDeltaMilli / 1000, balanceAfter: item.balanceAfterMilli / 1000, reason: item.reason, referenceId: item.referenceId, createdAt: item.occurredAt })),
    purchases: snapshot.purchases.map((item): PurchaseRecord => ({ id: item.id, supplierId: item.supplierId, purchaseNumber: item.purchaseNumber, supplier: item.supplierName, supplierInvoiceNumber: item.supplierInvoiceNumber, purchaseDate: item.businessDate, itemCount: item.lines.length, totalAmountRupees: item.totalPaisa / 100, paidAmountRupees: item.paidPaisa / 100, dueAmountRupees: item.duePaisa / 100, status: item.duePaisa === 0 ? 'Paid' : item.paidPaisa === 0 ? 'Unpaid' : 'Partial', items: item.lines.map(line => ({ productId: line.productId, quantity: line.quantityMilli / 1000, unitCostRupees: line.unitCostPaisa / 100 })), createdAt: item.createdAt })),
    suppliers: snapshot.suppliers.map((item): SupplierRecord => ({ id: item.id, name: item.name, phone: item.phone, city: '', email: '', categories: '', note: '', totalPurchasesRupees: item.totalPurchasesPaisa / 100, totalPaidRupees: item.totalPaidPaisa / 100, outstandingRupees: item.outstandingPaisa / 100, lastPurchaseDate: item.lastPurchaseDate, status: item.isActive ? 'Active' : 'Inactive' })),
    supplierPayments: snapshot.payments.map((item): SupplierPaymentRecord => ({ id: item.id, supplierId: item.supplierId, date: item.businessDate, method: item.method, amountRupees: item.amountPaisa / 100, reference: item.reference, createdAt: item.createdAt })),
    supplierLedger: snapshot.supplierLedger.map((item): SupplierLedgerEntry => ({ id: item.id, supplierId: item.supplierId, date: item.businessDate, type: item.type as SupplierLedgerEntry['type'], reference: item.reference, debitRupees: item.debitPaisa / 100, creditRupees: item.creditPaisa / 100, balanceAfterRupees: item.balanceAfterPaisa / 100, createdAt: item.occurredAt })),
  }
}

export function RetailDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const branchId = session!.branchId
  const allowed = session!.permissions.includes('retail.read')
  const [snapshot, setSnapshot] = useState<ViewData>(empty)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const refreshVersion = useRef(0)
  const [legacyDataAvailable] = useState(() => {
    try { return window.localStorage.getItem('vertexia.product-inventory.v1') !== null } catch { return false }
  })

  const refresh = useCallback(async () => {
    if (!allowed) { setLoading(false); return }
    const version = ++refreshVersion.current
    if (!window.vertexia?.retail) {
      setError('Desktop database is unavailable. Start Vertexia with npm run dev:desktop.')
      setLoading(false)
      return
    }
    try {
      const result = await window.vertexia.retail.getSnapshot(branchId)
      if (version !== refreshVersion.current) return
      setSnapshot(view(result)); setError('')
    } catch (cause) {
      if (version === refreshVersion.current) setError(cause instanceof Error ? cause.message : 'Retail records could not be loaded.')
    } finally { if (version === refreshVersion.current) setLoading(false) }
  }, [branchId, allowed])

  const invalidateRefresh = useCallback(() => { refreshVersion.current++ }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    const reload = () => void refresh()
    window.addEventListener(RETAIL_DATA_CHANGED, reload)
    window.addEventListener('focus', reload)
    return () => { window.clearTimeout(timer); window.removeEventListener(RETAIL_DATA_CHANGED, reload); window.removeEventListener('focus', reload); invalidateRefresh() }
  }, [refresh, invalidateRefresh])

  const run = async (operation: () => Promise<unknown>): Promise<OperationResult> => {
    if (busyRef.current) return { ok: false, error: 'Another operation is still being posted. Please wait.' }
    if (!window.vertexia?.retail) return { ok: false, error: 'The desktop database is unavailable.' }
    busyRef.current = true; setBusy(true)
    try {
      await operation()
      await refresh()
      notifyRetailDataChanged()
      return { ok: true }
    } catch (cause) {
      return { ok: false, error: cause instanceof Error ? cause.message : 'The operation could not be posted.' }
    } finally { busyRef.current = false; setBusy(false) }
  }

  const adjustStock = (productId: string, delta: number, reason: string, operationId: string) => run(() => window.vertexia!.retail.adjustStock({ branchId, operationId, productId, quantityDeltaMilli: toFixedUnits(delta, 1000, 'Quantity'), reason }))
  const receivePurchase = (draft: PurchaseDraft, operationId: string) => run(() => window.vertexia!.retail.receivePurchase({ branchId, operationId, supplierName: draft.supplier, supplierInvoiceNumber: draft.supplierInvoiceNumber, businessDate: draft.purchaseDate, paidAmountPaisa: toFixedUnits(draft.paidAmountRupees, 100, 'Paid amount'), paymentMethod: draft.paymentMethod, lines: draft.items.map(line => ({ productId: line.productId, quantityMilli: toFixedUnits(line.quantity, 1000, 'Quantity'), unitCostPaisa: toFixedUnits(line.unitCostRupees, 100, 'Unit cost') })) }))
  const paySupplier = (supplierId: string, amount: number, method: SupplierPaymentMethod, reference: string, operationId: string) => run(() => window.vertexia!.retail.paySupplier({ branchId, operationId, supplierId, amountPaisa: toFixedUnits(amount, 100, 'Payment'), method, reference }))

  return <RetailDataContext.Provider value={{ ...snapshot, loading, busy, error, legacyDataAvailable, refresh, adjustStock, receivePurchase, paySupplier }}>{children}</RetailDataContext.Provider>
}
