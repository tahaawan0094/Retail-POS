import type { SupplierLedgerEntry, SupplierPaymentRecord, SupplierRecord } from './suppliers.types'

const rows = [
  ['supplier-1','ABC Distributors','0301 1112233','Karachi','abcdistributors@gmail.com','Beverages, Snacks, Household','Main supplier for beverages and snacks',450800,300000,150800,'2026-10-02','Active'],
  ['supplier-2','Karachi Beverages','0321 4455667','Karachi','','Beverages','',620400,620400,0,'2026-10-01','Active'],
  ['supplier-3','Fresh Foods Supplier','0333 7788990','Karachi','','Fresh Foods','',310200,230200,80000,'2026-09-29','Active'],
  ['supplier-4','National Foods','0300 9988776','Lahore','','Grocery','',265900,145000,120900,'2026-09-25','Active'],
  ['supplier-5','Pk Traders','0312 6677889','Karachi','','General','',520000,520000,0,'2026-09-22','Active'],
  ['supplier-6','Glax Consumer','0324 3344556','Karachi','','Personal Care','',180750,100750,80000,'2026-09-20','Active'],
  ['supplier-7','United Supplies','0307 1122334','Karachi','','General','',420600,300000,120600,'2026-09-18','Active'],
  ['supplier-8','Delta Traders','0321 5566778','Lahore','','General','',310400,220400,90000,'2026-09-15','Active'],
  ['supplier-9','City Wholesale','0315 9988112','Karachi','','General','',285000,285000,0,'2026-09-12','Active'],
  ['supplier-10','Metro Supplies','0330 4455667','Karachi','','General','',265400,115000,150400,'2026-09-10','Inactive'],
] as const

export const seedSuppliers: SupplierRecord[] = rows.map(([id,name,phone,city,email,categories,note,total,paid,outstanding,lastPurchase,status]) => ({ id,name,phone,city,email,categories,note,totalPurchasesRupees:total,totalPaidRupees:paid,outstandingRupees:outstanding,lastPurchaseDate:lastPurchase,status }))

export const seedSupplierPayments: SupplierPaymentRecord[] = [
  ['payment-1','supplier-1','2026-10-01','Bank Transfer',100000,'BT-1001'],
  ['payment-2','supplier-1','2026-09-20','Cash',50000,'CASH-920'],
  ['payment-3','supplier-1','2026-09-05','JazzCash',75000,'JC-905'],
  ['payment-4','supplier-1','2026-08-14','Easypaisa',50000,'EP-814'],
].map(([id,supplierId,date,method,amount,reference]) => ({ id:String(id),supplierId:String(supplierId),date:String(date),method:method as SupplierPaymentRecord['method'],amountRupees:Number(amount),reference:String(reference),createdAt:`${date}T12:00:00+05:00` }))

export const seedSupplierLedger: SupplierLedgerEntry[] = seedSuppliers.filter(supplier => supplier.outstandingRupees > 0).map((supplier,index) => ({ id:`supplier-opening-${index + 1}`,supplierId:supplier.id,date:'2026-09-01',type:'opening_balance',reference:'Opening balance',debitRupees:supplier.outstandingRupees,creditRupees:0,balanceAfterRupees:supplier.outstandingRupees,createdAt:'2026-09-01T09:00:00+05:00' }))
