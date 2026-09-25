# Gagan Salesperson V2.1 readiness

## Scope

Controlled refinement on top of frozen Salesperson V2. No new SFA capability or business-rule change is intended.

## Home blank-space finding

`AppScreen` already consumes the measured React Navigation bottom-tab height. Home’s ScrollView also added the fixed `TAB_BAR_SPACE`, reserving the lower area twice. V2.1 keeps the shared shell reservation and removes the second Home reservation. The result remains safe-area aware without device-specific negative offsets.

## Reports read model

Reports uses the existing daily canonical performance series for Sales, Orders, Visits, and confirmed Collections. Thirty-day data is aggregated in the presentation layer into at most six chart buckets; seven-day data remains daily. The productivity funnel uses route-plan totals where exposed, plus canonical visits, productive visits, and unique ordering retailers. Missing data is displayed as an honest compact state.

## New retailer staging configuration

The repository implementation requires `PII_ENCRYPTION_KEY` (32+ characters) when a new identity submission is made. Hosted staging must also use persistent private object storage; ephemeral local disk is not an acceptable deployed Aadhaar store. This is an external deployment configuration gate, not a reason to weaken the repository security model.

## V2.1 validation checkpoint

- Isolated feature branch: `codex/gagan-salesperson-v2-1-founder-refinement`.
- Backend disposable-db regression: 118 test files, 820 tests passed.
- Salesperson tests: 17 test files, 90 tests passed.
- Admin tests/typecheck/lint/build: passed in the isolated worktree.
- Founder regression: 4 test files, 9 tests passed; the Founder source is unchanged.
- Physical Android screenshots and hosted staging deployment are recorded only after the integrated build is installed and exercised.
- The final release remains blocked for Aadhaar-photo staging UAT until private persistent object storage is configured.
