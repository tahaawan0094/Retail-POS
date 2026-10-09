import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type {
  DashboardActivityRow,
  DashboardChartPeriod,
  DashboardChartPoint,
  DashboardDateRange,
  DashboardQuery,
  DashboardSaleRow,
  DashboardSnapshot,
  GlobalSearchResult,
  PosBootstrap,
  PosCartLineInput,
  PosCompleteSaleRequest,
  PosCompletedSale,
  PosCreateCustomerInput,
  PosCreateProductInput,
  PosCustomer,
  PosHeldSale,
  PosProduct,
  ProductCatalogQuery,
  ProductCatalogRecord,
  ProductCatalogResult,
  ProductSaveInput,
  SalesDetail,
  SalesListQuery,
  SalesListRow,
  SalesReturnRequest,
  SalesSnapshot,
} from '../../src/types/desktop-api.js'
import { migrations } from './schema.mjs'

type SqlRow = Record<string, string | number | null>

const BUSINESS_ID = 'business-noor-mart'
const BRANCH_ID = 'branch-main'
const OWNER_ID = 'user-riyaz'
const CASHIER_ID = 'user-ali'

function businessDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function addDays(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + amount, 12))
  return value.toISOString().slice(0, 10)
}

function startOfWeek(date: string) {
  const value = new Date(`${date}T12:00:00Z`)
  const weekday = value.getUTCDay() || 7
  return addDays(date, 1 - weekday)
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function labelDate(date: string) {
  return new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

function parseCsv(text: string) {
  const rows:string[][]=[]
  let row:string[]=[]
  let value=''
  let quoted=false
  for(let index=0;index<text.length;index+=1) {
    const character=text[index]
    if(character==='"') {
      if(quoted && text[index+1]==='"') { value+='"';index+=1 }
      else quoted=!quoted
    } else if(character===',' && !quoted) { row.push(value.trim());value='' }
    else if((character==='\n'||character==='\r') && !quoted) {
      if(character==='\r'&&text[index+1]==='\n') index+=1
      row.push(value.trim());value=''
      if(row.some(cell => cell.length)) rows.push(row)
      row=[]
    } else value+=character
  }
  row.push(value.trim())
  if(row.some(cell => cell.length)) rows.push(row)
  return rows
}

function csvCell(value: unknown) {
  const text=String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text
}

function scalarValue(db:DatabaseSync,sql:string,...params:(string|number)[]) {
  return Number((db.prepare(sql).get(...params) as SqlRow|undefined)?.value??0)
}

function runMigrations(db: DatabaseSync) {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;')
  const current = Number((db.prepare('PRAGMA user_version').get() as SqlRow).user_version ?? 0)
  for (const migration of migrations) {
    if (migration.version <= current) continue
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(migration.sql)
      db.exec(`PRAGMA user_version = ${migration.version}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}

function removeLegacyDemoSeed(db: DatabaseSync) {
  const demoSeed = db.prepare("SELECT value FROM app_meta WHERE key='seeded_business_date'").get()
  if (!demoSeed) return

  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec(`
      DELETE FROM audit_events;
      DELETE FROM cash_transactions;
      DELETE FROM cash_shifts;
      DELETE FROM expenses;
      DELETE FROM supplier_ledger;
      DELETE FROM customer_ledger;
      DELETE FROM sale_payments;
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM stock_movements;
      DELETE FROM stock_levels;
      DELETE FROM products;
      DELETE FROM suppliers;
      DELETE FROM customers WHERE is_walk_in = 0;
      DELETE FROM app_meta WHERE key = 'seeded_business_date';
      INSERT OR REPLACE INTO app_meta(key,value) VALUES ('demo_seed_removed','1');
    `)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function seedDatabase(db: DatabaseSync, now: Date, includeDemoData: boolean) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM businesses').get() as SqlRow
  if (Number(existing.count) > 0) return

  const today = businessDate(now)
  const createdAt = `${today}T08:00:00+05:00`
  const products = [
    ['product-1','CC1500','8964001234567','Coca Cola 1.5L','Beverages','Coca Cola','Piece','cola',17000,20000,10000,48000],
    ['product-2','LS001','8964006543210','Lays Masala','Snacks','Lays','Piece','lays',8000,10000,5000,25000],
    ['product-3','NM001','8964008765432','Nestle Milk 1L','Dairy','Nestle','Piece','milk',18000,22000,10000,52000],
    ['product-4','SE001','8964001122223','Surf Excel 1kg','Household','Surf Excel','Piece','surf',32000,45000,5000,3000],
    ['product-5','SB001','8964003344445','Shan Biryani Masala','Grocery','Shan','Piece','shan',12000,18000,10000,25000],
    ['product-6','DO005','8964005566778','Dalda Cooking Oil 5L','Grocery','Dalda','Liter','oil',145000,195000,10000,8000],
    ['product-7','CT001','8964007788990','Colgate Toothpaste','Personal Care','Colgate','Piece','colgate',9000,12000,10000,40000],
    ['product-8','HS001','80065A8997765','Head & Shoulders 400ml','Personal Care','Head & Shoulders','Piece','shampoo',55000,65000,5000,2000],
    ['product-9','LX001','8964002233445','Lux Soap','Personal Care','Lux','Piece','lux',6000,9000,10000,30000],
    ['product-10','TD001','8964006677889','Tide Detergent 1kg','Household','Tide','Piece','tide',32000,42000,5000,6000],
    ['product-11','EG001','8964009988776','Egg Tray','Grocery','Local','Tray','eggs',25000,28000,10000,15000],
    ['product-12','BN001',null,'Bananas (kg)','Fruits & Vegetables','Local','Kg','bananas',14000,18000,5000,5000],
  ] as const
  const customers = [
    ['customer-walk-in','Walk-in Customer',null,1],
    ['customer-ahmed','Ahmed Khan','0301 2345678',0],
    ['customer-fatima','Fatima Noor','0315 6677880',0],
    ['customer-zara','Zara Ali','0305 1122334',0],
  ] as const
  const suppliers = [
    ['supplier-abc','ABC Distributors','0301 1112233'],
    ['supplier-karachi','Karachi Beverages','0321 4455667'],
  ] as const

  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT INTO businesses VALUES (?, ?, ?, ?, ?)').run(BUSINESS_ID, 'Noor Mart', 'PKR', 'Asia/Karachi', createdAt)
    db.prepare('INSERT INTO branches VALUES (?, ?, ?, ?, ?, ?, ?)').run(BRANCH_ID, BUSINESS_ID, 'Noor Mart', 'MAIN', 'Karachi', 1, createdAt)
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(OWNER_ID, BUSINESS_ID, 'Riyaz Ahmed', 'Owner', 1, createdAt)
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(CASHIER_ID, BUSINESS_ID, 'Ali Raza', 'Cashier', 1, createdAt)

    if (!includeDemoData) {
      db.prepare('INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?)').run('customer-walk-in', BUSINESS_ID, 'Walk-in Customer', null, 1, 1, createdAt)
      db.prepare('INSERT INTO app_meta VALUES (?, ?)').run('initialized_business_date', today)
      db.exec('COMMIT')
      return
    }

    const insertProduct = db.prepare('INSERT INTO products(id,business_id,sku,barcode,name,category,brand,unit,visual_kind,purchase_price_paisa,selling_price_paisa,minimum_stock_milli,is_active,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertStock = db.prepare('INSERT INTO stock_levels VALUES (?, ?, ?, ?)')
    const insertMovement = db.prepare('INSERT INTO stock_movements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const product of products) {
      const [id,sku,barcode,name,category,brand,unit,kind,purchase,selling,minimum,stock] = product
      insertProduct.run(id, BUSINESS_ID, sku, barcode, name, category, brand, unit, kind, purchase, selling, minimum, 1, createdAt, createdAt)
      insertStock.run(BRANCH_ID, id, stock, createdAt)
      insertMovement.run(`opening-${id}`, BRANCH_ID, id, 'opening_stock', stock, stock, 'opening_stock', id, 'Initial store stock', createdAt)
    }

    const insertCustomer = db.prepare('INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const customer of customers) insertCustomer.run(customer[0], BUSINESS_ID, customer[1], customer[2], customer[3], 1, createdAt)
    const insertSupplier = db.prepare('INSERT INTO suppliers VALUES (?, ?, ?, ?, ?, ?)')
    for (const supplier of suppliers) insertSupplier.run(supplier[0], BUSINESS_ID, supplier[1], supplier[2], 1, createdAt)

    db.prepare('INSERT INTO customer_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('customer-opening-ahmed', BRANCH_ID, 'customer-ahmed', 'opening_balance', 12500000, 0, 'opening-balance', createdAt)
    db.prepare('INSERT INTO customer_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('customer-payment-ahmed', BRANCH_ID, 'customer-ahmed', 'payment', 0, 10000000, 'opening-payment', createdAt)
    db.prepare('INSERT INTO supplier_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('supplier-opening-abc', BRANCH_ID, 'supplier-abc', 'opening_balance', 15080000, 0, 'opening-balance', createdAt)
    db.prepare('INSERT INTO supplier_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('supplier-payment-abc', BRANCH_ID, 'supplier-abc', 'payment', 0, 5880000, 'opening-payment', createdAt)

    const insertSale = db.prepare('INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertItem = db.prepare('INSERT INTO sale_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertPayment = db.prepare('INSERT INTO sale_payments VALUES (?, ?, ?, ?)')
    const insertAudit = db.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const saleMethods = ['Cash','Card','Easypaisa','JazzCash','Udhaar']
    let saleCounter = 1
    for (let offset = 30; offset >= 0; offset -= 1) {
      const date = addDays(today, -offset)
      const count = offset === 0 ? 5 : 2 + (offset % 3)
      for (let index = 0; index < count; index += 1) {
        const first = products[(offset + index) % products.length]
        const second = products[(offset + index + 3) % products.length]
        const firstQty = 1 + ((offset + index) % 3)
        const secondQty = 1 + ((offset + index) % 2)
        const subtotal = first[9] * firstQty + second[9] * secondQty
        const cost = first[8] * firstQty + second[8] * secondQty
        const discount = index % 4 === 0 ? Math.round(subtotal * 0.05) : 0
        const total = subtotal - discount
        const saleId = `sale-${String(saleCounter).padStart(4, '0')}`
        const invoice = `SAL-${date.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`
        const hour = 9 + index * 2
        const completedAt = `${date}T${String(hour).padStart(2, '0')}:${String((index * 11) % 60).padStart(2, '0')}:00+05:00`
        const customerId = index % 4 === 1 ? 'customer-ahmed' : index % 5 === 2 ? 'customer-fatima' : 'customer-walk-in'
        const method = customerId === 'customer-ahmed' && index % 2 ? 'Udhaar' : saleMethods[(offset + index) % 4]
        insertSale.run(saleId, BUSINESS_ID, BRANCH_ID, invoice, date, customerId, CASHIER_ID, subtotal, discount, total, cost, 'completed', completedAt)
        insertItem.run(`${saleId}-1`, saleId, first[0], first[3], firstQty * 1000, first[9], first[8], discount, first[9] * firstQty - discount)
        insertItem.run(`${saleId}-2`, saleId, second[0], second[3], secondQty * 1000, second[9], second[8], 0, second[9] * secondQty)
        insertPayment.run(`payment-${saleId}`, saleId, method, total)
        if (offset === 0) insertAudit.run(`audit-${saleId}`, BRANCH_ID, CASHIER_ID, 'Sale', 'sale', saleId, `${customerId === 'customer-walk-in' ? 'Walk-in customer' : 'Customer'} sale completed`, invoice, completedAt)
        saleCounter += 1
      }
    }

    const expenseRows = [
      ['expense-1',today,'Electricity Bill','Utilities',1850000,'Cash',`${today}T10:12:00+05:00`],
      ['expense-2',addDays(today,-1),'Shop supplies','Office Supplies',320000,'Cash',`${addDays(today,-1)}T15:00:00+05:00`],
      ['expense-3',addDays(today,-3),'Delivery fuel','Transport',450000,'JazzCash',`${addDays(today,-3)}T12:30:00+05:00`],
    ] as const
    const insertExpense = db.prepare('INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const row of expenseRows) insertExpense.run(row[0], BRANCH_ID, row[1], row[2], row[3], row[4], row[5], row[6])

    const shiftId = 'shift-current'
    db.prepare('INSERT INTO cash_shifts VALUES (?, ?, ?, ?, ?, ?, ?)').run(shiftId, BRANCH_ID, CASHIER_ID, 5000000, 'open', `${today}T09:00:00+05:00`, null)
    db.prepare('INSERT INTO cash_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('cash-opening', shiftId, BRANCH_ID, today, 'opening_cash', 'in', 5000000, 'Cash', shiftId, `${today}T09:00:00+05:00`)
    const cashSales = db.prepare(`SELECT s.id, s.total_paisa, s.completed_at FROM sales s JOIN sale_payments p ON p.sale_id=s.id WHERE s.business_date=? AND s.branch_id=? AND p.method='Cash'`).all(today, BRANCH_ID) as SqlRow[]
    for (const sale of cashSales) db.prepare('INSERT INTO cash_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`cash-${sale.id}`, shiftId, BRANCH_ID, today, 'cash_sale', 'in', sale.total_paisa, 'Cash', sale.id, sale.completed_at)
    db.prepare('INSERT INTO cash_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('cash-expense-1', shiftId, BRANCH_ID, today, 'expense', 'out', 1850000, 'Cash', 'expense-1', `${today}T10:12:00+05:00`)
    insertAudit.run('audit-expense-1', BRANCH_ID, OWNER_ID, 'Expense', 'expense', 'expense-1', 'Manager recorded expense', 'Rs 18,500', `${today}T10:12:00+05:00`)
    insertAudit.run('audit-product-1', BRANCH_ID, OWNER_ID, 'Product', 'product', 'product-1', 'Product catalog verified', 'Coca Cola 1.5L', `${today}T10:31:00+05:00`)
    insertAudit.run('audit-purchase-1', BRANCH_ID, OWNER_ID, 'Purchase', 'purchase', 'purchase-1', 'Purchase received', 'PUR-2026-001', `${today}T09:58:00+05:00`)
    db.prepare('INSERT INTO app_meta VALUES (?, ?)').run('seeded_business_date', today)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function resolveRange(today: string, range: DashboardDateRange) {
  if (range === 'yesterday') {
    const date = addDays(today, -1)
    return { start: date, end: date, previousStart: addDays(date, -1), previousEnd: addDays(date, -1), label: 'Yesterday', comparison: 'vs previous day' }
  }
  if (range === 'this_week') {
    const start = startOfWeek(today)
    const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000)
    return { start, end: today, previousStart: addDays(start, -(days + 1)), previousEnd: addDays(start, -1), label: 'This Week', comparison: 'vs previous period' }
  }
  return { start: today, end: today, previousStart: addDays(today, -1), previousEnd: addDays(today, -1), label: 'Today', comparison: 'vs yesterday' }
}

function chartDates(today: string, period: DashboardChartPeriod) {
  const count = period === '30_days' ? 30 : 7
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1))
}

export class VertexiaDatabase {
  readonly connection: DatabaseSync
  private readonly now: () => Date

  constructor(path: string, now: () => Date = () => new Date(), options: { seedDemoData?: boolean } = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.connection = new DatabaseSync(path)
    this.now = now
    runMigrations(this.connection)
    removeLegacyDemoSeed(this.connection)
    seedDatabase(this.connection, this.now(),options.seedDemoData === true)
  }

  close() {
    this.connection.close()
  }

  getDashboardSnapshot(query: DashboardQuery): DashboardSnapshot {
    const today = businessDate(this.now())
    const selectedBranch = this.connection.prepare('SELECT id FROM branches WHERE id=? AND is_active=1').get(query.branchId) as SqlRow | undefined
    const branchId = String(selectedBranch?.id ?? BRANCH_ID)
    const range = resolveRange(today, query.dateRange)
    const total = (start: string, end: string) => this.connection.prepare(`SELECT COALESCE(SUM(total_paisa),0) AS sales, COALESCE(SUM(total_paisa-cost_paisa),0) AS profit FROM sales WHERE branch_id=? AND status='completed' AND business_date BETWEEN ? AND ?`).get(branchId, start, end) as SqlRow
    const current = total(range.start, range.end)
    const previous = total(range.previousStart, range.previousEnd)
    const scalar = (sql: string, ...params: (string | number)[]) => Number((this.connection.prepare(sql).get(...params) as SqlRow | undefined)?.value ?? 0)
    const branches = (this.connection.prepare('SELECT id,name,city FROM branches WHERE is_active=1 ORDER BY name').all() as SqlRow[]).map(row => ({ id:String(row.id), name:String(row.name), subtitle:`Main Branch - ${String(row.city)}` }))

    let chart: DashboardChartPoint[]
    if (query.chartPeriod === 'today') {
      const rows = this.connection.prepare(`SELECT CAST(substr(completed_at,12,2) AS INTEGER) AS hour, SUM(total_paisa) AS value, SUM(total_paisa-cost_paisa) AS profit FROM sales WHERE branch_id=? AND status='completed' AND business_date=? GROUP BY hour`).all(branchId, today) as SqlRow[]
      const hourly = new Map(rows.map(row => [Number(row.hour), { value:Number(row.value),profit:Number(row.profit) }]))
      chart = [8,10,12,14,16,18,20].map(hour => {
        const bucket = Array.from(hourly).filter(([saleHour]) => saleHour >= hour && saleHour < hour + 2).reduce((sum,[,value]) => ({ value:sum.value+value.value,profit:sum.profit+value.profit }),{ value:0,profit:0 })
        return { label:`${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`,valuePaisa:bucket.value,profitPaisa:bucket.profit }
      })
    } else {
      const dates = chartDates(today, query.chartPeriod)
      const rows = this.connection.prepare(`SELECT business_date AS date, SUM(total_paisa) AS value, SUM(total_paisa-cost_paisa) AS profit FROM sales WHERE branch_id=? AND status='completed' AND business_date BETWEEN ? AND ? GROUP BY business_date`).all(branchId, dates[0], dates.at(-1)!) as SqlRow[]
      const values = new Map(rows.map(row => [String(row.date), { value:Number(row.value),profit:Number(row.profit) }]))
      chart = dates.map(date => ({ label:labelDate(date),valuePaisa:values.get(date)?.value ?? 0,profitPaisa:values.get(date)?.profit ?? 0 }))
    }

    const topProducts = (this.connection.prepare(`SELECT p.id,p.name,p.visual_kind,SUM(si.quantity_milli) AS quantity FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id WHERE s.branch_id=? AND s.status='completed' AND s.business_date BETWEEN ? AND ? GROUP BY p.id,p.name,p.visual_kind ORDER BY quantity DESC,p.name LIMIT 5`).all(branchId, range.start, range.end) as SqlRow[]).map(row => ({ id:String(row.id),name:String(row.name),kind:String(row.visual_kind),quantityMilli:Number(row.quantity) }))
    const lowProducts = (this.connection.prepare(`SELECT p.id,p.name,p.visual_kind,sl.quantity_milli AS quantity FROM stock_levels sl JOIN products p ON p.id=sl.product_id WHERE sl.branch_id=? AND p.is_active=1 AND sl.quantity_milli<=p.minimum_stock_milli ORDER BY sl.quantity_milli ASC,p.name LIMIT 5`).all(branchId) as SqlRow[]).map(row => ({ id:String(row.id),name:String(row.name),kind:String(row.visual_kind),quantityMilli:Number(row.quantity) }))
    const recentSales = (this.connection.prepare(`SELECT s.id,s.invoice_number,c.name AS customer_name,s.total_paisa,s.completed_at,COALESCE((SELECT GROUP_CONCAT(method, ', ') FROM sale_payments WHERE sale_id=s.id),'Unpaid') AS payment_method FROM sales s JOIN customers c ON c.id=s.customer_id WHERE s.branch_id=? AND s.status='completed' ORDER BY s.completed_at DESC LIMIT 5`).all(branchId) as SqlRow[]).map(row => ({ id:String(row.id),invoiceNumber:String(row.invoice_number),customerName:String(row.customer_name),totalPaisa:Number(row.total_paisa),paymentMethod:String(row.payment_method),completedAt:String(row.completed_at) })) as DashboardSaleRow[]
    const recentActivity = (this.connection.prepare(`SELECT id,occurred_at,event_type,description,COALESCE(reference,'') AS reference FROM audit_events WHERE branch_id=? ORDER BY occurred_at DESC LIMIT 5`).all(branchId) as SqlRow[]).map(row => ({ id:String(row.id),occurredAt:String(row.occurred_at),type:String(row.event_type),description:String(row.description),reference:String(row.reference) })) as DashboardActivityRow[]
    const openShift = this.connection.prepare(`SELECT id,opening_cash_paisa FROM cash_shifts WHERE branch_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1`).get(branchId) as SqlRow | undefined
    const cashInDrawer = openShift ? scalar(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount_paisa ELSE -amount_paisa END),0) AS value FROM cash_transactions WHERE shift_id=?`, String(openShift.id)) : 0
    const user = this.connection.prepare('SELECT name,role FROM users WHERE id=?').get(OWNER_ID) as SqlRow
    const business = this.connection.prepare('SELECT name FROM businesses WHERE id=?').get(BUSINESS_ID) as SqlRow
    const sales = Number(current.sales)
    const profit = Number(current.profit)
    const lowStockCount = scalar(`SELECT COUNT(*) AS value FROM stock_levels sl JOIN products p ON p.id=sl.product_id WHERE sl.branch_id=? AND p.is_active=1 AND sl.quantity_milli<=p.minimum_stock_milli`, branchId)

    return {
      generatedAt: this.now().toISOString(), businessDate:today, selectedRangeLabel:range.label, comparisonLabel:range.comparison,
      branches, activeBranchId:branchId, userName:String(user.name), userRole:String(user.role), businessName:String(business.name),
      salesPaisa:sales, salesChangePercent:percentageChange(sales, Number(previous.sales)),
      profitPaisa:profit, profitChangePercent:percentageChange(profit, Number(previous.profit)),
      lowStockCount,
      customerDuePaisa:scalar(`SELECT COALESCE(SUM(debit_paisa-credit_paisa),0) AS value FROM customer_ledger WHERE branch_id=?`, branchId),
      supplierDuePaisa:scalar(`SELECT COALESCE(SUM(debit_paisa-credit_paisa),0) AS value FROM supplier_ledger WHERE branch_id=?`, branchId),
      expensesPaisa:scalar(`SELECT COALESCE(SUM(amount_paisa),0) AS value FROM expenses WHERE branch_id=? AND business_date BETWEEN ? AND ?`, branchId,range.start,range.end),
      cashInDrawerPaisa:cashInDrawer, chart, topProducts, lowProducts, recentSales, recentActivity,
      unreadNotifications:lowStockCount,
    }
  }

  getPosBootstrap(branchId: string): PosBootstrap {
    const branch = this.connection.prepare(`SELECT b.id,b.name,b.business_id,b.is_active,bu.name AS business_name FROM branches b JOIN businesses bu ON bu.id=b.business_id WHERE b.id=?`).get(branchId) as SqlRow | undefined
    if (!branch || Number(branch.is_active) !== 1) throw new Error('The selected branch is unavailable.')
    const products = (this.connection.prepare(`SELECT p.id,p.sku,p.barcode,p.name,p.category,p.unit,p.visual_kind,p.selling_price_paisa,p.minimum_stock_milli,sl.quantity_milli FROM products p JOIN stock_levels sl ON sl.product_id=p.id AND sl.branch_id=? WHERE p.business_id=? AND p.is_active=1 ORDER BY p.name`).all(branchId,String(branch.business_id)) as SqlRow[]).map(row => ({
      id:String(row.id),sku:String(row.sku),barcode:row.barcode === null ? null : String(row.barcode),name:String(row.name),category:String(row.category),unit:String(row.unit),kind:String(row.visual_kind),sellingPricePaisa:Number(row.selling_price_paisa),quantityMilli:Number(row.quantity_milli),minimumStockMilli:Number(row.minimum_stock_milli),
    })) as PosProduct[]
    const customers = (this.connection.prepare(`SELECT c.id,c.name,c.phone,c.is_walk_in,COALESCE(SUM(cl.debit_paisa-cl.credit_paisa),0) AS balance FROM customers c LEFT JOIN customer_ledger cl ON cl.customer_id=c.id AND cl.branch_id=? WHERE c.business_id=? AND c.is_active=1 GROUP BY c.id,c.name,c.phone,c.is_walk_in ORDER BY c.is_walk_in DESC,c.name`).all(branchId,String(branch.business_id)) as SqlRow[]).map(row => ({
      id:String(row.id),name:String(row.name),phone:row.phone === null ? null : String(row.phone),isWalkIn:Number(row.is_walk_in) === 1,balancePaisa:Number(row.balance),
    })) as PosCustomer[]
    const heldSales = (this.connection.prepare(`SELECT id,customer_id,item_count,total_paisa,held_at FROM held_sales WHERE branch_id=? ORDER BY held_at DESC`).all(branchId) as SqlRow[]).map(row => ({ id:String(row.id),customerId:String(row.customer_id),itemCount:Number(row.item_count),totalPaisa:Number(row.total_paisa),heldAt:String(row.held_at) }))
    const activeShift = this.connection.prepare(`SELECT id FROM cash_shifts WHERE branch_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1`).get(branchId) as SqlRow | undefined
    const user = this.connection.prepare('SELECT name,role FROM users WHERE id=?').get(OWNER_ID) as SqlRow
    return {
      branchId,businessName:String(branch.business_name),branchName:String(branch.name),userName:String(user.name),userRole:String(user.role),activeShiftId:activeShift ? String(activeShift.id) : null,
      lowStockCount:products.filter(product => product.quantityMilli <= product.minimumStockMilli).length,
      products,customers,categories:[...new Set(products.map(product => product.category))].sort(),heldSales,
    }
  }

  private priceLines(branchId: string, lines: PosCartLineInput[]) {
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('Add at least one product to the cart.')
    if (lines.length > 100) throw new Error('A sale cannot contain more than 100 product lines.')
    const seen = new Set<string>()
    return lines.map(line => {
      if (!line || typeof line.productId !== 'string' || seen.has(line.productId)) throw new Error('Cart contains an invalid or duplicate product.')
      seen.add(line.productId)
      if (!Number.isInteger(line.quantityMilli) || line.quantityMilli <= 0) throw new Error('Product quantity must be greater than zero.')
      if (!Number.isInteger(line.discountBasisPoints) || line.discountBasisPoints < 0 || line.discountBasisPoints > 10_000) throw new Error('Product discount must be between 0% and 100%.')
      const row = this.connection.prepare(`SELECT p.id,p.name,p.sku,p.barcode,p.unit,p.visual_kind,p.purchase_price_paisa,p.selling_price_paisa,sl.quantity_milli FROM products p JOIN stock_levels sl ON sl.product_id=p.id AND sl.branch_id=? WHERE p.id=? AND p.is_active=1`).get(branchId,line.productId) as SqlRow | undefined
      if (!row) throw new Error('A cart product is no longer available.')
      if (Number(row.quantity_milli) < line.quantityMilli) throw new Error(`${String(row.name)} has insufficient stock.`)
      const subtotalPaisa = Math.round(Number(row.selling_price_paisa) * line.quantityMilli / 1000)
      const costPaisa = Math.round(Number(row.purchase_price_paisa) * line.quantityMilli / 1000)
      const discountPaisa = Math.round(subtotalPaisa * line.discountBasisPoints / 10_000)
      return {
        productId:String(row.id),name:String(row.name),sku:String(row.sku),barcode:row.barcode === null ? null : String(row.barcode),unit:String(row.unit),kind:String(row.visual_kind),quantityMilli:line.quantityMilli,unitPricePaisa:Number(row.selling_price_paisa),unitCostPaisa:Number(row.purchase_price_paisa),subtotalPaisa,costPaisa,discountPaisa,lineTotalPaisa:subtotalPaisa-discountPaisa,stockBeforeMilli:Number(row.quantity_milli),
      }
    })
  }

  completePosSale(request: PosCompleteSaleRequest): PosCompletedSale {
    if (!request || typeof request.branchId !== 'string' || typeof request.customerId !== 'string') throw new Error('Invalid sale request.')
    const allowedMethods = new Set(['Cash','Card','JazzCash','Easypaisa','Udhaar'])
    if (!allowedMethods.has(request.paymentMethod)) throw new Error('Select a valid payment method.')
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const branch = this.connection.prepare('SELECT business_id FROM branches WHERE id=? AND is_active=1').get(request.branchId) as SqlRow | undefined
      if (!branch) throw new Error('The selected branch is unavailable.')
      const shift = this.connection.prepare(`SELECT id FROM cash_shifts WHERE branch_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1`).get(request.branchId) as SqlRow | undefined
      if (!shift) throw new Error('Open a cash shift before completing a sale.')
      const customer = this.connection.prepare('SELECT id,name,is_walk_in FROM customers WHERE id=? AND business_id=? AND is_active=1').get(request.customerId,String(branch.business_id)) as SqlRow | undefined
      if (!customer) throw new Error('Select a valid customer.')
      if (request.paymentMethod === 'Udhaar' && Number(customer.is_walk_in) === 1) throw new Error('Select a registered customer for Udhaar.')
      const lines = this.priceLines(request.branchId,request.lines)
      const subtotalPaisa = lines.reduce((sum,line) => sum + line.subtotalPaisa,0)
      const discountPaisa = lines.reduce((sum,line) => sum + line.discountPaisa,0)
      const totalPaisa = lines.reduce((sum,line) => sum + line.lineTotalPaisa,0)
      const costPaisa = lines.reduce((sum,line) => sum + line.costPaisa,0)
      if (totalPaisa <= 0) throw new Error('Sale total must be greater than zero.')
      if (request.paymentMethod === 'Cash' && (!Number.isInteger(request.cashReceivedPaisa) || request.cashReceivedPaisa < totalPaisa)) throw new Error('Cash received is less than the sale total.')
      const now = this.now()
      const date = businessDate(now)
      const completedAt = now.toISOString()
      const sequence = Number((this.connection.prepare(`SELECT COUNT(*) AS value FROM sales WHERE branch_id=? AND business_date=?`).get(request.branchId,date) as SqlRow).value) + 1
      const invoiceNumber = `SAL-${date.replaceAll('-','')}-${String(sequence).padStart(4,'0')}`
      const saleId = `sale-${randomUUID()}`
      this.connection.prepare('INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(saleId,String(branch.business_id),request.branchId,invoiceNumber,date,request.customerId,OWNER_ID,subtotalPaisa,discountPaisa,totalPaisa,costPaisa,'completed',completedAt)
      const insertItem = this.connection.prepare('INSERT INTO sale_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      const updateStock = this.connection.prepare('UPDATE stock_levels SET quantity_milli=quantity_milli-?,updated_at=? WHERE branch_id=? AND product_id=? AND quantity_milli>=?')
      const insertMovement = this.connection.prepare('INSERT INTO stock_movements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      for (const line of lines) {
        insertItem.run(`sale-item-${randomUUID()}`,saleId,line.productId,line.name,line.quantityMilli,line.unitPricePaisa,line.unitCostPaisa,line.discountPaisa,line.lineTotalPaisa)
        const updated = updateStock.run(line.quantityMilli,completedAt,request.branchId,line.productId,line.quantityMilli)
        if (updated.changes !== 1) throw new Error(`${line.name} stock changed. Refresh the cart and try again.`)
        insertMovement.run(`stock-${randomUUID()}`,request.branchId,line.productId,'sale',-line.quantityMilli,line.stockBeforeMilli-line.quantityMilli,'sale',saleId,invoiceNumber,completedAt)
      }
      const paidAmount = request.paymentMethod === 'Udhaar' ? 0 : totalPaisa
      this.connection.prepare('INSERT INTO sale_payments VALUES (?, ?, ?, ?)').run(`sale-payment-${randomUUID()}`,saleId,request.paymentMethod,paidAmount)
      if (request.paymentMethod === 'Udhaar') this.connection.prepare('INSERT INTO customer_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`customer-ledger-${randomUUID()}`,request.branchId,request.customerId,'sale',totalPaisa,0,saleId,completedAt)
      if (request.paymentMethod === 'Cash') this.connection.prepare('INSERT INTO cash_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`cash-${randomUUID()}`,String(shift.id),request.branchId,date,'cash_sale','in',totalPaisa,'Cash',saleId,completedAt)
      this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,request.branchId,OWNER_ID,'Sale','sale',saleId,'Sale completed',invoiceNumber,completedAt)
      this.connection.exec('COMMIT')
      const cashReceivedPaisa = request.paymentMethod === 'Cash' ? request.cashReceivedPaisa : totalPaisa
      return { saleId,invoiceNumber,completedAt,customerName:String(customer.name),paymentMethod:request.paymentMethod,subtotalPaisa,discountPaisa,totalPaisa,cashReceivedPaisa,changePaisa:request.paymentMethod === 'Cash' ? cashReceivedPaisa-totalPaisa : 0,lines:lines.map(line => ({ name:line.name,quantityMilli:line.quantityMilli,unitPricePaisa:line.unitPricePaisa,discountPaisa:line.discountPaisa,lineTotalPaisa:line.lineTotalPaisa })) }
    } catch (error) {
      this.connection.exec('ROLLBACK')
      throw error
    }
  }

  holdPosSale(branchId: string, customerId: string, lines: PosCartLineInput[]): PosHeldSale {
    const priced = this.priceLines(branchId,lines)
    const customer = this.connection.prepare('SELECT id FROM customers WHERE id=? AND is_active=1').get(customerId)
    if (!customer) throw new Error('Select a valid customer.')
    const heldAt = this.now().toISOString()
    const held: PosHeldSale = { id:`held-${randomUUID()}`,customerId,itemCount:priced.length,totalPaisa:priced.reduce((sum,line) => sum+line.lineTotalPaisa,0),heldAt,lines }
    this.connection.prepare('INSERT INTO held_sales VALUES (?, ?, ?, ?, ?, ?, ?)').run(held.id,branchId,customerId,JSON.stringify(lines),held.itemCount,held.totalPaisa,heldAt)
    return held
  }

  resumePosSale(id: string): PosHeldSale {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const row = this.connection.prepare('SELECT * FROM held_sales WHERE id=?').get(id) as SqlRow | undefined
      if (!row) throw new Error('Held sale no longer exists.')
      const lines = JSON.parse(String(row.cart_json)) as PosCartLineInput[]
      this.priceLines(String(row.branch_id),lines)
      this.connection.prepare('DELETE FROM held_sales WHERE id=?').run(id)
      this.connection.exec('COMMIT')
      return { id:String(row.id),customerId:String(row.customer_id),itemCount:Number(row.item_count),totalPaisa:Number(row.total_paisa),heldAt:String(row.held_at),lines }
    } catch (error) {
      this.connection.exec('ROLLBACK')
      throw error
    }
  }

  deleteHeldPosSale(id: string) {
    this.connection.prepare('DELETE FROM held_sales WHERE id=?').run(id)
  }

  openPosShift(branchId: string, openingCashPaisa: number) {
    if (!Number.isInteger(openingCashPaisa) || openingCashPaisa < 0) throw new Error('Opening cash must be zero or greater.')
    if (this.connection.prepare(`SELECT id FROM cash_shifts WHERE branch_id=? AND status='open'`).get(branchId)) throw new Error('A shift is already open.')
    const now = this.now()
    const occurredAt = now.toISOString()
    const shiftId = `shift-${randomUUID()}`
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.prepare('INSERT INTO cash_shifts VALUES (?, ?, ?, ?, ?, ?, ?)').run(shiftId,branchId,OWNER_ID,openingCashPaisa,'open',occurredAt,null)
      this.connection.prepare('INSERT INTO cash_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`cash-${randomUUID()}`,shiftId,branchId,businessDate(now),'opening_cash','in',openingCashPaisa,'Cash',shiftId,occurredAt)
      this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,branchId,OWNER_ID,'Shift','cash_shift',shiftId,'Cash shift opened',`Rs ${(openingCashPaisa/100).toLocaleString('en-PK')}`,occurredAt)
      this.connection.exec('COMMIT')
      return shiftId
    } catch (error) {
      this.connection.exec('ROLLBACK')
      throw error
    }
  }

  createPosProduct(branchId: string, input: PosCreateProductInput): PosProduct {
    const name = input.name?.trim()
    const category = input.category?.trim() || 'General'
    const unit = input.unit?.trim() || 'Piece'
    const barcode = input.barcode?.trim() || null
    if (!name || name.length > 120) throw new Error('Enter a valid product name.')
    for (const [value,label] of [[input.purchasePricePaisa,'Purchase price'],[input.sellingPricePaisa,'Sale price'],[input.openingStockMilli,'Opening stock']] as const) if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be zero or greater.`)
    const branch = this.connection.prepare('SELECT business_id FROM branches WHERE id=? AND is_active=1').get(branchId) as SqlRow | undefined
    if (!branch) throw new Error('The selected branch is unavailable.')
    const id = `product-${randomUUID()}`
    const sku = `CUSTOM-${randomUUID().slice(0,8).toUpperCase()}`
    const now = this.now().toISOString()
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.prepare('INSERT INTO products(id,business_id,sku,barcode,name,category,brand,unit,visual_kind,purchase_price_paisa,selling_price_paisa,minimum_stock_milli,is_active,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id,String(branch.business_id),sku,barcode,name,category,'Custom',unit,'box',input.purchasePricePaisa,input.sellingPricePaisa,0,1,now,now)
      this.connection.prepare('INSERT INTO stock_levels VALUES (?, ?, ?, ?)').run(branchId,id,input.openingStockMilli,now)
      if (input.openingStockMilli > 0) this.connection.prepare('INSERT INTO stock_movements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`stock-${randomUUID()}`,branchId,id,'opening_stock',input.openingStockMilli,input.openingStockMilli,'product',id,'Opening stock',now)
      this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,branchId,OWNER_ID,'Product','product',id,'Custom product created',name,now)
      this.connection.exec('COMMIT')
      return { id,sku,barcode,name,category,unit,kind:'box',sellingPricePaisa:input.sellingPricePaisa,quantityMilli:input.openingStockMilli,minimumStockMilli:0 }
    } catch (error) {
      this.connection.exec('ROLLBACK')
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw new Error('This barcode is already assigned to another product.')
      throw error
    }
  }

  createPosCustomer(input: PosCreateCustomerInput): PosCustomer {
    const name = input.name?.trim()
    const phone = input.phone?.trim()
    if (!name || name.length > 100) throw new Error('Enter a valid customer name.')
    if (!phone || phone.length < 7 || phone.length > 25) throw new Error('Enter a valid phone number.')
    const existing = this.connection.prepare('SELECT id FROM customers WHERE business_id=? AND phone=?').get(BUSINESS_ID,phone)
    if (existing) throw new Error('A customer with this phone number already exists.')
    const id = `customer-${randomUUID()}`
    this.connection.prepare('INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?)').run(id,BUSINESS_ID,name,phone,0,1,this.now().toISOString())
    return { id,name,phone,isWalkIn:false,balancePaisa:0 }
  }

  private normalizeProductInput(input: ProductSaveInput) {
    if (!input || typeof input !== 'object') throw new Error('Invalid product details.')
    const name=input.name?.trim()
    const sku=input.sku?.trim().toUpperCase() || `PRD-${randomUUID().slice(0,8).toUpperCase()}`
    const barcode=input.barcode?.trim() || null
    const category=input.category?.trim()
    const subcategory=input.subcategory?.trim() || ''
    const brand=input.brand?.trim() || ''
    const unit=input.unit?.trim()
    if(!name || name.length>120) throw new Error('Product name is required and must be under 120 characters.')
    if(!category || category.length>80) throw new Error('Select a valid category.')
    if(!unit || unit.length>30) throw new Error('Select a valid unit.')
    if(sku.length>50 || (barcode && barcode.length>80)) throw new Error('SKU or barcode is too long.')
    for(const [value,label] of [[input.purchasePricePaisa,'Purchase price'],[input.sellingPricePaisa,'Sale price'],[input.mrpPaisa,'MRP'],[input.minimumStockMilli,'Minimum stock'],[input.openingStockMilli,'Opening stock']] as const) if(!Number.isInteger(value)||value<0) throw new Error(`${label} must be zero or greater.`)
    if(input.sellingPricePaisa<=0) throw new Error('Sale price must be greater than zero.')
    if(input.mrpPaisa>0 && input.mrpPaisa<input.sellingPricePaisa) throw new Error('MRP cannot be lower than the sale price.')
    if(input.status!=='active'&&input.status!=='inactive') throw new Error('Select a valid product status.')
    if(input.imageDataUrl && (!input.imageDataUrl.startsWith('data:image/') || input.imageDataUrl.length>2_800_000)) throw new Error('Product image must be a PNG or JPG under 2 MB.')
    return { name,sku,barcode,category,subcategory,brand,unit,purchasePricePaisa:input.purchasePricePaisa,sellingPricePaisa:input.sellingPricePaisa,mrpPaisa:input.mrpPaisa,minimumStockMilli:input.minimumStockMilli,openingStockMilli:input.openingStockMilli,status:input.status,imageDataUrl:input.imageDataUrl || null }
  }

  private getProductRecord(id: string, branchId: string): ProductCatalogRecord {
    const row=this.connection.prepare(`SELECT p.*,sl.quantity_milli FROM products p JOIN stock_levels sl ON sl.product_id=p.id AND sl.branch_id=? WHERE p.id=?`).get(branchId,id) as SqlRow | undefined
    if(!row) throw new Error('Product was not found.')
    return { id:String(row.id),name:String(row.name),sku:String(row.sku),barcode:String(row.barcode ?? ''),category:String(row.category),subcategory:String(row.subcategory),brand:String(row.brand ?? ''),unit:String(row.unit),kind:String(row.visual_kind),purchasePricePaisa:Number(row.purchase_price_paisa),sellingPricePaisa:Number(row.selling_price_paisa),mrpPaisa:Number(row.mrp_paisa),minimumStockMilli:Number(row.minimum_stock_milli),stockMilli:Number(row.quantity_milli),status:Number(row.is_active)===1?'active':'inactive',imageDataUrl:row.image_data_url===null?null:String(row.image_data_url),createdAt:String(row.created_at),updatedAt:String(row.updated_at) }
  }

  listProducts(query: ProductCatalogQuery): ProductCatalogResult {
    if(!query || typeof query.branchId!=='string') throw new Error('Invalid product query.')
    const page=Math.max(1,Math.trunc(query.page)||1)
    const pageSize=Math.min(100,Math.max(5,Math.trunc(query.pageSize)||12))
    const where=['sl.branch_id=?']
    const params:(string|number)[]=[query.branchId]
    const search=query.search?.trim()
    if(search){where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');const term=`%${search}%`;params.push(term,term,term)}
    if(query.category&&query.category!=='all'){where.push('p.category=?');params.push(query.category)}
    if(query.brand&&query.brand!=='all'){where.push('p.brand=?');params.push(query.brand)}
    if(query.status==='active') where.push('p.is_active=1')
    else if(query.status==='inactive') where.push('p.is_active=0')
    else if(query.status==='low_stock') where.push('p.is_active=1 AND sl.quantity_milli>0 AND sl.quantity_milli<=p.minimum_stock_milli')
    else if(query.status==='out_of_stock') where.push('p.is_active=1 AND sl.quantity_milli<=0')
    const clause=where.join(' AND ')
    const total=Number((this.connection.prepare(`SELECT COUNT(*) AS value FROM products p JOIN stock_levels sl ON sl.product_id=p.id WHERE ${clause}`).get(...params) as SqlRow).value)
    const ids=(this.connection.prepare(`SELECT p.id FROM products p JOIN stock_levels sl ON sl.product_id=p.id WHERE ${clause} ORDER BY p.updated_at DESC,p.name LIMIT ? OFFSET ?`).all(...params,pageSize,(page-1)*pageSize) as SqlRow[]).map(row => String(row.id))
    const products=ids.map(id => this.getProductRecord(id,query.branchId))
    const categories=(this.connection.prepare(`SELECT DISTINCT p.category AS value FROM products p JOIN stock_levels sl ON sl.product_id=p.id WHERE sl.branch_id=? ORDER BY p.category`).all(query.branchId) as SqlRow[]).map(row => String(row.value))
    const brands=(this.connection.prepare(`SELECT DISTINCT p.brand AS value FROM products p JOIN stock_levels sl ON sl.product_id=p.id WHERE sl.branch_id=? AND p.brand IS NOT NULL AND p.brand<>'' ORDER BY p.brand`).all(query.branchId) as SqlRow[]).map(row => String(row.value))
    return { products,total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize)),categories,brands }
  }

  saveProduct(branchId: string, input: ProductSaveInput): ProductCatalogRecord {
    const normalized=this.normalizeProductInput(input)
    const branch=this.connection.prepare('SELECT business_id FROM branches WHERE id=? AND is_active=1').get(branchId) as SqlRow | undefined
    if(!branch) throw new Error('The selected branch is unavailable.')
    const now=this.now().toISOString()
    const id=input.id?.trim() || `product-${randomUUID()}`
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      if(input.id) {
        const existing=this.connection.prepare('SELECT id FROM products WHERE id=? AND business_id=?').get(id,String(branch.business_id))
        if(!existing) throw new Error('Product was not found.')
        this.connection.prepare(`UPDATE products SET sku=?,barcode=?,name=?,category=?,subcategory=?,brand=?,unit=?,purchase_price_paisa=?,selling_price_paisa=?,mrp_paisa=?,minimum_stock_milli=?,is_active=?,image_data_url=?,updated_at=? WHERE id=?`).run(normalized.sku,normalized.barcode,normalized.name,normalized.category,normalized.subcategory,normalized.brand||null,normalized.unit,normalized.purchasePricePaisa,normalized.sellingPricePaisa,normalized.mrpPaisa,normalized.minimumStockMilli,normalized.status==='active'?1:0,normalized.imageDataUrl,now,id)
        this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,branchId,OWNER_ID,'Product','product',id,'Product updated',normalized.name,now)
      } else {
        this.connection.prepare(`INSERT INTO products(id,business_id,sku,barcode,name,category,brand,unit,visual_kind,purchase_price_paisa,selling_price_paisa,minimum_stock_milli,is_active,created_at,updated_at,subcategory,mrp_paisa,image_data_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(branch.business_id),normalized.sku,normalized.barcode,normalized.name,normalized.category,normalized.brand||null,normalized.unit,'box',normalized.purchasePricePaisa,normalized.sellingPricePaisa,normalized.minimumStockMilli,normalized.status==='active'?1:0,now,now,normalized.subcategory,normalized.mrpPaisa,normalized.imageDataUrl)
        this.connection.prepare('INSERT INTO stock_levels VALUES (?, ?, ?, ?)').run(branchId,id,normalized.openingStockMilli,now)
        if(normalized.openingStockMilli>0) this.connection.prepare('INSERT INTO stock_movements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`stock-${randomUUID()}`,branchId,id,'opening_stock',normalized.openingStockMilli,normalized.openingStockMilli,'product',id,'Opening stock',now)
        this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,branchId,OWNER_ID,'Product','product',id,'Product created',normalized.name,now)
      }
      this.connection.exec('COMMIT')
      return this.getProductRecord(id,branchId)
    } catch(error) {
      this.connection.exec('ROLLBACK')
      if(error instanceof Error && error.message.includes('UNIQUE constraint failed: products.business_id, products.barcode')) throw new Error('Barcode already belongs to another product.')
      if(error instanceof Error && error.message.includes('UNIQUE constraint failed: products.business_id, products.sku')) throw new Error('SKU already belongs to another product.')
      throw error
    }
  }

  toggleProductStatus(branchId: string, id: string) {
    const row=this.connection.prepare('SELECT p.is_active,p.name FROM products p JOIN stock_levels sl ON sl.product_id=p.id WHERE p.id=? AND sl.branch_id=?').get(id,branchId) as SqlRow | undefined
    if(!row) throw new Error('Product was not found.')
    const status=Number(row.is_active)===1?'inactive':'active'
    const now=this.now().toISOString()
    this.connection.prepare('UPDATE products SET is_active=?,updated_at=? WHERE id=?').run(status==='active'?1:0,now,id)
    this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,branchId,OWNER_ID,'Product','product',id,`Product ${status==='active'?'activated':'deactivated'}`,String(row.name),now)
    return status
  }

  importProductsCsv(branchId: string, csv: string) {
    if(typeof csv!=='string'||csv.length>5_000_000) throw new Error('CSV file is invalid or too large.')
    const rows=parseCsv(csv)
    if(rows.length<2) throw new Error('CSV must include a header and at least one product row.')
    const headers=rows[0].map(header => header.trim().toLowerCase().replaceAll(' ','_'))
    const required=['name','category','unit','sale_price','opening_stock']
    for(const header of required) if(!headers.includes(header)) throw new Error(`CSV is missing the ${header} column.`)
    const value=(row:string[],name:string) => row[headers.indexOf(name)] ?? ''
    const inputs=rows.slice(1).map((row,index) => {
      const rupees=(name:string) => Math.round(Number(value(row,name)||0)*100)
      const stock=(name:string) => Math.round(Number(value(row,name)||0)*1000)
      try { return this.normalizeProductInput({ name:value(row,'name'),sku:value(row,'sku'),barcode:value(row,'barcode'),category:value(row,'category'),subcategory:value(row,'subcategory'),brand:value(row,'brand'),unit:value(row,'unit'),purchasePricePaisa:rupees('purchase_price'),sellingPricePaisa:rupees('sale_price'),mrpPaisa:rupees('mrp'),minimumStockMilli:stock('minimum_stock'),openingStockMilli:stock('opening_stock'),status:value(row,'status').toLowerCase()==='inactive'?'inactive':'active',imageDataUrl:null }) }
      catch(error) { throw new Error(`CSV row ${index+2}: ${error instanceof Error?error.message:'Invalid product.'}`) }
    })
    const branch=this.connection.prepare('SELECT business_id FROM branches WHERE id=? AND is_active=1').get(branchId) as SqlRow | undefined
    if(!branch) throw new Error('The selected branch is unavailable.')
    const seenSku=new Set<string>();const seenBarcode=new Set<string>()
    for(const input of inputs){if(seenSku.has(input.sku)) throw new Error(`Duplicate SKU ${input.sku} in CSV.`);seenSku.add(input.sku);if(input.barcode){if(seenBarcode.has(input.barcode)) throw new Error(`Duplicate barcode ${input.barcode} in CSV.`);seenBarcode.add(input.barcode)};if(this.connection.prepare('SELECT id FROM products WHERE business_id=? AND (sku=? OR (? IS NOT NULL AND barcode=?))').get(String(branch.business_id),input.sku,input.barcode,input.barcode)) throw new Error(`SKU or barcode for ${input.name} already exists.`)}
    const now=this.now().toISOString()
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      for(const input of inputs){const id=`product-${randomUUID()}`;this.connection.prepare(`INSERT INTO products(id,business_id,sku,barcode,name,category,brand,unit,visual_kind,purchase_price_paisa,selling_price_paisa,minimum_stock_milli,is_active,created_at,updated_at,subcategory,mrp_paisa,image_data_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,String(branch.business_id),input.sku,input.barcode,input.name,input.category,input.brand||null,input.unit,'box',input.purchasePricePaisa,input.sellingPricePaisa,input.minimumStockMilli,input.status==='active'?1:0,now,now,input.subcategory,input.mrpPaisa,null);this.connection.prepare('INSERT INTO stock_levels VALUES (?, ?, ?, ?)').run(branchId,id,input.openingStockMilli,now);if(input.openingStockMilli>0)this.connection.prepare('INSERT INTO stock_movements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`stock-${randomUUID()}`,branchId,id,'opening_stock',input.openingStockMilli,input.openingStockMilli,'product',id,'CSV import',now)}
      this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,branchId,OWNER_ID,'Product','product_import',`import-${randomUUID()}`,`${inputs.length} products imported`,'CSV',now)
      this.connection.exec('COMMIT')
      return { imported:inputs.length }
    } catch(error){this.connection.exec('ROLLBACK');throw error}
  }

  exportProductsCsv(branchId: string) {
    const products=(this.connection.prepare(`SELECT p.id FROM products p JOIN stock_levels sl ON sl.product_id=p.id WHERE sl.branch_id=? ORDER BY p.name`).all(branchId) as SqlRow[]).map(row => this.getProductRecord(String(row.id),branchId))
    const header=['name','sku','barcode','category','subcategory','brand','unit','purchase_price','sale_price','mrp','minimum_stock','opening_stock','status']
    const rows=products.map(product => [product.name,product.sku,product.barcode,product.category,product.subcategory,product.brand,product.unit,product.purchasePricePaisa/100,product.sellingPricePaisa/100,product.mrpPaisa/100,product.minimumStockMilli/1000,product.stockMilli/1000,product.status])
    return [header,...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
  }

  private resolveSalesPeriod(period: SalesListQuery['period']) {
    const today=businessDate(this.now())
    let start=today
    let label='Today'
    if(period==='this_week'){start=startOfWeek(today);label='This Week'}
    else if(period==='this_month'){start=`${today.slice(0,7)}-01`;label='This Month'}
    const span=Math.round((new Date(`${today}T12:00:00Z`).getTime()-new Date(`${start}T12:00:00Z`).getTime())/86_400_000)+1
    const previousEnd=addDays(start,-1)
    return {start,end:today,previousStart:addDays(previousEnd,1-span),previousEnd,label,comparison:period==='today'?'vs yesterday':period==='this_week'?'vs previous period':'vs previous period'}
  }

  private salesRows(query: SalesListQuery, paginate=true): {rows:SalesListRow[];total:number;page:number;pageSize:number} {
    if(!query || typeof query.branchId!=='string') throw new Error('Invalid sales query.')
    const range=this.resolveSalesPeriod(query.period)
    const page=Math.max(1,Math.trunc(query.page)||1)
    const pageSize=Math.min(100,Math.max(5,Math.trunc(query.pageSize)||10))
    const where=['s.branch_id=?','s.business_date BETWEEN ? AND ?']
    const params:(string|number)[]=[query.branchId,range.start,range.end]
    const search=query.search?.trim()
    if(search){const term=`%${search}%`;where.push(`(s.invoice_number LIKE ? OR c.name LIKE ? OR EXISTS (SELECT 1 FROM sale_items sx WHERE sx.sale_id=s.id AND sx.product_name_snapshot LIKE ?))`);params.push(term,term,term)}
    if(query.paymentMethod&&query.paymentMethod!=='all'){where.push(`EXISTS (SELECT 1 FROM sale_payments spx WHERE spx.sale_id=s.id AND spx.method=?)`);params.push(query.paymentMethod)}
    const returned=`COALESCE(rt.returned_paisa,0)`
    const derivedStatus=`CASE WHEN s.status='voided' THEN 'voided' WHEN s.status='returned' OR ${returned}>=s.total_paisa THEN 'returned' WHEN ${returned}>0 THEN 'partially_returned' ELSE 'completed' END`
    if(query.status&&query.status!=='all'){where.push(`${derivedStatus}=?`);params.push(query.status)}
    const from=`FROM sales s JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.cashier_id LEFT JOIN (SELECT sale_id,SUM(total_paisa) AS returned_paisa FROM sale_returns GROUP BY sale_id) rt ON rt.sale_id=s.id`
    const clause=where.join(' AND ')
    const total=Number((this.connection.prepare(`SELECT COUNT(*) AS value ${from} WHERE ${clause}`).get(...params) as SqlRow).value)
    const paging=paginate?' LIMIT ? OFFSET ?':''
    const rowParams=paginate?[...params,pageSize,(page-1)*pageSize]:params
    const raw=this.connection.prepare(`SELECT s.id,s.invoice_number,s.completed_at,c.name AS customer_name,u.name AS cashier_name,(SELECT COUNT(*) FROM sale_items si WHERE si.sale_id=s.id) AS item_count,s.total_paisa,${returned} AS returned_paisa,s.total_paisa-${returned} AS net_paisa,COALESCE((SELECT GROUP_CONCAT(method,', ') FROM sale_payments sp WHERE sp.sale_id=s.id),'Unpaid') AS payment_method,${derivedStatus} AS derived_status ${from} WHERE ${clause} ORDER BY s.completed_at DESC${paging}`).all(...rowParams) as SqlRow[]
    const rows=raw.map(row => ({id:String(row.id),invoiceNumber:String(row.invoice_number),completedAt:String(row.completed_at),customerName:String(row.customer_name),cashierName:String(row.cashier_name),itemCount:Number(row.item_count),totalPaisa:Number(row.total_paisa),returnedPaisa:Number(row.returned_paisa),netPaisa:Number(row.net_paisa),paymentMethod:String(row.payment_method),status:String(row.derived_status) as SalesListRow['status']}))
    return {rows,total,page,pageSize}
  }

  getSalesSnapshot(query: SalesListQuery): SalesSnapshot {
    const branch=this.connection.prepare('SELECT id FROM branches WHERE id=? AND is_active=1').get(query.branchId)
    if(!branch) throw new Error('The selected branch is unavailable.')
    const range=this.resolveSalesPeriod(query.period)
    const scalar=(sql:string,...params:(string|number)[])=>Number((this.connection.prepare(sql).get(...params) as SqlRow|undefined)?.value??0)
    const gross=(start:string,end:string)=>scalar(`SELECT COALESCE(SUM(total_paisa),0) AS value FROM sales WHERE branch_id=? AND status<>'voided' AND business_date BETWEEN ? AND ?`,query.branchId,start,end)
    const returns=(start:string,end:string)=>scalar(`SELECT COALESCE(SUM(total_paisa),0) AS value FROM sale_returns WHERE branch_id=? AND date(occurred_at,'+5 hours') BETWEEN ? AND ?`,query.branchId,start,end)
    const count=(start:string,end:string)=>scalar(`SELECT COUNT(*) AS value FROM sales WHERE branch_id=? AND status<>'voided' AND business_date BETWEEN ? AND ?`,query.branchId,start,end)
    const currentGross=gross(range.start,range.end),currentReturns=returns(range.start,range.end),currentCount=count(range.start,range.end)
    const previousGross=gross(range.previousStart,range.previousEnd),previousReturns=returns(range.previousStart,range.previousEnd),previousCount=count(range.previousStart,range.previousEnd)
    const totalSalesPaisa=currentGross-currentReturns,previousSales=previousGross-previousReturns
    const averageOrderPaisa=currentCount?Math.round(totalSalesPaisa/currentCount):0
    const previousAverage=previousCount?Math.round(previousSales/previousCount):0
    const salesResult=this.salesRows(query)
    let labels:string[]
    let saleMap:Map<string,number>,returnMap:Map<string,number>
    if(query.period==='today') {
      const hours=[8,10,12,14,16,18,20]
      labels=hours.map(hour=>`${hour>12?hour-12:hour} ${hour>=12?'PM':'AM'}`)
      const saleRows=this.connection.prepare(`SELECT CAST(strftime('%H',completed_at,'+5 hours') AS INTEGER) AS bucket,SUM(total_paisa) AS value FROM sales WHERE branch_id=? AND status<>'voided' AND business_date=? GROUP BY bucket`).all(query.branchId,range.end) as SqlRow[]
      const returnRows=this.connection.prepare(`SELECT CAST(strftime('%H',occurred_at,'+5 hours') AS INTEGER) AS bucket,SUM(total_paisa) AS value FROM sale_returns WHERE branch_id=? AND date(occurred_at,'+5 hours')=? GROUP BY bucket`).all(query.branchId,range.end) as SqlRow[]
      const bucket=(rows:SqlRow[])=>new Map(hours.map(hour=>[`${hour>12?hour-12:hour} ${hour>=12?'PM':'AM'}`,rows.filter(row=>Number(row.bucket)>=hour&&Number(row.bucket)<hour+2).reduce((sum,row)=>sum+Number(row.value),0)]))
      saleMap=bucket(saleRows);returnMap=bucket(returnRows)
    } else {
      const dates:string[]=[];for(let date=range.start;date<=range.end;date=addDays(date,1))dates.push(date)
      labels=dates
      saleMap=new Map((this.connection.prepare(`SELECT business_date AS label,SUM(total_paisa) AS value FROM sales WHERE branch_id=? AND status<>'voided' AND business_date BETWEEN ? AND ? GROUP BY business_date`).all(query.branchId,range.start,range.end) as SqlRow[]).map(row=>[String(row.label),Number(row.value)]))
      returnMap=new Map((this.connection.prepare(`SELECT date(occurred_at,'+5 hours') AS label,SUM(total_paisa) AS value FROM sale_returns WHERE branch_id=? AND date(occurred_at,'+5 hours') BETWEEN ? AND ? GROUP BY label`).all(query.branchId,range.start,range.end) as SqlRow[]).map(row=>[String(row.label),Number(row.value)]))
    }
    const chart=labels.map(label=>({label:query.period==='today'?label:labelDate(label),valuePaisa:saleMap.get(label)??0,returnedPaisa:returnMap.get(label)??0}))
    const paymentSales=this.connection.prepare(`SELECT sp.method,SUM(s.total_paisa) AS value FROM sales s JOIN sale_payments sp ON sp.sale_id=s.id WHERE s.branch_id=? AND s.status<>'voided' AND s.business_date BETWEEN ? AND ? GROUP BY sp.method`).all(query.branchId,range.start,range.end) as SqlRow[]
    const paymentReturns=this.connection.prepare(`SELECT refund_method AS method,SUM(total_paisa) AS value FROM sale_returns WHERE branch_id=? AND date(occurred_at,'+5 hours') BETWEEN ? AND ? GROUP BY refund_method`).all(query.branchId,range.start,range.end) as SqlRow[]
    const paymentMap=new Map<string,number>();for(const row of paymentSales)paymentMap.set(String(row.method),Number(row.value));for(const row of paymentReturns)paymentMap.set(String(row.method),(paymentMap.get(String(row.method))??0)-Number(row.value))
    const payments=Array.from(paymentMap,([method,amountPaisa])=>({method,amountPaisa:Math.max(0,amountPaisa)})).sort((a,b)=>b.amountPaisa-a.amountPaisa)
    return {businessDate:businessDate(this.now()),rangeLabel:range.label,comparisonLabel:range.comparison,totalSalesPaisa,salesChangePercent:percentageChange(totalSalesPaisa,previousSales),transactionCount:currentCount,transactionChangePercent:percentageChange(currentCount,previousCount),averageOrderPaisa,averageChangePercent:percentageChange(averageOrderPaisa,previousAverage),returnsPaisa:currentReturns,returnsChangePercent:percentageChange(currentReturns,previousReturns),chart,payments,sales:salesResult.rows,total:salesResult.total,page:salesResult.page,pageSize:salesResult.pageSize,pageCount:Math.max(1,Math.ceil(salesResult.total/salesResult.pageSize))}
  }

  getSalesDetail(branchId:string,saleId:string): SalesDetail {
    const row=this.connection.prepare(`SELECT s.*,c.name AS customer_name,c.phone AS customer_phone,u.name AS cashier_name,b.name AS branch_name,bu.name AS business_name,COALESCE((SELECT SUM(total_paisa) FROM sale_returns WHERE sale_id=s.id),0) AS returned_paisa,COALESCE((SELECT GROUP_CONCAT(method,', ') FROM sale_payments WHERE sale_id=s.id),'Unpaid') AS payment_method FROM sales s JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.cashier_id JOIN branches b ON b.id=s.branch_id JOIN businesses bu ON bu.id=s.business_id WHERE s.id=? AND s.branch_id=?`).get(saleId,branchId) as SqlRow|undefined
    if(!row) throw new Error('Sale was not found.')
    const returnedPaisa=Number(row.returned_paisa)
    const status=String(row.status)==='voided'?'voided':String(row.status)==='returned'||returnedPaisa>=Number(row.total_paisa)?'returned':returnedPaisa>0?'partially_returned':'completed'
    const lines=(this.connection.prepare(`SELECT si.*,COALESCE((SELECT SUM(quantity_milli) FROM sale_return_items sri WHERE sri.sale_item_id=si.id),0) AS returned_quantity FROM sale_items si WHERE si.sale_id=? ORDER BY rowid`).all(saleId) as SqlRow[]).map(item=>{const returned=Number(item.returned_quantity);return{id:String(item.id),productId:String(item.product_id),name:String(item.product_name_snapshot),quantityMilli:Number(item.quantity_milli),returnedQuantityMilli:returned,returnableQuantityMilli:Number(item.quantity_milli)-returned,unitPricePaisa:Number(item.unit_price_paisa),discountPaisa:Number(item.discount_paisa),lineTotalPaisa:Number(item.line_total_paisa)}})
    const returns=(this.connection.prepare(`SELECT id,return_number,reason,refund_method,total_paisa,occurred_at FROM sale_returns WHERE sale_id=? ORDER BY occurred_at DESC`).all(saleId) as SqlRow[]).map(item=>({id:String(item.id),returnNumber:String(item.return_number),reason:String(item.reason),refundMethod:String(item.refund_method),totalPaisa:Number(item.total_paisa),occurredAt:String(item.occurred_at)}))
    return {id:String(row.id),invoiceNumber:String(row.invoice_number),completedAt:String(row.completed_at),customerName:String(row.customer_name),customerPhone:row.customer_phone===null?null:String(row.customer_phone),cashierName:String(row.cashier_name),itemCount:lines.length,totalPaisa:Number(row.total_paisa),returnedPaisa,netPaisa:Number(row.total_paisa)-returnedPaisa,paymentMethod:String(row.payment_method),status:status as SalesDetail['status'],subtotalPaisa:Number(row.subtotal_paisa),discountPaisa:Number(row.discount_paisa),costPaisa:Number(row.cost_paisa),businessName:String(row.business_name),branchName:String(row.branch_name),lines,returns}
  }

  createSalesReturn(request:SalesReturnRequest) {
    if(!request||typeof request.branchId!=='string'||typeof request.saleId!=='string') throw new Error('Invalid return request.')
    const reason=request.reason?.trim()
    if(!reason||reason.length<3||reason.length>250) throw new Error('Enter a return reason between 3 and 250 characters.')
    if(!Array.isArray(request.lines)||!request.lines.length) throw new Error('Select at least one item to return.')
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      const sale=this.connection.prepare(`SELECT s.id,s.status,s.customer_id,s.business_date,(SELECT method FROM sale_payments WHERE sale_id=s.id LIMIT 1) AS payment_method FROM sales s WHERE s.id=? AND s.branch_id=?`).get(request.saleId,request.branchId) as SqlRow|undefined
      if(!sale) throw new Error('Sale was not found.')
      if(String(sale.status)==='voided') throw new Error('A voided sale cannot be returned.')
      if(String(sale.status)==='returned') throw new Error('This sale has already been fully returned.')
      const paymentMethod=String(sale.payment_method??'Unpaid')
      const seen=new Set<string>()
      const lines=request.lines.map(input=>{
        if(!input||typeof input.saleItemId!=='string'||seen.has(input.saleItemId)||!Number.isInteger(input.quantityMilli)||input.quantityMilli<=0) throw new Error('Return contains an invalid item quantity.')
        seen.add(input.saleItemId)
        const item=this.connection.prepare(`SELECT si.*,COALESCE((SELECT SUM(quantity_milli) FROM sale_return_items WHERE sale_item_id=si.id),0) AS returned_quantity,COALESCE((SELECT SUM(refund_paisa) FROM sale_return_items WHERE sale_item_id=si.id),0) AS refunded_paisa,COALESCE((SELECT SUM(cost_paisa) FROM sale_return_items WHERE sale_item_id=si.id),0) AS returned_cost FROM sale_items si WHERE si.id=? AND si.sale_id=?`).get(input.saleItemId,request.saleId) as SqlRow|undefined
        if(!item) throw new Error('A selected sale item was not found.')
        const remaining=Number(item.quantity_milli)-Number(item.returned_quantity)
        if(input.quantityMilli>remaining) throw new Error(`${String(item.product_name_snapshot)} return quantity exceeds the available quantity.`)
        const fullRemaining=input.quantityMilli===remaining
        const refund=fullRemaining?Number(item.line_total_paisa)-Number(item.refunded_paisa):Math.round(Number(item.line_total_paisa)*input.quantityMilli/Number(item.quantity_milli))
        const cost=fullRemaining?Math.round(Number(item.unit_cost_paisa)*Number(item.quantity_milli)/1000)-Number(item.returned_cost):Math.round(Number(item.unit_cost_paisa)*input.quantityMilli/1000)
        return {id:String(item.id),productId:String(item.product_id),name:String(item.product_name_snapshot),quantityMilli:input.quantityMilli,refundPaisa:refund,costPaisa:Math.max(0,cost)}
      })
      const totalPaisa=lines.reduce((sum,line)=>sum+line.refundPaisa,0),costPaisa=lines.reduce((sum,line)=>sum+line.costPaisa,0)
      if(totalPaisa<=0) throw new Error('Return amount must be greater than zero.')
      const now=this.now(),occurredAt=now.toISOString(),date=businessDate(now)
      let shift:SqlRow|undefined
      if(paymentMethod==='Cash'){shift=this.connection.prepare(`SELECT id FROM cash_shifts WHERE branch_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1`).get(request.branchId) as SqlRow|undefined;if(!shift)throw new Error('Open a cash shift before issuing a cash refund.')}
      const sequence=scalarValue(this.connection,`SELECT COUNT(*) AS value FROM sale_returns WHERE branch_id=? AND date(occurred_at,'+5 hours')=?`,request.branchId,date)+1
      const returnId=`sale-return-${randomUUID()}`,returnNumber=`RET-${date.replaceAll('-','')}-${String(sequence).padStart(4,'0')}`
      this.connection.prepare('INSERT INTO sale_returns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(returnId,request.saleId,request.branchId,returnNumber,reason,paymentMethod,totalPaisa,costPaisa,OWNER_ID,occurredAt)
      const insertItem=this.connection.prepare('INSERT INTO sale_return_items VALUES (?, ?, ?, ?, ?, ?, ?)')
      for(const line of lines){insertItem.run(`sale-return-item-${randomUUID()}`,returnId,line.id,line.productId,line.quantityMilli,line.refundPaisa,line.costPaisa);this.connection.prepare('UPDATE stock_levels SET quantity_milli=quantity_milli+?,updated_at=? WHERE branch_id=? AND product_id=?').run(line.quantityMilli,occurredAt,request.branchId,line.productId);const stock=this.connection.prepare('SELECT quantity_milli FROM stock_levels WHERE branch_id=? AND product_id=?').get(request.branchId,line.productId) as SqlRow;this.connection.prepare('INSERT INTO stock_movements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`stock-${randomUUID()}`,request.branchId,line.productId,'sale_return',line.quantityMilli,Number(stock.quantity_milli),'sale_return',returnId,returnNumber,occurredAt)}
      if(paymentMethod==='Cash')this.connection.prepare('INSERT INTO cash_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`cash-${randomUUID()}`,String(shift!.id),request.branchId,date,'sale_refund','out',totalPaisa,'Cash',returnId,occurredAt)
      if(paymentMethod==='Udhaar')this.connection.prepare('INSERT INTO customer_ledger VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`customer-ledger-${randomUUID()}`,request.branchId,String(sale.customer_id),'sale_return',0,totalPaisa,returnId,occurredAt)
      const remaining=scalarValue(this.connection,`SELECT COALESCE(SUM(si.quantity_milli-COALESCE((SELECT SUM(sri.quantity_milli) FROM sale_return_items sri WHERE sri.sale_item_id=si.id),0)),0) AS value FROM sale_items si WHERE si.sale_id=?`,request.saleId)
      if(remaining===0)this.connection.prepare(`UPDATE sales SET status='returned' WHERE id=?`).run(request.saleId)
      this.connection.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`audit-${randomUUID()}`,request.branchId,OWNER_ID,'Sale Return','sale_return',returnId,'Sale return completed',`${returnNumber} · ${String((this.connection.prepare('SELECT invoice_number FROM sales WHERE id=?').get(request.saleId) as SqlRow).invoice_number)}`,occurredAt)
      this.connection.exec('COMMIT')
      return{returnId,returnNumber,refundMethod:paymentMethod,totalPaisa,occurredAt}
    }catch(error){this.connection.exec('ROLLBACK');throw error}
  }

  exportSalesCsv(query:SalesListQuery) {
    const rows=this.salesRows(query,false).rows
    const header=['invoice','date_time','customer','cashier','items','gross_amount','returned_amount','net_amount','payment_method','status']
    return [header,...rows.map(row=>[row.invoiceNumber,row.completedAt,row.customerName,row.cashierName,row.itemCount,row.totalPaisa/100,row.returnedPaisa/100,row.netPaisa/100,row.paymentMethod,row.status])].map(row=>row.map(csvCell).join(',')).join('\r\n')
  }

  search(term: string, branchId: string): GlobalSearchResult[] {
    const query = `%${term.trim()}%`
    if (term.trim().length < 2) return []
    const products = this.connection.prepare(`SELECT id,name,sku,barcode FROM products WHERE is_active=1 AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) ORDER BY name LIMIT 5`).all(query,query,query) as SqlRow[]
    const customers = this.connection.prepare(`SELECT id,name,phone FROM customers WHERE is_active=1 AND is_walk_in=0 AND (name LIKE ? OR phone LIKE ?) ORDER BY name LIMIT 4`).all(query,query) as SqlRow[]
    const suppliers = this.connection.prepare(`SELECT id,name,phone FROM suppliers WHERE is_active=1 AND (name LIKE ? OR phone LIKE ?) ORDER BY name LIMIT 4`).all(query,query) as SqlRow[]
    const sales = this.connection.prepare(`SELECT id,invoice_number,total_paisa FROM sales WHERE branch_id=? AND invoice_number LIKE ? ORDER BY completed_at DESC LIMIT 4`).all(branchId,query) as SqlRow[]
    return [
      ...products.map(row => ({ id:String(row.id),type:'Product' as const,title:String(row.name),subtitle:`SKU: ${String(row.sku)}${row.barcode ? ` · ${String(row.barcode)}` : ''}`,targetPage:'Products' as const })),
      ...customers.map(row => ({ id:String(row.id),type:'Customer' as const,title:String(row.name),subtitle:String(row.phone ?? 'No phone'),targetPage:'Customers' as const })),
      ...suppliers.map(row => ({ id:String(row.id),type:'Supplier' as const,title:String(row.name),subtitle:String(row.phone ?? 'No phone'),targetPage:'Suppliers' as const })),
      ...sales.map(row => ({ id:String(row.id),type:'Sale' as const,title:String(row.invoice_number),subtitle:`Rs ${(Number(row.total_paisa)/100).toLocaleString('en-PK')}`,targetPage:'Sales' as const })),
    ].slice(0, 10)
  }
}
