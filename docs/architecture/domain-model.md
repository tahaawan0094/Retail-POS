# Vertexia Domain Model

## Storage conventions

- Store money as integer paisa to avoid floating-point rounding errors.
- Store stock quantity as integer thousandths of the base unit. This preserves quantities such as 0.750 kg exactly.
- Give every posted business record a stable UUID and timestamps.
- Scope operational records by business and branch.
- Store product, customer and supplier display values as transaction snapshots where historical documents must remain unchanged.
- Deactivate referenced master records instead of hard deleting them.

## Main aggregates

### Catalog

Product owns identity, classification, units, current prices, stock settings and tracking options. Unit conversions translate cartons, packs or other sale/purchase units into one internal base unit.

### Inventory

Stock Level is the current balance for one product at one branch. Stock Movement is the append-only explanation of every change. Current stock must always be reproducible from valid movements or reconciled through a controlled adjustment.

### Sales

Sale owns invoice totals, items and payments. Completing a sale creates the invoice, payments, stock movements, customer ledger entries where needed, cash transactions where needed, and audit events inside one transaction.

### Purchasing

Purchase owns supplier, received items, totals, payment and amount due. Posting creates stock movements and supplier ledger entries together.

### Customer and supplier ledgers

Every event that changes outstanding balance creates a ledger entry. The profile outstanding amount must equal the ledger ending balance.

### Cash shifts

Cash Shift owns opening cash, cash-affecting transactions and closing reconciliation. Card and wallet sales do not increase the physical drawer. A closed shift is immutable except through a controlled correction workflow.

### Identity and audit

Staff User receives permissions through a role. Permission checks run in application services, not only in the UI. Audit Event records sensitive actions and cannot be edited by ordinary users.

## Transaction invariants

1. A sale or purchase either posts completely or has no effect.
2. A request identifier makes posting idempotent and prevents duplicates during retries.
3. Credit sales require a named customer; the walk-in customer cannot hold an outstanding balance.
4. Stock cannot go below the configured threshold unless an authorized override is enabled.
5. Return quantity cannot exceed the remaining returnable quantity.
6. Customer and supplier profile balances reconcile with their ledgers.
7. Cash summaries include only payment methods and events that physically affect the drawer.
8. Historical documents preserve original names, quantities, prices, costs, taxes and discounts.
9. Financial and stock corrections use reversals or adjustments rather than silent deletion.
10. Printing and synchronization failures do not undo a transaction already committed locally.

## TypeScript contracts

Initial framework-independent types and repository ports are in `src/domain`. They contain no React, SQLite or network dependency, allowing the same rules to be tested and reused by an Electron main process, local database adapter or future cloud API.
