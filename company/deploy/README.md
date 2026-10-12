# Vertexia company-service release

Customer POS remains an installed Windows desktop app. This release contains only the private company's Node licensing service and browser agency dashboard. Planned public origin: `https://license.vertexiaagency.com`; agency sign-in: `/agency/`. It does not contain company/customer databases, signing keys, accounts or activation keys.

## What is still needed to go live

A domain alone cannot run this backend. The server needs Node.js 24 or newer, durable private storage for the SQLite company registry and signing identity, and HTTPS. The domain owner has confirmed that Hostinger provides only the domain, with no hosting or VPS. The supplied deployment units target a Linux VPS. Managed Node hosting is an alternative only after its runtime and durable storage have been verified. A static website upload alone does not run the licensing server.

No production server or DNS records have been changed. Deploy only the `license` subdomain; preserve the existing `vertexiaagency.com` website and email records.

## Linux VPS deployment

Inspect the existing OS, Node path, web server, listening ports and DNS before installing anything. The supplied systemd units expect `/usr/bin/node` and a Linux systemd host. The Caddy example is for a server with Caddy configured; an existing HTTPS reverse proxy can serve the same origin instead. Do not overwrite an existing server's web configuration.

1. Verify the archive's `.sha256` checksum, upload and extract into a new `/opt/vertexia-agency/releases/<release>` directory, then point `/opt/vertexia-agency/current` to that release. Do not replace a running release in place.
2. Create a dedicated `vertexia-agency` service account. Create `/var/lib/vertexia-agency` and `/var/backups/vertexia-agency` owned by it, mode `0700`. Keep the application code read-only for this account.
3. Create `/etc/vertexia-agency.env` with the following non-password settings, readable by the service:

   ```text
   VERTEXIA_COMPANY_DATA=/var/lib/vertexia-agency
   VERTEXIA_COMPANY_BACKUPS=/var/backups/vertexia-agency
   ```

4. For a **new** issuer only, from the release directory with the same environment and service account run:

   ```sh
   node scripts/company-license.mjs init https://license.vertexiaagency.com
   ```

   An already initialized company must transfer its existing private issuer, registry and public configuration through a private channel. Do not create a replacement issuer. To change its URL while preserving that issuer use `configure-origin https://license.vertexiaagency.com`. Back up the existing company before migration. The service refuses a public configuration whose issuer does not match the actual signing key.

5. Provision the agency account privately; enter a passphrase without putting it in shell history:

   ```sh
   read -rs -p 'Agency password: ' VERTEXIA_AGENCY_PASSWORD
   printf '\n'
   export VERTEXIA_AGENCY_PASSWORD
   node scripts/company-license.mjs admin-create agency.admin
   unset VERTEXIA_AGENCY_PASSWORD
   ```

   Enroll the one-time authenticator secret/URI privately. Do not capture this command's output in public deployment logs. An HTTPS service refuses startup until at least one agency administrator is provisioned.

6. Install the supplied agency service and backup units into `/etc/systemd/system`, run `systemctl daemon-reload`, then enable/start `vertexia-agency.service` and `vertexia-agency-backup.timer`. The Node service binds to **127.0.0.1:8787**; only the reverse proxy is publicly exposed. It restarts after failure and after reboot.
7. In the domain's DNS zone add an **A record** named `license` pointing to the server's real IPv4 address. Add an AAAA record only if IPv6 is configured for this server. Preserve root/www and email DNS records. An incorrect existing AAAA record can misroute clients.
8. Add the example Caddy site or equivalent HTTPS reverse-proxy block preserving the public Host. Validate the server configuration before reloading it. DNS and certificate issuance must complete before client activation.
9. Run the public check from another machine:

   ```sh
   node scripts/verify-agency-deployment.mjs https://license.vertexiaagency.com
   ```

   It verifies HTTPS readiness, dashboard/assets, security headers and denial of anonymous company data. Perform a signed activation, branch lock/unlock and device-acknowledgment test using an isolated test license before distributing customer builds. Public HTTP checks alone do not prove a real customer transaction has been locked.
10. Distribute the **public** `client-trust.json` in the updated desktop app's `resources/licensing-trust.json`. Never distribute issuer-private.pem, company.db, agency accounts or private snapshots. Configuring the company service does not by itself produce the final customer `.exe` installer; installer packaging is a separate project milestone.

## Operational checks

```sh
systemctl status vertexia-agency
journalctl -u vertexia-agency --since '10 minutes ago'
systemctl start vertexia-agency-backup.service
systemctl list-timers vertexia-agency-backup.timer
```

Backups use SQLite's backup API so committed WAL data is included; raw copying a live database is insufficient. A complete snapshot includes the verified company registry, issuer and public trust, with checksums in `snapshot.json`. Snapshots contain credentials and MFA secrets and must remain private; keep a separate encrypted off-server copy and an explicit retention policy. Failed or incomplete snapshots do not contain the final manifest and must not be used for recovery. Windows local tests cannot validate Linux systemd or actual public TLS issuance.

Do not automatically restore an older registry onto a running service. Stop the service, verify the complete snapshot and signing identity, and plan recovery for any device whose accepted signed sequence is newer than the restored database. The POS fails closed rather than accepting an older signed decision. Recovery and migration must preserve current registry state whenever possible.

Source guidance: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Node SQLite backup API](https://nodejs.org/api/sqlite.html), [Hostinger Node hosting options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/), [Hostinger DNS management](https://support.hostinger.com/en/articles/1583249-how-to-manage-dns-records-at-hostinger).
