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
| `backend/scripts/bootstrapFeedbackV2TestRoles.ts` | — | A | FEEDBACK-V2 DELTA | Retain A; port only reviewed C feedback change |
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

- Backend and Admin overlaps require hunk-level review against hosted catalogue, inventory, GST-pending and invoice behavior.
- Mobile and Salesperson overlaps require accepted B presentation plus C feedback behavior.
- Shared package/config and migration differences are not resolved by choosing one tree wholesale.
