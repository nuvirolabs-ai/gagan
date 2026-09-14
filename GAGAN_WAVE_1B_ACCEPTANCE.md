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
