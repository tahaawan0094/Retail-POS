# Local agency dashboard

The agency dashboard runs in a browser on your company PC. The customer POS remains an installed desktop app. This setup needs no domain, VPS, Cloudflare account or public tunnel. It is local development, not public hosting.

## Start

From the project folder:

```powershell
npm run dev:agency
```

The browser opens automatically. On a new company installation, create a separate agency username and password (both required, with no character-count limits), add the displayed setup key to a time-based authenticator account, then enter its six-digit code. Keep a private recovery copy of the authenticator key before continuing. After enrollment the agency dashboard opens; future launches use normal password and authenticator sign-in.

Keep the terminal running. To stop the service press Ctrl+C. The normal dashboard address is `http://127.0.0.1:8787/agency/`. If the browser cannot open, start with `npm run dev:agency -- --no-open` and privately use the first-run link printed in that terminal. Do not share that setup link. Changing the port requires the same port in the company's existing public trust file; startup preserves the existing configuration and refuses mismatches.

Running the command again reopens the matching existing agency service, including its private first-run window if setup is still pending. The private company directory contains a local instance descriptor used to authenticate this reopening; it is excluded from releases and company snapshots. An unrelated service occupying the port is left running and reported explicitly.

The runner enables browser provisioning only on numeric loopback HTTP, with a fresh random capability. Automatic browser launch exchanges the private link for a short-lived HttpOnly/SameSite setup cookie, then redirects to the clean setup URL. The sign-in page shows a Create agency account link while first-time setup is pending. Provisioning requires the capability or its private browser cookie, the exact Host and Origin, and an empty administrator registry. Concurrent setup is rejected, and provisioning clears the setup cookie. The manual fragment link remains supported. The standard production `company:license -- serve` command exposes no browser provisioning endpoint.

## Existing company

If your company was already initialized elsewhere, set `VERTEXIA_COMPANY_DATA` to that same private directory before starting. The default is `.company-licensing` in this project. Startup creates a signing identity only in an uninitialized directory and never replaces an existing issuer, license registry or account. A partial/corrupt installation stops for recovery instead of silently creating a new issuer. An existing HTTPS configuration is preserved; use the configured service command instead of changing a live company's URL for a local test.

If enrollment was interrupted after account creation, use the existing private `admin-reset` procedure in [agency setup](../../docs/architecture/milestone-8-agency-dashboard.md), enroll its replacement secret privately, and sign in. There is no public password-reset or default password.

## Connect the local desktop POS

In a second PowerShell terminal, using the company directory printed by the runner:

```powershell
$env:VERTEXIA_LICENSE_CONFIG = (Resolve-Path '.company-licensing/client-trust.json').Path
npm run dev:desktop
```

Use the actual company path if you selected a different directory. In the agency dashboard create a customer license. Enter its activation key on the desktop POS License page and verify online. The customer's owner and branch details appear after a successful check. Use the business or branch enable/disable buttons and verify the POS receives the signed policy; online checks run every 10 seconds. New branches need agency approval.

`127.0.0.1` refers to the machine running the POS. This local setup connects a POS on this same PC; it cannot control disconnected or remote-city installations. Public HTTPS hosting is needed for those installations. Signed offline validity and the persisted disabled state continue to apply.

## Later Vercel deployment

The dashboard uses same-origin `/agency/api/*` and `/v1/*` URLs, so the frontend is not tied to a local hostname. The current backend, however, runs a persistent Node HTTP service and stores the issuer/registry locally in SQLite. Uploading the static HTML alone does not deploy licensing or authentication.

For Vercel, add serverless API entry points and an external durable transactional database (for example PostgreSQL), move the issuer into protected server-side secrets, and preserve license IDs, device sequences, administrator hashes/MFA and audit records. Replace process-local concurrency/rate-limit state with shared durable controls. Verify atomic registration, nonce replay prevention, session security, backup migration and signed branch delivery before changing customer trust to the public HTTPS origin. Keep the same issuer when migrating existing customers.

Vercel's [SQLite guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) explains why a writable local SQLite file is not persistent across independent function instances. That migration is a separate future task; this local runner does not claim to deploy a Vercel backend.
