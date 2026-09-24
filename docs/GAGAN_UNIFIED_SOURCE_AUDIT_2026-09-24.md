# Gagan Unified Source Audit — 2026-09-24

This is the required source feature matrix, recorded before any runtime-source edits for this consolidation task. `PRESENT` means the reviewed reconciled source contains the implementation; it does not imply new APK or physical acceptance. Device and hosted checks are called out separately.

## Audited source state

- Canonical checkout: `codex/gagan-canonical-product-v1` at `5a632711025f5eb6d42a75e26529ce739f06f982`, clean and matching its remote at audit time.
- Selected existing integration worktree: `codex/gagan-client-feedback-v2-reconciled` at `ec76fbfa7b07eabd9a46c6dfab813388ba55ffa1`, based on and descending from the canonical catalogue checkpoint. It is one committed change ahead of its remote and has only the target-celebration delta described below in the working tree.
- Target-celebration delta present but not yet committed: `backend/src/modules/performance/__tests__/achievements.test.ts`, `rep/src/context/FieldContext.tsx`, `rep/src/screens/TodayScreen.tsx`, `rep/src/performance/achievementPresentation.ts`, and its test. It filters the major Home sheet to `TARGET_100`, leaves 25/50/75/90 as progress/activity items, and keeps non-target major achievement sheets.
- All inspected worktrees were rechecked and preserved. Current snapshot:

| Worktree | Branch/HEAD | State |
|---|---|---|
| `/Users/tanutejas/Documents/GAGAN/CURRENT/SOURCE` | `codex/gagan-canonical-product-v1` @ `5a632711025f5eb6d42a75e26529ce739f06f982` | Clean |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/.build-workspaces/gagan-routing-policy-v2` | `codex/gagan-jain-padam-routing-policy-v2` @ `fadc6d8b70cb39ab5a1f93b395572a9e19f6fcd6` | Clean |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/.build-workspaces/mobile-595ca72` | detached @ `595ca729e414b7387c0d534ba97dc162f175bff0` | Preserved untracked `mobile/node_modules` |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/.build-workspaces/mobile-c2fd59d` | detached @ `c2fd59d824741c4620003d8c5e6bb9d31829f1b9` | Preserved untracked `mobile/node_modules` |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/.build-workspaces/rep-595ca72` | detached @ `595ca729e414b7387c0d534ba97dc162f175bff0` | Preserved untracked `rep/node_modules` |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/.build-workspaces/rep-c2fd59d` | detached @ `c2fd59d824741c4620003d8c5e6bb9d31829f1b9` | Preserved untracked `rep/node_modules` |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/SOURCE/.worktrees/gagan-client-demo-final-v1` | `codex/gagan-client-demo-final-v1` @ `d806ca739d3b55730a780196eaeb55d2161d0ec4` | Clean |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/SOURCE/.worktrees/gagan-client-feedback-v2` | `codex/gagan-client-feedback-v2` @ `865a89a77b91ee93f8a9fce0247a857cc2a2b1d9` | Clean |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/SOURCE/.worktrees/gagan-client-feedback-v2-reconciled` | `codex/gagan-client-feedback-v2-reconciled` @ `ec76fbfa7b07eabd9a46c6dfab813388ba55ffa1` | Seven intended dirty/untracked entries: target-celebration changes plus this audit/plan |
| `/Users/tanutejas/Documents/GAGAN/CURRENT/SOURCE/.worktrees/gagan-six-variant-client-v1` | `codex/gagan-six-variant-client-v1` @ `83efa52d8125046a66b0c8e88cbc4bcc7fe0a60c` | Clean |
| `/Users/tanutejas/Documents/GAGAN/WORKTREES/gagan-real-catalogue-v1` | `codex/gagan-real-catalogue-v1` @ `2a8e2d2e9288fb9ff4fb1d5e2f38802e50a172a8` | Clean |

Three registered historical `/private/tmp` paths (`gagan-login-branding-20260917`, `gagan-retailer-commerce-polish-20260917`, `gagan-retailer-home-cart-20260917`) are absent and reported prunable by Git. They were not pruned; refs/history remain. The reconciled feature branch is one commit ahead of its remote at this checkpoint; the canonical checkout remains clean at `5a6327…`.
- The selected source has exactly 46 migration directories. Relative to `5a6327…`, the only migration addition is `20260924060000_feedback_v2_service_request`. It retains `20260922180000_internal_staging_inventory` and `20260922200000_pending_gst_ordering`; `20260917150000_staging_inventory_identity` is absent.
- Moto E13 package versions at audit time: Retailer `1.0.16` / code `17`; Salesperson `1.0.19` / code `19`. New review artifacts must exceed these codes.

## Retailer

| Feature | Status | Source file(s) | Audit note |
|---|---|---|---|
| Approved GAGAN Retailer login artwork | PRESENT | `mobile/assets/auth/gagan-retailer-login.png`; `mobile/src/screens/LoginScreen.tsx`; `mobile/src/screens/loginBranding.ts`; `mobile/src/screens/__tests__/loginBranding.test.ts` | Branded asset and login presentation are in the selected source. |
| OTP authentication | PRESENT | `mobile/src/screens/LoginScreen.tsx`; `mobile/src/api/retailerApi.ts`; `mobile/src/auth/secureSession.ts`; `mobile/src/auth/sessionStore.ts` | OTP/session implementation and session tests are present. |
| Existing session restoration | PRESENT | `mobile/src/context/AuthContext.tsx`; `mobile/src/auth/sessionFetch.ts`; `mobile/src/auth/__tests__/sessionStore.test.ts`; `mobile/src/context/__tests__/sessionResilience.test.ts` | Existing identity-bound session code is preserved; verify after installing the update. |
| Product-first Home composition | PRESENT | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/lib/homeProductPreview.ts` | Discovery precedes the compact latest-order row. |
| Promotional product banners and existing Products/category destinations | PRESENT | `mobile/src/components/home/RetailerPromoCarousel.tsx`; `mobile/src/lib/retailerPromotions.ts`; `mobile/src/lib/__tests__/retailerPromotions.test.ts` | The promotion builder caps Home at three and routes to the existing Products screen/category. |
| No delivery-status hero/banner | PRESENT | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/lib/homePresentation.ts` | Active-order presentation is suppressed in the hero and retained as the compact post-discovery Latest Order row. |
| Outstanding immediately below banners | PRESENT | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/components/home/AccountStrip.tsx` | Account/Outstanding strip follows the carousel. |
| Categories and product discovery | PRESENT | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/screens/CatalogScreen.tsx`; `mobile/src/components/ProductGroupCard.tsx` | Home category chips and the complete virtualized Products list are present. |
| Compact latest-order status below discovery | PRESENT | `mobile/src/screens/HomeScreen.tsx` | Latest order is rendered after the Home product preview. |
| Ledger/outstanding navigation | PRESENT | `mobile/src/components/home/AccountStrip.tsx`; `mobile/src/screens/LedgerScreen.tsx`; `mobile/src/screens/HomeScreen.tsx` | Existing account/ledger navigation is retained. |
| Order Again | PRESENT | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/lib/homePresentation.ts` | Reorder lines are reconciled against the current catalogue before adding. |
| No duplicate financial cards | PRESENT | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/components/home/AccountStrip.tsx`; `mobile/src/lib/__tests__/retailerCommercePolish.test.ts` | The Home renders one account strip; verify visually on device. |
| Feedback-v2 render optimization | PRESENT | `mobile/src/lib/homeProductPreview.ts`; `mobile/src/lib/__tests__/retailerCommercePolish.test.ts`; `docs/CLIENT_FEEDBACK_V2_RECONCILIATION_MATRIX.md` | Home limits image-heavy preview cards; prior evidence recorded a lower rendered-view count and improved scroll timing, not a 60-fps claim. |
| No unnecessary catalogue refetch regressions | PARTIAL | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/screens/CatalogScreen.tsx`; `mobile/src/api/retailerApi.ts` | Requests are focus-bound (not render-loop-bound) to refresh current catalogue/orderability. Home payload includes product groups, and Products has its own focus refresh; no shared request de-duplication assertion was found. Verify network/performance behavior before claiming this complete; do not remove freshness refresh blindly. |
| Six-variant pricing — Broken 30 KG | PRESENT | `mobile/src/lib/catalogPricePresentation.ts`; `mobile/src/components/ProductGroupCard.tsx`; `mobile/src/screens/ProductDetailScreen.tsx`; `mobile/src/lib/__tests__/catalogPricePresentation.test.ts` | Quintal, derived kg, and master-pack presentation flows from the API rate basis. |
| Six-variant pricing — Choice 30 KG | PRESENT | Same pricing/card/detail files as Broken; `mobile/src/lib/__tests__/catalogPricePresentation.test.ts` | Variant uses the same rate-basis calculation, not a hard-coded display price. |
| Six-variant pricing — Classic 30 KG | PRESENT | Same pricing/card/detail files as Broken; `mobile/src/lib/__tests__/catalogPricePresentation.test.ts` | Pack-specific SKU selection is retained. |
| Six-variant pricing — Classic 1 KG ×20 | PRESENT | Same pricing/card/detail files as Broken; `mobile/src/lib/__tests__/catalogPricePresentation.test.ts` | Master-pack equivalent derives from pack metadata. |
| Six-variant pricing — Classic 5 KG ×4 | PRESENT | Same pricing/card/detail files as Broken; `mobile/src/lib/__tests__/catalogPricePresentation.test.ts` | Master-pack equivalent derives from pack metadata. |
| Six-variant pricing — Classic 10 KG ×4 | PRESENT | Same pricing/card/detail files as Broken; `mobile/src/lib/__tests__/catalogPricePresentation.test.ts` | Master-pack equivalent derives from pack metadata. |
| GST-pending display without “GST 0%” | PRESENT | `mobile/src/lib/commercialTaxPresentation.ts`; `mobile/src/components/CommercialBreakdown.tsx`; `mobile/src/lib/__tests__/commercialTaxPresentation.test.ts` | Pending-tax copy is explicit; the UI does not fabricate a zero rate. |
| Add control follows fresh stock/orderability | PRESENT | `mobile/src/components/ProductGroupCard.tsx`; `mobile/src/lib/catalogInteractions.ts`; `mobile/src/screens/CatalogScreen.tsx`; backend catalog and inventory routes | Add is guarded by API orderability and availability; backend remains authoritative. |
| Cart, Review, and authoritative quote | PRESENT | `mobile/src/screens/CartScreen.tsx`; `mobile/src/api/retailerApi.ts`; `mobile/src/lib/commercialQuoteState.test.ts`; backend `backend/src/modules/commercial/` | Cart/review uses the shared hosted quote contract; no client-side routing/pricing authority. |
| Live mini-cart on Home / Products / Product Detail only | PRESENT | `mobile/src/components/MiniCartBar.tsx`; `mobile/src/components/TabBar.tsx`; `mobile/src/lib/miniCartVisibility.ts`; `mobile/src/lib/__tests__/miniCart.test.ts` | Uses the existing cart context/subtotal and is hidden on Cart, Review/Checkout, and Order Detail. |
| Active Home tab re-tap scrolls to top | PRESENT | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/lib/__tests__/retailerCommercePolish.test.ts` | `useScrollToTop` is wired to the Home scroll view. |
| Active Products tab re-tap scrolls to top | PRESENT | `mobile/src/screens/CatalogScreen.tsx`; `mobile/src/lib/__tests__/retailerCommercePolish.test.ts` | `useScrollToTop` is wired to the virtualized list. |
| Service request submission | PRESENT | `mobile/src/screens/ServiceRequestsScreen.tsx`; `mobile/src/api/retailerApi.ts`; `backend/src/routes/serviceRequests.ts`; `backend/src/modules/field/issueService.ts` | Source route/service/tests are present; hosted support is not assumed from this source audit. |
| Service request history | PRESENT | Same Service Requests screen/API/backend service; `backend/src/modules/field/__tests__/retailerServiceRequestDb.test.ts` | History persists and is scoped to the authenticated retailer in tests. |
| Withdraw Request action and confirmation | PRESENT | `mobile/src/screens/ServiceRequestsScreen.tsx`; `mobile/src/lib/serviceRequestState.ts` | UI limits withdrawal to eligible statuses and confirms before sending. |
| Withdrawn status persistence | PRESENT | `backend/prisma/migrations/20260924060000_feedback_v2_service_request/migration.sql`; `backend/src/modules/field/issueService.ts`; `mobile/src/lib/serviceRequestState.ts` | Durable withdrawn state and audit are covered by backend DB tests; physical display still needs verification. |
| Service-request authorization and audit | PRESENT | `backend/src/routes/serviceRequests.ts`; `backend/src/modules/field/issueService.ts`; `backend/src/modules/field/__tests__/retailerServiceRequestDb.test.ts` | Retailer ownership, replay, and audit actor/timestamp are protected in source tests. |
| Safe-area and bottom navigation behavior | PRESENT | `mobile/App.tsx`; `mobile/src/components/TabBar.tsx`; `mobile/src/theme.ts`; `mobile/src/lib/__tests__/miniCart.test.ts` | Dynamic safe-area inset is used in the bottom bar and reserved content spacing. |
| Gesture-navigation compatibility | PRESENT | `mobile/src/components/TabBar.tsx`; `mobile/src/theme.ts` | Inset-based layout is implemented; physical mode check remains pending. |
| Three-button-navigation-compatible layout logic | PRESENT | `mobile/src/components/TabBar.tsx`; `mobile/src/theme.ts` | Uses runtime inset rather than a fixed navigation-bar assumption; physical alternate-mode check remains pending. |
| Larger-font resilience | PARTIAL | `mobile/src/screens/HomeScreen.tsx`; `mobile/src/components/ProductGroupCard.tsx`; `mobile/src/components/TabBar.tsx`; `mobile/src/theme.ts` | Several constrained labels and responsive layouts exist, but a complete 1.3 font-scale sweep has not been evidenced. |

## Salesperson

| Feature | Status | Source file(s) | Audit note |
|---|---|---|---|
| Approved GAGAN SALES login artwork | PRESENT | `rep/assets/auth/gagan-sales-login.png`; `rep/src/screens/RepLoginScreen.tsx`; `rep/src/screens/loginBranding.ts`; `rep/src/screens/__tests__/loginBranding.test.ts` | Correct Salesperson artwork is in the selected app tree. |
| OTP authentication | PRESENT | `rep/src/screens/RepLoginScreen.tsx`; `rep/src/auth/secureSession.ts`; `rep/src/auth/sessionStore.ts` | Uses the existing OTP/session flow, not the password-looking design mockup. |
| SALES COMPANION branding | PRESENT | `rep/src/screens/RepLoginScreen.tsx`; `rep/src/screens/loginBranding.ts` | Sales-specific copy and artwork remain separate from Retailer login. |
| Existing salesperson session restoration | PRESENT | `rep/src/context/RepContext.tsx`; `rep/src/auth/secureSession.ts`; `rep/src/auth/sessionStore.ts`; `rep/src/context/__tests__/sessionResilience.test.ts` | Persistent identity/account boundaries are preserved. |
| Today / My Day surfaces | PRESENT | `rep/src/screens/TodayScreen.tsx`; `rep/src/screens/MyDayScreen.tsx`; `rep/src/navigation/` | Both operational views remain routed. |
| Calendar/date fixes | PRESENT | `rep/src/screens/MyDayScreen.tsx`; `rep/src/components/DateField.tsx`; `rep/src/components/KeyboardSafeScrollView.tsx`; associated component tests | The shared date/keyboard work is in the reconciled source; physical date flow remains to be rechecked. |
| Route and target card | PRESENT | `rep/src/screens/TodayScreen.tsx`; `backend/src/modules/field/routeService.ts`; `backend/src/readmodels/salespersonTodayService.ts` | Server route/Today read model is retained. |
| Performance and target progress rail | PRESENT | `rep/src/screens/TodayScreen.tsx`; `rep/src/components/Achievement.tsx`; `backend/src/modules/performance/` | Backend supplies milestones; client displays progress. |
| Six real rice variants and quintal/kg/case pricing | PRESENT | `rep/src/screens/RepCatalogScreen.tsx`; `rep/src/lib/catalogPricePresentation.ts`; `rep/src/lib/__tests__/catalogPricePresentation.test.ts` | Pricing is derived from backend rate basis and selected variant. |
| GST-pending display without zero tax | PRESENT | `rep/src/components/CommercialBreakdown.tsx`; `rep/src/lib/commercialTaxPresentation.ts`; `rep/src/lib/__tests__/commercialTaxPresentation.test.ts` | Explicit pending message is present in catalog/review breakdown. |
| Add/Review and inventory guards | PRESENT | `rep/src/screens/RepCatalogScreen.tsx`; `rep/src/lib/catalogOrdering.ts`; `rep/src/lib/catalogSelection.ts`; backend catalog/inventory routes | Client cannot override server `orderable` or stock state. |
| Order placed is not visit completion | PRESENT | `rep/src/screens/orderVisitAction.ts`; `rep/src/screens/__tests__/feedbackV2Flow.test.ts`; `rep/src/screens/OrderDetailScreen.tsx` | Order state alone yields `visit_not_completed`; explicit visit evidence is required. |
| Check-in and active visit after order | PRESENT | `rep/src/screens/RepRetailerDetailScreen.tsx`; `backend/src/modules/location/locationService.ts`; `backend/src/modules/location/__tests__/visitConcurrency.test.ts` | The canonical visit remains active after order placement. |
| Remaining retailer actions during active visit | PRESENT | `rep/src/screens/RepRetailerDetailScreen.tsx`; `rep/src/screens/OrderDetailScreen.tsx` | Actions and visit status are separate; verify actual device navigation. |
| Explicit checkout and Next Retailer gate | PRESENT | `rep/src/screens/OrderDetailScreen.tsx`; `rep/src/screens/orderVisitAction.ts`; backend location service | Next-retailer action depends on checkout/completion response, not order creation. |
| No-check-in does not fabricate visit completion | PRESENT | `rep/src/screens/orderVisitAction.ts`; `rep/src/screens/__tests__/feedbackV2Flow.test.ts`; backend visit routes | The display helper does not infer a completed visit from the order timestamp. |
| Add Customer Page 1 → Page 2 | PRESENT | `rep/src/screens/AddRetailerScreen.tsx` | Multi-step form and validation are retained. |
| Add Customer Page 2 begins at top with first question visible | PRESENT | `rep/src/screens/AddRetailerScreen.tsx`; `rep/src/components/KeyboardSafeScrollView.tsx`; `docs/CLIENT_FEEDBACK_V2_RECONCILIATION_MATRIX.md` | Keyed step scroll container remounts at the top; earlier device evidence exists, recheck on the unified APK. |
| Add Customer keyboard behavior | PRESENT | `rep/src/screens/AddRetailerScreen.tsx`; `rep/src/components/ui.tsx` (`KeyboardSafeScrollView`); `rep/src/layout/viewportPolicy.ts` | Shared keyboard-safe scroll behavior and layout tests are present. |
| Market Survey navigation | PRESENT | `rep/src/screens/RepAccountScreen.tsx`; `rep/src/navigation/marketSurveyNavigation.ts`; `rep/src/screens/MarketSurveysScreen.tsx` | Capability check is preserved; `survey.respond` is not bypassed to force menu visibility. |
| Backend milestone events remain authoritative | PRESENT | `backend/src/modules/performance/achievementDomain.ts`; `backend/src/modules/performance/achievementService.ts`; `rep/src/context/FieldContext.tsx` | Client filters presentation only; it does not create milestone events. |
| Target progress rail remains intact | PRESENT | `rep/src/screens/TodayScreen.tsx`; `rep/src/components/Achievement.tsx` | Existing progress state remains visible independently of the major sheet. |
| 100% target achievement major Home celebration | PRESENT | `rep/src/performance/achievementPresentation.ts`; `rep/src/screens/TodayScreen.tsx`; `rep/src/performance/__tests__/achievementPresentation.test.ts` | Present in the uncommitted delta; requires the focused test and final source commit. |
| Minor target milestones do not open major modal | PRESENT | `rep/src/performance/achievementPresentation.ts`; `rep/src/performance/__tests__/achievementPresentation.test.ts`; backend achievement tests | `TARGET_90` stays in activity/progress and is filtered from the major sheet. |
| Celebration dedupe and period reset | PRESENT | `backend/src/modules/performance/achievementService.ts`; `backend/src/modules/performance/__tests__/achievements.test.ts` | Backend dedupe remains authoritative; working-tree regression covers crossing and next period. |
| Safe-area-aware bottom navigation | PRESENT | `rep/App.tsx`; `rep/src/layout/viewportPolicy.ts`; `rep/src/layout/__tests__/viewportPolicy.test.ts` | Dynamic inset policy is present. |
| No fixed old-phone overlap / fixed bottom action safety | PRESENT | `rep/App.tsx`; `rep/src/layout/viewportPolicy.ts`; affected screen bottom-space helpers | Fixed old-height assumptions were removed in the responsive checkpoint; physical navigation modes still need smoke. |
| 1.3 font scale leaves primary controls usable | PARTIAL | `rep/src/layout/viewportPolicy.ts`; responsive screens/tests | Source adapts to viewport and inset, but full physical 1.3 font-scale verification is not yet evidenced. |

## Backend

| Feature | Status | Source file(s) | Audit note |
|---|---|---|---|
| Dynamic Jain/Padam routing; no static SKU-company override for configured routing | PRESENT | `backend/src/modules/commercial/routing.ts`; `backend/src/modules/commercial/service.ts`; `backend/src/modules/commercial/routing.test.ts` | Quote resolver computes the result from destination and eligible mix; clients display returned quote. |
| Exact Indore / Indore City override | PRESENT | `backend/src/modules/commercial/routing.test.ts` | Both exact city cases are covered. |
| Laxmi Toor always Jain and excluded from threshold | PRESENT | `backend/src/modules/commercial/routing.ts`; `backend/src/modules/commercial/routing.test.ts` | Threshold tests combine Laxmi with eligible goods. |
| Five-bag threshold and exact aggregation | PRESENT | `backend/src/modules/commercial/routing.ts`; `backend/src/modules/commercial/routing.test.ts` | Below-five and at-least-five scenarios use the resolver. |
| Instant Mix ordered KG ÷ 5 conversion | PRESENT | `backend/src/modules/commercial/routing.ts`; `backend/src/modules/commercial/routing.test.ts` | Exact decimal contribution tests and invalid override rejection are present. |
| Approved rice master-box routing contributions | PRESENT | `backend/src/modules/catalog/realCatalogue.ts`; approved real-catalogue decisions; `backend/src/modules/commercial/routing.ts` | Routing metadata is structured; do not infer from packet count in the client. |
| Six-variant real catalogue and pricing basis | PRESENT | `backend/src/modules/catalog/realCatalogue.ts`; `backend/src/routes/catalog.ts`; `backend/src/modules/commercial/` | Current product/readiness source preserves six-variant commercial values. |
| Internal staging inventory identity and WH-001 support | PRESENT | `backend/prisma/schema.prisma`; `backend/src/modules/inventory/inventoryService.ts`; `backend/scripts/seedApprovedStagingInventory.ts`; inventory tests | Staging identity remains distinct from SAP material identity. |
| Inventory freshness/orderability enforcement | PRESENT | `backend/src/modules/inventory/inventoryService.ts`; `backend/src/modules/inventory/__tests__/inventoryService.test.ts`; catalog/home/rep routes | Stale inventory is rejected server-side; client state is only presentation. |
| GST pending and no fabricated zero GST | PRESENT | `backend/src/modules/catalog/catalogueVisibility.ts`; `backend/src/lib/orders.ts`; `backend/src/modules/commercial/`; `backend/src/modules/catalog/__tests__/realCatalogue.test.ts` | Explicit `gstPendingOrderAllowed` policy is used; no default tax percentage is invented. |
| Invoice blocked until GST is configured | PRESENT | `backend/src/modules/invoicing/invoiceService.ts`; `backend/src/modules/invoicing/__tests__/invoiceService.test.ts` | Invoice service blocks tax-pending orders. |
| Idempotent order and freight behavior | PRESENT | `backend/src/modules/commercial/service.ts`; `backend/src/modules/commercial/commercialFlow.test.ts`; `backend/src/modules/commercial/routes.ts` | Existing quote/order idempotency and freight confirmation contracts remain in the lineage. |
| Service-request withdrawal, authorization, history, audit actor/time | PRESENT | `backend/src/routes/serviceRequests.ts`; `backend/src/modules/field/issueService.ts`; `backend/src/modules/field/__tests__/retailerServiceRequestDb.test.ts`; `backend/prisma/migrations/20260924060000_feedback_v2_service_request/migration.sql` | Source and DB-backed concurrency test are present; hosted API is not changed by this task. |
| Cross-team issue visibility fix | PRESENT | `backend/src/modules/field/issueService.ts`; `backend/src/modules/field/__tests__/retailerServiceRequestDb.test.ts`; `docs/CLIENT_FEEDBACK_V2_RECONCILIATION_MATRIX.md` | Reassignment visibility is restricted to intended retailer-origin requests. |
| Route replacement / concurrent skip safety | PRESENT | `backend/src/modules/field/routeService.ts`; `backend/src/modules/field/__tests__/routeSkipConcurrencyDb.test.ts`; `backend/src/modules/field/__tests__/routeService.test.ts` | Lock ordering and concurrent replacement/skip coverage are present. |
| Exactly 46 migrations and required names | PRESENT | `backend/prisma/migrations/` | 46 migration directories; required staging inventory, pending GST, and feedback-v2 migration names are present. |
| Obsolete staging-inventory migration excluded | PRESENT | `backend/prisma/migrations/` | `20260917150000_staging_inventory_identity` is absent from the selected source. |

## Admin

| Feature | Status | Source file(s) | Audit note |
|---|---|---|---|
| Existing Gagan Operations Console retained | PRESENT | `admin/src/App.tsx`; `admin/src/pages/` | The source is the reconciled Admin tree, not an older donor branch. |
| Real-catalogue and six-variant pricing display | PRESENT | `admin/src/pages/Catalog.tsx`; `admin/src/pages/__tests__/Catalog.test.tsx`; `admin/src/pages/Commercial.tsx` | Stored rate basis and derived equivalents are visible. |
| Orderability and dynamic routing detail | PRESENT | `admin/src/pages/Commercial.tsx`; `backend/src/routes/admin/catalog.ts`; `backend/src/modules/commercial/routing.ts` | Routing explanation comes from the quote/service contract. |
| GST pending and invoice blocker visibility | PRESENT | `admin/src/pages/Commercial.tsx`; `admin/src/pages/Catalog.tsx`; backend invoice/catalog services | Pending tax is explicit and final invoice creation remains blocked until configured. |
| Service requests and Withdrawn status | PRESENT | `admin/src/pages/ServiceIssues.tsx`; `admin/src/pages/__tests__/ServiceIssues.test.tsx`; `backend/src/routes/serviceRequests.ts` | Withdrawn rows remain visible and are not offered another transition. |

## Old APK provenance and exclusions

The circulated pair in `CURRENT/BUILDS/CLIENT-FINAL-v1/` is recorded in `FINAL_CLIENT_PACKAGE_MANIFEST.md` as using source `77ec09943dc257a60f5872ec483074195ec54f72`; the Salesperson APK bundle also contains that source identity. Retailer SHA-256 is `a07bf60c8e77666f88c23d8b2e954d0998ed81c3bcddd78610439f7ab87d89b5`; Salesperson SHA-256 is `ba52eb21a31d4d101ccca6285ce198cf6f5299ec1f95d89b01db04263a6beadc`. They are version codes 11 and 12, while the phone currently has codes 17 and 19. They are not the source or artifacts for this unified acceptance.

The old source predates the six-variant client pricing/GST-pending work, Feedback-v2 request-withdrawal UI and backend migration, six-variant staging-inventory/GST-pending migrations, route-skip concurrency and cross-team issue fixes, safe-area responsive checkpoint, and the current target-celebration presentation delta. These later features are present in the selected source; the new APK pair is still required to physically verify the exact unified checkpoint.

## Fresh local verification — 2026-09-24

- Fresh disposable PostgreSQL database `gagan_unified_20260924_test_1849` was created on local loopback only. All 46 migrations applied from zero; Prisma validation passed and migration status reported the schema up to date. The standard development seed and tests ran only against this disposable DB; no hosted database was configured or used.
- Backend full suite: 140 files / 982 tests passed. Backend typecheck and production build passed.
- Admin full suite: 23 files / 62 tests passed. Typecheck, lint, and production build passed.
- Retailer full suite: 26 files / 113 tests passed. Typecheck passed.
- Salesperson full suite: 40 files / 207 tests passed. Typecheck passed.
- Focused commercial regressions: backend real-catalogue/routing/commercial-flow/inventory/invoice/quote, 6 files / 75 tests passed; Retailer price/tax/orderability, 3 files / 16 tests passed; Salesperson price/tax/ordering, 3 files / 13 tests passed. Target-celebration focus: backend 35 tests and Salesperson 4 tests passed.
- `git diff --check` passed. These are local source/test results, not hosted or device acceptance.

## Evidence boundaries still open

- New unified APKs have not yet been built or installed.
- Physical acceptance for 1.3 font scale, alternate navigation mode, current service-request withdrawal display, and all six variant Add/Review paths remains pending. The continuation plan requires each named review Store profile and signer/provenance path to be verified immediately before an in-place install; if a profile is missing or cannot be verified, that app is not installed and no data is cleared.
- The connected Moto E13 currently reports no matching `gagan-hosted-review` or `gagan-sales-review` Store profile in its account records, and both installed apps report `installer=null`; the update/install gate is therefore not cleared. This must not be inferred as evidence that the Gagan app session itself is signed out.
- The authorized Render `gagan-api` dashboard shows auto-deploy disabled. GitHub CI runs on pull requests and `main` pushes only. The separate Vercel Admin project's branch-preview behavior was not verified, so no remote branch push is being made under the no-hosted-deployment boundary.
- No deployment or hosted database write has been performed by this task.
