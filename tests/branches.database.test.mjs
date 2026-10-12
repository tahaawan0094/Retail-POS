import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'
import { AuthRepository } from '../electron-dist/electron/database/auth.mjs'
import { authorizeIpc } from '../electron-dist/electron/ipc-policy.mjs'

const branchId='branch-main',day='2026-10-10',clock=()=>new Date(day+'T12:00:00+05:00')
const productInput={name:'Transfer Rice',sku:'TRF-001',barcode:'TRF-001',category:'Grocery',subcategory:'',brand:'',unit:'Kg',purchasePricePaisa:10000,sellingPricePaisa:30000,mrpPaisa:0,minimumStockMilli:0,openingStockMilli:10000,status:'active',imageDataUrl:null}
const branchRequest=(changes={})=>({branchId,operationId:randomUUID(),name:'Lahore Branch',code:'LHR01',city:'Lahore',...changes})
function setup(t) {const db=new VertexiaDatabase(':memory:',clock);t.after(()=>db.close());return {db,product:db.saveProduct(branchId,productInput)}}
const archive=(db,id,changes={})=>db.branches.setActive({branchId,operationId:randomUUID(),targetBranchId:id,isActive:false,reason:'Branch closed permanently',...changes})
const dispatch=(db,product,destination,changes={})=>db.transfers.dispatch({branchId,operationId:randomUUID(),destinationBranchId:destination,note:'Move to branch',lines:[{productId:product.id,quantityMilli:2000}],...changes})
const receive=(db,id,destination,changes={})=>db.transfers.receive({branchId:destination,operationId:randomUUID(),transferId:id,note:'Received intact',...changes})
const cancel=(db,id,changes={})=>db.transfers.cancel({branchId,operationId:randomUUID(),transferId:id,reason:'Goods physically returned',...changes})
const stock=(db,product,branch)=>db.connection.prepare('SELECT s.quantity_milli,v.total_cost_paisa,v.estimated FROM stock_levels s JOIN stock_values v USING(branch_id,product_id) WHERE s.branch_id=? AND s.product_id=?').get(branch,product.id)
const report=(db,ids=[branchId],changes={})=>db.reports.snapshot({branchId:ids[0],dateFrom:day,dateTo:day,section:'transfers',page:1,pageSize:25,...changes},ids)
const list=(db,branch,changes={})=>db.transfers.list({branchId:branch,status:'all',page:1,pageSize:25,...changes})
const counts=db=>Object.fromEntries(['stock_transfers','stock_transfer_items','stock_movements','stock_value_movements','operation_results','audit_events','sales','cash_transactions','customer_ledger','supplier_ledger'].map(table=>[table,Number(db.connection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)]))

test('branch creation is retry-safe, shares catalog at zero stock, grants owner access and creates no finances',t=>{
  const{db,product}=setup(t),request=branchRequest(),before=counts(db),result=db.branches.create(request)
  assert.deepEqual(result,db.branches.create(request));assert.equal(db.branches.list().length,2)
  assert.deepEqual({...stock(db,product,result.branchId)},{quantity_milli:0,total_cost_paisa:0,estimated:0})
  assert.ok(db.connection.prepare('SELECT 1 FROM user_branches WHERE user_id=? AND branch_id=?').get('user-riyaz',result.branchId))
  for(const table of ['sales','cash_transactions','customer_ledger','supplier_ledger'])assert.equal(counts(db)[table],before[table])
  assert.equal(db.getPosBootstrap(result.branchId).products[0].quantityMilli,0)
})
test('new products created after a branch exists appear at every active branch with zero opening stock elsewhere',t=>{
  const{db}=setup(t),destination=db.branches.create(branchRequest()).branchId
  const product=db.saveProduct(branchId,{...productInput,name:'New Product',sku:'NEW-001',barcode:'NEW-001'})
  assert.equal(stock(db,product,destination).quantity_milli,0);assert.equal(stock(db,product,branchId).quantity_milli,10000)
  const quick=db.createPosProduct(destination,{name:'Quick Product',barcode:'QUICK',category:'General',unit:'Piece',purchasePricePaisa:1000,sellingPricePaisa:2000,openingStockMilli:1000})
  assert.equal(stock(db,quick,branchId).quantity_milli,0)
  db.importProductsCsv(destination,'name,sku,category,unit,purchase_price,sale_price,opening_stock\nCSV transfer,CSV-T,General,Piece,10,20,2')
  assert.equal(db.getPosBootstrap(branchId).products.find(p=>p.sku==='CSV-T').quantityMilli,0)
})
test('branch codes are unique case-insensitively, immutable on updates, and invalid requests make no changes',t=>{
  const{db}=setup(t),destination=db.branches.create(branchRequest()).branchId
  assert.throws(()=>db.branches.create(branchRequest({code:'lhr01'})),/already in use/)
  assert.throws(()=>db.branches.create(branchRequest({code:'bad code'})),/code needs/)
  assert.throws(()=>db.branches.create(branchRequest({name:''})),/Branch name/)
  db.branches.update({branchId,operationId:randomUUID(),targetBranchId:destination,name:'Lahore Central',city:'Lahore East',code:'ALTERED'})
  const row=db.branches.list().find(b=>b.id===destination)
  assert.equal(row.name,'Lahore Central');assert.equal(row.code,'LHR01');assert.equal(row.city,'Lahore East')
  assert.equal(db.branches.list().length,2)
})
test('branch creation rolls back catalog, assignments and numbering when audit fails',t=>{
  const{db}=setup(t),before=counts(db)
  db.connection.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'simulated branch audit failure'); END")
  assert.throws(()=>db.branches.create(branchRequest()),/simulated/)
  assert.equal(db.branches.list().length,1);assert.deepEqual(counts(db),before)
})
test('dispatch holds original cost in transit and receipt combines it with destination weighted-average stock',t=>{
  const{db,product}=setup(t),destination=db.branches.create(branchRequest()).branchId
  db.retail.receivePurchase({branchId:destination,operationId:randomUUID(),supplierName:'Destination Supplier',supplierInvoiceNumber:'',businessDate:day,paidAmountPaisa:0,paymentMethod:'Cash',lines:[{productId:product.id,quantityMilli:2000,unitCostPaisa:30000}]})
  const before=counts(db),transfer=dispatch(db,product,destination)
  assert.equal(transfer.status,'dispatched');assert.equal(transfer.totalCostPaisa,20000)
  assert.equal(stock(db,product,branchId).quantity_milli,8000);assert.equal(stock(db,product,destination).quantity_milli,2000)
  assert.equal(list(db,branchId).outboundValuePaisa,20000);assert.equal(list(db,destination).inboundCount,1)
  const all=report(db,[branchId,destination]).summary
  assert.equal(all.valuePaisa,140000);assert.equal(all.inTransitValuePaisa,20000);assert.equal(all.inventoryValuePaisa,160000)
  receive(db,transfer.id,destination)
  assert.deepEqual({...stock(db,product,destination)},{quantity_milli:4000,total_cost_paisa:80000,estimated:0})
  assert.equal(report(db,[branchId,destination]).summary.inventoryValuePaisa,160000)
  assert.equal(report(db,[branchId,destination]).summary.inTransitValuePaisa,0)
  for(const table of ['sales','cash_transactions','customer_ledger','supplier_ledger'])assert.equal(counts(db)[table],before[table])
  assert.equal(report(db).summary.grossProfitPaisa,0)
})
test('dispatch and receive retries never duplicate stock or cost; final transfers cannot receive or cancel again',t=>{
  const{db,product}=setup(t),destination=db.branches.create(branchRequest()).branchId
  const request={branchId,operationId:randomUUID(),destinationBranchId:destination,note:'Retry proof',lines:[{productId:product.id,quantityMilli:2000}]}
  const transfer=db.transfers.dispatch(request);assert.deepEqual(transfer,db.transfers.dispatch(request))
  const receipt={branchId:destination,operationId:randomUUID(),transferId:transfer.id,note:''}
  assert.deepEqual(db.transfers.receive(receipt),db.transfers.receive(receipt))
  assert.equal(stock(db,product,destination).quantity_milli,2000)
  assert.throws(()=>receive(db,transfer.id,destination),/no longer/);assert.throws(()=>cancel(db,transfer.id),/Only a pending/)
})
test('cancellation restores the dispatch cost after later purchases changed the source average',t=>{
  const{db,product}=setup(t),destination=db.branches.create(branchRequest()).branchId,transfer=dispatch(db,product,destination)
  db.retail.receivePurchase({branchId,operationId:randomUUID(),supplierName:'Later Supplier',supplierInvoiceNumber:'',businessDate:day,paidAmountPaisa:0,paymentMethod:'Cash',lines:[{productId:product.id,quantityMilli:2000,unitCostPaisa:50000}]})
  const request={branchId,operationId:randomUUID(),transferId:transfer.id,reason:'Goods physically returned'}
  const result=db.transfers.cancel(request);assert.deepEqual(result,db.transfers.cancel(request))
  assert.equal(stock(db,product,branchId).quantity_milli,12000);assert.equal(stock(db,product,branchId).total_cost_paisa,200000)
  assert.equal(stock(db,product,destination).quantity_milli,0);assert.equal(list(db,branchId).outboundCount,0)
  assert.throws(()=>receive(db,transfer.id,destination),/no longer/)
})
test('fractional transfer quantities preserve every paisa and estimated basis after source depletion',t=>{
  const{db}=setup(t),product=db.saveProduct(branchId,{...productInput,sku:'TINY',barcode:'TINY',purchasePricePaisa:1,openingStockMilli:3000}),destination=db.branches.create(branchRequest()).branchId
  db.retail.adjustStock({branchId,operationId:randomUUID(),productId:product.id,quantityDeltaMilli:1,reason:'Tiny count gain'})
  const a=dispatch(db,product,destination,{lines:[{productId:product.id,quantityMilli:333}]}),b=dispatch(db,product,destination,{lines:[{productId:product.id,quantityMilli:2668}]})
  assert.equal(a.totalCostPaisa+b.totalCostPaisa,3);assert.equal(stock(db,product,branchId).total_cost_paisa,0)
  receive(db,a.id,destination);receive(db,b.id,destination)
  assert.equal(stock(db,product,destination).total_cost_paisa,3);assert.equal(stock(db,product,destination).estimated,1)
})
test('failed dispatch, receipt and cancellation roll back stock, cost, lifecycle, retry records and audits',t=>{
  const{db,product}=setup(t),destination=db.branches.create(branchRequest()).branchId
  const fail=()=>db.connection.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'simulated transfer failure'); END"),clear=()=>db.connection.exec('DROP TRIGGER fail_audit')
  const before=counts(db);fail();assert.throws(()=>dispatch(db,product,destination),/simulated/);assert.deepEqual(counts(db),before);clear()
  const transfer=dispatch(db,product,destination),posted=counts(db);fail()
  assert.throws(()=>receive(db,transfer.id,destination),/simulated/);assert.deepEqual(counts(db),posted)
  assert.equal(stock(db,product,destination).quantity_milli,0);assert.equal(db.transfers.detail(branchId,transfer.id).status,'dispatched')
  assert.throws(()=>cancel(db,transfer.id),/simulated/);assert.deepEqual(counts(db),posted);assert.equal(stock(db,product,branchId).quantity_milli,8000)
})
test('wrong branch, duplicate products, insufficient stock and inactive or foreign references are rejected',t=>{
  const{db,product}=setup(t),destination=db.branches.create(branchRequest()).branchId,before=counts(db)
  db.connection.prepare('INSERT INTO businesses(id,name,created_at) VALUES (?,?,?)').run('foreign-business','Other company',clock().toISOString())
  db.connection.prepare('INSERT INTO branches VALUES (?,?,?,?,?,?,?)').run('foreign-branch','foreign-business','Other','FOREIGN','Other city',1,clock().toISOString())
  assert.throws(()=>dispatch(db,product,'foreign-branch'),/unavailable/)
  assert.throws(()=>db.branches.update({branchId,operationId:randomUUID(),targetBranchId:'foreign-branch',name:'Illegal rename',city:'Karachi'}),/unavailable/)
  for(const change of [{destinationBranchId:branchId},{destinationBranchId:'unknown'},{lines:[{productId:product.id,quantityMilli:11000}]},{lines:[{productId:product.id,quantityMilli:0}]},{lines:[{productId:product.id,quantityMilli:1000},{productId:product.id,quantityMilli:1000}]},{lines:[{productId:'unknown',quantityMilli:1000}]}])assert.throws(()=>dispatch(db,product,destination,change))
  assert.deepEqual(counts(db),before)
  const transfer=dispatch(db,product,destination)
  assert.throws(()=>receive(db,transfer.id,branchId),/Only the destination/)
  assert.throws(()=>cancel(db,transfer.id,{branchId:destination}),/Only the source/)
  const other=db.branches.create(branchRequest({code:'OTHER'})).branchId
  assert.throws(()=>db.transfers.detail(other,transfer.id),/not found/)
  db.connection.exec("UPDATE products SET is_active=0 WHERE sku='TRF-001'")
  assert.throws(()=>dispatch(db,product,destination),/active product/)
  receive(db,transfer.id,destination);assert.equal(stock(db,product,destination).quantity_milli,2000)
})
test('pending transfer lists filter and paginate consistently and report CSV contains current lifecycle',t=>{
  const{db,product}=setup(t),destination=db.branches.create(branchRequest()).branchId
  const a=dispatch(db,product,destination),b=dispatch(db,product,destination);cancel(db,a.id)
  assert.equal(list(db,branchId,{pageSize:1}).total,2);assert.equal(list(db,branchId,{pageSize:1}).records.length,1)
  assert.equal(list(db,destination,{status:'dispatched'}).records[0].id,b.id)
  assert.equal(report(db).table.total,2);assert.match(db.reports.exportCsv({branchId,dateFrom:day,dateTo:day,section:'transfers'}),/cancelled/)
})
test('archiving guards the current branch, stock, pending transfers, open shifts, held carts and every account balance',t=>{
  const{db,product}=setup(t),destination=db.branches.create(branchRequest()).branchId
  assert.throws(()=>archive(db,branchId),/Switch/)
  const transfer=dispatch(db,product,destination);assert.throws(()=>archive(db,destination),/pending transfers/);cancel(db,transfer.id)
  const received=dispatch(db,product,destination);receive(db,received.id,destination)
  assert.throws(()=>archive(db,destination),/Clear branch stock/)
  const back=dispatch(db,product,branchId,{branchId:destination});receive(db,back.id,branchId)
  const shift=db.openPosShift(destination,0);assert.throws(()=>archive(db,destination),/cash shift/)
  db.cash.close({branchId:destination,operationId:randomUUID(),shiftId:shift,countedCashPaisa:0,note:''})
  const customer=db.accounts.createCustomer({branchId:destination,operationId:randomUUID(),name:'Archive Due',phone:'',openingBalancePaisa:1000})
  assert.throws(()=>archive(db,destination),/balances/)
  db.accounts.collect({branchId:destination,operationId:randomUUID(),customerId:customer.customerId,amountPaisa:1000,method:'Card',reference:'SETTLE'})
  db.connection.prepare('INSERT INTO held_sales VALUES (?,?,?,?,?,?,?)').run('archive-held',destination,'customer-walk-in','[]',1,0,clock().toISOString())
  assert.throws(()=>archive(db,destination),/held carts/);db.deleteHeldPosSale('archive-held')
  archive(db,destination);assert.equal(db.branches.list().find(b=>b.id===destination).isActive,false)
  assert.throws(()=>db.getPosBootstrap(destination),/unavailable/)
})
test('reactivation retains history and restores missing catalog links without inventing stock',t=>{
  const{db}=setup(t),destination=db.branches.create(branchRequest()).branchId
  archive(db,destination)
  const product=db.saveProduct(branchId,{...productInput,sku:'AFTER-ARCHIVE',barcode:'AFTER-ARCHIVE'})
  assert.equal(stock(db,product,destination),undefined)
  db.branches.setActive({branchId,operationId:randomUUID(),targetBranchId:destination,isActive:true,reason:'Reopening branch'})
  assert.equal(stock(db,product,destination).quantity_milli,0);assert.equal(db.branches.list().find(b=>b.id===destination).isActive,true)
})
test('transfer receipt and dispatch metadata survive restart and version-nine upgrade preserves existing financial data',t=>{
  const dir=mkdtempSync(join(tmpdir(),'vertexia-branches-')),path=join(dir,'test.db');let db=new VertexiaDatabase(path,clock)
  t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true})})
  const product=db.saveProduct(branchId,productInput)
  db.connection.exec('DROP TABLE stock_transfer_items;DROP TABLE stock_transfers;DROP TABLE transfer_document_sequences;PRAGMA user_version=9')
  db.close();db=new VertexiaDatabase(path,clock)
  assert.equal(stock(db,product,branchId).total_cost_paisa,100000)
  const destination=db.branches.create(branchRequest()).branchId,transfer=dispatch(db,product,destination)
  db.close();db=new VertexiaDatabase(path,clock);assert.equal(db.transfers.detail(branchId,transfer.id).status,'dispatched')
  receive(db,transfer.id,destination);db.close();db=new VertexiaDatabase(path,clock)
  assert.equal(db.transfers.detail(destination,transfer.id).status,'received');assert.equal(stock(db,product,destination).total_cost_paisa,20000)
})
test('owner admin, both dispatch assignments, destination-only receiving and cashier restrictions are enforced',async t=>{
  const{db,product}=setup(t),auth=new AuthRepository(db.connection,clock)
  await auth.setup({businessName:'Branch Test Shop',branchName:'Main',city:'Karachi',ownerName:'Owner',username:'owner',password:'Branch owner passphrase 2026'})
  const destination=db.branches.create(branchRequest()).branchId
  assert.ok(auth.current().branches.some(b=>b.id===destination))
  authorizeIpc(auth,db,'branches:list',[])
  assert.throws(()=>authorizeIpc(auth,db,'branches:set-active',[{branchId:destination,targetBranchId:branchId,isActive:false}]),/Switch/)
  const transfer=dispatch(db,product,destination)
  await auth.createUser({name:'Destination Inventory',username:'receiver',password:'Branch staff passphrase 2026',role:'Inventory',branchIds:[destination]})
  await auth.createUser({name:'Cashier',username:'cashier',password:'Branch staff passphrase 2026',role:'Cashier',branchIds:[branchId]})
  auth.logout();await auth.login('receiver','Branch staff passphrase 2026');await auth.changePassword('Branch staff passphrase 2026','Receiver changed passphrase 2026')
  authorizeIpc(auth,db,'transfers:list',[{branchId:destination}]);authorizeIpc(auth,db,'transfers:receive',[{branchId:destination,transferId:transfer.id}])
  assert.throws(()=>authorizeIpc(auth,db,'transfers:dispatch',[{branchId:destination,destinationBranchId:branchId}]),/access to this branch/)
  assert.throws(()=>authorizeIpc(auth,db,'branches:list',[]),/permission/);assert.throws(()=>authorizeIpc(auth,db,'transfers:cancel',[{branchId:destination}]),/permission/)
  auth.logout();await auth.login('cashier','Branch staff passphrase 2026');await auth.changePassword('Branch staff passphrase 2026','Cashier changed passphrase 2026')
  assert.throws(()=>authorizeIpc(auth,db,'transfers:list',[{branchId}]),/permission/)
})
test('staff branch validation is repeated if a target branch is archived during password hashing',async t=>{
  const{db}=setup(t),auth=new AuthRepository(db.connection,clock)
  await auth.setup({businessName:'Concurrent Shop',branchName:'Main',city:'Karachi',ownerName:'Owner',username:'owner',password:'Concurrent owner passphrase 2026'})
  const destination=db.branches.create(branchRequest()).branchId
  const pending=auth.createUser({name:'New Cashier',username:'new.cashier',password:'Concurrent staff passphrase 2026',role:'Cashier',branchIds:[destination]})
  await new Promise(resolve=>setTimeout(resolve,50));archive(db,destination)
  await assert.rejects(pending,/Invalid business branch/)
  assert.ok(!auth.listUsers().some(u=>u.username==='new.cashier'))
})
test('branch archive cannot strand active staff at their only branch',async t=>{
  const{db}=setup(t),auth=new AuthRepository(db.connection,clock)
  await auth.setup({businessName:'Staff Safe Shop',branchName:'Main',city:'Karachi',ownerName:'Owner',username:'owner',password:'Staff owner passphrase 2026'})
  const destination=db.branches.create(branchRequest()).branchId
  const users=await auth.createUser({name:'Receiver',username:'receiver',password:'Staff receiver passphrase 2026',role:'Inventory',branchIds:[destination]})
  assert.throws(()=>archive(db,destination),/another branch/)
  const staff=users.find(user=>user.username==='receiver')
  auth.updateUser({userId:staff.id,role:'Inventory',isActive:true,branchIds:[branchId,destination]})
  archive(db,destination);assert.equal(db.branches.list().find(b=>b.id===destination).isActive,false)
})
