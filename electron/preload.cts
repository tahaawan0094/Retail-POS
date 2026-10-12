import { contextBridge, ipcRenderer } from 'electron'
import type { DashboardQuery, PosCompleteSaleRequest, PosCreateCustomerInput, PosCreateProductInput, PosCartLineInput, ProductCatalogQuery, ProductSaveInput, SalesListQuery, SalesReturnRequest, VertexiaDesktopApi } from '../src/types/desktop-api.js'

const api: VertexiaDesktopApi = {
  licensing: {
    status: () => ipcRenderer.invoke('licensing:status'),
    activate: key => ipcRenderer.invoke('licensing:activate', key),
    refresh: () => ipcRenderer.invoke('licensing:refresh'),
  },
  branches: {
    list: () => ipcRenderer.invoke('branches:list'),
    create: request => ipcRenderer.invoke('branches:create',request),
    update: request => ipcRenderer.invoke('branches:update',request),
    setActive: request => ipcRenderer.invoke('branches:set-active',request),
  },
  transfers: {
    list: query => ipcRenderer.invoke('transfers:list',query),
    detail: (branchId,id) => ipcRenderer.invoke('transfers:detail',branchId,id),
    dispatch: request => ipcRenderer.invoke('transfers:dispatch',request),
    receive: request => ipcRenderer.invoke('transfers:receive',request),
    cancel: request => ipcRenderer.invoke('transfers:cancel',request),
  },
  reports: {
    snapshot: query => ipcRenderer.invoke('reports:snapshot',query),
    valuation: branchId => ipcRenderer.invoke('reports:valuation',branchId),
    exportCsv: query => ipcRenderer.invoke('reports:export-csv',query),
  },
  customers: {
    list: query => ipcRenderer.invoke('customers:list', query),
    detail: (branchId, customerId, page) => ipcRenderer.invoke('customers:detail', branchId, customerId, page),
    receipt: (branchId, receiptId) => ipcRenderer.invoke('customers:receipt', branchId, receiptId),
    create: request => ipcRenderer.invoke('customers:create', request),
    update: request => ipcRenderer.invoke('customers:update', request),
    collect: request => ipcRenderer.invoke('customers:collect', request),
  },
  expenses: {
    list: query => ipcRenderer.invoke('expenses:list', query),
    post: request => ipcRenderer.invoke('expenses:post', request),
    reverse: request => ipcRenderer.invoke('expenses:reverse', request),
  },
  cash: {
    getSnapshot: branchId => ipcRenderer.invoke('cash:get-snapshot', branchId),
    closeShift: request => ipcRenderer.invoke('cash:close-shift', request),
    move: request => ipcRenderer.invoke('cash:move', request),
  },
  backup: {
    getStatus: () => ipcRenderer.invoke('backup:get-status'),
    create: () => ipcRenderer.invoke('backup:create'),
    export: id => ipcRenderer.invoke('backup:export', id),
    previewRestore: () => ipcRenderer.invoke('backup:preview'),
    cancelRestore: token => ipcRenderer.invoke('backup:cancel', token),
    restore: request => ipcRenderer.invoke('backup:restore', request),
  },
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    setup: input => ipcRenderer.invoke('auth:setup', input),
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    selectBranch: branchId => ipcRenderer.invoke('auth:select-branch', branchId),
    listUsers: () => ipcRenderer.invoke('auth:list-users'),
    createUser: input => ipcRenderer.invoke('auth:create-user', input),
    updateUser: input => ipcRenderer.invoke('auth:update-user', input),
    resetPassword: (userId, password) => ipcRenderer.invoke('auth:reset-password', userId, password),
    changePassword: (currentPassword, newPassword) => ipcRenderer.invoke('auth:change-password', currentPassword, newPassword),
    onSessionExpired: callback => {
      const listener = () => callback()
      ipcRenderer.on('auth:session-expired', listener)
      return () => ipcRenderer.removeListener('auth:session-expired', listener)
    },
  },
  retail: {
    getSnapshot: branchId => ipcRenderer.invoke('retail:get-snapshot', branchId),
    adjustStock: request => ipcRenderer.invoke('retail:adjust-stock', request),
    receivePurchase: request => ipcRenderer.invoke('retail:receive-purchase', request),
    paySupplier: request => ipcRenderer.invoke('retail:pay-supplier', request),
  },
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
    openShift: (branchId: string,openingCashPaisa: number,operationId?: string) => ipcRenderer.invoke('pos:open-shift',branchId,openingCashPaisa,operationId),
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
