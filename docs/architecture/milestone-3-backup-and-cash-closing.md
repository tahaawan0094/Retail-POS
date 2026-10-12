# Milestone 3: backup, restore and cash-shift reconciliation

Implemented 10 October 2026. This milestone provides local recovery and drawer closing in the Electron desktop app. Company licensing, cloud synchronization and shared multi-counter authority are still pending.

## Operator workflow

Launch `npm run dev:desktop` and sign in. The owner sidebar now exposes Cash & Shifts and Settings. At milestone 3, Customers, Expenses and Reports were visible to the owner with a Planned label and a pending screen; their old demonstration pages are not used as operational modules.

### Cash & Shifts

1. Open a shift with the cash physically present in the drawer. POS can also open it.
2. Cash sales increase the drawer by the sale total, excluding change returned to the customer. Cash refunds and cash supplier payments reduce it. Card, bank and wallet payments do not change physical cash.
3. An owner or manager can record Cash in / Cash out with a reason. These are drawer transfers and do not create business expenses or affect profit.
4. Count the physical cash and enter Counted cash. A shortage or excess requires a note of at least three characters.
5. Close shift. History records expected cash, counted cash, signed difference, closing note, time and the user who closed it. The shift cannot receive further postings. Start a new shift for the next drawer session.

`expected cash = shift cash inflows − shift cash outflows`

`difference = counted cash − expected cash`

The calculation includes every cash transaction attached to that shift, even if the shift crosses midnight. Closing does not invent a cash entry to hide the difference. Dashboard Cash in Drawer shows the current open shift's balance; it shows zero when no shift is open. That zero means no tracked open drawer, not a statement about cash held elsewhere in the shop.

There is one open shift per local branch, enforced by a database index. A cashier sees and closes their own shifts. An owner/manager sees the branch's shifts and can close another cashier's shift. A cashier cannot sell against somebody else's open branch shift. Multi-counter drawers and approvals for closing another user's drawer require a later authority model.

The page displays the latest 100 shifts and up to 300 transactions for the open or most recent shift; older data remains in SQLite. Historical closings from before this milestone can have no recorded counted amount. An existing open shift can be closed normally.

### Backup and restore

Only an owner has backup access; a manager or cashier cannot bypass this through the desktop API.

1. Settings → Create backup creates a full standalone `.sqlite` snapshot for all local branches, including stock, invoices, purchases, cash and credentials.
2. In backup history, Save copy opens the operating system's save dialog. Save to a different drive or a protected removable drive.
3. Close every currently open local cash shift before restoring.
4. Select backup to restore opens a file picker and validates a private staged copy. Review the business, snapshot time, record counts and any open shifts in the selected backup.
5. Enter the current owner's password and an owner username/password that existed in the selected backup. If it came from another installation, explicitly confirm that this is the intended recovery. Type `RESTORE`.
6. The app locks database actions, waits for pending authentication changes, creates a verified safety snapshot of the current database, and installs the reviewed backup.
7. The session is cleared. Sign in using credentials from the restored backup. The login notice identifies the retained safety-copy path. A backup containing open shifts requires physical cash reconciliation after recovery.

Restore replaces local accounts, permissions, stock and all transaction history with the snapshot. Transactions after the snapshot are retained in the safety copy, not automatically merged. Owner passwords changed after a snapshot revert to their snapshot version. This workflow requires working owner credentials; there is no password-recovery backdoor. On a replacement PC, first configure a local owner, then recover the backup with both owner credentials and explicit installation confirmation.

Previews expire after 10 minutes and are bound to the current owner. At milestone 3, restore required schema 7. [Milestone 4](milestone-4-customer-accounts-and-expenses.md) now validates schema-7 backups and upgrades a private staged copy to schema 8. An arbitrary copied live database is not a supported backup.

## Storage and reliability

Local snapshots live beside the application database under `data/backups`. In development this is normally `%APPDATA%/Vertexia Retail POS Development/data/backups`. Backup history lists the latest 100 files; files are retained without automatic pruning. Each snapshot has a JSON catalog entry containing its SHA-256 checksum and metadata.

After business setup, the running app checks every 15 minutes and creates one automatic backup per UTC date. It also checks when launched. The app does not run a separate scheduler while closed. Failed automatic attempts are shown in Settings and retried at the next check.

Snapshots and replacement use the built-in [Node SQLite backup API](https://nodejs.org/api/sqlite.html#sqlitebackupsourceDb-path-options), which takes a consistent SQLite snapshot including committed WAL data. The approach follows the [SQLite online backup guidance](https://www.sqlite.org/backup.html); the app does not copy the live `.db` file while ignoring its WAL.

Before offering a snapshot for recovery the app checks format metadata, exact expected tables/indexes/triggers, schema version, integrity, foreign keys, selected business relationships and a usable owner account. The checksum detects changes since creation or review; it is not a company signature or a defense against a Windows administrator replacing both a file and its catalog.

Snapshots are completed in a temporary file and published after validation and file flushing. Restore uses SQLite backup transactions to replace the database, reopens it and clears authentication. An injected installation/reopen failure triggers recovery from the pre-restore safety snapshot. If that recovery also fails, the app keeps database actions locked and reports the safety-copy path for support. Closing the app normally waits for an active backup/restore operation.

Financial writes for opening, transfers and closing use durable operation IDs, transactional audits and replayed original results. Repeated submission cannot double-open, double-move or double-close. Posting failures roll back all effects. Money remains integer paisa.

## Verification

```powershell
npm run test:database
npm run test:desktop:recovery
npm run test:desktop:auth
npm run test:desktop:retail
npm run lint
```

The database suite now has 85 tests, including 21 backup/cash tests. Coverage includes recovery from committed WAL writes, full state restore, retained safety copies, failure after replacement, corrupt/incompatible backups, missing credentials, invalid relationships, changed staged files, preview expiry, cross-installation confirmation, protected export destinations, daily scheduling, closing reconciliation, cash ownership, transaction rollback, retries after restart and shifts across midnight.

The recovery desktop smoke uses a temporary installation with networking disabled. It submits the actual opening, withdrawal, closing, backup, export, review, password and restore forms, then verifies recovered stock/shift history and signs in again. Native dialog paths are simulated only in that smoke target; normal app dialogs remain interactive. Authentication smoke originally checked all 39 protected endpoints (expanded to 48 in milestone 4) reject signed-out access. Tests do not restore or overwrite the user's normal application-data database.

Manual check with disposable test data: open Rs 1,000, sell Rs 150 for cash, withdraw Rs 200, verify expected Rs 950, count Rs 930 and explain the Rs 20 shortage. Create and export a backup, make a small stock adjustment, then restore the exported backup and verify the adjustment is absent while the safety copy remains listed.

## Remaining commercial work

Local backups are unencrypted and contain business records and credential hashes. Keep them private. Same-disk automatic snapshots do not protect against disk failure, theft or ransomware; off-device storage and encrypted managed backups remain required for a commercial recovery policy. Windows administrator tampering, signed distribution and remote audit integrity are not solved here.

Customer debt collection and operational expenses are implemented in [milestone 4](milestone-4-customer-accounts-and-expenses.md). Stock valuation, dedicated reporting and accounting remain the next local modules. Cloud restore will need device identity reconciliation, restore epochs and synchronization fencing so a restored older snapshot cannot replay stale records or overwrite current cloud state. Company activation/leases, remote license controls, branch services, multi-counter concurrency, installers and signed updates remain separate milestones.
