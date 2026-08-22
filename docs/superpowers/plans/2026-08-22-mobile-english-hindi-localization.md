# Mobile English/Hindi Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English/Hindi language selection and localized user-facing copy to the retailer and salesperson Expo apps while preserving the existing login session until explicit logout.

**Architecture:** Each app will get a small, dependency-free `LanguageProvider`, typed English/Hindi dictionary, and AsyncStorage-backed language store. A successful OTP login sets an in-memory language gate; the user must select a language before the authenticated navigation stack appears. A restored session loads the persisted language and skips the gate, while logout clears the gate and requires selection after the next OTP login. Business data and backend contracts remain unchanged.

**Tech Stack:** Expo React Native, TypeScript, React Context, React Navigation, `@react-native-async-storage/async-storage`, Vitest, existing app theme/components.

---

## File map

Retailer app files to create:

- `mobile/src/i18n/translations.ts` — typed English/Hindi dictionaries and translation key type.
- `mobile/src/i18n/languageStore.ts` — AsyncStorage adapter using `gagan.language.retailer`.
- `mobile/src/i18n/languageState.ts` — pure login/selection/logout state transitions.
- `mobile/src/i18n/LanguageContext.tsx` — language state, `t`, selection gate, persistence, and logout reset.
- `mobile/src/screens/LanguageSelectionScreen.tsx` — post-login language selector and Continue action.
- `mobile/src/i18n/__tests__/translations.test.ts` — dictionary lookup, fallback, and interpolation tests.
- `mobile/src/i18n/__tests__/languageStore.test.ts` — persistence adapter tests.
- `mobile/src/i18n/__tests__/languageFlow.test.ts` — pure gate/session transition tests.

Salesperson app files to create:

- `rep/src/i18n/translations.ts` — typed English/Hindi dictionaries and translation key type.
- `rep/src/i18n/languageStore.ts` — AsyncStorage adapter using `gagan.language.sales`.
- `rep/src/i18n/languageState.ts` — pure login/selection/logout state transitions.
- `rep/src/i18n/LanguageContext.tsx` — language state, `t`, selection gate, persistence, and logout reset.
- `rep/src/screens/LanguageSelectionScreen.tsx` — post-login language selector and Continue action.
- `rep/src/i18n/__tests__/translations.test.ts` — dictionary lookup, fallback, and interpolation tests.
- `rep/src/i18n/__tests__/languageStore.test.ts` — persistence adapter tests.
- `rep/src/i18n/__tests__/languageFlow.test.ts` — pure gate/session transition tests.

Existing files to modify:

- `mobile/App.tsx`, `mobile/src/context/AuthContext.tsx`, `mobile/src/components/TabBar.tsx`, `mobile/src/components/ui.tsx`, and all retailer screens under `mobile/src/screens/`.
- `rep/App.tsx`, `rep/src/context/RepContext.tsx`, `rep/src/components/ui.tsx`, and all salesperson screens under `rep/src/screens/`.

No backend, database, SAP, API, or mobile package dependency changes are planned.

## Task 1: Define testable language state and storage contracts

**Files:**
- Create: `mobile/src/i18n/__tests__/translations.test.ts`
- Create: `mobile/src/i18n/__tests__/languageStore.test.ts`
- Create: `mobile/src/i18n/__tests__/languageFlow.test.ts`
- Create: `rep/src/i18n/__tests__/translations.test.ts`
- Create: `rep/src/i18n/__tests__/languageStore.test.ts`
- Create: `rep/src/i18n/__tests__/languageFlow.test.ts`

- [ ] **Step 1: Write failing dictionary tests.**

  Test the public behavior, not object shape:

  ```ts
  it("returns Hindi text for a known key", () => {
    expect(t("language.chooseTitle", "hi")).toBe("भाषा चुनें");
  });

  it("falls back to English when a Hindi key is absent", () => {
    expect(t("language.continue", "hi")).toBe("Continue");
  });

  it("interpolates variables without translating business data", () => {
    expect(t("cart.itemCount", "hi", { count: 2 })).toBe("2 आइटम");
  });
  ```

  Add the equivalent assertions in the salesperson dictionary suite, including a representative approval and collection string.

- [ ] **Step 2: Write failing storage tests.**

  Use an in-memory `{ getItem, setItem, removeItem }` adapter and assert that `loadLanguage()` returns `null` for an empty store, `saveLanguage("hi")` writes exactly the app-specific key, and invalid persisted values are ignored and returned as `null`.

- [ ] **Step 3: Write failing pure language-flow tests.**

  Define the transition contract the provider will expose:

  ```ts
  type LanguageState = {
    language: "en" | "hi";
    selectionRequired: boolean;
  };

  it("requires selection after OTP login", () => {
    expect(beginLogin({ language: "en", selectionRequired: false }))
      .toEqual({ language: "en", selectionRequired: true });
  });

  it("persists selection and closes the gate", () => {
    expect(completeSelection({ language: "en", selectionRequired: true }, "hi"))
      .toEqual({ language: "hi", selectionRequired: false });
  });

  it("keeps the gate closed when a stored language restores an existing session", () => {
    expect(restoreSession("hi")).toEqual({ language: "hi", selectionRequired: false });
  });

  it("opens the gate again after logout and a later OTP login", () => {
    expect(beginLogin(logout({ language: "hi", selectionRequired: false })))
      .toEqual({ language: "hi", selectionRequired: true });
  });
  ```

  Import `beginLogin`, `completeSelection`, `restoreSession`, and `logout` from the not-yet-created `mobile/src/i18n/languageState.ts` and the corresponding salesperson module. The functions must have these signatures:

  ```ts
  export function beginLogin(state: LanguageState): LanguageState;
  export function completeSelection(state: LanguageState, language: LanguageCode): LanguageState;
  export function restoreSession(language: LanguageCode | null): LanguageState;
  export function logout(state: LanguageState): LanguageState;
  ```

- [ ] **Step 4: Run the new tests and verify the intended RED state.**

  Run:

  ```bash
  cd mobile && npm test -- src/i18n/__tests__
  cd ../rep && npm test -- src/i18n/__tests__
  ```

  Expected: failures because the i18n modules and exported functions do not exist yet. Fix only test setup errors; do not add implementation before the failure is observed.

## Task 2: Implement retailer localization core

**Files:**
- Create: `mobile/src/i18n/translations.ts`
- Create: `mobile/src/i18n/languageStore.ts`
- Create: `mobile/src/i18n/languageState.ts`
- Create: `mobile/src/i18n/LanguageContext.tsx`
- Test: `mobile/src/i18n/__tests__/translations.test.ts`, `languageStore.test.ts`, `languageFlow.test.ts`

- [ ] **Step 1: Add the typed dictionary.**

  Export:

  ```ts
  export type LanguageCode = "en" | "hi";
  const english = {
    "language.chooseTitle": "Choose language",
    "language.continue": "Continue",
    "cart.itemCount": "{{count}} items",
  } as const;
  const hindi: Partial<Record<keyof typeof english, string>> = {
    "language.chooseTitle": "भाषा चुनें",
    "cart.itemCount": "{{count}} आइटम",
  };
  export type TranslationKey = keyof typeof english;
  export const translations = { en: english, hi: hindi };
  export function translate(language: LanguageCode, key: TranslationKey, vars?: Record<string, string | number>): string;
  ```

  Include English and Hindi entries for authentication, language selection, tab labels, common actions, loading/empty/error states, catalog, cart, checkout, order history/detail/confirmation, ledger, payments, delivery, profile/support, and store location. Keep product names, retailer names, addresses, phone numbers, currency, order references, and status/business values passed from the API untouched.

- [ ] **Step 2: Add the retailer storage adapter.**

  Export `RETAILER_LANGUAGE_KEY = "gagan.language.retailer"` and:

  ```ts
  export interface LanguageStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  export function createLanguageStore(storage: LanguageStorage, key: string): {
    loadLanguage(): Promise<LanguageCode | null>;
    saveLanguage(language: LanguageCode): Promise<void>;
  };
  export const retailerLanguageStore = createLanguageStore(AsyncStorage, RETAILER_LANGUAGE_KEY);
  ```

  Invalid storage values must be ignored rather than crashing startup.

- [ ] **Step 3: Add the provider and pure flow helpers.**

  `languageState.ts` must export the four pure functions and `LanguageState` type specified in Task 1. Each function returns a new object and never performs storage or React work.

  Export `LanguageProvider` and `useLanguage` with this value shape:

  ```ts
  interface LanguageContextValue {
    language: LanguageCode;
    t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
    selectionRequired: boolean;
    beginLoginSelection: () => void;
    completeLanguageSelection: (language: LanguageCode) => Promise<void>;
    setLanguage: (language: LanguageCode) => Promise<void>;
    resetSelectionGate: () => void;
  }
  ```

  Initialize to English, load the persisted language once, persist only valid `en`/`hi`, and keep language selection client-side. The provider must not alter secure auth tokens or call the backend.

- [ ] **Step 4: Run the retailer i18n tests and verify GREEN.**

  Run `cd mobile && npm test -- src/i18n/__tests__`; expected: all new tests pass.

## Task 3: Implement salesperson localization core

**Files:**
- Create: `rep/src/i18n/translations.ts`
- Create: `rep/src/i18n/languageStore.ts`
- Create: `rep/src/i18n/languageState.ts`
- Create: `rep/src/i18n/LanguageContext.tsx`
- Test: `rep/src/i18n/__tests__/translations.test.ts`, `languageStore.test.ts`, `languageFlow.test.ts`

- [ ] **Step 1: Add the typed salesperson dictionary and translator.**

  Use the same `LanguageCode`, `translate`, interpolation, and English fallback contracts as the retailer app, with keys covering login, tabs, retailer list/detail, assisted ordering, approvals, disputes, rating reviews, KYC, collections, Accounts confirmation, visits/location, account, and common errors/actions.

- [ ] **Step 2: Add `gagan.language.sales` storage and provider.**

  Reuse the exact storage interface and provider value shape from Task 2, but keep the module independent and use the salesperson storage key. Do not share runtime state between the two Expo bundles.

- [ ] **Step 3: Run the salesperson i18n tests and verify GREEN.**

  Run `cd rep && npm test -- src/i18n/__tests__`; expected: all new tests pass.

## Task 4: Wire retailer login/session gate

**Files:**
- Modify: `mobile/App.tsx`
- Modify: `mobile/src/context/AuthContext.tsx`
- Create: `mobile/src/screens/LanguageSelectionScreen.tsx`
- Test: `mobile/src/i18n/__tests__/languageFlow.test.ts`

- [ ] **Step 1: Add failing flow assertions for the real auth transitions.**

  Assert that a successful `verifyOtp` calls `beginLoginSelection`, logout calls `resetSelectionGate`, and session restoration does not call `beginLoginSelection`. Keep API calls mocked at the existing `api` boundary and assert state transitions, not implementation details.

- [ ] **Step 2: Wrap the retailer app with `LanguageProvider`.**

  Render `<LanguageProvider><AuthProvider>...` so `AuthProvider`, navigation, and screens can consume language state. Do not move `CartProvider` or alter navigation theme behavior.

- [ ] **Step 3: Update `AuthContext` transitions.**

  On successful OTP verification call `beginLoginSelection()` after setting the retailer. On logout and unauthorized session expiry call `resetSelectionGate()`. On mount, let the provider restore persisted language while `api.me()` restores the session; do not open the gate for a valid restored session.

- [ ] **Step 4: Add `LanguageSelectionScreen`.**

  Render `Choose language / भाषा चुनें`, two mutually exclusive English/Hindi choices, and a Continue button. The selected value starts at the provider language, Continue calls `completeLanguageSelection`, and only then does navigation expose `Main`. The screen must use the existing theme primitives and have accessible labels in both languages.

- [ ] **Step 5: Gate authenticated navigation.**

  In `RootNavigator`, render the selector screen when `retailer` exists and `selectionRequired` is true; otherwise render the existing main and detail screens unchanged. Header titles/back labels must come from `t(...)` via a function-based `screenOptions` so changing language updates visible navigation copy.

- [ ] **Step 6: Run retailer tests and typecheck.**

  Run:

  ```bash
  cd mobile && npm test
  npm run typecheck
  ```

  Expected: existing tests plus i18n tests pass and TypeScript reports no errors.

## Task 5: Wire salesperson login/session gate

**Files:**
- Modify: `rep/App.tsx`
- Modify: `rep/src/context/RepContext.tsx`
- Create: `rep/src/screens/LanguageSelectionScreen.tsx`
- Test: `rep/src/i18n/__tests__/languageFlow.test.ts`

- [ ] **Step 1: Add failing auth transition assertions for `RepProvider`.**

  Assert that `login` begins the language gate, logout resets it, unauthorized session expiry resets it, and a valid restored session does not begin it.

- [ ] **Step 2: Wrap the salesperson app with its `LanguageProvider`.**

  Render `<LanguageProvider><RepProvider>...` and preserve the existing `NavigationContainer`, `StatusBar`, and capability logic.

- [ ] **Step 3: Update `RepContext` transitions.**

  Call `beginLoginSelection()` after `repApi.verifyOtp` succeeds; call `resetSelectionGate()` from logout and unauthorized handling. Leave active retailer/cart reset behavior unchanged.

- [ ] **Step 4: Add and wire the salesperson selector screen.**

  Use the same selector interaction as the retailer app, but translate all copy through the salesperson dictionary. Gate `RepMain` and detail screens until Continue completes.

- [ ] **Step 5: Localize salesperson stack titles.**

  Convert `Retailers`, `Work`, `Approvals`, `Account`, `Retailer`, `New order`, `KYC documents`, `Approval`, and `Rating reviews` headers/back labels to provider translations without changing capability-based route inclusion.

- [ ] **Step 6: Run salesperson tests and typecheck.**

  Run `cd rep && npm test && npm run typecheck`; expected: all existing and new tests pass with no TypeScript errors.

## Task 6: Localize shared retailer components and screens

**Files:**
- Modify: `mobile/src/components/ui.tsx`, `mobile/src/components/TabBar.tsx`
- Modify: `mobile/src/screens/LoginScreen.tsx`, `HomeScreen.tsx`, `CatalogScreen.tsx`, `ProductDetailScreen.tsx`, `CartScreen.tsx`, `OrderConfirmationScreen.tsx`, `OrderHistoryScreen.tsx`, `OrderDetailScreen.tsx`, `LedgerScreen.tsx`, `PayScreen.tsx`, `DeliveryTrackingScreen.tsx`, `ProfileScreen.tsx`, `StoreLocationScreen.tsx`

- [ ] **Step 1: Replace hardcoded retailer UI copy with `t(...)`.**

  Translate visible labels, buttons, placeholders, alerts, empty/error/loading states, accessibility labels, status labels, and navigation-facing text. Keep interpolation values and API data outside translation calls, for example:

  ```tsx
  <Text>{t("cart.totalPayable")}</Text>
  <Text>{inr(payable)}</Text>
  <Text>{t("orders.orderNumber", { orderNo: order.orderNo })}</Text>
  ```

  Replace raw known `ApiError.message` display with a localized error-code mapping and use a localized generic fallback for unknown errors; never translate or expose retailer/product master data.

- [ ] **Step 2: Localize reusable UI metadata.**

  Convert `StatusPill`/status metadata, `EmptyState`, `SearchBar` placeholders, quantity button accessibility labels, and `TabBar` labels to `useLanguage().t`. Ensure the cart badge accessibility label interpolates the count.

- [ ] **Step 3: Add Account language control.**

  Add a compact English/Hindi selector to `ProfileScreen` using `setLanguage`. It changes language immediately, persists it, and does not log out or reopen the post-login gate.

- [ ] **Step 4: Run retailer tests/typecheck after each screen group.**

  Run `cd mobile && npm test && npm run typecheck` after auth/common components, catalog/cart/order screens, and account/ledger/location screens. Fix type or rendering regressions before moving to the salesperson app.

## Task 7: Localize salesperson components and screens

**Files:**
- Modify: `rep/src/components/ui.tsx`
- Modify: `rep/src/screens/RepLoginScreen.tsx`, `StaffHomeScreen.tsx`, `RepRetailersScreen.tsx`, `RepRetailerDetailScreen.tsx`, `RepCatalogScreen.tsx`, `RepAccountScreen.tsx`, `ApprovalsScreen.tsx`, `ApprovalDetailScreen.tsx`, `RatingReviewsScreen.tsx`, `KycCaptureScreen.tsx`

- [ ] **Step 1: Replace hardcoded salesperson copy with `t(...)`.**

  Cover login/OTP, retailer metrics/search/detail, KYC, location/check-in/out, assisted order/cart, approvals/disputes, rating reviews, collection submission/Accounts confirmation, account/logout, alerts, empty/error/loading states, and accessibility labels. Preserve retailer names, addresses, order numbers, amounts, status codes, and permission-derived behavior.

- [ ] **Step 2: Localize status/reason helpers.**

  Convert approval reason labels, order/visit/KYC status labels, and staff role labels to dictionary keys. Use interpolation for order numbers and distances, leaving numeric values intact.

- [ ] **Step 3: Add Account language control.**

  Add the same immediate, persisted English/Hindi selector to `RepAccountScreen`; it must not reset the active retailer, cart, or auth session.

- [ ] **Step 4: Run salesperson tests/typecheck.**

  Run `cd rep && npm test && npm run typecheck`; expected: all tests pass and no type errors remain.

## Task 8: Cross-app verification and documentation

**Files:**
- Create: `docs/superpowers/verification/2026-08-22-mobile-english-hindi-localization.md`

- [ ] **Step 1: Run the complete automated suites from clean app working trees.**

  ```bash
  cd mobile && npm test && npm run typecheck
  cd ../rep && npm test && npm run typecheck
  ```

  Record the exact pass counts and TypeScript results in the verification note.

- [ ] **Step 2: Run the manual language/session matrix.**

  For each app, verify:

  | Scenario | Expected |
  |---|---|
  | Fresh OTP login | Selector appears before authenticated home | 
  | Choose English | Main app is English and preference persists | 
  | Choose Hindi | Representative screens show Hindi; business data remains unchanged | 
  | Kill/reopen with valid session | Last language restored; selector does not reappear | 
  | Change language in Account | Copy changes immediately; session/cart/active retailer remain intact | 
  | Logout then login again | Selector appears again | 
  | Invalid stored language | App starts in English without crashing | 

- [ ] **Step 3: Confirm untouched boundaries.**

  Use `git diff --stat` and `git diff -- mobile/src/api rep/src/api` to verify no backend/API/SAP files changed and no new dependency was added.

- [ ] **Step 4: Write the verification note and commit the completed slice.**

  The note must state what was tested, the exact commands/results, and any remaining translation gaps. Commit with:

  ```bash
  git add mobile rep docs/superpowers/verification/2026-08-22-mobile-english-hindi-localization.md
  git commit -m "feat: add English and Hindi mobile localization"
  ```

## Self-review checklist

- Spec coverage: dictionary/context, post-login selector, session persistence, logout/re-login gate, Account switch, all retailer/salesperson UI copy, tests, and explicit non-goals are represented above.
- Placeholder scan: the plan contains no `TODO`, `TBD`, or unspecified SAP/backend work; all paths and commands are explicit.
- Type consistency: both apps expose the same `LanguageContextValue` contract, while each keeps its own dictionary and storage key; auth providers call only the named gate methods.
- Boundary safety: no API payloads, backend migrations, SAP code, secure token keys, or business-master values are changed.
