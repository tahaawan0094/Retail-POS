import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'
import { migrations } from '../electron-dist/electron/database/schema.mjs'

const clock = () => new Date('2026-10-10T12:00:00+05:00')
const branchId = 'branch-main'
const productInput = (changes = {}) => ({ name: 'Retail Test Rice', sku: 'RETAIL-001', barcode: 'RETAIL-001', category: 'Grocery', subcategory: '', brand: '', unit: 'Kg', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 1000, openingStockMilli: 0, status: 'active', imageDataUrl: null, ...changes })
const purchaseInput = (productId, changes = {}) => ({ branchId, operationId: randomUUID(), supplierName: 'Test Distributor', supplierInvoiceNumber: '', businessDate: '2026-10-10', paidAmountPaisa: 0, paymentMethod: 'Cash', lines: [{ productId, quantityMilli: 10000, unitCostPaisa: 10000 }], ...changes })
const counts = db => Object.fromEntries(['products', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments', 'supplier_payment_allocations', 'supplier_ledger', 'stock_movements', 'cash_transactions', 'audit_events', 'operation_results', 'document_sequences'].map(table => [table, Number(db.connection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)]))
function setup(t, changes = {}) {
  const db = new VertexiaDatabase(':memory:', clock)
  t.after(() => db.close())
  return { db, product: db.saveProduct(branchId, productInput(changes)) }
}

test('fresh retail data has no browser seeds or invented purchases', t => {
  const { db } = setup(t)
  const data = db.retail.getSnapshot(branchId)
  assert.equal(data.businessDate, '2026-10-10')
  assert.equal(data.products.length, 1)
  assert.equal(data.products[0].stockMilli, 0)
  assert.deepEqual(data.purchases, [])
  assert.deepEqual(data.suppliers, [])
  assert.deepEqual(data.movements, [])
  assert.equal(db.connection.prepare('PRAGMA user_version').get().user_version, migrations.at(-1).version)
})

test('purchase -> POS sale -> return share stock, cash and ledgers across restart', t => {
  const dir = mkdtempSync(join(tmpdir(), 'vertexia-retail-'))
  const filename = join(dir, 'store.db')
  let db = new VertexiaDatabase(filename, clock)
  t.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })
  const product = db.saveProduct(branchId, productInput())
  db.openPosShift(branchId, 200000)
  const purchaseRequest = purchaseInput(product.id, { supplierInvoiceNumber: 'SUP-100', paidAmountPaisa: 40000 })
  const purchase = db.retail.receivePurchase(purchaseRequest)
  assert.equal(purchase.totalPaisa, 100000)
  assert.equal(db.getPosBootstrap(branchId).products[0].quantityMilli, 10000)
  const saleRequest = { branchId, operationId: randomUUID(), customerId: 'customer-walk-in', lines: [{ productId: product.id, quantityMilli: 3000, discountBasisPoints: 0 }], paymentMethod: 'Cash', cashReceivedPaisa: 50000 }
  const sale = db.completePosSale(saleRequest)
  assert.equal(sale.totalPaisa, 45000)
  const line = db.getSalesDetail(branchId, sale.saleId).lines[0]
  const returnRequest = { branchId, operationId: randomUUID(), saleId: sale.saleId, reason: 'Unopened item returned', lines: [{ saleItemId: line.id, quantityMilli: 1000 }] }
  const returned = db.createSalesReturn(returnRequest)
  assert.equal(returned.totalPaisa, 15000)
  const snapshot = db.retail.getSnapshot(branchId)
  assert.equal(snapshot.products[0].stockMilli, 8000)
  assert.deepEqual(snapshot.movements.map(item => item.type), ['sale_return', 'sale', 'purchase'])
  assert.equal(snapshot.suppliers[0].outstandingPaisa, 60000)
  assert.equal(snapshot.purchases[0].duePaisa, 60000)
  assert.equal(snapshot.supplierLedger[0].balanceAfterPaisa, 60000)
  const dashboard = db.getDashboardSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' })
  assert.equal(dashboard.cashInDrawerPaisa, 190000)
  assert.equal(dashboard.supplierDuePaisa, 60000)
  assert.equal(dashboard.salesPaisa, 30000)
  assert.equal(dashboard.profitPaisa, 10000)
  assert.equal(dashboard.chart.reduce((sum,item) => sum+item.valuePaisa,0), 30000)
  const before = counts(db)
  db.close()
  db = new VertexiaDatabase(filename, clock)
  assert.equal(db.retail.getSnapshot(branchId).products[0].stockMilli, 8000)
  assert.deepEqual(db.retail.receivePurchase(purchaseRequest), purchase)
  assert.deepEqual(db.completePosSale(saleRequest), sale)
  assert.deepEqual(db.createSalesReturn(returnRequest), returned)
  assert.deepEqual(counts(db), before)
  assert.deepEqual(db.connection.prepare('PRAGMA foreign_key_check').all(), [])
})

test('supplier payments allocate oldest purchases and update purchase status without adding stock', t => {
  const { db, product } = setup(t)
  const first = db.retail.receivePurchase(purchaseInput(product.id, { businessDate: '2026-10-09', lines: [{ productId: product.id, quantityMilli: 1000, unitCostPaisa: 10000 }] }))
  const second = db.retail.receivePurchase(purchaseInput(product.id, { lines: [{ productId: product.id, quantityMilli: 1000, unitCostPaisa: 10000 }] }))
  const request = { branchId, operationId: randomUUID(), supplierId: first.supplierId, amountPaisa: 15000, method: 'Bank Transfer', reference: 'BANK-100' }
  const result = db.retail.paySupplier(request)
  const snapshot = db.retail.getSnapshot(branchId)
  assert.equal(result.outstandingPaisa, 5000)
  assert.equal(snapshot.purchases.find(item => item.id === first.purchaseId).duePaisa, 0)
  assert.equal(snapshot.purchases.find(item => item.id === second.purchaseId).duePaisa, 5000)
  assert.equal(snapshot.suppliers[0].totalPaidPaisa, 15000)
  assert.equal(snapshot.products[0].stockMilli, 2000)
  assert.equal(snapshot.payments.length, 1)
  assert.equal(db.connection.prepare('SELECT COUNT(*) AS n FROM cash_transactions').get().n, 0)
  assert.deepEqual(db.retail.paySupplier(request), result)
  assert.equal(db.retail.getSnapshot(branchId).payments.length, 1)
})

test('cash purchase requires a shift and rolls back supplier, stock and all financial effects', t => {
  const { db, product } = setup(t)
  const before = counts(db)
  assert.throws(() => db.retail.receivePurchase(purchaseInput(product.id, { paidAmountPaisa: 10000 })), /Open a cash shift/)
  assert.deepEqual(counts(db), before)
  assert.equal(db.retail.getSnapshot(branchId).products[0].stockMilli, 0)
})

test('cash supplier payment affects the same drawer used by POS', t => {
  const { db, product } = setup(t)
  const purchase = db.retail.receivePurchase(purchaseInput(product.id))
  const request = { branchId, operationId: randomUUID(), supplierId: purchase.supplierId, amountPaisa: 5000, method: 'Cash', reference: '' }
  const before = counts(db)
  assert.throws(() => db.retail.paySupplier(request), /Open a cash shift/)
  assert.deepEqual(counts(db), before)
  db.openPosShift(branchId, 10000)
  db.retail.paySupplier(request)
  assert.equal(db.getDashboardSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' }).cashInDrawerPaisa, 5000)
})

test('a mid-post database failure rolls back items, stock, supplier ledger and sequence', t => {
  const { db, product } = setup(t)
  const other = db.saveProduct(branchId, productInput({ sku: 'SECOND', barcode: 'SECOND', name: 'Second Product' }))
  db.connection.exec(`CREATE TRIGGER fail_second BEFORE INSERT ON stock_movements WHEN NEW.product_id='${other.id}' BEGIN SELECT RAISE(ABORT,'simulated failure'); END`)
  const before = counts(db)
  const request = purchaseInput(product.id, { lines: [{ productId: product.id, quantityMilli: 1000, unitCostPaisa: 10000 }, { productId: other.id, quantityMilli: 1000, unitCostPaisa: 10000 }] })
  assert.throws(() => db.retail.receivePurchase(request), /simulated failure/)
  assert.deepEqual(counts(db), before)
  assert.ok(db.retail.getSnapshot(branchId).products.every(item => item.stockMilli === 0))
  db.connection.exec('DROP TRIGGER fail_second')
  assert.equal(db.retail.receivePurchase(request).purchaseNumber, 'PUR-20261010-0001')
})

test('supplier invoice duplicate detection is tenant-wide and case insensitive', t => {
  const { db, product } = setup(t)
  db.retail.receivePurchase(purchaseInput(product.id, { supplierInvoiceNumber: 'REF-001' }))
  const before = counts(db)
  assert.throws(() => db.retail.receivePurchase(purchaseInput(product.id, { supplierName: 'test distributor', supplierInvoiceNumber: 'ref-001' })), /already been received/)
  assert.deepEqual(counts(db), before)
})

test('invalid quantities, amounts, dates and duplicate items make no changes', t => {
  const { db, product } = setup(t)
  const before = counts(db)
  for (const changes of [
    { businessDate: '2026-02-30' }, { paidAmountPaisa: NaN }, { paidAmountPaisa: Infinity }, { paidAmountPaisa: 100001 },
    { paymentMethod: 'Invalid' }, { lines: [] },
    { lines: [{ productId: product.id, quantityMilli: 1.1, unitCostPaisa: 100 }] },
    { lines: [{ productId: product.id, quantityMilli: -1000, unitCostPaisa: 100 }] },
    { lines: [{ productId: product.id, quantityMilli: 1000, unitCostPaisa: Number.MAX_SAFE_INTEGER }] },
    { lines: [{ productId: product.id, quantityMilli: 1000, unitCostPaisa: 100 }, { productId: product.id, quantityMilli: 1000, unitCostPaisa: 100 }] },
  ]) assert.throws(() => db.retail.receivePurchase(purchaseInput(product.id, changes)))
  assert.deepEqual(counts(db), before)
})

test('decimal quantities round to paisa per line and remain exact in stock', t => {
  const { db, product } = setup(t)
  const result = db.retail.receivePurchase(purchaseInput(product.id, { paymentMethod: 'Card', paidAmountPaisa: 33, lines: [{ productId: product.id, quantityMilli: 333, unitCostPaisa: 101 }] }))
  assert.equal(result.totalPaisa, 34)
  const snapshot = db.retail.getSnapshot(branchId)
  assert.equal(snapshot.purchases[0].duePaisa, 1)
  assert.equal(snapshot.products[0].stockMilli, 333)
  assert.equal(snapshot.payments[0].amountPaisa, 33)
})

test('adjustments are auditable, retry-safe and cannot reduce stock below zero', t => {
  const { db, product } = setup(t)
  const request = { branchId, operationId: randomUUID(), productId: product.id, quantityDeltaMilli: 1250, reason: 'Physical count correction' }
  const result = db.retail.adjustStock(request)
  assert.equal(result.balanceAfterMilli, 1250)
  assert.deepEqual(db.retail.adjustStock(request), result)
  const before = counts(db)
  assert.throws(() => db.retail.adjustStock({ ...request, quantityDeltaMilli: 1000 }), /different request/)
  assert.throws(() => db.retail.adjustStock({ ...request, operationId: randomUUID(), quantityDeltaMilli: -2000 }), /below zero/)
  assert.deepEqual(counts(db), before)
  db.retail.adjustStock({ ...request, operationId: randomUUID(), quantityDeltaMilli: -250 })
  assert.equal(db.getPosBootstrap(branchId).products[0].quantityMilli, 1000)
})

test('foreign-business branch and product references are denied', t => {
  const { db, product } = setup(t)
  db.connection.exec(`INSERT INTO businesses VALUES ('other-business','Other','PKR','Asia/Karachi','2026-10-10'); INSERT INTO branches VALUES ('other-branch','other-business','Other','OTHER','Karachi',1,'2026-10-10')`)
  db.connection.prepare('UPDATE products SET business_id=? WHERE id=?').run('other-business', product.id)
  assert.throws(() => db.retail.receivePurchase(purchaseInput(product.id)), /this business/)
  assert.throws(() => db.retail.getSnapshot('other-branch'), /unavailable/)
  assert.throws(() => db.retail.receivePurchase(purchaseInput(product.id, { branchId: 'other-branch' })), /unavailable/)
  assert.equal(db.connection.prepare('SELECT COUNT(*) AS n FROM purchases').get().n, 0)
})

test('document numbering survives gaps in existing rows', t => {
  const { db, product } = setup(t, { openingStockMilli: 10000 })
  db.openPosShift(branchId, 0)
  const request = { branchId, customerId: 'customer-walk-in', paymentMethod: 'Card', cashReceivedPaisa: 0, lines: [{ productId: product.id, quantityMilli: 1000, discountBasisPoints: 0 }] }
  const first = db.completePosSale({ ...request, operationId: randomUUID() })
  db.connection.prepare('UPDATE sales SET invoice_number=? WHERE id=?').run('SAL-20261010-0042', first.saleId)
  assert.equal(db.completePosSale({ ...request, operationId: randomUUID() }).invoiceNumber, 'SAL-20261010-0043')
})

test('supplier overpayment and reused operation identifiers never double-pay', t => {
  const { db, product } = setup(t)
  const purchase = db.retail.receivePurchase(purchaseInput(product.id))
  const request = { branchId, operationId: randomUUID(), supplierId: purchase.supplierId, amountPaisa: 100000, method: 'Card', reference: 'PAY-ONE' }
  db.retail.paySupplier(request)
  const before = counts(db)
  assert.throws(() => db.retail.paySupplier({ ...request, amountPaisa: 1000 }), /different request/)
  assert.throws(() => db.retail.paySupplier({ ...request, operationId: randomUUID(), amountPaisa: 1 }), /exceed/)
  assert.deepEqual(counts(db), before)
  assert.equal(db.retail.getSnapshot(branchId).purchases[0].duePaisa, 0)
})

test('inactive products cannot be purchased or adjusted', t => {
  const { db, product } = setup(t)
  db.toggleProductStatus(branchId, product.id)
  const before = counts(db)
  assert.throws(() => db.retail.receivePurchase(purchaseInput(product.id)), /active product/)
  assert.throws(() => db.retail.adjustStock({ branchId, operationId: randomUUID(), productId: product.id, quantityDeltaMilli: 1000, reason: 'Count correction' }), /active product/)
  assert.deepEqual(counts(db), before)
})

test('returns posted on another day preserve original sales and reverse revenue on return day', t => {
  let time = new Date('2026-10-09T12:00:00+05:00')
  const db = new VertexiaDatabase(':memory:', () => time)
  t.after(() => db.close())
  const product = db.saveProduct(branchId, productInput({ openingStockMilli:1000 }))
  db.openPosShift(branchId, 50000)
  const sale = db.completePosSale({ branchId,operationId:randomUUID(),customerId:'customer-walk-in',lines:[{productId:product.id,quantityMilli:1000,discountBasisPoints:0}],paymentMethod:'Cash',cashReceivedPaisa:15000 })
  time = clock()
  const item = db.getSalesDetail(branchId,sale.saleId).lines[0]
  db.createSalesReturn({ branchId,operationId:randomUUID(),saleId:sale.saleId,reason:'Next day return',lines:[{saleItemId:item.id,quantityMilli:1000}] })
  const today = db.getDashboardSnapshot({ branchId,dateRange:'today',chartPeriod:'today' })
  const yesterday = db.getDashboardSnapshot({ branchId,dateRange:'yesterday',chartPeriod:'7_days' })
  assert.equal(today.salesPaisa,-15000)
  assert.equal(today.profitPaisa,-5000)
  assert.equal(yesterday.salesPaisa,15000)
  assert.equal(db.getSalesSnapshot({branchId,period:'today',search:'',paymentMethod:'all',status:'all',page:1,pageSize:10}).totalSalesPaisa,today.salesPaisa)
})

test('opening supplier balances affect outstanding without masquerading as purchases', t => {
  const { db } = setup(t)
  db.connection.prepare('INSERT INTO suppliers VALUES (?,?,?,?,?,?)').run('supplier-opening','business-noor-mart','Opening Supplier',null,1,clock().toISOString())
  db.connection.prepare('INSERT INTO supplier_ledger VALUES (?,?,?,?,?,?,?,?)').run('opening-entry',branchId,'supplier-opening','opening_balance',5000,0,'opening',clock().toISOString())
  const supplier = db.retail.getSnapshot(branchId).suppliers[0]
  assert.equal(supplier.totalPurchasesPaisa,0)
  assert.equal(supplier.outstandingPaisa,5000)
})

test('version-four upgrade preserves real stock and financial records with a legacy marker', t => {
  const dir = mkdtempSync(join(tmpdir(),'vertexia-migration-'))
  const filename = join(dir,'store.db')
  let db = new VertexiaDatabase(filename,clock)
  t.after(() => { db.close();rmSync(dir,{recursive:true,force:true}) })
  const product = db.saveProduct(branchId,productInput({openingStockMilli:2000}))
  db.openPosShift(branchId,10000)
  db.completePosSale({branchId,customerId:'customer-walk-in',paymentMethod:'Cash',cashReceivedPaisa:15000,lines:[{productId:product.id,quantityMilli:1000,discountBasisPoints:0}]})
  db.connection.exec(`DROP TABLE stock_transfer_items;DROP TABLE stock_transfers;DROP TABLE transfer_document_sequences;DROP TABLE stock_value_movements;DROP TABLE sale_item_costs;DROP TABLE stock_values;DROP TABLE expense_reversals;DROP TABLE expense_postings;DROP TABLE customer_receipts;DROP TABLE account_document_sequences;DROP TABLE cash_movement_notes;DROP TABLE cash_shift_closings;DROP TABLE backup_metadata;DROP INDEX idx_cash_shifts_one_open;DELETE FROM app_meta WHERE key='installation_id';DROP TABLE user_branches;DROP TABLE user_credentials;DROP TABLE login_throttle;DROP TABLE supplier_payment_allocations;DROP TABLE supplier_payments;DROP TABLE purchase_items;DROP TABLE purchases;DROP TABLE operation_results;DROP TABLE document_sequences;PRAGMA user_version=4`)
  db.connection.prepare('INSERT INTO app_meta VALUES (?,?)').run('seeded_business_date','2026-10-10')
  db.close()
  db = new VertexiaDatabase(filename,clock)
  assert.equal(db.retail.getSnapshot(branchId).products[0].stockMilli,1000)
  assert.equal(db.getDashboardSnapshot({branchId,dateRange:'today',chartPeriod:'today'}).cashInDrawerPaisa,25000)
  assert.equal(db.connection.prepare('SELECT COUNT(*) AS n FROM sales').get().n,1)
  assert.equal(db.connection.prepare('PRAGMA user_version').get().user_version,migrations.at(-1).version)
  assert.deepEqual(db.connection.prepare('PRAGMA foreign_key_check').all(),[])
})
