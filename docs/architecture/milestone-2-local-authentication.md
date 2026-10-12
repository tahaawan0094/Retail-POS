# Milestone 2: business setup, offline login and branch permissions

Implemented: 10 October 2026. This milestone secures the current local desktop application boundary. Cloud identity, licensing and multi-terminal services are separate milestones.

## Start and first-run behavior

```powershell
npm run dev:desktop
```

Pehli dafa business name, branch name, city, owner name, username aur password enter karein. Password 12–128 characters ka ho; long passphrase use kar sakte hain. Owner account automatically sign in ho jata hai. Agli app launch par username/password se login hoga, internet ki zaroorat nahi.

Existing installations par migration 6 credentials, user/branch assignments aur login throttling tables add karti hai. Setup existing business/branch/owner names update karta hai; financial records, customer/supplier balances, stock, invoice identifiers aur existing user references preserve hote hain. No default password is supplied. Existing credentialless staff remains a historical record, with no ability to sign in. Create a new real staff login through Staff.

Existing business/branch/user primary keys remain stable, including identifiers created by the earlier installation initializer. Cloud registration must establish tenant/device identity and reconcile these legacy identifiers before synchronization; the current installation is not a cloud tenant registry.

Only the authorized shop owner should perform this first local setup. This local initializer has no company-issued ownership proof or licensing check yet. Installation provisioning and activation belong to the company licensing milestone.

## Real screens

- **Setup / Sign in:** business initialization, owner credentials, offline login and generic incorrect-credentials messages.
- **Session bar:** current business, staff name, role, assigned working branch and Sign out.
- **Staff:** owner-only listing, search, creation, role/status changes, branch access and temporary password reset. No sample staff rows, fabricated CNICs or phone numbers are displayed.
- **My Account:** actual username, role and assigned branches; functioning current/new/confirm password form.
- **Operational pages:** current identity in headers and sidebar; supported routes depend on role. Frontend controllers use the authenticated working branch.

Customers, Cash & Shifts, Expenses, Reports and Settings still have incomplete prototype screens and are excluded from the current navigation. POS customer creation and shift opening continue to work. New operational modules must receive a backend permission policy before they are exposed.

## Roles and available actions

| Action | Owner | Manager | Cashier | Inventory |
|---|---|---|---|---|
| POS sales, held carts, customer creation, shift opening | Yes | Yes | Yes | No |
| Discounts | Yes | Yes | No | No |
| Sales list, invoice view / print | Yes | Yes | Yes | No |
| Sale returns | Yes | Yes | No | No |
| Dashboard financial totals | Yes | Yes | No | No |
| Product catalog and maintenance | Yes | Yes | No | Yes |
| Inventory and stock adjustments | Yes | Yes | No | Yes |
| Unpaid purchase receiving | Yes | Yes | No | Yes |
| Purchase with payment / supplier payments | Yes | Yes | No | No |
| CSV exports | Yes | Yes | No | No |
| Staff management and password reset | Yes | No | No | No |
| Change own password | Yes | Yes | Yes | Yes |

Roles are deliberately fixed for this milestone. Custom permission editing and supervisor approval inside a cashier checkout are not implemented. For a restricted action, a separately authorized manager/owner currently signs in. Inventory staff can read shared stock, purchase and supplier data but cannot post payments. Cashier invoice details omit the stored cost amount.

## Branch scope

Every user has explicit `user_branches` assignments. Every protected IPC action checks active session, current role and active assigned branch. Query/filter requests, direct branch arguments and held-sale resume/delete requests are covered. Branches from another business, inactive branches and unassigned branches are denied.

The branch picker uses existing assigned branches. This milestone does not create remote branches or synchronize their data. Setup normally provides the existing local main branch. Administrative branch creation, transfers, branch services and multi-counter stock authority are pending.

## Passwords and session lifecycle

- Passwords use asynchronous Node scrypt with a random 16-byte salt, 64-byte derived key and versioned encoding. Parameters: N=131072, r=8, p=1, maxmem=160 MiB.
- Password comparison uses a constant-time comparison. Unknown usernames still run the password derivation path. Password/credential hashes are never returned in session or staff DTOs.
- Auth operations involving hashing are serialized so normal parallel requests do not allocate unbounded scrypt memory. Account state is rechecked before committing administrative actions.
- Five incorrect attempts lock that account for 15 minutes. Twenty failed sign-ins across usernames lock the installation for 15 minutes. Throttle state persists in SQLite across restart; successful login clears the installation counter.
- New staff and reset passwords require a password change before any operational API can be used. Logout remains available.
- Sessions live in Electron main-process memory. No session token is stored in localStorage. Restart requires login.
- Sessions expire after 30 minutes without an authorized API operation or 12 hours absolute lifetime. UI status polls do not extend the idle lifetime.
- Windows lock and system suspend invoke session logout; these OS event handlers still need physical workstation verification.
- Role/status/branch updates and password resets increment the credential version. A live session is revalidated on its next protected request. The UI checks status at most every 30 seconds and on focus; another terminal may visually retain its screen briefly, but protected API access is revoked.
- Logout during an asynchronous login cancels that pending login. Password changes keep the changing user's current session while invalidating other sessions with the older credential version.
- Owners cannot change their own role/status/branch assignments using Staff. Another owner must perform the change. The backend also preserves an active owner with login and branch access.

The secure-storage design follows [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). No recovery backdoor/default password is provided. Owner recovery through verified company support is future work.

## Desktop boundary and attribution

All desktop handlers go through the common trusted-sender wrapper: only the main window's main frame at the exact expected development URL or production HTML file is accepted. Unknown privileged channels are denied. Navigation to other pages, child windows and automatic external navigation are blocked. Production HTML includes a Content Security Policy that allows local scripts, denies inline script/eval, and disallows frames/objects. Inline styles remain allowed for existing React/Framer Motion styling. Development HMR uses its development configuration and does not receive this production policy.

Permissions are checked in Electron before querying/posting, rather than being inferred from visible buttons. CSV export rechecks authorization after its asynchronous save dialog. The preload exposes specific methods and an unsubscribe-capable session-expiry event, not general IPC access. See [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security/).

The current authenticated user is now the cashier/actor for new sales, returns, product changes, shift opening and retail/security audits. Historical documents retain their existing IDs/references. Financial retry IDs are namespaced by authenticated user at the IPC boundary; browser retry metadata is also scoped to user and branch. The same staff member's retry remains idempotent, while another staff member cannot reuse that retry ID to receive their original posting result.

Direct repository calls are an internal trusted interface used by database tests. They do not replace the production IPC authentication boundary. A future branch HTTP service must implement the same authority checks before calling these repositories.

## Manual acceptance test

Use development/test business data.

1. Launch desktop, complete initial setup, verify the new store/owner names. If previously configured, sign in instead.
2. Staff → create a Cashier account with a 12-character-or-longer temporary password and the main branch selected.
3. Sign out; sign in as cashier. Set a different personal password at the required password-change screen.
4. Verify cashier navigation shows POS, Sales, Customers (added in milestone 4), Cash & Shifts (added in milestone 3) and My Account. Product maintenance, supplier payments and staff administration are inaccessible.
5. Use POS to open a shift and sell an available stocked product. On Sales → View, confirm the invoice's cashier name. A return form should be available to an authorized manager/owner only.
6. My Account → change the cashier password. Sign out and verify the new password works.
7. Sign in as owner. Staff → Edit access → change role to Manager, save; sign in as that user and verify manager operations are available.
8. Sign in as owner. Reset that staff password; verify temporary-password change is required on their next login.
9. Disable the account and verify login is refused. Owner can enable an existing credentialed account again.
10. Restart the app; sign in and verify products, invoices, stock and outstanding amounts remain.

For automated checks:

```powershell
npm run test:database
npm run test:desktop:auth
npm run test:desktop:retail
```

The 64 database tests include the prior 50 retail tests and 14 auth/security integration tests. The auth desktop smoke uses an isolated temporary database, disables networking, submits the actual setup/staff/login/password/shift/sale/role/reset/disable forms and originally verified all 30 protected endpoints (expanded to 39 in milestone 3) reject signed-out callers. The retail smoke still covers purchase, sale retry, return, adjustment, supplier payment, stock and cash reconciliation. Smoke accounts exist only in temporary test installations. Expected permission-denial errors appear in Electron's smoke-test logs.

## Practical limits and next milestone

This is local application access control, not protection against a person with Windows administrator access who can edit/replace the SQLite file or application binary. Financial SQLite data is not encrypted at rest. SQLCipher/key protection, code signing, trusted distribution, signed updates, company activation/leases and filesystem access controls remain commercial security work.

Cloud user management, MFA, company support recovery, custom permissions, manager override, multi-device session distribution and tamper-evident remote audit storage are pending. Audits remain local editable SQLite records. Clock manipulation is not solved by these local session/lockout timestamps.

Backup/restore and cash-shift closing/reconciliation are now implemented in [milestone 3](milestone-3-backup-and-cash-closing.md). Customer debt collection and expenses are now implemented in [milestone 4](milestone-4-customer-accounts-and-expenses.md); accounting/report correctness remains pending. These establish recoverable data and end-of-day acceptance before cloud sync, licensing and multi-branch rollout. No installer or cloud deployment is part of this milestone.
