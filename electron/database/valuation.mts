import type { DatabaseSync } from 'node:sqlite'
import { requireSafeInteger } from './posting.mjs'

// Integer half-up rounding, including products whose intermediate multiplication
// exceeds Number.MAX_SAFE_INTEGER. Persisted amounts must still be safe integers.
export function proportionalCost(amount: number, quantity: number, denominator = 1000): number {
  requireSafeInteger(amount, 'Cost'); requireSafeInteger(quantity, 'Quantity')
  requireSafeInteger(denominator, 'Cost denominator', 1)
  return requireSafeInteger(Number((BigInt(amount) * BigInt(quantity) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator)), 'Calculated cost')
}

export function stockCost(db: DatabaseSync, branchId: string, productId: string, quantityMilli: number) {
  const row = db.prepare(`SELECT v.total_cost_paisa,v.estimated,s.quantity_milli FROM stock_values v
    JOIN stock_levels s USING(branch_id,product_id) WHERE v.branch_id=? AND v.product_id=?`).get(branchId, productId)
  if (!row) throw new Error('Stock valuation is missing. Contact support before selling this product.')
  const quantity = Number(row.quantity_milli), total = Number(row.total_cost_paisa)
  if (quantityMilli > quantity) throw new Error('Insufficient stock for cost calculation.')
  return { costPaisa: quantity ? proportionalCost(total, quantityMilli, quantity) : 0,
    unitCostPaisa: quantity ? proportionalCost(total, 1000, quantity) : 0, estimated: Number(row.estimated) === 1 }
}

// Call inside the same posting transaction, after the corresponding stock change.
export function changeStockValue(db: DatabaseSync, branchId: string, productId: string, costDeltaPaisa: number, estimated: boolean, occurredAt: string, movementId?: string) {
  if (!Number.isSafeInteger(costDeltaPaisa)) throw new Error('Stock cost change exceeds the supported range.')
  const stock = db.prepare('SELECT quantity_milli FROM stock_levels WHERE branch_id=? AND product_id=?').get(branchId, productId)
  if (!stock) throw new Error('Stock balance is missing.')
  const old = db.prepare('SELECT total_cost_paisa,estimated FROM stock_values WHERE branch_id=? AND product_id=?').get(branchId, productId)
  const total = requireSafeInteger(Number(old?.total_cost_paisa ?? 0) + costDeltaPaisa, 'Stock value')
  const empty = Number(stock.quantity_milli) === 0
  if (empty && total !== 0) throw new Error('Empty stock must have zero value.')
  const isEstimated = empty ? 0 : Number(estimated || Number(old?.estimated ?? 0) === 1)
  db.prepare(`INSERT INTO stock_values VALUES (?,?,?,?,?) ON CONFLICT(branch_id,product_id)
    DO UPDATE SET total_cost_paisa=excluded.total_cost_paisa,estimated=excluded.estimated,updated_at=excluded.updated_at`).run(branchId, productId, total, isEstimated, occurredAt)
  if (movementId) db.prepare('INSERT INTO stock_value_movements VALUES (?,?,?,?)').run(movementId, costDeltaPaisa, total, isEstimated)
}

export function openingStockValue(db: DatabaseSync, branchId: string, productId: string, quantityMilli: number, pricePaisa: number, occurredAt: string) {
  const movement = quantityMilli>0 ? db.prepare("SELECT id FROM stock_movements WHERE branch_id=? AND product_id=? AND movement_type='opening_stock' ORDER BY occurred_at DESC,rowid DESC LIMIT 1").get(branchId,productId) : undefined
  changeStockValue(db, branchId, productId, proportionalCost(pricePaisa, quantityMilli), false, occurredAt,movement ? String(movement.id) : undefined)
  // The catalog is business-wide; other active branches start with zero stock.
  db.prepare('INSERT OR IGNORE INTO stock_levels SELECT b.id,p.id,0,? FROM branches b JOIN products p ON p.business_id=b.business_id WHERE p.id=? AND b.is_active=1').run(occurredAt,productId)
  db.prepare('INSERT OR IGNORE INTO stock_values SELECT branch_id,product_id,0,0,? FROM stock_levels WHERE product_id=? AND quantity_milli=0').run(occurredAt,productId)
}
