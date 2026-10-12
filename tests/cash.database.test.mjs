import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'
import { AuthRepository } from '../electron-dist/electron/database/auth.mjs'
import { authorizeIpc } from '../electron-dist/electron/ipc-policy.mjs'

const branchId = 'branch-main'
const clock = () => new Date('2026-10-10T12:00:00+05:00')
const productInput = { name: 'Cash Test Rice', sku: 'CASH-001', barcode: 'CASH-001', category: 'General', subcategory: '', brand: '', unit: 'Kg', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 0, openingStockMilli: 10000, status: 'active', imageDataUrl: null }
function setup(t, opening = 100000, now = clock) {
  const db = new VertexiaDatabase(':memory:', now)
  t.after(() => db.close())
  const shiftId = db.openPosShift(branchId, opening, randomUUID())
  const close = changes => db.cash.close({ branchId, operationId: randomUUID(), shiftId, countedCashPaisa: db.cash.expected(shiftId), note: '', ...changes })
  const move = changes => db.cash.move({ branchId, operationId: randomUUID(), shiftId, direction: 'out', amountPaisa: 1000, reason: 'Bank deposit', ...changes })
  return { db, shiftId, close, move }
}
const counts = db => ['cash_shifts','cash_transactions','cash_shift_closings','cash_movement_notes','audit_events','operation_results'].map(table => db.connection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)

test('drawer follows cash sales, refunds, supplier payments and transfers, excluding card sales', t => {
  const { db, shiftId, move, close } = setup(t, 200000)
  const product = db.saveProduct(branchId, productInput)
  const sale = method => db.completePosSale({ branchId, operationId: randomUUID(), customerId: 'customer-walk-in', paymentMethod: method, cashReceivedPaisa: method === 'Cash' ? 20000 : 0, lines: [{ productId: product.id, quantityMilli: 1000, discountBasisPoints: 0 }] })
  const cashSale = sale('Cash'); sale('Card')
  assert.equal(db.cash.expected(shiftId), 215000)
  const item = db.getSalesDetail(branchId, cashSale.saleId).lines[0]
  db.createSalesReturn({ branchId, operationId: randomUUID(), saleId: cashSale.saleId, reason: 'Damaged package', lines: [{ saleItemId: item.id, quantityMilli: 1000 }] })
  const purchase = db.retail.receivePurchase({ branchId, operationId: randomUUID(), supplierName: 'Cash Supplier', supplierInvoiceNumber: '', businessDate: '2026-10-10', paidAmountPaisa: 0, paymentMethod: 'Cash', lines: [{ productId: product.id, quantityMilli: 1000, unitCostPaisa: 10000 }] })
  db.retail.paySupplier({ branchId, operationId: randomUUID(), supplierId: purchase.supplierId, amountPaisa: 10000, method: 'Cash', reference: 'Paid from drawer' })
  move({ amountPaisa: 20000 }); move({ direction: 'in', amountPaisa: 5000 })
  assert.equal(db.cash.expected(shiftId), 175000)
  assert.equal(db.getDashboardSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' }).cashInDrawerPaisa, 175000)
  const closed = close({ countedCashPaisa: 174000, note: 'Short by ten rupees' })
  assert.equal(closed.expectedCashPaisa, 175000); assert.equal(closed.variancePaisa, -1000)
  assert.equal(closed.status, 'closed'); assert.ok(closed.closedByName)
  assert.equal(db.cash.snapshot(branchId).activeShift, null)
  assert.equal(db.getDashboardSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' }).cashInDrawerPaisa, 0)
})

test('nonzero shortage/excess requires a reason and invalid closings change nothing', t => {
  const { db, close } = setup(t)
  const before = counts(db)
  assert.throws(() => close({ countedCashPaisa: 99999 }), /Explain/)
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) assert.throws(() => close({ countedCashPaisa: value }), /safe integer/)
  assert.deepEqual(counts(db), before)
  const result = close({ countedCashPaisa: 100001, note: 'Extra one paisa' })
  assert.equal(result.variancePaisa, 1)
  assert.throws(() => close(), /already closed/)
})

test('failed audit rolls back cash movement and shift closing together with retry record', t => {
  const { db, move, close } = setup(t)
  db.connection.exec("CREATE TRIGGER fail_cash_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'Audit write failed'); END")
  const before = counts(db)
  assert.throws(() => move(), /Audit write failed/)
  assert.throws(() => close(), /Audit write failed/)
  assert.deepEqual(counts(db), before)
  assert.equal(db.cash.snapshot(branchId).activeShift.status, 'open')
  db.connection.exec('DROP TRIGGER fail_cash_audit')
  close()
})

test('open, cash movement and closing retries survive restart without duplicate records', t => {
  const dir = mkdtempSync(join(tmpdir(), 'vertexia-cash-')), path = join(dir, 'store.db')
  let db = new VertexiaDatabase(path, clock)
  t.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })
  const openId = randomUUID(), shiftId = db.openPosShift(branchId, 10000, openId)
  assert.equal(db.openPosShift(branchId, 10000, openId), shiftId)
  const move = { branchId, operationId: randomUUID(), shiftId, direction: 'in', amountPaisa: 1000, reason: 'Extra float' }
  const movement = db.cash.move(move)
  const close = { branchId, operationId: randomUUID(), shiftId, countedCashPaisa: 11000, note: '' }
  const result = db.cash.close(close), before = counts(db)
  db.close(); db = new VertexiaDatabase(path, clock)
  assert.deepEqual(db.cash.close(close), result); assert.deepEqual(db.cash.move(move), movement)
  assert.equal(db.openPosShift(branchId, 10000, openId), shiftId)
  assert.deepEqual(counts(db), before)
  assert.throws(() => db.cash.close({ ...close, countedCashPaisa: 1 }), /different request/)
})

test('closed shifts reject new cash movement and new opening is not added to previous drawers', t => {
  const { db, move, close } = setup(t)
  close()
  assert.throws(() => move(), /already closed/)
  const next = db.openPosShift(branchId, 5000)
  assert.equal(db.cash.expected(next), 5000)
  assert.equal(db.getDashboardSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' }).cashInDrawerPaisa, 5000)
  assert.equal(db.cash.snapshot(branchId).shifts[1].countedCashPaisa, 100000)
  assert.throws(() => db.openPosShift(branchId, 0), /already open/)
})

test('drawer keeps previous date cash until shift is closed', t => {
  let now = new Date('2026-10-09T23:55:00+05:00')
  const { db, shiftId, move } = setup(t, 100000, () => now)
  move({ direction: 'in', amountPaisa: 15000 })
  now = clock(); move({ amountPaisa: 5000 })
  assert.equal(db.cash.expected(shiftId), 110000)
  assert.equal(db.getDashboardSnapshot({ branchId, dateRange: 'today', chartPeriod: 'today' }).cashInDrawerPaisa, 110000)
})

test('withdrawals cannot exceed expected drawer and overflow is rejected atomically', t => {
  const { db, move } = setup(t, 100)
  const before = counts(db)
  assert.throws(() => move({ amountPaisa: 101 }), /safe integer/)
  assert.throws(() => move({ direction: 'in', amountPaisa: Number.MAX_SAFE_INTEGER }), /safe integer/)
  assert.throws(() => move({ amountPaisa: 0 }), /safe integer/)
  assert.throws(() => move({ reason: 'x' }), /reason/)
  assert.deepEqual(counts(db), before)
  move({ amountPaisa: 100 })
  assert.equal(db.cash.snapshot(branchId).activeShift.expectedCashPaisa, 0)
})

test('cashier cannot close another cashier shift, sell into it, move cash or manage backups', async t => {
  const { db, shiftId } = setup(t)
  const auth = new AuthRepository(db.connection)
  await auth.setup({ businessName: 'Cash Shop', branchName: 'Main', city: 'Karachi', ownerName: 'Owner', username: 'owner', password: 'Owner cash password 2026' })
  await auth.createUser({ name: 'Cashier', username: 'cashier', password: 'Cashier temp password 2026', role: 'Cashier', branchIds: [branchId] })
  auth.logout(); await auth.login('cashier', 'Cashier temp password 2026'); await auth.changePassword('Cashier temp password 2026', 'Cashier own password 2026')
  assert.throws(() => authorizeIpc(auth, db, 'cash:close-shift', [{ branchId, shiftId }]), /own cash shift/)
  assert.throws(() => authorizeIpc(auth, db, 'pos:complete-sale', [{ branchId, lines: [] }]), /Another cashier/)
  for (const channel of ['backup:get-status', 'backup:create', 'backup:export', 'backup:preview', 'backup:cancel', 'backup:restore']) assert.throws(() => authorizeIpc(auth, db, channel, []), /permission/)
  assert.throws(() => authorizeIpc(auth, db, 'cash:move', [{ branchId }]), /permission/)
  assert.equal(db.cash.snapshot(branchId, auth.current().userId).activeShift, null)
  auth.logout(); await auth.login('owner', 'Owner cash password 2026')
  authorizeIpc(auth, db, 'cash:close-shift', [{ branchId, shiftId }])
  db.cash.close({ branchId, shiftId, countedCashPaisa: 100000, operationId: randomUUID(), note: '' })
  auth.logout(); await auth.login('cashier', 'Cashier own password 2026')
  authorizeIpc(auth, db, 'pos:open-shift', [branchId, 0])
  const ownShift = db.openPosShift(branchId, 0)
  authorizeIpc(auth, db, 'cash:close-shift', [{ branchId, shiftId: ownShift }])
  assert.equal(db.cash.snapshot(branchId, auth.current().userId).shifts.length, 1)
})
