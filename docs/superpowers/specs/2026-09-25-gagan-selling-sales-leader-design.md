# Gagan Selling Sales Leader Design

Status: architectural design for review. No implementation, hosted mutation, APK, or release action is authorized by this document alone.

## Outcome and Decision

A selling Sales Leader uses the full existing Salesperson app for their own work and gains Team management on top. One active `StaffUser` has the existing `salesperson` and `field_manager` roles and exactly one valid `StaffUser.salesRepId` link. Personal operations use that linked SalesRep and the leader's authenticated StaffUser; Team reads use field-manager permission plus the permitted reporting tree. A manager-only account remains possible only as an explicit `field_manager`-without-`salesperson` configuration. No second manager app, manager-salesperson identity, sales model, or team endpoint is introduced.

This product decision intentionally supersedes the linked-manager inclusion statement in `2026-09-25-gagan-team-01-design.md`: the leader is **excluded** from Team members, totals, counts, rankings, report visits, and report actions. The manager's configured team target is read independently. All other accepted TEAM-01 authorization, targetless-actual, zero-report-target, structured-reason, EN/HI, KPI, leaderboard, and mobile-layout behavior remains required.

The immediate staging acceptance is Deepak Iyer, currently a `field_manager` with `salesRepId = null`. After safe provisioning, Deepak's own empty or actual Salesperson data appears in the personal workspace; the existing report-only TEAM-01 fixture remains `₹4,52,651 / ₹4,00,000 / 113%` unless the underlying report data changes.

## Source Findings and Constraints

- `rep/App.tsx` chooses Today, Outlets, and Reports from operational permissions, while a manager lacking those permissions falls through to Work/More. `StaffHomeScreen` then displays the generic no-workspace copy. Team is currently reachable from More under `performance.view_team`.
- `backend/src/lib/repAuth.ts` requires `order.create_for_retailer` and a linked `salesRepId` for ordinary rep routes. Retailer ownership is `Retailer.salesRepId`; possessing a Team permission does not grant another rep's operational identity.
- `backend/src/modules/org/scope.ts` deliberately includes the caller in a generic reporting scope. The Team read model currently selects all active linked reps in that scope. Change only the Team projection to exclude the caller; do not alter generic scope behavior used by other modules.
- `backend/src/modules/readmodels/salesLeaderService.ts` already separates `targets.assigned` from member-target rollup and preserves the manager target with zero active reports. Reuse this read model and `/rep/sales-leader` authorization.
- Admin staff creation/role assignment, SalesRep linkage, and reporting-line changes are separate today. The Admin staff screen does not expose a safe atomic selling-leader setup.
- **Proven schema exception:** `SalesTarget` has no personal/team discriminator and uniquely identifies `(salespersonId, metric, periodStart, periodEnd)`. Personal Home and the Team read model both read that same staff-owned row. Once Deepak is linked, a manager/team target can therefore appear as a personal target, and distinct personal and team targets for the same metric/period cannot coexist. A narrowly scoped discriminator on the **existing** `SalesTarget` model and a unique-key update are necessary; no duplicate target model is justified.

## Identity and Capability Contract

The server derives a workspace classification from active staff status, direct role assignments, a valid SalesRep link, and current effective permissions. Login and `/rep/me` return an additive, server-confirmed workspace status and the role information needed to explain setup errors. The app uses that response for navigation, but every backend route continues to enforce its own permission, identity, and scope. Cached UI state never authorizes a request.

| Configuration | App behavior |
|---|---|
| `salesperson`, valid SalesRep, operational permissions | Existing full Salesperson app; no Team without Team authorization |
| `salesperson` + `field_manager`, valid SalesRep, operational and Team permissions | Full Salesperson app plus Team |
| `field_manager` only, Team permission | Explicit manager-only Team/More mode, not a fake personal Salesperson context |
| `salesperson` role with missing, broken, conflicting, or unverified SalesRep link | Specific setup/configuration error; no generic blank shell or fake personal data |
| Neither operational nor Team capability | Existing access/setup state, with no unauthorized routes |

The selling-leader classification requires both direct roles; a transient delegation of one permission cannot silently turn a manager into a salesperson. Existing privileged roles retain their existing backend permission semantics. A valid link points to one existing SalesRep, belongs to no other staff member, and matches the approved canonical contact identity after normalization. The server re-evaluates capability after role/link changes; reauthentication or session refresh is required before physical acceptance if cached claims are stale.

Personal APIs always derive the caller's StaffUser and `salesRepId` from the authenticated session/database, never a team-selected employee ID. `order.create_for_retailer`, `route.execute`, attendance, visit, KYC, collection, survey, expense, issue, and other existing permissions remain independent. Field-manager role alone grants no collection or financial action. Personal retailer/order/visit/collection ownership checks are audited for the dual-role case and are not relaxed.

Team APIs continue to require `performance.view_team` (or the specific existing review permission for an operation) and server-resolved hierarchy scope. `/rep/sales-leader` filters the caller out of the report-member set before member counts, actual/visit rollups, ranking, attendance, recommendations, and member detail are computed. It still reads the caller's **team-scoped** manager target separately. A `salespersonId` filter may only narrow to a permitted report; self and out-of-tree IDs do not expose a Team member. Do not change the generic `ScopeResolver` self-inclusive contract globally.

## Target Scope and Data Migration

Add a `PERSONAL`/`TEAM` scope to the existing `SalesTarget` row and include it in the uniqueness constraint. This is one target model with two explicit meanings, not duplicated data. Personal target readers (Today, My Day/performance, personal ranking, and related target progress) read `PERSONAL`. A member's targets and leaderboard use that member's `PERSONAL` rows. The manager's assigned Team target reads their `TEAM` row. Admin target creation/editing chooses and displays the scope explicitly; a Team target is available only for an authorized manager and must not be displayed as their personal goal. Actual sales/visits/orders remain measured from canonical operational rows, independent of target presence.

Migration safety is a release gate, not an automatic role-based backfill. First obtain a fresh logical export and record the recovery point; read-only audit existing target rows, owners, periods, roles, and intended meaning. Preserve row IDs, values, creator, and history. Classify existing manager-owned rows as `TEAM` only with evidence/owner-approved mapping, including Deepak's accepted `₹4,00,000` fixture. Treat ordinary salesperson rows as `PERSONAL`; any ambiguous or dual-purpose row blocks cutover until resolved. Never infer historical meaning solely from today's role, name, or presence of a SalesRep link. Quiesce target writes for the short schema/backfill cutover, verify counts and uniqueness, and deploy the matching backend before re-enabling writes. A failed or incomplete classification blocks the Sales Leader release; it is not papered over in UI strings.

The old no-scope uniqueness cannot support simultaneous same-period personal and Team goals; update it as part of this narrowly justified migration. The implementation plan must spell out compatibility and rollback for the old backend's target upsert during cutover. No hierarchy, historical transaction, or fabricated performance row is changed by this migration.

## Navigation and Personal Home

For a selling leader, use the existing bottom navigation with one Team destination: Home, Outlets, Reports, Team, More. Normal salespeople retain their current navigation. Team is a nested Team destination containing Team Performance and member detail; the existing More shortcut navigates to that same destination rather than mounting a parallel Team experience. Manager-only users see an explicitly named manager workspace, not the generic Work/More no-workspace shell. The existing safe-area tab metrics remain authoritative; test the five-tab bar at Moto E13 width, normal and 1.3 font scale, gesture and 3-button navigation.

Home remains **personal-first**. The existing Today/Sales Companion read model and actions stay primary: own sales and target progress, My Day/attendance, route and next visit, needs attention, personal visits, outstanding-related actions, tasks, and quick actions. No team fetch is a prerequisite for Home, route, visits, Outlets, catalogue/order, or any other personal work. Add a compact Team Today section after the personal content using the existing leader read model: report-only sales, team target/achievement, active reports, visits, attendance exceptions, and existing structured risks/opportunities. Collection/outstanding team information appears only under the relevant existing permission and safe read model. The section has its own loading, empty, stale, and error states and a View Team Performance action; failure never replaces or blocks the personal dashboard.

Personal `MY SALES`, `MY TARGET`, `MY VISITS`, and orders use the leader's own context. Team `TEAM SALES`, `TEAM TARGET`, `TEAM MEMBERS`, and `TEAM VISITS` use permitted reports only. Neither presentation nor backend math silently merges them. A leader with no assigned retailers, route, or personal target sees the ordinary salesperson empty states, not the no-workspace shell. Do not create or reassign retailer/route data to make Home look populated.

### Operational parity inventory

The dual-role leader must retain the same existing personal workflows and their same backend gates as a salesperson: Home/My Day/attendance/calendar/route/next visit; assigned Outlets, search, detail, Store Intelligence, Outstanding, Schemes, service issues, and history; visit check-in, active visit, activities/outcomes/follow-up, checkout, then Next Retailer; catalogue/product/pricing/availability, Add, cart/review, order punch/detail, GST-pending treatment, and Jain/Padam routing; Add New Customer Page 1 to Page 2 and existing onboarding/KYC; tasks, expenses, leave, Market Surveys, marketing/activity evidence, and reports. Collection, payment proof, and outstanding actions remain gated by their distinct collection/financial permissions and retailer assignment. This is access parity through existing flows, not a redesign or automatic grant of every optional permission. Tests must exercise representative entry and authorization paths for each group, and unavailable physical data is reported as unavailable rather than invented.

## Team Performance and Member Detail

Retain the accepted TEAM-01 screen, responsive KPI strip, achievement math, localized attendance, rank metric, projections, and structured EN/HI risk/action reasons. Add a distinct leaderboard presentation from the existing ranking result without changing its metric or ranking algorithm. All displayed members and leaderboard entries are permitted active reports; the leader is never a Team row. Zero reports still show the configured Team target. Actual sales remain visible without a positive member or Team target, with no fabricated percentage.

Selecting a member opens a manager-scoped, read-only detail derived from the existing `/rep/sales-leader` narrowing/read model. It may show the selected member's identity, role/status, actuals, personal targets, achievement, visits, attendance, route progress, projection, rank/metric, and structured risk/opportunity facts. Add role/status metadata to the existing read model only as needed for that display. Use the selected member's fields, never the narrowed response's manager/team target as the member's personal target. Only add retailer, task, leave, expense, issue, or collection sections when an existing scoped backend read and its specific permission support them. Team operations may link to existing attendance, visit, route, task, leave, expense, or service-issue review surfaces when the manager has their specific review permission; otherwise show only supported read-only facts. Do not add dummy controls or duplicate Admin operations for this release.

Opening detail never changes the authenticated StaffUser, stored `salesRepId`, active retailer, personal cart, session token, or personal workspace. A normal order, visit, or collection started afterward remains Deepak's own action. Any future action against a report must be an explicit manager endpoint/permission with a validated target employee plus audit actor and audit target. It cannot reuse or impersonate the report's authentication context.

## Admin Selling-Leader Setup

Provide one guided action for creating or promoting a **selling Sales Leader**, backed by one audited transaction using the existing `StaffUser`, `SalesRep`, `StaffRole`, and hierarchy tables:

1. Validate or create the one StaffUser with normalized approved phone/email and active status. An existing staff identity is promoted in place; do not create a second login.
2. Reuse its already-linked SalesRep when valid. Otherwise search by canonical identifiers, including the exact normalized approved phone, and require one unlinked, conflict-free, verified match before reuse. Similar names are never linkage evidence. Multiple candidates, differing contact identity, an existing link to another StaffUser, or any ambiguity aborts the entire operation for manual resolution. If no candidate or collision exists, create exactly one SalesRep and link it. Prevent concurrent duplicate creation with transactional locking/serialization and recheck uniqueness before commit.
3. Assign both `salesperson` and `field_manager` roles, without granting `field_collector` or financial permissions. Validate the effective operational and Team permission catalog rather than assuming stale hosted role rows are correct.
4. Explicitly configure or confirm reporting hierarchy using the existing cycle checks and append-only manager-change audit. Do not silently reparent reports. Hierarchy writes and their audit events must participate in the same transaction as identity/role writes; do not call a separate transaction that could partially commit.
5. Return the final linked identity, roles, hierarchy, and workspace status for Admin readback. A failed step rolls back every step.

The Staff screen labels manager-only as an intentional alternative. Direct role assignment cannot leave a `salesperson`-role staff member with a missing SalesRep link unnoticed: route the operator through guided setup or return a clear configuration error. Role removal later changes access, not history: never cascade-delete the SalesRep, null a historical link automatically, or rewrite orders, visits, targets, collections, or reporting/audit records. A later re-promotion reuses the preserved valid identity. Territory and optional personal target are explicit setup fields; retailer/beat and collection assignments remain separate, permission-gated actions. For Deepak, preserve the existing report hierarchy and make no retailer/route assignment without separate exact approval.

## Language, Offline State, and Mobile Constraints

One selected EN/HI language drives personal Home, new Team Today/navigation/detail copy, and existing Team Performance. New Team reasons use structured codes and measurements, never English-string parsing. Audit touched personal Home text for untranslated labels; do not claim full EN/HI acceptance while the touched leader path still shows avoidable English-only state copy. Existing unrelated screens retain their current localization behavior unless a regression requires a focused fix.

The server remains the authority when cached identity/workspace data is old. An offline cached, previously confirmed personal workspace may keep ordinary offline-capable views, but an old cache cannot confer new Team or financial access. Team failure is isolated from personal state. Preserve current gesture/3-button safe-area behavior, font scaling, KPI/leaderboard wrapping, and no clipped bottom content.

## Verification and Release Gates

Tests are written before or with implementation and must cover:

1. Role/capability combinations: salesperson-only; selling dual-role with valid link; explicit manager-only; missing/invalid/conflicting link setup error; suspended staff; stale/revoked claims.
2. Admin atomicity: new and promoted staff, valid reuse, no duplicate SalesRep, name-only refusal, ambiguous/conflicting candidates, concurrent attempt, hierarchy cycle, audit completeness, full rollback, and non-destructive later role removal.
3. Personal authorization: the leader's own My Day, route, assigned Outlets/detail/intelligence/outstanding/schemes, visit lifecycle, catalogue/Add/cart/order, customer onboarding/KYC, tasks/expenses/leave/issues/surveys/activity/reports, and personal target/performance work; no access to another rep's operational endpoints through Team selection; collection/payment proof only with separate permission and assignment.
4. Team authorization: ordinary salesperson denied; permitted report visible; unrelated/self member denied; leader excluded from totals, member count, leaderboard, visits, and recommendations; manager Team target retained with zero reports; targetless actuals and positive-target math; Deepak fixture `₹4,52,651 / ₹4,00,000 / 113%` after linking.
5. Target migration/contract: audited classification, same-period PERSONAL and TEAM coexistence, all personal readers filter PERSONAL, manager read filters TEAM, row/history preservation, old/new cutover behavior, and rollback gate.
6. Rep presentation: normal and leader navigation, personal-first Home with independently failing Team Today, Team detail without session/cart/context changes, EN/HI structured meaning, KPI accessibility, rank/metric wrapping, and narrow/safe-area layouts.

Run the full affected backend suite/typecheck/build and authenticated PostgreSQL service/route tests, full Salesperson suite/typecheck/Expo export, affected Admin suite/typecheck/build, and `git diff --check`. Hosted tests must use the exact staging account/database/service identity, backup/recovery gate, and authenticated route checks; do not infer hosted acceptance from local results.

After local tests pass, commit/push the focused implementation directly to `main`. Then verify the exact hosted workspace/service/database, recovery point, and fresh logical export; apply only the reviewed migration and approved target classification under the cutover controls above; deploy the exact new main SHA because the backend changes; and perform hosted own-vs-team and existing-feature regression. Only after backend compatibility passes, build a source-attested Salesperson APK at a versionCode above the installed code 25. Install in place on the Moto E13 without uninstalling or clearing data. Log in as Deepak and physically verify personal Home, My Day, Outlets, Reports, Team, More, personal empty states, preserved Team fixture, EN/HI, 1.3 font scale, gesture/3-button safe areas, and continued own-identity actions. Do not fabricate orders, visits, collections, targets, or retailer/route assignments. If a specific own retailer/route assignment is needed, stop for exact approval. Create a **new** tag such as `gagan-unified-client-v2` only after all gates pass; never move `gagan-unified-client-v1`.

## Non-Goals and Stop Conditions

- No separate manager app, parallel Team endpoint, duplicate SalesRep/target/sales tables, broad Admin duplication, role-wide collection grant, reporting-scope expansion, impersonation, or unrelated dashboard redesign.
- No staged or production mutation during design/spec review. Hosted identity ambiguity, unclear legacy target classification, ambiguous SalesRep match, missing recovery/export, or incomplete backend compatibility is a stop gate rather than permission to guess.
- Team member management beyond existing explicit permissions and audited endpoints is not implied by a readable detail screen.
- Production readiness and fully unified Retailer + Salesperson pair acceptance remain separate from this selling-leader release.
