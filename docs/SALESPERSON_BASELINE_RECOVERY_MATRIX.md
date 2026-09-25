# Salesperson Baseline Recovery Matrix

Status: source and physical recovery record for `codex/gagan-salesperson-canonical-v1`.

This matrix deliberately separates source/test evidence from device evidence.
The accepted review artifact was rebuilt from a fresh, isolated checkout with a
cleared Expo export cache. The first versionCode 6 build was rejected because
its native metadata and embedded JavaScript build label disagreed; it is not an
accepted artifact. The replacement currently installed on the Moto E13 is
`com.gagan.sales.review` versionCode 6/versionName 1.0.6 and visibly reports
`1.0.6 · b5b92ed · canonical-v1 · gagan-srat.onrender.com`.

The integration base is `32e9ac85a81802c5fb11a1d8ad49cf43056590a4`. UX donor
changes were ported dependency by dependency from `83f6b1b`, `3a82ee5`, and
`966e082`; their unrelated backend/schema histories were not imported.

| Behaviour / fix | Source commit or acceptance evidence | Current source status | Current phone status | Backend / permission dependency | Reconciliation decision | Regression test | Final physical result |
|---|---|---|---|---|---|---|---|
| Shared Android keyboard-safe scrolling | `0b5141a`, `89a4a2c`, `56ac00b`, `c1ca8d6`; `83f6b1b` | Present as `KeyboardSafeScrollView` | PASS — exact artifact field-focus capture | Android IME | Restored shared wrapper | Screen/typecheck and form smoke | `32-final-v2-expense-keyboard.png`; CTA reachability is also shown by same-source predecessor evidence |
| Focused fields auto-scroll above IME | `89a4a2c`, `56ac00b` | Present in shared wrapper | PASS — exact artifact keyboard opens without losing form context | Android IME | Restored | Keyboard focus behavior | `32-final-v2-expense-keyboard.png` |
| Form CTA remains reachable above keyboard | `c1ca8d6`; prior UX V2 physical evidence | Present in shared wrapper/content padding | PARTIAL — exact artifact capture was interrupted by an unrelated foreground switch during the scroll gesture; same-source evidence remains | Android IME | Preserved one-owner layout | Form layout/typecheck | Prior valid CTA capture retained; interrupted frame excluded |
| No duplicate keyboard-height padding | `83f6b1b` reconciliation audit | Add Retailer duplicate listener removed | PASS — no permanent blank band in exact Home/My Day/retailer-context frames | None | Preserved one-owner contract | Source inspection and form smoke | `09-final-v2-home.png`, `16-final-v2-date-range.png`, `25-final-v2-retailer-context.png` |
| No permanent bottom viewport gap | `e47e38e`; `207aac6` checklist | Existing viewport policy retained; no screen tab-bar spacer added | PASS | Navigation model | Preserved current shell | `viewportPolicy.test.ts` | Exact Home/More/Survey frames use the available area through the visible navigation layer |
| Bottom safe-area ownership | `e47e38e`; `d95e292` acceptance | Existing normal-flow tab contract retained | PASS | React Navigation | No screen-level tab-bar reservation added | `viewportPolicy.test.ts` | `09-final-v2-home.png`, `28-final-v2-more-top.png` |
| Shared editable date field | `422c475`; `83f6b1b` | `DateField` present | PASS | None | Restored | `dateOnly.test.ts`, helper tests | `14-final-v2-from-calendar.png` |
| Leave From calendar | `422c475`, `207aac6` | Present in `MyDayScreen` | PASS | Leave API | Restored | Date bounds tests | `14-final-v2-from-calendar.png`, `15-final-v2-date-selected.png` |
| Leave To cannot precede From | `207aac6` checklist; `b5b92ed` | `minDate={fromDate}` plus range reconciliation | PASS | None | Fixed minimal durable client behavior | `dateOnly.test.ts` | `16-final-v2-date-range.png` shows From and To both Thu, 17 Sept 2026 |
| Expense date and UTC-noon serialization | `422c475`, `207aac6` | Present | PASS for field/date presentation; serialization covered by source tests | Expense API | Restored | `dateOnly.test.ts`, expense date helper | `31-final-v2-expense-form.png` |
| Seven-column calendar geometry | `d95e292` acceptance | Explicit seven-cell rows present | PASS | None | Preserved corrected geometry | Calendar helper tests | `11-final-v2-my-day.png`, `14-final-v2-from-calendar.png` |
| Calendar cancel/back/month navigation | `207aac6` checklist | Present | PASS for visible native flow; no destructive submit | None | Preserved | Date field interaction test | `14-final-v2-from-calendar.png` and app back navigation |
| Selected date survives interaction/API serialization | `207aac6` checklist | Present | PASS for selected range retention; API serialization source-tested | Expense/leave API | Restored | Date-only tests | `15-final-v2-date-selected.png`, `16-final-v2-date-range.png` |
| Follow-up presets and custom date | `207aac6` checklist | Current `ActivityComposer` behavior preserved | NOT RUN — no follow-up action needed for non-mutating recovery | Activity API | Did not import later simplification | Existing activity/date tests | Source preserved; no new activity submitted |
| Explicit Catalogue → Review Order checkpoint | `3a82ee5`, `d95e292` | `RepReviewOrderScreen` and route present | BLOCKED — no valid active visit/route fixture | Existing quote/order API | Restored | `sellingFlow.test.ts` | No fabricated visit or order |
| Backend-authoritative quote/revision | `207aac6`, `d95e292` | Current quote/revision flow retained | NOT RUN physically | CommercialQuote | No quote-less donor import | `sellingFlow.test.ts`, commercial tests | Source/test evidence only |
| Null legacy quote handling | `966e082`, `d95e292` | Standard-case legacy path preserved | NOT RUN physically | Existing legacy basket semantics | Restored narrow client fix | `sellingFlow.test.ts` | Source/test evidence only |
| Place Order duplicate-submit lock/idempotency | `966e082`, `d95e292` | Current canonical submit lock/key retained | NOT RUN — would create a business order | Existing `/rep/orders` contract | Preserved | `sellingFlow.test.ts` | No unnecessary transaction created |
| Canonical Order Detail after submit | `3a82ee5`, `d95e292` | Existing `OrderDetailScreen` remains single truth | BLOCKED — no valid active visit/order fixture | Order read API | Restored navigation only | `sellingFlow.test.ts` | No second order-detail implementation |
| Done / Next retailer continuation | `3a82ee5`, `d95e292` | Present | BLOCKED — same valid-order fixture dependency | Retailer list | Restored | `sellingFlow.test.ts` | Not promoted without a real order |
| Home ordering and no-visit fallback | `3a82ee5`, `d95e292` | Restored current accepted ordering | PASS | Today/read-cache API | Preserved current server state | Home/presentation tests | `09-final-v2-home.png` |
| Next Visit / legitimate no-visit state | `d95e292` acceptance | Present | PASS — legitimate `No next visit assigned` state | Route/day data | No fabricated route state | Home source check | `09-final-v2-home.png` |
| Needs Attention and field metrics | `d95e292` acceptance | Present | PASS | Today API | Preserved | Attention/presentation tests | `09-final-v2-home.png` |
| My Day calendar and Leave presentation | `d95e292` acceptance | Current implementation retained | PASS | Attendance/leave API | Preserved | Attendance/date tests | `11-final-v2-my-day.png`, `16-final-v2-date-range.png` |
| Attendance/check-in continuation to Catalogue | `d95e292` acceptance | Current check-in flow retained | BLOCKED — no valid published route/visit; no GPS fabrication | GPS/visit API | No fabricated state | Source tests | Exact blocker recorded |
| NOT ORDERING only in validated visit context | `d95e292` acceptance | Existing guard retained | BLOCKED — no valid active visit | Open visit/activity reads | Preserved business guard | Selling/field tests | Exact blocker recorded |
| Today cache after offline force-stop | `e62e804`, `d95e292` evidence | Cache source retained | PASS by valid same-source versionCode 6 evidence; current recapture interrupted by foreground change | Existing read fallback | Preserved | `operationalReadCache.test.ts` | `06-final-offline-cached-settled.png` is valid Gagan evidence; unrelated frames excluded |
| Reconnect/manual refresh | `e62e804`, `d95e292` evidence | Existing refresh/fallback retained | PASS by valid same-source versionCode 6 evidence | Network/API | Preserved | Operational cache tests | `07-final-reconnect.png` is valid Gagan evidence |
| Account-isolated outbox | `d7915ad`, `c9b0eae`, P0 manifest | Account-scoped outbox retained | NOT RUN physically — no second controlled identity and no logout | Authenticated staff ID | Preserved | Outbox durability/isolation tests | Source/test evidence only |
| Route cache | `b6d2d23`, `e62e804` | Present | BLOCKED — no published route for this identity | Route API | Preserved; physical route acceptance remains separate | Operational cache tests | No fabricated route |
| Issues list/detail | `207aac6` reconciliation | Current supported list/detail retained | NOT RUN physically | Current issue API | Preserved | Issue API/source tests | No issue mutation |
| Obsolete rep resolve/withdraw issue API | `665ce17` donor excluded | Not imported | EXCLUDED | Current backend does not expose donor route | Deliberately excluded | No obsolete endpoint claim | Documented exclusion |
| Current onboarding/proposal/withdrawal contract | `207aac6` reconciliation | Current contract retained | NOT RUN physically | Current proposal API/schema | Did not import alternate migration | Existing proposal tests | Documented compatibility decision |
| Market Surveys More entry | `32e9ac8` | Permission-aware entry retained | PASS | `survey.respond` permission | Preserved newer navigation | `marketSurveyNavigation.test.ts` | `21-final-v2-survey-entry.png`, `22-final-v2-market-surveys.png` |
| Market Survey retailer context | `c1a0c49`, `32e9ac8` | Kaveri context route retained | PASS | Audience and permission | Preserved | Survey/navigation tests | `25-final-v2-retailer-context.png` shows Open store surveys |
| Market Survey audience isolation | `32e9ac8` plus survey acceptance | Current audience guard retained | NOT RUN physically | Survey API permissions | No audience/data changes | Survey tests | Source/test evidence only |
| Collections/order/invoice navigation | Current RC and P0 manifests | Existing screens/contracts retained | NOT RUN physically | Wave 1B APIs | No commercial changes | Existing API tests | No financial mutation |
| Build identity in More | This recovery checkpoint | Read-only source/version/API label added | PASS | Build-time non-secret env only | Added for artifact traceability | `buildInfo.test.ts` | `08-final-build-info.png` visibly reports exact embedded identity |

## Donor decisions

- Ported compatible `rep/` UX changes from the accepted reconciliation and
  refinement commits.
- Kept newer permission-aware Survey navigation from `32e9ac8`.
- Kept current 39-migration backend/Admin/Retailer/commercial line.
- Did not import the old issue lifecycle migration or obsolete rep endpoints.
- Did not import the alternate onboarding migration or whole-screen rewrites.
- Did not change the frozen `gagan-salesperson-template-v1` tag.

## Exact-artifact evidence key

The current versionCode 6 replacement APK is
`/Users/tanutejas/Desktop/gagan-salesperson-canonical-v1-b5b92ed-v2.apk` with
SHA-256 `876627642a1fff1b9b3b0ddf0d0f197e28e52bf810c4c9f13087b8fe95975ba7`.
Exact replacement captures include `08`, `09`, `11`, `14`–`16`, `21`–`25`,
and `30`–`32` in `/Users/tanutejas/Desktop/gagan-salesperson-canonical-v1-evidence-b5b92ed`.
The exact build identity is verified on-device. The valid same-source cache
captures `06` and `07` remain acceptable for the unchanged offline/cache code.

The following frames are explicitly excluded from acceptance because the
foreground was not Gagan at capture time: the earlier unrelated Dogkart frame,
the later unrelated system/Sukoon frame, and the interrupted offline/keyboard
recapture frames. No action was taken in Dogkart.

## Evidence boundary

The original phone state was an untraceable review package with versionCode 1.
The first post-fix versionCode 6 artifact was rejected when its native metadata
said 1.0.6 while the embedded JavaScript still reported 1.0.5/549b9f7. The
replacement was rebuilt from a fresh checkout with a cleared export cache and
the native and embedded labels now agree. A valid active route and a second
controlled account were not available, so route/check-in/order and physical
account-isolation claims remain blocked rather than being fabricated.
