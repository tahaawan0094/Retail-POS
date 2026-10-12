# Milestone 5 — Branch stock valuation and operational reports

Implemented for the local Electron/SQLite installation. Cloud synchronization,
company licensing, branch provisioning and installer distribution remain separate
milestones. An assigned branch can be reported independently; Owner/Manager can
consolidate their assigned active branches whose records exist in this database.
This does not synchronize different computers or branch installations.

## Cost accounting

Stock has a separate cost balance for each `(branch, product)`. Quantity remains
integer milli-units and cost remains integer paisa. Valuation uses moving weighted
average: ten units costing Rs 100 each plus ten costing Rs 200 each produce
twenty units worth Rs 3,000 and an average cost of Rs 150. Selling two removes
Rs 300 from stock and records Rs 300 of cost of goods sold.

The engine allocates cost from the total stock cost balance using integer half-up
rounding. Intermediate multiplication uses BigInt; persisted results must fit a
safe integer. Selling the remaining quantity removes its entire remaining value.
Displayed unit averages are rounded for presentation; the engine stores each
sale line's exact allocated total cost independently of that displayed average.

- Opening stock uses its entered purchase cost, including CSV/quick product entry.
- Purchases add their actual received line total to branch stock cost.
- Changing a catalog purchase price never revalues existing branch stock.
- A return restores the cost allocated on the original invoice, even if newer
  purchases have changed the average. Cumulative partial-return rounding preserves
  the original total; earlier-version partial rounding is capped at the remaining
  original amount. Original invoices remain unchanged.
- Stock count decreases remove average cost. Count increases use the existing
  average, or catalog cost if the branch has no stock, and are marked estimated.
- Known purchases added to estimated stock keep the estimate flag until that
  balance is exhausted. Depletion clears it; returns of estimated goods restore it.
- Opening, purchase, sale, return and count-change cost movements are recorded
  alongside stock movements. New quantities, cost values, sales, cash, audits and
  retry results commit together or roll back together.

Migration 9 initializes old branch stock using its existing catalog purchase
price and explicitly marks nonempty balances estimated. Complete historical
purchase-layer reconstruction is unavailable, so this is an estimate rather than
a claim about original cost. Old sale cost snapshots, invoices, quantities,
receipts, expenses and financial ledgers are preserved. Historical sale-line cost
snapshots are marked legacy/estimated. Backups from versions 7 and 8 can be
reviewed and upgraded on a private staged copy; the source backup stays unchanged.

## Reports and permissions

Reports is now an active sidebar page for Owner and Manager. Cashier and Inventory
staff cannot call financial report APIs. Inventory staff retain the inventory
valuation summary because their existing retail access already includes costs.
Every API verifies authentication, permission and selected branch. Consolidation
uses assigned branches from the authenticated session, ignoring client-supplied
branch-ID arrays. CSV additionally requires export permission and revalidates the
caller after the native save dialog closes.

Available tables: sales/returns, expenses/reversals, purchases, customer balances,
supplier balances, branch stock valuation and cash shifts. Overview displays
period totals, net sales by payment method and the sales/return transaction table.
Tables paginate up to 100 rows per page. CSV exports the entire selected table
(up to 100,000 rows), with headers, business, period and generation time. Text that
could become a spreadsheet formula is escaped. Printing prints the displayed
report page with business and scope identification, excluding application controls.

Pakistan business dates determine period filtering. Returns belong to their posting
date, not the original sale date. Expense reversals similarly belong to the reversal
date. Cash shift reports select shifts by opened date; open shifts have no final
count/variance until closing. Purchase allocations shown are current allocations,
even when the purchase itself was received in an older reporting period.

Current customer dues, customer credits, supplier dues, supplier credits and stock
value are labeled **current** and do not pretend to be balances at the selected end
date. Credits never offset a different account or a different branch's debt.
Stock value includes inactive products still held in inventory.

Net sales = sales − returns. Gross profit = net sales − net invoice/return cost.
Gross profit less paid expenses subtracts net paid operating expenses. This is an
operating indicator: tax, depreciation, unpaid/accrued bills and inventory write-off
expenses are not included. Stock count cost changes are disclosed separately.
Collections settle receivables and never count again as sales revenue. Supplier
payments are cash/account settlements, not an additional cost of goods sold.
Udhaar in the payment-method breakdown means credit revenue, not cash received.

## Verify

`npm run test:reports` checks cost changes, branches, partial returns, rollback,
retry protection, CSV/imports, migration, date boundaries and role enforcement.
`npm run test:desktop:reports` runs an isolated offline desktop installation and
checks actual Reports controls, all report tables, CSV saving and Inventory values.
`npm run test:database` runs all database regressions.

Manual check in a test shop:

1. Create a product with 10 units at Rs 100 purchase cost and Rs 300 sale price.
2. Receive another 10 units at Rs 200. Sell 2 units. Reports should show Rs 600
   revenue, Rs 300 cost, Rs 300 gross profit and Rs 2,700 remaining stock value.
3. Post a Rs 50 paid expense. Gross profit stays Rs 300; gross profit less paid
   expenses becomes Rs 250. Cash payments change the open drawer.
4. Receive goods at a different cost, then return an original sale item. Check
   that its restored cost comes from the original sale, not the new average.
5. Compare the selected branch against all assigned branches in a local test
   database. Switch among tables, change dates, paginate, export and print.
6. Restart the application. Recorded valuation and reports must persist. Use a
   test backup from an older version to verify the estimated-cost notice.

## Remaining work

There is no full general ledger, tax engine, accrual/P&L accounting, historical
stock-as-of report, warehouse transfers, landed-cost allocation, purchase returns,
cloud reporting or branch creation UI in this milestone. Cloud work needs tenant
and device identities, server authorization, event-based synchronization and tested
conflict handling before branches can exchange data between installations.
