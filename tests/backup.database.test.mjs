import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { DatabaseSync, backup } from 'node:sqlite'
import { mkdtempSync, rmSync, existsSync, writeFileSync, copyFileSync, linkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'
import { AuthRepository } from '../electron-dist/electron/database/auth.mjs'
import { BackupService, inspectBackup, fileChecksum } from '../electron-dist/electron/backup.mjs'

const branchId = 'branch-main', password = 'Backup owner passphrase 2026'
const productInput = { name: 'Backup Rice', sku: 'BACKUP-001', barcode: 'BACKUP-001', category: 'General', subcategory: '', brand: '', unit: 'Kg', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 0, openingStockMilli: 10000, status: 'active', imageDataUrl: null }
async function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), 'vertexia-backup-')), path = join(directory, 'store.db')
  let now = new Date('2026-10-10T12:00:00+05:00'), db = new VertexiaDatabase(path, () => now), auth = new AuthRepository(db.connection)
  await auth.setup({ businessName: 'Recovery Shop', branchName: 'Main', city: 'Karachi', ownerName: 'Owner', username: 'owner', password })
  const ownerId = auth.current().userId
  t.after(() => { if (db.connection.isOpen) db.close(); rmSync(directory, { recursive: true, force: true }) })
  const service = new BackupService(() => db, path, join(directory, 'backups'), () => now)
  let maintenance = false
  const hooks = { authorize: () => assert.equal(auth.require('backup.manage').userId, ownerId), close: () => { auth.logout(); db.close() }, reopen: () => { db = new VertexiaDatabase(path, () => now); auth = new AuthRepository(db.connection) }, setMaintenance: value => { maintenance = value } }
  const request = summary => ({ token: summary.token, confirmation: 'RESTORE', currentPassword: password, backupOwnerUsername: 'owner', backupOwnerPassword: password, allowDifferentInstallation: false })
  return { directory, path, service, hooks, ownerId, request, get db() { return db }, get auth() { return auth }, get maintenance() { return maintenance }, advance: ms => { now = new Date(now.getTime() + ms) } }
}
const copyMutated = (state, record, mutate) => {
  const path = join(state.directory, randomUUID() + '.sqlite'); copyFileSync(record.path, path)
  const db = new DatabaseSync(path)
  try { db.exec('PRAGMA foreign_keys=OFF'); mutate(db) } finally { db.close() }
  return path
}

test('snapshot includes latest committed WAL writes and is standalone, verified and exportable', async t => {
  const state = await setup(t), product = state.db.saveProduct(branchId, productInput)
  assert.equal(state.db.connection.prepare('PRAGMA journal_mode').get().journal_mode, 'wal')
  const record = await state.service.create()
  assert.ok(existsSync(record.path)); assert.equal(inspectBackup(record.path).products, 1)
  assert.equal(await fileChecksum(record.path), record.checksum)
  assert.equal(existsSync(record.path + '-wal'), false)
  const snapshot = new DatabaseSync(record.path, { readOnly: true })
  assert.equal(snapshot.prepare('SELECT id FROM products').get().id, product.id); snapshot.close()
  const destination = join(state.directory, 'external-copy.sqlite')
  await state.service.export(record.id, destination)
  assert.deepEqual(readFileSync(destination), readFileSync(record.path))
  const summary = await state.service.preview(destination, state.ownerId)
  assert.equal(summary.sameInstallation, true); assert.equal(summary.businessName, 'Recovery Shop'); assert.deepEqual(summary.ownerUsernames, ['owner'])
  state.service.cancel(summary.token, state.ownerId)
})

test('restore recovers stock, sales, purchases, closed shift and owner account, retaining latest state in safety copy', async t => {
  const state = await setup(t), product = state.db.saveProduct(branchId, productInput)
  const shiftId = state.db.openPosShift(branchId, 100000)
  const sale = state.db.completePosSale({ branchId, operationId: randomUUID(), customerId: 'customer-walk-in', paymentMethod: 'Cash', cashReceivedPaisa: 15000, lines: [{ productId: product.id, quantityMilli: 1000, discountBasisPoints: 0 }] })
  state.db.retail.receivePurchase({ branchId, operationId: randomUUID(), supplierName: 'Backup Supplier', supplierInvoiceNumber: '', businessDate: '2026-10-10', paidAmountPaisa: 0, paymentMethod: 'Cash', lines: [{ productId: product.id, quantityMilli: 1000, unitCostPaisa: 10000 }] })
  state.db.cash.close({ branchId, operationId: randomUUID(), shiftId, countedCashPaisa: 115000, note: '' })
  const snapshot = await state.service.create(), summary = await state.service.preview(snapshot.path, state.ownerId)
  state.db.retail.adjustStock({ branchId, operationId: randomUUID(), productId: product.id, quantityDeltaMilli: 2000, reason: 'After backup stock' })
  await state.auth.changePassword(password, 'New current owner password 2026')
  await state.auth.verifyForRestore('New current owner password 2026')
  const result = await state.service.restore(state.request(summary), state.ownerId, state.hooks)
  assert.equal(state.maintenance, false); assert.equal(state.auth.current(), null)
  assert.equal(state.db.retail.getSnapshot(branchId).products[0].stockMilli, 10000)
  assert.equal(state.db.getSalesDetail(branchId, sale.saleId).totalPaisa, 15000)
  assert.equal(state.db.cash.snapshot(branchId).shifts[0].countedCashPaisa, 115000)
  assert.equal(state.db.retail.getSnapshot(branchId).purchases.length, 1)
  await state.auth.login('owner', password)
  const safety = new DatabaseSync(result.safetyBackupPath, { readOnly: true })
  assert.equal(safety.prepare('SELECT quantity_milli FROM stock_levels WHERE product_id=?').get(product.id).quantity_milli, 12000); safety.close()
  assert.ok(state.service.status().records.some(record => record.kind === 'before_restore'))
  await assert.rejects(state.service.restore(state.request(summary), state.ownerId, state.hooks), /expired/)
})

test('failure after database replacement restores safety snapshot and releases maintenance gate', async t => {
  const state = await setup(t), product = state.db.saveProduct(branchId, productInput)
  const snapshot = await state.service.create(), summary = await state.service.preview(snapshot.path, state.ownerId)
  state.db.retail.adjustStock({ branchId, operationId: randomUUID(), productId: product.id, quantityDeltaMilli: 2000, reason: 'Must survive failure' })
  await assert.rejects(state.service.restore(state.request(summary), state.ownerId, { ...state.hooks, install: async (source, destination) => { await backup(source, destination); throw new Error('Injected replacement failure') } }), /Injected replacement failure/)
  assert.equal(state.maintenance, false); assert.equal(state.db.retail.getSnapshot(branchId).products[0].stockMilli, 12000)
  assert.deepEqual(state.db.connection.prepare('PRAGMA foreign_key_check').all(), [])
  assert.equal(state.service.status().records.filter(record => record.kind === 'before_restore').length, 1)
  await state.auth.login('owner', password)
})

test('unconfigured, corrupt, mismatched schema, missing owner and broken references are rejected', async t => {
  const state = await setup(t), snapshot = await state.service.create()
  const corrupt = join(state.directory, 'corrupt.sqlite'); writeFileSync(corrupt, 'not a database'.repeat(30))
  await assert.rejects(state.service.preview(corrupt, state.ownerId))
  for (const [mutate, expected] of [
    [db => db.exec('PRAGMA user_version=999'), /version/],
    [db => db.exec('CREATE TRIGGER unexpected AFTER INSERT ON products BEGIN SELECT 1; END'), /structure/],
    [db => db.exec('DELETE FROM user_credentials'), /owner login/],
    [db => db.exec("DELETE FROM app_meta WHERE key='auth_setup_complete'"), /configured/],
    [db => db.exec("UPDATE user_branches SET branch_id='missing-branch'"), /relationships/],
  ]) await assert.rejects(state.service.preview(copyMutated(state, snapshot, mutate), state.ownerId), expected)
  assert.equal(state.service.status().records.length, 1)
  assert.equal(state.auth.current().userId, state.ownerId)
})

test('restore requires matching preview owner, exact confirmation, and valid backup credentials', async t => {
  const state = await setup(t), record = await state.service.create(), summary = await state.service.preview(record.path, state.ownerId)
  await assert.rejects(state.service.restore(state.request(summary), 'another-owner', state.hooks), /expired/)
  await assert.rejects(state.service.restore({ ...state.request(summary), confirmation: 'restore' }, state.ownerId, state.hooks), /Type RESTORE/)
  await assert.rejects(state.service.restore({ ...state.request(summary), backupOwnerPassword: 'wrong password' }, state.ownerId, state.hooks), /incorrect/)
  assert.equal(state.service.status().records.length, 1); assert.equal(state.maintenance, false)
  await assert.rejects(state.auth.verifyForRestore('wrong current password'), /incorrect/)
  assert.equal(await state.auth.verifyForRestore(password), state.ownerId)
  state.advance(10 * 60 * 1000)
  await assert.rejects(state.service.restore(state.request(summary), state.ownerId, state.hooks), /expired/)
})

test('current open shift blocks restore before safety copy or database replacement', async t => {
  const state = await setup(t), record = await state.service.create(), summary = await state.service.preview(record.path, state.ownerId)
  state.db.openPosShift(branchId, 10000)
  await assert.rejects(state.service.restore(state.request(summary), state.ownerId, state.hooks), /Close all current cash shifts/)
  assert.equal(state.db.cash.snapshot(branchId).activeShift.openingCashPaisa, 10000)
  assert.equal(state.service.status().records.length, 1); assert.equal(state.maintenance, false)
})

test('another installation can be recovered only after explicit confirmation', async t => {
  const source = await setup(t), target = await setup(t), record = await source.service.create()
  const summary = await target.service.preview(record.path, target.ownerId)
  assert.equal(summary.sameInstallation, false)
  await assert.rejects(target.service.restore(target.request(summary), target.ownerId, target.hooks), /Confirm/)
  await target.service.restore({ ...target.request(summary), allowDifferentInstallation: true }, target.ownerId, target.hooks)
  await target.auth.login('owner', password)
  assert.equal(target.db.connection.prepare("SELECT value FROM app_meta WHERE key='installation_id'").get().value, source.db.connection.prepare("SELECT value FROM app_meta WHERE key='installation_id'").get().value)
})

test('changing the reviewed staged file prevents restore and changing a saved backup prevents export', async t => {
  const state = await setup(t), record = await state.service.create(), summary = await state.service.preview(record.path, state.ownerId)
  const path = join(state.service.directory, `.restore-${summary.token}.sqlite`)
  const staged = new DatabaseSync(path); staged.exec("UPDATE businesses SET name='Modified after review'"); staged.close()
  await assert.rejects(state.service.restore(state.request(summary), state.ownerId, state.hooks), /reviewed backup changed/)
  writeFileSync(record.path, 'changed')
  await assert.rejects(state.service.export(record.id, join(state.directory, 'copy.sqlite')), /changed after creation/)
  assert.equal(state.auth.current().businessName, 'Recovery Shop')
})

test('export rejects live database, journal files and hard link aliases', async t => {
  const state = await setup(t), record = await state.service.create()
  const alias = join(state.directory, 'live-alias.sqlite'); linkSync(state.path, alias)
  const walAlias = join(state.directory, 'wal-alias.sqlite'); linkSync(state.path + '-wal', walAlias)
  for (const path of [state.path, state.path + '-wal', state.path + '-shm', state.path + '-journal', alias, walAlias, join(state.service.directory, 'copy.sqlite')]) await assert.rejects(state.service.export(record.id, path), /live database|external location/)
  await assert.rejects(state.service.preview(alias, state.ownerId), /live database/)
  assert.equal(state.auth.current().businessName, 'Recovery Shop')
})

test('automatic backups run once per day, survive service restart, and make a new snapshot next day', async t => {
  const state = await setup(t)
  await state.service.automatic(); await state.service.automatic()
  assert.equal(state.service.status().records.filter(record => record.kind === 'automatic').length, 1)
  const restarted = new BackupService(() => state.db, state.path, state.service.directory, () => new Date('2026-10-10T07:00:00Z'))
  await restarted.automatic(); assert.equal(restarted.status().records.length, 1)
  state.advance(24 * 60 * 60 * 1000); await state.service.automatic()
  assert.equal(state.service.status().records.length, 2)
  assert.equal(state.service.status().lastAutomaticError, null)
})

test('concurrent backup operations are refused until the first finishes', async t => {
  const state = await setup(t)
  const first = state.service.create()
  assert.equal(state.service.status().busy, true)
  await assert.rejects(state.service.create(), /already running/)
  await state.service.whenIdle(); await first
  assert.equal(state.service.status().busy, false)
})

test('authorization is rechecked after pending work drains, before the safety copy and replacement', async t => {
  const state = await setup(t), record = await state.service.create(), summary = await state.service.preview(record.path, state.ownerId)
  await assert.rejects(state.service.restore(state.request(summary), state.ownerId, { ...state.hooks, quiesce: async () => { await state.auth.whenIdle(); state.auth.logout() } }), /Session expired/)
  assert.equal(state.maintenance, false)
  assert.equal(state.db.connection.isOpen, true)
  assert.equal(state.service.status().records.length, 1)
  await state.auth.login('owner', password)
})

test('failed installation and failed recovery reopening keep actions locked and identify a usable safety file', async t => {
  const state = await setup(t), record = await state.service.create(), summary = await state.service.preview(record.path, state.ownerId)
  await assert.rejects(state.service.restore(state.request(summary), state.ownerId, { ...state.hooks, install: async () => { throw new Error('Installation failure') }, reopen: () => { throw new Error('Cannot reopen database') } }), /Restore recovery requires support\. Preserve the safety backup:/)
  assert.equal(state.maintenance, true)
  const safety = state.service.status().records.find(record => record.kind === 'before_restore')
  assert.ok(safety); assert.equal(inspectBackup(safety.path).businessName, 'Recovery Shop')
  // The simulated filesystem/reopen failure is removed only by the test harness.
  state.hooks.reopen(); state.hooks.setMaintenance(false)
  await state.auth.login('owner', password)
})

test('milestone-seven backups are validated and upgraded on a private copy while the original stays unchanged', async t => {
  const state = await setup(t), product = state.db.saveProduct(branchId, productInput), record = await state.service.create()
  const legacy = copyMutated(state, record, db => db.exec('DROP TABLE stock_transfer_items;DROP TABLE stock_transfers;DROP TABLE transfer_document_sequences;DROP TABLE stock_value_movements; DROP TABLE sale_item_costs; DROP TABLE stock_values; DROP TABLE expense_reversals; DROP TABLE expense_postings; DROP TABLE customer_receipts; DROP TABLE account_document_sequences; PRAGMA user_version=7'))
  const checksum = await fileChecksum(legacy)
  assert.equal(inspectBackup(legacy).schemaVersion, 7)
  const summary = await state.service.preview(legacy, state.ownerId)
  assert.equal(summary.schemaVersion, 10); assert.equal(await fileChecksum(legacy), checksum)
  await state.service.restore(state.request(summary), state.ownerId, state.hooks)
  await state.auth.login('owner', password)
  assert.equal(state.db.connection.prepare('PRAGMA user_version').get().user_version, 10)
  assert.equal(state.db.retail.getSnapshot(branchId).products[0].id, product.id)
  assert.equal(state.db.accounts.customers({ branchId, search: '', filter: 'all', page: 1, pageSize: 25 }).duePaisa, 0)
})

test('milestone-eight backups upgrade estimated stock while preserving receipts and branch accounts', async t => {
  const state = await setup(t), product = state.db.saveProduct(branchId, productInput)
  state.db.openPosShift(branchId,100000)
  const customer = state.db.accounts.createCustomer({branchId,operationId:randomUUID(),name:'Old backup customer',phone:'',openingBalancePaisa:10000})
  const receipt = state.db.accounts.collect({branchId,operationId:randomUUID(),customerId:customer.customerId,amountPaisa:5000,method:'Cash',reference:''})
  const record=await state.service.create()
  const legacy=copyMutated(state,record,db=>db.exec('DROP TABLE stock_transfer_items;DROP TABLE stock_transfers;DROP TABLE transfer_document_sequences;DROP TABLE stock_value_movements; DROP TABLE sale_item_costs; DROP TABLE stock_values; PRAGMA user_version=8'))
  const checksum=await fileChecksum(legacy),summary=await state.service.preview(legacy,state.ownerId)
  assert.equal(summary.schemaVersion,10);assert.equal(await fileChecksum(legacy),checksum)
  const shift=state.db.cash.snapshot(branchId).activeShift
  state.db.cash.close({branchId,operationId:randomUUID(),shiftId:shift.id,countedCashPaisa:105000,note:''})
  await state.service.restore(state.request(summary),state.ownerId,state.hooks)
  await state.auth.login('owner',password)
  assert.equal(state.db.reports.valuation(branchId).valuePaisa,100000)
  assert.equal(state.db.reports.valuation(branchId).estimatedProducts,1)
  assert.equal(state.db.accounts.receipt(branchId,receipt.id).amountPaisa,5000)
  assert.equal(state.db.retail.getSnapshot(branchId).products[0].id,product.id)
})

test('version-nine backup upgrade preserves recorded valuation without re-estimating existing costs',async t=>{
  const state=await setup(t),product=state.db.saveProduct(branchId,productInput),record=await state.service.create()
  const legacy=copyMutated(state,record,db=>db.exec('DROP TABLE stock_transfer_items; DROP TABLE stock_transfers; DROP TABLE transfer_document_sequences; PRAGMA user_version=9'))
  const checksum=await fileChecksum(legacy),summary=await state.service.preview(legacy,state.ownerId)
  assert.equal(summary.schemaVersion,10);assert.equal(await fileChecksum(legacy),checksum)
  await state.service.restore(state.request(summary),state.ownerId,state.hooks);await state.auth.login('owner',password)
  assert.equal(state.db.reports.valuation(branchId).valuePaisa,100000);assert.equal(state.db.reports.valuation(branchId).estimatedProducts,0)
  assert.equal(state.db.retail.getSnapshot(branchId).products[0].id,product.id)
})

test('backup restore preserves dispatched consignments, branch assignments and original cost before later receipt',async t=>{
  const state=await setup(t),product=state.db.saveProduct(branchId,productInput)
  const destination=state.db.branches.create({branchId,operationId:randomUUID(),name:'Lahore',code:'LHR',city:'Lahore'}).branchId
  const transfer=state.db.transfers.dispatch({branchId,operationId:randomUUID(),destinationBranchId:destination,note:'Before backup',lines:[{productId:product.id,quantityMilli:2000}]})
  const record=await state.service.create(),summary=await state.service.preview(record.path,state.ownerId)
  state.db.transfers.receive({branchId:destination,operationId:randomUUID(),transferId:transfer.id,note:'After backup'})
  await state.service.restore(state.request(summary),state.ownerId,state.hooks);await state.auth.login('owner',password)
  assert.equal(state.db.transfers.detail(destination,transfer.id).status,'dispatched')
  assert.equal(state.db.reports.valuation(destination).valuePaisa,0)
  assert.ok(state.auth.current().branches.some(branch=>branch.id===destination))
  state.db.transfers.receive({branchId:destination,operationId:randomUUID(),transferId:transfer.id,note:'After restore'})
  assert.equal(state.db.reports.valuation(destination).valuePaisa,20000)
})

test('restoring a current backup preserves account receipts, expense corrections, balances and authenticated actors', async t => {
  const state = await setup(t), shiftId = state.db.openPosShift(branchId, 100000)
  const { customerId } = state.db.accounts.createCustomer({ branchId, operationId: randomUUID(), name: 'Backup Customer', phone: '', openingBalancePaisa: 10000 })
  const receipt = state.db.accounts.collect({ branchId, operationId: randomUUID(), customerId, amountPaisa: 5000, method: 'Cash', reference: '' })
  const expense = state.db.accounts.postExpense({ branchId, operationId: randomUUID(), businessDate: '2026-10-10', description: 'Backup expense', category: 'Utilities', amountPaisa: 10000, method: 'Cash', reference: '' })
  state.db.accounts.reverseExpense({ branchId, operationId: randomUUID(), expenseId: expense.expenseId, reason: 'Refunded expense' })
  state.db.cash.close({ branchId, operationId: randomUUID(), shiftId, countedCashPaisa: 105000, note: '' })
  const record = await state.service.create(), summary = await state.service.preview(record.path, state.ownerId)
  state.db.accounts.collect({ branchId, operationId: randomUUID(), customerId, amountPaisa: 5000, method: 'Card', reference: 'AFTER-BACKUP' })
  await state.service.restore(state.request(summary), state.ownerId, state.hooks)
  await state.auth.login('owner', password)
  const account = state.db.accounts.customerDetail(branchId, customerId)
  assert.equal(account.customer.balancePaisa, 5000); assert.equal(account.receipts.length, 1)
  assert.equal(account.receipts[0].id, receipt.id); assert.equal(account.receipts[0].receivedBy, 'Owner')
  const expenses = state.db.accounts.expenses({ branchId, dateFrom: '2026-10-01', dateTo: '2026-10-10', search: '', category: '', method: '', page: 1, pageSize: 25 })
  assert.equal(expenses.records.length, 2); assert.equal(expenses.netPaisa, 0)
  assert.equal(state.db.cash.snapshot(branchId).shifts[0].countedCashPaisa, 105000)
})
