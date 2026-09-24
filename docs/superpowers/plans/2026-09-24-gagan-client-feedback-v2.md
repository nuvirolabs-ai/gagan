# Gagan client feedback round 2 implementation plan

Base: immutable `gagan-staging-six-variant-client-v1` (`83efa52d8125046a66b0c8e88cbc4bcc7fe0a60c`). Work only on `codex/gagan-client-feedback-v2` in its isolated worktree. No accepted tag or production mutation.

1. Capture baseline on Moto E13: app identity, launch/Home/Products timings, Home and Products frame statistics, and API/focus behavior. Keep metrics separated from visual judgment.
2. Add failing regressions for new-customer step scroll reset, order/visit state and route progress, retailer Home finance position, tab re-tap scroll behavior, service-request authorization/idempotency/terminal behavior, and bounded Home product rendering. Make each narrowly scoped fix and rerun its test.
3. New Customer: reset the shared keyboard-safe scroll container when changing steps, dismiss stale keyboard, preserve entered values and validation.
4. Visit: link planned stop at check-in without marking visited; mark visited only within successful checkout transaction. Gate Order Detail follow-up action on actual visit state, with a path back to the retailer if no visit exists. Never fabricate check-in/out or change order semantics.
5. Retailer Home: move the existing authoritative AccountStrip immediately after promotions. Bound the Home product preview; the full virtualized Products list remains the complete catalogue. Retap the active Home/Products tab to animate scroll to top without navigation/refetch/filter/cart reset.
6. Service request: add retailer-origin provenance and a withdrawn terminal state by additive migration. Retailer-scoped create/list/withdraw uses authenticated retailer identity, row-level protected transition, durable audit, safe open-only withdrawal, and replay of already withdrawn requests. Admin shows withdrawn history and cannot resume terminal work.
7. Run all four app/backend regressions, typechecks and builds, Prisma validate/migration rehearsal on disposable Postgres, diff check, and source review. Verify staging service/database/recovery/migration ledger before any hosted write, deploy exact reviewed source only if gates pass.
8. Build both review APKs from pinned clean source (Retailer code >15; Salesperson code >16), preserve package/signature/API/data, install in place, physically test six requested flows and accepted checkout/UX boundaries, record before/after metrics. Tag only if all gates pass.

Stop and report a precise blocker if an exact staging identity, recovery point, business rule, controlled test identity, or required physical state cannot be established. Do not infer acceptance from source tests or builds.
