# Gagan Salesperson UX Reconciliation Audit

## Scope and source boundary

This audit compares the exact Client-UAT RC (`aeaf31f6b7f2e39d6f50a8c2d2cb94f8bdcea25a`) with the separate Salesperson UX line `codex/gagan-salesperson-ux-field-flow` (`5507d750ffe9eb5692d8d0276f3cbfb514773e73`). The UX line is not a safe whole-branch merge candidate: its ancestry diverges from the RC and includes unrelated backend, schema, Admin, and obsolete migration work. The reconciliation therefore ports only compatible `rep/` presentation and interaction changes.

The following current RC boundaries were preserved:

- 39 backend migrations and the complete Wave 1B, Wave 2.1, Market Survey, and Internal Commercial Status lineage.
- Backend/API contracts, pricing, GST, freight, payment allocation, idempotency, account isolation, cache behavior, and onboarding proposal contracts.
- The current `backend/src/modules/field` issue API. The old UX branch's obsolete issue route and `20260915090000_service_issue_lifecycle` migration were not ported.
- The current `20260915120000_market_survey_v1` and Internal Commercial Status migration remain unchanged.

## Exact inventory

| Area | Current RC before reconciliation | UX-line evidence | Classification | Reconciliation decision |
|---|---|---|---|---|
| Calendar/date input | Expenses submitted the current timestamp; leave dates used a bespoke pressable picker in `MyDayScreen` | `422c475` adds `DateField`, date-only parsing, bounds, and stable expense payload helpers | B — missing accepted UX on current RC | Ported date-only helpers and `DateField`; applied to Expenses and Leave. Existing follow-up calendar remains in place. |
| Keyboard safety | Several forms used direct `ScrollView` or a screen-owned keyboard-height inset; Add Retailer had a separate Android listener | `0b5141a`, `89a4a2c`, `56ac00b`, `c1ca8d6` establish one shared keyboard contract | B — partial/duplicated current implementation | Ported `KeyboardSafeScrollView`; applied to the affected current screens and EOD sheet; removed Add Retailer's duplicate keyboard-height inset. |
| Order review checkpoint | RC had review state inside `RepCatalogScreen`, then navigated to current canonical `OrderDetail` | `665ce17` adds explicit `RepReviewOrderScreen` and a richer post-submit screen | B — navigation/UX regression, while commercial behavior is present | Added an explicit Review Order route. Quote creation, refresh, approval, idempotency, and order placement remain the current RC contract. |
| Order detail | RC already has canonical `OrderDetailScreen` loading the server order, timeline, commercial snapshot, invoice, and internal overlay | Old `RepOrderDetailScreen` is a presentation-only alternate that used a POST response and an old helper | ALREADY PRESENT; old alternate not required | Kept current canonical detail and added the accepted `Done · Next retailer` action. Did not introduce a second order-detail truth. |
| Order pricing | RC already obtains `CommercialQuote`, refreshes it, and sends `{quoteId, revision}` to canonical order creation | Old review screen called `createOrder` without the quote in its version | ALREADY PRESENT / protected contract | New Review route uses the RC quote flow; it does not use the old quote-less submit. |
| Issue list/detail | RC lists persisted issues from `repApi.issues()` and displays issue state, retailer, priority, assignment, resolution note, and timestamps | `665ce17` adds rep resolve/withdraw calls and an old backend issue lifecycle route/migration | F — current supported UI present; action lifecycle is API-limited | Kept current list/detail/state display. Did not port unsupported rep resolve/withdraw endpoints or obsolete backend/migration. This remains a documented API-scope gap, not a safe UI-only claim. |
| New retailer proposal withdrawal | Current RC already contains proposal withdrawal UI and `withdrawRetailerProposal` contract | `5507d75` adds a separate multi-stage withdrawal flow and an old migration | ALREADY PRESENT; alternate/unfinished line excluded | Preserved current RC onboarding and withdrawal behavior. No old migration or alternate flow was imported. |
| Follow-up dates | RC `ActivityComposer` already supports tomorrow, 2/3/7-day presets and a custom `DatePickerModal` | Later old UX simplification replaced this with a single toggle | SUPERSEDED | Retained the richer current RC follow-up behavior. |
| Attendance calendar | RC `MyDayScreen` already has month navigation, attendance markings, and the current attendance API | Old UX adds separate `attendanceCalendar` helpers in a divergent screen rewrite | ALREADY PRESENT / alternate rewrite | Kept the current RC calendar and changed only the leave inputs to the shared date field. |
| Visit/no-order | RC Visit supports outcomes, no-order reason, activity composition, check-in/out, and existing server contracts | Old branch adds helper files and screen rewrites | ALREADY PRESENT / alternate helper line | No business behavior was replaced. Visit now uses the shared keyboard-safe scroll wrapper. |
| More/collections | RC contains the current invoice-scoped collection allocation flow | Old UX changes are not needed for the requested date/keyboard/order restoration | ALREADY PRESENT | Preserved current collection contract and applied keyboard-safe scrolling to the live collection form. |
| Backend/API | Current RC is the accepted consolidated backend/Admin source | UX branch includes old issue route and other server/schema deltas | H — no backend change authorized | No backend, Admin, migration, or commercial code changed. |
| Database/migrations | RC has 39 migrations | UX branch introduces rejected/obsolete issue/onboarding migrations in its divergent history | ALREADY PRESENT / protected | Final candidate remains at 39 migrations; no migration was added. |
| Old proposal/onboarding branch | `5507d75` contains secure withdrawal work but is not accepted as current architecture | Alternate backend/schema contract | I — unfinished/experimental or alternative | Excluded from this reconciliation; current RC onboarding was preserved. |

## Restored current-RC changes

- Shared date-only helper module and reusable calendar field with accessibility labels, month navigation, bounds, cancel/back behavior, and no keyboard activation.
- Expense date selection and stable UTC-noon API serialization.
- Leave From/To selection through the same date field, including an inclusive minimum bound for the end date.
- One shared Android/iOS keyboard-safe scroll contract for field forms, applied without adding any tab-bar or permanent viewport inset.
- Explicit Salesperson `Catalogue → Review Order → Place Order → canonical Order Detail → Done · Next retailer` navigation.
- Current backend quote authority, freight/ GST display, quote refresh, quote expiry handling, rate-approval action, order idempotency, approval acknowledgment, and canonical order detail remain the only commercial path.

## Deliberately not ported

- `5507d75` backend/schema/migration work for the alternate retailer proposal withdrawal flow.
- `665ce17` `backend/src/routes/issues.ts`, `20260915090000_service_issue_lifecycle`, and corresponding schema/service changes.
- The old `RepOrderDetailScreen` as a second post-submit order truth.
- The old quote-less review submit implementation.
- The later follow-up simplification that would remove the current preset/custom date choices.
- Whole-screen rewrites of `MyDayScreen`, `RepCatalogScreen`, or onboarding that would replace newer RC behavior.

## Verification boundary

The reconciliation is source-level and test-backed in this task. It does not claim physical acceptance of a newly built APK: APK build and Moto E13 UAT are intentionally deferred to the next task. The old APK remains a prior artifact and is not evidence for this reconciled source.
