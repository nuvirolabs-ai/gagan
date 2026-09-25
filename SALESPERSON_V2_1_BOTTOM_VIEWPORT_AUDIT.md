# Gagan Salesperson V2.1 — Bottom Viewport Audit

Status: focused staging correction on `codex/gagan-salesperson-v2-1-bottom-viewport-fix`

Base: `origin/codex/gagan-staging` at `bf4c6cf59868eb560cc117a70bbf5a0a0221742e` when the isolated worktree was created.

## Defect and root cause

The Salesperson app uses React Navigation's default bottom-tab layout. The tab bar is a normal-flow sibling below each tab scene; it is not an absolute overlay. The shared `AppScreen` nevertheless read `BottomTabBarHeightContext` and added the measured tab-bar height as `paddingBottom` to every screen that used the shell. That reserved the same tab-bar height a second time inside the scene. On the Moto E13 this produced a scroll-proof blank band immediately above the visible bottom navigation.

The earlier Home-specific `TAB_BAR_SPACE` correction was therefore insufficient: the remaining reservation was global, in `AppScreen` itself, and several other screens still had the obsolete constant locally.

## Ownership audit

| Layer | Before | Final policy | Result |
| --- | --- | --- | --- |
| React Navigation `Tab.Navigator` | Normal-flow tab bar, 78dp style | Owns the tab-bar rectangle and system navigation relationship | Single tab-bar owner |
| `AppScreen` | Added `BottomTabBarHeightContext` as root padding | Root has no tab-bar padding | Duplicate reservation removed |
| Home / Today | Had already removed the old Home-specific spacer | Uses the shared 20dp final content gap | Last content clears the bar without dead space |
| Outlets | `TAB_BAR_SPACE` in list content | Shared 20dp final content gap | No full-bar reservation |
| Reports | Screen content used its own final spacing rather than the shared policy | Shared 20dp final content gap | No full-bar reservation |
| More | `TAB_BAR_SPACE + spacing.xl` | Shared 20dp final content gap | No full-bar reservation |
| Work / Collections | 120dp bottom content padding | Shared 20dp final content gap | No full-bar reservation |
| Approvals | List had no shared final gap | Shared 20dp final content gap | Consistent normal-flow list contract |
| Stack detail / catalog screens | 140dp action-dock clearance | Retained as intentional order/cart action-dock clearance | Not tab-bar space |
| Stack forms and utility screens | Native stack screen, no bottom-tab context | Retain their own content rhythm | Not affected by tab bar |
| Safe area | Top handled by the shared header helper; no bottom safe-area padding in `AppScreen` | Bottom is consumed by the normal-flow navigator/system relationship | No duplicated bottom safe area |

The new `src/layout/viewportPolicy.ts` makes the contract executable: normal-flow navigation has `rootPaddingBottom = 0` and only a small content gap; an overlay model would be explicit and would not be silently mixed into the current app.

## Measurements — physical Moto E13

Device: Moto E13, serial `ZD2229Q3KB`, 720 × 1600 px screenshot, 280 dpi. The device is using gesture navigation; the visible Android system navigation region is below the app's tab bar.

### Before

Captured from the previous installed build before the shared-shell correction:

- visible tab-bar top / scene bottom: `y = 1464 px`
- Home `ScrollView` bottom: `y = 1328 px`
- unexplained fixed band: `1464 - 1328 = 136 px`
- density conversion: `136 / 1.75 = 77.7 dp`, approximately one 78dp tab bar

This is the duplicate `AppScreen` reservation, not a normal final-content gap.

### After

Captured from the corrected standalone release build:

- Home / Reports / Outlets tab-scene bottom: `y = 1464 px`
- scroll viewport bottom: `y = 1464 px`
- visible tab-bar top: `y = 1464 px`
- fixed unused band: `0 px`
- Home lower-section final-content clearance: approximately `34–36 px`, or about `19–21 dp`
- Reports final visible row clearance: approximately `35–37 px`, or about `20–21 dp`
- Outlets final visible row clearance: approximately `35–37 px`, or about `20–21 dp`

The remaining 20dp is intentional final-content breathing room, not unavailable viewport. Normal content scrolls into the area that was previously forbidden.

## Development diagnostics

During diagnosis, a temporary development-only boundary overlay was used to distinguish the scene, `AppScreen`, scroll viewport, content, tab wrapper, and safe-area relationship. It was removed before the release build. No diagnostic flag, color, or logging path ships in the corrected build.

## Physical evidence

Evidence directory: `/Users/tanutejas/Desktop/gagan-salesperson-v2-1-bottom-gap-evidence`

| Evidence | What it proves |
| --- | --- |
| `before-home.png` | Original fixed blank band above the tab bar |
| `before-home-scrolled.png` | Home content could not occupy the band while scrolling |
| `after-home-top.png` | Corrected Home scene reaches the navigator boundary |
| `after-home-scrolled.png` | Quick Actions enters the former dead region while scrolling |
| `after-home-lower.png` | Home lower sections finish about 20dp above the bar |
| `after-reports-top.png` | Reports scroll viewport reaches the scene bottom |
| `after-reports-bottom.png` | Report content uses the former band; final row clears the bar |
| `after-outlets-top.png` | Outlets list viewport reaches the scene bottom |
| `after-outlets-bottom.png` | Outlets final rows clear the bar without a dead band |
| `after-more.png` | More screen uses the full tab scene |
| `after-retailer-detail.png` | Stack Retailer Detail uses its full stack viewport; its bottom dock is intentional order-action UI |
| `after-new-retailer-initial-fixed.png` | New Retailer stack form, keyboard closed |
| `after-new-retailer-keyboard-fixed.png` | Keyboard opens without a second tab-bar inset |
| `after-new-retailer-keyboard-fixed-bottom.png` | After scrolling, Continue is fully above the keyboard |

## QA scope

The focused correction changes only shared viewport ownership, the affected tab-screen content gaps, and the Android keyboard inset needed for the New Retailer form under edge-to-edge Android behavior. No backend, pricing, order, inventory, credit, attendance, route, SAP, or business calculation file is changed.

Physical device QA covers the connected Moto E13. No Android Virtual Device was configured on the host when checked (`emulator -list-avds` returned no entries), so the requested 360 × 800, 390 × 844, and 430 × 932 emulator captures must remain an explicit follow-up rather than being represented as completed evidence.
