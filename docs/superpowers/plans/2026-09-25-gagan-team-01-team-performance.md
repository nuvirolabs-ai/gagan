# GGN-TEAM-01 Team Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the existing permission-gated Sales Leader team-performance flow in the Rep app, preserving manager targets, visible actuals, reporting scope, personal performance, and EN/HI meaning.

**Architecture:** Extend the existing sales-leader read model and existing `/rep/sales-leader` contract. Fetch manager target rows together with permitted reportee rows, add structured facts alongside existing generated trigger copy, and render those facts with the existing Rep EN/HI translation system. Preserve the resolver's exact team IDs and the separate personal-performance routes.

**Tech Stack:** TypeScript, Express, Prisma, PostgreSQL, Vitest, React Native/Expo, existing Rep `translate`/`useLanguage` utilities.

**Spec:** `docs/superpowers/specs/2026-09-25-gagan-team-01-design.md`

## Global Constraints

- Keep the existing `/rep/sales-leader` route, staff-session authentication, `PERFORMANCE_VIEW_TEAM` gate, hierarchy scope, and Admin route behavior.
- Keep the manager's assigned target separate from reportee target rollup. Preserve the exact IDs returned by the hierarchy resolver, including the caller; do not add or count the manager twice.
- Show actual sales without a positive configured target; only show target progress for positive targets.
- Keep the leader's existing personal work/performance routes and permissions intact.
- Do not add a schema/migration, duplicate target/sales model, manager app, or parallel team endpoint.
- Render risk/opportunity copy in EN/HI from structured codes and typed values; do not parse generated English strings.
- Preserve trigger eligibility, target math, ranking, route/attendance policy, and risk/opportunity business rules.
- Leave the modified forensic audit and both pre-existing untracked user-owned files untouched.
- Hosted, authenticated-browser, APK, and physical-device acceptance are separate and are not claimed by local tests.

## Review Focus

- **Manager with zero active reports:** target must survive the service's empty-team path and be visible in the Rep summary. Pin in Tasks 2 and 3 with unit and PostgreSQL route assertions.
- **Caller appears in the resolver's scope and has a linked Salesperson account:** include that row once as an in-scope member, while manager target query IDs remain unique. Pin in Tasks 2 and 3.
- **Null, zero, negative, or missing target with nonzero sales:** preserve actual and hide only target/progress. Pin in Task 4, including the existing user-owned helper test.
- **Opportunity variant with dynamic facts:** currency, counts, elapsed days, or category names must not be dropped or interpreted from English. Pin every trigger code in Task 1 and EN/HI copy in Task 4.
- **Unknown attendance or unavailable projection boundary:** do not label unknown as absent or show a blank/unexplained projection. Pin unknown attendance plus zero/early selling-day cases in Task 4.

---

### Task 1: Add Typed Facts to Existing Sales Triggers

**Files:**
- Modify: `backend/src/modules/intelligence/triggerDomain.ts`
- Test: `backend/src/modules/intelligence/__tests__/triggerDomain.test.ts`

**Interfaces:**
- Produces: `SalesTrigger.facts`, a discriminated union keyed by the trigger type, containing numeric and string-array source values rather than formatted English measurements.
- Keeps: `headline`, `why`, `measurements`, and `recommendedAction` unchanged for existing consumers.

- [ ] **Step 1: Add failing facts assertions for every trigger code**

Use deterministic trigger contexts already established in `triggerDomain.test.ts`. Assert the discriminator and source values for `ORDER_DUE`, `HIGH_VALUE_RETAILER_MISSED`, `ORDER_VALUE_BELOW_NORMAL`, `LINE_ITEMS_BELOW_NORMAL`, `CATEGORY_REORDER_OPPORTUNITY`, `VISIT_OVERDUE`, and `COLLECTION_DUE`. Include one optional-value case (no median order value) and assert numbers/category arrays remain numbers/arrays.

Example assertion shape:

```ts
expect(trigger.facts).toMatchObject({
  code: "ORDER_VALUE_BELOW_NORMAL",
  typicalOrderValue: 10000,
  lastOrderValue: 4000,
  shortfall: 6000,
  recentOrderCount: 4,
});
```

- [ ] **Step 2: Run the focused test and confirm the new contract fails**

Run from `backend/`: `npm test -- --run src/modules/intelligence/__tests__/triggerDomain.test.ts`

Expected: the new `facts` assertions fail because triggers currently expose only formatted English measurements.

- [ ] **Step 3: Add the discriminated fact union and populate it at trigger creation**

Add one `TriggerFacts` union to the domain module. Populate each variant from the already-available `RetailerBaseline`/`TriggerContext` values at the same point the current trigger is produced. Do not parse or reconstruct facts from `why`, `measurements`, or `recommendedAction`; do not change the trigger conditions or priorities.

- [ ] **Step 4: Run trigger-domain tests**

Run from `backend/`: `npm test -- --run src/modules/intelligence/__tests__/triggerDomain.test.ts`

Expected: all existing trigger behavior and new typed-fact assertions pass.

- [ ] **Step 5: Commit the trigger contract change**

```bash
git add backend/src/modules/intelligence/triggerDomain.ts backend/src/modules/intelligence/__tests__/triggerDomain.test.ts
git commit -m "feat: expose structured sales trigger facts"
```

### Task 2: Add Failing Read-Model and Authenticated Route Regressions

**Files:**
- Modify: `backend/src/modules/readmodels/__tests__/salesLeaderService.test.ts`
- Modify: `backend/src/modules/readmodels/__tests__/performanceIntegration.test.ts`

**Interfaces:**
- Consumes: existing sales-leader service, staff-session routes, and the typed `SalesTrigger.facts` contract from Task 1.
- Produces: failing local unit/API assertions for unique manager target selection, zero-report target visibility, team-versus-personal performance, seller denial, and in-tree-only access.

- [ ] **Step 1: Add failing unit assertions for manager target query and empty-team output**

In `salesLeaderService.test.ts`, assert the target query includes reportees and `managerStaffId` exactly once. Add an empty-team manager target fixture and assert `targets.assigned`, `team.target`, zero members, and zero team actual. Add a duplicate-ID case where `managerStaffId` is already in the scoped IDs.

```ts
expect(prisma.salesTarget.findMany.mock.calls[0][0].where.salespersonId.in).toEqual([
  "s1", "s2", "m1",
]);
expect(result.targets.assigned).toBe(800000);
expect(result.team).toMatchObject({ salespeople: 0, target: 800000, actual: 0 });
```

- [ ] **Step 2: Add failing authenticated route assertions with disposable fixtures**

In `performanceIntegration.test.ts`, give one leader fixture its existing `field_manager` and `salesperson` role assignments (do not alter role definitions), plus a manager-owned Rep book/order and current-period order-value target. Assert `/rep/performance/targets` returns the leader's own canonical personal actual/target and `/rep/sales-leader` includes that leader row once because the hierarchy resolver includes the caller. Add a field-manager-only leader with one salesperson report and an assigned target to expose the manager-ID query omission, plus a second field manager with no reports and a configured target to exercise the empty-team branch. Add a request narrowed to an out-of-tree salesperson and assert the existing denial status. Keep the ordinary salesperson 403 and existing permitted-tree assertion.

Extend existing fixture teardown only for created sessions, targets, orders/items, retailers, sales reps, and managers; retain the loopback/test-database and local-storage preconditions.

- [ ] **Step 3: Run both regressions and confirm the manager-target failures**

Run from `backend/`: `npm test -- --run src/modules/readmodels/__tests__/salesLeaderService.test.ts`

Then run against the disposable local environment: `DOTENV_CONFIG_PATH=.env.test.local NODE_OPTIONS='-r dotenv/config' npm test -- --run src/modules/readmodels/__tests__/performanceIntegration.test.ts`

Expected: query-union and manager-target assertions fail on the current read model; the zero-report target fails through the empty-team path. Existing authorization and personal-performance behavior continues to pass, with the caller appearing only once when their linked Salesperson record is in resolver scope.

### Task 3: Repair Sales-Leader Targets and Structured Read Model

**Files:**
- Modify: `backend/src/modules/readmodels/salesLeaderService.ts`
- Test: `backend/src/modules/readmodels/__tests__/salesLeaderService.test.ts`
- Test: `backend/src/modules/readmodels/__tests__/performanceIntegration.test.ts`

**Interfaces:**
- Consumes: `SalesTrigger.facts` from Task 1 and the failing regression contracts from Task 2.
- Produces: unique target query IDs from reportees plus `managerStaffId`; `targets.assigned` and empty-team summary retain the manager's current-period order-value target; risk/recommendation entries carry stable codes and typed values for the Rep renderer.
- Does not change: `LeaderMember` reportee scope, canonical actual calculation, ranking membership, risk thresholds, action ordering, or team opportunity selection.

- [ ] **Step 1: Add failing unit assertions for structured risk and action facts**

Extend `salesLeaderService.test.ts` with one at-risk member carrying projected achievement and route facts plus one opportunity trigger carrying typed facts. Assert emitted risk reason codes/values and recommendation action/reason codes, person/store values, and trigger facts.

- [ ] **Step 2: Run the read-model unit suite to confirm the structured contract fails**

Run from `backend/`: `npm test -- --run src/modules/readmodels/__tests__/salesLeaderService.test.ts`

Expected: the newly asserted structured fields are absent.

- [ ] **Step 3: Query targets for the scoped union and preserve empty-team manager assignment**

Build a deduplicated ID list from the already-scoped `people` plus the explicitly supplied `managerStaffId`. Apply the existing period-overlap predicate unchanged. Compute the manager's assigned order-value total from those rows before constructing an empty-team response. Keep reportee rollup and manager assignment separate; use the manager target for the existing summary target semantics when present.

- [ ] **Step 4: Add structured risk/recommendation fields and preserve existing response fields**

Represent projected-achievement, route-completion, and absent-attendance reasons with code/value objects. Add an action/reason code and typed trigger facts to generated opportunity recommendations, preserving existing text fields for compatibility. Do not change generated facts, conditions, priority, or ranking behavior.

- [ ] **Step 5: Run service and authenticated integration regressions**

Run from `backend/`: `npm test -- --run src/modules/readmodels/__tests__/salesLeaderService.test.ts`

Then run the disposable local PostgreSQL test: `DOTENV_CONFIG_PATH=.env.test.local NODE_OPTIONS='-r dotenv/config' npm test -- --run src/modules/readmodels/__tests__/performanceIntegration.test.ts`

Expected: unique scoped target reads, no-report target readback, ordinary salesperson denial, in-tree-only leader scope, leader personal-performance continuity, and typed risk/opportunity facts all pass. Verify every new fixture is removed.

- [ ] **Step 6: Commit read-model and authenticated regression changes**

```bash
git add backend/src/modules/readmodels/salesLeaderService.ts backend/src/modules/readmodels/__tests__/salesLeaderService.test.ts backend/src/modules/readmodels/__tests__/performanceIntegration.test.ts
git commit -m "fix: retain manager targets in team performance"
```

### Task 4: Build Pure Rep Presentation and EN/HI Mappings

**Files:**
- Create: `rep/src/screens/teamPerformancePresentation.ts`
- Create: `rep/src/screens/__tests__/teamPerformancePresentation.test.ts`
- Modify: `rep/src/screens/TeamPerformanceScreen.tsx`
- Modify: `rep/src/i18n/translations.ts`
- Test: `rep/src/i18n/__tests__/translations.test.ts`
- Preserve unchanged: pre-existing untracked `rep/src/screens/teamPerformancePresentation.test.ts`

**Interfaces:**
- Produces: `teamSalesSummary({ actual, target, completionPct })`, returning `{ actual, target, completionPct }` with target/progress null unless target is positive; `selectTeamPerformancePresentation(data, t)`, a pure view-model selector for team/member summaries, attendance labels, ranking metric labels, unavailable projection reasons, risk reasons, and recommendation action/reason copy.
- Consumes: typed risk/recommendation codes and trigger facts from Task 2, plus `TranslationKey` and the existing `(key, vars) => string` translator.

- [ ] **Step 1: Add failing pure presentation and translation tests**

Keep the user-owned test untouched. Add a tracked selector test covering: absent/zero/negative targets with nonzero actual; exact supplied percentage with positive target; all five known attendance states plus unknown; order-value ranking label; each projection-unavailable condition (no selling days, period not started, too early); each risk code; and all trigger/action codes with both numeric and category facts in EN/HI. Assert selector output is based on structured codes/values even when raw English fields are deliberately different.

```ts
expect(teamSalesSummary({ actual: 18400, target: 0, completionPct: 0 })).toEqual({
  actual: 18400,
  target: null,
  completionPct: null,
});
```

- [ ] **Step 2: Run the pure Rep tests and confirm the missing-helper failure**

Run from `rep/`: `npm test -- src/screens/teamPerformancePresentation.test.ts src/screens/__tests__/teamPerformancePresentation.test.ts src/i18n/__tests__/translations.test.ts`

Expected: the pre-existing helper import and new presentation cases fail before implementation.

- [ ] **Step 3: Implement the pure presentation selector, bind the screen, and add EN/HI keys**

Implement summary normalization and the pure `selectTeamPerformancePresentation(data, t)` selector without inspecting generated English fields. Use existing `translate` interpolation variables for values, `inr`/numeric formatting conventions for money, and direct category/person/store values where appropriate. Add paired English/Hindi translation keys for known attendance states, ranking metrics, projection reasons, risk facts, opportunity reasons, and next actions. Update `TeamPerformanceScreen.tsx` to render the selector output, keep actuals visible without target, and retain its current loading/error/refresh/empty states.

- [ ] **Step 4: Run the focused Rep tests**

Run from `rep/`: `npm test -- src/screens/teamPerformancePresentation.test.ts src/screens/__tests__/teamPerformancePresentation.test.ts src/i18n/__tests__/translations.test.ts`

Expected: the untouched user-owned test and all new pure presentation/localization cases pass.

- [ ] **Step 5: Commit helper and locale coverage**

```bash
git add rep/src/screens/teamPerformancePresentation.ts rep/src/screens/__tests__/teamPerformancePresentation.test.ts rep/src/i18n/translations.ts rep/src/i18n/__tests__/translations.test.ts
git commit -m "feat: localize team performance facts"
```

### Task 5: Full Local Verification and Boundary Check

**Files:**
- No new product files; run verification only.

**Interfaces:**
- Verifies all Tasks 1-5 without changing the target, permission, schema, or release boundaries.

- [ ] **Step 1: Run the backend focused suites together**

Run from `backend/`: `npm test -- --run src/modules/intelligence/__tests__/triggerDomain.test.ts src/modules/readmodels/__tests__/salesLeaderService.test.ts src/modules/readmodels/__tests__/performanceIntegration.test.ts`

Expected: all focused suites pass against the disposable local PostgreSQL setup.

- [ ] **Step 2: Run backend typecheck and build**

Run from `backend/`: `npm run typecheck` and `npm run build`.

Expected: both pass without schema generation or migration.

- [ ] **Step 3: Run the full backend suite**

Run from `backend/` with local test configuration: `DOTENV_CONFIG_PATH=.env.test.local NODE_OPTIONS='-r dotenv/config' npm test`

Expected: the complete suite passes; confirm the new integration fixture residue is zero.

- [ ] **Step 4: Run the full Rep suite and typecheck**

Run from `rep/`: `npm test` and `npm run typecheck`.

Expected: the previously untracked user-owned helper test now passes; no existing Rep test is excluded.

- [ ] **Step 5: Verify scope and working-tree preservation**

Run `git status --short`, `git diff --check`, and `git diff --stat`. Confirm there is no schema/migration change, no Admin route or role/permission change, the modified forensic audit remains as found, and `GAGAN_PRODUCT_GOAL.md` plus the original untracked presentation test remain present and unmodified.

- [ ] **Step 6: Report local evidence separately from release gates**

Record passing tests/typechecks/builds and any exact blocker. Keep hosted runtime, authenticated browser, APK source identity, and physical-device acceptance marked NOT RUN unless independently performed against the authorized exact source.
