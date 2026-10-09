import { contextBridge, ipcRenderer } from 'electron'
import type { DashboardQuery, PosCompleteSaleRequest, PosCreateCustomerInput, PosCreateProductInput, PosCartLineInput, ProductCatalogQuery, ProductSaveInput, SalesListQuery, SalesReturnRequest, VertexiaDesktopApi } from '../src/types/desktop-api.js'

const api: VertexiaDesktopApi = {
  dashboard: {
    getSnapshot: (query: DashboardQuery) => ipcRenderer.invoke('dashboard:get-snapshot', query),
    search: (term: string, branchId: string) => ipcRenderer.invoke('dashboard:search', term, branchId),
  },
  pos: {
    getBootstrap: (branchId: string) => ipcRenderer.invoke('pos:get-bootstrap',branchId),
    completeSale: (request: PosCompleteSaleRequest) => ipcRenderer.invoke('pos:complete-sale',request),
    holdSale: (branchId: string,customerId: string,lines: PosCartLineInput[]) => ipcRenderer.invoke('pos:hold-sale',branchId,customerId,lines),
    resumeHeldSale: (id: string) => ipcRenderer.invoke('pos:resume-held-sale',id),
    deleteHeldSale: (id: string) => ipcRenderer.invoke('pos:delete-held-sale',id),
    openShift: (branchId: string,openingCashPaisa: number) => ipcRenderer.invoke('pos:open-shift',branchId,openingCashPaisa),
    createProduct: (branchId: string,input: PosCreateProductInput) => ipcRenderer.invoke('pos:create-product',branchId,input),
    createCustomer: (input: PosCreateCustomerInput) => ipcRenderer.invoke('pos:create-customer',input),
  },
  products: {
    list: (query:ProductCatalogQuery) => ipcRenderer.invoke('products:list',query),
    save: (branchId:string,input:ProductSaveInput) => ipcRenderer.invoke('products:save',branchId,input),
    toggleStatus: (branchId:string,id:string) => ipcRenderer.invoke('products:toggle-status',branchId,id),
    importCsv: (branchId:string,csv:string) => ipcRenderer.invoke('products:import-csv',branchId,csv),
    exportCsv: (branchId:string) => ipcRenderer.invoke('products:export-csv',branchId),
  },
  sales: {
    getSnapshot: (query:SalesListQuery) => ipcRenderer.invoke('sales:get-snapshot',query),
    getDetail: (branchId:string,saleId:string) => ipcRenderer.invoke('sales:get-detail',branchId,saleId),
    createReturn: (request:SalesReturnRequest) => ipcRenderer.invoke('sales:create-return',request),
    exportCsv: (query:SalesListQuery) => ipcRenderer.invoke('sales:export-csv',query),
  },
  system: {
    getDatabasePath: () => ipcRenderer.invoke('system:get-database-path'),
  },
}

contextBridge.exposeInMainWorld('vertexia', api)
