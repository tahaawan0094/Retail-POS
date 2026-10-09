import type { BranchScopedEntity, EntityId, ISODateTime, MoneyPaisa, PaymentMethod } from './shared'

export type CashShiftStatus = 'open' | 'closed'
export type CashTransactionType =
  | 'opening_cash' | 'cash_sale' | 'customer_payment' | 'sale_refund'
  | 'expense' | 'supplier_payment' | 'deposit' | 'withdrawal' | 'cash_in'

export type CashShift = BranchScopedEntity & {
  cashierId: EntityId
  counterId: EntityId | null
  openedAt: ISODateTime
  closedAt: ISODateTime | null
  openingCash: MoneyPaisa
  expectedClosingCash: MoneyPaisa | null
  actualClosingCash: MoneyPaisa | null
  difference: MoneyPaisa | null
  closingNote: string | null
  status: CashShiftStatus
}

export type CashTransaction = BranchScopedEntity & {
  shiftId: EntityId
  type: CashTransactionType
  amount: MoneyPaisa
  paymentMethod: PaymentMethod
  referenceType: string
  referenceId: EntityId
  description: string
}

export type Expense = BranchScopedEntity & {
  categoryId: EntityId
  description: string
  amount: MoneyPaisa
  paymentMethod: PaymentMethod
  shiftId: EntityId | null
  expenseDate: string
}
