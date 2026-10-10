# Vertexia Retail POS
## Complete Product, Architecture & Implementation Blueprint

**Version:** 1.0 | **Date:** 9 October 2026 | **Language:** Roman Urdu + technical English

**Audience:** Business owner, developer, architect, QA engineer, implementation team aur support team.

**Document status:** Yeh proposed target specification hai. Current implementation ka limited code review section 3 mein hai. Is document mein described future features ko already implemented ya production-certified na samjha jaye. Commercial defaults yahan recommend kiye gaye hain; customer contract aur pilot results ke mutabiq configurable honge.

## 1. Product kya hai aur kis ke liye hai?

Vertexia aik Windows desktop retail POS hoga jo single shop, multiple counters aur multiple branches ke liye aik hi product family mein kaam karega. Dukaan ka rozmarrah ka operation internet ke baghair local database par chalega. Internet milne par records central cloud par synchronize honge, jahan business owner branches ki consolidated performance dekh sakega.

Target customers grocery stores, marts, general retail, cosmetics, garments aur similar retailers hain. Batch/expiry ya serial tracking walay businesses ke liye additional modules enable honge. Pharmacy, restaurant, manufacturing aur regulated verticals ke special workflows general retail se alag scope mein rahenge.

Company apne commercial portal se customers, plans, licenses, branches, terminals, activation, suspension, renewal aur software releases manage karegi. Har retailer ka data doosray retailer se alag hoga. Retailer owner apni staff permissions, inventory, prices aur branch operations manage karega.

Success ka matlab sirf attractive screens nahi: completed sale durable ho, stock aur cash reconcile hon, offline operation reliable ho, duplicate posting na ho, data restore ho sake aur access enforce ho.

### 1.1 Recommended core decisions

| Area | Recommended decision | Wajah |
| --- | --- | --- |
| Existing frontend | React + TypeScript continue | Existing UI aur project investment preserve hoga |
| Windows desktop | Electron continue | Runtime already project mein hai; hardware aur local storage support |
| Single terminal storage | SQLite | Local transactional storage; separate database service ki zaroorat nahi |
| Multiple counters in one branch | Local Branch Service; database service ke machine par | Counters ko shared inventory authority milti hai |
| Branch Service database | PostgreSQL for managed multi-counter deployments | Concurrent operations aur administrative controls; installation/support cost accept karna hoga |
| Cloud database | PostgreSQL | Central relational business records aur multi-tenant reporting |
| Backend | TypeScript API, preferably modular Node.js service | Existing team ke TypeScript skills reuse; exact framework team choose kare |
| Synchronization | Application-level outbox/inbox events over HTTPS | Business validation aur retry control; database file copying nahi |
| Licensing | Signed, time-bounded offline license lease | Internet outage mein operation aur bounded company control |
| Inventory costing | Per-branch moving weighted average initially | Retail operations ke liye practical; FIFO optional future module |
| Money/quantity | Integer minor currency units; fixed-scale quantity | Floating-point errors se protection |
| Distribution | Signed Windows installer + signed update artifacts | Reliable installation aur publisher identification |

Yeh database selection SQLite ki local-storage strengths aur PostgreSQL ki server role ko combine karti hai. SQLite aur client/server databases different deployment needs serve karte hain. [SQLite official guidance](https://sqlite.org/whentouse.html)

## 2. Scope, guarantees aur practical limits

**Offline-first** ka matlab: configured aur activated installation par permitted local sales, receipts, local inventory, cash shifts aur local ledgers internet outage mein operate kar sakte hain. Pehli activation aur initial authorized data download ke liye internet ya company-issued offline provisioning package chahiye.

Internet ke baghair remote branch ka latest stock, central credit balance, license revocation ya changed permissions instantly maloom nahi ho sakte. App last-known data ka timestamp dikhayegi. Offline data ko live kehna product defect hoga.

| Situation | Guaranteed target behavior | Limit |
| --- | --- | --- |
| Internet down; local system healthy | Local permitted transactions continue | Remote information stale ho sakti hai |
| Multi-counter branch; LAN healthy | Branch Service shared stock enforce kare | Branch Service available hona chahiye |
| LAN/server down | Preconfigured emergency mode ya checkout block | Shared stock ki unlimited independent selling safe nahi |
| Cloud unavailable | Local POS continues within license validity | Owner cloud reports delayed |
| License suspended online | Next successful entitlement check par new business postings block | Offline terminal tak instant message nahi pahunchta |
| License expired offline | Lease/grace policy ke mutabiq read-only mode | Unlimited offline + instant remote shutdown aik saath possible nahi |
| Card/wallet provider offline | Cash/approved local credit continue | Electronic payment authorization provider policy par depend karegi |
| PC disk fails before backup/sync | Last recoverable copy se restore | Unsaved/unbacked data ka guaranteed recovery nahi |

**Commercial promise:** “Internet ke baghair supported local operations, reconnect par reliable synchronization.” Infinite offline usage, zero possible data loss aur universal instant shutdown promise nahi ki jayegi.

## 3. Existing project ka observed status

Review workspace ke source files par based hai. Is documentation task mein application tests, penetration tests ya complete behavioral audit run nahi kiye gaye.

| Component | Source mein kya mila | Commercial release ke liye gap |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, module screens | Screen existence functionality ki guarantee nahi |
| Desktop | Electron main process + restricted preload API | Installer, signing, updates aur operational recovery pending |
| Local DB | `node:sqlite`, migrations, foreign keys, WAL, FULL synchronization, busy timeout | Backup/restore tooling, auth context, sync schema aur hardened deployment |
| Domain conventions | Paisa aur milli-units | Consistent rounding, all modules ki adoption aur overflow validation |
| Dashboard/POS/Products/Sales | SQLite queries and posting methods present | Full permissions, idempotency, cloud sync, business onboarding |
| Returns | SQLite sale-return tables and posting code present | Damage disposition, cross-branch rules aur full approval policies |
| Inventory/Purchases/Suppliers | Shared provider/localStorage path aur seed data present | SQLite sales ke saath consistent shared transaction model missing |
| Customers/Staff/Cash/Reports/Expenses | UI/state patterns visible | Full transactional functionality aur security completion required |
| Business/branch/user identity | Hardcoded IDs and default setup in database code | Real onboarding, authenticated user/device context |
| Invoice number | Daily sale count based sequence | Durable device/authority-specific sequence needed for restore/sync |
| Electron controls | Context isolation on, Node integration off, sandbox on | IPC sender authorization, narrow URL rules, CSP, complete schema validation |
| Cloud/licensing | Complete backend or signed lease flow reviewed files mein nahi mila | Build and integrate separately |

Important files: `package.json`, `electron/main.mts`, `electron/preload.cts`, `electron/database/database.mts`, `electron/database/schema.mts`, `src/app/data/retailData.storage.ts` aur feature modules.

**Sab se pehla correction:** SQLite POS aur localStorage inventory/purchases ko aik authoritative operational store par lana. Agar purchase aik store mein stock barhaye aur POS doosray store se stock ghataaye, business ki inventory unreliable hogi.

Existing `docs/architecture/functional-gap-analysis.md` initial snapshot lagta hai aur ab implemented SQLite work ko fully reflect nahi karta. New feature status ko source review aur acceptance tests se track kiya jaye.

Existing demo initialization/cleanup code ka release audit required hai: real customer transactions ko demo marker ke basis par delete karne wala automatic cleanup commercial build mein nahi hona chahiye. Migration aur imported real data ka explicit separation ho.

## 4. Business hierarchy aur ownership

```text
Your POS Company
  Company Admin Portal + Licensing Service
    Retailer / Business (tenant)
      Owner + business settings + catalog
      Branch A
        Warehouse / locations + counters + staff
      Branch B
        Warehouse / locations + counters + staff
      Cloud consolidated reports
```

- **Tenant/business:** Aik customer company. Data, users, plans aur catalog ka main isolation boundary.
- **Branch:** Aik shop/location. Stock, local pricing, shifts aur operational permissions ka boundary.
- **Terminal/device:** Aik registered checkout computer. Device identity, activation aur document sequence rakhta hai.
- **Stock location:** Saleable shelf, warehouse, damaged stock, quarantine ya other configured location.
- **User:** Named staff member; role aur allowed branches defined honge.
- **Company admin:** Software provider ka operator. Retailer owner se separate privilege system hoga.

Single shop bhi aik tenant aur aik branch hogi. Multi-branch conversion mein old sales ko rewrite nahi karna; new branches add hongi. Har operational action ka authenticated `tenant_id`, `branch_id`, `device_id`, `actor_id` context hoga.

## 5. Deployment modes aur architecture

### 5.1 Mode A: single shop, single counter

```text
React UI
  -> restricted Electron preload
    -> main-process application services
      -> local SQLite + outbox
        -> background HTTPS sync
          -> Cloud API -> PostgreSQL

Company Portal -> License Service -> signed lease -> Desktop
Owner Web Portal -> Cloud API -> authorized branch reports
```

Sale ka commit SQLite par hota hai. Internet checkout ki dependency nahi. Cloud upload baad mein hota hai. Heavy queries, backup aur sync ko worker/service mein isolate karein taake UI freeze na ho; current synchronous driver ke performance impact ko benchmark karein.

### 5.2 Mode B: single shop ya branch, multiple counters

```text
Counter 1 [UI + encrypted local cache + durable request log]
Counter 2 [UI + encrypted local cache + durable request log]
Counter 3 [UI + encrypted local cache + durable request log]
             | authenticated LAN API
             v
Branch Service [posting authority + PostgreSQL + outbox]
             | HTTPS sync
             v
Cloud API + PostgreSQL
```

Har normal sale Branch Service ke transaction mein commit hogi. Counter apni request ID pehle durable karega; response lost ho to same ID se result query/retry karega. Committed receipt milne se pehle sale success nahi dikhani.

Branch Service dedicated machine ya suitable designated PC par service ke taur par chale; auto-start, UPS, restricted firewall, authenticated TLS LAN endpoint, health checks aur automated backups hon. Cash drawers/shifts terminal-wise honge. Internet fail hone par LAN checkout continue rahega.

Small branch mein API ke peeche SQLite technically workable hai agar single service writes serialize kare aur load test pass ho; default managed multi-counter package PostgreSQL rakhe. SQLite database file ko network shared drive par counters directly open nahi karenge. WAL coordination same host ki requirement rakhti hai. [SQLite WAL documentation](https://sqlite.org/wal.html)

### 5.3 Mode C: multiple branches

Har branch apni posting authority rakhegi: standalone SQLite ya multi-counter Branch Service. Cloud authorized branches se events consolidate karega aur catalog/settings/permissions publish karega. Cloud down hone se active local branch posting automatically fail nahi hogi.

Owner remote web portal se sales, stock, outstanding aur alerts dekhega. Ye remote portal cached cloud data dikhata hai; offline branch ke unsynced transactions ka access nahi hota. Branch status, last contact aur last acknowledged event har report mein visible hon.

### 5.4 Internet aur LAN dono fail hon to

Default strict multi-counter policy: posting pause, existing draft preserve, server reconnect ka message. Standalone mode mein is issue ka shared-stock dependency nahi.

Optional emergency mode sirf deliberate configuration ke saath:

1. Authority pehle terminal-specific stock, return aur credit allowances reserve kare.
2. Authority un reserved quantities/rights ko doosray counters ke usable pool se minus kare.
3. Disconnected terminal sirf assigned allowance ke andar local postings kare.
4. Emergency session fixed expiry aur immutable device identity rakhe; device restore/clone ke liye allowance double-use prevention required.
5. Reconnect par events import aur unused quota reconcile hon. Unconfirmed old allowance ke saath new quota issue na ho.

Alternative permissive emergency selling ko oversell risk ke saath explicit customer policy chahiye. Strict stock guarantee ke saath unlimited independent counters ko offline nahi chalaya ja sakta.

## 6. Database choice aur storage rules

### 6.1 SQLite local kyun?

Embedded, transactional, local disk par fast aur low administration. Existing implementation already use karti hai. Local service install ke baghair single shop deploy karna easy hota hai. WAL readers/writer coordination improve karta hai; aik database mein aik waqt aik writer hota hai, is liye transactions short rakhein aur busy handling implement karein. [SQLite deployment guidance](https://sqlite.org/whentouse.html)

Required configuration: foreign keys enabled, tested journal mode, durability setting, busy timeout, indexes aur versioned migrations. Database `%APPDATA%` ya documented application-data directory mein ho; installer directory ya temporary folder mein nahi. Application-data aur development-data separate hon.

### 6.2 PostgreSQL cloud kyun?

Sales, purchases, ledgers, transfers, users aur reports relational records hain. Cloud API transactions, constraints aur isolation enforce karegi. Shared tenant tables initial recommendation hain; tenant-specific dedicated database enterprise option ho sakta hai.

Har tenant-owned table mein tenant scope enforce ho. Composite foreign keys same tenant ki parent entity require karein; branch ke through inferred scope bhi explicit integrity se secure ho. Query filters ke saath PostgreSQL row-level security defense layer add karein. Application connection unrestricted owner/superuser na ho; pool mein request context transaction-local ho. RLS ke owner/bypass exceptions samajh kar test karein. [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

Desktop ko cloud PostgreSQL credentials kabhi na dein. Desktop HTTPS business API use karega. Database public internet par expose nahi hoga.

### 6.3 Alternatives

| Option | Fit | Is project ka decision |
| --- | --- | --- |
| SQLite only everywhere | Single device ya tightly controlled small service | Local fit; shared cloud concurrency ke liye selected default nahi |
| PostgreSQL local on every PC | Strong server DB, but service/support overhead | Branch Service ke liye; single terminal pe unnecessary default |
| MySQL/MariaDB cloud | Valid relational alternative | Team expertise ho to possible; one chosen cloud engine maintain karein |
| SQL Server | Enterprise deployments mein possible | Windows ecosystem/customer requirement par evaluate; default stack nahi |
| Document/cloud sync database | Specific managed use cases | Retail ledger/stock invariants aur current SQL investment ke liye extra complexity |
| Cloud-only database | Simple central connectivity | Internet outage checkout requirement satisfy nahi karta |

Managed hosting use karna server operations reduce kar sakta hai. Pricing, region, backups, restore aur support contract deployment se pehle separately verify hon; is document mein vendor price promise nahi.

### 6.4 Common data conventions

- UUID identifiers locally generate hon; central auto-increment ID ki wait nahi.
- Money integer minor units; PKR mein paisa. Currency record ke saath ho; mixed currency sums block karein.
- Quantity initial scale 1/1000 base unit; 0.750 kg = 750 milli-units. Higher precision vertical ho to explicit schema decision.
- Large totals ke liye 64-bit/decimal server types aur JavaScript safe-integer boundaries enforce hon. API exact integer values zaroorat par decimal strings send kare.
- Time UTC timestamp ke saath business timezone aur explicit business date. Business-day cutoff configurable; midnight cross shift ka rule defined ho.
- Financial documents product names, sale units, conversion ratios, price, tax aur cost snapshots preserve karein.
- Catalog soft-deactivate ho; historical referenced rows hard-delete na hon.
- Attachments/product images bounded files/object storage mein; immutable IDs, hashes aur access rules. Current inline image storage ko growth ke liye review karein.
- Balance projections rebuildable hon; source movements/journals append-only hon.
- Server aur client schema versions independent, compatible mapping contracts ke saath hon.

## 7. Synchronization: online + offline ka asal mechanism

SQLite aur PostgreSQL automatically synchronize nahi karte. Dono ke darmiyan application sync protocol build hoga. Database files upload/merge karna synchronization design nahi.

### 7.1 Atomic local posting

Sale complete karne ki aik local transaction:

```text
BEGIN
  Check authenticated user, device, branch and license policy
  Check stable operation_id; existing result ho to return it
  Validate cart, stock, permissions, totals, payment evidence
  Allocate durable document sequence
  Insert sale + immutable line snapshots + payments
  Append inventory movements + update local stock projection
  Append customer receivable and cash effects, where relevant
  Append accounting entries and audit event
  Insert one immutable sale.posted outbox envelope
  Store operation_id -> completed result
COMMIT
Print receipt / expose committed result
Background worker uploads outbox
```

Print failure, cloud timeout ya response loss committed sale ko cancel nahi karega. Same request result retrieve/reprint hoga. Outbox aur business writes separate transactions mein nahi honge.

### 7.2 Event envelope

```json
{
  "event_id": "uuid",
  "operation_id": "uuid",
  "tenant_id": "uuid",
  "branch_id": "uuid",
  "device_id": "uuid",
  "authority_id": "uuid",
  "device_epoch": "uuid",
  "stream_sequence": 125,
  "event_type": "sale.posted",
  "schema_version": 1,
  "occurred_at": "2026-10-09T08:30:00Z",
  "business_date": "2026-10-09",
  "actor_id": "uuid",
  "license_lease_id": "uuid",
  "payload_hash": "sha256-of-canonical-payload",
  "payload": { "sale_id": "uuid", "total_paisa": 50000 }
}
```

Example shortened hai; production payload mein complete sale lines, taxes, cost facts, payment allocations aur movement identities honge. Payload immutable hoga. Device authentication envelope ka substitute nahi; backend scope aur signature rules validate karega.

### 7.3 Push and acknowledgement

1. Worker pending batch read kare; bounded size aur payload limit.
2. Authenticated API device aur tenant scope verify kare; client ke arbitrary tenant ID ko authority na maanay.
3. Server `event_id` unique constraint se duplicate recognize kare. Same ID/different hash tamper/error ho.
4. Complete logical event ko transactionally store/apply kare; financial aggregate half-import na ho.
5. Durable commit ke baad per-event result: accepted, duplicate, waiting-dependency, quarantined ya invalid.
6. Client acknowledgement durable kare. Lost acknowledgement par same event retry ho.
7. Retry exponential backoff plus jitter; network failure queue delete nahi kare.

Delivery at-least-once hogi; idempotency aur unique event/movement IDs se each valid business effect once apply hoga. “Exactly once network delivery” ka promise nahi.

### 7.4 Pull, checkpoints aur bootstrap

Client authorized changes server-issued stable cursor se pull karega. Cursor expiry, schema compatibility aur batch boundaries defined hon. Local apply + inbox record + cursor update aik transaction ho. Duplicate pull safe ho.

Initial snapshot consistent watermark par generate ho; us ke baad events us watermark se replay hon. Pending local events replay/deduplicate hon; bootstrap database replace karte hue unsynced records wipe na kare.

Timestamps ko change cursor na banayein: clock drift aur equal timestamps changes miss karwa sakte hain. Deletes ke liye tombstones hon. Cursor retention expire ho to controlled rebootstrap ho.

### 7.5 Data authority aur conflict rules

| Data | Authority | Conflict policy |
| --- | --- | --- |
| Posted sales/payments/returns | Origin branch posting authority | Append-only; duplicates ignore; correction separate record |
| Physical stock movements | Owning branch/location | Movement merge; latest absolute stock overwrite nahi |
| Product catalog | Tenant central master | Versioned updates; offline drafts pending review |
| Branch pricing | Authorized branch/central rule | Effective version; old receipt snapshots preserve |
| Users/roles | Central identity authority | Signed/cacheable policy; revocation on reconnect/expiry |
| Customer/supplier details | Tenant master | Version mismatch par explicit merge/review |
| Credit allowance | Central allocator + branch budget | Offline consumption bounded; global balance stale warning |
| License entitlement | Company licensing service | Signed authoritative revision/lease |
| Inventory balances/reports | Derived projections | Rebuild from authoritative accepted facts |

Posted financial facts par generic last-write-wins use nahi hoga. Kisi purani price ya stale permission par locally committed legitimate sale ko cloud silently erase nahi karega. Late arrivals preserve ho kar review/correction workflow mein jayenge.

Server malformed, cross-tenant ya impossible records ko automatically business ledger mein apply nahi karega. Quarantine evidence retain kare, terminal owner ko blocking issue dikhaye aur operator ko traceable resolution de. Suspicious data “green synced” count na ho.

### 7.6 Ordering, reporting aur costing

Per authority durable sequence detect karega ke earlier event missing hai. Cross-stream dependency IDs product/customer/transfer records link karein. Dependencies pending hon to wait/retry; financial event drop na karein.

Branch calculated cost facts central ingest par arbitrary arrival order mein recalculate nahi honge. Late purchase/correction se costing change ho to separate valuation adjustment version record ho. Closed accounting period mein approved adjusting entry use ho; silent old report rewriting nahi.

Cloud report scope mein known devices, last acknowledged sequence, pending/rejected counts aur completeness watermark ho. Har independently posting terminal ki reporting state include ho. Missing devices ke saath consolidated total preliminary hoga.

### 7.7 Sync operations screen

Online/offline, LAN health, license expiry, last successful upload/download, oldest pending record, pending count, failed/quarantined records aur action-needed message visible hon. Manual retry allowed; “clear queue” ordinary staff ko nahi.

Sync progress business records ke states se separate ho: completed sale `pending_sync` ho sakti hai; pending sale ka matlab uncommitted checkout hai. Yeh distinction UI aur reports mein explicit ho.

## 8. Stock, costing aur inventory integrity

Current available quantity ko manual number overwrite karke edit nahi karna. Har change ka movement, actor, reason aur reference ho.

```text
On-hand = opening + received purchases + saleable returns
          + received transfers + positive adjustments
          - sales - supplier returns - dispatched transfers
          - damage/write-off - negative adjustments

Available = saleable on-hand - reservations - emergency allocations
```

In-transit aur damaged stock separately represent hon. Saleable return aur damaged return different destination locations hon. Expired items checkout par policy ke mutabiq blocked hon.

Default negative stock block. Override permission, reason aur audit require kare; valuation impact report mein visible ho. Concurrent counters availability validate aur deduct same authority transaction mein karein.

**Weighted average example:** 10 units @ Rs 100 aur 10 @ Rs 120 receive hon to average Rs 110. Sale of 3 @ Rs 150: net revenue before tax Rs 450, COGS Rs 330, gross profit Rs 120. Supplier payable/payment se sale COGS calculate nahi hota.

Internal cost calculation precision final paisa display se higher ho sakti hai; fixed-point/decimal accounting with deterministic rounding use karein. Receipt ke cost snapshot aur inventory-value movements reconcile hon. Purchase freight/discount allocation defined ho. Backdated changes cost adjustment banayein.

Batch ID, expiry, lot cost aur FEFO picking optional capability ho. FEFO physical picking aur FIFO accounting different concepts hain. Serial-tracked item duplicate serial sale ko block kare.

Stock count workflow: count session with snapshot/cutoff, counted quantities, intervening movements adjustment, manager approval aur variance posting. Busy store mein count start se latest sale ko ignore karna unsafe hai.

## 9. Multi-branch operations

### 9.1 Shared aur branch-specific data

Shared: product identity, category, brand, supplier/customer master, roles/templates aur approved tax policy. Branch-specific: stock, location, price overrides, reorder levels, staff access, shifts, local cash/bank accounts aur operating dates.

Owner aik ya multiple branches select kar sakta hai. Branch manager apni assigned branches tak restricted ho. Cashier ko doosri branch ka ID manually send karke transaction karne ki permission nahi.

### 9.2 Inter-branch transfer

```text
Draft -> Approved -> Dispatched -> In Transit
      -> Partially Received / Received -> Closed
                         -> Discrepancy Review
```

Example: A ke paas 100 units, B ke paas 20. A 10 dispatch kare: A saleable stock 90, in-transit 10, B saleable abhi 20. B 8 receive kare: B stock 28, transit 2/discrepancy pending. Missing 2 ko forced receipt se cover nahi karna.

Transfer lines immutable dispatched quantities, unit conversions, transfer valuation aur source/destination IDs carry karein. Multiple receiving events unique IDs se idempotent hon. Dispatch ke baad cancel ka reversal/reverse transfer workflow ho; source/destination dono mein free stock double-add nahi.

Offline source dispatch local post ho sakta hai. Destination saleable stock sirf authenticated transfer manifest/confirmed record aur physical receiving se increase ho. Online dependency unavailable ho to goods pending receipt/quarantine mein hon; unverified transfer ke naam par stock mint nahi hoga.

Same tenant branch transfers consolidated external sales revenue nahi hain. Inter-company trade separate purchase/sale documents hai.

### 9.3 Cross-branch customer credit and returns

Offline global credit strict enforce karna possible nahi jab multiple branches independent spend kar rahi hon. Default branch-scoped offline credit budget; centralized online checks available hon to allocate/release budgets. Customer outstanding displayed with sync freshness.

Cross-branch return default online verification/central authorization require kare. Offline cross-branch return disabled ya previously reserved one-time return authorization ke saath allowed ho. Original branch aur receiving branch refund/stock accounting separately record karein. Original invoice ka remaining returnable quantity globally double-use se protect ho.

## 10. Roles, login aur approvals

| Role | Typical allowed actions | Restrictions |
| --- | --- | --- |
| Retailer Owner | All authorized business branches, configuration, reporting, staff | Company licenses/signing keys manage nahi |
| Branch Manager | Local management, approvals, stock/shift review | Tenant-wide policy only if granted |
| Cashier | Sale, receipt, allowed discount, own shift | Cost/profit, stock adjustment, backups generally restricted |
| Inventory Operator | Receiving, counting, transfers | Refund aur payment permissions separately granted |
| Purchasing Staff | Suppliers, orders, receiving | Payment approval independently grant ho |
| Accountant | Ledgers, settlement, reconciliation, financial reports | Admin roles default nahi |
| Read-only Auditor | Assigned reports and audit records | Posting/editing blocked |
| Company Support | Authorized diagnostic metadata/support scope | Customer financial data access by explicit scoped support session |

Permissions granular hon: `sales.create`, `sales.return`, `sales.discount.override`, `products.price.edit`, `stock.adjust`, `purchases.post`, `cash.close`, `reports.profit.view`, `users.manage`, `backup.restore`.

UI button hide karna security enforcement nahi. Main-process services, Branch API aur Cloud API har protected operation authorize karein. Default deny aur least privilege follow hon. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

Offline login sirf previously provisioned users/device scopes ke liye ho. Local password verifier slow salted hash ho. Policy snapshot signed/versioned ho; expiry aur refresh rule defined. New user creation/reset default online administrative flow ho; initial standalone owner offline provisioning separately supported ho.

Manager approval named approver aur exact action/totals se bound ho; generic shared master PIN nahi. Auto-lock, failed-login throttling, session timeout aur user-switch audit hon. Owner aur company admins online MFA use karein. Staff revoke offline device par reconnect/policy expiry se effective hoga.

## 11. Feature specification: sales and checkout

### 11.1 Catalog and products

SKU, one/multiple barcodes, name, category/subcategory, brand, image, base unit, sale/purchase units, conversions, tax category, sale price, MRP where applicable, reorder level aur tracking mode. Variants size/color separate stock identity hon. Pack/carton aur loose quantity support ho.

Barcode/SKU uniqueness tenant scope mein; import duplicates clear errors ke saath. Price updates history aur effective version preserve karein. Referenced product deactivate ho sakta hai, historical invoice se disappear nahi.

CSV import preview, validation, dry-run summary, row error report aur transactional batch policy ho. Export permission-controlled ho; spreadsheet formula injection prevent karein. Images/file sizes and types restricted hon. Sensitive export audit karein.

### 11.2 POS workflow

Login -> branch/counter verified -> shift open -> scan/search -> cart quantity/discount -> customer selection -> payment -> local/branch commit -> receipt -> background sync.

Keyboard-friendly checkout, scanner input, product lookup, weighted quantity, hold/resume, multiple draft carts, customer display aur touch support where needed. Held carts stock reserve nahi karte by default; checkout par current availability revalidate ho. Persisted draft restart ke baad recover ho, magar completed sale se confuse na ho.

Discount rules line/bill-wise, max percent/amount, cost/below-cost approval aur promotion priority defined hon. Same promotion duplicate apply na ho. Line snapshots exact rule/version retain karein.

### 11.3 Payments

Cash, card, wallet, bank transfer, customer credit aur split tender support. Payment status `pending`, `confirmed`, `failed`, `refunded` sale status se separate ho. Cash tender aur change separately store hon; physical drawer net sale cash receive kare.

JazzCash/Easypaisa/card option select karna verified gateway integration nahi. Initial manual mode mein operator external terminal/reference confirm kare aur settlement report reconcile kare. Provider-backed mode mein server confirmation, provider transaction ID, idempotency, webhook signature aur status inquiry ho. Timeout ko success assume nahi karna.

Sensitive card PAN/CVV POS database ya logs mein store na hon; certified provider terminal/token flow use ho. Offline electronic authorization provider-dependent hai; customer contract mein clear ho. Cash receipt permission local work kar sakti hai.

Partial payment named customer ke saath paid + outstanding create kare. Walk-in ko udhaar default block. Overpayment handling change/refund/customer advance policy ke mutabiq explicit ho.

### 11.4 Invoice, return and correction

Document ID globally unique UUID ho. Human number branch + authority/device + durable sequence, e.g. `KHI01-T02-20261009-000125`; per-authority sequence transactionally persist ho. Count-of-sales sequence restore aur multi-terminal ke liye replace karein. Regulatory numbering rules applicable hon to separately conform karein.

Receipt business/branch identity, invoice/time, cashier, items, units, discounts, tax, totals, tender/change aur payment reference contain kare. Reprint marked duplicate ho aur same invoice use kare. 58/80mm layouts with printer capability checks; tax receipt format configurable.

Return original invoice/item ke against ho. Remaining returnable quantity, period, condition, refund method aur permission validate karein. Partial returns aur multiple returns combined original sold quantity exceed na karein. Discount/tax original allocation ke mutabiq reverse ho. Refund cash, provider reversal, customer-credit adjustment ya store credit separate workflow ho.

Exchange linked return + new sale + payment difference ho. Unsold cart cancel safe hai; completed invoice ko silent delete/overwrite nahi. Void approved reversal kare aur original retain ho. Refund failure stock-return receipt ko erase na kare; pending refund obligation tracked ho.

## 12. Feature specification: purchasing and ledgers

### 12.1 Suppliers and purchasing

Supplier profile, contacts, payment terms, opening balances, credit period aur ledger. Purchase order optional draft/approval; purchase invoice, goods receipt aur supplier payment separate concepts hon.

Receiving supports partial quantities, batch/serial/expiry, unit conversion, landed costs, shortages aur supplier invoice duplicate detection. Stock goods receipt par barhe; PO draft par nahi. Invoice/payable recognition policy receiving se linked ho, double stock posting na ho.

Paid, partial aur unpaid purchases; supplier payments allocation; purchase returns with stock reversal aur payable/credit-note effect. Supplier paid advance ke baad receiving ko double payment na samjhein. Document attachments bounded and access-controlled.

### 12.2 Customer and supplier ledgers

Customer ledger: opening receivable + credit sales - customer receipts - approved credit adjustments/returns. Supplier ledger: opening payable + invoices - payments - supplier credit notes. Balance har relevant branch/date filter par reconcile ho.

Opening balances migration/import ke approved posted entries hon. Arbitrary profile balance edit nahi. Payment allocation, aging buckets, due dates, statements aur receipts support ho. Bank/card settlement aur physical cash different accounts hon.

Customer/supplier merge controlled ho; duplicate identity resolution historical references preserve kare. Data export and contact access permissions separate hon.

### 12.3 Cash, shifts and expenses

Shift terminal + cashier assignment ke saath open ho. One drawer par conflicting open shifts block; shared drawer policy explicitly configured ho. Shift handover separate count and audit event ho.

```text
Expected drawer = opening float + cash sales + customer cash receipts
                  + cash-in adjustments
                  - cash refunds - cash expenses - supplier cash payments
                  - cash drops/payouts
```

Opening float ko twice count nahi karein. Card/wallet sales drawer total mein nahi. Closing actual count vs expected variance store ho; threshold approval required. Blind cash count optional; shift closed ho to silent edit blocked. Corrections approved entries se hon.

Expenses category, date, payee, reference, payment source, attachment aur approval ke saath post hon. Draft/recurring draft cash reduce nahi karta. Posted expense relevant cash/bank aur accounting entry create kare.

## 13. Reports, tax and accounting

Required reports: sales by date/branch/counter/cashier/product/category; returns/discounts; payment methods and settlement; stock movement/current stock/valuation; low/expiry stock; purchases/supplier aging; customer receivable aging; cash shifts/variance; expenses; gross profit; operating profit and audit exceptions.

Every report filters consistent hon: tenant, allowed branches, business date range, status, currency aur sync completeness. Source invoice/payment/ledger detail drill-down ho. PDF/CSV export totals UI se match hon. Customer PII export restricted ho.

```text
Net sales excluding tax = completed sales excluding tax - sales returns excluding tax
Gross profit = net sales excluding tax - net COGS
Operating profit estimate = gross profit - operating expenses
```

Tax collected, supplier payments, customer debt recovery, owner capital aur loan receipts ko sales profit na banayein. Full financial statements require complete accounting entries/period policies, sirf dashboard subtraction nahi.

Recommended posted financial model: double-entry journals with accounts for cash/bank, receivables, payables, inventory, revenue, discounts, COGS, tax liabilities, expenses, advances aur rounding. Retail UI simple ho; journal lines balanced hone ki validation engine mein ho. MVP mein retail subledgers complete hon; full GL capability advertise karne se pehle accountant reconciliation sign-off ho.

Tax engine configurable inclusive/exclusive rates, line/bill rounding, exemptions, customer classifications aur effective dates support kare. Example: exclusive Rs 100 at configured 10% = Rs 110 payable; inclusive Rs 110 at 10% = Rs 100 base + Rs 10 tax. Yeh calculation example hai, applicable Pakistani tax rate ka claim nahi.

Pakistan target ke liye FBR/provincial requirements aur customer ki category-specific applicability release se pehle qualified local tax professional aur current official authority guidance se confirm hon. FBR/digital invoicing integration ko separate gated module rakhein: credentials, required fields, authority response IDs, retries, offline rules aur reconciliation approved hone ke baad hi compliant label use karein. General local invoice ko automatically tax-authority-authorized invoice na maanay.

## 14. Licensing, activation aur company control

### 14.1 Commercial model

License tenant/business ke saath bind ho aur plan entitlements carry kare: allowed branches, terminal seats, modules, subscription/support dates, offline policy aur product edition. User access and device activation separate controls hain: staff account disable license cancel ke barabar nahi.

Proposed packages:

| Package | Scope | Included operational model |
| --- | --- | --- |
| Starter | One shop, one active terminal | Local POS, inventory, ledgers, configured cloud backup/sync |
| Store | One shop, multiple licensed counters | Branch Service, shared stock, local operations |
| Business | Multiple licensed branches | Consolidation, transfers, central policies |
| Enterprise | Negotiated scope | Dedicated infrastructure/integrations/support SLA |

Prices, grace periods aur module limits commercial decisions hain; software mein configurable policy ho, scattered hardcoded checks nahi.

### 14.2 Activation lifecycle

Install -> enter activation key/sign in -> registered device key pair -> server validates license/seat -> authorized business/branch provisioning -> signed entitlement lease -> local verification -> usable POS.

Activation key securely random aur rate-limited ho; raw key ordinary logs mein na aaye. Device private key OS-protected storage mein; cloud server device public key register kare. Device public-key identity primary ho; MAC address/CPU serial sole identity na banayein. Hardware fingerprint secondary risk signal ho.

First activation requires internet by default. Offline onboarding possible ho to company portal challenge-response signed provisioning file generate kare; encrypted authorized seed snapshot and expiry include ho. Manual offline seat allocations reserve hon, audit hon aur online seats ke saath reconcile hon.

### 14.3 Signed offline lease

```json
{
  "license_id": "uuid",
  "lease_id": "uuid",
  "tenant_id": "uuid",
  "device_key_id": "uuid",
  "branch_id": "uuid",
  "plan": "business",
  "features": ["sales", "inventory", "transfers"],
  "issued_at": "server-utc-time",
  "refresh_due_at": "server-utc-time",
  "offline_posting_until": "server-utc-time",
  "subscription_valid_until": "server-utc-time",
  "policy_revision": 4,
  "signing_key_id": "key-2026-01"
}
```

Actual token vetted asymmetric-signature format/library use kare. Private licensing signing key sirf server KMS/HSM/protected secret service mein ho; executable mein public verification keys hon. Signature algorithm allowlist, audience/product binding, key rotation aur token-size limits hon. Base64/encryption/hash alone signature nahi.

Offline posting deadline subscription validity ke permitted policy se bounded ho. Grace included ho to explicit fixed final deadline ho; repeated restart/failed refresh se grace extend nahi hoga.

**Proposed default:** online check every 15 minutes and app start, background refresh when due, maximum total offline posting window 7 days after successful refresh, warning final 48 hours. Yeh business recommendation hai. Is policy mein offline suspended installation ka maximum normal control delay roughly remaining 7-day lease ho sakta hai; tighter control ke liye shorter lease choose karein.

### 14.4 Suspension, expiry and recovery

```text
Unactivated -> Active -> Expiring warning -> Grace/limited period -> Read-only
                 | server suspension on successful check
                 v
             Suspended / Read-only
                 | authorized reinstatement + new signed lease
                 v
               Active
```

Successful authoritative suspension response ke baad old lease se postings resume nahi hon. Revocation/entitlement revision locally persist ho. Internet outage valid existing lease ko immediate invalid na kare.

Recommended suspension/expiry mode blocks new sales, purchases aur stock/financial postings. Historical read, permitted export, backup, existing receipt reprint aur renewal remain available. Valid already-committed events sync/recovery channel se upload ho sakein; outstanding data ko entitlement denial se trap na karein. Security-compromised device ka recovery authenticated owner flow se separately handle ho.

Mid-sale policy: operation admission par lease/permission verify, short bounded transaction complete; suspension commit ke baad received ho to committed sale retain ho aur subsequent postings block hon. Cloud arbitrary old legitimate sale delete nahi kare.

User-level central disable offline cached session par same reconnect/policy expiry limitation rakhta hai. Branch Service local manager disable LAN users ko immediately enforce kar sakta hai.

### 14.5 Clock tampering, cloning and transfer

Signed trusted server time, persisted highest-seen time, monotonic elapsed time while running aur suspicious rollback checks use karein. Large rollback/repeated restore par posting block/revalidation ho. Consumer PC par local admin software/state patch kar sakta hai; absolute tamper-proof offline enforcement promise nahi.

App obfuscation casual tampering slow kar sakti hai, security foundation nahi. Executable/database clone se device seats aur offline stock allowances duplicate na hon: device identity key, activation epoch aur server registration required.

Reinstallation/PC replacement flow: owner verifies, old device revoke, terminal outstanding data recover/export, seat transfer audit, new device provision. Old offline lease remaining window aur lost data risks visible hon. Disaster recovery license reactivation emergency procedure documented ho.

## 15. Company admin portal aur support operations

Portal customer onboarding, subscription status, plans, license/branch/device registry, lease policies, renewal, suspension reason, reinstatement, deployment versions aur device last-seen show kare.

Billing events entitlement change se idempotently link hon; webhook duplicate se double extension nahi. Manual commercial adjustments named operator aur reason ke saath audit hon. Company admin MFA aur separate role scopes mandatory target ho.

Company-wide suspension bulk action ke liye explicit scope preview, typed tenant confirmation ya two-person approval policy rakhein. Support ko billing/admin privilege default na dein. Signing-key operations especially restricted hon.

Support console sync queue metadata, app version, schema versions, health, backup age aur redacted diagnostics show kare. Retailer sales/customer data access exceptional, scoped, time-limited aur retailer-authorized support session ke saath ho. Invisible permanent universal support password nahi.

Suspension reason/status user-facing respectful ho, renewal contact aur backup/export access clear ho. Company portal remote code execution channel nahi hoga. Diagnostic bundles credentials, activation keys, card data aur unnecessary PII redact karein.

## 16. Security design

Threats: lost laptop, malicious cashier, compromised admin, cross-tenant API access, fake sync requests, renderer injection, local database theft, supply-chain dependency compromise aur ransomware. Controls threat ke proportion mein implement hon.

### 16.1 Credentials and sessions

Passwords plaintext/encrypted reversible form mein store na karein; Argon2id with unique salts, calibrated work factors and vetted library preferred ho. PIN short hai, is liye local attempt throttling aur controlled reset necessary hain. [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

Cloud short-lived access tokens, rotating refresh tokens, session revocation aur MFA support kare. Browser owner portal secure HttpOnly cookies/CSRF strategy ke saath ho; desktop token main process mein rakhe. Renderer/localStorage mein secret tokens nahi.

Offline cached verifier aur permissions sirf provisioned users ki hon. Device theft ke liye OS account controls, auto-lock, disk encryption aur least-privilege setup hon. Device compromise ke baad cached passwords reset policy ho.

### 16.2 Electron boundary

Current sandbox, context isolation aur disabled Node integration retain karein. Narrow contextBridge functions; generic filesystem/shell/SQL API renderer ko na dein. Har IPC sender/frame verify, payload schema validate, user/branch permissions enforce aur bounded inputs accept karein.

Production CSP, bundled trusted UI, exact navigation origin/path allowlist aur approved external link handling ho. Existing prefix-based development/navigation checks aur broad HTTPS external opening harden karein. Main process mein raw HTML/remote scripts execute na hon; receipts user text escape karein. Runtime/dependencies supported aur patched hon. [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)

### 16.3 Encryption and secrets

HTTPS cloud aur authenticated protected LAN transport. Server backups/storage encrypted. SQLite default encrypted nahi; current `node:sqlite` ko automatic full-database encryption ka credit na dein.

Local full database encryption target ho to SQLCipher-compatible driver integration separately select, license review, Electron native-module packaging aur migration test karein. SQLCipher encrypted SQLite implementation provide karta hai. [SQLCipher official documentation](https://www.zetetic.net/sqlcipher/)

OS-backed `safeStorage` device tokens aur wrapped database keys protect karne ke liye use ho sakta hai. Windows par protection same OS user ke malicious processes ko universal defense nahi deti; Electron documented boundary ko security assumptions mein include karein. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

Data key app binary mein hardcode na ho. Backup key recovery separately designed ho; machine-bound encrypted key alone new PC restore ko impossible bana sakti hai. Owner recovery credential/protected recovery envelope, rotation aur authorization required hain.

### 16.4 API, database and audit

Parameterized SQL, strict request schemas, tenant isolation, rate limits, body-size limits, pagination aur auth enforcement. Device requests signed/protected where relevant; replay detection event identity se ho. Object IDs guess karne par unauthorized record disclosure na ho.

Audit records action, actor, approver, tenant/branch/device, entity, reason, old/new relevant values, client time, server receipt time aur correlation ID carry karein. Logs append-only for ordinary staff. Optional hash chains + external retained digest tamper evidence improve karein; local-only hash chain local admin ke against complete protection nahi.

Secrets repository, renderer, logs aur exported configs mein na hon. Sensitive operational access least privilege ho. Dependency scanning, signed releases aur incident response procedure commercial gate hon.

## 17. Backup, restore aur disaster recovery

Cloud sync backup ka replacement nahi: erroneous changes synchronize bhi ho sakti hain. Backups independent history aur verified restore provide karein.

Local snapshot database-safe backup API/quiesced process use kare; live WAL database ka sirf main `.db` file copy karna latest consistent backup ka reliable method nahi. [SQLite backup API](https://sqlite.org/backup.html)

**Proposed defaults:** scheduled safe local snapshots every 30 minutes while operating, daily encrypted off-device backup when available, 7 daily + 4 weekly + 12 monthly retention, successful backup notification and overdue alert. Larger/critical shops tighter policy choose karein.

Snapshot includes business DB, unsynced outbox/inbox checkpoints, sequence state, schema version, configuration and attachment manifest. Secrets/device identity controlled separately preserve/reprovision hon. Backup hash, timestamp aur coverage record ho; restore key securely held ho.

Restore workflow:

1. Stop operational posting and take pre-restore backup.
2. Owner/authorized recovery operator validate backup tenant, format, integrity aur decryption.
3. Restore to temporary DB, run integrity checks/migrations and reconciliation.
4. Recover server-known later events where available; preserve separate surviving unsynced data.
5. Establish safe device/authority epoch and sequence continuation; old queued events keep original IDs.
6. Verify invoice, stock, customer/supplier and cash balances before reopening.

Multiple cloned machines from one backup simultaneous posting na karein. Restored outdated allowance/lease new emergency selling rights automatically create na kare. Prior device revoke/reprovision flow aur server deduplication required.

**Planning RPO/RTO:** healthy connected environment mein sync delay under 60 seconds target; local disk failure recoverability latest verified off-device copy par depend karegi. Offline machine with 30-minute same-disk snapshot disk loss se protected nahi. Backup recovery target under 2 hours for routine single-shop restore, hardware replacement excluded. Yeh targets hain, guaranteed SLA pilot/operations ke baad contract mein define hoga.

Monthly sampled restore drills aur periodic full recovery drill hon. Backup existence se zyada restore success important hai. UPS abrupt power loss reduce kare; durable commits hardware/OS behavior ke assumptions par depend karte hain.

## 18. Desktop hardware, installer aur updates

Hardware matrix: USB keyboard-wedge barcode scanner; 58/80mm thermal printer; driver/ESC-POS compatible drawer; label printer; optional weighing scale/customer display. “Har printer supported” claim nahi; tested model/protocol matrix publish ho.

Printing spool state sale state se separate ho. Offline print works with local printer. Printer failure queued reprint option de; duplicate receipt marks and drawer-open permissions enforce hon. Scale data validate karein; tare/unit handling aur disconnection UI ho.

Existing app Electron runtime mein already run hoti hai; `.exe` final stage distribution/installer packaging hai. Packaging business logic, offline storage ya licensing automatically nahi banati.

Installer clean Windows environment par install/uninstall/update test kare. User data app update/uninstall policy ke mutabiq safely preserved/exported ho; production DB dev/demo DB se separate. Branch Service installed ho to service permissions, startup, firewall scope, PostgreSQL provisioning/backups aur recovery credentials installer workflow ka part hon.

Windows code signing publisher identity establish karne ke liye use ho; certificate/keys release infrastructure mein protected hon. Signing malware absence ki guarantee nahi. [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)

Updates staged channels pilot -> stable. Artifact integrity/signature verify, safe maintenance point, pre-migration backup aur schema compatibility check ho. Active sale/shift ke beech forced restart nahi. Security-critical update policy clearly defined ho. Offline installations last installed version par compatible lease policy ke saath run karein.

Application rollback aur database rollback alag hain. Irreversible migration ke baad old binary safely run na kare; tested forward-fix/restore plan ho. Existing pending events supported server versions ingest kar sakein. [Electron application updates](https://www.electronjs.org/docs/latest/tutorial/updates)

## 19. Proposed logical data model

Yeh target entities hain; current schema ko replace karne wali ready migration nahi. Developer detailed ERD, column definitions aur migration mapping implementation se pehle finalize kare.

| Group | Main entities | Essential rule |
| --- | --- | --- |
| Tenant/config | businesses, branches, stock_locations, settings_versions | Tenant-bound branches and config |
| Identity | users, credentials, roles, permissions, user_branches, sessions | Authenticated actor + branch scope |
| Devices/license | devices, activation_epochs, licenses, license_leases, entitlement_revisions | Licensed device and signed policy |
| Catalog | products, variants, barcodes, units, unit_conversions, categories, brands, price_versions, tax_rules | Unique identity + versioned master data |
| Inventory | stock_movements, stock_balances, batches, serials, reservations, counts, adjustments | Movements authoritative; balance rebuildable |
| Sales | sales, sale_items, payment_intents, sale_payments, held_carts | Atomic post + immutable snapshots |
| Returns | sale_returns, sale_return_items, refund_intents, credit_notes | Quantity/refund allocation bounded |
| Purchasing | suppliers, purchase_orders, receipts, purchase_invoices, purchase_items, purchase_returns | Receiving/payable/payment effects distinct |
| Ledgers | customers, customer_ledger, supplier_ledger, allocations, advances | Outstanding reconciles |
| Cash/accounts | cash_shifts, cash_transactions, expenses, accounts, journals, journal_lines, settlements | Drawer + balanced financial entries |
| Transfers | transfers, transfer_lines, dispatches, transfer_receipts, discrepancies | In-transit single-count accounting |
| Reliability | operation_results, document_sequences, outbox, inbox, sync_cursors, sync_errors | Durable retry + deduplication |
| Governance | audit_events, approvals, backups, migration_history, period_locks | Traceable sensitive operations |

Core constraints: positive valid quantity; nonnegative configured amounts; sum of payment allocation consistent with payable; unique operation/event IDs; unique tenant SKU/barcode; foreign keys preventing cross-tenant links; returns <= eligible original quantity; journal debits=credits; terminal shift ownership; permitted transitions only.

SQL constraints, transactional domain validations aur authorization teenon required hain. Business rule sirf frontend validator mein implement nahi hoga.

## 20. Backend API and service responsibilities

Initial backend modular monolith recommended; premature microservices operations difficult bana sakti hain. Boundaries clear hon: identity, tenant/config, catalog, branch sync, reporting, licensing, billing aur audit. Licensing private signing keys POS data workers se separately restricted hon.

Illustrative endpoints:

| Endpoint | Purpose | Rule |
| --- | --- | --- |
| `POST /v1/auth/login` | Online authentication | Rate limit/MFA/session policy |
| `POST /v1/devices/activate` | Licensed provisioning | Activation + seat + device proof |
| `POST /v1/licenses/refresh` | Signed lease refresh | Current authoritative status |
| `POST /v1/sync/push` | Immutable event batches | Per-event durable acknowledgment |
| `GET /v1/sync/pull?cursor=...` | Authorized change feed | Stable cursor + bounded response |
| `POST /v1/sync/bootstrap` | Consistent initial snapshot | Authorized scope + watermark |
| `GET /v1/reports/...` | Consolidated reports | Branch permissions + freshness |
| `POST /v1/transfers/...` | Transfer coordination | Transition/quantity checks |
| `POST /v1/admin/licenses/{id}/suspend` | Company license action | MFA, scope, reason, audit |

Local Branch API additionally `POST /sales`, `GET /operations/{id}`, `POST /shifts`, `POST /receipts`, `POST /returns` expose kare. Desktop services same application contracts use karein, raw SQL endpoints nahi.

OpenAPI schemas, structured errors, correlation IDs, rate/payload limits, version negotiation aur compatibility tests define hon. License suspension aur device security revocation different responses/channels rakhein.

## 21. Infrastructure and day-to-day operation

Cloud components: TLS edge/reverse proxy, API, background workers, PostgreSQL, encrypted object storage, license signer, owner/company portals, monitoring aur backup infrastructure. Redis optional cache/job coordination ho; canonical stock/ledger source nahi.

Development, staging aur production secrets/data separate hon. Database private network par; deploy migrations reviewed hon; startup compatibility check ho. Worker retries durable state se recover karein. Queue/backend outage checkout local validity ke andar continue rakhe.

Monitor API availability/latency, failed auth, sync lag, quarantine counts, oldest outbox event, DB disk growth, backup age, restore tests, expiring signing keys/certificates aur device-version incompatibility. Retailer-specific failures traceable hon without exposing other tenants.

Branch Service machine restart par auto-recover ho; service health app detect kare. Failover installation ke liye fencing/leader authority chahiye: do servers aik branch ka active writer ban kar independently unlimited stock post na karein.

Data retention, customer export/deletion requests, historical finance retention aur account closure written contract/operating policy ka part hon. Retention durations applicable business/regulatory advice se decide hon; document arbitrary legal guarantee nahi deta.

## 22. User experience and settings

App cashiers ke liye clear aur fast ho: keyboard shortcuts, visible cart total, focused scanner input, quick customer lookup, change amount, pending printer notice aur actionable validation messages. Empty/loading/offline/denied/error states all modules mein complete hon.

Business settings: currency, timezone/day cutoff, branch numbering, tax model, rounding, stock rules, discounts, return window, credit, costing, print templates, backups aur licensed capabilities. Sensitive settings versioned/audited hon; old invoices change na hon.

Device settings: branch/counter registration, printer, scale, drawer, appearance aur connection settings. Ordinary cashier device branch reassign nahi kar sakta. UI language English/Urdu optional; technical internal code names customer flow mein expose na hon.

Warnings proportionate hon: unsynced completed sales, stale central credit, nearing offline license expiry, failed backup, pending stock discrepancy. Cryptic database exceptions ke bajaye clear operation/result show hon.

## 23. End-to-end business examples

### Example A: single shop without internet

Owner pehle activate/provision karta hai. Cashier valid local account se login, Rs 5,000 opening float aur shift open karta hai. Rs 500 cash sale complete hoti hai: invoice, stock reduction, cash movement, audit aur outbox atomic commit hote hain. Receipt print hoti hai. Cloud report abhi ye sale nahi dikhata. Reconnect par same sale upload, acknowledgment aur queue update hotay hain; retry se duplicate sale nahi.

### Example B: two counters and last unit

Branch Service mein product ka available stock 1 hai. Dono counters sale request send karte hain. Service transaction ordering mein aik sale commit hoti hai; second ko stock unavailable error milta hai. Internet outage iska behavior change nahi karta jab LAN/server available ho.

### Example C: company suspends unpaid customer

Company admin reason ke saath suspension post karta hai. Connected installation next successful check par new postings block karti hai; existing invoices, export aur backup available rehte hain. Disconnected installation apni previously signed lease ke allowed remainder tak chalegi; phir read-only. Renewal/reinstatement new signed lease ke baad operation restore karta hai.

### Example D: response lost after sale commit

Sale `operation_id=XYZ` server par commit hoti hai, LAN response lost. Counter pending request retain karta hai aur same XYZ status query/retry karta hai. Existing committed invoice retrieve hoti hai. New operation UUID bana kar second sale post nahi hoti.

### Example E: customer credit in two offline branches

Central credit limit Rs 10,000; A ko offline budget Rs 6,000 aur B ko Rs 4,000 allocated. A aur B apne available budget ke andar credit post karte hain. Dono independent Rs 10,000 limit assume nahi karte. Receipt recovery/budget expansion central reconciliation rules se ho, arbitrary offline balance edit se nahi.

### Example F: tax/price changes while branch offline

Branch apni permitted cached policy se sale post karti hai. Invoice old effective price/tax snapshot preserve karta hai. Cloud fresh price publish karta hai, magar posted invoice rewrite nahi hoti. Agar policy/legal constraint ke liye refresh mandatory ho to app expiration warning aur appropriate posting gate enforce kare.

## 24. Development phases and delivery gates

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0: Baseline and decisions | Current feature matrix, existing-data audit, chosen policies | Demo vs real data identified; no destructive cleanup |
| 1: Foundation | Onboarding, authenticated context, migrations, permissions, idempotency, outbox | Fresh/existing DB safe; authorization outside UI; retries safe |
| 2: Unified retail storage | Inventory/purchases/suppliers/customers moved from localStorage | All modules same DB; stock and ledgers reconcile |
| 3: Retail transaction completion | Returns, split/partial payments, shifts, expenses, pricing/tax snapshots | Transaction failure rollback and accounting consistency |
| 4: Reliability and hardware | Safe backup/restore, restart recovery, printer/scanner handling | Restore drill and power/network/print failure scenarios pass |
| 5: Cloud and licensing | API/PostgreSQL, push/pull/bootstrap, signed leases, company portal | Tenant isolation, duplicate sync and expiry/suspension verified |
| 6: Multi-counter and branches | Branch Service, transfers, credit budgets, consolidation | Last-unit concurrency and cross-branch reconciliation pass |
| 7: Reporting and governance | Complete exports, period controls, diagnostics, security review | Source totals reconcile; support access controlled |
| 8: Packaging and pilot | Signed installer/updates, clean-PC validation, real shop pilot | Daily cash/stock close, recovery and rollout criteria met |

Implementation incremental ho, magar tenant/device identity aur outbox compatibility early design hon. End mein `.exe` banate waqt sync architecture invent karna unnecessary rework laayega. Rough development estimate team size, true implemented functionality, integrations aur test results ke baad banta hai; is document ko fixed delivery-time quote na samjhein.

MVP commercial release scope: single shop reliable local POS, products/inventory, purchasing/suppliers, customers/ledgers, shifts/expenses, reports, authorization, backup/restore, licensing aur validated installer. Multi-branch edition separate release gate satisfy kare; single-shop MVP ko complete multi-branch product keh kar sell na karein.

## 25. Acceptance tests: release kab ready hogi?

| ID | Scenario | Pass condition |
| --- | --- | --- |
| AT-01 | Offline configured checkout | Sale/stock/cash durable; restart ke baad present |
| AT-02 | Crash between business writes/outbox | All effects commit together ya none |
| AT-03 | Double click/retry same operation | One invoice and one set of movements |
| AT-04 | Server commits; response lost | Same operation returns original result |
| AT-05 | Duplicate event push/pull | No duplicate ledger/stock effect |
| AT-06 | Last unit sold concurrently | Shared authority allows only valid available sale |
| AT-07 | LAN fails mid-request | Uncertain result queried; duplicate fallback posting blocked |
| AT-08 | Partial/multiple sale returns | Combined returned quantity <= sold eligible quantity |
| AT-09 | Damaged return | No increase in saleable stock |
| AT-10 | Partial transfer receipt | Source/destination/transit quantities reconcile |
| AT-11 | Cash vs card shift closing | Card excluded; opening float once; variance persisted |
| AT-12 | Same-total report reconciliation | Invoice/payment/ledger/COGS source sums match |
| AT-13 | Tenant/branch ID tampering | Unauthorized object read/write denied |
| AT-14 | Expired/offline license | New postings blocked as policy; export/backup retained |
| AT-15 | Online suspension/reinstatement | Old lease cannot undo received suspension; new lease restores |
| AT-16 | License/signature/clock tamper | Invalid token denied; rollback follows documented recovery |
| AT-17 | Printer paper/network failure | Sale retained; reprint same invoice available |
| AT-18 | Restore older snapshot | Unique numbering, pending events and safe device epoch |
| AT-19 | Device clone/replacement | Seat/authority controls; no silent duplicated allowances |
| AT-20 | Provider timeout/duplicate webhook | No invented payment confirmation or double payment |
| AT-21 | Schema upgrade with pending events | Compatible import/migrate; no unsynced data lost |
| AT-22 | Missing/quarantined sync event | Visible incomplete state; traceable resolution |
| AT-23 | Offline credit in two branches | Allocated global exposure bound respected |
| AT-24 | Demo-data migration | Real transactions never automatically deleted |
| AT-25 | New PC recovery and encryption | Authorized restore works with recovery keys |
| AT-26 | Supported hardware clean install | Receipt/scanner/drawer work on published matrix |

Performance targets pilot hardware par verify hon: barcode search p95 under 200ms, local sale commit p95 under 500ms excluding printer/provider, defined-volume reports under 3 seconds, stable UI during sync. Seed volume 50,000 SKUs aur realistic multi-year sales; branch load actual chosen counter count par test ho. Targets benchmark acceptance conditions hain, database brands ki automatic guarantees nahi.

## 26. Commercial readiness, onboarding and support

New customer checklist: edition/branch/counter scope, hardware, business identity, tax configuration, opening stock/cost, customer/supplier opening balances, staff roles, printers, backup location/recovery key, license policy aur owner training.

Opening data approved import ho, control totals customer sign-off kare. Training mein checkout, returns, purchase receiving, credit collection, shift close, offline warnings aur restore escalation cover ho. Demo separate environment ho; production empty/approved imported data se start ho.

Sales agreement clear kare: supported local offline operations, maximum offline validity, suspension behavior, data ownership/export, backups responsibilities, hardware matrix, optional integrations aur support hours. Customer ke business data ko deletion/shutdown tool ke taur par use nahi karein; commercial posting control aur data recovery distinct hon.

Release deliverables: installer, version notes, user quick-start, admin/setup guide, migration guide, backup/recovery guide, support runbook, hardware matrix, security/incident contacts aur acceptance evidence. Critical incident mein immutable logs, containment, restoration aur customer communication documented hon.

## 27. Decisions recommended abhi; configurable baad mein

| Decision | Initial recommendation |
| --- | --- |
| Product language | English UI; Urdu support optional; this blueprint Roman Urdu |
| Target market | Pakistan general retail; currency/timezone configurable |
| Costing | Per-branch moving weighted average |
| Negative stock | Block; named manager override only where enabled |
| Global offline credit | Preallocated branch budgets |
| Offline cross-branch return | Disabled without verifiable authorization |
| Multi-counter LAN outage | Strict posting stop; emergency quotas optional advanced module |
| License offline window | Proposed total 7 days, configurable in signed policy |
| Suspension | New posting block; authorized history/export/backup preserved |
| Invoice identity | UUID + authority-specific durable human sequence |
| Financial correction | Reversal/credit/adjustment; no silent deletion |
| Catalog conflicts | Versioned central master; rejected edits reviewable |
| Company support access | Scoped/time-limited retailer authorization |
| Initial cloud architecture | Modular backend + PostgreSQL + durable workers |
| Installer stage | After functionality/reliability, with packaging tested before final pilot |

Recommended choices change hon to document version update, migration impact aur acceptance tests review karein. Customer-configurable settings aur universal integrity rules ko confuse na karein: negative-stock policy configurable ho sakti hai; duplicate sale effect acceptable nahi.

## 28. Developer handover and references

Implementation team is document se detailed backlog banaye, lekin har module ke input/output schemas, transaction boundaries, permissions, migration mapping aur test scenarios define karke code kare. Required handover artifacts:

1. Final approved feature/status matrix and customer scope.
2. ERD plus full local/cloud/branch schema migrations.
3. OpenAPI and versioned sync event contracts.
4. Permission matrix and signed offline policy specification.
5. License state machine, key rotation and recovery runbook.
6. Inventory, costing, ledger and tax rounding rules with examples.
7. Backup/restore procedure and verified restore evidence.
8. CI/release pipeline, signing and rollback plan.
9. Hardware integration matrix and pilot acceptance evidence.
10. Operator/support manuals and maintenance ownership.

Neechay primary references 9 October 2026 ko consult kiye gaye. Business workflow, default policies aur deployment recommendations is project ke liye proposed design hain; reference pages un sab ki implementation ya compliance certify nahi kartin.

- [SQLite: appropriate deployment uses](https://sqlite.org/whentouse.html)
- [SQLite: write-ahead logging](https://sqlite.org/wal.html)
- [SQLite: online backup API](https://sqlite.org/backup.html)
- [PostgreSQL: row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Electron: security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron: safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron: code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Electron: application updates](https://www.electronjs.org/docs/latest/tutorial/updates)
- [OWASP: password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP: authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Zetetic: SQLCipher](https://www.zetetic.net/sqlcipher/)

**Ownership:** Retailer operational data ka owner retailer hoga; POS company software, licensing platform aur authorized service operations manage karegi. Product ki reliability transactions, reconciliation, security, recovery aur real-shop acceptance se prove hogi.
