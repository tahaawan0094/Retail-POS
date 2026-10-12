import { app, BrowserWindow, dialog, ipcMain, powerMonitor, safeStorage, type IpcMainInvokeEvent } from 'electron'
import { generateKeyPairSync } from 'node:crypto'
import { LicenseClient } from './licensing/client.mjs'
import { LicenseAuthority } from './licensing/authority.mjs'
import { createLicenseServer } from './licensing/server.mjs'
import type { LicenseTrust } from '../src/types/licensing.js'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { DashboardChartPeriod, DashboardDateRange, DashboardQuery, PosCompleteSaleRequest, PosCreateCustomerInput, PosCreateProductInput, PosCartLineInput, ProductCatalogQuery, ProductSaveInput, SalesListQuery, SalesReturnRequest } from '../src/types/desktop-api.js'
import type { BranchActiveRequest, BranchCreateRequest, BranchUpdateRequest, TransferCancelRequest, TransferDispatchRequest, TransferQuery, TransferReceiveRequest } from '../src/types/branches.js'
import type { ReportQuery } from '../src/types/reports.js'
import { VertexiaDatabase } from './database/database.mjs'
import { AuthRepository } from './database/auth.mjs'
import { BackupService } from './backup.mjs'
import type { CustomerCollectRequest, CustomerCreateRequest, CustomerQuery, CustomerUpdateRequest, ExpensePostRequest, ExpenseQuery, ExpenseReverseRequest } from '../src/types/accounts.js'
import type { BackupRestoreRequest, CashCloseRequest, CashMoveRequest } from '../src/types/recovery.js'
import { authorizeIpc, scopeOperation, licenseBranches } from './ipc-policy.mjs'
import { requiresTransactionLicense } from './licensing/policy.mjs'
import type { BusinessSetupInput, StaffCreateInput, StaffUpdateInput } from '../src/types/auth.js'
import type { PurchaseReceiveRequest, StockAdjustmentRequest, SupplierPayRequest } from '../src/types/desktop-api.js'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const developmentUrl = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined
const smokeTarget = !app.isPackaged ? process.env.VERTEXIA_SMOKE_TEST : undefined
if (smokeTarget && process.env.VERTEXIA_SMOKE_USER_DATA) app.setPath('userData', process.env.VERTEXIA_SMOKE_USER_DATA)
if (developmentUrl) app.setName('Vertexia Retail POS Development')

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()

let mainWindow: BrowserWindow | null = null
let database: VertexiaDatabase | null = null
let databasePath = ''
let auth: AuthRepository | null = null
let backups: BackupService | null = null
let maintenance = false
let restoreNotice = ''
let smokeExportPath = ''
let licensing: LicenseClient | null = null
let smokeAuthority: LicenseAuthority | null = null
let smokeLicense: ReturnType<LicenseAuthority['issue']> | null = null
let smokeLicenseServer: ReturnType<typeof createLicenseServer> | null = null

function createAuth() { return new AuthRepository(database!.connection, undefined, channel => licensing!.authorize(channel)) }
function licenseOwner() {
  const id = auth!.require('settings.manage').userId
  return () => {
    if (maintenance || !auth || auth.require('settings.manage').userId !== id) throw new Error('Session changed. License action cancelled.')
  }
}

function isDateRange(value: unknown): value is DashboardDateRange {
  return value === 'today' || value === 'yesterday' || value === 'this_week'
}

function isChartPeriod(value: unknown): value is DashboardChartPeriod {
  return value === 'today' || value === '7_days' || value === '30_days'
}

function validateDashboardQuery(value: unknown): DashboardQuery {
  if (!value || typeof value !== 'object') throw new Error('Invalid dashboard query.')
  const query = value as Partial<DashboardQuery>
  if (typeof query.branchId !== 'string' || !query.branchId) throw new Error('A branch is required.')
  if (!isDateRange(query.dateRange) || !isChartPeriod(query.chartPeriod)) throw new Error('Invalid dashboard filters.')
  return { branchId:query.branchId,dateRange:query.dateRange,chartPeriod:query.chartPeriod }
}

function trustedUrl(value: string): boolean {
  try {
    const candidate = new URL(value)
    candidate.hash = ''
    const expected = developmentUrl ? new URL(developmentUrl.replace(/\/$/, '') + '/') : new URL(pathToFileURL(join(moduleDirectory, '../../dist/index.html')).href)
    expected.hash = ''
    return candidate.href === expected.href
  } catch { return false }
}
function handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !trustedUrl(event.senderFrame.url)) throw new Error('Untrusted desktop request.')
    if (maintenance && channel !== 'auth:status') throw new Error(auth ? 'Data restore is in progress. Please wait before using the POS.' : restoreNotice || 'Data recovery requires support.')
    try { authorizeIpc(auth!, database!, channel, args) }
    catch (error) { if (!auth?.current()) mainWindow.webContents.send('auth:session-expired'); throw error }
    const session = auth?.current()
    licensing!.authorize(channel)
    if (requiresTransactionLicense(channel)) for (const id of licenseBranches(database!, channel, args, session?.branchId)) licensing!.authorize(channel, id)
    if (session) scopeOperation(channel, args, session.userId)
    return listener(event, ...args)
  })
}

function reportBranches(query: ReportQuery) {
  const session = auth!.require('reports.read', query.branchId)
  const ids = query.allBranches ? session.branches.map(branch => branch.id) : [query.branchId]
  for (const id of ids) auth!.require('reports.read',id)
  return ids
}
function registerIpc() {
  handle('licensing:status', () => licensing!.status())
  handle('licensing:activate', (_event, key) => licensing!.activate(key, licenseOwner()))
  handle('licensing:refresh', () => licensing!.refresh(licenseOwner()))
  handle('branches:list', () => database!.branches.list())
  handle('branches:create', (_event, request) => database!.branches.create(request as BranchCreateRequest))
  handle('branches:update', (_event, request) => database!.branches.update(request as BranchUpdateRequest))
  handle('branches:set-active', (_event, request) => database!.branches.setActive(request as BranchActiveRequest))
  handle('transfers:list', (_event, query) => database!.transfers.list(query as TransferQuery))
  handle('transfers:detail', (_event, branchId, id) => database!.transfers.detail(requiredId(branchId),requiredId(id)))
  handle('transfers:dispatch', (_event, request) => database!.transfers.dispatch(request as TransferDispatchRequest))
  handle('transfers:receive', (_event, request) => database!.transfers.receive(request as TransferReceiveRequest))
  handle('transfers:cancel', (_event, request) => database!.transfers.cancel(request as TransferCancelRequest))
  handle('reports:snapshot', (_event, query) => database!.reports.snapshot(query as ReportQuery,reportBranches(query as ReportQuery)))
  handle('reports:valuation', (_event, branchId) => database!.reports.valuation(requiredId(branchId)))
  handle('reports:export-csv', async (_event, input) => {
    const query=input as ReportQuery,caller=auth!.current()!.userId
    // Validate before opening a dialog and re-check the session after it closes.
    database!.reports.snapshot(query,reportBranches(query))
    const result=smokeTarget==='reports' ? {canceled:false,filePath:join(app.getPath('userData'),'reports.csv')} : await dialog.showSaveDialog(mainWindow!,{title:'Export report',defaultPath:'vertexia-'+query.section+'-'+query.dateFrom+'.csv',filters:[{name:'CSV file',extensions:['csv']}]})
    if(result.canceled||!result.filePath)return{canceled:true}
    authorizeIpc(auth!,database!,'reports:export-csv',[query])
    if(auth!.current()!.userId!==caller)throw new Error('Session changed. Export was cancelled.')
    if(!result.filePath.toLowerCase().endsWith('.csv'))throw new Error('Save this report as a .csv file.')
    await writeFile(result.filePath,database!.reports.exportCsv(query,reportBranches(query)),'utf8')
    return{canceled:false,path:result.filePath}
  })
  handle('customers:list', (_event, query) => database!.accounts.customers(query as CustomerQuery))
  handle('customers:detail', (_event, branchId, customerId, page) => database!.accounts.customerDetail(requiredId(branchId), requiredId(customerId), page === undefined ? 1 : requiredInteger(page, 'page')))
  handle('customers:receipt', (_event, branchId, receiptId) => database!.accounts.receipt(requiredId(branchId), requiredId(receiptId)))
  handle('customers:create', (_event, request) => database!.accounts.createCustomer(request as CustomerCreateRequest))
  handle('customers:update', (_event, request) => database!.accounts.updateCustomer(request as CustomerUpdateRequest))
  handle('customers:collect', (_event, request) => database!.accounts.collect(request as CustomerCollectRequest))
  handle('expenses:list', (_event, query) => database!.accounts.expenses(query as ExpenseQuery))
  handle('expenses:post', (_event, request) => database!.accounts.postExpense(request as ExpensePostRequest))
  handle('expenses:reverse', (_event, request) => database!.accounts.reverseExpense(request as ExpenseReverseRequest))
  handle('cash:get-snapshot', (_event, branchId) => database!.cash.snapshot(requiredId(branchId), auth!.current()!.role === 'Cashier' ? auth!.current()!.userId : undefined))
  handle('cash:close-shift', (_event, request) => database!.cash.close(request as CashCloseRequest))
  handle('cash:move', (_event, request) => database!.cash.move(request as CashMoveRequest))
  handle('backup:get-status', () => backups!.status())
  handle('backup:create', () => backups!.create())
  handle('backup:export', async (_event, id) => {
    const caller = auth!.require('backup.manage').userId
    const record = backups!.status().records.find(record => record.id === requiredId(id))
    if (!record) throw new Error('Backup is unavailable.')
    const result = smokeTarget === 'recovery' ? { canceled: false, filePath: join(app.getPath('userData'), 'exported-smoke-backup.sqlite') } : await dialog.showSaveDialog(mainWindow!, { title: 'Save a backup copy', defaultPath: record.fileName, filters: [{ name: 'Vertexia SQLite backup', extensions: ['sqlite'] }] })
    if (result.canceled || !result.filePath) return { canceled: true }
    if (auth!.require('backup.manage').userId !== caller) throw new Error('Session changed. Export was cancelled.')
    const exported = await backups!.export(record.id, result.filePath)
    if (smokeTarget === 'recovery') smokeExportPath = exported.path
    return { canceled: false, path: exported.path }
  })
  handle('backup:preview', async () => {
    const caller = auth!.require('backup.manage').userId
    const result = smokeTarget === 'recovery' ? { canceled: false, filePaths: [smokeExportPath] } : await dialog.showOpenDialog(mainWindow!, { title: 'Choose a Vertexia backup to review', properties: ['openFile'], filters: [{ name: 'Vertexia SQLite backup', extensions: ['sqlite'] }] })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    if (auth!.require('backup.manage').userId !== caller) throw new Error('Session changed. Restore selection was cancelled.')
    return { canceled: false, summary: await backups!.preview(result.filePaths[0], caller) }
  })
  handle('backup:cancel', (_event, token) => backups!.cancel(requiredId(token), auth!.current()!.userId))
  handle('backup:restore', async (_event, input) => {
    const request = input as BackupRestoreRequest
    if (!request || typeof request !== 'object') throw new Error('Invalid restore request.')
    const ownerId = await auth!.verifyForRestore(request.currentPassword)
    let result: { safetyBackupPath: string }
    try { result = await backups!.restore(request, ownerId, {
      authorize: () => { if (auth!.require('backup.manage').userId !== ownerId) throw new Error('Session changed. Restore was cancelled.') },
      close: () => { auth!.logout(); database!.close(); database = null; auth = null },
      reopen: () => { database = new VertexiaDatabase(databasePath); auth = createAuth() },
      setMaintenance: value => { maintenance = value },
      quiesce: () => auth!.whenIdle(),
    })
    } catch (error) {
      if (!auth?.current()) {
        restoreNotice = error instanceof Error ? error.message : 'Restore did not complete.'
        if (auth) restoreNotice += ' Sign in again to inspect the retained data.'
        mainWindow!.webContents.send('auth:session-expired')
      }
      throw error
    }
    restoreNotice = `Backup restored. Sign in using the owner credentials from that backup. Safety copy: ${result.safetyBackupPath}`
    mainWindow!.webContents.send('auth:session-expired')
    return result
  })
  handle('auth:status', () => ({ ...(auth?.status() ?? { needsSetup: false, businessName: 'Vertexia data recovery', session: null }), notice: restoreNotice }))
  handle('auth:setup', (_event, input) => auth!.setup(input as BusinessSetupInput))
  handle('auth:login', async (_event, username, password) => { const session = await auth!.login(username, password); restoreNotice = ''; return session })
  handle('auth:logout', () => auth!.logout())
  handle('auth:select-branch', (_event, branchId) => auth!.selectBranch(requiredId(branchId)))
  handle('auth:list-users', () => auth!.listUsers())
  handle('auth:create-user', (_event, input) => auth!.createUser(input as StaffCreateInput))
  handle('auth:update-user', (_event, input) => auth!.updateUser(input as StaffUpdateInput))
  handle('auth:reset-password', (_event, userId, password) => auth!.resetPassword(requiredId(userId), password as string))
  handle('auth:change-password', (_event, current, next) => auth!.changePassword(current as string, next as string))
  handle('retail:get-snapshot', (_event, branchId: unknown) => database!.retail.getSnapshot(requiredId(branchId)))
  handle('retail:adjust-stock', (_event, request: unknown) => database!.retail.adjustStock(request as StockAdjustmentRequest))
  handle('retail:receive-purchase', (_event, request: unknown) => database!.retail.receivePurchase(request as PurchaseReceiveRequest))
  handle('retail:pay-supplier', (_event, request: unknown) => database!.retail.paySupplier(request as SupplierPayRequest))
  handle('dashboard:get-snapshot', (_event, query: unknown) => {
    const result = database!.getDashboardSnapshot(validateDashboardQuery(query))
    result.branches = result.branches.filter(branch => auth!.current()!.branches.some(assigned => assigned.id === branch.id))
    return result
  })
  handle('dashboard:search', (_event, term: unknown, branchId: unknown) => {
    if (typeof term !== 'string' || typeof branchId !== 'string') throw new Error('Invalid search request.')
    return database!.search(term.slice(0, 100), branchId)
  })
  handle('system:get-database-path', () => databasePath)
  handle('pos:get-bootstrap', (_event, branchId: unknown) => {
    const data = database!.getPosBootstrap(requiredId(branchId))
    if (data.activeShiftId && auth!.current()!.role === 'Cashier') {
      const owner = database!.connection.prepare('SELECT cashier_id FROM cash_shifts WHERE id=?').get(data.activeShiftId)
      if (owner?.cashier_id !== auth!.current()!.userId) data.activeShiftId = null
    }
    return data
  })
  handle('pos:complete-sale', (_event, request: unknown) => database!.completePosSale(request as PosCompleteSaleRequest))
  handle('pos:hold-sale', (_event, branchId: unknown, customerId: unknown, lines: unknown) => database!.holdPosSale(requiredId(branchId),requiredId(customerId),lines as PosCartLineInput[]))
  handle('pos:resume-held-sale', (_event, id: unknown) => database!.resumePosSale(requiredId(id)))
  handle('pos:delete-held-sale', (_event, id: unknown) => database!.deleteHeldPosSale(requiredId(id)))
  handle('pos:open-shift', (_event, branchId: unknown, openingCashPaisa: unknown, operationId: unknown) => database!.openPosShift(requiredId(branchId),requiredInteger(openingCashPaisa,'opening cash'),operationId as string | undefined))
  handle('pos:create-product', (_event, branchId: unknown, input: unknown) => database!.createPosProduct(requiredId(branchId),input as PosCreateProductInput))
  handle('pos:create-customer', (_event, input: unknown) => database!.createPosCustomer(input as PosCreateCustomerInput))
  handle('products:list', (_event, query: unknown) => database!.listProducts(query as ProductCatalogQuery))
  handle('products:save', (_event, branchId: unknown, input: unknown) => database!.saveProduct(requiredId(branchId),input as ProductSaveInput))
  handle('products:toggle-status', (_event, branchId: unknown, id: unknown) => database!.toggleProductStatus(requiredId(branchId),requiredId(id)))
  handle('products:import-csv', (_event, branchId: unknown, csv: unknown) => {
    if(typeof csv!=='string') throw new Error('Invalid CSV file.')
    return database!.importProductsCsv(requiredId(branchId),csv)
  })
  handle('products:export-csv', async (_event, branchId: unknown) => {
    const result=await dialog.showSaveDialog(mainWindow!,{ title:'Export Products',defaultPath:`vertexia-products-${new Date().toISOString().slice(0,10)}.csv`,filters:[{name:'CSV file',extensions:['csv']}] })
    if(result.canceled||!result.filePath) return {canceled:true}
    authorizeIpc(auth!, database!, 'products:export-csv', [branchId])
    await writeFile(result.filePath,database!.exportProductsCsv(requiredId(branchId)),'utf8')
    return {canceled:false,path:result.filePath}
  })
  handle('sales:get-snapshot', (_event, query:unknown) => database!.getSalesSnapshot(query as SalesListQuery))
  handle('sales:get-detail', (_event, branchId:unknown, saleId:unknown) => {
    const result = database!.getSalesDetail(requiredId(branchId),requiredId(saleId))
    if (!auth!.current()!.permissions.includes('dashboard.read')) result.costPaisa = 0
    return result
  })
  handle('sales:create-return', (_event, request:unknown) => database!.createSalesReturn(request as SalesReturnRequest))
  handle('sales:export-csv', async (_event, query:unknown) => {
    const salesQuery=query as SalesListQuery
    const result=await dialog.showSaveDialog(mainWindow!,{title:'Export Sales',defaultPath:`vertexia-sales-${new Date().toISOString().slice(0,10)}.csv`,filters:[{name:'CSV file',extensions:['csv']}]})
    if(result.canceled||!result.filePath)return{canceled:true}
    authorizeIpc(auth!, database!, 'sales:export-csv', [query])
    await writeFile(result.filePath,database!.exportSalesCsv(salesQuery),'utf8')
    return{canceled:false,path:result.filePath}
  })
}

function requiredId(value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 100) throw new Error('Invalid identifier.')
  return value
}

function requiredInteger(value: unknown, label: string) {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`Invalid ${label}.`)
  return Number(value)
}

async function createWindow() {
  const initialHash = smokeTarget === 'licensing' ? 'license' : smokeTarget === 'branches' ? 'branches' : smokeTarget === 'reports' ? 'reports' : smokeTarget === 'accounts' ? 'customers' : smokeTarget === 'recovery' ? 'cash-shifts' : smokeTarget === 'retail' ? 'purchases' : smokeTarget === 'pos' || smokeTarget === 'products' ? smokeTarget : 'dashboard'
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 360,
    minHeight: 640,
    show: false,
    backgroundColor: '#f2f7fd',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(moduleDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !smokeTarget,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action:'deny' }))
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Vertexia preload failed at ${preloadPath}:`, error)
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = trustedUrl(url)
    if (!allowed) event.preventDefault()
  })
  mainWindow.once('ready-to-show', () => { if (!smokeTarget) mainWindow?.show() })
  if (developmentUrl) await mainWindow.loadURL(`${developmentUrl}/#${initialHash}`)
  else await mainWindow.loadFile(join(moduleDirectory, '../../dist/index.html'), { hash:initialHash })

  if (smokeTarget) {
    try {
      if (smokeTarget === 'retail' || smokeTarget === 'auth' || smokeTarget === 'recovery' || smokeTarget === 'accounts' || smokeTarget === 'reports' || smokeTarget === 'branches') await mainWindow.webContents.session.enableNetworkEmulation({ offline:true })
      await mainWindow.webContents.executeJavaScript(await readFile(join(moduleDirectory, '../../scripts/auth-browser-setup.js'), 'utf8'))
    } catch (error) { console.error('VERTEXIA_AUTH_SETUP_FAILED', error); app.exit(1); return }
  }
  if (smokeTarget === 'licensing') {
    try {
      const script = await readFile(join(moduleDirectory, '../../scripts/licensing-browser-smoke.js'), 'utf8')
      const run = (phase: string, value = '') => mainWindow!.webContents.executeJavaScript('(' + script + ')(' + JSON.stringify(phase) + ',' + JSON.stringify(phase === 'activate' ? smokeLicense!.activationKey : value) + ')')
      const activation = await run('activate')
      const testBranchId = await run('branch-create') as string
      await licensing!.refresh()
      const testBranch = smokeAuthority!.db.prepare('SELECT id FROM company_branches WHERE local_id=?').get(testBranchId)!
      smokeAuthority!.changeBranchStatus(String(testBranch.id), 'suspended', 'Desktop smoke individual branch lock')
      const branchLock = await run('branch-lock', testBranchId)
      smokeAuthority!.changeBranchStatus(String(testBranch.id), 'active', 'Desktop smoke individual branch unlock')
      const branchUnlock = await run('branch-unlock', testBranchId)
      smokeAuthority!.changeStatus(smokeLicense!.licenseId, 'suspended', 'Desktop smoke suspension')
      const suspension = await run('suspend')
      smokeAuthority!.renew(smokeLicense!.licenseId, Date.now() + 60 * 86400000, 'Desktop smoke renewal')
      smokeAuthority!.changeStatus(smokeLicense!.licenseId, 'active', 'Desktop smoke resume')
      const renewal = await run('renew')
      smokeLicenseServer!.close(); smokeLicenseServer = null
      const offline = await run('offline')
      if (process.env.VERTEXIA_SMOKE_SCREENSHOT) await writeFile(process.env.VERTEXIA_SMOKE_SCREENSHOT, (await mainWindow.webContents.capturePage()).toPNG())
      console.log('VERTEXIA_LICENSING_SMOKE', JSON.stringify({ activation, branchLock, branchUnlock, suspension, renewal, offline }))
      app.exit(0)
    } catch (error) { console.error('VERTEXIA_LICENSING_SMOKE_FAILED', error); app.exit(1) }
    return
  }
  if (smokeTarget === 'retail' || smokeTarget === 'auth' || smokeTarget === 'recovery' || smokeTarget === 'accounts' || smokeTarget === 'reports' || smokeTarget === 'branches') {
    try {
      await mainWindow.webContents.session.enableNetworkEmulation({ offline:true })
      const script = await readFile(join(moduleDirectory, smokeTarget === 'branches' ? '../../scripts/branches-browser-smoke.js' : smokeTarget === 'reports' ? '../../scripts/reports-browser-smoke.js' : smokeTarget === 'accounts' ? '../../scripts/accounts-browser-smoke.js' : smokeTarget === 'recovery' ? '../../scripts/recovery-browser-smoke.js' : smokeTarget === 'auth' ? '../../scripts/auth-browser-smoke.js' : '../../scripts/retail-browser-smoke.js'), 'utf8')
      const running = mainWindow.webContents.executeJavaScript(script)
      // The branch smoke driver uses the real company authority for approvals. No renderer
      // administration API exists; these markers are used only in isolated development tests.
      let finished = false
      void running.then(() => { finished = true }, () => { finished = true })
      if (smokeTarget === 'branches') while (!finished) {
        const pending = await mainWindow.webContents.executeJavaScript('window.__vertexiaSmokeBranchApproval === "requested"')
        if (pending) {
          await licensing!.refresh()
          const branches = smokeAuthority!.db.prepare("SELECT id FROM company_branches WHERE status='pending'").all()
          for (const branch of branches) smokeAuthority!.changeBranchStatus(String(branch.id), 'active', 'Isolated branch workflow smoke approval')
          await licensing!.refresh()
          await mainWindow.webContents.executeJavaScript('window.__vertexiaSmokeBranchApproval = "approved"')
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const result = await running
      await mainWindow.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 300))')
      if (process.env.VERTEXIA_SMOKE_SCREENSHOT) await writeFile(process.env.VERTEXIA_SMOKE_SCREENSHOT, (await mainWindow.webContents.capturePage()).toPNG())
      console.log(smokeTarget === 'branches' ? 'VERTEXIA_BRANCHES_SMOKE' : smokeTarget === 'reports' ? 'VERTEXIA_REPORTS_SMOKE' : smokeTarget === 'accounts' ? 'VERTEXIA_ACCOUNTS_SMOKE' : smokeTarget === 'recovery' ? 'VERTEXIA_RECOVERY_SMOKE' : smokeTarget === 'auth' ? 'VERTEXIA_AUTH_SMOKE' : 'VERTEXIA_RETAIL_SMOKE',JSON.stringify(result))
      app.exit(0)
    } catch(error) { console.error('VERTEXIA_RETAIL_SMOKE_FAILED',error);app.exit(1) }
    return
  }
  if (smokeTarget) {
    const result = await mainWindow.webContents.executeJavaScript(`new Promise(resolve => {
      let attempts = 0;
      const timer = setInterval(() => {
        const dashboardHeading = document.querySelector('.dashboard h1')?.textContent || '';
        const posReady = Boolean(document.querySelector('.pos-screen'));
        const productsReady = Boolean(document.querySelector('.products-page .catalog-table-card,.products-page .catalog-grid-view')) && !document.querySelector('.products-loading');
        const error = document.querySelector('.dashboard-state.error,.pos-runtime-state.error,.pos-toast.error')?.textContent || '';
        if (dashboardHeading || posReady || productsReady || error || attempts++ > 60) {
          clearInterval(timer);
          resolve({ api: typeof window.vertexia === 'object', dashboardHeading, posReady, productsReady, error });
        }
      }, 100);
    })`)
    console.log('VERTEXIA_DESKTOP_SMOKE',JSON.stringify(result))
    const ready = smokeTarget === 'pos' ? result.posReady : smokeTarget === 'products' ? result.productsReady : result.dashboardHeading
    app.exit(result.api && ready && !result.error ? 0 : 1)
  }
}

app.whenReady().then(async () => {
  databasePath = join(app.getPath('userData'), 'data', 'vertexia.db')
  database = new VertexiaDatabase(databasePath)
  let trust: LicenseTrust | null = null
  if (smokeTarget) {
    const keys = generateKeyPairSync('ed25519')
    smokeAuthority = new LicenseAuthority(join(app.getPath('userData'), 'smoke-company.db'), keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
    smokeLicense = smokeAuthority.issue('Smoke Test Business', Date.now() + 30 * 86400000)
    smokeLicenseServer = createLicenseServer(smokeAuthority)
    await new Promise<void>(resolve => smokeLicenseServer!.listen(0, '127.0.0.1', resolve))
    smokeLicenseServer.unref()
    const address = smokeLicenseServer.address()
    if (!address || typeof address === 'string') throw new Error('Smoke license server did not start.')
    trust = { serviceUrl: 'http://127.0.0.1:' + address.port, issuerPublicKey: smokeAuthority.publicKey }
  } else {
    const trustPath = app.isPackaged ? join(process.resourcesPath, 'licensing-trust.json') : process.env.VERTEXIA_LICENSE_CONFIG
    if (trustPath) {
      try { trust = JSON.parse(await readFile(trustPath, 'utf8')) as LicenseTrust }
      catch { trust = { serviceUrl: 'invalid', issuerPublicKey: '' } }
    }
  }
  licensing = new LicenseClient({ path: join(app.getPath('userData'), 'licensing', 'device.bin'), trust, allowLocal: !app.isPackaged,
    binding: () => String(database!.connection.prepare("SELECT value FROM app_meta WHERE key='installation_id'").get()!.value),
    currentBranch: () => auth?.current()?.branchId,
    inventory: () => ({
      businessName: String(database!.connection.prepare('SELECT name FROM businesses ORDER BY created_at LIMIT 1').get()!.name),
      ownerName: String(database!.connection.prepare("SELECT name FROM users WHERE role='Owner' AND is_active=1 ORDER BY created_at LIMIT 1").get()!.name),
      branches: database!.connection.prepare('SELECT id,name,code,city FROM branches ORDER BY code,id').all().map(b => ({ id: String(b.id), name: String(b.name), code: String(b.code), city: String(b.city) })),
    }),
    protector: {
      encrypt: value => { if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure device storage is unavailable.'); return safeStorage.encryptString(value) },
      decrypt: value => { if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure device storage is unavailable.'); return safeStorage.decryptString(value) },
    },
  })
  if (smokeTarget && smokeTarget !== 'licensing') await licensing.activate(smokeLicense!.activationKey)
  auth = createAuth()
  backups = new BackupService(() => database!, databasePath, join(app.getPath('userData'), 'data', 'backups'))
  const lockSession = () => { auth?.logout(); mainWindow?.webContents.send('auth:session-expired') }
  powerMonitor.on('suspend', lockSession)
  powerMonitor.on('lock-screen', lockSession)
  registerIpc()
  await createWindow()
  if (!smokeTarget) {
    void licensing.automatic()
    const licenseTimer = setInterval(() => { if (!maintenance) void licensing!.automatic() }, 10000)
    licenseTimer.unref()
    void backups.automatic()
    const timer = setInterval(() => { if (!maintenance) void backups!.automatic() }, 15 * 60 * 1000)
    timer.unref()
  }
})

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('window-all-closed', () => app.quit())
let waitingToQuit = false
app.on('before-quit', event => {
  if (backups?.status().busy) { event.preventDefault(); if (!waitingToQuit) { waitingToQuit = true; void backups.whenIdle().then(() => app.quit()) } }
})
app.on('will-quit', () => { smokeLicenseServer?.close(); smokeAuthority?.close(); database?.close() })
