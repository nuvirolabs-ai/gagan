# Gagan master product improvement — verified implementation checkpoint

**Wave 1B update (2026-09-14):** Company-aware commercial checkout, combined
invoice and invoice-specific payment allocation are now implemented and locally
accepted. See [the Wave 1B acceptance report](GAGAN_WAVE_1B_ACCEPTANCE.md).
The assessment and unfinished-commercial statements below are historical Wave 1
evidence, not a current Wave 1B status. The full master brief remains broader than
Wave 1B; no Wave 2 or production-readiness claim is made.

Date: 2026-09-14. **Full master brief: INCOMPLETE. Production-ready: NOT CLAIMED.**

Engineering readiness estimate against the entire new brief: **55/100**. This
is a conservative assessment, not a calculated feature-completion percentage or
an assertion that all untested modules are absent. Core ordering/field operations
work, but company-aware commercial settlement and important requested workflows
remain unfinished. Passing the regressions below does not close those gaps.

## Source and safety

- Isolated worktree: `/Users/tanutejas/Documents/Gagan-product-improvements-v1`.
- Branch: `codex/gagan-product-improvements-v1`.
- Base: fetched Field Ops `282864a`, descendant of canonical `df707fa`.
- Runtime source checkpoint: `9c5c9957cf2d396293f426fea4e05935204297c9`.
- `b910d72`: order/invoice/proposal integrity and backend dependency corrections;
  includes a separately identified, unused commercial calculation foundation.
- `953a27e`: mobile account carts/session resilience, SKU controls/summary, Review profiles.
- `9c5c995`: structured Visit Out and required explanations.
- Original dirty canonical checkout, unrelated worktrees, main, frozen tags,
  existing APKs, original installed packages, Dogkart and production unchanged.
- No push, hosted deployment, hosted data mutation or real-provider connection.

## Implemented corrections by layer

### Backend

1. Both app order writes normalize duplicate SKU rows and reject invalid/overflow
   quantities at the shared service boundary.
2. Same checkout key with changed items/persona is a conflict, including parallel
   submissions. Legitimate same-request replay still returns the accepted order.
3. Retailer credit/master state is read after its transaction lock, not before it.
4. Decimal arithmetic survives through monetary rounding. Half-paise rounding
   regression is covered; accepted historical case-weight snapshots remain in use.
5. Invoice replay verifies the original order and immutable delivery lines.
   Reusing another order's key or changing quantity/weight cannot return success.
   Three failing tests were demonstrated before the correction. More than three
   decimal places in delivered weight are rejected instead of silently storing
   a different value that cannot support exact replay.
6. Approve/reject/withdraw races use a conditional pending-state claim. Customer
   creation stays in the same transaction. Withdrawal now has an audit event.
7. Salesperson catalogue reuses existing backend product/SKU grouping; inventory,
   prices and cart lines remain SKU-specific.
8. Visit Out stores multiple outcomes and a structured no-order reason. A genuine
   sales call without an order selection needs an explanation even if another
   activity is selected. Collection-only visits do not invent a lost sale.
   One legacy primary outcome remains available to existing readers.

### Database

One additive migration: `20260914000100_visit_outcomes`.
Adds `SalesVisit.outcomes TEXT[] DEFAULT [] NOT NULL` and nullable `noOrderReason`.
Existing history is not inferred, backfilled or rewritten. Existing one-open-visit
constraint and transaction locking remain unchanged.

PostgreSQL must take a table lock for ALTER TABLE; no hosted lock-duration or
staging preflight was performed. Deploy migration/backend before the new mobile
Visit Out client. Older readers can ignore the extra columns and retain the
legacy outcome. Do not drop these columns as a rollback: that would lose newly
recorded business detail. Retaining additive columns is the safe application
rollback direction, subject to deployment review.

### Retailer App

- Per-retailer persisted cart keys, ownership validation and serialized writes.
- Original unowned legacy cart retained untouched; never handed to another user.
- Corrupt/read/write failures are not treated as a successful empty-cart restore.
- Guard against stale catalogue reconciliation replacing newly edited cart state.
- Refresh transport/503/malformed-response failures no longer erase login.
- Larger actual 44dp quantity controls; disable changes during submission.
- Synchronous submit guard and safer uncertain-retry key handling.
- Hide retailer-visible credit limits/headroom; preserve internal eligibility.
- Correct clipped checkout summary labels.

### Salesperson App

- Same refresh failure correction; clear volatile customer/basket on revoked login.
- One product with selectable pack options, independent SKU quantities and live total.
- Larger controls wrap below details instead of clipping the product name.
- Successful order opens real order detail, with correct pack description.
- Order-detail refresh failure retains last good data and ends the loading state.
- Multi-select Visit Out, required reason, visible saved outcomes; synchronous
  GPS/submit guard prevents repeated work while obtaining a location.

### Admin / Manager

No Admin visual redesign or new management UI. Existing proposal decisions gain
backend race protection. Manager freight editor/company configuration is **not
implemented** in this checkpoint.

### SAP / infrastructure

No adapter or real provider was replaced. Existing mock SAP/history tests pass.
Backend `xlsx` moved to the official pinned SheetJS 0.20.3 distribution; `qs`
patched through an explicit override. Backend production dependency audit reports
zero findings. This does not clear the separate mobile dependency advisories.

## Commercial decision — accepted but not fully implemented

Owner confirmed: Jain Traders/Padam International SKU ownership; mixed carts;
**ONE combined invoice with company detail on each line**; quintal rates exclude
GST; per-SKU GST; final manager freight with quintals/km as supporting records;
freight GST added separately.

`commercialQuote.ts` has ten tests for explicit case/quintal basis, tax, entity
totals and final freight. It is **not invoked by accepted checkout, invoice,
payment or SAP writes**. Existing live per-case prices have not been relabelled.
Do not present this foundation as delivery of the requested commercial feature.

## Automated verification

| Gate | Result |
|---|---|
| Fresh final automated DB | `gagan_test_master_final_20260914_01` |
| Full migration history from zero | 34 migrations PASS |
| Prisma validate / migration status | PASS / up to date |
| Backend full tests | 125 files, 875 tests PASS |
| Backend typecheck / build | PASS / PASS |
| Backend production dependency audit | 0 reported vulnerabilities |
| Admin tests | 19 files, 49 tests PASS |
| Admin typecheck / lint / build | PASS / PASS / PASS |
| Retailer tests / typecheck | 15 files, 68 tests PASS / PASS |
| Salesperson tests / typecheck | 26 files, 128 tests PASS / PASS |
| Android debug Review builds | Both PASS and installed |
| Final standalone release APKs | NOT BUILT / NOT ACCEPTED |
| Founder configured regression | NOT RUN; no Founder source changed |
| Hosted end-to-end / real providers | NOT RUN |

Added/extended coverage: order normalization/replay races, invoice replay and
precision, proposal decision races, account-cart storage, both refresh clients,
SKU selection and Visit Out policy/database/API.

## Actual physical acceptance — isolated local environment

Moto E13 `ZD2229Q3KB`, 720×1600 pixels, density280. No coordinate spoofing.
Separate packages: `com.gagan.sales.review`, `com.gagan.retailer.review`.
Normal application login using **local mock OTP**, not an injected session.
API: `http://127.0.0.1:4410` through ADB reverse. These debug apps **depend on the
Mac/USB/Metro**; they are not hosted staging/standalone client artifacts.
Original installed `com.gagan.sales` and `com.gagan.retailer` were preserved.

App UAT DB: `gagan_uat_master_20260914_01`, separate from destructive test DBs.
UI writes, followed by read-only PostgreSQL observation:

| Scenario | Observed result | Method |
|---|---|---|
| Retailer order | GGN-00000032, Mahesh Store, 1 line, ₹3,150, placed | NATIVE UI + READ-ONLY DB |
| Quantity controls | Add, increment and decrement through real controls | NATIVE UI |
| Retailer process restart | Force-stopped only Review app, reopened; session restored and 1-line ₹3150 basket retained | NATIVE UI |
| Salesperson grouped packs | 1kg×30 and 5kg×6 independently selected | NATIVE UI |
| Salesperson order | GGN-00000033, Annapurna Foods, 2 lines, ₹6,300, attributed to rep | NATIVE UI + READ-ONLY DB |
| Order success summary | Navigated directly to order33 detail with both packs/total | NATIVE UI |
| Visit In | Created visit; GPS honestly marked OUTSIDE_STORE_AREA for seeded Pune store | NATIVE UI + READ-ONLY DB |
| Required reason | Attempted Visit Out without reason blocked visibly | NATIVE UI |
| Multiple outcomes | `follow_up_required`, `no_order`, reason `follow_up_required` persisted; visit closed | NATIVE UI + READ-ONLY DB |
| Visit route state | Retailer shows Visited after closing | NATIVE UI |

Visit id: `c834d5b1-6830-4056-a180-c1c0c830e799`.
Checked in06:54:07.622UTC; checked out06:57:07.287UTC. That duration includes
manual inspection/validation and is **not a checkout performance measurement**.
Selected outcomes are self-reported, not proof of a payment or survey transaction.
Selecting follow-up outcome alone is not proof of a scheduled reminder/date.

### Local screenshot index

Persistent directory: `evidence/master-20260914/` (excluded from Git because
diagnostic/auth/location screens can contain sensitive context).

- `retailer-review-order-submitted.png`: order32 confirmation.
- `retailer-cart-final.png`: enlarged controls and corrected untruncated summary labels.
- `retailer-cart-after-restart.png`: same account's basket survives process restart.
- `rep-grouped-catalog-actual.png`: one product with three packs.
- `rep-catalog-final-controls.png`: expanded controls and untruncated product.
- `rep-order-result.png`: order33 detail.
- `rep-visit-outcomes.png`: multiple selections.
- `rep-visit-reason-required.png`: no-order validation alert.
- `rep-visit-confirmation.png`: successful Visit Out confirmation.

SHA-256:
- order32 screenshot: `38ef3cb1686a096536b70dc262aa213be4613d6e763a48859127f292060ee949`
- Retailer cart screenshot: `26da4df26e0e6f42a3c5be1ae33f66d77f5c1eb3b02938e463cebe054589d5c3`
- order33 screenshot: `c6bdaeb69a044136715058aff0c7179dd15440e86581d33243b9372f9726b17d`
- Visit Out screenshot: `42101130637ec8871e510b031669dd2e8c31c455438982960178b779c8ee4a22`

Early diagnostic filenames do not necessarily describe their final visible
screen. Only the explicitly indexed evidence above supports the stated results.

## Remaining product gaps and production blockers

1. Persist company/SKU/rate-basis/GST configuration; immutable accepted commercial
   quotes; manager freight; one combined invoice's company line attribution;
   entity-protected outstanding/payment allocations; both checkout readers and SAP
   mapping. No real company bank/QR/rate values were invented.
2. Pending retailer immediate ordering, verified main phone/mandatory WhatsApp,
   and KYC/credit-safe activation are not complete. Approval race protection does
   not implement this new lifecycle.
3. Entirely durable checkout recovery across process death remains unfinished;
   current in-memory checkout keys are not a persisted submission journal.
4. Account-cart storage has automated isolation/restart/failure coverage and a
   physical same-account restart pass. Full account-switch UI and in-flight
   auth-refresh/account-switch races need further
   acceptance/hardening. No claim of complete account-security closure.
5. New brief's broader Today/manager/notifications/attendance/issue/payment
   evidence/returns/dispatch requirements are not all implemented or physically
   reaccepted. See requirement matrix; untraced is not labelled missing.
6. Three sequential achievement sheets were physically observed on initial
   Salesperson Home. Stale target/achievement rules and interruption behaviour
   still require correction; no 9/10 visual claim.
7. Production SMS/payment/SAP and durable storage provider acceptance, mobile
   dependency-security review, release signing/build/deployment provenance,
   multi-size/keyboard/background/offline/performance acceptance remain open.

## Next highest-value implementation batch

Implement the approved combined-company commercial vertical slice end-to-end:
SKU entity/GST/rate-basis configuration → authorized final-freight quote → immutable
order snapshot → combined invoice company lines → entity-safe payment allocation
→ both native checkout/summary screens → Admin/SAP read models → disposable-DB
financial invariants and real UI acceptance. Preserve legacy financial history
explicitly. Then pending-store/OTP activation and durable checkout recovery.

Do not deploy this report as a claim that the entire master brief is complete.
