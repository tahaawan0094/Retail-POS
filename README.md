# Vertexia Retail POS

Responsive desktop retail POS for Pakistani marts and stores. The approved UI is preserved while each module is being moved to a local, transactional SQLite database. Dashboard, POS and Products are currently database-backed.

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
```

Use `npm run dev:desktop` for functional development. `npm run dev` only opens the browser frontend and cannot access the local SQLite database.

## Local database

Electron creates `vertexia.db` inside the operating system's application-data folder under `Vertexia Retail POS/data`. The database enables foreign keys, write-ahead logging, full synchronization, constraints and versioned migrations. Money is stored as integer paisa and stock as integer milli-units to avoid floating-point rounding errors.

The current Dashboard reads sales, profit, stock alerts, receivables, payables, expenses, cash-in-drawer, charts, recent sales and activity from SQLite. The POS module provides database-backed product and barcode search, carts, discounts, held sales, customers, shift opening, payment validation, invoice completion, receipt printing, stock deduction, customer credit and cash-ledger entries.

Products provides SQLite-backed creation and editing, opening stock, active/inactive control, search, category/brand/status filters, list/grid views, pagination, product images, scanner-readable Code 128 barcode sheets, CSV import and CSV export. Existing stock cannot be overwritten from the product editor; stock changes belong in Inventory so every adjustment can be audited. Required CSV columns are `name`, `category`, `unit`, `sale_price` and `opening_stock`. Optional columns are `sku`, `barcode`, `subcategory`, `brand`, `purchase_price`, `mrp`, `minimum_stock` and `status`.

A new production database starts with zero transactions and no demo products. Database integration tests create isolated fixtures that are never written to the user's application database.

For development inspection, the SQLite file is stored at `%APPDATA%/Vertexia Retail POS Development/data/vertexia.db`. It can be opened read-only with DB Browser for SQLite or SQLiteStudio while the application is running. Close Vertexia before manually changing the database.

## Implementation direction

Build the remaining transactional modules one at a time: Sales, Inventory, Suppliers and Purchases, Customers and ledgers, Cash and Expenses, Reports and configuration, then desktop hardware and synchronization. Installer packaging is intentionally reserved for the final completed application.
