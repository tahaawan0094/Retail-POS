# Vertexia Implementation Roadmap

## Phase 1 Foundation

- Confirm the open product decisions in the gap analysis.
- Select Electron as the desktop host if local SQLite, printers and scanners are release requirements.
- Add database migrations, a repository adapter and transaction manager.
- Add authenticated business, branch and user context.
- Establish validation, permission checks, audit events and idempotency conventions.

Exit gate: migrations run on a clean and existing database; permissions are enforced outside the UI; failed transactions roll back completely.

## Phase 2 Products and Inventory

- Product CRUD with barcode uniqueness and activation status.
- Categories, brands and unit conversions.
- Opening stock and append-only stock movements.
- Stock adjustment with reason, permission and audit entry.
- Low/out-of-stock queries.

Exit gate: every stock balance can be explained through movements and decimal quantities remain exact.

## Phase 3 Suppliers and Purchases

- Supplier CRUD and ledger.
- Purchase creation with paid, partial and unpaid states.
- Atomic stock receiving, supplier payment and outstanding updates.
- Purchase return reversal flow.

Exit gate: purchase totals, stock and supplier balances reconcile under retries and failures.

## Phase 4 Customers, POS and Sales

- Customer CRUD, credit limits and ledger.
- Stateful POS cart, search, barcode input and decimal quantities.
- Cash, card, wallet and Udhaar posting.
- Sales history, invoice detail and receipt reprint.
- Controlled sale return and refund workflow.

Exit gate: cash and credit scenarios pass end-to-end tests without duplicate invoices or partial updates.

## Phase 5 Cash, Expenses and Operations

- Open and close shift workflows.
- Cash transaction posting from sales, payments, refunds, supplier payments and expenses.
- Expected versus actual closing cash and difference approval.
- Expense categories and expense posting.

Exit gate: the expected drawer amount is reproducible from cash transactions and closed shifts remain traceable.

## Phase 6 Reports and Configuration

- Dashboard and reports based on source transaction queries.
- Gross/net profit using the approved costing method.
- Business settings, personal preferences and session/device management.
- PDF, spreadsheet and CSV exports where applicable.

Exit gate: report totals reconcile with source modules for identical branch and date filters.

## Phase 7 Desktop and Offline Reliability

- Receipt printer, barcode scanner and barcode label support.
- Backup, restore and recovery testing.
- Durable offline operation and synchronization queue.
- Conflict handling, multi-counter/LAN and multi-branch work after the single-device core is proven.

Exit gate: transactions survive restart, printer failure and network loss without duplication or data loss.

## First implementation slice

Start with Product CRUD plus opening stock and stock movement history. It establishes the database, validation, repositories and audit pattern without risking financial transactions. Follow it with purchase receiving before implementing sale posting.
