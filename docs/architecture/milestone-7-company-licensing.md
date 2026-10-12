# Milestone 7: company licensing and tenant/device registration

## What is implemented

This note records the milestone-7 baseline. The later [milestone-8 agency dashboard](milestone-8-agency-dashboard.md) adds authenticated browser administration, individual branch decisions and 10-second checks, superseding the CLI-only and 15-minute descriptions below.

The desktop app now has an owner-only **License** page alongside the existing navigation. The existing business screens retain their layouts. Signed-in staff can read license status and see a small notice when a license requires attention. Only an owner can activate or request a manual online check. Existing authentication, permissions and branch assignments still apply.

A working company service issues licenses, assigns globally unique tenant IDs, registers device public keys, enforces installation/device binding and device limits, and returns signed license decisions. Company administrators issue, suspend, resume, renew, revoke or explicitly rebind registrations using a private CLI. There is no public administrator API or company web dashboard in this milestone.

This service has been tested locally. **A production company domain/server has not been configured or deployed.** Customer sales and stock are not uploaded. Cross-installation cloud sync, multi-counter hosting and the signed Windows installer remain subsequent milestones.

## Customer lifecycle

1. The company initializes its signing identity once, then runs the licensing service.
2. The company issues a customer license with an expiry, device limit and offline validity policy. The activation key is shown once by the issuer; the registry stores only its SHA-256 hash.
3. The customer completes normal local business/owner setup and signs in. An unconfigured or unactivated installation permits recovery and reading but requires activation for business posting.
4. The owner enters the company activation key on **License**. The app signs a request using its own device key. The company registers this public key and local data installation ID under the customer tenant.
5. The app verifies the company's signed response, matching the request nonce, device ID, installation ID, tenant, license and increasing sequence. It saves protected state before enabling transactions. It discards the activation key after use.
6. The app checks online on startup and every 15 minutes while running. The owner can also press **Check license online**. Network failures retain the previous signed decision and deadline; they never extend validity.
7. Suspension, expiry or device revocation locks business posting when the signed decision is received or local validity ends. After payment, the company renews and resumes the license as appropriate; an online check enables posting again.

Registration does not rename legacy local primary keys such as `business-noor-mart` and `branch-main`. The cloud tenant UUID is the server-issued customer namespace; a later sync implementation must use it with explicit local/cloud entity mapping and idempotent device operations. Sharing an activation key across permitted devices does not yet merge their local branch catalogs or records.

## States and offline policy

| State | Transactions | Recovery |
| --- | --- | --- |
| Unconfigured / unactivated | Locked | Sign-in/setup, permitted records, reports, backups available |
| Active | Enabled | Available |
| Grace | Enabled until signed offline deadline | Available; reconnect notice |
| Expired | Locked | Available; reconnect or company renewal needed |
| Suspended / revoked | Locked, including after restart | Available; company action needed |
| Clock error / invalid security state | Locked | Available; correct time/check online or company support |

Default policy: an online check is due after 24 hours; the signed offline deadline is seven days from the last accepted company decision, capped at subscription expiry. The issuer can choose **1–30 offline days** per license. A one-day policy has no additional grace beyond the daily due time.

Remote suspension cannot reach a computer without a connection. A disconnected app with an earlier valid active lease can work until that lease's deadline. Connected apps normally learn suspension within the 15-minute check interval; the manual button applies it immediately. This is a bounded offline lease, not instantaneous remote control without internet.

Business posting is blocked in the Electron main process, including sales, returns, purchases, payments, expenses, stock changes, transfers, catalog edits, branch changes, held-cart mutations and staff creation/access changes. Unknown future IPC channels are locked by default until explicitly classified. A UI change alone cannot bypass the IPC guard. Asynchronous staff password hashing rechecks the license before committing.

Existing shifts may still be counted and closed to reconcile an existing drawer. Starting a shift and moving cash remain locked. Local login, own-password changes, authorized read/report/export actions and owner backup/restore are available. Normal restore ownership/password checks and the requirement to close current shifts remain enforced. No licensing key or decision is included in a financial backup.

## Security and storage

- Ed25519 company signatures; the public verification key is in the client trust configuration. The company private signing key stays on its private machine/server.
- Each device generates its own Ed25519 key pair. Device ID is the SHA-256 hash of its canonical public key. It is a registration identity, not a hardware serial number.
- The installed Electron 44 `safeStorage` API protects the whole local device file through the OS credential protection facility. On Windows this uses DPAPI. The renderer receives status and public IDs, never the device private key. See [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) and [Node crypto signing](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptosignalgorithm-data-key-callback).
- Protected file: `<Electron userData>/licensing/device.bin`, outside `<userData>/data/vertexia.db`. State includes accepted signature, highest response sequence, observed time and a clock-error latch. Atomic flushed replacement happens before enabling posting.
- Highest observed wall time is protected and checkpointed at least each minute of status/posting checks; monotonic elapsed time prevents a frozen clock extending validity in one process. A rollback over five minutes locks until a successful signed online check with corrected time. There is no perfectly tamper-proof trusted clock on a fully offline customer-owned computer.
- Requests prove possession of the device private key and bind action, installation, timestamp, nonce and activation/tenant identity. The company accepts timestamps within five minutes; request nonces cannot be reused during the request validity window, including across service restart.
- Company registration and nonce/sequence updates commit together in SQLite transactions. Activation retries reuse an existing device slot. A revoked device remains revoked even when its key is re-entered.
- Client responses must match the pending request and exceed the accepted sequence. Invalid signatures, mismatched tenants, stale/replayed responses, oversized responses, redirects and service errors do not replace a valid cached decision.
- The network service exposes only `/v1/activate` and `/v1/refresh`, bounds body/response sizes and request duration, and has a basic per-address request limit. It does not log activation keys or request bodies. Deploy a production reverse proxy with HTTPS and operational rate limits; requests from one reverse proxy otherwise share the process's loopback limit.
- A packaged app reads `resources/licensing-trust.json` and permits HTTPS only. Development permits HTTP only at numeric loopback addresses. Packaged apps ignore development/smoke environment overrides.
- No trial or hidden unlicensed bypass is enabled. Missing, corrupt or unverifiable configuration/state locks posting while retaining recovery access.

This protects the ordinary app execution path. It does not make a locally modified Electron binary impossible to bypass. An administrator who controls the computer can patch code, restore an entire older OS/protected-state image, or run copies within the same OS account. Production distribution still needs signed installers, update verification, restricted service/secret access and review of the deployed configuration. Device key copying within the same account is not hardware attestation.

## Running a local company service for manual testing

Use a supported Node version with built-in `node:sqlite` (the workspace uses Node 26). All commands below run from the repository in PowerShell. Keep the company directory private; do not distribute it with a customer app.

Initialize once and issue a test license:

```powershell
npm run build
npm run company:license -- init http://127.0.0.1:8787
npm run company:license -- issue "Development Shop" "2027-10-10T23:59:59Z" 2 7
npm run company:license -- serve
```

Save the returned `activationKey` privately. Leave the company service terminal running. In a second PowerShell terminal:

```powershell
$env:VERTEXIA_LICENSE_CONFIG = (Resolve-Path .company-licensing/client-trust.json).Path
npm run dev:desktop
```

Sign in as the existing owner, open **License**, enter the issued activation key, and activate. `dev:desktop` uses the existing Development app data location; it does not move the normal packaged-app database. If you use `npm run start:desktop`, set the same environment variable in that terminal; that command uses the normal desktop app data location. Activation does not replace sales, inventory or accounts.

For a private company directory outside the repository, set `$env:VERTEXIA_COMPANY_DATA` to its absolute path before company commands. Use its `client-trust.json` path in the development environment. The default `.company-licensing/` and private PEM keys are ignored by Git. On Windows, file mode `0600` alone is not an ACL policy; restrict the company directory to authorized operators/service accounts through Windows permissions.

Company control examples (substitute actual IDs; run in another terminal while the service is up):

```powershell
npm run company:license -- list
npm run company:license -- devices LICENSE_ID
npm run company:license -- suspend LICENSE_ID "Payment overdue"
npm run company:license -- renew LICENSE_ID "2027-12-31T23:59:59Z" "Renewal paid"
npm run company:license -- resume LICENSE_ID "Payment verified"
npm run company:license -- revoke-device DEVICE_ID "Lost computer"
```

Renewal changes the expiry; it deliberately preserves suspension. Use `resume` after verifying payment when appropriate. While the service is running, these commands update its database safely through SQLite transactions and file locking. Do not change issuer keys during live use; rotation/disaster recovery needs a planned trust update.

## Restore and replacement devices

Restoring a same-installation business backup on the same device retains the latest external license decision. Restoring an old database cannot remove a received suspension, revive a revoked device or extend offline validity.

Restoring records from a different installation produces a binding mismatch. The owner can inspect records and backups, but posting stays locked. After verifying that the restore belongs to the licensed customer, the company can explicitly approve the new data installation ID:

```powershell
npm run company:license -- rebind-device DEVICE_ID NEW_INSTALLATION_ID "Owner and recovery verified"
```

The owner then checks online. Rebinding is audited and retains the tenant/license and device limit. It does not revive a revoked device. A replacement computer generates a new device key; revoke the lost device to free a slot and activate the replacement. DPAPI-encrypted device files should not be copied as a computer migration mechanism.

Company disaster recovery requires a separate private backup of the signing key **and** registry database including devices, sequence counters and nonce/audit state. POS backups do not contain either. Loss of the signing key needs a company trust migration; rollback of registry sequence counters may require company reconciliation before clients accept responses.

## Verification

```powershell
npm run test:licensing
npm run test:database
npm run test:desktop:licensing
npm run test:desktop:auth
npm run test:desktop:recovery
npm run lint
```

Database tests use temporary company/device directories and in-memory or temporary shop databases. Desktop tests initialize a temporary company service and signed license with real OS protected storage; they do not bypass the license guard or contact a production company. No normal customer data or company secret is changed by the tests.

Manual acceptance:

1. Activate from the owner form; confirm tenant/device IDs and offline deadline.
2. Post a sale; restart offline and post another before the deadline.
3. Suspend through the company CLI, check online and verify direct IPC posting is also denied.
4. Confirm history/report access and owner backup still work; reconcile/close an existing shift.
5. Renew/resume, check online and post again with the same registered tenant.
6. Stop the company service: the previous valid signed lease stays usable until its deadline. A cached suspension stays suspended.
7. Test clock changes only in isolated test data or a disposable machine; a clock error must require corrected time and a signed check.
8. Restore a same-installation backup while suspended; it must remain locked. A different installation needs an audited company rebind.

## Next milestone

Cloud synchronization: tenant-scoped server data, authoritative branch/entity mapping, durable outbox/inbox, authenticated device requests, idempotency, conflict rules, stock conservation and reconnect/recovery tests. Registration alone does not provide those guarantees.
