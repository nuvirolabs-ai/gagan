# GGN-TEAM-01 Shared-App Team Performance Design

## Outcome

Complete the audited Sales Leader team-performance experience inside the existing Salesperson (Rep) app. A leader with the existing team-performance permission can see the permitted reporting tree and the leader's configured target, while ordinary salespeople remain denied team data. Sales actuals remain visible whether or not a positive target exists. The leader's existing personal work and performance destinations remain available under their existing permissions.

The change is limited to the defects recorded for GGN-TEAM-01 in `docs/GAGAN_FORENSIC_COMPLETENESS_AUDIT.md`. It does not create a manager app, a parallel endpoint, duplicate performance models, or a schema migration.

## Current Architecture

- `backend/src/app.ts` mounts the existing sales-leader router under staff-session authentication at `/rep`.
- `backend/src/modules/performance/performanceRoutes.ts` enforces `PERFORMANCE_VIEW_TEAM` and resolves an optional salesperson filter inside the caller's reporting tree before invoking the read model.
- `backend/src/modules/readmodels/salesLeaderService.ts` reads the reporting team, canonical sales actuals and targets, attendance, routes, ranking, risk and recommended actions. Its target query currently selects reportee IDs only, although aggregation also looks for the manager's ID. Its empty-team early return skips the manager target entirely.
- `rep/src/screens/RepAccountScreen.tsx` and `rep/App.tsx` already expose and register Team Performance behind the server-issued `performance.view_team` permission. Personal Rep destinations remain separate.
- `rep/src/screens/TeamPerformanceScreen.tsx` currently hides actuals when target is absent/non-positive, collapses non-present attendance into one state, omits the rank metric and projection-unavailable explanation, and renders generated English risk/action strings directly.
- `rep/src/screens/teamPerformancePresentation.test.ts` is a pre-existing user-owned regression test specifying the `teamSalesSummary` behavior; preserve it and implement the imported helper.

## Design

### Authorization and Scope

Keep the existing `/rep/sales-leader` route, staff-session authentication, `PERFORMANCE_VIEW_TEAM` server permission, hierarchy-derived scope, and existing salesperson narrowing rules. The UI gate remains useful for navigation but is not an authorization boundary. Do not weaken or replace the backend permission or reporting-tree checks. Do not change the separately mounted `/admin/sales-leader` route.

The team read model continues to contain only permitted reporting-tree members. Do not add the manager as a synthetic team member or include the manager's personal actuals in team totals or team rankings. Preserve the leader's own personal work/performance destinations under their existing permissions.

### Targets and Actuals

Fetch target rows for the unique union of permitted reportee IDs and `managerStaffId`, with the existing period-overlap filter. Perform this target read even when there are no active reportees; the empty-team response must retain the manager's applicable assigned target. Keep `targets.assigned` separate from the reportee `targets.rollup`, preserve the existing target semantics, and do not create a second target model.

In the Rep presentation, actual sales are independent of target presence. Add the pure `teamSalesSummary` helper expected by the existing user-owned test. It always returns actual sales; a null, zero, negative, or missing target is represented as no configured positive target and yields a null completion percentage. A positive target retains the supplied canonical completion percentage. Use the helper for both the team summary and member summaries so target absence never hides actuals. Continue to calculate/display target progress only for positive configured targets; do not invent a target or divide by zero.

### Localized Performance Context

Keep the existing team and member presentation and add only the context missing from the audit:

- Render all attendance marks currently emitted by the field domain: `present`, `leave`, `absent`, `holiday`, and `not_due`. Unknown or missing values must not be mislabeled as absent. Provide English and Hindi labels.
- Show the authoritative leaderboard metric beside a member's rank. Use the structured metric key and localized labels rather than a server-generated English label.
- When projection is unavailable, show a localized reason. Select the message from structured selling-day values (`total` and `elapsed`) and the null projection state; do not parse `projection.unavailableReason` English copy. Preserve the current run-rate labeling when a projection is available.

### Structured Risk and Opportunity Copy

Extend the sales-leader projection with structured reason/action codes and typed values for the risk and recommendation facts it renders. The Rep app will select EN/HI templates from those codes and interpolate the measured values; it must not parse or display generated English `reasons`, `headline`, `why`, `action`, or `recommendedAction` strings as a localization strategy.

For risk, represent the audited generated facts with codes for projected achievement, route completion, and attendance, carrying the relevant percentage, visited/total counts, and attendance mark. For opportunity recommendations, carry the existing trigger type as a reason code plus typed measurements needed to preserve each trigger's actionable facts: order/visit cycle and elapsed days, recent-order count, typical/last order values and shortfall, line counts, missing/regular categories, and overdue collection amount as applicable. Carry retailer and salesperson names as values, not as parts of preformatted English sentences. Provide localized EN/HI reason and action templates for every trigger/reason code that can reach this screen.

Keep the existing English fields additive/backward-compatible for other consumers where practical, but the Team Performance screen must use the structured fields. Do not change trigger eligibility, ranking, risk thresholds, opportunity priority, financial calculations, or business rules.

## Compatibility and Non-Goals

- No Prisma schema, migration, new target/sales model, separate manager app, or duplicate team endpoint.
- No change to staff roles, permission grants, reporting hierarchy, route filtering, or Admin sales-leader behavior.
- No redesign of unrelated Rep dashboard areas, personal performance screens, target configuration, or opportunity workflows.
- No redefinition of team actuals, reportee rollups, manager-assigned target semantics, sales metrics, projection math, attendance policy, ranking order, or risk/opportunity rules.
- No hosted runtime, production data, APK, or physical-device writes as part of this local implementation. Hosted and exact-source device acceptance remain distinct follow-up gates.

## Verification and Acceptance

Regression coverage must establish:

1. An ordinary salesperson receives the existing authorization denial from `/rep/sales-leader`.
2. A leader sees only members in the permitted reporting tree, including when a request attempts to narrow outside it.
3. A leader's existing personal sales/performance destination remains available and continues to use its existing permission and canonical personal data; the team view does not absorb or hide it.
4. A configured manager target is returned from the real target query and remains present when the manager has zero active reports.
5. Team and member actual sales remain visible when targets are absent or non-positive.
6. Positive-target completion percentages reconcile to canonical actual/target values; unconfigured targets do not show a fabricated percentage.
7. All known attendance marks render distinctly in English and Hindi, and unknown marks are not presented as absence.
8. Rank is accompanied by its correctly localized metric, and unavailable projection copy explains the structured reason in both languages.
9. Risk and opportunity reasons/actions render in EN/HI from structured codes and measured values, including preserved retailer, salesperson, and numeric/category facts, without parsing generated English.
10. Authenticated local PostgreSQL service/route tests verify hierarchy authorization, manager target readback (including zero reportees), personal-performance continuity, and canonical sales/target values. Rep presentation tests verify summary math and localized rendering.

Run the focused backend service and authenticated PostgreSQL integration tests, the Rep presentation/i18n tests, and the relevant backend/Rep typechecks and builds. Re-run the full backend and Rep suites if the focused changes pass and the repository's existing test setup permits it. Preserve the pre-existing audit modification and both untracked user-owned files. Report local results separately from hosted, authenticated-browser, and physical-device acceptance.
