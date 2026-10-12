# Vertexia Architecture

- `functional-gap-analysis.md` compares the current UI with required behavior.
- `domain-model.md` defines data conventions, aggregates and transaction invariants.
- `implementation-roadmap.md` gives the safe implementation order and exit gates.
- `milestone-1-shared-retail-database.md` records the shared SQLite milestone completed on 10 October 2026, its verification and remaining limits.

- `milestone-2-local-authentication.md` records business setup, offline login, real staff accounts and enforced branch/role permissions.
- `milestone-3-backup-and-cash-closing.md` records verified offline backup/restore, safety recovery and counted cash-shift closing.
- `milestone-4-customer-accounts-and-expenses.md` records branch-scoped customer debt collection, payment receipts, paid expenses and audited reversals.

- `milestone-5-stock-valuation-and-reports.md` records branch moving-average costs, estimated legacy valuations, operational reports and print/CSV exports.

- `milestone-6-branches-and-stock-transfers.md` records local branch setup, staff assignment, stock dispatch/receipt/cancellation and in-transit inventory reporting.

The original gap analysis and roadmap describe the initial baseline; consult milestone notes for later implemented behavior.

The functionality guide remains the product behavior source of truth. UI reference images remain the visual source of truth.

- [Milestone 7: company licensing and tenant/device registration](milestone-7-company-licensing.md)
- [Milestone 8: secure agency dashboard and individual branch controls](milestone-8-agency-dashboard.md)
