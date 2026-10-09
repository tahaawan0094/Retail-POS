# Vertexia Functional Gap Analysis

## Current state

The React application contains responsive frontend screens for every main navigation item and the My Account sub-tabs. Data is static and actions are visual only. The current build is a strong UI reference, but it is not yet a working POS because transactions, persistence, validation, permissions, printing and synchronization have not been implemented.

## Module status

| Module | Present frontend | Functional work required |
| --- | --- | --- |
| Dashboard | KPIs, charts, tables and quick actions | Date and branch filters, calculated aggregates, drill-down navigation and refresh after posting |
| POS | Product grid, cart, payment selection and totals | Barcode input, cart state, decimal quantities, validation, payment handling, atomic sale posting and receipt flow |
| Sales | Sales list and summary UI | Invoice detail, reprint, returns, refunds, void controls and reversal records |
| Products | Catalog table and add-product panel | CRUD, unique barcode validation, unit conversion, price history behavior, import/export and barcode labels |
| Inventory | Overview, stock table and alerts | Stock movement ledger, adjustments, valuation, expiry/batches, transfers and exact decimal quantities |
| Purchases | Purchase list, filters and summaries | Purchase editor, receiving, supplier payment, stock increase and purchase returns |
| Customers | Customer list, profile and history | CRUD, Udhaar rules, payments, ledger and running-balance reconciliation |
| Suppliers | Supplier list, profile and history | CRUD, supplier payments, purchase ledger and outstanding reconciliation |
| Cash and Shifts | Active shift, transactions and summaries | Shift open/close, expected cash calculation, drawer rules, difference approval and immutable history |
| Expenses | Expense list, categories and charts | CRUD, payment/cash effects, categories and controlled recurring drafts |
| Staff | Staff list, profile, permissions and role chart | Authentication, roles, permissions, account disable and audit trail |
| Reports | Charts, tables and filters | Queries based on source transactions, reconciliation, costing method and exports |
| Settings | Configuration categories and system state | Persistent business rules, device settings, backup/restore and permission checks |
| My Account | Profile plus all five sub-tabs | Profile update, password change, sessions, preferences, activity and device revocation |

## Cross-cutting gaps

- No persistent database or migrations.
- No authenticated user or business/branch context.
- No transaction boundary joining stock, money and ledger updates.
- No idempotency protection against duplicate posting.
- No domain validation or permission enforcement.
- No audit log, offline queue or synchronization status.
- No printer, scanner, backup or restore integration.
- Loading, empty, error, offline and permission-denied states are incomplete.

## Required product decisions

1. Inventory costing method, preferably weighted average for the initial release unless the owner selects FIFO.
2. Tax-inclusive or tax-exclusive pricing and default tax behavior.
3. Invoice and purchase numbering format per business and branch.
4. Negative-stock default and which roles may override it.
5. Discount limits and manager approval thresholds.
6. Return window, damaged-return handling and refund rules.
7. Whether partial payment is allowed at POS in addition to purchases.
8. Shift ownership rules and whether one user can hold multiple open shifts.
9. Backup location, retention policy and restore authorization.
10. Sync conflict policy for later multi-device and cloud operation.
