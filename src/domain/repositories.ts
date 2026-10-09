import type { Product } from './catalog'
import type { StockLevel, StockMovement } from './inventory'
import type { Customer, PartyLedgerEntry, Supplier } from './parties'
import type { CompleteSaleCommand, Sale } from './sales'
import type { EntityId } from './shared'

export interface ProductRepository {
  getById(id: EntityId): Promise<Product | null>
  getByBarcode(businessId: EntityId, barcode: string): Promise<Product | null>
  save(product: Product): Promise<void>
}

export interface InventoryRepository {
  getStock(branchId: EntityId, productId: EntityId): Promise<StockLevel | null>
  appendMovement(movement: StockMovement): Promise<void>
}

export interface CustomerRepository {
  getById(id: EntityId): Promise<Customer | null>
  save(customer: Customer): Promise<void>
  appendLedgerEntry(entry: PartyLedgerEntry): Promise<void>
}

export interface SupplierRepository {
  getById(id: EntityId): Promise<Supplier | null>
  save(supplier: Supplier): Promise<void>
  appendLedgerEntry(entry: PartyLedgerEntry): Promise<void>
}

export interface SaleRepository {
  getByRequestId(requestId: string): Promise<Sale | null>
  complete(command: CompleteSaleCommand): Promise<Sale>
}

export interface TransactionManager {
  run<T>(operation: () => Promise<T>): Promise<T>
}
