import assert from 'node:assert/strict'
import { after,before,test } from 'node:test'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'

let database
let product
let customer

before(() => {
  database=new VertexiaDatabase(':memory:',() => new Date('2026-10-08T12:00:00+05:00'))
  product=database.createPosProduct('branch-main',{ name:'Test Rice 1kg',barcode:'9990001112223',category:'Grocery',unit:'Kg',purchasePricePaisa:10_000,sellingPricePaisa:15_000,openingStockMilli:10_000 })
  customer=database.createPosCustomer({ name:'Test Customer',phone:'03001234567' })
})

after(() => database.close())

test('loads a production POS with products, customers, categories and no fake sales', () => {
  const data=database.getPosBootstrap('branch-main')
  assert.equal(data.products.length,1)
  assert.equal(data.products[0].name,'Test Rice 1kg')
  assert.equal(data.customers.length,2)
  assert.deepEqual(data.categories,['Grocery'])
  assert.equal(data.activeShiftId,null)
})

test('requires an open shift before completing a sale', () => {
  assert.throws(() => database.completePosSale({ branchId:'branch-main',customerId:'customer-walk-in',lines:[{productId:product.id,quantityMilli:1000,discountBasisPoints:0}],paymentMethod:'Cash',cashReceivedPaisa:15_000 }),/Open a cash shift/)
  assert.equal(database.connection.prepare('SELECT COUNT(*) AS count FROM sales').get().count,0)
})

test('opens a cash shift and records its opening balance', () => {
  const shiftId=database.openPosShift('branch-main',50_000)
  const shift=database.connection.prepare('SELECT status,opening_cash_paisa FROM cash_shifts WHERE id=?').get(shiftId)
  assert.equal(shift.status,'open')
  assert.equal(shift.opening_cash_paisa,50_000)
  assert.throws(() => database.openPosShift('branch-main',0),/already open/)
})

test('holds and resumes a cart without changing stock', () => {
  const held=database.holdPosSale('branch-main',customer.id,[{productId:product.id,quantityMilli:1000,discountBasisPoints:500}])
  assert.equal(held.itemCount,1)
  assert.equal(database.getPosBootstrap('branch-main').heldSales.length,1)
  const resumed=database.resumePosSale(held.id)
  assert.equal(resumed.lines[0].discountBasisPoints,500)
  assert.equal(database.getPosBootstrap('branch-main').heldSales.length,0)
  assert.equal(database.getPosBootstrap('branch-main').products[0].quantityMilli,10_000)
})

test('completes a discounted cash sale atomically', () => {
  const receipt=database.completePosSale({ branchId:'branch-main',customerId:'customer-walk-in',lines:[{productId:product.id,quantityMilli:2000,discountBasisPoints:1000}],paymentMethod:'Cash',cashReceivedPaisa:30_000 })
  assert.equal(receipt.subtotalPaisa,30_000)
  assert.equal(receipt.discountPaisa,3_000)
  assert.equal(receipt.totalPaisa,27_000)
  assert.equal(receipt.changePaisa,3_000)
  assert.match(receipt.invoiceNumber,/^SAL-20261008-0001$/)
  assert.equal(database.getPosBootstrap('branch-main').products[0].quantityMilli,8_000)
  const drawer=database.connection.prepare("SELECT SUM(CASE WHEN direction='in' THEN amount_paisa ELSE -amount_paisa END) AS value FROM cash_transactions").get().value
  assert.equal(drawer,77_000)
  assert.equal(database.connection.prepare('SELECT COUNT(*) AS count FROM stock_movements').get().count,2)
})

test('records Udhaar against a registered customer and rejects walk-in credit', () => {
  assert.throws(() => database.completePosSale({ branchId:'branch-main',customerId:'customer-walk-in',lines:[{productId:product.id,quantityMilli:1000,discountBasisPoints:0}],paymentMethod:'Udhaar',cashReceivedPaisa:0 }),/registered customer/)
  const receipt=database.completePosSale({ branchId:'branch-main',customerId:customer.id,lines:[{productId:product.id,quantityMilli:1000,discountBasisPoints:0}],paymentMethod:'Udhaar',cashReceivedPaisa:0 })
  assert.equal(receipt.totalPaisa,15_000)
  const balance=database.connection.prepare('SELECT SUM(debit_paisa-credit_paisa) AS value FROM customer_ledger WHERE customer_id=?').get(customer.id).value
  assert.equal(balance,15_000)
  const payment=database.connection.prepare('SELECT method,amount_paisa FROM sale_payments WHERE sale_id=?').get(receipt.saleId)
  assert.equal(payment.method,'Udhaar')
  assert.equal(payment.amount_paisa,0)
})

test('rolls back the full transaction when stock is insufficient', () => {
  const saleCount=database.connection.prepare('SELECT COUNT(*) AS count FROM sales').get().count
  assert.throws(() => database.completePosSale({ branchId:'branch-main',customerId:customer.id,lines:[{productId:product.id,quantityMilli:8_000,discountBasisPoints:0}],paymentMethod:'Card',cashReceivedPaisa:0 }),/insufficient stock/)
  assert.equal(database.connection.prepare('SELECT COUNT(*) AS count FROM sales').get().count,saleCount)
  assert.equal(database.getPosBootstrap('branch-main').products[0].quantityMilli,7_000)
})

test('rejects duplicate barcodes and updates Dashboard from completed POS sales', () => {
  assert.throws(() => database.createPosProduct('branch-main',{ name:'Duplicate',barcode:'9990001112223',category:'Grocery',unit:'Piece',purchasePricePaisa:1,sellingPricePaisa:2,openingStockMilli:1000 }),/already assigned/)
  const dashboard=database.getDashboardSnapshot({ branchId:'branch-main',dateRange:'today',chartPeriod:'today' })
  assert.equal(dashboard.salesPaisa,42_000)
  assert.equal(dashboard.profitPaisa,12_000)
  assert.equal(dashboard.customerDuePaisa,15_000)
  assert.equal(dashboard.recentSales.length,2)
})
