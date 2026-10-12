# Milestone 4: customer debt collection and paid expenses

Implemented 10 October 2026. Customers and Expenses now use the same local SQLite database as POS, sales, inventory, cash shifts and backups. Reports remain Planned. Cloud sync, licensing and multi-counter authority remain pending.

## Customer accounts

Open Customers from the sidebar. Search by name/phone and filter accounts with debt, customer credit or inactive status. Balances and account totals belong to the selected branch. Profiles are shared across the local business; collecting one branch's debt does not settle another branch's balance.

Create a customer with name and optional phone. An owner/manager can enter an opening debt for money owed before adopting the POS. Opening debt creates an audited ledger entry and does not invent a sale, stock movement or cash receipt. Existing balances cannot be overwritten through profile editing. Editing name, phone or active status preserves financial history. Inactive customers cannot be selected for new sales but existing debt can still be collected.

View account opens the customer's ledger, recent receipts and recent sales. The ledger is paginated in groups of 50 with running balances calculated across all entries, including entries outside the current page. Receipts and invoices show the latest 100; older records remain in SQLite.

Receive payment with amount, method and reference. Cash requires an open branch shift and increases physical drawer cash. Bank Transfer, Card, JazzCash and Easypaisa require a transaction reference and do not change the physical drawer. These methods record payments the operator has verified; this milestone does not contact a bank or payment gateway.

The payment must be positive integer paisa and cannot exceed that customer's debt in the selected branch. Walk-in customers cannot have a debt account. A payment creates a sequential receipt, ledger credit, authenticated-user audit and, for cash, a shift transaction in one database transaction. Receipt copies can be viewed and printed. Customer name/phone and the debt remaining after payment are stored with the receipt, so later profile edits do not change those receipt fields.

`customer balance = account debits − account credits`

Positive balance is debt owed by the customer. Negative balance is customer credit. Udhaar sales debit the account; collections and Udhaar returns credit it. A return after the debt has been paid can create customer credit; that credit is retained and can offset a later Udhaar debit. Cash refund of account credit and customer payment reversal are separate future workflows. Customer credit is displayed separately and does not reduce another customer's outstanding debt in the Dashboard total.

Payments settle the customer account, rather than being allocated to particular invoices in this milestone. Invoice-level ageing, payment allocation and allocation reversal are pending. Collection does not add sales revenue or gross profit a second time.

## Expenses

Open Expenses to record already-paid operating costs. Enter expense date, description, category, amount, payment method and reference. Categories accept existing suggestions or a new label. Future-dated paid expenses are rejected; recurring, scheduled and unpaid expenses are not implemented.

Cash expenses require an open shift and enough expected drawer cash. A cash payment debits the current physical drawer when saved, even when the expense recognition date is earlier. Noncash methods require a transaction reference and do not use drawer cash. Each posting atomically creates an expense, sequential EXP document number, user attribution, cash movement where applicable and audit event.

Filter by date range, description/document, category and method. Pagination does not change the totals: posted, reversed and net amounts cover all matching transactions. The category summary uses the same filters.

Corrections use Reverse expense with a reason; the original expense is retained. For cash, confirm the money has physically returned to the current open drawer. Reverse only an erroneous posting or an expense whose payment has actually been returned. Reversal creates a separate REV document, current-date negative expense and audit. Cash is credited to the current shift, without changing a previously closed shift's reconciliation. Noncash reversals record the correction; the operator must reconcile the actual bank/wallet transaction separately.

Each original expense can be reversed once. Repeating the same committed operation returns the original result; a new reversal operation for an already-reversed expense is rejected. Legacy expenses without posting metadata remain visible but require reconciliation before reversal.

Dashboard Expenses uses original postings on their expense date and reversals on their reversal date. Reversing yesterday's expense today leaves yesterday's expense intact and reduces today's expense total. A date range containing only a refund can therefore have negative net expenses.

The dashboard profit card is now explicitly labelled Gross Profit: sales less recorded item cost, adjusted for sales returns. Paid operating expenses are displayed separately. Full net-profit statements, accrual accounting, tax reporting and stock valuation are later milestones.

## Roles and data boundaries

| Role | Customer accounts | Opening debt / profile changes | Paid expenses / reversals |
| --- | --- | --- | --- |
| Owner | Read, create, collect and receipts in assigned branches | Allowed | Allowed |
| Manager | Read, create, collect and receipts in assigned branches | Allowed | Allowed |
| Cashier | Read, create with zero opening debt, collect and receipts in assigned branches | Not allowed | Not allowed |
| Inventory | Not allowed | Not allowed | Not allowed |

A cashier can collect cash only into their own open branch shift. An owner/manager can collect into the branch shift. Noncash collection needs no cash shift. Electron validates role, branch and shift ownership before accessing the repositories; hidden buttons are not the security boundary. Posting retry IDs are namespaced by authenticated user.

Customer and expense writes use persisted operation results and atomic audits. Failed writes roll back receipts, ledgers, cash and document sequences. Reusing a committed operation ID with changed input is refused. Desktop query responses are tied to their request, preventing another customer's balance/form from appearing during account switching.

## Migration and backup compatibility

Migration 8 adds customer receipt, expense attribution/reversal and account document-sequence tables. It preserves original customer, expense, ledger, sales and stock IDs. No browser demonstration customer/expense data is imported automatically.

Current backups contain the new tables and financial history. Milestone-3 schema-7 backups remain supported: first validate the original structure and integrity, then migrate a private staged copy to schema 8 and validate it again. The selected original file and its checksum remain unchanged. Versions before 7 and future versions are rejected. Restore still requires owner authentication, review, closed current shifts and a pre-restore safety copy.

## Verification

```powershell
npm run test:database
npm run test:accounts
npm run test:desktop:accounts
npm run test:desktop:auth
npm run test:desktop:recovery
npm run test:desktop:retail
npm run lint
```

There are 102 database tests, including 15 customer/expense tests and two new backup compatibility/state tests. Coverage includes cash/noncash separation, collections after Udhaar sales and returns, opening debt, overpayment, account credits, branch/tenant isolation, inactive customer settlement, ledger pagination, immutable customer fields on receipts, audit rollback, retries after restart, expenses across dates and shifts, reversal rollback and cashier/manager permissions.

The offline accounts desktop smoke submits actual customer creation, cash/bank collection, receipt, profile-edit, cash/bank expense and reversal forms. It verifies selected-account switching, Dashboard totals, drawer closing and backup creation. Authentication smoke checks all 48 protected endpoints reject signed-out callers. All tests use memory databases or separate temporary installations; they do not overwrite the user's live shop data.

Manual verification with disposable data:

1. Create a customer with Rs 100 opening debt, then sell Rs 150 on Udhaar. Verify balance Rs 250.
2. Open a drawer with Rs 1,000. Collect Rs 50 cash and Rs 50 bank with a reference. Customer debt becomes Rs 150; drawer cash becomes Rs 1,050.
3. Record Rs 200 cash expense and Rs 100 bank expense. Drawer becomes Rs 850 and net expenses Rs 300.
4. Reverse the Rs 200 cash expense after physically returning its cash. Drawer returns to Rs 1,050 and net expenses become Rs 100. Original expense and reversal remain visible.
5. Close the shift with Rs 1,050. Restart and verify the account, receipts, expenses and closing persist. Create/export a backup before trying recovery with test data.

## Next milestone

Complete stock valuation and operational reporting: sales/return summaries, customer and supplier outstanding statements, expenses and gross/operating-profit reporting, with explicit accounting assumptions. Customer credit refunds/payment corrections, invoice allocation, export statements and stronger approvals can follow. Company licensing, cloud registration/sync, branch services, multi-counter drawers and signed installer distribution remain pending.
