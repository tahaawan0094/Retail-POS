import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { RetailDataContext, type RetailDataContextValue } from './retailData.context'
import { loadRetailData, saveRetailData } from './retailData.storage'
import type { PurchaseDraft, PurchaseRecord, PurchaseStatus } from '../../features/purchases/purchases.types'
import type { InventoryMovementRecord, ProductDraft, ProductRecord } from '../../features/products/products.types'
import type { CashTransactionRecord, SupplierLedgerEntry, SupplierPaymentMethod, SupplierPaymentRecord, SupplierRecord } from '../../features/suppliers/suppliers.types'

const createId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

export function RetailDataProvider({ children }: { children: ReactNode }) {
  const [snapshot,setSnapshot] = useState(loadRetailData)
  useEffect(() => saveRetailData(snapshot), [snapshot])

  const value = useMemo<RetailDataContextValue>(() => ({
    products: snapshot.products,
    movements: snapshot.movements,
    purchases: snapshot.purchases,
    suppliers: snapshot.suppliers,
    supplierPayments: snapshot.supplierPayments,
    supplierLedger: snapshot.supplierLedger,
    cashTransactions: snapshot.cashTransactions,
    saveProduct: (draft: ProductDraft, productId?: string) => {
      const barcode = draft.barcode.trim()
      if (snapshot.products.some(product => product.id !== productId && barcode && product.barcode === barcode)) return { ok:false, error:'Barcode already belongs to another product.' }
      if (!draft.name.trim()) return { ok:false, error:'Product name is required.' }
      if (!draft.category) return { ok:false, error:'Category is required.' }
      if (draft.sellingPriceRupees <= 0) return { ok:false, error:'Selling price must be greater than zero.' }
      const timestamp = new Date().toISOString()
      const existing = productId ? snapshot.products.find(product => product.id === productId) : undefined
      const product: ProductRecord = existing
        ? { ...existing, ...draft, barcode, kind: draft.kind ?? existing.kind, updatedAt: timestamp }
        : { ...draft, id:createId('product'), kind:draft.kind ?? 'box', barcode, createdAt:timestamp, updatedAt:timestamp }
      const opening: InventoryMovementRecord | null = !existing && product.stock > 0 ? {
        id:createId('movement'), productId:product.id, productName:product.name, type:'opening_stock',
        quantityDelta:product.stock, balanceAfter:product.stock, reason:'Opening stock from product creation', createdAt:timestamp,
      } : null
      setSnapshot(current => ({ ...current,
        products: existing ? current.products.map(item => item.id === product.id ? product : item) : [product,...current.products],
        movements: opening ? [opening,...current.movements] : current.movements,
      }))
      return { ok:true, product }
    },
    toggleProductStatus: productId => setSnapshot(current => ({ ...current, products:current.products.map(product => product.id === productId ? { ...product, status:product.status === 'active' ? 'inactive' : 'active', updatedAt:new Date().toISOString() } : product) })),
    adjustStock: (productId,quantityDelta,reason) => {
      const product = snapshot.products.find(item => item.id === productId)
      if (!product) return { ok:false, error:'Select a valid product.' }
      if (!Number.isFinite(quantityDelta) || quantityDelta === 0) return { ok:false, error:'Adjustment quantity must be greater than zero.' }
      const balance = product.stock + quantityDelta
      if (balance < 0) return { ok:false, error:'Adjustment cannot reduce stock below zero.' }
      if (!reason.trim()) return { ok:false, error:'Adjustment reason is required.' }
      const timestamp = new Date().toISOString()
      const movement: InventoryMovementRecord = { id:createId('movement'), productId, productName:product.name, type:quantityDelta > 0 ? 'adjustment_increase' : 'adjustment_decrease', quantityDelta, balanceAfter:balance, reason:reason.trim(), createdAt:timestamp }
      setSnapshot(current => ({ ...current, products:current.products.map(item => item.id === productId ? { ...item, stock:balance, updatedAt:timestamp } : item), movements:[movement,...current.movements] }))
      return { ok:true }
    },
    receivePurchase: (draft: PurchaseDraft) => {
      if (!draft.supplier.trim()) return { ok:false, error:'Supplier is required.' }
      if (!draft.items.length) return { ok:false, error:'Add at least one purchase item.' }
      if (draft.items.some(item => !item.productId || item.quantity <= 0 || item.unitCostRupees <= 0)) return { ok:false, error:'Every item needs a product, quantity and purchase cost.' }
      if (new Set(draft.items.map(item => item.productId)).size !== draft.items.length) return { ok:false, error:'Add each product only once per purchase.' }
      const total = draft.items.reduce((sum,item) => sum + item.quantity * item.unitCostRupees,0)
      if (draft.paidAmountRupees < 0 || draft.paidAmountRupees > total) return { ok:false, error:'Paid amount must be between zero and the purchase total.' }
      const timestamp = new Date().toISOString()
      const id = createId('purchase')
      const paid = draft.paidAmountRupees
      const due = total - paid
      const status: PurchaseStatus = due === 0 ? 'Paid' : paid === 0 ? 'Unpaid' : 'Partial'
      const purchaseNumber = `PUR-${new Date().getFullYear()}-${String(snapshot.purchases.length + 1).padStart(3,'0')}`
      const purchase: PurchaseRecord = { id,purchaseNumber,supplier:draft.supplier.trim(),supplierInvoiceNumber:draft.supplierInvoiceNumber.trim(),purchaseDate:draft.purchaseDate,itemCount:draft.items.length,totalAmountRupees:total,paidAmountRupees:paid,dueAmountRupees:due,status,items:draft.items.map(item => ({ ...item })),createdAt:timestamp }
      const supplierMatch = snapshot.suppliers.find(supplier => supplier.name.toLowerCase() === purchase.supplier.toLowerCase())
      const supplierId = supplierMatch?.id ?? createId('supplier')
      const supplier: SupplierRecord = supplierMatch ? {
        ...supplierMatch, totalPurchasesRupees:supplierMatch.totalPurchasesRupees + total,
        totalPaidRupees:supplierMatch.totalPaidRupees + paid, outstandingRupees:supplierMatch.outstandingRupees + due,
        lastPurchaseDate:draft.purchaseDate,
      } : { id:supplierId,name:purchase.supplier,phone:'',city:'Karachi',email:'',categories:'General',note:'Created from purchase receiving',totalPurchasesRupees:total,totalPaidRupees:paid,outstandingRupees:due,lastPurchaseDate:draft.purchaseDate,status:'Active' }
      const updatedProducts = snapshot.products.map(product => {
        const lines = draft.items.filter(item => item.productId === product.id)
        if (!lines.length) return product
        const added = lines.reduce((sum,line) => sum + line.quantity,0)
        const latestCost = lines.at(-1)?.unitCostRupees ?? product.purchasePriceRupees
        return { ...product, stock:product.stock + added, purchasePriceRupees:latestCost, updatedAt:timestamp }
      })
      const movements = draft.items.map(item => {
        const product = snapshot.products.find(entry => entry.id === item.productId)!
        return { id:createId('movement'), productId:product.id, productName:product.name, type:'purchase' as const, quantityDelta:item.quantity, balanceAfter:product.stock + item.quantity, reason:`Purchase received from ${purchase.supplier}`, referenceId:id, createdAt:timestamp }
      })
      const purchaseBalance = (supplierMatch?.outstandingRupees ?? 0) + total
      const purchaseLedger: SupplierLedgerEntry = { id:createId('supplier-ledger'),supplierId,date:draft.purchaseDate,type:'purchase',reference:purchaseNumber,debitRupees:total,creditRupees:0,balanceAfterRupees:purchaseBalance,createdAt:timestamp }
      const paymentId = paid > 0 ? createId('supplier-payment') : ''
      const payment: SupplierPaymentRecord | null = paid > 0 ? { id:paymentId,supplierId,date:draft.purchaseDate,method:draft.paymentMethod,amountRupees:paid,reference:purchaseNumber,createdAt:timestamp } : null
      const paymentLedger: SupplierLedgerEntry | null = paid > 0 ? { id:createId('supplier-ledger'),supplierId,date:draft.purchaseDate,type:'payment',reference:purchaseNumber,debitRupees:0,creditRupees:paid,balanceAfterRupees:purchaseBalance - paid,createdAt:timestamp } : null
      const cashTransaction: CashTransactionRecord | null = payment && draft.paymentMethod === 'Cash' ? { id:createId('cash-transaction'),type:'supplier_payment',amountRupees:paid,referenceId:payment.id,description:`Purchase payment to ${supplier.name}`,createdAt:timestamp } : null
      setSnapshot(current => ({ ...current,
        products:updatedProducts, movements:[...movements,...current.movements], purchases:[purchase,...current.purchases],
        suppliers:supplierMatch ? current.suppliers.map(item => item.id === supplierId ? supplier : item) : [supplier,...current.suppliers],
        supplierPayments:payment ? [payment,...current.supplierPayments] : current.supplierPayments,
        supplierLedger:paymentLedger ? [paymentLedger,purchaseLedger,...current.supplierLedger] : [purchaseLedger,...current.supplierLedger],
        cashTransactions:cashTransaction ? [cashTransaction,...current.cashTransactions] : current.cashTransactions,
      }))
      return { ok:true }
    },
    paySupplier: (supplierId: string,amountRupees: number,method: SupplierPaymentMethod,reference: string) => {
      const supplier = snapshot.suppliers.find(item => item.id === supplierId)
      if (!supplier) return { ok:false,error:'Select a valid supplier.' }
      if (!Number.isFinite(amountRupees) || amountRupees <= 0) return { ok:false,error:'Payment amount must be greater than zero.' }
      if (amountRupees > supplier.outstandingRupees) return { ok:false,error:'Payment cannot exceed supplier outstanding.' }
      const timestamp = new Date().toISOString()
      const date = timestamp.slice(0,10)
      const payment: SupplierPaymentRecord = { id:createId('supplier-payment'),supplierId,date,method,amountRupees,reference:reference.trim(),createdAt:timestamp }
      const balance = supplier.outstandingRupees - amountRupees
      const ledger: SupplierLedgerEntry = { id:createId('supplier-ledger'),supplierId,date,type:'payment',reference:reference.trim() || payment.id,debitRupees:0,creditRupees:amountRupees,balanceAfterRupees:balance,createdAt:timestamp }
      const cashTransaction: CashTransactionRecord | null = method === 'Cash' ? { id:createId('cash-transaction'),type:'supplier_payment',amountRupees,referenceId:payment.id,description:`Payment to ${supplier.name}`,createdAt:timestamp } : null
      setSnapshot(current => ({ ...current,
        suppliers:current.suppliers.map(item => item.id === supplierId ? { ...item,totalPaidRupees:item.totalPaidRupees + amountRupees,outstandingRupees:balance } : item),
        supplierPayments:[payment,...current.supplierPayments], supplierLedger:[ledger,...current.supplierLedger],
        cashTransactions:cashTransaction ? [cashTransaction,...current.cashTransactions] : current.cashTransactions,
      }))
      return { ok:true }
    },
  }), [snapshot])

  return <RetailDataContext.Provider value={value}>{children}</RetailDataContext.Provider>
}
