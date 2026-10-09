import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DashboardChartPeriod, DashboardDateRange, DashboardQuery, PosCompleteSaleRequest, PosCreateCustomerInput, PosCreateProductInput, PosCartLineInput, ProductCatalogQuery, ProductSaveInput, SalesListQuery, SalesReturnRequest } from '../src/types/desktop-api.js'
import { VertexiaDatabase } from './database/database.mjs'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const developmentUrl = process.env.VITE_DEV_SERVER_URL
if (developmentUrl) app.setName('Vertexia Retail POS Development')

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()

let mainWindow: BrowserWindow | null = null
let database: VertexiaDatabase | null = null
let databasePath = ''

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

function registerIpc() {
  ipcMain.handle('dashboard:get-snapshot', (_event, query: unknown) => database!.getDashboardSnapshot(validateDashboardQuery(query)))
  ipcMain.handle('dashboard:search', (_event, term: unknown, branchId: unknown) => {
    if (typeof term !== 'string' || typeof branchId !== 'string') throw new Error('Invalid search request.')
    return database!.search(term.slice(0, 100), branchId)
  })
  ipcMain.handle('system:get-database-path', () => databasePath)
  ipcMain.handle('pos:get-bootstrap', (_event, branchId: unknown) => database!.getPosBootstrap(requiredId(branchId)))
  ipcMain.handle('pos:complete-sale', (_event, request: unknown) => database!.completePosSale(request as PosCompleteSaleRequest))
  ipcMain.handle('pos:hold-sale', (_event, branchId: unknown, customerId: unknown, lines: unknown) => database!.holdPosSale(requiredId(branchId),requiredId(customerId),lines as PosCartLineInput[]))
  ipcMain.handle('pos:resume-held-sale', (_event, id: unknown) => database!.resumePosSale(requiredId(id)))
  ipcMain.handle('pos:delete-held-sale', (_event, id: unknown) => database!.deleteHeldPosSale(requiredId(id)))
  ipcMain.handle('pos:open-shift', (_event, branchId: unknown, openingCashPaisa: unknown) => database!.openPosShift(requiredId(branchId),requiredInteger(openingCashPaisa,'opening cash')))
  ipcMain.handle('pos:create-product', (_event, branchId: unknown, input: unknown) => database!.createPosProduct(requiredId(branchId),input as PosCreateProductInput))
  ipcMain.handle('pos:create-customer', (_event, input: unknown) => database!.createPosCustomer(input as PosCreateCustomerInput))
  ipcMain.handle('products:list', (_event, query: unknown) => database!.listProducts(query as ProductCatalogQuery))
  ipcMain.handle('products:save', (_event, branchId: unknown, input: unknown) => database!.saveProduct(requiredId(branchId),input as ProductSaveInput))
  ipcMain.handle('products:toggle-status', (_event, branchId: unknown, id: unknown) => database!.toggleProductStatus(requiredId(branchId),requiredId(id)))
  ipcMain.handle('products:import-csv', (_event, branchId: unknown, csv: unknown) => {
    if(typeof csv!=='string') throw new Error('Invalid CSV file.')
    return database!.importProductsCsv(requiredId(branchId),csv)
  })
  ipcMain.handle('products:export-csv', async (_event, branchId: unknown) => {
    const result=await dialog.showSaveDialog(mainWindow!,{ title:'Export Products',defaultPath:`vertexia-products-${new Date().toISOString().slice(0,10)}.csv`,filters:[{name:'CSV file',extensions:['csv']}] })
    if(result.canceled||!result.filePath) return {canceled:true}
    await writeFile(result.filePath,database!.exportProductsCsv(requiredId(branchId)),'utf8')
    return {canceled:false,path:result.filePath}
  })
  ipcMain.handle('sales:get-snapshot', (_event, query:unknown) => database!.getSalesSnapshot(query as SalesListQuery))
  ipcMain.handle('sales:get-detail', (_event, branchId:unknown, saleId:unknown) => database!.getSalesDetail(requiredId(branchId),requiredId(saleId)))
  ipcMain.handle('sales:create-return', (_event, request:unknown) => database!.createSalesReturn(request as SalesReturnRequest))
  ipcMain.handle('sales:export-csv', async (_event, query:unknown) => {
    const salesQuery=query as SalesListQuery
    const result=await dialog.showSaveDialog(mainWindow!,{title:'Export Sales',defaultPath:`vertexia-sales-${new Date().toISOString().slice(0,10)}.csv`,filters:[{name:'CSV file',extensions:['csv']}]})
    if(result.canceled||!result.filePath)return{canceled:true}
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
  const smokeTarget = process.env.VERTEXIA_SMOKE_TEST
  const initialHash = smokeTarget === 'pos' || smokeTarget === 'products' ? smokeTarget : 'dashboard'
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
    },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action:'deny' }
  })
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Vertexia preload failed at ${preloadPath}:`, error)
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = developmentUrl ? url.startsWith(developmentUrl) : url.startsWith('file:')
    if (!allowed) event.preventDefault()
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  if (developmentUrl) await mainWindow.loadURL(`${developmentUrl}/#${initialHash}`)
  else await mainWindow.loadFile(join(moduleDirectory, '../../dist/index.html'), { hash:initialHash })

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
  registerIpc()
  await createWindow()
})

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => database?.close())
