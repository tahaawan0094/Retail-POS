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
  branchId:string;saleId:string;reason:string
  lines:Array<{saleItemId:string;quantityMilli:number}>
}
export type SalesReturnResult = { returnId:string;returnNumber:string;refundMethod:string;totalPaisa:number;occurredAt:string }

export type VertexiaDesktopApi = {
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
    openShift(branchId: string,openingCashPaisa: number): Promise<string>
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
