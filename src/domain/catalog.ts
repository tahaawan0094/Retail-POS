import type { AuditedEntity, EntityId, MoneyPaisa, QuantityMilliUnits, RecordStatus } from './shared'

export type ProductUnit = 'piece' | 'kg' | 'gram' | 'liter' | 'milliliter' | 'pack' | 'tray' | 'carton'

export type Product = AuditedEntity & {
  businessId: EntityId
  name: string
  barcode: string | null
  sku: string
  categoryId: EntityId | null
  subcategoryId: EntityId | null
  brandId: EntityId | null
  preferredSupplierId: EntityId | null
  baseUnit: ProductUnit
  isWeightBased: boolean
  purchasePrice: MoneyPaisa
  sellingPrice: MoneyPaisa
  mrp: MoneyPaisa | null
  minimumStock: QuantityMilliUnits
  maximumStock: QuantityMilliUnits | null
  trackExpiry: boolean
  trackBatch: boolean
  imageUrl: string | null
  status: RecordStatus
}

export type ProductUnitConversion = AuditedEntity & {
  productId: EntityId
  unit: ProductUnit
  baseUnitMultiplier: QuantityMilliUnits
}
