# Gagan Wave 1B — commercial-flow acceptance

Date: 2026-09-14. Scope: **local source + isolated Review-app acceptance**.
No hosted deployment or production-readiness claim. Stop at Wave 1B.

## Source and environment

- Worktree: `/Users/tanutejas/Documents/Gagan-product-improvements-v1`.
- Branch: `codex/gagan-product-improvements-v1`.
- Starting HEAD: `0709256acc417feb0b822e4e92224dd35ca7c571`.
- Backend implementation: `614556c`.
- Admin/two-app commercial integration: `c95bb8201cc7c659de674dd205a26edb8600a6d0`.
- Mobile runtime: `77ec9b08ecae6d8a6d1c0cb1a6bea11ec08ada72` (quote recovery correction).
- Final integrated runtime: `4d0c672a48875466cd158663042b6bfe55b7fc75` (Admin requires deliberate freight-company selection; backend/mobile trees unchanged from `77ec9b0`).
- Local API: `http://127.0.0.1:4410`; Admin: `http://127.0.0.1:5410`.
- UI database: `gagan_uat_master_20260914_01`; additive migrations only.
- Fresh final automated-test database: `gagan_test_wave1b_final_20260914_02`.
- Device: physical Moto E13, `ZD2229Q3KB`. Review packages only.
- Browser proof: actual Admin UI, isolated headless Chromium/Playwright, not HTTP
  calls labelled as UI. Read-only SQL was used for consistency observations.
- Admin's inherited header says “staging · read-only”; the tested origin was the
  local Admin above and normal authorized mutations were exercised. This is not
  evidence of the hosted staging deployment.

## Binding commercial policy implemented

The canonical SKU fields carry Jain Traders (`jain_traders`) or Padam
International (`padam_international`) and an explicit GST percentage. Price rows
and retailer overrides carry their own case/quintal basis. One quintal is 100 kg.
Both apps submit SKU quantities to the backend, not prices/taxes/totals.

The quote freezes product/pack identity, company, conversion, rate/basis, base,
GST, freight and entity totals. Manager confirms even zero freight explicitly;
the final pre-GST freight amount is added once. Recorded quintals/km are context,
never multipliers. Freight's company must own a goods line in that quote; the
manager chooses it explicitly. Freight GST is separate from SKU GST.

Quote validity is 30 minutes, revision checked at acceptance. Changed quantity,
retailer, expiry, missing freight approval or stale revision fails closed.
Refreshing an expired quote requests new approval; an accepted quote is not
silently reused as a new checkout. A network pricing failure has a retry action.

One order produces one combined invoice. Existing delivered-weight billing is
preserved: a genuine changed delivery weight may change the invoice; it uses the
original accepted conversion/rate/GST, not current SKU master values. Freight is
retained as the explicitly accepted final charge, not multiplied/re-apportioned.
Admin delivery preview uses the same backend calculation as invoice posting.

Partial payment requires the employee/manager to confirm explicit invoice-level
Jain and Padam amounts. Each cannot exceed that invoice's remaining amount and
their sum must equal payment exactly. Full payment prefill requires confirmation;
editing an amount removes that confirmation. Settlement locks payment, retailer
and the selected invoice, rechecks exact balances, and writes one allocation,
payment status and both existing ledgers in the protected transaction. The
retailer balance is updated for reporting, not used as the allocation limit.

Confirmed intent persists invoice/payment references, amount per company, actor,
creation/settlement time, method, reference and fingerprint. Same key/same intent
replays; changed intent conflicts. Parallel valid intents cannot overdraw an
invoice company. A failed settlement retains its exact pending intent for retry.
Field collection retains assignment, Accounts permission and recent step-up;
submission alone does not post money. Generic online payment is refused before
provider contact when it cannot collect the required company/invoice confirmation.

## Automated acceptance

| Gate | Result | Evidence |
|---|---|---|
| Backend full suite | PASS — 127 files, 894 tests | `evidence/wave1b/backend-tests-final-verified.log` |
| Backend typecheck/build | PASS | `backend-typecheck.log`, `backend-build.log` |
| Retailer suite/typecheck | PASS — 16 files, 69 tests | `retailer-tests.log`, `retailer-typecheck.log`; repeated after final quote recovery |
| Salesperson suite/typecheck | PASS — 27 files, 129 tests | `salesperson-tests.log`, `salesperson-typecheck.log`; repeated after final quote recovery |
| Admin suite/typecheck/lint/build | PASS — 20 files, 52 tests | `admin-tests.log`, `admin-typecheck.log`, `admin-lint.log`, `admin-build.log` |
| Full fresh migration history | PASS — 37 migrations from zero | `fresh-migration.log` |
| Prisma validate | PASS | Executed against fresh database configuration |
| Prisma schema/database diff | PASS — empty migration | New foreign-key relationships represented in schema |
| Both Android Review builds | PASS | `retailer-android-build-final.log`, `salesperson-android-build-final.log` |
| Git whitespace check | PASS | `git diff --check` |

The first fresh-suite attempt had four cascading onboarding-test failures because
the test runner omitted `PII_ENCRYPTION_KEY`. The actual error is retained in
`backend-tests.log`. A new disposable DB and ephemeral local test encryption key
resolved the environment error. No test assertion or encryption guard was weakened.

Commercial DB coverage includes Jain-only, Padam-only, mixed entities, multiple
packs, manager freight/revision gates, negotiated override precedence, immutable
order/invoice/line snapshots, master changes after order, mock SAP outbox delivery,
parallel duplicate order/invoice/payment, explicit partial/full payment,
cross-entity excess, unrelated-invoice preservation, collection confirmation race,
step-up, invalid precision, missing confirmation and forbidden generic settlement.
Route tests separately exercise server-resolved authorization and object scope;
they are not claimed as additional real-device persona tests. Existing full-suite
session/permission and legacy financial tests also pass.

## Physical and Admin golden paths

Local-only products were created by guarded idempotent
`backend/scripts/seedWave1bLocal.ts`. It refuses non-local/non-`gagan_uat_` databases
and production. The company, rate basis, rate and GST were subsequently configured
through the actual Admin UI. These synthetic records are not live commercial
master data or real SAP company/customer mappings.

| Evidence | Retailer flow | Salesperson flow |
|---|---|---|
| Native app/persona | Retailer Review / Mahesh Store | Salesperson Review / local Ravi, assigned Annapurna Foods |
| Order | GGN-00000034 | GGN-00000035 |
| Source attribution | retailer | rep, `caa45151-8d9e-471b-878e-ddad4eaa3c9c` |
| Jain goods | 1 × 30 kg, ₹10,000/quintal, base ₹3,000 + GST ₹150 | Same |
| Padam goods | 1 × 30 kg, ₹2,000/case, base ₹2,000 + GST ₹240 | Same |
| Manager freight | Jain ₹100 + 18% GST ₹18; 0.60 quintal / 12 km context | Same |
| Native final quote | ₹5,508; Jain ₹3,268 / Padam ₹2,240 | Same |
| Submission method | Physical app controls | Physical app controls |
| Admin discovery/actions | Normal queue → approve → pack → assign → capture delivery | Same |
| Combined invoice | #1, ₹5,508, GST ₹408, three lines | #2, ₹5,508, GST ₹408, three lines |
| Physical final status | Delivered, order detail | Delivered, order detail/invoice |
| Payment | Admin UI ₹300 (100 Jain / 200 Padam), then confirmed full ₹5,208 (3,168 / 2,040); invoice now paid | Intentionally remains ₹5,508 outstanding |

No order, lifecycle transition or golden-path payment was created by a direct API
or SQL mutation. SQL observations confirmed totals, attribution, invoice count and
payment amounts after the UI actions. Automated tests use separate fixtures/DB.

### Persistent evidence

All paths below are within
`/Users/tanutejas/Documents/Gagan-product-improvements-v1/evidence/wave1b/`:

- `retailer-wave-products.png`, `retailer-mixed-top.png`, `retailer-final-quote.png`.
- `retailer-order-submitted.png`, `retailer-history.png`, `retailer-delivered-detail.png`.
- `salesperson-home.png`, `salesperson-outlets.png`, `salesperson-retailer.png`.
- `salesperson-mixed-quote.png`, `salesperson-quote-lower.png` (disabled pending approval), `salesperson-final-quote.png`.
- `salesperson-order-submitted.png`, `salesperson-delivered-detail.png`, `salesperson-combined-invoice.png`.
- `admin-sku-configuration.png`, `admin-retailer-freight.png`, `admin-delivery-server-quote.png`.
- `admin-salesperson-order.png`, `admin-salesperson-combined-invoice.png`.
- `admin-partial-payment.png`, `admin-invoice-paid.png`.
- Final rebuilt/installed artifact smoke: `final-retailer-running.png`,
  `final-retailer-invoice.png`, `final-salesperson-running.png`.
- `local-consistency.txt`: read-only order/invoice/payment reconciliation.

Raw UAT screenshots/logs are persistent local artifacts, ignored by Git. No
authentication state, credentials, tokens, identity documents or APKs are committed.

## Review artifacts — not standalone releases

| Property | Retailer | Salesperson |
|---|---|---|
| APK | `/Users/tanutejas/Desktop/gagan-wave1b-retailer-review-77ec9b0.apk` | `/Users/tanutejas/Desktop/gagan-wave1b-salesperson-review-77ec9b0.apk` |
| Package | `com.gagan.retailer.review` | `com.gagan.sales.review` |
| Version / versionCode | 1.0.0 / 1 | 1.0.0 / 1 |
| Size | 59,607,799 bytes | 60,260,580 bytes |
| SHA-256 | `7bc05d966b7c5c5673fd5ce07e15e20b40a59be870e6fefa4a0d1abf008e3d12` | `6fe540149f648ada43660a6012b73a6fcb2b1aaadcae35c2ea0410a1f9da0cc8` |
| Runtime JS source | `77ec9b08ecae6d8a6d1c0cb1a6bea11ec08ada72` | Same |
| Review Metro | 8102 | 8101 |

Both are **debug Review shells**, using the local API on port 4410 via ADB reverse.
They require this Mac/local API/Metro for this review and are not distributable
standalone staging APKs. Their native-shell bytes are unchanged by JS-only fixes;
the APK hash alone is not proof of the served JavaScript source. Source and runtime
are recorded separately above. Debug signing certificate SHA-256:
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Original `com.gagan.sales` / `com.gagan.retailer` remain installed and untouched.
Existing APK files and earlier Review artifacts are preserved.

## Migrations, compatibility and remaining release work

New migrations:

1. `20260914000200_commercial_flow`: additive SKU/price basis, quote and financial
   snapshots, payment attribution, foreign keys, uniqueness and split checks.
2. `20260914000300_commercial_collection_snapshots`: collection invoice split and
   immutable accepted snapshot triggers.
3. `20260914000400_commercial_integrity_checks`: NULL-safe company/tax constraints
   and immutable commercial invoice-line fields.

No historical records are assigned invented company ownership. Old unconfigured
carts retain their legacy case-price contract; mixed configured/unconfigured carts
fail until the manager completes SKU configuration. Old invoices remain legacy
and unattributed; aggregate reporting exposes that amount separately. No silent
historical financial rewrite or proportional attribution is performed.

### Hosted preflight legacy payment exception

The new client database read-only preflight found one apparent payment-balance
mismatch for payment `b2b0b8af-6b80-4009-9f84-680352ef5467`. The payment was
created on 2026-08-31, before the Wave 1B commercial migration began on
2026-09-14. It is a pending legacy payment with no `invoiceScopeId`, no
`PaymentAllocation` rows, and `unallocatedAmount = 0`; its amount is 40,500.00.

This is valid legacy semantics, not a Wave 1B allocation defect. The additive
`20260914000200_commercial_flow` migration leaves the new commercial fields
nullable, and the commercial payment service identifies the new entity-scoped
model through `invoiceScopeId` and the confirmed Jain/Padam split. The legacy
payment settlement path remains separate and must not be retroactively converted
into invoice-scoped allocations. The corrected preflight therefore keeps this
row in generic payment counts while applying the allocation balance invariant
only to invoice-scoped Wave 1B payments. It reports legacy rows as
`LEGACY_NOT_SUBJECT_TO_WAVE1B_ALLOCATION_INVARIANT`.

The historical payment was not modified. The database result is
**PASS WITH DOCUMENTED LEGACY PAYMENT EXCEPTION**. Historical totals remain
**NOT FULLY COMPARABLE** because no independent before/after comparison dataset
exists.

### Hosted client-infrastructure acceptance continuation — 2026-09-14

The client-infrastructure continuation used the exact prebuilt review APKs
against `https://gagan-srat.onrender.com`; neither APK was rebuilt. The runtime
health endpoints `/health`, `/health/live` and `/health/ready` each returned
HTTP 200. The isolated Admin preview was
`https://gagan-staging-admin-4ex61z0qi-signor-vales-projects.vercel.app/`,
deployed from the local Admin review source at
`dd418f2bc3358ba8c9a00ce3484344728ee65855` with the client API as its build
target. Admin authentication and read-only commercial inspection succeeded via
the supported session API; a separate physical browser/UI login was not
claimed.

The exact artifact checks were:

| Artifact | Package | SHA-256 | Result |
|---|---|---|---|
| `/Users/tanutejas/Desktop/gagan-wave1b-retailer-clientinfra-77ec9b0.apk` | `com.gagan.retailer.review` | `3263e769977bddb37c604a684e3acd6c0f5ac3b9663363a27fc2e907d25dd5d9` | MATCHED |
| `/Users/tanutejas/Desktop/gagan-wave1b-salesperson-clientinfra-77ec9b0.apk` | `com.gagan.sales.review` | `c49a6372cb3e1d4392bf24bed7ee3d14e7ef465964546a662c5c02442eb8f9fe` | MATCHED |

Both artifacts contain the hosted client API and no local API endpoint. They
were installed on the physical Moto E13 (`ZD2229Q3KB`).

New fixtures were created only through supported Admin/import paths and are
clearly marked `W1B-UAT-JAIN-SKU-20260914` and
`W1B-UAT-PADAM-SKU-20260914`. The historical 11 variants with unknown
ownership were not changed. The Jain fixture uses `jain_traders`, 5% GST and
the configured Gold-tier quintal rate; the Padam fixture uses
`padam_international`, 12% GST and the configured Gold-tier case rate. SAP
material mappings and inventory were added only for these two new UAT
variants through completed Admin Import Center jobs.

The native Retailer and Salesperson clients both reached a genuine mixed
Jain/Padam quote. The quote showed Padam goods of ₹2,800 (₹2,500 base + ₹300
GST), Jain goods of ₹945 (₹900 base + ₹45 GST), and a manager-confirmed Jain
freight charge of ₹120 + ₹6 GST. The resulting combined quote total was
₹3,871. The backend read model confirmed two quote revisions with
`freightConfirmedByStaffId` and zero commercial invoices. No order was
submitted, so there is no valid combined invoice or payment record to test in
this continuation.

The native submission blocker is a client UI defect, not an authorization or
pricing result. In the exact Retailer APK, `Refresh manager freight` is placed
below the 720×1600 device viewport (measured bounds approximately
`Rect(28,1569 - 692,1600)`), and the containing cart state did not scroll to
it. The visible cart therefore remained at “Freight awaiting manager
confirmation” with `Place order` disabled even though the hosted quote had
manager-confirmed freight. In the exact Salesperson APK, the review screen
also showed the mixed quote and disabled `Place order`, but no accessible
refresh control was present in the native hierarchy. The APKs were not rebuilt
because this acceptance checkpoint explicitly required using the exact
approved artifacts.

Consequently, hosted acceptance is classified as follows:

| Check | Result | Evidence boundary |
|---|---|---|
| Native Retailer mixed quote | PASS | Installed exact APK displayed both entity lines, GST and quote total |
| Native Salesperson mixed quote | PASS | Installed exact APK displayed both entity lines, GST and quote total |
| Native Retailer order submission | BLOCKED | Refresh control unreachable; Place order remained disabled |
| Native Salesperson order submission | BLOCKED | Freight remained unconfirmed in the client state; Place order remained disabled |
| Admin order discovery/lifecycle | NOT RUN | No fresh order existed to discover |
| Combined invoice | NOT RUN | No fresh order reached invoicing |
| Invoice-specific payment split | NOT RUN | No fresh Wave 1B invoice existed |
| R2 evidence workflow | NOT RUN | No fresh collection/invoice path was available |
| SAP mock attribution | NOT RUN | No fresh commercial order reached the mock-SAP path |

The historical payment `b2b0b8af-6b80-4009-9f84-680352ef5467` remains
unchanged. No production, main, Dogkart or historical database mutation was
performed during this continuation. The remaining blocker must be resolved by
a future compatible client build or an approved exact-APK UI correction before
hosted mixed-order, invoice, payment, R2 and mock-SAP acceptance can be
completed.

Before any future hosted rollout, validate real SKU/company/GST and freight setup,
read-only data preflight, API/app compatibility and actual SAP legal/company
mapping. Roll out backend and quote-capable apps before activating commercial SKU
configuration. Old app versions cannot submit configured SKUs without quotes.
Do not roll back to an older financial runtime after commercial invoices exist.
The new constraints/trigger functions are not safely removed by an app rollback;
prefer a reviewed forward correction. Hosted preflight/deployment is **NOT RUN**.

Existing negotiated price overrides apply once. Existing informational schemes
are not converted into invented automatic discounts: additional discount is zero
unless a canonical pricing rule already supplies the negotiated price. A new
promotion/reward engine is outside Wave 1B.

Generic amount-only credit notes/reversals are refused for new attributed
transactions because they cannot preserve the required ownership. Legacy financial
corrections remain intact. Entity-attributed reversal/credit workflows are not
claimed. Real SAP, bank/QR company destinations, SMS/payment providers and statutory
production invoice validation require supplied configuration and later acceptance;
no mappings/credentials were fabricated. Commercial Service Layer posting fails
closed until its company contract is configured; mock attribution is tested.

**Ready for Founder commercial-flow review: YES — local isolated Review scope only.**
**Hosted client-infrastructure acceptance: BLOCKED — exact approved APK native
submission cannot reach the manager-freight refresh action, so no hosted order,
invoice or payment acceptance is claimed.**
Production, hosted staging, main, Dogkart, frozen tags and accepted APKs: untouched.
No push or deployment. No Wave 2 started.

### Native quote-reconciliation correction and hosted UAT continuation — 2026-09-15

The native blocker was corrected in the isolated client branch without changing
the backend commercial contract or any business calculation. The exact fix is
`76c7b3205756a449d4b6f48b0d10cc482da5f8` (`Fix native commercial quote
reconciliation`). Both clients now read the latest quote revision when the
checkout screen receives focus and when the app returns to the foreground. A
visible, reachable `Refresh` action remains available. The clients preserve the
fail-closed rule: an unconfirmed, expired, stale or failed quote cannot enable
submission, and a server stale-revision response triggers a fresh quote read
without bypassing manager approval.

The old off-screen Retailer control is no longer the only way to reconcile the
quote. On the physical 720×1600 Moto E13, the Retailer cart visibly changed from
`Waiting for manager freight` / disabled `Place order` to `Manager freight
confirmed`, `₹120.00 + GST 5.00% ₹6.00`, total `₹3,871`, and an enabled `Place
order` after the app was backgrounded and returned to the foreground. The
Salesperson checkout received the same hosted revision through the same focus /
foreground path. The hosted quote read and freight confirmation used the
existing authenticated Admin API contract; no database mutation was performed
directly.

#### Exact rebuilt hosted-review artifacts

Both are standalone Release APKs built from this branch with
`EXPO_PUBLIC_API_URL=https://gagan-srat.onrender.com`. The runtime endpoint was
verified in the bundled configuration and both artifacts were installed with
`adb install -r` on Moto E13 `ZD2229Q3KB` without uninstalling or wiping the
previous review-app data.

| Artifact | Package | Version / code | Size | SHA-256 | Result |
|---|---|---:|---:|---|---|
| `/Users/tanutejas/Desktop/gagan-wave1b-retailer-freight-refresh-76c7b32.apk` | `com.gagan.retailer.review` | 1.0.0 / 1 | 87,027,251 bytes | `959be069a1609998294768114de03a6d1fe0e90b1b5f3cd99aade04ac93ace75` | INSTALLED / HOSTED |
| `/Users/tanutejas/Desktop/gagan-wave1b-salesperson-freight-refresh-76c7b32.apk` | `com.gagan.sales.review` | 1.0.0 / 1 | 87,937,421 bytes | `26f0a558c8644cb602ac5522c99a0648bacb5a3dde65688010637455f0708b4d` | INSTALLED / HOSTED |

The release bundle scan found the required hosted endpoint and no local API
endpoint used at runtime. A dormant development fallback string remains in the
client source bundle as a non-release development default; it is not selected
by the Release build configuration and the installed clients reached only the
hosted API during this UAT.

#### Exact hosted native golden paths

| Check | Retailer | Salesperson |
|---|---|---|
| Native checkout | `com.gagan.retailer.review` | `com.gagan.sales.review` |
| Fresh order | `GGN-00000076`, backend id `9e2aa8e8-7284-4e2c-b90c-ee3b4e8ddd19` | `GGN-00000075`, backend id `4f8ec119-c34e-4bb0-a09c-35d4e943a61c` |
| Source attribution | `retailer` | `rep` / Salesperson |
| Mixed lines | Jain + Padam UAT SKUs, one case each | Jain + Padam UAT SKUs, one case each |
| Manager freight | Jain ₹120 + ₹6 GST; 0.60 quintals / 12.00 km context | Same |
| Quote total | ₹3,871 | ₹3,871 |
| Native submission | PASS — physical app controls | PASS — physical app controls |
| Hosted lifecycle | API contract: confirmed → packed → out_for_delivery → delivered | API contract: confirmed → packed → out_for_delivery → delivered |
| Same app after lifecycle | PASS — order history and details show Delivered | PASS — order detail shows Delivered |

The isolated Admin preview remains Vercel-SSO protected in this environment and
was not represented as visual Admin UI proof. The lifecycle actions above were
performed through the authenticated hosted Admin API endpoints used by the
Admin application, with normal order discovery before each action. This is
hosted Admin/API workflow evidence, not a claim that the isolated Admin preview
was interactively tested.

#### Hosted commercial reconciliation

The fresh Retailer order generated invoice `#11`, one combined invoice for
`₹3,871`: Padam goods ₹2,500 + ₹300 GST = ₹2,800; Jain goods ₹900 + ₹45 GST =
₹945; Jain freight ₹120 + ₹6 GST = ₹126. The invoice-specific balances before
collection were Jain `₹1,071.00` and Padam `₹2,800.00`.

An explicit invoice-scoped partial payment of `₹300.00` was recorded as Jain
`₹100.00` + Padam `₹200.00`. The resulting balances were Jain `₹971.00` and
Padam `₹2,600.00`. A second explicitly confirmed payment used exactly those
remaining invoice-level balances; the invoice is now paid with Jain `₹0.00`,
Padam `₹0.00`, total outstanding `₹0.00`.

The same partial-payment idempotency key replayed safely with HTTP 200 and did
not create another allocation. Reusing it with a changed amount/allocation
returned `payment_idempotency_conflict`. Reusing it against the other fresh
commercial invoice also returned the same conflict, with no cross-invoice
settlement. Invoice `#10` (the Salesperson order) remains `open`, outstanding
`₹3,871`, with zero allocations. No amount spilled between invoices or
companies.

#### Hosted mock-SAP boundary

`/admin/sap/status` reported the configured `mock` connector enabled and the
hosted material, pricing and stock sync records healthy. The UAT order’s
commercial read model and outbox attribution retain the Jain/Padam material
lines, company ownership, GST, freight and totals. Full mock-outbox completion
was not claimed: the client customer remains unlinked to a SAP customer id, so
the order/invoice outbox retains the existing reconciliation-required state.
Real SAP was not connected.

#### R2 / receipt evidence boundary

The application’s private receipt-storage contract remains present in source,
but a native receipt submission was **NOT RUN** in this continuation. The
current hosted Salesperson UAT persona did not expose a collection-submit item
in its normal More menu (`collection.submit` was not available), so no direct
API or database shortcut was used to manufacture R2 proof. The existing R2
implementation and its prior local tests remain separate evidence; this hosted
quote/order continuation does not close the receipt-evidence acceptance item.

#### Updated continuation result

| Check | Result | Evidence boundary |
|---|---|---|
| Native Retailer quote reconciliation | PASS | Physical Moto E13, foreground return, final total and enabled action |
| Native Salesperson quote reconciliation | PASS | Physical Moto E13, foreground return, final total and enabled action |
| Native Retailer order submission | PASS | Exact rebuilt APK, physical controls, `GGN-00000076` |
| Native Salesperson order submission | PASS | Exact rebuilt APK, physical controls, `GGN-00000075` |
| Same Retailer APK delivered display | PASS | Native order history and order details |
| Same Salesperson APK delivered display | PASS | Native order detail after pull-to-refresh |
| Combined invoice | PASS | Hosted read model, invoice #11, three commercial lines |
| Invoice-specific Jain/Padam split | PASS | Hosted Admin commercial payment contract and balances |
| Duplicate / changed / cross-invoice replay | PASS | Idempotency replay and conflict responses |
| R2 application receipt workflow | NOT RUN | Current UAT persona has no native collection-submit capability |
| SAP mock attribution | PASS WITH BOUNDARY | Mock connector and UAT line attribution verified; customer linkage/outbox completion not claimed |

Persistent screenshots for this continuation are under
`/Users/tanutejas/Documents/Gagan-product-improvements-v1/evidence/wave1b/`:

- `retailer-mixed-cart-waiting-76c7b32.png` — initial disabled quote state.
- `retailer-quote-reconciled-76c7b32.png` — confirmed quote and enabled action.
- `retailer-order-submitted-76c7b32.png` — native `GGN-00000076` submission.
- `retailer-delivered-orders-76c7b32.png` and `retailer-delivered-detail-76c7b32.png` — same-app Delivered proof.
- `salesperson-quote-reconciled-76c7b32.png` — confirmed Salesperson quote.
- `salesperson-order-submitted-76c7b32.png` — native `GGN-00000075` submission.
- `salesperson-delivered-top-76c7b32.png` and `salesperson-delivered-lower-76c7b32.png` — same-app Delivered and freight proof.

The source tests remain green after the correction: Retailer mobile suite
`74/74`, Salesperson mobile suite `133/133`; both mobile typechecks passed and
both hosted-endpoint Android Release builds passed. No backend source or
business calculation changed in `76c7b32`. No production, main, Dogkart,
historical payment, frozen tag or accepted fallback APK was modified. The
feature branch has not been deployed.

**Native quote-reconciliation blocker: CLOSED.**
**Hosted commercial order/invoice/payment continuation: PASS for the exercised
scope, with Admin preview UI and R2 receipt submission explicitly not claimed.**

### R2 native receipt acceptance continuation — 2026-09-15

This continuation resolved the earlier persona ambiguity through the
application's existing role model. A normal `salesperson` is not granted
`collection.submit`; the supported collection persona is `field_collector`.
The hosted staging identity **Field Ops UAT** has both `salesperson` and
`field_collector` roles, and its effective permissions include
`collection.submit`. This is a supported field persona, not a permission
weakening or a new role. The source of truth is
`rep/src/auth/staffCapabilities.ts`, `rep/src/screens/RepAccountScreen.tsx`,
`rep/src/screens/StaffHomeScreen.tsx`, `rep/App.tsx`, and
`backend/src/modules/identity/roleCatalog.ts`.

For staging UAT only, the existing Field Ops UAT identity was assigned to the
existing `Field Ops UAT Sharma` retailer through the supported Admin
collection-assignment endpoint. This was a normal staging fixture mutation;
no source code, historical payment, production data, or business contract
was changed. Assignment id:
`32aa23c3-ac8e-4dac-aade-6d661f4c0b54`.

#### Native path exercised

On Moto E13 `ZD2229Q3KB`, using the already authenticated hosted review APK,
the following supported flow was exercised:

`More` → `Collections` → horizontally reveal `Field Ops UAT Sharma` → enter
amount `₹1` → choose `CASH` → attach the staging receipt
`UAT-CASH-20260911-receipt.png` through the Android Documents picker → submit
for Accounts.

The attachment was visibly present in the native form before submission. The
first submit and one clean retry both returned the native alert **“Could not
submit / Something went wrong”**. A read-only refresh of hosted Admin
`GET /admin/collections` after the retry still returned exactly one existing
pending submission for `Field Ops UAT Sharma` (amount `₹3,120`, submitted
2026-09-11, no evidence); no new UAT submission was created. Therefore this
is not a successful receipt submission and no direct API or database shortcut
was used to manufacture one.

Persistent physical evidence is stored in the ignored
`evidence/wave1b/r2-2026-09-15/` directory:

- `field-ops-more-collections.png` — native More screen with Collections.
- `collection-form-sharma.png` — selected assigned retailer.
- `receipt-attached.png` — receipt attached through the native picker.
- `retry-ready.png` — amount and attachment ready for the clean retry.
- `retry-result.png` — hosted submission failure alert.

#### R2 evidence classification

| R2 checkpoint | Result | Evidence boundary |
|---|---|---|
| Supported native persona identified | PASS | Existing `field_collector` role and `collection.submit` capability |
| Staging collection assignment | PASS | Supported Admin assignment for Field Ops UAT → Field Ops UAT Sharma |
| Native collection form reachable | PASS | Moto E13 physical screen |
| Native receipt selection/attachment | PASS | Android Documents picker and attached filename visible |
| Native receipt submission | NOT PROVEN / HOSTED FAILURE | Two native attempts returned generic HTTP-500-style failure UX; no new Admin submission |
| Private object write | NOT PROVEN | No collection record was created from the native attempts |
| Signed/private retrieval | NOT RUN | No created evidence object was available to retrieve |
| Unauthenticated direct access blocked | NOT RUN | No hosted object key or signed object was available |
| Restart durability | NOT RUN | A successful hosted submission/object was a prerequisite |
| Accounts confirmation | NOT RUN | No new UAT submission reached the Accounts queue |

The source-level private storage contract and local protected-evidence tests
remain valid evidence for the implementation, but they do not prove this
hosted native R2 path. The exact underlying hosted exception could not be
isolated from the generic client error with the tools available in this
session; the remaining issue is therefore classified as a hosted
submission/storage configuration or runtime failure pending server-log
inspection. No provider credentials or storage configuration was changed.

#### Admin visual boundary

The isolated Admin preview remains protected by Vercel SSO in this environment
(HTTP 302 to the Vercel SSO endpoint). Admin/API behavior is already accepted
for the commercial flow, but **Admin visual UI review remains NOT CLAIMED**.
No accepted Admin deployment was replaced.

#### Updated hosted acceptance result

| Check | Result | Evidence boundary |
|---|---|---|
| Hosted commercial order/invoice/payment flow | PASS | Previously accepted exact hosted APK/API/Admin evidence; not repeated here |
| R2 supported persona and authorization | PASS | Existing Field Ops UAT `field_collector` capability and assignment |
| R2 native receipt attachment | PASS | Physical Moto E13 evidence |
| R2 native receipt submission | NOT PROVEN | Hosted submission failed twice and created no new collection |
| R2 private storage/signed retrieval/restart durability | NOT PROVEN | Downstream of the failed hosted submission |
| Admin visual UI | NOT CLAIMED | Vercel SSO blocked interactive visual review |
| SAP mock attribution | PASS WITH BOUNDARY | Mock only; real SAP remains disconnected |

**Hosted commercial flow: ACCEPTED for the previously exercised scope.**
**R2 native receipt acceptance: OPEN — supported persona is confirmed, but
hosted submission/storage proof is not.**
**Ready for Founder hosted commercial review: NO — R2 native acceptance and
Admin visual review remain unclosed.**

No source files or backend business logic changed in this continuation. The
only state mutation was the staging-only collection assignment documented
above. Production, main, Dogkart, the historical payment, frozen tags and
accepted APKs remain untouched.

### Final hosted R2 acceptance closure — 2026-09-15

The hosted collection submission defect was subsequently diagnosed from the
Gagan Render application logs. The native receipt request reached the API, but
the global Express JSON parser rejected the base64 receipt body at 100 KB before
authentication, collection validation, object storage, or database persistence.
The log recorded `entity.too.large` for a 144,816-byte request against the
102,400-byte parser limit. The focused backend correction scopes a bounded
15 MB parser to `/rep/collections`, matching the existing receipt evidence
contract. No commercial calculation, permission, storage-privacy, or database
business rule changed.

Backend fix source:
`adfd8b58fe35d9980a973ffbedd0fb5d12200035`.

The fix was deployed to the exact Gagan staging service as Render deployment
`dep-dak569h594qs738dro3g` at
`https://gagan-srat.onrender.com`. The accepted client quote-reconciliation
source remains `76c7b3205756a449d4b6f48b0d10cc482da5f8`.

Using the supported authenticated Field Ops UAT persona on Moto E13
`ZD2229Q3KB`, exactly one native submission was performed through:

`More` → `Collections` → `Field Ops UAT Sharma` → `₹1` → `CASH` → attach
`UAT-CASH-20260911-receipt.png` → `Submit for Accounts`.

The native app displayed the success state: **“Submitted — Accounts will verify
this collection before it affects the ledger.”** The resulting record was:

- CollectionSubmission: `167529b0-c149-48ee-8917-ba759b63563d`
- Evidence ID: `1ce90c8a-cc63-47df-bbfe-71abf2663774`
- Payment ID after Accounts confirmation: `63a321e9-47f2-4139-a3df-d41cbec52666`
- Evidence: PNG, 108,471 bytes
- Native receipt submission: PASS

The normal authenticated application/Admin retrieval returned a short-lived
signed R2 URL in memory. Retrieval returned HTTP 200 with the same 108,471-byte
payload and matching checksum. Removing the signature parameters from that
object URL returned HTTP 400 without receipt bytes, and unauthenticated
application detail returned HTTP 401. The tested evidence object therefore
remained private and was accessible only through the normal authenticated
signed-retrieval path.

Accounts confirmation was performed through the supported confirmation path.
The first confirmation returned HTTP 200 with `idempotent: false`; one deliberate
repeat returned HTTP 200 with `idempotent: true`, reused the same Payment ID,
and did not create a second financial posting. The confirmed collection amount
was ₹1, with ₹0 unallocated and the resulting outstanding balance ₹3,119.

The exact Gagan staging API service was restarted after confirmation. Following
restart, `/health`, `/health/live`, and `/health/ready` all returned HTTP 200;
the same CollectionSubmission, Payment ID, Evidence ID, receipt checksum and
signed retrieval remained available. This proves restart durability for the
tested R2 object rather than Render-local-disk dependence.

Persistent final evidence is stored under the ignored
`evidence/wave1b/r2-2026-09-15/` directory:

- `native-before-submit-final.png`
- `native-submit-result-final.png`
- `collection-record-final.json`
- `accounts-confirmation-final.json`
- `restart-durability-final.json`
- `render-logs-entity-too-large.png`
- `native-submit-failure-after-parser-retry.png`

| Final hosted checkpoint | Result |
|---|---|
| Core commercial flow | PASS — retained from accepted checkpoint; not repeated |
| Retailer mixed Jain/Padam | PASS — retained from accepted checkpoint; not repeated |
| Salesperson mixed Jain/Padam | PASS — retained from accepted checkpoint; not repeated |
| Manager freight reconciliation | PASS — retained from accepted checkpoint; not repeated |
| Combined invoice | PASS — retained from accepted checkpoint; not repeated |
| Invoice-specific Jain/Padam balances | PASS — retained from accepted checkpoint; not repeated |
| Partial explicit allocation | PASS — retained from accepted checkpoint; not repeated |
| Exact remaining payment | PASS — retained from accepted checkpoint; not repeated |
| Second invoice untouched | PASS — retained from accepted checkpoint; not repeated |
| Duplicate replay protection | PASS — retained from accepted checkpoint; not repeated |
| Cross-invoice protection | PASS — retained from accepted checkpoint; not repeated |
| Native collection submission | PASS |
| CollectionSubmission | `167529b0-c149-48ee-8917-ba759b63563d` |
| R2 object write | PASS |
| Private object | PASS for tested evidence object |
| Signed retrieval | PASS |
| Unauthorized direct access blocked | PASS |
| Accounts confirmation | PASS |
| Duplicate confirmation/idempotency | PASS |
| Restart durability | PASS |
| Mock SAP | PASS WITH BOUNDARY — real SAP remains disconnected |
| Admin visual preview | NOT CLAIMED — not a blocker |
| Founder hosted commercial review | YES |
| Production readiness | NO |

**Wave 1B hosted acceptance: PASS.**
**Ready for Founder hosted commercial review: YES.**
**Ready for production: NO.**

This closure preserves the earlier failed native attempts as diagnostic history;
they were not rewritten as successes. No production, main, Dogkart, historical
data, real SAP configuration, or approved APK was changed during the closure.
