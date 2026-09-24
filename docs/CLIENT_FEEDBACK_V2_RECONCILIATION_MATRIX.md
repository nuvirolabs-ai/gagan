# Gagan Feedback v2 source reconciliation matrix

Source states: A = hosted `5a632711025f5eb6d42a75e26529ce739f06f982`; B = accepted mobile `83efa52d8125046a66b0c8e88cbc4bcc7fe0a60c`; C = Feedback-v2 patch `865a89a77b91ee93f8a9fce0247a857cc2a2b1d9`. `M/A/D` are changes from the preceding state; `—` means unchanged. This is a pre-merge inventory, not acceptance.

Decision rules: preserve A backend/Admin and all its migration identities; port only reviewed C feedback hunks. Preserve B mobile/rep UX and port reviewed C feedback hunks. Any file changed on both legs is a conflict requiring hunk-level reconciliation. Never copy the C migration directory wholesale.

| File | A→B | B→C | Classification | Intended resolution |
|---|---:|---:|---|---|
| `admin/src/pages/Catalog.tsx` | M | — | HOSTED BASE | Retain A |
| `admin/src/pages/Commercial.tsx` | M | — | HOSTED BASE | Retain A |
| `admin/src/pages/ServiceIssues.tsx` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `admin/src/pages/__tests__/Catalog.test.tsx` | D | — | HOSTED BASE | Retain A |
| `admin/src/pages/__tests__/ServiceIssues.test.tsx` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/package.json` | M | — | HOSTED BASE | Retain A |
| `backend/prisma/migrations/20260917150000_staging_inventory_identity/migration.sql` | A | — | OBSOLETE | Exclude old inventory identity |
| `backend/prisma/migrations/20260922180000_internal_staging_inventory/migration.sql` | D | — | HOSTED BASE | Retain A migration unchanged |
| `backend/prisma/migrations/20260922200000_pending_gst_ordering/migration.sql` | D | — | HOSTED BASE | Retain A migration unchanged |
| `backend/prisma/migrations/20260924060000_feedback_v2_service_request/migration.sql` | — | A | FEEDBACK-V2 DELTA | Validate SQL against A schema; add one migration after hosted 45 |
| `backend/prisma/schema.prisma` | M | M | CONFLICT | Retain A; port only reviewed C feedback change |
| `backend/scripts/bootstrapFeedbackV2TestRoles.ts` | — | A | OBSOLETE | Exclude: hard-coded guard for the patch branch's former local database; existing role seed supports disposable tests |
| `backend/scripts/realCatalogueImport.ts` | M | — | HOSTED BASE | Retain A |
| `backend/scripts/seedApprovedStagingInventory.ts` | D | — | HOSTED BASE | Retain A |
| `backend/src/__tests__/commercialQuote.test.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/app.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/lib/commercialQuote.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/lib/orders.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/catalog/__tests__/realCatalogue.test.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/catalog/catalogueVisibility.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/catalog/realCatalogue.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/commercial/commercialFlow.test.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/commercial/routes.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/commercial/service.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/field/__tests__/fakePrisma.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/field/__tests__/fieldIntegration.test.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/field/__tests__/retailerServiceRequest.test.ts` | — | A | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/field/__tests__/retailerServiceRequestDb.test.ts` | — | A | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/field/__tests__/routeService.test.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/field/issueService.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/field/routeService.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/imports/importService.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/inventory/__tests__/internalInventorySelection.test.ts` | D | — | HOSTED BASE | Retain A |
| `backend/src/modules/inventory/__tests__/inventoryIdentity.test.ts` | A | — | HOSTED BASE | Retain A |
| `backend/src/modules/inventory/__tests__/inventoryService.test.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/inventory/inventoryService.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/invoicing/invoiceService.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/modules/location/__tests__/visitConcurrency.test.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/modules/location/locationService.ts` | — | M | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/routes/__tests__/serviceRequests.test.ts` | — | A | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `backend/src/routes/admin/catalog.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/routes/catalog.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/routes/home.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/routes/rep.ts` | M | — | HOSTED BASE | Retain A |
| `backend/src/routes/serviceRequests.ts` | — | A | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
| `docs/assets/gagan-login-reference-20260917.png` | A | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `docs/real-catalogue/ORDERING_SETUP_DIAGNOSIS_2026-09-22.md` | D | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `docs/real-catalogue/SIX_VARIANT_READINESS_2026-09-22.md` | D | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `docs/real-catalogue/real-catalogue-decisions-owner-approved-r1.json` | M | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `docs/release/gagan-client-demo-staging-before-state.md` | A | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `docs/superpowers/plans/2026-09-17-gagan-client-demo-final.md` | A | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `docs/superpowers/plans/2026-09-17-retailer-commerce-polish.md` | A | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `docs/superpowers/plans/2026-09-24-gagan-client-feedback-v2.md` | — | A | FEEDBACK-V2 DELTA | Preserve relevant evidence only; no runtime overwrite |
| `docs/superpowers/specs/2026-09-17-gagan-client-demo-final-design.md` | A | — | HOSTED BASE | Preserve relevant evidence only; no runtime overwrite |
| `mobile/App.tsx` | M | M | CONFLICT | Use B accepted UX; port C feedback change |
| `mobile/assets/auth/gagan-retailer-login.png` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/babel.config.js` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/eas.json` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/api/retailerApi.ts` | — | M | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `mobile/src/buildInfo.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/buildInfo.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/components/CommercialBreakdown.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/components/MiniCartBar.tsx` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/components/ProductGroupCard.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/components/TabBar.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/components/home/HomeSkeleton.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/components/home/RetailerPromoCarousel.tsx` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/i18n/translations.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/__tests__/catalogInteractions.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/__tests__/catalogPricePresentation.test.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/__tests__/commercialTaxPresentation.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/__tests__/miniCart.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/__tests__/retailerCommercePolish.test.ts` | A | M | CONFLICT | Use B accepted UX; port C feedback change |
| `mobile/src/lib/__tests__/retailerPromotions.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/__tests__/serviceRequestState.test.ts` | — | A | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `mobile/src/lib/catalogInteractions.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/catalogPricePresentation.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/commercialQuoteState.test.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/commercialTaxPresentation.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/homeProductPreview.ts` | — | A | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `mobile/src/lib/miniCart.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/miniCartVisibility.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/retailerPromotions.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/lib/serviceRequestState.ts` | — | A | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `mobile/src/screens/CartScreen.tsx` | M | M | CONFLICT | Use B accepted UX; port C feedback change |
| `mobile/src/screens/CatalogScreen.tsx` | M | M | CONFLICT | Use B accepted UX; port C feedback change |
| `mobile/src/screens/HomeScreen.tsx` | M | M | CONFLICT | Use B accepted UX; port C feedback change |
| `mobile/src/screens/LoginScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/screens/OrderHistoryScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/screens/ProductDetailScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/screens/ProfileScreen.tsx` | M | M | CONFLICT | Use B accepted UX; port C feedback change |
| `mobile/src/screens/ServiceRequestsScreen.tsx` | — | A | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `mobile/src/screens/__tests__/loginBranding.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/screens/loginBranding.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/theme.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `mobile/src/types/home.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/assets/auth/gagan-sales-login.png` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/eas.json` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/components/ActivityComposer.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/components/CommercialBreakdown.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/components/companion.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/i18n/translations.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/__tests__/catalogOrdering.test.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/__tests__/catalogPricePresentation.test.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/__tests__/clientPresentation.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/__tests__/commercialTaxPresentation.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/catalogOrdering.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/catalogPricePresentation.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/catalogSelection.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/commercialQuoteState.test.ts` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/lib/commercialTaxPresentation.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/AddRetailerScreen.tsx` | — | M | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `rep/src/screens/MarketSurveysScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/OrderDetailScreen.tsx` | — | M | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `rep/src/screens/RepAccountScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/RepCatalogScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/RepLoginScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/RepReviewOrderScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/SalesKitScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/TodayScreen.tsx` | M | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/__tests__/feedbackV2Flow.test.ts` | — | A | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |
| `rep/src/screens/__tests__/loginBranding.test.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/loginBranding.ts` | A | — | ACCEPTED MOBILE DELTA | Use B accepted UX |
| `rep/src/screens/orderVisitAction.ts` | — | A | FEEDBACK-V2 DELTA | Use B accepted UX; port C feedback change |

## Open conflicts

Resolved in the reconciled source:

- Hosted A is the Git ancestor and remains authoritative for backend catalogue, commercial quote, inventory, invoice, imports, Admin catalogue, Admin commercial, package configuration, and the 45 original migrations. The only backend/Admin source changes relative to A are the Feedback-v2 service-request and visit/route hunks listed above.
- The Retailer and Salesperson working trees are byte-for-byte identical to C for their tracked source and assets after recording added files with Git. C itself descends from accepted B for these app trees, so both the accepted client presentation and its Feedback-v2 changes are present. No A mobile tree was copied over B.
- The schema conflict was resolved by applying only the `ServiceIssue` status/ownership/withdrawal fields to A. A's `InventorySnapshot.internalMaterialId` and `Variant.gstPendingOrderAllowed` are retained. The Feedback migration applies after A's 45 migrations; the old inventory identity migration is excluded.
- No shared package/config changes from B or C were required for the Feedback feature. A backend/Admin package configuration is retained. B/C app configuration is retained in the app trees.

Local verification on disposable PostgreSQL databases: fresh 0→46 migration PASS; hosted-style 45→46 applied only `20260924060000_feedback_v2_service_request` PASS. Full suites: backend 977, Admin 62, Retailer 112, Salesperson 202 tests PASS. Backend and Admin builds, Admin lint, and both mobile typechecks PASS. These are local source checks, not hosted deployment or physical-device acceptance.
