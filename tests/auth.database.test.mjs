import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'
import { AuthRepository } from '../electron-dist/electron/database/auth.mjs'
import { authorizeIpc, scopeOperation } from '../electron-dist/electron/ipc-policy.mjs'

const branchId = 'branch-main'
const ownerPassword = 'Owner test passphrase 2026'
const tempPassword = 'Cashier temp passphrase 2026'
const ownPassword = 'Cashier own passphrase 2026'
const setupInput = { businessName: 'Test Real Shop', branchName: 'Main Counter', city: 'Lahore', ownerName: 'Test Owner', username: 'owner.test', password: ownerPassword }
function installation(t) {
  let now = new Date('2026-10-10T10:00:00Z')
  const db = new VertexiaDatabase(':memory:', () => now)
  const auth = new AuthRepository(db.connection, () => now)
  t.after(() => db.close())
  return { db, auth, advance: ms => { now = new Date(now.getTime() + ms) } }
}
async function initialized(t) { const state = installation(t); await state.auth.setup(setupInput); return state }
async function staff(auth, role = 'Cashier', username = 'cashier.test') {
  const users = await auth.createUser({ name: 'Test ' + role, username, password: tempPassword, role, branchIds: [branchId] })
  return users.find(user => user.username === username)
}
const productInput = { name: 'Secure Test Product', sku: 'SEC-001', barcode: 'SEC-001', category: 'General', subcategory: '', brand: '', unit: 'Piece', purchasePricePaisa: 10000, sellingPricePaisa: 15000, mrpPaisa: 0, minimumStockMilli: 0, openingStockMilli: 10000, status: 'active', imageDataUrl: null }

test('setup replaces placeholder names, stores only salted hashes and cannot be repeated', async t => {
  const { db, auth } = installation(t)
  assert.equal(auth.status().needsSetup, true)
  assert.throws(() => authorizeIpc(auth, db, 'products:list', [{ branchId }]), /Sign in/)
  const session = await auth.setup(setupInput)
  assert.equal(session.name, 'Test Owner')
  assert.equal(session.businessName, 'Test Real Shop')
  assert.equal(session.branches[0].name, 'Main Counter')
  assert.equal(session.branches[0].city, 'Lahore')
  assert.equal(session.mustChangePassword, false)
  const credential = db.connection.prepare('SELECT * FROM user_credentials').get()
  assert.match(credential.password_hash, /^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/)
  assert.ok(!JSON.stringify(credential).includes(ownerPassword))
  assert.ok(!JSON.stringify(auth.status()).includes('password_hash'))
  assert.ok(!JSON.stringify(auth.listUsers()).includes('password_hash'))
  await assert.rejects(auth.setup(setupInput), /already complete/)
  assert.equal(auth.listUsers().filter(user => user.hasLogin).length, 1)
})

test('setup preserves existing sales, inventory, outstanding balances and original IDs', async t => {
  const db = new VertexiaDatabase(':memory:', undefined, { seedDemoData: true })
  t.after(() => db.close())
  const before = Object.fromEntries(['sales', 'sale_items', 'stock_levels', 'customer_ledger', 'supplier_ledger', 'cash_transactions'].map(table => [table, db.connection.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]))
  await new AuthRepository(db.connection).setup(setupInput)
  for (const [table, rows] of Object.entries(before)) assert.deepEqual(db.connection.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(), rows)
  assert.deepEqual(db.connection.prepare('PRAGMA foreign_key_check').all(), [])
})

test('temporary password must change before any operational IPC, then cashier permissions apply', async t => {
  const { db, auth } = await initialized(t)
  await staff(auth)
  auth.logout()
  const session = await auth.login('CASHIER.TEST', tempPassword)
  assert.equal(session.mustChangePassword, true)
  assert.throws(() => authorizeIpc(auth, db, 'pos:get-bootstrap', [branchId]), /temporary password/)
  await assert.rejects(auth.changePassword('wrong password', ownPassword), /incorrect/)
  await auth.changePassword(tempPassword, ownPassword)
  authorizeIpc(auth, db, 'pos:get-bootstrap', [branchId])
  authorizeIpc(auth, db, 'pos:complete-sale', [{ branchId, lines: [{ discountBasisPoints: 0 }] }])
  for (const [channel, args] of [
    ['retail:adjust-stock', [{ branchId }]], ['retail:pay-supplier', [{ branchId }]], ['retail:get-snapshot', [branchId]],
    ['sales:create-return', [{ branchId }]], ['products:save', [branchId]], ['auth:list-users', []], ['dashboard:get-snapshot', [{ branchId }]], ['products:export-csv', [branchId]],
  ]) assert.throws(() => authorizeIpc(auth, db, channel, args), /permission/)
  assert.throws(() => authorizeIpc(auth, db, 'pos:complete-sale', [{ branchId, lines: [{ discountBasisPoints: 500 }] }]), /permission/)
  assert.throws(() => authorizeIpc(auth, db, 'pos:hold-sale', [branchId, 'customer-walk-in', [{ discountBasisPoints: 500 }]]), /permission/)
  auth.logout()
  await assert.rejects(auth.login('cashier.test', tempPassword), /Invalid/)
  await auth.login('cashier.test', ownPassword)
})

test('cashier sale and audit use authenticated actor instead of the former fixed owner', async t => {
  const { db, auth } = await initialized(t)
  const cashier = await staff(auth)
  const product = db.saveProduct(branchId, productInput)
  auth.logout(); await auth.login('cashier.test', tempPassword); await auth.changePassword(tempPassword, ownPassword)
  authorizeIpc(auth, db, 'pos:open-shift', [branchId, 100000])
  db.openPosShift(branchId, 100000)
  const request = { branchId, operationId: 'cashier-sale', customerId: 'customer-walk-in', lines: [{ productId: product.id, quantityMilli: 1000, discountBasisPoints: 0 }], paymentMethod: 'Cash', cashReceivedPaisa: 15000 }
  authorizeIpc(auth, db, 'pos:complete-sale', [request])
  scopeOperation('pos:complete-sale', [request], cashier.id)
  const sale = db.completePosSale(request)
  assert.equal(db.connection.prepare('SELECT cashier_id FROM sales WHERE id=?').get(sale.saleId).cashier_id, cashier.id)
  assert.equal(db.connection.prepare("SELECT user_id FROM audit_events WHERE entity_id=? AND event_type='Sale'").get(sale.saleId).user_id, cashier.id)
  assert.equal(db.getPosBootstrap(branchId).userName, 'Test Cashier')
})

test('inventory can receive unpaid stock, but cannot attach payments or make supplier payments', async t => {
  const { db, auth } = await initialized(t)
  await staff(auth, 'Inventory', 'inventory.test')
  auth.logout(); await auth.login('inventory.test', tempPassword); await auth.changePassword(tempPassword, ownPassword)
  authorizeIpc(auth, db, 'retail:receive-purchase', [{ branchId, paidAmountPaisa: 0 }])
  authorizeIpc(auth, db, 'retail:adjust-stock', [{ branchId }])
  assert.throws(() => authorizeIpc(auth, db, 'retail:receive-purchase', [{ branchId, paidAmountPaisa: 100 }]), /permission/)
  assert.throws(() => authorizeIpc(auth, db, 'retail:pay-supplier', [{ branchId }]), /permission/)
  assert.throws(() => authorizeIpc(auth, db, 'pos:get-bootstrap', [branchId]), /permission/)
})

test('assigned branches are enforced for IDs, queries, held carts and unknown IPC channels', async t => {
  const { db, auth } = await initialized(t)
  db.connection.prepare('INSERT INTO branches VALUES (?,?,?,?,?,?,?)').run('branch-other', db.businessId, 'Other branch', 'OTHER', 'Lahore', 1, '2026-10-10')
  for (const [channel, args] of [['products:list', [{ branchId: 'branch-other' }]], ['pos:get-bootstrap', ['branch-other']], ['dashboard:search', ['product', 'branch-other']]]) assert.throws(() => authorizeIpc(auth, db, channel, args), /access to this branch/)
  db.connection.prepare('INSERT INTO held_sales VALUES (?,?,?,?,?,?,?)').run('held-other', 'branch-other', 'customer-walk-in', '[]', 1, 0, '2026-10-10')
  assert.throws(() => authorizeIpc(auth, db, 'pos:resume-held-sale', ['held-other']), /access to this branch/)
  assert.throws(() => authorizeIpc(auth, db, 'pos:delete-held-sale', ['held-other']), /access to this branch/)
  assert.throws(() => auth.selectBranch('branch-other'), /access/)
  assert.throws(() => authorizeIpc(auth, db, 'internal:sql', []), /Unsupported/)
})

test('username uniqueness, roles, password bounds and branches are validated before staff creation', async t => {
  const { db, auth } = await initialized(t)
  const input = { name: 'Staff', username: 'staff.test', password: tempPassword, role: 'Cashier', branchIds: [branchId] }
  for (const changes of [{ role: '__proto__' }, { password: 'short' }, { username: 'bad name' }, { branchIds: [] }, { branchIds: ['branch-invalid'] }, { branchIds: [branchId, branchId] }]) await assert.rejects(auth.createUser({ ...input, ...changes }))
  await auth.createUser(input)
  await assert.rejects(auth.createUser({ ...input, username: 'STAFF.TEST' }), /already in use/)
  const hash1 = db.connection.prepare('SELECT password_hash FROM user_credentials WHERE username=?').get('staff.test').password_hash
  await auth.createUser({ ...input, username: 'staff.second' })
  const hash2 = db.connection.prepare('SELECT password_hash FROM user_credentials WHERE username=?').get('staff.second').password_hash
  assert.notEqual(hash1, hash2)
})

test('disable, role changes and owner resets immediately revoke a live session on another terminal', async t => {
  const { db, auth } = await initialized(t)
  const user = await staff(auth)
  const terminal = new AuthRepository(db.connection)
  await terminal.login('cashier.test', tempPassword); await terminal.changePassword(tempPassword, ownPassword)
  auth.updateUser({ userId: user.id, role: 'Manager', isActive: true, branchIds: [branchId] })
  assert.equal(terminal.current(), null)
  await terminal.login('cashier.test', ownPassword)
  auth.updateUser({ userId: user.id, role: 'Manager', isActive: false, branchIds: [branchId] })
  assert.equal(terminal.current(), null)
  await assert.rejects(terminal.login('cashier.test', ownPassword), /Invalid/)
  auth.updateUser({ userId: user.id, role: 'Cashier', isActive: true, branchIds: [branchId] })
  await terminal.login('cashier.test', ownPassword)
  await auth.resetPassword(user.id, 'New temporary passphrase 2026')
  assert.equal(terminal.current(), null)
  await assert.rejects(terminal.login('cashier.test', ownPassword), /Invalid/)
  assert.equal((await terminal.login('cashier.test', 'New temporary passphrase 2026')).mustChangePassword, true)
})

test('owners cannot revoke their own access and credentialless legacy records cannot be activated', async t => {
  const { auth } = await initialized(t)
  const owner = auth.current()
  assert.throws(() => auth.updateUser({ userId: owner.userId, role: 'Cashier', isActive: false, branchIds: [branchId] }), /another owner/)
  await assert.rejects(auth.resetPassword(owner.userId, ownPassword), /Change Password/)
  const legacy = auth.listUsers().find(user => !user.hasLogin)
  assert.throws(() => auth.updateUser({ userId: legacy.id, role: 'Cashier', isActive: true, branchIds: [branchId] }), /no login/)
})

test('failed attempts lock accounts and the installation throttle survives reopening auth', async t => {
  const { db, auth, advance } = await initialized(t)
  auth.logout()
  for (let i = 0; i < 5; i++) await assert.rejects(auth.login('owner.test', 'wrong password'), /Invalid/)
  await assert.rejects(auth.login('owner.test', ownerPassword), /15 minutes/)
  const restarted = new AuthRepository(db.connection, () => new Date('2026-10-10T10:00:00Z'))
  await assert.rejects(restarted.login('owner.test', ownerPassword), /15 minutes/)
  advance(15 * 60 * 1000 + 1)
  await auth.login('owner.test', ownerPassword)
  auth.logout()
  for (let i = 0; i < 20; i++) await assert.rejects(auth.login('unknown.user' + i, 'wrong password'), /Invalid/)
  await assert.rejects(auth.login('owner.test', ownerPassword), /15 minutes/)
})

test('idle expiry, absolute expiry, logout and app restart do not leave durable sessions', async t => {
  const { db, auth, advance } = await initialized(t)
  advance(30 * 60 * 1000)
  assert.equal(auth.current(), null)
  assert.throws(() => auth.require('pos.sell'), /Sign in/)
  await auth.login('owner.test', ownerPassword)
  for (let i = 0; i < 47; i++) { advance(15 * 60 * 1000); auth.require('pos.sell') }
  advance(15 * 60 * 1000)
  assert.equal(auth.current(), null)
  await auth.login('owner.test', ownerPassword)
  assert.equal(new AuthRepository(db.connection).current(), null)
  auth.logout(); assert.equal(auth.current(), null)
})

test('logout during password verification cancels pending login', async t => {
  const { auth } = await initialized(t)
  auth.logout()
  const pending = auth.login('owner.test', ownerPassword)
  await new Promise(resolve => setTimeout(resolve, 20))
  auth.logout()
  await assert.rejects(pending, /cancelled/)
  assert.equal(auth.current(), null)
  const fresh = installation(t)
  const pendingSetup = fresh.auth.setup(setupInput)
  await new Promise(resolve => setTimeout(resolve, 20))
  fresh.auth.logout()
  await assert.rejects(pendingSetup, /cancelled/)
  assert.equal(fresh.auth.status().needsSetup, true)
  assert.equal(fresh.auth.current(), null)
})

test('retry IDs remain stable for one user and differ between users', () => {
  const make = () => [{ operationId: 'same-client-retry', branchId }]
  const first = make(), retry = make(), other = make()
  scopeOperation('pos:complete-sale', first, 'user-one')
  scopeOperation('pos:complete-sale', retry, 'user-one')
  scopeOperation('pos:complete-sale', other, 'user-two')
  assert.equal(first[0].operationId, retry[0].operationId)
  assert.notEqual(first[0].operationId, other[0].operationId)
  assert.throws(() => scopeOperation('pos:complete-sale', [{ operationId: 'x'.repeat(101) }], 'user-one'), /identifier/)
})

test('credentials persist across SQLite restart, sessions do not, password changes invalidate the old password', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'vertexia-auth-test-'))
  let db = new VertexiaDatabase(join(directory, 'test.db'))
  t.after(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })
  let auth = new AuthRepository(db.connection)
  await auth.setup(setupInput)
  await auth.changePassword(ownerPassword, 'Changed owner passphrase 2026')
  db.close(); db = new VertexiaDatabase(join(directory, 'test.db')); auth = new AuthRepository(db.connection)
  assert.equal(auth.status().needsSetup, false)
  assert.equal(auth.current(), null)
  await assert.rejects(auth.login('owner.test', ownerPassword), /Invalid/)
  assert.equal((await auth.login('owner.test', 'Changed owner passphrase 2026')).name, 'Test Owner')
})
