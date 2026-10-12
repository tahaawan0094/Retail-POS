# Vertexia Retail POS

Responsive desktop retail POS for Pakistani marts and stores. Dashboard, POS, Products, Sales, Inventory, Purchases, Suppliers, Customers and Expenses share the local transactional SQLite database. Local business setup, offline login, staff accounts and branch-scoped role permissions are implemented. Verified local backup/restore and counted cash-shift closing are implemented. Company licensing and tenant/device registration are implemented with a locally testable company service; production hosting and cloud/multi-terminal operation remain pending.

The company now has a secure browser agency dashboard with separate administrator MFA login, customer/branch grouping, individual branch enable/disable, business suspension, renewal and device-confirmed delivery. Online POS checks every 10 seconds; disconnected devices retain signed offline validity. See [agency setup and remote controls](docs/architecture/milestone-8-agency-dashboard.md) for account provisioning, local use and HTTPS deployment. Production hosting remains pending.

The standalone deployment package is ready for `license.vertexiaagency.com`: run `npm run company:package` to generate the archive and SHA-256 checksum in `.releases`. It includes service restart, HTTPS configuration, private company backups and a public deployment verifier. Follow the [server deployment guide](company/deploy/README.md). The company currently has a domain only; live deployment requires hosting. Customer Windows installer packaging remains a separate milestone.

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

For the local browser agency dashboard, run `npm run dev:agency`. First run opens private account/authenticator setup; later runs open normal sign-in. See the [local agency guide](company/deploy/LOCAL.md) for connecting the desktop POS and the later Vercel migration requirements.

```bash
npm run dev
npm run dev:desktop
npm run build
npm run lint
npm run test:dashboard
npm run test:database
npm run test:desktop:auth
npm run test:desktop:retail
npm run test:desktop:recovery
npm run test:desktop:accounts
```

Use `npm run dev:desktop` for functional development. Complete first-run business setup and create an owner password of 12?128 characters; later launches require login. Staff accounts are created by an owner and must change their temporary password at first sign-in. `npm run dev` only opens the browser frontend and cannot access the local SQLite database.

## Local database

Electron creates `vertexia.db` inside the operating system's application-data folder under `Vertexia Retail POS/data`. The database enables foreign keys, write-ahead logging, full synchronization, constraints and versioned migrations. Money is stored as integer paisa and stock as integer milli-units to avoid floating-point rounding errors.

The current Dashboard reads sales, profit, stock alerts, receivables, payables, expenses, cash-in-drawer, charts, recent sales and activity from SQLite. The POS module provides database-backed product and barcode search, carts, discounts, held sales, customers, shift opening, payment validation, invoice completion, receipt printing, stock deduction, customer credit and cash-ledger entries.

Products provides SQLite-backed creation and editing, opening stock, active/inactive control, search, category/brand/status filters, list/grid views, pagination, product images, scanner-readable Code 128 barcode sheets, CSV import and CSV export. Existing stock cannot be overwritten from the product editor; stock changes belong in Inventory so every adjustment can be audited. Required CSV columns are `name`, `category`, `unit`, `sale_price` and `opening_stock`. Optional columns are `sku`, `barcode`, `subcategory`, `brand`, `purchase_price`, `mrp`, `minimum_stock` and `status`.

A new production database starts with zero transactions and no demo products. Database integration tests create isolated fixtures that are never written to the user's application database.

Inventory displays stock and movements from the same database used by POS. Purchase receiving atomically records purchase items, incoming stock, supplier liability, optional payment, cash outflow and audit history. Cash supplier payments require an open POS shift. Later supplier payments allocate to the oldest unpaid purchases and update their outstanding amounts.

Sales displays real invoices, filters, analytics, invoice details, print/reprint and saleable-item returns. Sales, returns, purchases, adjustments and supplier payments support persisted operation identifiers: retrying the same request returns its original result without posting again. Desktop forms retain pending retry identifiers separately from their financial records. Human document sequences are durable and no longer based on transaction counts.

Existing browser records under `vertexia.product-inventory.v1` are preserved, but are no longer a source of stock or financial postings. Inventory, Purchases and Suppliers show a download option when older browser records exist. There is no automatic import: mixed demo and user records need reconciliation before an explicit migration. Startup no longer deletes existing SQLite records based on a legacy demo marker.

The offline desktop smoke test uses a separate temporary database and disables Electron networking. It submits purchase, return, adjustment and supplier-payment forms and checks their effects against POS, invoice status and the cash drawer.

Cash & Shifts records opening cash, drawer transfers and closing reconciliation with required explanations for cash differences. Settings provides owner-only snapshot backups, automatic daily local copies, export, validated restore review and a pre-restore safety copy. Reports is available to Owner and Manager.

Customers now provides real branch accounts, opening debt, cash/noncash collections, ledger history and printable payment receipts. Expenses records paid operating costs and audited reversals against the same drawer; collections never add sales revenue again. The Dashboard explicitly labels gross profit and shows net expenses separately.

See [Milestone 4 customer accounts and expenses](docs/architecture/milestone-4-customer-accounts-and-expenses.md) for roles, manual checks and remaining accounting limits.

See [Milestone 3 backup and cash-closing notes](docs/architecture/milestone-3-backup-and-cash-closing.md) for recovery instructions, acceptance tests and remaining limits.

See [Milestone 2 authentication notes](docs/architecture/milestone-2-local-authentication.md) for roles, security boundaries and login/staff testing.

See [Milestone 1 implementation notes](docs/architecture/milestone-1-shared-retail-database.md) for manual verification, data-migration details and remaining limits.

For development inspection, the SQLite file is stored at `%APPDATA%/Vertexia Retail POS Development/data/vertexia.db`. It can be opened read-only with DB Browser for SQLite or SQLiteStudio while the application is running. Close Vertexia before manually changing the database.

## Implementation direction

Branch weighted-average stock valuation and operational Reports are complete. See [Milestone 5 notes](docs/architecture/milestone-5-stock-valuation-and-reports.md) for the cost basis, report definitions and manual checks. Owner branch administration and two-stage stock transfers now work within this local installation; see [Milestone 6 notes](docs/architecture/milestone-6-branches-and-stock-transfers.md) for setup, access, valuation and manual tests. Company licensing and tenant/device registration are now implemented; see [Milestone 7 setup and testing](docs/architecture/milestone-7-company-licensing.md) to provision a company service and activate the desktop app. Unconfigured or unactivated installations keep reading/recovery available and lock business posting. Production licensing hosting, synchronization between installations, multi-counter/LAN hosting and installer distribution follow their own acceptance gates. Existing primary keys are preserved; cloud identity reconciliation is still required before synchronization.
