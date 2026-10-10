# Milestone 1: shared retail database

Date: 10 October 2026.

## Implemented behavior

POS, Products, Sales, Inventory, Purchases and Suppliers now use the same SQLite database. Browser/localStorage stock and financial mutations have been removed from the shared provider, and the POS's automatic browser-product importer has been removed.

Purchase receiving commits purchase headers/items, stock movements/balances, supplier liability, payment allocations, applicable cash movement and audit history in one transaction. Partial and unpaid purchases are supported. Duplicate supplier invoice references are blocked per supplier/business, ignoring case. Supplier names entered during receiving resolve to an existing active supplier or create a supplier record.

Supplier payments update the ledger and allocate oldest unpaid invoices first. Purchase paid/due/status fields derive from allocations. Cash payments require an open shift and affect the same cash ledger used by POS; other methods do not affect the physical drawer. These are recorded manual payment methods, not provider-verified electronic integrations.

Inventory reads real catalog stock and opening/purchase/sale/return/adjustment movements. Adjustments require a reason, preserve movement history and cannot reduce stock below zero. Unsupported expiry, dead-stock and transfer tabs are disabled.

The Sales screen now uses the existing SQLite API instead of static sample invoices/KPIs. It offers period/search/payment/status filters, invoice detail, print/reprint and saleable-item return quantities/reasons. Returns preserve original invoice snapshots, restore stock, and reverse relevant cash/customer credit effects. Dashboard net revenue and gross profit also include returns on the date they occur, including returns of previous-day sales.

## Retry and numbering rules

- New retail posting APIs require a stable operation ID.
- POS and return APIs accept operation IDs; existing internal callers without an ID remain compatible but receive a fresh operation each call.
- An operation's canonical request hash and original result persist inside its business transaction.
- Same branch/ID/request returns the original result; same ID with changed payload is rejected.
- UI duplicate submission guards and pending retry metadata prevent ordinary repeated clicks from issuing distinct operations.
- Retry metadata uses separate browser keys; authoritative financial records remain in SQLite.
- Completed forms clear their pending identity. An identical intentional later transaction gets a new ID.
- Document sequences persist separately from row counts and seed from existing maximum document numbers.

This is single-device/local reliability work. Cloud outbox/inbox delivery, device authority epochs, restored/duplicated-device fencing and shared-stock multi-counter operation are not implemented yet.

## Data preservation and migration

Migration 5 adds purchases, purchase items, supplier payments/allocations, operation results and document sequences. Existing schema/data is preserved.

Startup no longer automatically deletes all stock/financial records when `seeded_business_date` exists. Fresh production installations still start without demo transactions. Existing mixed demo/customer databases require an explicit reviewed cleanup or migration rather than a destructive startup action.

Old `vertexia.product-inventory.v1` browser data remains untouched. The migrated screens offer a JSON archive download when the key is present. Those records are intentionally not auto-imported: existing browser seeds, SQLite-imported products and actual customer transactions can overlap. Prepare a reconciled mapping and control totals before a later import. The JSON archive is not a backup of the current SQLite database.

## Manual verification

1. Run `npm run dev:desktop`; browser-only `npm run dev` cannot access SQLite.
2. Create an active product in Products with zero opening stock and a sale price.
3. In Purchases, receive a positive quantity using a supplier name. Use zero amount paid for an unpaid purchase; a paid cash purchase requires opening a shift in POS first.
4. Check Inventory and POS: both show the received stock. Check Suppliers: the purchase and outstanding amount are visible.
5. Open a shift in POS and complete a cash sale. Inventory shows reduced stock and its sale movement.
6. In Sales, open the invoice, enter a valid return quantity and a reason of at least three characters, and post the return. Stock and drawer effects reverse accordingly.
7. In Suppliers, pay some or all of the outstanding amount. Purchase due/status updates without changing stock.
8. In Inventory, post a reasoned adjustment and review its movement.
9. Close and restart the app; records, stock and balances remain.

## Verification

- `npm run test:database`: 50 passing database integration tests, covering atomic rollback, safe migration, duplicate retries, supplier allocations, return-day reporting and restart persistence.
- `npm run test:desktop:retail`: production frontend plus Electron/preload API tested with networking disabled and a temporary database. Exercises actual purchase, return, adjustment and supplier-payment forms, sale IPC retry, stock history, purchase settlement and drawer reconciliation.
- `npm run build`: frontend and Electron TypeScript compilation.
- `npm run lint`: application lint; the earlier document-renderer utility has an existing intentional control-character regex warning.

Vite uses relative build assets so the frontend works when Electron loads its local HTML file without a development server. The smoke window stays hidden and does not use the user's normal development/production database.

## Remaining limits and next work

- Existing business, branch and owner IDs remain default/hardcoded. Real onboarding, login, sessions, permissions and manager approval remain the next foundation task. This is not yet a secured commercial release.
- Supplier contact editing/creation outside purchase receiving is not implemented.
- Purchase orders/returns, batch/expiry tracking, serials and transfers remain future modules.
- Catalog purchase cost remains the latest received cost. A per-branch moving-average inventory valuation engine is not yet implemented; current inventory value is a latest-cost estimate, not certified accounting valuation.
- Returns currently support saleable stock and the original payment method; damage/quarantine and provider refund workflows need separate implementation.
- Zero-total sales/returns and advanced tax/split tender remain outside the existing posting rules.
- Customer management, debt collection, shift closing, expenses and full accounting/report reconciliation still need completion.
- Pending browser retry metadata is not a complete durable request journal/recovery UI. Broader recovery of abandoned or changed uncertain requests is required before commercial certification.
- Backup/restore, power-loss drills, licensing, cloud sync, multi-counter authority and multi-branch operation remain acceptance-gated future work.
