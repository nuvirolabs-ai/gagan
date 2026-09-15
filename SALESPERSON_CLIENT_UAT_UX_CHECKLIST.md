# Salesperson Client-UAT UX Checklist

This is the pre-APK source gate for `codex/gagan-client-uat-ux-reconcile-v1`. It is not a physical-device acceptance record.

## Date and calendar

- [x] Expense date uses the shared date-only field.
- [x] Leave From and Leave To use the shared date-only field.
- [x] Leave To cannot be selected before Leave From.
- [x] Invalid date strings are rejected before API serialization.
- [x] Date serialization is stable at UTC noon and cannot shift the selected day.
- [x] Calendar supports cancel/back and accessible month/day controls.
- [x] Existing follow-up presets and custom date selection remain available.

## Keyboard-safe forms

- [x] A single shared `KeyboardSafeScrollView` owns keyboard-only clearance.
- [x] Add Retailer no longer adds a second screen-owned keyboard-height inset.
- [x] Expense, Leave, Issue, Visit, Route, Approval, Rating, Collection, Login, Retailer Detail, and EOD form surfaces use the shared contract where they contain editable fields.
- [x] No tab-bar height or permanent bottom viewport gap was introduced.
- [ ] Moto E13 physical keyboard proof — deferred to the next APK/UAT task.

## Order flow

- [x] Catalogue remains responsible for product selection and quantity changes.
- [x] Review Order is an explicit navigation checkpoint.
- [x] Review uses the current backend CommercialQuote and revision.
- [x] Freight, GST, entity ownership, and total remain backend snapshot values.
- [x] Place Order uses the existing canonical `/rep/orders` contract and idempotency key.
- [x] Approval acknowledgment remains supported.
- [x] Post-submit screen is the current canonical Order Detail screen.
- [x] Order Detail includes Done / Next retailer navigation.
- [ ] Newly built APK physical order proof — deferred to the next APK/UAT task.

## Issues

- [x] Persisted issue list remains visible from the current `repApi.issues()` contract.
- [x] Issue detail displays current state, assignment, priority, resolution note, and timestamps.
- [ ] Salesperson resolve/withdraw actions are not claimed: the exact current RC backend exposes list/raise for the rep scope and Admin status mutation, while the old UX branch's rep lifecycle route is obsolete and intentionally excluded.

## Protected product behavior

- [x] Backend files unchanged.
- [x] Admin files unchanged.
- [x] Mobile Retailer files unchanged.
- [x] Founder files unchanged.
- [x] Prisma migration count remains 39.
- [x] Wave 1B commercial flow remains on the accepted RC line.
- [x] Wave 2.1 Today/cache source remains unchanged.
- [x] Market Survey source remains unchanged.
- [x] Internal Commercial Status backend overlay remains unchanged.
- [x] Current onboarding/proposal contract remains unchanged.
- [x] Old issue lifecycle and alternate onboarding migrations were not imported.

## Test gate

- [x] Salesperson tests: 30 files, 151 tests passing.
- [x] Salesperson typecheck passing.
- [x] `git diff --check` passing.
- [ ] APK build — intentionally not run in this task.
- [ ] Physical Android UAT — intentionally not run in this task.
