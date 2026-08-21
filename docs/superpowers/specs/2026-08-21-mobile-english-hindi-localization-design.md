# Mobile English/Hindi Localization Design

## Goal

Both the retailer and salesperson Expo apps will support English and Hindi. After every successful OTP login, the user chooses a language through a toggle before entering the main app. The choice remains active across app restarts while the session remains active and can be changed later from Account.

## User flow

1. The existing phone/OTP flow completes successfully.
2. The app presents `Choose language / भाषा चुनें` with an English/Hindi toggle.
3. Continue applies the selection and opens the existing main navigation.
4. Logging out clears the pending login gate; the next OTP login shows it again.
5. Reopening the app with an existing valid session restores the last selected language without showing the gate again.
6. Account contains a language control for later changes.

The language gate is intentionally client-side. It does not block authentication or require a backend migration.

## Architecture

Each app receives the same small, dependency-free localization boundary:

- `LanguageCode = "en" | "hi"`.
- A translation dictionary contains all user-facing static strings used by the app.
- `LanguageProvider` owns the selected language, persists it with the app's existing local storage, and exposes `t(key, variables?)`.
- `LanguageSelectionScreen` is rendered after OTP verification and before the existing main stack.
- Account exposes the same selector for an authenticated language change.

The provider is separate in each app so retailer and salesperson builds remain independently deployable. Shared data values are never translated. Backend error codes are mapped to localized UI messages at the client boundary; raw server messages are not displayed when a known error code exists.

## Persistence and session behavior

- `gagan.language.retailer` and `gagan.language.sales` are local storage keys.
- A fresh OTP login always sets `languageSelectionRequired = true` until Continue is pressed.
- Logout clears only the in-memory selection gate; the last language may remain stored for restart continuity, but the next login still asks.
- Session restoration after app restart uses the stored language and skips the gate.
- If no stored language exists during session restoration, English is used until the user chooses another language.

## Scope of translation

Translate existing user-facing copy in both apps:

- authentication and OTP errors
- tab labels, screen headers, buttons, empty/loading/error states
- catalog, cart, checkout, order history, order confirmation, ledger, dues, payments, delivery status
- retailer store-location flow and permission/error messages
- salesperson retailer list/detail, KYC, approvals, collections, recovery, account, and visit-verification flow
- order and visit status labels
- accessibility labels where they contain visible language

Do not translate retailer/product names, addresses, salesperson names, currency formatting, order references, or backend/SAP identifiers.

## Design choices considered

### Recommended: local dictionary + context

Small bundle, no new runtime dependency, deterministic offline behavior, and easy to test. The trade-off is maintaining two dictionaries, which is acceptable for the current English/Hindi scope.

### Full i18n library

Provides pluralization and extraction tooling, but adds dependency/configuration weight to two small Expo apps before more locales are confirmed.

### Backend-provided translations

Centralizes copy but adds network dependency, complicates offline/login UI, and would require backend changes for static product copy. It is not appropriate for this slice.

## Testing

- Unit-test dictionary lookup, interpolation, fallback to English, and persistence adapters.
- Test each app's language gate after OTP verification, Continue behavior, logout/re-login gate, session restoration, and Account language changes.
- Test that representative retailer and salesperson screens render Hindi strings.
- Run both app test suites and TypeScript checks; no backend regression is expected because APIs remain unchanged.

## Explicit non-goals

- No backend/database language preference.
- No SAP changes.
- No translation of user-entered or business-master data.
- No redesign of existing screens.
- No automatic language detection from device settings in this slice.
