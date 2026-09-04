# Gagan Salesperson — Touch Geometry Audit

## Scope and release boundary

This P0 pass is limited to the salesperson app touch/render geometry regression. It is based on the isolated `codex/gagan-salesperson-touch-geometry-fix` branch from `origin/codex/gagan-salesperson-v2-2-material-motion` at `cffac69ad5e1afbde312a909bf06f447aa06d379`. The canonical `/Users/tanutejas/Documents/Gagan` checkout and `codex/gagan-staging` remain untouched. No backend, business calculation, SAP, Admin, Retailer, Founder, production, or `main` files were changed.

Physical device used: Moto E13, serial `ZD2229Q3KB`, 720×1600 physical display, approximately 720×1510 application window, 280 dpi.

## Reproduction

The regression was reproduced on the V2.2 release APK on the physical Moto E13. The bottom-tab native `Button` nodes occupied four equal cells, but the rendered icon/label child was left-aligned in each cell. The Home selected capsule appeared against the left edge instead of the center of its 180 px tab cell. This made the visible control and the native touch geometry disagree even though the outer button bounds looked correct.

The same shell was used by Home, Reports, Outlets, More, and screens opened from those tabs. The issue was therefore treated as a shared shell regression, not a page-level padding problem.

## Root-cause inventory

| Layer | Before | Finding | Correction |
|---|---|---|---|
| `rep/App.tsx` → `TabBarButton` | Destructured only event/accessibility props and supplied its own `styles.tabButton` | React Navigation's supplied `style` (the flex/width layout for each tab cell) was discarded. Native buttons remained `[0,1483][180,1510]`, etc., while their visual child was left-anchored, e.g. Home `[0,1483][64,1510]`. | Forward all navigator props and compose `[styles.tabButton, style]`. The navigator now owns the tab-cell geometry and the child is centered in the cell. |
| `rep/src/components/companion.tsx` → `AppScreen` | Parent entrance animation used `translateY` | Android can retain pre-transform hit-testing for descendants while pixels have moved. This was an unsafe interactive ancestry transform. | Keep the entrance fade-only. The shell no longer transforms layout or touch coordinates. |
| `rep/src/components/companion.tsx` → `TactilePressable` | Press feedback used scale transform on every interactive wrapper | Scaling a Pressable changes the apparent control geometry during a tap and can separate the visual center from the native hit region on affected Android versions. | Keep press feedback opacity-only; layout and geometry are invariant while pressed. |
| `rep/src/screens/MyActivityScreen.tsx` → `TrendChart` | Chart entrance used `translateY` | A moving chart wrapper was unnecessary and added another transformed subtree to a touch-heavy screen. | Keep chart entrance fade-only. |
| `heroTone` decorative layer | Absolutely positioned decorative tint | Audit confirmed `pointerEvents="none"`; it does not intercept touches. | No change required. |
| Scroll / keyboard / bottom inset | Shared normal-flow tab navigator | No second screen-level `TAB_BAR_SPACE` owner was found in the current V2.2 source. The tab bar is a sibling below the scene and the scene ends at its top. | No screen-specific negative margin, hitSlop, spacer, or inset workaround was introduced. |

## Navigation and ownership model

The app uses a normal-flow React Navigation bottom tab bar. The physical UI hierarchy measured after the fix is:

```text
scene viewport:  [0,0][720,1464]
tab-bar wrapper:  [0,1464][720,1510]
Home button:     [0,1483][180,1510]
Outlets button:  [180,1483][360,1510]
Reports button:  [360,1483][540,1510]
More button:     [540,1483][720,1510]
```

There is no unexplained scene band between the scene bottom (`y=1464`) and the visible tab-bar wrapper (`y=1464`). The single owner of tab-bar clearance is React Navigation's normal-flow tab navigator. `AppScreen` does not reserve tab-bar height, and interactive wrappers do not translate their layout.

The before/after geometry evidence is in the physical UIAutomator dumps collected during this pass. Before the wrapper fix, the child of the Home button was `[0,1483][64,1510]`; after forwarding the navigator style it is `[52,1487][129,1510]`. Equivalent centered child bounds were observed for Outlets `[234,1488][307,1510]`, Reports `[414,1488][487,1510]`, and More `[594,1488][667,1510]`.

## Changes made

1. Forward the complete React Navigation tab-button prop set, including the navigator-provided `style`.
2. Remove interactive and shell `translateX`/`translateY` transforms from the shared press/screen path.
3. Retain only opacity-based native-driver feedback for press and entrance states.
4. Leave the non-interactive `AnimatedTabIcon` scale animation intact; it is an icon backing transition, not an interactive wrapper or hit-region owner.

## Physical verification

The fixed release was installed on `ZD2229Q3KB`. Center taps were exercised against the corrected UI on Home, Reports, Outlets, More, New Retailer, route rows, quick actions, report controls, outlet filters, retailer detail, and form inputs. Navigation and state changes occurred from the centers of the visible controls. The test matrix records the control-level evidence.

Evidence directory: `/Users/tanutejas/Desktop/gagan-salesperson-touch-geometry-evidence/`

Key captures:

- `home-touch-fixed.png` — corrected tab geometry and Home shell.
- `home-touch-fixed-lower.png` — route, quick actions, and attention region after scrolling.
- `reports-touch-fixed.png` — Reports shell and tab control.
- `outlets-touch-fixed.png` — Outlets shell and filters.
- `more-touch-fixed.png` — More menu rows and bottom navigation.
- `new-retailer-touch-fixed.png` — New Retailer step controls.
- `new-retailer-touch-fixed-keyboard.png` — focused input with keyboard open.

No diagnostic overlay or debug logging is present in the release source. Native UIAutomator bounds and rendered physical screenshots were used as the temporary diagnostic evidence, so no debug instrumentation can leak into the APK.

## Acceptance result

The concrete rendered mismatch is corrected at the shared `TabBarButton` boundary. The shell is transform-free for interactive geometry, and the physical bottom-tab children are centered inside their native cells. Remaining limitations are state/data limitations rather than touch geometry: the canonical physical session is day-complete, so an active Next Visit/Start Visit state was not available for this P0 test and was not fabricated.
