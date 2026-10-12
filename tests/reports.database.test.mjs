import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'
import { AuthRepository } from '../electron-dist/electron/database/auth.mjs'
import { authorizeIpc } from '../electron-dist/electron/ipc-policy.mjs'
import { proportionalCost } from '../electron-dist/electron/database/valuation.mjs'

const branchId='branch-main',day='2026-10-10',clock=()=>new Date(day+'T12:00:00+05:00')
const input={name:'Weighted Rice',sku:'WAC-001',barcode:'WAC-001',category:'Grocery',subcategory:'',brand:'',unit:'Kg',purchasePricePaisa:10000,sellingPricePaisa:30000,mrpPaisa:0,minimumStockMilli:0,openingStockMilli:10000,status:'active',imageDataUrl:null}
const query=(section='overview',changes={})=>({branchId,dateFrom:day,dateTo:day,section,page:1,pageSize:25,...changes})
function setup(t,changes={}) {const db=new VertexiaDatabase(':memory:',clock);t.after(()=>db.close());const product=db.saveProduct(branchId,{...input,...changes});db.openPosShift(branchId,1000000);return{db,product}}
function buy(db,product,quantity=10000,price=20000,branch=branchId){return db.retail.receivePurchase({branchId:branch,operationId:randomUUID(),supplierName:'Distributor',supplierInvoiceNumber:'',businessDate:day,paidAmountPaisa:0,paymentMethod:'Cash',lines:[{productId:product.id,quantityMilli:quantity,unitCostPaisa:price}]})}
function sell(db,product,quantity=1000,changes={}) {return db.completePosSale({branchId,operationId:randomUUID(),customerId:'customer-walk-in',paymentMethod:'Cash',cashReceivedPaisa:1000000,lines:[{productId:product.id,quantityMilli:quantity,discountBasisPoints:0}],...changes})}
const value=(db,product,branch=branchId)=>db.connection.prepare('SELECT * FROM stock_values WHERE branch_id=? AND product_id=?').get(branch,product.id)
function returnQty(db,sale,qty){return db.createSalesReturn({branchId,operationId:randomUUID(),saleId:sale.saleId,reason:'Customer returned goods',lines:[{saleItemId:db.getSalesDetail(branchId,sale.saleId).lines[0].id,quantityMilli:qty}]})}

test('two purchase prices produce weighted average sale cost; editing catalog does not revalue stock',t=>{
  const{db,product}=setup(t);buy(db,product)
  assert.equal(value(db,product).total_cost_paisa,300000)
  db.saveProduct(branchId,{...input,id:product.id,purchasePricePaisa:90000,openingStockMilli:0})
  const sale=sell(db,product,5000)
  assert.equal(db.getSalesDetail(branchId,sale.saleId).costPaisa,75000)
  assert.equal(value(db,product).total_cost_paisa,225000)
  assert.equal(db.reports.valuation(branchId).valuePaisa,225000)
})
test('return restores original exact cost after a later purchase at a different price',t=>{
  const{db,product}=setup(t);buy(db,product);const sale=sell(db,product,4000)
  buy(db,product,4000,50000);returnQty(db,sale,4000)
  assert.equal(value(db,product).total_cost_paisa,500000)
  const report=db.reports.snapshot(query('sales'))
  assert.equal(report.summary.netSalesPaisa,0);assert.equal(report.summary.costPaisa,0)
  assert.equal(report.table.total,2);assert.equal(report.payments[0].netSalesPaisa,0)
})
test('fractional sales consume every paisa; partial returns restore exactly the original line cost',t=>{
  const{db,product}=setup(t,{openingStockMilli:3000,purchasePricePaisa:1,sellingPricePaisa:10000})
  const sale=sell(db,product,3000)
  assert.equal(value(db,product).total_cost_paisa,0)
  returnQty(db,sale,333);returnQty(db,sale,333);returnQty(db,sale,2334)
  assert.equal(value(db,product).total_cost_paisa,3)
  assert.equal(db.reports.snapshot(query()).summary.costPaisa,0)
  assert.equal(db.connection.prepare('SELECT SUM(cost_paisa) AS n FROM sale_return_items').get().n,3)
})
test('branch cost values remain independent although latest catalog cost is shared',t=>{
  const{db,product}=setup(t)
  db.connection.prepare('INSERT INTO branches(id,business_id,name,code,city,is_active,created_at) VALUES (?,?,?,?,?,?,?)').run('branch-other',db.businessId,'Other','OTHER','Lahore',1,clock().toISOString())
  buy(db,product,10000,50000,'branch-other')
  assert.equal(value(db,product,'branch-other').total_cost_paisa,500000)
  assert.equal(db.getSalesDetail(branchId,sell(db,product).saleId).costPaisa,10000)
  const all=db.reports.snapshot(query('stock',{allBranches:true}),[branchId,'branch-other'])
  assert.equal(all.summary.valuePaisa,590000);assert.equal(all.table.total,2)
  assert.equal(db.reports.snapshot(query()).summary.valuePaisa,90000)
})
test('stock count gains are estimated; depletion clears estimated basis for new actual purchases',t=>{
  const{db,product}=setup(t)
  db.retail.adjustStock({branchId,operationId:randomUUID(),productId:product.id,quantityDeltaMilli:1000,reason:'Physical stock count'})
  assert.equal(value(db,product).estimated,1);assert.equal(value(db,product).total_cost_paisa,110000)
  db.retail.adjustStock({branchId,operationId:randomUUID(),productId:product.id,quantityDeltaMilli:-11000,reason:'Damaged stock disposal'})
  assert.equal(value(db,product).estimated,0);assert.equal(value(db,product).total_cost_paisa,0)
  buy(db,product,1000,12000);assert.equal(value(db,product).estimated,0)
  assert.equal(db.reports.snapshot(query()).summary.stockAdjustmentCostPaisa,-100000)
})
test('posting rollback and duplicate retries keep stock values and sales costs atomic',t=>{
  const{db,product}=setup(t),request={branchId,operationId:randomUUID(),customerId:'customer-walk-in',paymentMethod:'Cash',cashReceivedPaisa:30000,lines:[{productId:product.id,quantityMilli:1000,discountBasisPoints:0}]}
  db.connection.exec("CREATE TRIGGER fail_cash BEFORE INSERT ON cash_transactions BEGIN SELECT RAISE(ABORT,'simulated cash failure'); END")
  assert.throws(()=>db.completePosSale(request),/simulated/);assert.equal(value(db,product).total_cost_paisa,100000)
  assert.equal(db.connection.prepare('SELECT COUNT(*) AS n FROM sale_item_costs').get().n,0)
  db.connection.exec('DROP TRIGGER fail_cash')
  assert.deepEqual(db.completePosSale(request),db.completePosSale(request));assert.equal(value(db,product).total_cost_paisa,90000)
  assert.equal(db.connection.prepare('SELECT COUNT(*) AS n FROM stock_value_movements').get().n,2)
})
test('CSV import and POS quick products both initialize exact opening cost',t=>{
  const{db}=setup(t)
  const quick=db.createPosProduct(branchId,{name:'Quick',category:'General',unit:'Piece',barcode:'QUICK',purchasePricePaisa:321,sellingPricePaisa:500,openingStockMilli:3000})
  assert.equal(value(db,quick).total_cost_paisa,963)
  db.importProductsCsv(branchId,'name,sku,category,unit,purchase_price,sale_price,opening_stock\nCSV stock,CSV-001,General,Piece,4.25,10,2.5')
  const imported=db.retail.getSnapshot(branchId).products.find(p=>p.sku==='CSV-001')
  assert.equal(value(db,imported).total_cost_paisa,1063)
})
test('reports separate credit revenue, collections, expenses and present-day dues',t=>{
  const{db,product}=setup(t),{customerId}=db.accounts.createCustomer({branchId,operationId:randomUUID(),name:'Credit Customer',phone:'',openingBalancePaisa:0})
  sell(db,product,2000,{customerId,paymentMethod:'Udhaar'});db.accounts.collect({branchId,operationId:randomUUID(),customerId,amountPaisa:10000,method:'Cash',reference:''})
  db.accounts.postExpense({branchId,operationId:randomUUID(),businessDate:day,description:'Electricity',category:'Utilities',amountPaisa:5000,method:'Cash',reference:''})
  buy(db,product,1000,20000)
  const report=db.reports.snapshot(query())
  assert.equal(report.summary.salesPaisa,60000);assert.equal(report.summary.grossProfitPaisa,40000)
  assert.equal(report.summary.operatingProfitPaisa,35000);assert.equal(report.summary.collectionsPaisa,10000)
  assert.equal(report.summary.customerDuePaisa,50000);assert.equal(report.summary.supplierDuePaisa,20000)
  assert.equal(db.reports.snapshot(query('customers',{dateFrom:'2020-01-01',dateTo:'2020-01-01'})).summary.customerDuePaisa,50000)
  for(const section of ['overview','sales','expenses','purchases','customers','suppliers','stock','shifts']) assert.ok(db.reports.snapshot(query(section)).table.columns.length)
})
test('Pakistan date boundaries and later expense reversals affect their own posting periods',t=>{
  let time=clock();const db=new VertexiaDatabase(':memory:',()=>time);t.after(()=>db.close());db.openPosShift(branchId,100000)
  const exp=db.accounts.postExpense({branchId,operationId:randomUUID(),businessDate:day,description:'Refundable bill',category:'Utilities',amountPaisa:5000,method:'Cash',reference:''})
  time=new Date('2026-10-10T20:00:00Z')
  db.accounts.reverseExpense({branchId,operationId:randomUUID(),expenseId:exp.expenseId,reason:'Bill refunded'})
  assert.equal(db.reports.snapshot(query()).summary.expensesPaisa,5000)
  assert.equal(db.reports.snapshot(query('expenses',{dateFrom:'2026-10-11',dateTo:'2026-10-11'})).summary.expensesPaisa,-5000)
})
test('pagination totals and full CSV export are independent; spreadsheet text is escaped',t=>{
  const{db,product}=setup(t,{name:'=HYPERLINK("test")',openingStockMilli:0})
  for(let i=0;i<3;i++)buy(db,product,1000,10000)
  const report=db.reports.snapshot(query('purchases',{pageSize:1,page:2}))
  assert.equal(report.table.total,3);assert.equal(report.table.rows.length,1);assert.equal(report.table.pageCount,3)
  assert.equal((db.reports.exportCsv(query('purchases',{pageSize:1})).match(/PUR-/g)||[]).length,3)
  assert.match(db.reports.exportCsv(query('stock')),/'=HYPERLINK/)
  assert.throws(()=>db.reports.snapshot(query('stock',{pageSize:101})),/100/)
  assert.throws(()=>db.reports.snapshot(query('stock',{dateFrom:'2026-11-10'})),/start date/)
  assert.throws(()=>db.reports.snapshot(query(),['unknown']),/unavailable/)
})
test('version-eight migration marks old stock estimated, preserves historical sale costs, and survives restart',t=>{
  const dir=mkdtempSync(join(tmpdir(),'vertexia-valuation-')),path=join(dir,'test.db');let db=new VertexiaDatabase(path,clock)
  t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true})})
  const product=db.saveProduct(branchId,input);db.openPosShift(branchId,1000000);const sale=sell(db,product)
  db.connection.exec('DROP TABLE stock_transfer_items;DROP TABLE stock_transfers;DROP TABLE transfer_document_sequences;DROP TABLE stock_value_movements;DROP TABLE sale_item_costs;DROP TABLE stock_values;PRAGMA user_version=8');db.close();db=new VertexiaDatabase(path,clock)
  assert.equal(value(db,product).total_cost_paisa,90000);assert.equal(value(db,product).estimated,1)
  assert.equal(db.getSalesDetail(branchId,sale.saleId).costPaisa,10000)
  assert.equal(db.reports.snapshot(query()).summary.estimatedCostLines,1)
  buy(db,product,1000,20000);db.close();db=new VertexiaDatabase(path,clock)
  assert.equal(value(db,product).total_cost_paisa,110000)
})
test('large intermediate integer cost calculations round correctly and reject unsafe persisted values',()=>{
  assert.equal(proportionalCost(9007199254740990,999,1000),9007199254740990-9007199254741)
  assert.throws(()=>proportionalCost(Number.MAX_SAFE_INTEGER,2000),/safe integer/)
})
test('returns of estimated legacy-cost goods are disclosed on the return posting date',t=>{
  let time=clock();const db=new VertexiaDatabase(':memory:',()=>time);t.after(()=>db.close())
  const product=db.saveProduct(branchId,input);db.openPosShift(branchId,1000000)
  db.retail.adjustStock({branchId,operationId:randomUUID(),productId:product.id,quantityDeltaMilli:1000,reason:'Estimated stock count'})
  const sale=sell(db,product)
  time=new Date('2026-10-11T07:00:00Z');returnQty(db,sale,1000)
  const report=db.reports.snapshot(query('sales',{dateFrom:'2026-10-11',dateTo:'2026-10-11'}))
  assert.equal(report.summary.estimatedCostLines,1)
  assert.equal(report.summary.netSalesPaisa,-30000);assert.equal(report.summary.costPaisa,-10000)
})
test('Owner and Manager can read reports; cashier and inventory staff cannot access financial reports',async t=>{
  const{db}=setup(t),auth=new AuthRepository(db.connection,clock)
  await auth.setup({businessName:'Report Shop',branchName:'Main',city:'Karachi',ownerName:'Owner',username:'owner',password:'Report owner passphrase 2026'})
  authorizeIpc(auth,db,'reports:snapshot',[query()]);assert.throws(()=>authorizeIpc(auth,db,'reports:snapshot',[query('stock',{branchId:'unassigned'})]),/branch/)
  for(const role of ['Manager','Cashier','Inventory']) {
    await auth.createUser({name:role,username:role.toLowerCase(),password:'Report staff passphrase 2026',role,branchIds:[branchId]})
  }
  for(const role of ['Manager','Cashier','Inventory']) {
    auth.logout();await auth.login(role.toLowerCase(),'Report staff passphrase 2026');await auth.changePassword('Report staff passphrase 2026','Report changed passphrase 2026')
    if(role==='Manager') {authorizeIpc(auth,db,'reports:snapshot',[query()]);authorizeIpc(auth,db,'reports:export-csv',[query()])}
    else {assert.throws(()=>authorizeIpc(auth,db,'reports:snapshot',[query()]),/permission/);assert.throws(()=>authorizeIpc(auth,db,'reports:export-csv',[query()]),/permission/)}
    if(role==='Inventory')authorizeIpc(auth,db,'reports:valuation',[branchId])
  }
})
