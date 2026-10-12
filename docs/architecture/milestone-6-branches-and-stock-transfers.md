# Milestone 6 — Branch administration and stock transfers

This milestone makes multiple branches usable inside the same local SQLite
installation. Single-shop installations continue to use the existing main branch.
It does not yet connect independently installed computers. Company licensing,
cloud registration/synchronization and multi-counter/LAN hosting remain pending.

## Branch administration

Owner has a real Branches page for creation, name/city updates and controlled
archive/reactivation. A branch has a stable UUID and a permanent unique code;
codes compare case-insensitively. The current installation supports up to 100
branches. Records are never deleted by this workflow.

A new branch starts with zero quantities, zero inventory value and no cash shift,
sales, account balances or invented transactions. It shares the business product
catalog, customers and suppliers. It receives zero-stock links to existing
products; later product creation/import creates zero-stock links at other active
branches too. Catalog prices remain business-wide, while weighted-average stock
costs, ledgers, invoice sequences and cash shifts remain branch-specific.

The creating Owner receives access immediately. Staff now loads the business
branch list so the Owner can assign active branches to local staff accounts.
The working-branch selector shows branch name and code and only offers the signed-in
user's assigned active branches. Each branch requires its own shift for sales.
Switching branches refreshes the POS, stock, accounts and reports context.

Archiving requires a reason and rejects the current working branch, open shifts,
nonzero quantities or stock value, pending inbound/outbound transfers, held carts,
any nonzero customer/supplier account (including credits), and active staff who
would lose their only active branch. A staff account being created during password
hashing revalidates branch activity before insertion. This prevents an archived
branch from becoming a newly created account's only access.

Archive retains history and assignments, hides the branch from operational
selectors and immediately prevents new API operations there. Users working on an
archived branch lose that session when the main process rechecks their access.
Reactivate preserves IDs/history, restores missing zero-stock catalog links and
grants the acting Owner access. Historical branch reports can be viewed again
after reactivation. There is no separate read-only archived-branch report mode yet.

## Transfer lifecycle

Stock Transfers supports multiple products and quantities with three decimal
places. Each consignment receives a permanent `TRF-CODE-YYYYMMDD-NNNN` number.

1. **Dispatch:** validate the business and both active branches, reject duplicates,
   require positive safe quantities and enough source stock. Allocate exact cost
   using the source branch's current moving average. Save immutable product name,
   SKU, unit, quantity, cost and estimated-cost snapshots. Remove source stock and
   cost atomically. Destination stock remains unchanged.
2. **In transit:** the consignment is unavailable for sale at either branch. Pending
   lists show outbound/inbound count and value. The source branch owns its outbound
   in-transit value for reporting; consolidation counts it once.
3. **Receive:** the destination confirms that every listed item physically arrived.
   Add all quantities and the original dispatched costs to destination stock,
   combining them with its existing moving average. Record receiver, time and note.
   Receipt is allowed if a product was deactivated after dispatch; it cannot be sold
   while inactive. A destination without a stock row receives a zero baseline first.
4. **Cancel:** Owner/Manager at the source confirms all goods physically returned,
   gives a reason and restores the original quantities/costs to the source.
   A later purchase-price change does not change the cost restored by cancellation.

Received/cancelled transfers cannot be completed again. Retry IDs return their
original committed result without duplicate stock, costs, movements or audits.
All posting effects and durable retry results share one transaction. An audit,
valuation, quantity overflow or other posting failure rolls everything back.
Cross-business and wrong-branch references are rejected in the main process and
repository. Transfer receipt requires destination access; cancellation requires
source access. Dispatch requires access to both source and destination.

Every dispatch, receipt and cancellation records linked stock/cost movements and
an authenticated audit event. Transfers never create sales, customer/supplier
payments, cash entries or profit. Estimated source costs carry their estimate flag
through receipt/cancellation. Fractional quantities preserve the original total
cost without rounding drift.

Whole-consignment receipt/cancellation is supported. Partial receipts, shortages,
damaged-in-transit write-offs, carrier tracking and partial cancellation are later
work. The confirmation form explains that differences must be resolved before
confirming the full consignment; it must not be used to falsely confirm missing
goods. Branches on different computers cannot use this lifecycle until cloud
transport and conflict handling are implemented.

## Reports, migration and backup

Reports adds a transfers table filtered by dispatch date, with current lifecycle
status and completion time. CSV includes those rows and the existing print flow
prints the displayed report. Inventory value is now split into current on-hand
cost and outbound in-transit cost; their sum is disclosed as current total inventory.
Incoming consignments are displayed in Stock Transfers but are not double-counted
as destination-owned inventory before receipt. These current balances remain
independent of report date filters.

Migration 10 adds transfer headers, immutable line snapshots and durable document
sequences, and fills missing zero-stock catalog links at existing active branches.
It preserves historical transactions and version-9 recorded valuations. Older
version-7/8 backups still initialize legacy estimated valuation during staged
upgrade; version-9 backups keep their recorded cost basis. Restore retains branch
assignments, pending consignments and lifecycle/cost snapshots. Backup sources are
unchanged; upgrades run on a private reviewed copy.

## Roles

| Role | Branch administration | Transfer history | Dispatch | Receive at destination | Cancel at source |
| --- | --- | --- | --- | --- | --- |
| Owner | Yes | Assigned branches | Both branches assigned | Assigned destination | Assigned source |
| Manager | No | Assigned branches | Both branches assigned | Assigned destination | Assigned source |
| Inventory | No | Assigned branches | Both branches assigned | Assigned destination | No |
| Cashier | No | No | No | No | No |

Branch management is business-wide Owner administration. Operational transfer
access remains limited to assigned branches. A receiver assigned only the
destination can receive an incoming consignment without access to the source's
inventory, accounts or other operational records.

## Verification

Run `npm run test:branches` for lifecycle, valuations, rollback, retry, role/branch
isolation, migration, staff lockout protection and archive checks.
`npm run test:desktop:branches` uses an isolated offline installation to submit real
branch, staff-assignment, dispatch, receive, cancellation and archive/reactivate
forms. `npm run test:database` runs all database regressions, including older backup
upgrades and restoring pending shipments. Tests do not use the normal shop database.

Manual test in a test shop:

1. Owner: create a Lahore branch with code `LHR01`; check it in the branch selector
   and Staff assignment choices. Existing products should have zero Lahore stock.
2. At Main, create/open stock of 10 units at Rs 100 each. Dispatch 2 to Lahore.
   Main should hold 8, Lahore 0, and Rs 200 should be shown in transit.
3. Switch to Lahore, open the consignment and physically confirm full receipt.
   Lahore should hold 2 at Rs 200 total cost. Main still holds 8 at Rs 800 cost.
   Consolidated stock value remains Rs 1,000 and gross profit remains unchanged.
4. Dispatch another 1, then cancel at Main after physically returning it. Main
   should return to 8; Lahore should remain at 2. Restart to verify persistence.
5. Create an empty third branch, archive with a reason, then reactivate. Verify
   that a branch with stock, open shifts, balances or pending goods cannot archive.
6. Check transfer history, consolidated Reports and older/current backup restore.

Next work: company licensing and cloud tenant/device registration, followed by a
durable synchronization protocol and tests between independent installations.
