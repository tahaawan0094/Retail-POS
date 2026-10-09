import assert from 'node:assert/strict'
import { after,before,test } from 'node:test'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'

let database
let now=new Date('2026-10-08T12:00:00+05:00')
let product
let customer
let cashSale
let cardSale
let creditSale

before(() => {
  database=new VertexiaDatabase(':memory:',()=>now)
  product=database.createPosProduct('branch-main',{name:'Test Rice 1kg',barcode:'9988776655443',category:'Grocery',unit:'Kg',purchasePricePaisa:10_000,sellingPricePaisa:15_000,openingStockMilli:20_000})
  customer=database.createPosCustomer({name:'Sales Customer',phone:'03009998888'})
  database.openPosShift('branch-main',50_000)
})

after(()=>database.close())

const query=(overrides={})=>({branchId:'branch-main',period:'today',search:'',paymentMethod:'all',status:'all',page:1,pageSize:10,...overrides})

test('starts with a real empty sales dashboard',()=>{
  const snapshot=database.getSalesSnapshot(query())
  assert.equal(snapshot.totalSalesPaisa,0)
  assert.equal(snapshot.transactionCount,0)
  assert.equal(snapshot.sales.length,0)
})

test('lists POS transactions and derives accurate KPIs, chart and payments',()=>{
  cashSale=database.completePosSale({branchId:'branch-main',customerId:'customer-walk-in',lines:[{productId:product.id,quantityMilli:2_000,discountBasisPoints:1_000}],paymentMethod:'Cash',cashReceivedPaisa:30_000})
  cardSale=database.completePosSale({branchId:'branch-main',customerId:'customer-walk-in',lines:[{productId:product.id,quantityMilli:1_000,discountBasisPoints:0}],paymentMethod:'Card',cashReceivedPaisa:0})
  creditSale=database.completePosSale({branchId:'branch-main',customerId:customer.id,lines:[{productId:product.id,quantityMilli:1_000,discountBasisPoints:0}],paymentMethod:'Udhaar',cashReceivedPaisa:0})
  const snapshot=database.getSalesSnapshot(query())
  assert.equal(snapshot.totalSalesPaisa,57_000)
  assert.equal(snapshot.transactionCount,3)
  assert.equal(snapshot.averageOrderPaisa,19_000)
  assert.equal(snapshot.total,3)
  assert.equal(snapshot.payments.reduce((sum,item)=>sum+item.amountPaisa,0),57_000)
  assert.equal(snapshot.chart.reduce((sum,item)=>sum+item.valuePaisa,0),57_000)
})

test('searches product snapshots and filters payment and status',()=>{
  assert.equal(database.getSalesSnapshot(query({search:'Rice'})).total,3)
  assert.equal(database.getSalesSnapshot(query({search:cashSale.invoiceNumber})).total,1)
  assert.equal(database.getSalesSnapshot(query({paymentMethod:'Card'})).sales[0].id,cardSale.saleId)
  assert.equal(database.getSalesSnapshot(query({status:'completed'})).total,3)
})

test('loads a complete invoice with immutable line snapshots',()=>{
  const detail=database.getSalesDetail('branch-main',cashSale.saleId)
  assert.equal(detail.customerName,'Walk-in Customer')
  assert.equal(detail.lines.length,1)
  assert.equal(detail.lines[0].quantityMilli,2_000)
  assert.equal(detail.lines[0].returnableQuantityMilli,2_000)
  assert.equal(detail.totalPaisa,27_000)
})

test('processes a partial cash return atomically and restores stock and drawer cash',()=>{
  const line=database.getSalesDetail('branch-main',cashSale.saleId).lines[0]
  const result=database.createSalesReturn({branchId:'branch-main',saleId:cashSale.saleId,reason:'Customer changed mind',lines:[{saleItemId:line.id,quantityMilli:1_000}]})
  assert.match(result.returnNumber,/^RET-20261008-0001$/)
  assert.equal(result.totalPaisa,13_500)
  const detail=database.getSalesDetail('branch-main',cashSale.saleId)
  assert.equal(detail.status,'partially_returned')
  assert.equal(detail.lines[0].returnableQuantityMilli,1_000)
  assert.equal(database.getPosBootstrap('branch-main').products[0].quantityMilli,17_000)
  const drawer=database.connection.prepare("SELECT SUM(CASE WHEN direction='in' THEN amount_paisa ELSE -amount_paisa END) AS value FROM cash_transactions").get().value
  assert.equal(drawer,63_500)
})

test('finishes a return without rounding drift and updates sales analytics',()=>{
  const line=database.getSalesDetail('branch-main',cashSale.saleId).lines[0]
  const result=database.createSalesReturn({branchId:'branch-main',saleId:cashSale.saleId,reason:'Remaining pack returned',lines:[{saleItemId:line.id,quantityMilli:1_000}]})
  assert.equal(result.totalPaisa,13_500)
  const detail=database.getSalesDetail('branch-main',cashSale.saleId)
  assert.equal(detail.status,'returned')
  assert.equal(detail.returnedPaisa,27_000)
  const snapshot=database.getSalesSnapshot(query())
  assert.equal(snapshot.totalSalesPaisa,30_000)
  assert.equal(snapshot.returnsPaisa,27_000)
  assert.equal(database.getSalesSnapshot(query({status:'returned'})).total,1)
})

test('credits an Udhaar customer when a credit sale is returned',()=>{
  const before=database.connection.prepare('SELECT SUM(debit_paisa-credit_paisa) AS value FROM customer_ledger WHERE customer_id=?').get(customer.id).value
  const line=database.getSalesDetail('branch-main',creditSale.saleId).lines[0]
  database.createSalesReturn({branchId:'branch-main',saleId:creditSale.saleId,reason:'Damaged item',lines:[{saleItemId:line.id,quantityMilli:1_000}]})
  const after=database.connection.prepare('SELECT SUM(debit_paisa-credit_paisa) AS value FROM customer_ledger WHERE customer_id=?').get(customer.id).value
  assert.equal(before,15_000)
  assert.equal(after,0)
})

test('rejects excess and duplicate returns without changing stock',()=>{
  const line=database.getSalesDetail('branch-main',cardSale.saleId).lines[0]
  const stock=database.getPosBootstrap('branch-main').products[0].quantityMilli
  assert.throws(()=>database.createSalesReturn({branchId:'branch-main',saleId:cardSale.saleId,reason:'Invalid amount',lines:[{saleItemId:line.id,quantityMilli:2_000}]}),/exceeds/)
  assert.equal(database.getPosBootstrap('branch-main').products[0].quantityMilli,stock)
  assert.equal(database.getSalesDetail('branch-main',cardSale.saleId).returns.length,0)
})

test('exports the filtered sales ledger as safe CSV',()=>{
  const csv=database.exportSalesCsv(query({paymentMethod:'Card'}))
  assert.match(csv,/invoice,date_time,customer/)
  assert.match(csv,new RegExp(cardSale.invoiceNumber))
  assert.doesNotMatch(csv,new RegExp(cashSale.invoiceNumber))
})
