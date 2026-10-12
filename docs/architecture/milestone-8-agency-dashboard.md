# Milestone 8: secure agency dashboard and individual branch controls

The company now has a browser dashboard at `/agency/`, served by its licensing service. POS owners and company administrators have separate accounts. The dashboard groups registrations by the company's customer/tenant license, shows reported owner/business names and cities, and provides one-click business and branch Enable/Disable controls. Customer records remain on customer installations.

This implementation is tested locally. A public domain, HTTPS reverse proxy and production company server have **not** been deployed. Remote control in another city requires that both the company service and the POS can reach the same public HTTPS origin. Existing signing keys and company registrations must be retained.

## What the agency can do

- Create customer licenses with subscription expiry, device limit and offline validity. The activation key is displayed once; only its hash is stored by the issuer.
- See each owner/customer, reported businesses, branches, cities, device counts, online/offline state and subscription details.
- Disable or enable an entire business, or one branch independently. A suspended business, expired subscription or revoked device overrides an enabled branch.
- Approve new branches using **Enable branch**. Renew subscriptions while preserving all suspension settings.
- Search by customer, reported owner/business, branch, code or city; filter enabled, disabled or expired customers.
- See recent company actions with administrator identity in the audit detail. The private CLI remains available for device revocation, approved rebinds and account recovery.

### What a click means

1. The authenticated company administrator changes the authoritative status in a SQLite transaction that also writes an audit event.
2. Running POS installations refresh their signed license every **10 seconds**, including while logged out or locked. A request already in flight, timeouts, server load or a reconnect can delay the next successful check. This is polling, not an instantaneous push or guaranteed ten-second SLA.
3. The server signs global and individual branch decisions, bound to the tenant, license, device, data installation, nonce and increasing sequence.
4. The POS verifies and protects the signed response before applying it. Main-process permission and license checks stop new sales, purchases, returns, stock changes, payments and staff changes for a locked branch. The current branch and the actual target/destination/held-cart scope are checked; choosing an unlocked context cannot post into a locked target.
5. On its next signed request the device acknowledges the sequence it actually saved. The dashboard displays **Applied · device confirmed** only when all active devices reporting that branch have acknowledged the current effective decision. Before that it shows awaiting confirmation or waiting for connection. Confirmation normally needs one additional heartbeat.

“Online” means a registered device contacted the service within the last 45 seconds. It describes the device connection, not an open cashier session. If one device on a branch is offline, that device can delay the branch's “Applied” label even if another device is online.

**No internet means no immediate remote command.** An offline active POS keeps its last verified branch decision until the signed offline deadline or subscription expiry, whichever comes first. After receiving suspension it stays locked across restart and failed network checks. An offline suspended POS also needs a successful check to receive an unlock. The company sets offline validity to 1–30 days; shorter validity limits the disconnected window but requires customers to reconnect more often. There is no data deletion or remote wipe. Permitted records, reports, exports and owner backups remain accessible; existing shifts can still be reconciled and closed.

## Branch identities and approval

Every agency branch receives its own UUID. Its binding is `(license ID, data installation ID, local branch ID)`; local IDs such as `branch-main` or a `MAIN` code in different customers/installations never refer to the same agency branch.

The **first reporting installation** of a customer registers its existing branches as enabled. Every branch first reported after that, including the first branch on a different installation, starts pending and needs company approval. This prevents a suspended customer from avoiding a branch lock simply by creating another local ID. Renaming, local archive/reactivation, repeated activation and restoring an earlier financial backup never reset an existing agency branch decision.

Multiple licensed devices sharing the same data installation ID/local branch ID receive the same decision. Separate independently created shop databases appear as separate agency registrations even if their names/codes match. Linking independent databases to a canonical cloud branch, merging records and synchronizing sales/stock are **not implemented** by licensing. Until the separate cloud-sync milestone, do not treat duplicate labels as proof that two devices share records.

Company enable/disable is separate from local archive/reactivation and staff branch assignment. Unlocking preserves those local settings; it does not grant a staff role, reopen an archived branch or create a cash shift.

The signed request currently supports at most 50 branch records and is bounded to 16 KB. Keep registration labels concise; oversized inventories fail validation and do not extend the previous lease. Metadata contains business/owner/branch labels and device registration details only; sales, stock, passwords and backup files are not uploaded.

Older version-1 global leases remain readable for legacy CLI/tests. Current POS installations require version-2 branch decisions, upgrade on the next successful check and reject subsequent downgrades. A registered device cannot omit inventory to obtain a global-only replacement. Customer executables must be updated to enforce individual branch controls; an old executable still follows its original global licensing rules.

## Agency account security

There are no default accounts or public administrator-signup endpoints. Provision agency administrators privately with the CLI. Login requires a non-empty password plus a six-digit TOTP authenticator code. Codes permit one 30-second clock step of tolerance and cannot be reused. Sync server/authenticator clocks.

Passwords use salted scrypt (`N=131072, r=8, p=1`). Account-based attempt throttling persists across server restarts; IP limits and bounded concurrent password work supplement it. Invalid login errors do not disclose account existence. Private administrator reset changes both password and MFA, invalidates sessions, and cancels pending login using stale credentials.

Authenticator interoperability is checked against the SHA-1 test vectors in [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), including timestamps beyond 2038.

Sessions use random 256-bit tokens; the company registry stores their hashes. Production cookies use `__Host-vertexia_agency`, Secure, HttpOnly and SameSite=Strict. Sessions expire after 30 minutes without user activity and after eight hours absolutely. Background dashboard polling cannot keep an abandoned session alive. User interaction sends a CSRF-protected activity heartbeat; sign-out deletes the session.

Dashboard mutations require both the exact configured Origin and the session's CSRF token. Dashboard Host is checked against the configured public origin, without trusting arbitrary forwarded headers. No CORS access is enabled. CSP blocks inline scripts, inline styles and framing; labels are inserted using `textContent`, not HTML. Private signing keys, password hashes, TOTP secrets and session tokens are never included in dashboard snapshots. Public assets are an explicit three-file whitelist. Login bodies and activation keys are not logged.

These controls follow the [OWASP session-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). The signing key, company database, MFA enrollment output and their private backups still need server/OS access protection. As before, Windows-protected client state and signed checks are enforcement for the shipped app; a customer who can replace or patch the executable is outside that guarantee.

## Local setup in PowerShell

Run company commands from this repository on the **company machine**, not on a customer POS.

```powershell
npm run build:electron
```

For a **new** company only:

```powershell
$env:VERTEXIA_COMPANY_DATA = 'C:\VertexiaCompany\Licensing'
npm run company:license -- init http://127.0.0.1:8787
```

For a company that was already initialized, set `VERTEXIA_COMPANY_DATA` to its existing private directory instead. **Do not initialize another signing identity or replace the existing files.** Previous licenses and client trust must use the existing issuer. Without this environment variable the CLI uses `.company-licensing` in the current directory.

Create the first agency administrator without putting a password in command arguments:

```powershell
$agencySecret = Read-Host 'Agency password' -AsSecureString
$env:VERTEXIA_AGENCY_PASSWORD = [System.Net.NetworkCredential]::new('', $agencySecret).Password
try {
  npm run company:license -- admin-create agency.admin
} finally {
  Remove-Item Env:\VERTEXIA_AGENCY_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable agencySecret -ErrorAction SilentlyContinue
}
```

Enroll the printed Base32 secret or `otpauth://` URI in a TOTP authenticator privately. This enrollment is not displayed again. Do not publish the terminal output. Agency password and authenticator are separate from the customer's POS owner login.

```powershell
npm run company:license -- serve 8787
```

Open **http://127.0.0.1:8787/agency/** and sign in using the agency passphrase and current authenticator code. The local port must match the configured origin. Keep this process running. A local dashboard can open before an administrator exists, but nobody can log in until private provisioning completes.

For a development POS, copy the absolute path to the same company's **public** trust file into a second PowerShell terminal:

```powershell
$env:VERTEXIA_LICENSE_CONFIG = 'C:\VertexiaCompany\Licensing\client-trust.json'
npm run dev:desktop
```

Complete local owner setup, create a customer license in the agency dashboard and enter that key on the POS **License** page. The owner's business and branches appear on the agency dashboard after a successful check. New branches appear pending after the next online check; click **Enable branch** to approve them. The public trust file contains no private signing key. Never copy the company database, issuer private key or agency accounts into a customer installer.

For forgotten agency credentials, repeat the private passphrase-input flow above and run `admin-reset agency.admin` instead of `admin-create`. Enroll the replacement authenticator secret. Recovery is restricted to whoever controls the company's private server files; it cannot be requested through the public dashboard.

## Production deployment

For local development without hosting, `npm run dev:agency` opens the browser and privately provisions the first agency account; see the [local dashboard guide](../../company/deploy/LOCAL.md). Production serving never exposes that bootstrap endpoint. Local tests can connect a desktop POS on the same PC; remote-city control needs public HTTPS hosting. Vercel deployment requires serverless entry points and an external durable transactional registry rather than uploading the existing SQLite service unchanged.

For `license.vertexiaagency.com`, use the [standalone deployment guide](../../company/deploy/README.md). `npm run company:package` builds a company-only archive with SHA-256 verification, systemd service and private backup timer, Caddy HTTPS template and deployment health verifier. It excludes customer databases and private company credentials. The domain owner currently has only the domain; no server, DNS change or public deployment has been completed.

Use one company HTTPS origin such as `https://licenses.your-company.example` in `client-trust.json`, preserving its existing issuer public key. Run the Node company service on `127.0.0.1:8787` behind an HTTPS reverse proxy. Customer packaged trust must use the HTTPS origin; packaged POS cannot use insecure HTTP. Preserve the public Host header when proxying `/agency/` and `/v1/`; do not expose the internal plain HTTP port publicly.

Example proxy location within a correctly configured TLS server:

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $http_host;
    client_max_body_size 16k;
}
```

The domain, TLS certificate, service process supervision, OS permissions and private backups need deployment configuration. The startup command reads `client-trust.json` and prints the correct dashboard URL. The company process needs a Node runtime that supports the project's `node:sqlite` use, its compiled `electron-dist/electron/licensing` modules, and `company/agency` assets in the same relative layout. Financial sync and .exe installer distribution remain separate milestones.

## Verification

```powershell
npm run test:agency
npm run test:desktop:agency
npm run test:database
npm run test:desktop:licensing
npm run test:desktop:branches
npm run lint
```

All test databases/browser profiles are isolated temporary fixtures, with signed leases and actual HTTP calls. The agency browser smoke uses real forms/buttons, creates a license, signs in with MFA, locks two devices through one branch button, verifies another branch/customer continues, unlocks, checks business override, receipt confirmation, search, mobile controls, one-time-key dismissal and sign-out. The branch workflow driver obtains signed company approval for new test branches; no company administration IPC was added to customer code.

Manual acceptance: disable Lahore, verify its next sale is blocked and Karachi continues; enable Lahore and check it resumes; disable the business and check both lock; renew and verify suspension persists; disconnect a POS before disabling and check the dashboard reports pending delivery; reconnect and verify suspension; restart offline after receiving suspension and verify it stays locked. Do not claim offline immediate lock or label an unacknowledged command as applied.
