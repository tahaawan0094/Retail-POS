export type PurchaseStatus = 'Paid' | 'Partial' | 'Unpaid'

export type PurchaseLineDraft = {
  productId: string
  quantity: number
  unitCostRupees: number
}

export type PurchaseDraft = {
  supplier: string
  supplierInvoiceNumber: string
  purchaseDate: string
  paidAmountRupees: number
  paymentMethod: 'Cash' | 'Bank Transfer' | 'JazzCash' | 'Easypaisa' | 'Card'
  items: PurchaseLineDraft[]
}

export type PurchaseRecord = {
  id: string
  supplierId?: string
  purchaseNumber: string
  supplier: string
  supplierInvoiceNumber: string
  purchaseDate: string
  itemCount: number
  totalAmountRupees: number
  paidAmountRupees: number
  dueAmountRupees: number
  status: PurchaseStatus
  items: PurchaseLineDraft[]
  createdAt: string
}
