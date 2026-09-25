# Gagan Selling Sales Leader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a selling Sales Leader a full personal Salesperson plus an authorized, report-only Team workspace, with explicit PERSONAL/TEAM targets on the existing model.

**Architecture:** Keep one `StaffUser`, one linked `SalesRep`, the existing rep and leader APIs, and server-resolved hierarchy scope. Add a scope discriminator to `SalesTarget`; personal readers and achievements use PERSONAL, while Team uses an assigned TEAM target or a unique-report PERSONAL rollup. Admin provisions dual roles, link, and hierarchy atomically; Rep composes the existing personal app with a separately loading Team destination.

**Tech Stack:** TypeScript, Express, Prisma/PostgreSQL 18, React/Vite Admin, React Native/Expo Rep, Vitest, Android Gradle/ADB.

**Spec:** `docs/superpowers/specs/2026-09-25-gagan-selling-sales-leader-design.md`

## Global Constraints

- Work in the existing Gagan worktree on `main`; no new branch, worktree, clone, duplicate target model, or manager app. Preserve `stash@{0}` and all unrelated work.
- Do not edit any of the 52 applied migrations. The installed Salesperson package is `com.gagan.sales.review`, code 25; the eventual replacement must have a higher code, the same compatible signer, and a source-attested exact main SHA.
- No hosted migration, backfill, identity/role/hierarchy write, deployment, APK installation, or tag is approved by this planning request. Stop for a separate hosted-mutation approval.
- Team excludes only the requesting leader. A subordinate selling leader is one report member; never add nested team aggregates. Team target is assigned TEAM `order_value` if present, else the sum of unique permitted reports' PERSONAL `order_value` targets. Never sum assigned and rollup.
- Preserve existing metrics, supported targets, period overlap, revision semantics, permissions, EN/HI structured reasons, accepted TEAM-01 responsive behavior, and historical rows. Collection remains separately authorized.
- Planning-time read-only staging evidence: R's workspace `tea-dajvdg0ae00c73bi74c0`, `gagan-staging-db` `dpg-dajvi2h5efls73ags3f0-a`; Deepak owns no September target, Ravi's legacy `order_value` row `cbcc647a-50fe-4cbb-84c2-891744786c09` is `₹4,00,000`. Reverify before any hosted action; this is not a completed historical classification.

### Local execution safety amendment

The approved local implementation found that Render's current start command is
`npx prisma migrate deploy && npm start`. Consequently the final contract SQL
is deliberately held at `backend/prisma/held_migrations/20260925160000_sales_target_scope_constraints/migration.sql`,
not in the active Prisma migration directory described by Tasks 1, 8 and 10.
The active expansion is migration 53; the held contract was rehearsed manually
on disposable PostgreSQL and does not add a ledger row yet. A separately
approved cutover must finish approved mapping/backfill, run the held contract,
then promote and record its migration under a controlled source/ledger step
before deploying the final application. Do not start the final application
against unclassified nullable rows simply because expansion succeeded. This
amendment is stricter than the task sequence below and overrides only the
contract-file location and activation timing; all no-hosted-write boundaries
remain unchanged. The row-level proposal and identity evidence are recorded in
`docs/GAGAN_SELLING_LEADER_CUTOVER_DECISION_PACK.md`.

## Review Focus

1. Two SalesRep rows share Deepak's normalized phone: Admin setup must abort without linking or creating a third row (Task 5).
2. A subordinate selling leader has reports: the parent Team counts that subordinate's own activity once, not their nested Team total (Task 3).
3. An old Admin POST omits scope for a dual-role manager: return `target_scope_required`, never overwrite PERSONAL or TEAM (Task 2).
4. A pre-cutover Today cache contains a target and `achievements.new`: the new APK must not present that snapshot or replay its celebration (Task 4).
5. A target row changes after dry-run mapping: backfill must reject the entire batch on fingerprint mismatch (Tasks 1 and 9).

## File Map and Interfaces

- `backend/prisma/schema.prisma` plus two **new** migrations: expansion adds nullable `SalesTarget.scope` and retains old uniqueness; constraint stage requires scope and replaces uniqueness with `(salespersonId, scope, metric, periodStart, periodEnd)`.
- `backend/scripts/auditSalesTargetScope.ts` and `backfillSalesTargetScope.ts`: read-only mapping report and guarded transaction that changes **only** scope after exact row/fingerprint coverage. Mapping input is an approved external JSON artifact, not a guessed role-based rule.
- `backend/src/modules/performance/targetScope.ts`: `TargetScope = "PERSONAL" | "TEAM"`, scoped query helpers, and `resolveLegacyTargetScope(ownerIdentity, ownerRoles)` returning PERSONAL only for a freshly verified ordinary salesperson or throwing `target_scope_required`.
- Existing `TargetService`, `FieldDashboardService`, `RankingService`, `SalespersonTodayService`, `SalesLeaderService`, `fieldAdminRoutes`, and `performanceRoutes` consume those scoped rules. `AchievementService` and its existing dedupe key remain one engine.
- `staffManagementService`, `adminStaffRoutes`, `staffAppAccess`, `/rep/me`, and OTP response add one atomic selling-leader setup and a server-derived workspace state; `HierarchyService` validation/audit is reused within the same transaction.
- Rep navigation, Today, Team Performance, new `TeamMemberDetailScreen`, identity context, and operational cache use that server state. Admin Staff/FieldPlanning screens make setup and target scope explicit.

---

### Task 1: Evidence Audit and Additive Target Expansion

**Files:** Modify `backend/prisma/schema.prisma`; create `backend/prisma/migrations/20260925150000_sales_target_scope_expand/migration.sql`, `backend/prisma/migrations/20260925160000_sales_target_scope_constraints/migration.sql`, `backend/scripts/auditSalesTargetScope.ts`, `backend/scripts/backfillSalesTargetScope.ts`, `backend/src/modules/performance/__tests__/targetScopeMigration.test.ts`, and `backend/src/modules/performance/__tests__/targetScopeMigration.pg.test.ts`.

**Interfaces:** Produce `TargetScopeMappingEntry = { targetId, ownerId, metric, periodStart, periodEnd, targetValue, createdByStaffId, scope, evidence }`. The backfill accepts only an exact, approved full-row mapping plus a pre-change fingerprint; `--dry-run` is its default.

- [ ] Write failing tests: eight fixture rows include one ambiguous row; audit emits every ID and evidence field, marks ambiguity, and never changes DB state. Backfill rejects missing/extra IDs, changed amount/period/owner/creator, duplicate mappings, and any ambiguous entry, leaving every row unchanged.
- [ ] Run `cd backend && npm test -- src/modules/performance/__tests__/targetScopeMigration.test.ts`; confirm the new tests fail for missing audit/backfill behavior.
- [ ] Add nullable enum-backed `scope` with **no default** and keep the existing unique key in the expansion migration. Implement the audit and a guarded backfill transaction that locks/re-reads all target IDs, compares the approved fingerprints, updates only `scope`, and asserts exact row counts before commit. Example invariant:

  ```ts
  if (mapping.length !== rows.length || rows.some((row) => !matchesApprovedFingerprint(row, mapping))) {
    throw new Error("target_scope_mapping_drift");
  }
  if (mapping.some((entry) => !entry.scope || !entry.evidence)) throw new Error("target_scope_unresolved");
  ```

- [ ] Run the focused tests, `npx prisma validate`, and `git diff --check`. Commit **only** expansion schema/migration and the guarded audit/backfill tooling; record this expansion commit SHA for the later source-attested stage. Do not run either script against hosted DB.
- [ ] Write a failing PostgreSQL upgrade test: from the 52-migration schema with seeded legacy targets, expansion alone permits nullable scope, an approved full mapping updates only scope, and contract rejects null/duplicate scoped rows; from an empty database, both migrations succeed. Run the test red on disposable local PostgreSQL.
- [ ] Add the constraint migration and final Prisma schema (`scope` required, unique key includes scope). Its SQL checks for remaining nulls, drops the old no-scope unique constraint, creates scoped uniqueness, and sets NOT NULL without changing target IDs/values/periods/creator/references. Run the upgrade/fresh tests green and `npx prisma generate`; commit this second migration separately. Tasks 2-7 now compile against the final scoped Prisma selector, while the earlier expansion commit remains addressable for hosted stage one.

### Task 2: Scoped Target Writes and Legacy Admin Compatibility

**Files:** Create `backend/src/modules/performance/targetScope.ts` and `admin/src/pages/__tests__/FieldPlanning.test.tsx`; modify `backend/src/modules/field/fieldAdminRoutes.ts`, `admin/src/pages/FieldPlanning.tsx`, `admin/src/api.ts`; extend `backend/src/modules/field/__tests__/fieldAdminRoutes.test.ts`.

**Interfaces:** New target POST includes `scope: "PERSONAL" | "TEAM"`. GET explicitly requests `scope=PERSONAL|TEAM|all`; legacy GET without scope returns PERSONAL-only. Legacy POST without scope maps to PERSONAL only when the owner is a verified salesperson with no manager role; otherwise 409 `target_scope_required`.

- [ ] Write failing route tests for same owner/metric/period in both scopes, independent updates, duplicate same-scope protection, unsupported metric/overlap unchanged, legacy ordinary-personal success, and legacy manager/ambiguous 409 with no row write.
- [ ] Run `cd backend && npm test -- src/modules/field/__tests__/fieldAdminRoutes.test.ts`; confirm the new cases fail for missing scope handling.
- [ ] Implement `resolveLegacyTargetScope` using freshly read owner identity and roles, and make Admin's new form send an explicit scope. Keep permission and reporting-scope checks before any write. Use the scoped unique key introduced at the end of Task 1; target writes remain quiesced during the later hosted migration/backfill window.

  ```ts
  const scope = body.scope ?? resolveLegacyTargetScope(ownerRoles);
  if (scope === "TEAM" && !ownerRoles.includes("field_manager")) throw new TargetScopeError("team_owner_required");
  // Upsert key: salespersonId_scope_metric_periodStart_periodEnd.
  ```

- [ ] Run focused backend and Admin tests; verify GET/POST behavior through authenticated local PostgreSQL routes. Commit the scoped contract and UI separately from migration files.

### Task 3: Report-Only Team Read Model and Authorization

**Files:** Modify `backend/src/modules/readmodels/salesLeaderService.ts`, `backend/src/modules/performance/performanceRoutes.ts`, `backend/src/modules/performance/rankingService.ts`; extend their existing tests and authenticated PostgreSQL route tests.

**Interfaces:** `/rep/sales-leader` retains its existing shape, adding only member role/status metadata needed by detail. `targets.assigned` is the manager's TEAM target or null; `targets.rollup` is unique reports' PERSONAL targets. `team.target = assigned ?? rollup`. Member narrowing rejects self/outside-tree.

- [ ] Write failing tests with a parent leader, a subordinate selling leader, that subordinate's report, and an unrelated rep. Assert each in-scope person contributes only their own orders/visits once; the parent never contributes to their own Team. Assert assigned TEAM wins without addition, rollup fallback works, zero-report assigned TEAM remains, targetless actuals remain, and ordinary salesperson/self/outside-tree routes are denied.
- [ ] Run `cd backend && npm test -- src/modules/readmodels/__tests__/salesLeaderService.test.ts src/modules/performance/__tests__/ranking.test.ts`; confirm the new cases fail.
- [ ] Filter the **requesting** staff ID at the leader read-model boundary, including org-wide scope; keep generic `ScopeResolver` unchanged. Batch actuals on unique report StaffUser/SalesRep pairs; filter member target/rank reads to PERSONAL and manager assigned reads to TEAM. Do not use any member's TEAM row or nested summary in the parent total.

  ```ts
  const reports = staff.filter((person) => person.id !== managerStaffId);
  const assigned = teamTargetFor(managerStaffId, period);
  const rollup = sumUniquePersonalOrderValueTargets(reports, period);
  const target = assigned ?? rollup;
  ```

- [ ] Run focused tests and the authenticated route test. Confirm a synthetic Deepak/Ravi fixture remains `452651 / 400000 / 113%` after only Deepak's SalesRep link is added. Commit the read-model and authorization change.

### Task 4: Personal Readers, Achievements, and Offline Cache

**Files:** Modify `backend/src/modules/performance/targetService.ts`, `backend/src/modules/field/dashboardService.ts`, `backend/src/modules/performance/rankingService.ts`, `backend/src/modules/readmodels/salespersonTodayService.ts`, `rep/src/offline/operationalReadCache.ts`, `rep/src/context/FieldContext.tsx`; extend existing target, achievement, Today, and cache tests.

**Interfaces:** Every personal target query filters `scope: "PERSONAL"`; canonical actuals are unchanged. `SalespersonTodayService` passes only PERSONAL progress to the existing achievement engine and returns `targetScopeVersion: 2`. Keep `achievementDomain.dedupeKeyFor` byte-for-byte compatible. The new Rep cache rejects an old Today snapshot without clearing route/outbox data.

- [ ] Write failing tests: PERSONAL and TEAM same-period rows coexist, but Today/personal ranking/headline/achievement use only PERSONAL; missing PERSONAL remains unconfigured; TEAM 100% triggers no personal celebration or dedupe write; existing personal dedupe key prevents replay. Add an old-cache test with `achievements.new` that must not reappear after cache-version transition while route/outbox survives.
- [ ] Run `cd backend && npm test -- src/modules/performance/__tests__/targetService.test.ts src/modules/performance/__tests__/achievements.test.ts`; run `cd rep && npm test -- src/offline/__tests__/operationalReadCache.test.ts`; confirm new cases fail.
- [ ] Apply PERSONAL filters to every target lookup in the personal Today/performance/ranking paths. Leave achievement candidate/dedupe algorithms unchanged; remove TEAM rows before evaluation. Require `targetScopeVersion === 2` for a Today payload and validate cached payloads before fallback (currently `loadOperationalRead` trusts a cached cast); reject/clear only the invalid Today snapshot, not the route snapshot or outbox.
- [ ] Re-run focused tests and inspect every `salesTarget.findMany` and target cache path with `rg -n 'salesTarget|targetsFor|storedTargets|achievements.record|operationalCache' backend/src rep/src`. Commit only after each personal reader has a scope test.

### Task 5: Capability Contract and Atomic Admin Provisioning

**Files:** Modify `backend/src/modules/identity/staffAppAccess.ts`, `staffManagementService.ts`, `adminStaffRoutes.ts`, `backend/src/modules/org/hierarchyService.ts`, `backend/src/routes/rep.ts`, and their tests. Keep `StaffUser`, `SalesRep`, and `StaffRole` as the only identity tables.

**Interfaces:** Add `workspaceMode: "sales" | "sales_leader" | "manager_only" | "setup_required" | "access_only"` to login and `/rep/me`, with direct role names and an explanatory setup code. Add one `POST /admin/staff/:id/selling-leader-setup` (and equivalent new-staff path if needed) requiring `staff.manage` plus `org.manage` for hierarchy changes.

- [ ] Write failing capability tests for salesperson-only, dual-role valid, manager-only, missing/invalid link, suspended, and stale role claims. Add Admin transaction tests for existing/new staff, exact linked reuse, two phone matches, name-only collision, link owned by another staff, concurrent promotion, hierarchy cycle, and a failure after role assignment: each failure leaves link/roles/hierarchy/audit unchanged.
- [ ] Run `cd backend && npm test -- src/modules/identity/__tests__/staffAppAccess.test.ts src/modules/identity/__tests__/staffManagementService.test.ts src/modules/identity/__tests__/adminStaffRoutes.test.ts`; confirm new cases fail.
- [ ] Implement one serializable transaction: lock/re-read staff and candidate SalesRep rows; use an already valid link or one unique verified canonical contact match; create only when collision-free; link; upsert both roles; validate hierarchy and append manager-change audit in the same transaction. Treat a serialization conflict as a whole-operation failure or bounded retry with fresh identity revalidation, never as permission to create a second rep. Do not call `HierarchyService.setManager` if it opens a separate transaction. Require an explicit Admin choice for manager-only. Existing role-removal endpoints change only roles, preserving link and history.

  ```ts
  await prisma.$transaction(async (tx) => {
    const staff = await lockAndValidateStaff(tx, staffId);
    const rep = await resolveOneVerifiedSalesRep(tx, staff);
    await tx.staffUser.update({ where: { id: staff.id }, data: { salesRepId: rep.id } });
    await assignRolesAndReportingLineWithAudit(tx, staff, input, actorStaffId);
  }, { isolationLevel: "Serializable" });
  ```

- [ ] Return server-derived roles/workspaceMode from OTP and `/rep/me`. Keep `requireRep` and every personal route authoritative; Team-only permission never supplies another rep ID. Run focused tests and authenticated PostgreSQL rollback tests. Commit.

### Task 6: Rep Navigation, Personal Home, and Member Detail

**Files:** Modify `rep/App.tsx`, `rep/src/auth/staffCapabilities.ts`, `rep/src/context/RepContext.tsx`, `rep/src/screens/TodayScreen.tsx`, `TeamPerformanceScreen.tsx`, `RepAccountScreen.tsx`, `rep/src/i18n/translations.ts`; create `rep/src/screens/TeamMemberDetailScreen.tsx` and focused tests.

**Interfaces:** For `workspaceMode=sales_leader`, tabs are Home/Outlets/Reports/Team/More; Team is one nested destination with Team Performance and detail. `Team Today` fetches `repApi.salesLeader()` separately from the personal Today request. Detail accepts only `staffId` as a view filter; it never writes to `RepContext.rep`, active retailer, cart, or auth storage.

- [ ] Write failing navigation tests for the four workspace modes and Team gating. Write presentation tests proving personal Home renders when Team API rejects/times out, personal empty target is not replaced by TEAM target, and the existing Team summary/KPI/EN/HI ranking remains intact. Write a detail test asserting selecting a member does not change `rep`, `activeRetailerId`, cart, or subsequent own order/visit request identity.
- [ ] Run `cd rep && npm test -- src/auth/__tests__/staffCapabilities.test.ts src/screens/__tests__/teamPerformancePresentation.test.ts src/screens/__tests__/teamMemberLayout.test.tsx`; include the new navigation/Home/detail test files and confirm their red state.
- [ ] Use server `workspaceMode` for tab composition, existing permissions for individual routes, and a nested Team stack. Render a compact independently loaded Team Today section after personal Home content, with localized loading/empty/error states and no dependency in the personal refresh path. Member detail renders only server-returned scoped member fields; no impersonation or speculative manager action controls.
- [ ] Re-run focused tests and inspect Android 411dp/narrow simulated layouts at normal and 1.3 font scale; ensure bottom-tab safe-area metrics and prior KPI/rank fixes are unchanged. Commit.

### Task 7: Admin Guided Setup and Explicit Target Scope UI

**Files:** Modify `admin/src/pages/Staff.tsx`, `StaffDetail.tsx`, `FieldPlanning.tsx`, `admin/src/staffTypes.ts`, `admin/src/api.ts`; extend their existing tests.

**Interfaces:** Staff detail has explicit Selling Sales Leader and Manager only actions, with final identity/roles/hierarchy readback. Target form labels PERSONAL versus TEAM and always sends scope. A legacy unscoped manager target write shows `target_scope_required` rather than a success notice.

- [ ] Write failing UI tests: a dual-role missing-link staff member sees setup required; ambiguous SalesRep matching shows an error and no success; a successful setup readback displays one link and both roles; manager-only remains explicit; the target form sends PERSONAL or TEAM and does not imply collection authority.
- [ ] Run `cd admin && npm test -- src/pages/__tests__/Staff.test.tsx src/pages/__tests__/FieldPlanning.test.tsx`; confirm the new cases fail.
- [ ] Add the guided form and result state while reusing existing Staff and Sales organisation patterns. Make direct salesperson-role assignment route through guided setup when no valid link. Keep hierarchy selection explicit and show the existing direct reports before a save; never reassign retailers or routes. Add scope control to the existing target form, not a second target page/model.
- [ ] Re-run focused tests, `npm run typecheck`, and `npm run build` in `admin`. Commit.

### Task 8: Final Migration and Upgrade Rehearsal

**Files:** Revisit the two migrations and PostgreSQL test created in Task 1; modify only if the rehearsal exposes a defect.

**Interfaces:** The already-authored constraint migration rejects any remaining null scope, drops old no-scope uniqueness, adds scoped uniqueness, and sets scope NOT NULL. It never changes IDs, values, periods, creator, or references.

- [ ] Re-run the Task 1 PostgreSQL upgrade test from the actual 52-migration schema: apply only expansion, test mapping drift rejection, run approved dry-run and backfill on the disposable DB, then apply constraint. Assert exact row fingerprints apart from `scope`, same-scope duplicate rejection, and same-period cross-scope coexistence. Separately apply all migrations to an empty disposable PostgreSQL database. Use `DATABASE_URL` only for disposable local databases.
- [ ] Verify migration ledger order, `npx prisma validate`, `npm run typecheck`, and `npm run build` in `backend`; search for the old `salespersonId_metric_periodStart_periodEnd` upsert selector. If a defect appears, write a failing regression first, fix the new migration or code before any hosted application, rerun both DB paths, and commit the focused correction.

### Task 9: Full Local Verification and Source Freeze

**Files:** Tests/docs from Tasks 1-8 only; do not edit release manifest or APK yet.

- [ ] Run backend full `npm test`, `npm run typecheck`, `npm run build`; Admin full `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`; Rep full `npm test`, `npm run typecheck`, and `npx expo export --platform web --output-dir /tmp/gagan-selling-leader-web-export`. Run `git diff --check` and read the complete branch diff against the pre-feature main SHA.
- [ ] Verify the fresh and 52-migration upgrade PostgreSQL tests, RBAC negative routes, all target-scope cases, old Admin request behavior, unchanged PERSONAL achievement dedupe keys, and no old Today cache replay. Record exact counts and failures; fix any failure before a completion claim.
- [ ] Commit any final focused corrections on `main`; push main normally, record final SHA and the Task 1 expansion SHA; confirm a clean tree and `origin/main` equality. **STOP:** these source steps do not authorize a hosted migration/backfill or Deepak identity mutation.

### Task 10: Hosted Expansion, Backfill, Constraint, and Backend Deploy (Separate Approval Required)

**Files/artifacts:** Approved external row-mapping JSON and dry-run evidence, recovery/export evidence, exact-SHA migration logs. Do not modify applied migration files.

- [ ] Obtain explicit fresh approval for hosted mutation. Reconfirm Render account/workspace `tea-dajvdg0ae00c73bi74c0`, DB `dpg-dajvi2h5efls73ags3f0-a`, `gagan-api` service, current deployed SHA, and clean 52-row migration prefix. Record the exact PITR window/latest usable point and verify a fresh logical export before writing.
- [ ] Re-run the **read-only** target audit. Produce a mapping row for every current target ID with owner/metric/period/value/creator, proposed scope, evidence, and ambiguity. Have every ambiguous row explicitly resolved and approve the mapping hash; compare it with the planning-time eight-row snapshot but do not assume the snapshot is still current. Agree on an enforceable target-write quiescence mechanism and a short cutover window before continuing.
- [ ] Apply only the expansion migration from the recorded Task 1 commit artifact (for example, `git archive <expansion-SHA> backend/prisma` into a temporary non-Git source archive, then run Prisma migrate deploy against that archived schema). Verify exactly the expected new migration ledger row and nullable scope without any target-value change.
- [ ] With writes quiesced, run the guarded backfill in dry-run, verify fingerprint/row coverage and approved hash, then run its explicit apply mode. Read back each row ID/scope and prove every non-scope field is unchanged. Any drift or ambiguity aborts before partial activation.
- [ ] Apply only the reviewed constraint migration from final main, validate NOT NULL and scoped uniqueness, then deploy **exact final main SHA** to the existing `gagan-api` service. Do not reopen target writes until the API is healthy and old/new Admin write behavior passes. Verify `/health`, `/health/live`, `/health/ready`, authenticated personal/Team routes, and the unchanged report-only Deepak fixture. No application-code-only rollback is claimed once both scopes exist; use the verified recovery/export and a separately approved recovery decision if the data contract fails.

### Task 11: Deepak Provisioning, Physical APK, and Release Tag (Separate Approval Required)

- [ ] On the exact authorized staging account, read back Deepak's StaffUser, approved phone, SalesRep candidates, roles, hierarchy, target rows, and no own retailer/route assignment. Abort ambiguous identity matches. Use the atomic Admin action to link/create one SalesRep and assign both roles without fabricated orders, visits, collections, or targets; preserve Ravi's reporting line.
- [ ] Authenticated hosted tests: Deepak personal Home/My Day/Outlets/routes use only his own context; Team still shows Ravi report actual/target/113% when underlying data is unchanged; ordinary rep gets Team 403; unrelated/self Team member IDs denied; old unscoped Admin manager target write rejected. Verify collection remains unauthorized unless separately granted.
- [ ] Build an exact-final-main-SHA Salesperson APK with versionCode > 25, staging API, and the existing compatible signing certificate; verify package/version/hash/signer/embedded SHA before `adb install -r`. Do not uninstall or clear data. On the Moto E13, check personal-first Home, My Day, Outlets, Reports, Team, More, EN/HI, 1.3 font, gesture and 3-button safe areas, KPI/rank, and own-versus-Team identity after viewing a member. Request exact approval before assigning any own retailer/route if physical workflow requires it.
- [ ] Only after hosted and physical acceptance, update the scoped release manifest, copy the exact accepted APK, verify its hash, and create/push a **new** `gagan-unified-client-v2` tag at final main SHA. Never move v1. Report source/build, hosted, device, and full unified-pair readiness as separate claims.

## Decisions Still Open Before Hosted Mutation

1. Approve the per-row historical scope mapping from a fresh dry run. Current read-only staging has eight rows and no Deepak-owned target; Ravi's `₹4,00,000` legacy row is used in the report-target rollup, not an assigned Deepak TEAM row. None of the eight rows is pre-classified merely by this plan.
2. Choose and verify the target-write quiescence mechanism for the expansion/backfill/constraint window; a verbal instruction to avoid the Admin page alone is insufficient if other writers remain active.
3. Confirm whether Deepak has zero, one, or ambiguous exact-identifier SalesRep candidates at provisioning time and approve creation/reuse only after that readback. Similar names never resolve identity.
4. Accept the bounded stale-offline-Today behavior of older APKs (their local 12-hour cache cannot be remotely invalidated) or require an operational upgrade notice/minimum supported build. The new APK invalidates its old Today cache without clearing route/outbox.
5. Authorize hosted migration/backfill and later Deepak setup as separate writes after the source, recovery, mapping, and compatibility evidence is reviewed. This planning approval is not that authorization.
