export type ProductStatus = 'active' | 'inactive'

export type ProductRecord = {
  id: string
  kind: string
  name: string
  barcode: string
  sku: string
  category: string
  subcategory: string
  brand: string
  unit: string
  purchasePriceRupees: number
  sellingPriceRupees: number
  mrpRupees: number
  minimumStock: number
  stock: number
  status: ProductStatus
  imageDataUrl?: string | null
  createdAt: string
  updatedAt: string
}

export type ProductDraft = Omit<ProductRecord, 'id' | 'kind' | 'createdAt' | 'updatedAt'> & {
  kind?: string
}

export type InventoryMovementRecord = {
  id: string
  productId: string
  productName: string
  type: string
  quantityDelta: number
  balanceAfter: number
  reason: string
  referenceId?: string
  createdAt: string
}
