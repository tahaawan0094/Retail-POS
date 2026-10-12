export type DashboardDateRange = 'today' | 'yesterday' | 'this_week'
export type DashboardChartPeriod = 'today' | '7_days' | '30_days'

export type DashboardQuery = {
  branchId: string
  dateRange: DashboardDateRange
  chartPeriod: DashboardChartPeriod
}

export type DashboardBranch = {
  id: string
  name: string
  subtitle: string
}

export type DashboardChartPoint = {
  label: string
  valuePaisa: number
  profitPaisa: number
}

export type DashboardProductRow = {
  id: string
  name: string
  kind: string
  quantityMilli: number
}

export type DashboardSaleRow = {
  id: string
  invoiceNumber: string
  customerName: string
  totalPaisa: number
  paymentMethod: string
  completedAt: string
}

export type DashboardActivityRow = {
  id: string
  occurredAt: string
  type: string
  description: string
  reference: string
}

export type DashboardSnapshot = {
  generatedAt: string
  businessDate: string
  selectedRangeLabel: string
  comparisonLabel: string
  branches: DashboardBranch[]
  activeBranchId: string
  userName: string
  userRole: string
  businessName: string
  salesPaisa: number
  salesChangePercent: number | null
  profitPaisa: number
  profitChangePercent: number | null
  lowStockCount: number
  customerDuePaisa: number
  supplierDuePaisa: number
  expensesPaisa: number
  cashInDrawerPaisa: number
  chart: DashboardChartPoint[]
  topProducts: DashboardProductRow[]
  lowProducts: DashboardProductRow[]
  recentSales: DashboardSaleRow[]
  recentActivity: DashboardActivityRow[]
  unreadNotifications: number
}

export type GlobalSearchResult = {
  id: string
  type: 'Product' | 'Customer' | 'Supplier' | 'Sale'
  title: string
  subtitle: string
  targetPage: 'Products' | 'Customers' | 'Suppliers' | 'Sales'
}

export type PosPaymentMethod = 'Cash' | 'Card' | 'JazzCash' | 'Easypaisa' | 'Udhaar'

export type PosProduct = {
  id: string
  sku: string
  barcode: string | null
  name: string
  category: string
  unit: string
  kind: string
  sellingPricePaisa: number
  quantityMilli: number
  minimumStockMilli: number
}

export type PosCustomer = {
  id: string
  name: string
  phone: string | null
  isWalkIn: boolean
  balancePaisa: number
}

export type PosCartLineInput = {
  productId: string
  quantityMilli: number
  discountBasisPoints: number
}

export type PosHeldSale = {
  id: string
  customerId: string
  itemCount: number
  totalPaisa: number
  heldAt: string
  lines?: PosCartLineInput[]
}

export type PosBootstrap = {
  branchId: string
  businessName: string
  branchName: string
  userName: string
  userRole: string
  activeShiftId: string | null
  lowStockCount: number
  products: PosProduct[]
  customers: PosCustomer[]
  categories: string[]
  heldSales: PosHeldSale[]
}

export type PosCompleteSaleRequest = {
  operationId?: string
  branchId: string
  customerId: string
  lines: PosCartLineInput[]
  paymentMethod: PosPaymentMethod
  cashReceivedPaisa: number
}

export type PosCompletedSale = {
  saleId: string
  invoiceNumber: string
  completedAt: string
  customerName: string
  paymentMethod: PosPaymentMethod
  subtotalPaisa: number
  discountPaisa: number
  totalPaisa: number
  cashReceivedPaisa: number
  changePaisa: number
  lines: Array<{ name: string;quantityMilli: number;unitPricePaisa: number;discountPaisa: number;lineTotalPaisa: number }>
}

export type PosCreateProductInput = {
  name: string
  barcode: string
  category: string
  unit: string
  purchasePricePaisa: number
  sellingPricePaisa: number
  openingStockMilli: number
}

export type PosCreateCustomerInput = { name:string;phone:string }

export type ProductCatalogRecord = {
  id:string
  name:string
  sku:string
  barcode:string
  category:string
  subcategory:string
  brand:string
  unit:string
  kind:string
  purchasePricePaisa:number
  sellingPricePaisa:number
  mrpPaisa:number
  minimumStockMilli:number
  stockMilli:number
  status:'active'|'inactive'
  imageDataUrl:string|null
  createdAt:string
  updatedAt:string
}

export type ProductCatalogQuery = {
  branchId:string
  search:string
  category:string
  brand:string
  status:'all'|'active'|'inactive'|'low_stock'|'out_of_stock'
  page:number
  pageSize:number
}

export type ProductCatalogResult = {
  products:ProductCatalogRecord[]
  total:number
  page:number
  pageSize:number
  pageCount:number
  categories:string[]
  brands:string[]
}

export type ProductSaveInput = {
  id?:string
  name:string
  sku:string
  barcode:string
  category:string
  subcategory:string
  brand:string
  unit:string
  purchasePricePaisa:number
  sellingPricePaisa:number
  mrpPaisa:number
  minimumStockMilli:number
  openingStockMilli:number
  status:'active'|'inactive'
  imageDataUrl:string|null
}

export type ProductImportResult = { imported:number }

export type SalesPeriod = 'today'|'this_week'|'this_month'
export type SalesStatusFilter = 'all'|'completed'|'partially_returned'|'returned'|'voided'
export type SalesListQuery = {
  branchId:string
  period:SalesPeriod
  search:string
  paymentMethod:string
  status:SalesStatusFilter
  page:number
  pageSize:number
}
export type SalesChartPoint = { label:string;valuePaisa:number;returnedPaisa:number }
export type SalesPaymentSummary = { method:string;amountPaisa:number }
export type SalesListRow = {
  id:string;invoiceNumber:string;completedAt:string;customerName:string;cashierName:string
  itemCount:number;totalPaisa:number;returnedPaisa:number;netPaisa:number;paymentMethod:string
  status:'completed'|'partially_returned'|'returned'|'voided'
}
export type SalesSnapshot = {
  businessDate:string;rangeLabel:string;comparisonLabel:string
  totalSalesPaisa:number;salesChangePercent:number|null;transactionCount:number
  transactionChangePercent:number|null;averageOrderPaisa:number;averageChangePercent:number|null
  returnsPaisa:number;returnsChangePercent:number|null
  chart:SalesChartPoint[];payments:SalesPaymentSummary[]
  sales:SalesListRow[];total:number;page:number;pageSize:number;pageCount:number
}
export type SalesDetailLine = {
  id:string;productId:string;name:string;quantityMilli:number;returnedQuantityMilli:number
  returnableQuantityMilli:number;unitPricePaisa:number;discountPaisa:number;lineTotalPaisa:number
}
export type SalesReturnRecord = { id:string;returnNumber:string;reason:string;refundMethod:string;totalPaisa:number;occurredAt:string }
export type SalesDetail = SalesListRow & {
  customerPhone:string|null;subtotalPaisa:number;discountPaisa:number;costPaisa:number
  businessName:string;branchName:string;lines:SalesDetailLine[];returns:SalesReturnRecord[]
}
export type SalesReturnRequest = {
  operationId?:string
  branchId:string;saleId:string;reason:string
  lines:Array<{saleItemId:string;quantityMilli:number}>
}
export type SalesReturnResult = { returnId:string;returnNumber:string;refundMethod:string;totalPaisa:number;occurredAt:string }

export type RetailPaymentMethod = 'Cash'|'Bank Transfer'|'JazzCash'|'Easypaisa'|'Card'
export type StockAdjustmentRequest = { branchId:string;operationId:string;productId:string;quantityDeltaMilli:number;reason:string }
export type PurchaseReceiveRequest = {
  branchId:string;operationId:string;supplierName:string;supplierInvoiceNumber:string;businessDate:string
  paidAmountPaisa:number;paymentMethod:RetailPaymentMethod
  lines:Array<{productId:string;quantityMilli:number;unitCostPaisa:number}>
}
export type PurchaseReceiveResult = { purchaseId:string;purchaseNumber:string;supplierId:string;totalPaisa:number }
export type SupplierPayRequest = { branchId:string;operationId:string;supplierId:string;amountPaisa:number;method:RetailPaymentMethod;reference:string }
export type RetailSnapshot = {
  branchId:string
  businessDate:string
  products:ProductCatalogRecord[]
  movements:Array<{id:string;productId:string;productName:string;type:string;quantityDeltaMilli:number;balanceAfterMilli:number;reason:string;referenceId:string;occurredAt:string}>
  purchases:Array<{id:string;supplierId:string;purchaseNumber:string;supplierName:string;supplierInvoiceNumber:string;businessDate:string;totalPaisa:number;paidPaisa:number;duePaisa:number;createdAt:string;lines:Array<{productId:string;quantityMilli:number;unitCostPaisa:number}>}>
  suppliers:Array<{id:string;name:string;phone:string;isActive:boolean;totalPurchasesPaisa:number;totalPaidPaisa:number;outstandingPaisa:number;lastPurchaseDate:string|null}>
  payments:Array<{id:string;supplierId:string;businessDate:string;method:RetailPaymentMethod;amountPaisa:number;reference:string;createdAt:string}>
  supplierLedger:Array<{id:string;supplierId:string;businessDate:string;type:string;reference:string;debitPaisa:number;creditPaisa:number;balanceAfterPaisa:number;occurredAt:string}>
}

export type VertexiaDesktopApi = {
  licensing: {
    status(): Promise<import('./licensing.js').LicenseStatus>
    activate(key: string): Promise<import('./licensing.js').LicenseStatus>
    refresh(): Promise<import('./licensing.js').LicenseStatus>
  }
  branches: {
    list(): Promise<import('./branches.js').BranchRecord[]>
    create(request: import('./branches.js').BranchCreateRequest): Promise<{branchId: string}>
    update(request: import('./branches.js').BranchUpdateRequest): Promise<{branchId: string}>
    setActive(request: import('./branches.js').BranchActiveRequest): Promise<{branchId: string}>
  }
  transfers: {
    list(query: import('./branches.js').TransferQuery): Promise<import('./branches.js').TransferSnapshot>
    detail(branchId: string, id: string): Promise<import('./branches.js').TransferRecord>
    dispatch(request: import('./branches.js').TransferDispatchRequest): Promise<import('./branches.js').TransferRecord>
    receive(request: import('./branches.js').TransferReceiveRequest): Promise<import('./branches.js').TransferRecord>
    cancel(request: import('./branches.js').TransferCancelRequest): Promise<import('./branches.js').TransferRecord>
  }
  reports: {
    snapshot(query: import('./reports.js').ReportQuery): Promise<import('./reports.js').ReportSnapshot>
    valuation(branchId: string): Promise<import('./reports.js').StockValuation>
    exportCsv(query: import('./reports.js').ReportQuery): Promise<{ canceled: boolean; path?: string }>
  }
  customers: {
    list(query: import('./accounts.js').CustomerQuery): Promise<import('./accounts.js').CustomerSnapshot>
    detail(branchId: string, customerId: string, page?: number): Promise<import('./accounts.js').CustomerDetail>
    receipt(branchId: string, receiptId: string): Promise<import('./accounts.js').CustomerReceipt>
    create(request: import('./accounts.js').CustomerCreateRequest): Promise<{ customerId: string }>
    update(request: import('./accounts.js').CustomerUpdateRequest): Promise<{ customerId: string }>
    collect(request: import('./accounts.js').CustomerCollectRequest): Promise<import('./accounts.js').CustomerReceipt>
  }
  expenses: {
    list(query: import('./accounts.js').ExpenseQuery): Promise<import('./accounts.js').ExpenseSnapshot>
    post(request: import('./accounts.js').ExpensePostRequest): Promise<{ expenseId: string; number: string }>
    reverse(request: import('./accounts.js').ExpenseReverseRequest): Promise<{ reversalId: string; number: string }>
  }
  cash: {
    getSnapshot(branchId: string): Promise<import('./recovery.js').CashSnapshot>
    closeShift(request: import('./recovery.js').CashCloseRequest): Promise<import('./recovery.js').CashShiftRecord>
    move(request: import('./recovery.js').CashMoveRequest): Promise<{ transactionId: string; expectedCashPaisa: number }>
  }
  backup: {
    getStatus(): Promise<import('./recovery.js').BackupStatus>
    create(): Promise<import('./recovery.js').BackupRecord>
    export(id: string): Promise<{ canceled: boolean; path?: string }>
    previewRestore(): Promise<{ canceled: boolean; summary?: import('./recovery.js').BackupSummary }>
    cancelRestore(token: string): Promise<void>
    restore(request: import('./recovery.js').BackupRestoreRequest): Promise<{ safetyBackupPath: string }>
  }
  auth: {
    status(): Promise<import('./auth.js').AuthStatus>
    setup(input: import('./auth.js').BusinessSetupInput): Promise<import('./auth.js').AuthSession>
    login(username: string, password: string): Promise<import('./auth.js').AuthSession>
    logout(): Promise<void>
    selectBranch(branchId: string): Promise<import('./auth.js').AuthSession>
    listUsers(): Promise<import('./auth.js').StaffUser[]>
    createUser(input: import('./auth.js').StaffCreateInput): Promise<import('./auth.js').StaffUser[]>
    updateUser(input: import('./auth.js').StaffUpdateInput): Promise<import('./auth.js').StaffUser[]>
    resetPassword(userId: string, password: string): Promise<void>
    changePassword(currentPassword: string, newPassword: string): Promise<import('./auth.js').AuthSession>
    onSessionExpired(callback: () => void): () => void
  }
  retail: {
    getSnapshot(branchId:string):Promise<RetailSnapshot>
    adjustStock(request:StockAdjustmentRequest):Promise<{movementId:string;balanceAfterMilli:number}>
    receivePurchase(request:PurchaseReceiveRequest):Promise<PurchaseReceiveResult>
    paySupplier(request:SupplierPayRequest):Promise<{paymentId:string;outstandingPaisa:number}>
  }
  dashboard: {
    getSnapshot(query: DashboardQuery): Promise<DashboardSnapshot>
    search(term: string, branchId: string): Promise<GlobalSearchResult[]>
  }
  pos: {
    getBootstrap(branchId: string): Promise<PosBootstrap>
    completeSale(request: PosCompleteSaleRequest): Promise<PosCompletedSale>
    holdSale(branchId: string,customerId: string,lines: PosCartLineInput[]): Promise<PosHeldSale>
    resumeHeldSale(id: string): Promise<PosHeldSale>
    deleteHeldSale(id: string): Promise<void>
    openShift(branchId: string,openingCashPaisa: number,operationId?: string): Promise<string>
    createProduct(branchId: string,input: PosCreateProductInput): Promise<PosProduct>
    createCustomer(input: PosCreateCustomerInput): Promise<PosCustomer>
  }
  products: {
    list(query: ProductCatalogQuery): Promise<ProductCatalogResult>
    save(branchId:string,input:ProductSaveInput): Promise<ProductCatalogRecord>
    toggleStatus(branchId:string,id:string): Promise<'active'|'inactive'>
    importCsv(branchId:string,csv:string): Promise<ProductImportResult>
    exportCsv(branchId:string): Promise<{ canceled:boolean;path?:string }>
  }
  sales: {
    getSnapshot(query:SalesListQuery): Promise<SalesSnapshot>
    getDetail(branchId:string,saleId:string): Promise<SalesDetail>
    createReturn(request:SalesReturnRequest): Promise<SalesReturnResult>
    exportCsv(query:SalesListQuery): Promise<{ canceled:boolean;path?:string }>
  }
  system: {
    getDatabasePath(): Promise<string>
  }
}
