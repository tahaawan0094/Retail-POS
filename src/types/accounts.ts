import type { RetailPaymentMethod } from './desktop-api.js'

export type CustomerRecord = { id: string; name: string; phone: string; isActive: boolean; balancePaisa: number; creditSalesPaisa: number; collectedPaisa: number; returnsPaisa: number }
export type CustomerQuery = { branchId: string; search: string; filter: 'all' | 'due' | 'credit' | 'inactive'; page: number; pageSize: number }
export type CustomerSnapshot = { customers: CustomerRecord[]; total: number; page: number; pageCount: number; customerCount: number; duePaisa: number; creditPaisa: number; businessDate: string }
export type CustomerCreateRequest = { branchId: string; operationId: string; name: string; phone: string; openingBalancePaisa: number }
export type CustomerUpdateRequest = { branchId: string; operationId: string; customerId: string; name: string; phone: string; isActive: boolean }
export type CustomerCollectRequest = { branchId: string; operationId: string; customerId: string; amountPaisa: number; method: RetailPaymentMethod; reference: string }
export type CustomerReceipt = { id: string; number: string; businessName: string; branchName: string; customerId: string; customerName: string; customerPhone: string; amountPaisa: number; balanceAfterPaisa: number; method: RetailPaymentMethod; reference: string; receivedBy: string; occurredAt: string }
export type CustomerDetail = { customer: CustomerRecord; ledger: Array<{ id: string; type: string; reference: string; debitPaisa: number; creditPaisa: number; balanceAfterPaisa: number; occurredAt: string }>; ledgerTotal: number; page: number; pageCount: number; receipts: CustomerReceipt[]; sales: Array<{ id: string; number: string; totalPaisa: number; paymentMethod: string; status: string; occurredAt: string }> }
export type ExpenseQuery = { branchId: string; dateFrom: string; dateTo: string; search: string; category: string; method: string; page: number; pageSize: number }
export type ExpensePostRequest = { branchId: string; operationId: string; businessDate: string; description: string; category: string; amountPaisa: number; method: RetailPaymentMethod; reference: string }
export type ExpenseReverseRequest = { branchId: string; operationId: string; expenseId: string; reason: string }
export type ExpenseRecord = { id: string; expenseId: string; number: string; businessDate: string; description: string; category: string; amountPaisa: number; method: string; reference: string; createdBy: string; occurredAt: string; isReversal: boolean; isReversed: boolean; reversalReason: string }
export type ExpenseSnapshot = { records: ExpenseRecord[]; total: number; page: number; pageCount: number; netPaisa: number; postedPaisa: number; reversedPaisa: number; categories: string[]; byCategory: Array<{ category: string; netPaisa: number }>; businessDate: string }
