export type SupplierStatus = 'Active' | 'Inactive'
export type SupplierPaymentMethod = 'Cash' | 'Bank Transfer' | 'JazzCash' | 'Easypaisa' | 'Card'

export type SupplierRecord = {
  id: string
  name: string
  phone: string
  city: string
  email: string
  categories: string
  note: string
  totalPurchasesRupees: number
  totalPaidRupees: number
  outstandingRupees: number
  lastPurchaseDate: string | null
  status: SupplierStatus
}

export type SupplierPaymentRecord = {
  id: string
  supplierId: string
  date: string
  method: SupplierPaymentMethod
  amountRupees: number
  reference: string
  createdAt: string
}

export type SupplierLedgerEntry = {
  id: string
  supplierId: string
  date: string
  type: 'opening_balance' | 'purchase' | 'payment'
  reference: string
  debitRupees: number
  creditRupees: number
  balanceAfterRupees: number
  createdAt: string
}

export type CashTransactionRecord = {
  id: string
  type: 'supplier_payment'
  amountRupees: number
  referenceId: string
  description: string
  createdAt: string
}
