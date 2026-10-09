import type { ComponentType } from 'react'
import type { PageProps } from '../shared/layout/PageShell'
import type { PageName } from '../types'
import DashboardPage from '../features/dashboard/DashboardPage'
import PosPage from '../features/pos/PosPage'
import SalesPage from '../features/sales/SalesPage'
import ProductsPage from '../features/products/ProductsPage'
import InventoryPage from '../features/inventory/InventoryPage'
import PurchasesPage from '../features/purchases/PurchasesPage'
import CustomersPage from '../features/customers/CustomersPage'
import SuppliersPage from '../features/suppliers/SuppliersPage'
import CashShiftsPage from '../features/cash-shifts/CashShiftsPage'
import ExpensesPage from '../features/expenses/ExpensesPage'
import StaffPage from '../features/staff/StaffPage'
import ReportsPage from '../features/reports/ReportsPage'
import SettingsPage from '../features/settings/SettingsPage'
import AccountPage from '../features/account/AccountPage'

export const hashToPage: Record<string, PageName> = {
  '#dashboard': 'Dashboard', '#pos': 'POS', '#sales': 'Sales', '#products': 'Products',
  '#inventory': 'Inventory', '#purchases': 'Purchases', '#customers': 'Customers',
  '#suppliers': 'Suppliers', '#cash-shifts': 'Cash & Shifts', '#expenses': 'Expenses',
  '#staff': 'Staff', '#reports': 'Reports', '#settings': 'Settings', '#my-account': 'My Account',
}

export const pageToHash: Record<PageName, string> = Object.fromEntries(
  Object.entries(hashToPage).map(([hash, page]) => [page, hash]),
) as Record<PageName, string>

export const pages: Record<PageName, ComponentType<PageProps>> = {
  Dashboard: DashboardPage, POS: PosPage, Sales: SalesPage, Products: ProductsPage,
  Inventory: InventoryPage, Purchases: PurchasesPage, Customers: CustomersPage,
  Suppliers: SuppliersPage, 'Cash & Shifts': CashShiftsPage, Expenses: ExpensesPage,
  Staff: StaffPage, Reports: ReportsPage, Settings: SettingsPage, 'My Account': AccountPage,
}
