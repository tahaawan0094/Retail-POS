import type { PurchaseRecord, PurchaseStatus } from './purchases.types'

const rows = [
  ['PUR-2026-001','2026-10-03','ABC Distributors',12,45600,45600,'Paid'],
  ['PUR-2026-002','2026-10-02','Karachi Beverages',8,32400,20000,'Partial'],
  ['PUR-2026-003','2026-09-30','Fresh Foods Supplier',15,78900,0,'Unpaid'],
  ['PUR-2026-004','2026-09-28','Local Wholesale',20,112000,112000,'Paid'],
  ['PUR-2026-005','2026-09-25','National Foods',10,36750,30000,'Partial'],
  ['PUR-2026-006','2026-09-22','Pk Traders',18,95800,0,'Unpaid'],
  ['PUR-2026-007','2026-09-20','Glax Consumer',25,156400,156400,'Paid'],
  ['PUR-2026-008','2026-09-18','United Supplies',14,68900,50000,'Partial'],
  ['PUR-2026-009','2026-09-15','Delta Traders',9,28300,0,'Unpaid'],
  ['PUR-2026-010','2026-09-12','City Wholesale',11,54200,54200,'Paid'],
] as const

export const seedPurchases: PurchaseRecord[] = rows.map(([purchaseNumber,purchaseDate,supplier,itemCount,total,paid,status],index) => ({
  id: `purchase-${index + 1}`, purchaseNumber, purchaseDate, supplier, itemCount,
  supplierInvoiceNumber: '', totalAmountRupees: total, paidAmountRupees: paid,
  dueAmountRupees: total - paid, status: status as PurchaseStatus, items: [],
  createdAt: `${purchaseDate}T12:00:00+05:00`,
}))
