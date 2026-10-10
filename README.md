# Vertexia Retail POS

Responsive desktop retail POS for Pakistani marts and stores. Dashboard, POS, Products, Sales, Inventory, Purchases and Suppliers share the local transactional SQLite database. Commercial authentication, backup/restore, cloud synchronization and licensing remain separate implementation milestones.

## Technology

- React and TypeScript
- Tailwind CSS
- Framer Motion
- Vite
- Electron desktop runtime
- SQLite through Electron's built-in `node:sqlite` driver

## Project layout

- `src/app` contains route configuration.
- `src/features` contains one folder per business module.
- `src/shared` contains reusable layout and UI components.
- `src/domain` contains framework-independent business types and repository contracts.
- `src/services` is reserved for shared infrastructure and integrations.
- `src/styles` contains ordered global and shared styles.
- `electron` contains the desktop process, secure preload bridge, database schema and queries.
- `tests` contains database integration tests.
- `docs/architecture` contains the functional gap analysis, domain model and implementation roadmap.

## Commands

```bash
npm run dev
npm run dev:desktop
npm run build
npm run lint
npm run test:dashboard
npm run test:database
npm run test:desktop:retail
```

Use `npm run dev:desktop` for functional development. `npm run dev` only opens the browser frontend and cannot access the local SQLite database.

## Local database

Electron creates `vertexia.db` inside the operating system's application-data folder under `Vertexia Retail POS/data`. The database enables foreign keys, write-ahead logging, full synchronization, constraints and versioned migrations. Money is stored as integer paisa and stock as integer milli-units to avoid floating-point rounding errors.

The current Dashboard reads sales, profit, stock alerts, receivables, payables, expenses, cash-in-drawer, charts, recent sales and activity from SQLite. The POS module provides database-backed product and barcode search, carts, discounts, held sales, customers, shift opening, payment validation, invoice completion, receipt printing, stock deduction, customer credit and cash-ledger entries.

Products provides SQLite-backed creation and editing, opening stock, active/inactive control, search, category/brand/status filters, list/grid views, pagination, product images, scanner-readable Code 128 barcode sheets, CSV import and CSV export. Existing stock cannot be overwritten from the product editor; stock changes belong in Inventory so every adjustment can be audited. Required CSV columns are `name`, `category`, `unit`, `sale_price` and `opening_stock`. Optional columns are `sku`, `barcode`, `subcategory`, `brand`, `purchase_price`, `mrp`, `minimum_stock` and `status`.

A new production database starts with zero transactions and no demo products. Database integration tests create isolated fixtures that are never written to the user's application database.

Inventory displays stock and movements from the same database used by POS. Purchase receiving atomically records purchase items, incoming stock, supplier liability, optional payment, cash outflow and audit history. Cash supplier payments require an open POS shift. Later supplier payments allocate to the oldest unpaid purchases and update their outstanding amounts.

Sales displays real invoices, filters, analytics, invoice details, print/reprint and saleable-item returns. Sales, returns, purchases, adjustments and supplier payments support persisted operation identifiers: retrying the same request returns its original result without posting again. Desktop forms retain pending retry identifiers separately from their financial records. Human document sequences are durable and no longer based on transaction counts.

Existing browser records under `vertexia.product-inventory.v1` are preserved, but are no longer a source of stock or financial postings. Inventory, Purchases and Suppliers show a download option when older browser records exist. There is no automatic import: mixed demo and user records need reconciliation before an explicit migration. Startup no longer deletes existing SQLite records based on a legacy demo marker.

The offline desktop smoke test uses a separate temporary database and disables Electron networking. It submits purchase, return, adjustment and supplier-payment forms and checks their effects against POS, invoice status and the cash drawer.

See [Milestone 1 implementation notes](docs/architecture/milestone-1-shared-retail-database.md) for manual verification, data-migration details and remaining limits.

For development inspection, the SQLite file is stored at `%APPDATA%/Vertexia Retail POS Development/data/vertexia.db`. It can be opened read-only with DB Browser for SQLite or SQLiteStudio while the application is running. Close Vertexia before manually changing the database.

## Implementation direction

Next implement real business onboarding and authenticated user/branch permissions, then complete Customers, Cash/shift closing, Expenses, valuation, backup/restore and reports. Cloud synchronization, company licensing, multi-counter/branch operation and installer distribution follow their own acceptance gates. Current default business/user IDs are development setup, not a completed access-control model.
