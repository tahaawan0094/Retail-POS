import type { BranchScopedEntity, EntityId, ISODate, QuantityMilliUnits } from './shared'

export type StockMovementType =
  | 'opening_stock' | 'purchase' | 'sale' | 'sale_return' | 'purchase_return'
  | 'adjustment_increase' | 'adjustment_decrease' | 'damage' | 'transfer_in' | 'transfer_out'

export type StockLevel = BranchScopedEntity & {
  productId: EntityId
  availableQuantity: QuantityMilliUnits
  reservedQuantity: QuantityMilliUnits
}

export type StockMovement = BranchScopedEntity & {
  productId: EntityId
  type: StockMovementType
  quantityDelta: QuantityMilliUnits
  referenceType: string
  referenceId: EntityId
  reason: string | null
  batchNumber: string | null
  expiryDate: ISODate | null
}
