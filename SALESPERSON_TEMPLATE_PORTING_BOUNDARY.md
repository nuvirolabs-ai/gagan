# Gagan Salesperson Template Porting Boundary

This document defines what a future branded port may reuse from the frozen Gagan Salesperson Template V1 and what must be replaced or reimplemented. The template is a presentation, interaction, and mobile-architecture reference—not a permission to copy Gagan business data or infrastructure.

## Reusable template boundary

The following areas are suitable as the starting point for a branded field-sales port:

### Presentation

- React Native screen composition and hierarchy;
- shared presentation components in `rep/src/components`;
- design tokens and surface rules in `rep/src/theme.ts`;
- typography scale, spacing rhythm, radii, button anatomy, list rows, sheets, and empty/loading/error states;
- Home composition, Next Visit treatment, target instrument, route presentation, reports cockpit, timeline, retailer detail, and guided New Retailer form patterns;
- consistent icon sizing, touch-target treatment, pressed states, and selected navigation states.

### Navigation and safe-area architecture

- the root navigation structure and screen-shell conventions;
- bottom navigation geometry and its single-owner safe-area policy;
- scroll-content bottom inset behavior;
- keyboard avoidance and sticky action placement patterns;
- screen transition and modal/bottom-sheet interaction patterns.

### Interaction and performance patterns

- state-aware action dispatch pattern used by the Home Attendance shortcut;
- in-flight request coalescing pattern in `rep/src/performance/singleFlight.ts`;
- loading, retry, offline, and error feedback conventions;
- focus/press behavior and accessibility semantics;
- focused tests for interaction state machines and request orchestration.

### Offline and field-work architecture

Offline/outbox patterns may be reused only after the target product's data model, authorization model, sync conflict policy, and secure-storage requirements are independently reviewed. The Gagan implementation is not a generic sync contract.

## Must never be blindly copied

The following are Gagan-specific and must be replaced, reconfigured, or independently verified in every port:

- Gagan API URLs, including `https://gagan-staging-api.onrender.com`;
- package identifier `com.gagan.sales`;
- Gagan logos, brand assets, names, copy, and staging labels;
- Gagan retailer, salesperson, route, order, SKU, inventory, pricing, credit, target, and attendance data;
- Gagan credentials, session tokens, secure-storage keys, fixtures, UAT identities, and test accounts;
- Gagan backend routes, request/response shapes, permission assumptions, and manager hierarchy;
- Gagan SAP/mock-SAP behavior and integration identifiers;
- Gagan staging environment variables and deployment configuration;
- Gagan-specific audit/evidence screenshots that contain operational data;
- Gagan-specific business calculations or policy rules.

## Porting procedure

Before creating a branded port:

1. Pin this template by the immutable Git tag `gagan-salesperson-template-v1`.
2. Create a separate brand repository or isolated branch/worktree.
3. Replace identity, assets, package ID, API configuration, data contracts, and auth/session configuration before connecting to any target backend.
4. Re-run visual, interaction, accessibility, offline, and device acceptance against the target brand's canonical data.
5. Add a new version tag for any approved template evolution; never rewrite V1.

## Dogkart boundary

Dogkart must use the frozen commit/tag as a presentation and interaction template, not a moving Gagan branch. The Dogkart port must not be started as part of the Gagan Template V1 finalization task.
