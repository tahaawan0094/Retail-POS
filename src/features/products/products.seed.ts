import type { InventoryMovementRecord, ProductRecord } from './products.types'

const now = '2026-10-03T09:00:00+05:00'

const rows = [
  ['cola','Coca Cola 1.5L','8964001234567','CC1500','Beverages','Coca Cola','Piece',48,170,200,200,10],
  ['lays','Lays Masala','8964006543210','LS001','Snacks','Lays','Piece',25,80,100,100,5],
  ['milk','Nestle Milk 1L','8964008765432','NM001','Dairy','Nestle','Piece',52,180,220,220,10],
  ['surf','Surf Excel 1kg','8964001122223','SE001','Household','Surf Excel','Piece',3,320,450,450,5],
  ['shan','Shan Biryani Masala','8964003344445','SB001','Grocery','Shan','Piece',25,120,180,180,10],
  ['oil','Dalda Cooking Oil 5L','8964005566778','DO005','Grocery','Dalda','Liter',8,1450,1950,1950,10],
  ['colgate','Colgate Toothpaste','8964007788990','CT001','Personal Care','Colgate','Piece',40,90,120,120,10],
  ['shampoo','Head & Shoulders 400ml','80065A8997765','HS001','Personal Care','Head & Shoulders','Piece',12,550,650,650,5],
  ['lux','Lux Soap','8964002233445','LX001','Personal Care','Lux','Piece',30,60,90,90,10],
  ['tide','Tide Detergent 1kg','8964006677889','TD001','Household','Tide','Piece',6,320,420,420,5],
  ['eggs','Egg Tray','8964009988776','EG001','Grocery','Local','Tray',15,250,280,280,10],
  ['bananas','Bananas (kg)','','BN001','Fruits & Vegetables','Local','Kg',18,140,180,180,5],
] as const

export const seedProducts: ProductRecord[] = rows.map(([kind,name,barcode,sku,category,brand,unit,stock,purchase,selling,mrp,minimum], index) => ({
  id: `product-${index + 1}`, kind, name, barcode, sku, category, subcategory: '', brand, unit,
  stock, purchasePriceRupees: purchase, sellingPriceRupees: selling, mrpRupees: mrp,
  minimumStock: minimum, status: 'active', createdAt: now, updatedAt: now,
}))

export const seedMovements: InventoryMovementRecord[] = seedProducts.map((product, index) => ({
  id: `movement-${index + 1}`,
  productId: product.id,
  productName: product.name,
  type: 'opening_stock',
  quantityDelta: product.stock,
  balanceAfter: product.stock,
  reason: 'Initial catalog stock',
  createdAt: now,
}))
