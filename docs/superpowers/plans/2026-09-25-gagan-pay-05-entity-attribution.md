# GAGAN PAY-05 Entity Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose reconciled Jain Traders, Padam International, and unattributed financial amounts in existing GAGAN retailer, salesperson, and Admin views without changing consolidated accounting totals.

**Architecture:** Derive current entity balances from each invoice's saved commercial snapshot and its persisted `PaymentAllocation` entity amounts. Add an explicit unattributed bucket for legacy/cached amounts and mark inconsistent records for review; enrich existing summary and ledger responses additively. Keep the existing invoice/order/collection persistence model and render the read contract in existing screens.

**Tech Stack:** TypeScript, Prisma, Express, React Native, React, Vitest, local disposable PostgreSQL.

**Spec:** `GAGAN_PRODUCT_GOAL.md` (GGN-PAY-05), `docs/GAGAN_FORENSIC_COMPLETENESS_AUDIT.md` (GGN-PAY-05 and GGN-PAY-08 dependency).

## Global Constraints

- "Do NOT merge balances merely to make the UI simpler."
- "UI may show consolidated totals in addition, but the underlying company-wise breakup must remain available."
- "Do not invent SKU-level accounting if the backend fundamentally allocates against invoice/order level."
- Preserve invoice/entity-scoped payment protections and current legacy settlement behavior.
- Use only the confirmed disposable local PostgreSQL test database for database tests; do not write to hosted staging.
- Do not add a schema migration unless current persisted fields prove insufficient.

## Review Focus

1. Legacy invoices or cached balances lack entity evidence; keep their full amount in `unattributed` and never infer a company.
2. Unknown entity keys, invalid amounts, reversals without entity portions, or a source-total mismatch must not be partially distributed; isolate the affected amount as unattributed and mark `review_required`.
3. Mixed-entity invoices with valid partial payment allocations must preserve each entity's remaining amount and sum exactly to the existing invoice outstanding.
4. A confirmed payment may include an unallocated advance; expose allocated entity portions and keep the unallocated remainder unattributed.
5. A prior server response without the additive fields must leave existing consolidated UI readable and must not fabricate a zero entity split.

## File Map

- Create `backend/src/modules/finance/entityAttribution.ts` for validated, shared attribution projections.
- Modify `backend/src/modules/finance/financialSummary.ts` and `financialQueries.ts` to expose current balances and per-entry impacts.
- Test backend projection behavior in `backend/src/modules/finance/__tests__/entityAttribution.test.ts`, `financialSummary.test.ts`, and `financialQueries.test.ts`.
- Modify shared mobile finance types in `mobile/src/types/index.ts` and `mobile/src/types/home.ts`; add the reusable presentation in `mobile/src/components/finance/EntityAttribution.tsx`; wire it through `mobile/src/lib/homePresentation.ts`, `mobile/src/components/home/AccountStrip.tsx`, `mobile/src/screens/HomeScreen.tsx`, and `mobile/src/screens/LedgerScreen.tsx`; add English/Hindi labels in `mobile/src/i18n/translations.ts` and tests in `mobile/src/lib/__tests__/homePresentation.test.ts`.
- Modify salesperson balance/history display in `rep/src/screens/RepRetailerDetailScreen.tsx`; add English/Hindi labels in `rep/src/i18n/translations.ts`.
- Modify Admin read-only ledger display in `admin/src/pages/Ledger.tsx`; add `admin/src/pages/__tests__/Ledger.test.tsx`.
- Update `docs/GAGAN_FORENSIC_COMPLETENESS_AUDIT.md` and `docs/GAGAN_GOAL_STATE.md` with evidence, scope, commit, and remaining non-local acceptance gates.

## Tasks

### Task 1: Validated Backend Entity Projection

**Interfaces:** `EntityAmounts` contains numeric `jainTraders`, `padamInternational`, and `unattributed` values. `AttributionStatus` is `complete`, `contains_unattributed`, or `review_required`. `financialSummaryFor` adds `entityBalances.outstanding` and `entityBalances.overdue`, each an `EntityAmounts`, plus `entityBalances.attributionStatus`. Each ledger entry adds `entityBreakdown` with the same three amount keys and `attributionStatus`.

- [x] Add failing tests for attributed, legacy, and inconsistent invoice balances and for payment/invoice ledger-entry attribution.
- [x] Run the focused backend tests and verify they fail only because the new fields/logic are absent.
- [x] Implement shared projection helpers. Accept only `jain_traders` and `padam_international`; validate snapshot total against invoice total; subtract explicit allocation portions; verify the remainder equals `outstandingAmount`. Treat an attributed invoice with a reversal lacking entity portions as review-required. Route legacy/cached values wholly to `unattributed`.
- [x] Enrich ledger projections: invoice debits use validated snapshot entity totals; confirmed payments use their explicit allocation portions; unallocated payment remainder and legacy-only corrections remain unattributed. If an entry cannot reconcile, put its full amount in `unattributed` and mark `review_required`.
- [x] Re-run the focused backend tests, then run the full backend suite, typecheck, and build against `.env.test.local`.

### Task 2: Retailer Home and Ledger

- [x] Add failing tests for presenting the three entity buckets, preserving the consolidated amount, and omitting the breakdown for an older payload with no entity data.
- [x] Run the focused Retailer tests and verify the new assertions fail.
- [x] Extend the Home/Ledger payload types and render the entity balances below the current consolidated Home totals and Ledger total. Render per-entry entity impact in the ledger history. Keep entity labels readable on narrow screens and add English/Hindi strings.
- [x] Re-run focused Retailer tests, then the full Retailer suite, typecheck, and Android Metro export.

### Task 3: Salesperson and Admin Read Views

- [x] Add failing salesperson presentation-helper and Admin Ledger component tests for the entity summary and per-entry split.
- [x] Run the focused tests and verify the new assertions fail.
- [x] Render entity balances and recent-ledger impacts in the salesperson retailer detail; render entity totals and row impacts in Admin Ledger. Preserve existing collection queue entity allocation and do not add a second payment workflow.
- [x] Re-run focused tests, then full Rep/Admin suites, typechecks, Admin production build, and Admin lint.

### Task 4: Reconcile, Record, and Commit

- [x] Run local PostgreSQL readback coverage for a mixed-entity invoice with partial allocations, a legacy invoice, and cached-only balance; assert each entity sum reconciles to the existing consolidated summary.
- [x] Run `git diff --check`, inspect the complete source/test/doc diff, and confirm no schema migration or hosted/database write was introduced.
- [x] Update the PAY-05 issue row and goal-state register with exact local evidence, source commit `1a0d8c15289fb03183fc7294f086ea36332e9add`, and explicit hosted/physical limitations; preserve the initial audit classification as history.
- [x] Commit the PAY-05 batch on `codex/gagan-client-feedback-v2-reconciled` and verify the pushed remote SHA. Continue with GGN-PAY-06 in the product goal's sequence.
