# English/Hindi Mobile Localization Verification

## Automated checks

Retailer app (`mobile`):

- `npm test`: 8 test files, 18 tests passed.
- `npm run typecheck`: passed with no TypeScript errors.
- `npx expo export --platform ios --output-dir /tmp/gagan-mobile-export-final`: passed; iOS bundle produced from 1,077 modules.

Salesperson app (`rep`):

- `npm test`: 9 test files, 21 tests passed.
- `npm run typecheck`: passed with no TypeScript errors.
- `npx expo export --platform ios --output-dir /tmp/gagan-rep-export-final`: passed; iOS bundle produced from 981 modules.

The new unit suites cover dictionary lookup, Hindi fallback, interpolation, invalid persisted values, app-specific storage keys, login selection gating, session restoration, and logout/re-login gating.

## Boundary check

- No files under `mobile/src/api` or `rep/src/api` changed.
- No backend, database, SAP, or package dependency changes were made.
- Secure auth token storage keys were not changed.

## Manual UAT matrix

The following still needs to be exercised on an iOS Simulator or device with the local backend/test data:

| Scenario | Expected |
|---|---|
| Fresh OTP login | Language selector appears before the authenticated app | 
| Choose English | English UI is shown and preference is persisted | 
| Choose Hindi | Representative retailer/salesperson screens show Hindi while business data stays unchanged | 
| Kill/reopen with valid session | Stored language restores and selector does not reappear | 
| Account language switch | Copy changes immediately without logout, cart reset, or active-retailer reset | 
| Logout then login | Selector appears again | 
| Invalid stored language | App starts in English without crashing | 

These manual checks are not claimed as executed by this verification note.
