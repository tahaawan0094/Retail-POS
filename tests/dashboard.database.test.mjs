import assert from 'node:assert/strict'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'

let database

before(() => {
  database = new VertexiaDatabase(':memory:', () => new Date('2026-10-08T12:00:00+05:00'), { seedDemoData:true })
})

after(() => database.close())

const snapshot = (dateRange = 'today', chartPeriod = '7_days') => database.getDashboardSnapshot({
  branchId: 'branch-main',
  dateRange,
  chartPeriod,
})

test('creates the production schema once and seeds a usable store', () => {
  const version = database.connection.prepare('PRAGMA user_version').get().user_version
  const productCount = database.connection.prepare('SELECT COUNT(*) AS count FROM products').get().count
  const foreignKeys = database.connection.prepare('PRAGMA foreign_keys').get().foreign_keys

  assert.equal(version, 5)
  assert.equal(productCount, 12)
  assert.equal(foreignKeys, 1)
})

test('a fresh production database contains no demo transactions', () => {
  const production = new VertexiaDatabase(':memory:', () => new Date('2026-10-08T12:00:00+05:00'))
  const data = production.getDashboardSnapshot({ branchId:'branch-main',dateRange:'today',chartPeriod:'7_days' })

  assert.equal(data.salesPaisa, 0)
  assert.equal(data.profitPaisa, 0)
  assert.equal(data.customerDuePaisa, 0)
  assert.equal(data.supplierDuePaisa, 0)
  assert.equal(data.expensesPaisa, 0)
  assert.equal(data.cashInDrawerPaisa, 0)
  assert.equal(data.lowStockCount, 0)
  assert.deepEqual(data.topProducts, [])
  assert.deepEqual(data.recentSales, [])
  production.close()
})

test('preserves existing records even when a legacy demo marker is present', () => {
  const directory = mkdtempSync(join(tmpdir(),'vertexia-dashboard-'))
  const path = join(directory,'vertexia.db')
  const clock = () => new Date('2026-10-08T12:00:00+05:00')
  const legacy = new VertexiaDatabase(path,clock,{ seedDemoData:true })
  const original = legacy.getDashboardSnapshot({ branchId:'branch-main',dateRange:'today',chartPeriod:'7_days' })
  assert.ok(original.salesPaisa > 0)
  legacy.close()

  const production = new VertexiaDatabase(path,clock)
  const preserved = production.getDashboardSnapshot({ branchId:'branch-main',dateRange:'today',chartPeriod:'7_days' })
  assert.equal(preserved.salesPaisa,original.salesPaisa)
  assert.equal(preserved.lowStockCount,original.lowStockCount)
  assert.equal(production.connection.prepare("SELECT value FROM app_meta WHERE key='demo_seed_removed'").get(),undefined)
  production.close()
  rmSync(directory,{ recursive:true,force:true })
})

test('derives dashboard KPIs from ledger and transaction tables', () => {
  const data = snapshot()
  const sales = database.connection.prepare("SELECT SUM(total_paisa) AS value FROM sales WHERE branch_id='branch-main' AND business_date='2026-10-08' AND status='completed'").get().value
  const profit = database.connection.prepare("SELECT SUM(total_paisa-cost_paisa) AS value FROM sales WHERE branch_id='branch-main' AND business_date='2026-10-08' AND status='completed'").get().value
  const cash = database.connection.prepare("SELECT SUM(CASE WHEN direction='in' THEN amount_paisa ELSE -amount_paisa END) AS value FROM cash_transactions WHERE shift_id='shift-current'").get().value

  assert.equal(data.salesPaisa, sales)
  assert.equal(data.profitPaisa, profit)
  assert.equal(data.customerDuePaisa, 2_500_000)
  assert.equal(data.supplierDuePaisa, 9_200_000)
  assert.equal(data.expensesPaisa, 1_850_000)
  assert.equal(data.cashInDrawerPaisa, cash)
  assert.equal(data.lowStockCount, 4)
  assert.equal(data.unreadNotifications, data.lowStockCount)
})

test('returns complete dashboard lists and switches date ranges', () => {
  const today = snapshot('today', '7_days')
  const yesterday = snapshot('yesterday', '7_days')
  const week = snapshot('this_week', '7_days')

  assert.equal(today.chart.length, 7)
  assert.equal(today.topProducts.length, 5)
  assert.equal(today.lowProducts.length, 4)
  assert.equal(today.recentSales.length, 5)
  assert.equal(today.recentActivity.length, 5)
  assert.notEqual(today.salesPaisa, yesterday.salesPaisa)
  assert.ok(week.salesPaisa >= today.salesPaisa)
})

test('supports intraday, seven-day, and thirty-day chart periods', () => {
  assert.equal(snapshot('today', 'today').chart.length, 7)
  assert.equal(snapshot('today', '7_days').chart.length, 7)
  assert.equal(snapshot('today', '30_days').chart.length, 30)
  assert.ok(snapshot('today', 'today').chart.some(point => point.valuePaisa > 0))
})

test('global search finds products, customers, suppliers, and invoices', () => {
  assert.equal(database.search('Coca', 'branch-main')[0].type, 'Product')
  assert.equal(database.search('Ahmed', 'branch-main')[0].type, 'Customer')
  assert.equal(database.search('ABC', 'branch-main')[0].type, 'Supplier')
  assert.equal(database.search('SAL-20261008', 'branch-main')[0].type, 'Sale')
  assert.deepEqual(database.search('x', 'branch-main'), [])
})

test('database constraints reject invalid monetary data', () => {
  assert.throws(() => {
    database.connection.prepare(`INSERT INTO expenses VALUES ('bad-expense','branch-main','2026-10-08','Invalid','Test',-1,'Cash','2026-10-08T12:00:00+05:00')`).run()
  })
})
