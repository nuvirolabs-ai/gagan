# Salesperson Baseline Recovery Matrix

Status: working recovery record for `codex/gagan-salesperson-canonical-v1`.

This matrix separates source evidence from physical-device evidence. A source
check or a unit test is not treated as a device acceptance result. The
canonical integration base is the current Survey/navigation line
`32e9ac85a81802c5fb11a1d8ad49cf43056590a4`; the UX donor changes were ported
from `83f6b1b`, `3a82ee5`, and `966e082` without importing their unrelated
backend/schema history.

| Behaviour / fix | Source commit or acceptance evidence | Current source status | Current phone status | Backend / permission dependency | Reconciliation decision | Regression test | Final physical result |
|---|---|---|---|---|---|---|---|
| Shared Android keyboard-safe scrolling | `0b5141a`, `89a4a2c`, `56ac00b`, `c1ca8d6`; `83f6b1b` | Present as `KeyboardSafeScrollView` | Pending canonical APK | None beyond existing screen contracts | Restored shared wrapper | Screen/typecheck plus affected form smoke | Pending |
| Focused fields auto-scroll above IME | `89a4a2c`, `56ac00b` | Present in shared wrapper | Pending | Android IME | Restored | Keyboard focus behavior | Pending |
| Form CTA remains reachable above keyboard | `c1ca8d6`; prior physical evidence in UX V2 | Present in shared wrapper/content padding | Pending | Android IME | Restored | Form layout/typecheck | Pending |
| No duplicate keyboard-height padding | `83f6b1b` reconciliation audit | Add Retailer duplicate listener removed | Pending | None | Preserved one-owner contract | Source inspection and form smoke | Pending |
| No permanent bottom viewport gap | `e47e38e`; `207aac6` checklist | Existing viewport policy retained; UX changes add no tab-bar spacer | Pending | Navigation model | Preserved current shell | `viewportPolicy.test.ts` | Pending |
| Bottom safe-area ownership | `e47e38e`; `d95e292` acceptance | Existing normal-flow tab contract retained | Pending | React Navigation | No screen-level tab-bar reservation added | `viewportPolicy.test.ts` | Pending |
| Shared editable date field | `422c475`; `83f6b1b` | `DateField` present | Pending | None | Restored | `dateOnly.test.ts`, date helper tests | Pending |
| Leave From calendar | `422c475`, `207aac6` | Present in `MyDayScreen` | Pending | Leave API | Restored | Date bounds tests | Pending |
| Leave To cannot precede From | `207aac6` checklist | `minDate={fromDate}` preserved | Pending | None | Restored | Date field test/source check | Pending |
| Expense date and UTC-noon serialization | `422c475`, `207aac6` | Present | Pending | Expense API | Restored | `dateOnly.test.ts`, expense date helper | Pending |
| Seven-column calendar geometry | `d95e292` acceptance | Explicit seven-cell rows present | Pending | None | Preserved corrected geometry | Calendar helper tests | Pending |
| Calendar cancel/back/month navigation | `207aac6` checklist | Present | Pending | None | Preserved | Date field interaction test | Pending |
| Selected date survives interaction/API serialization | `207aac6` checklist | Present | Pending | Expense/leave API | Restored | Date-only tests | Pending |
| Follow-up presets and custom date | `207aac6` checklist | Current `ActivityComposer` behavior preserved | Pending | Activity API | Did not import later simplification | Existing activity/date tests | Pending |
| Explicit Catalogue → Review Order checkpoint | `3a82ee5`, `d95e292` | `RepReviewOrderScreen` and route present | Pending | Existing quote/order API | Restored | `sellingFlow.test.ts` | Pending |
| Backend-authoritative quote/revision | `207aac6`, `d95e292` | Current quote/revision flow retained | Pending | CommercialQuote | Did not port quote-less donor | `sellingFlow.test.ts`, commercial tests | Pending |
| Null legacy quote handling | `966e082`, `d95e292` | Standard-case legacy path preserved | Pending | Existing legacy basket semantics | Restored narrow client fix | `sellingFlow.test.ts` | Pending |
| Place Order duplicate-submit lock/idempotency | `966e082`, `d95e292` | Current canonical submit lock/key retained | Pending | Existing `/rep/orders` contract | Preserved | `sellingFlow.test.ts` | Pending |
| Canonical Order Detail after submit | `3a82ee5`, `d95e292` | Existing `OrderDetailScreen` remains single truth | Pending | Order read API | Restored navigation only | `sellingFlow.test.ts` | Pending |
| Done / Next retailer continuation | `3a82ee5`, `d95e292` | Present | Pending | Retailer list | Restored | `sellingFlow.test.ts` | Pending |
| Home ordering and no-visit fallback | `3a82ee5`, `d95e292` | Restored current accepted ordering | Pending | Today/read-cache API | Preserved current server state | Home/presentation tests | Pending |
| Next Visit / legitimate no-visit state | `d95e292` acceptance | Present | Pending | Route/day data | No fabricated route state | Home source check | Pending |
| Needs Attention and field metrics | `d95e292` acceptance | Present | Pending | Today API | Preserved | Attention/presentation tests | Pending |
| My Day calendar and Leave presentation | `d95e292` acceptance | Vertical attendance rewrite remains removed | Pending | Attendance/leave API | Preserved current implementation | Attendance/date tests | Pending |
| Attendance/check-in continuation to Catalogue | `d95e292` acceptance | Current check-in flow retained | Pending | GPS/visit API and valid UAT state | No GPS or visit fabrication | Source tests | Pending / blocked if no valid visit |
| NOT ORDERING only in validated visit context | `d95e292` acceptance | Existing guard retained | Pending | Open visit/activity reads | Preserved business guard | Selling/field tests | Pending / blocked if no valid visit |
| Today cache after offline force-stop | `e62e804`, `d95e292` evidence | Cache source retained | Pending | Existing read fallback | Preserved | `operationalReadCache.test.ts` | Pending |
| Reconnect/manual refresh | `e62e804`, `d95e292` evidence | Existing refresh/fallback retained | Pending | Network/API | Preserved | Operational cache tests | Pending |
| Account-isolated outbox | `d7915ad`, `c9b0eae`, P0 manifest | Account-scoped outbox retained | Pending | Authenticated staff ID | Preserved | Outbox durability/isolation tests | Pending |
| Route cache | `b6d2d23`, `e62e804` | Present | Pending | Route API | Preserved; physical route acceptance remains separate | Operational cache tests | Pending |
| Issues list/detail | `207aac6` reconciliation | Current supported list/detail retained | Pending | Current issue API | Preserved | Issue API/source tests | Pending |
| Obsolete rep resolve/withdraw issue API | `665ce17` donor excluded | Not imported | N/A | Current backend does not expose donor route | Deliberately excluded | No obsolete endpoint claim | Excluded |
| Current onboarding/proposal/withdrawal contract | `207aac6` reconciliation | Current contract retained | Pending | Current proposal API/schema | Did not import alternate migration | Existing proposal tests | Pending |
| Market Surveys More entry | `32e9ac8` | Permission-aware entry retained | Pending | `survey.respond` permission | Preserved newer navigation | `marketSurveyNavigation.test.ts` | Pending |
| Market Survey retailer context | `c1a0c49`, `32e9ac8` | Kaveri context route retained | Pending | Audience and permission | Preserved | Survey/navigation tests | Pending |
| Market Survey audience isolation | `32e9ac8` plus survey acceptance | Current audience guard retained | Pending | Survey API permissions | No audience/data changes | Survey tests | Pending |
| Collections/order/invoice navigation | Current RC and P0 manifests | Existing screens/contracts retained | Pending | Wave 1B APIs | No commercial changes | Existing API tests | Pending |
| Build identity in More | This recovery checkpoint | Added read-only source/version/API label | N/A until APK | Build-time non-secret env only | Added for artifact traceability | `buildInfo.test.ts` | Pending |

## Donor decisions

- Ported the compatible `rep/` UX changes from the accepted reconciliation and
  refinement commits.
- Kept the newer permission-aware Survey navigation from `32e9ac8`.
- Kept the current 39-migration backend/Admin/Retailer/commercial line.
- Did not import the old issue lifecycle migration or obsolete rep endpoints.
- Did not import the alternate onboarding migration or whole-screen rewrites.
- Did not change the frozen `gagan-salesperson-template-v1` tag.

## Evidence boundary

The phone state at the start of this recovery was a review package with
versionCode 1 and an artifact identity that did not match the supplied UX V2
APK. That is diagnostic evidence of an untraceable/incomplete installed build,
not acceptance of any source line. Final physical results will be filled only
after the exact APK from this branch is installed as a compatible update.
