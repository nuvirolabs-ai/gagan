# Gagan Salesperson V2.2 — Material and Motion Comparison

Status: implementation evidence for Founder material/motion device review  
Scope: Salesperson App (`rep/`) only  
Baseline: `origin/codex/gagan-staging` at `e47e38e99cf08c0d71542ea230815c33dca17a26`  
Feature branch: `codex/gagan-salesperson-v2-2-material-motion`

## Decision boundary

This pass refines the approved V2.1 visual composition. It does not add SFA
capability, change canonical data, alter business calculations, or modify
backend contracts. Admin, Retailer App, Founder App, Dogkart, SAP behavior,
production, and `main` are outside the change surface.

The binding before-state evidence is the physical Android photo set supplied
for the V2.2 review:

`/tmp/codex-remote-attachments/01a03ead-23c6-7c42-8516-b0fb855094fc/661BFC3E-6B09-42BC-B7AD-B599FC933C82/`

The after-state evidence is the fresh release run on the Moto E13:

`/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/`

## Home

### Before

The supplied Home photographs had the accepted information order, but the
physical rendering read as a sequence of white rectangles on a cool sheet:

- white surfaces and the canvas had almost the same perceived depth;
- the sales target area read as a parent card with inset cards rather than one
  financial instrument;
- buttons and quick actions had weak tactile affordance;
- the bottom bar looked attached to the content rather than like a stable
  material layer;
- milestone emphasis was visually louder than the rest of the operating read.

### After

The source and physical captures now establish a small material hierarchy:

- canvas is Level 0 with a restrained ambient top tint;
- Today's Sales and route are Level 2 raised instruments with hairlines and
  broad, low shadows;
- field metrics and quick actions are Level 1 tonal instruments with separators;
- attention is a compact raised/alert row only when canonical data requires it;
- the day-complete state is a compact tonal status row rather than a hero-sized
  card;
- the bottom tab bar has its own hairline and restrained upward elevation while
  retaining normal-flow viewport ownership.

### New visual and interaction encoding

The shared `TactilePressable` gives meaningful controls a native-driver
press-in scale/opacity response and routes a light haptic through the existing
helper. Progress tracks animate only after real values are present. The NEXT
route row gets a restrained cobalt rail; milestone history is quiet and the
current state is emphasized without turning every threshold neon.

### What the employee understands faster

The next field action, commercial progress, route progress, and attention item
separate into distinct material levels. The employee can scan the operating
state without interpreting every visible rounded container as a separate
module.

### Evidence

- Home top: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/home-final-top.png`
- Home lower: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/home-final-lower.png`
- Prior approved active-day reference evidence: `/Users/tanutejas/Desktop/gagan-salesperson-v2-1-evidence/final-home.png`

The current fresh device fixture was canonical Nikhil in a completed-day state.
The active-day Next Visit hero is therefore not claimed as a newly recreated
V2.2 fixture; it remains the existing approved path and is called out for
Founder review rather than hidden behind a fabricated state.

## Reports and Timeline

### Before

Timeline and Performance were readable but static. Report values, controls, and
the chart occupied separate flat zones, and switching between views provided
little acknowledgement of the user's input.

### After

Performance uses one raised cockpit with an inset metric band and bounded chart
region. Timeline uses a single chronological rail with tonal icon circles and
real event values. The chart/metric transition crossfades within the existing
area, and segments use a stable frame with a single selected treatment.

### What the employee understands faster

The selected report mode is clear, the active metric owns the chart area, and
the Timeline rail reads as one chronological instrument instead of unrelated
event cards.

### Evidence

- Timeline: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/reports-final-timeline-2.png`
- Performance: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/performance-final-top-loaded.png`
- Physical interaction recording: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/gagan-v2-2-material-motion-final.mp4`

## Retailer Detail and Order Taking

### Before

Retailer Detail had good content but its identity, credit, intelligence, and
schemes read as stacked white blocks. Order Taking had functional product rows
but limited tactile response.

### After

Identity and commercial context now share one raised surface with tonal inset
zones; intelligence and schemes step down into quieter surfaces. The Place order
CTA is a Level 3 floating action surface above the existing safe-area contract.
Catalog/product controls and cart actions use shared tactile controls and the
approved midnight/cobalt family.

### What the employee understands faster

The retailer's identity and commercial decision context are grouped first,
while product selection remains a focused, responsive field task.

### Evidence

- Retailer Detail: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/retailer-detail-final-loaded.png`
- Order Taking: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/order-taking-final-loaded.png`

## New Retailer

### Before

The form was usable but oversized and static. The active form and request list
competed for vertical attention, and focus/keyboard behavior had too little
visual structure.

### After

The form has a compact top-level Add store/My requests separation, a four-step
progress instrument, smaller proportional inputs, shared tactile navigation,
and a sticky Continue/Review action that is revealed above the keyboard through
the existing keyboard-only inset policy. No secure-photo boundary or validation
contract changed.

### What the employee understands faster

The current step and next action remain visible while the keyboard is open, and
the employee is not asked to distinguish an active form from an unrelated
request list below it.

### Evidence

- Step 1: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/add-retailer-final-step1.png`
- Keyboard-safe field state: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/add-retailer-final-keyboard.png`
- Step transition: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/add-retailer-final-step2-valid.png`

## More, Outlets, and shared navigation

The More surface now uses grouped list rows with one icon family and blue-tonal
icon backing rather than a colorful module grid. Outlets uses tactile list/add
actions, and the normal-flow bottom navigation has a white material surface,
top hairline, restrained upward shadow, animated selected icon treatment, and
selection haptic.

Evidence:

- More top: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/more-final-top.png`
- More lower: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/more-final-lower.png`
- Outlets: `/Users/tanutejas/Desktop/gagan-salesperson-v2-2-material-motion-evidence/outlets-final-loaded.png`

## Motion comparison

| Interaction | Before | V2.2 result | Physical evidence |
| --- | --- | --- | --- |
| Home entrance | Immediate/static composition | Short opacity/translate entrance; no scroll replay | Recording, Home captures |
| Primary/row press | Mostly opacity or no visible response | 0.985 native-driver press response, stable geometry, existing haptic helper | Recording and interactive device run |
| Progress | Immediate fill | Bounded 520ms fill when real value is present; direct final state under reduced motion | Home/performance captures |
| Tabs and segments | Static state swap | 180–220ms selection/icon response; stable layout; reduced-motion fallback | Recording, Timeline/Performance captures |
| Chart metric | Abrupt redraw | Bounded 260ms content transition in the same chart area | Performance source/device run |
| Sheets | Native behavior with varied content treatment | Existing native boundary retained; custom action surfaces receive Level 3 material and tactile controls | `bottom-sheet-final.png` is a native pageSheet detail presentation; custom milestone/EOD trigger was not manufactured |
| Keyboard | Form action could be crowded by IME | Focused field is revealed and CTA remains above the keyboard | Keyboard capture and UI bounds |

## Remaining visible differences

These are intentionally not hidden behind a numeric score:

1. The fresh seeded Nikhil fixture is day-complete, so the new V2.2 run does
   not show the active-day Next Visit hero or a newly crossed milestone. Reusing
   or altering canonical data solely to create a screenshot was out of scope.
2. The Android `pageSheet` report detail presentation is platform-controlled
   and appears full-height on this device; it is not represented as a custom
   bottom-sheet success claim.
3. Product thumbnail fallback imagery retains category packaging tints. This
   is content artwork, not an additional UI accent family.
4. Motion smoothness was visually verified on the Moto E13 but not profiled
   with a frame-time tool; a later performance budget pass can add profiling
   without changing the visual contract.

## Fidelity scorecard

Scores are implementation/device-review scores, not an approval claim.

| Dimension | Score | Reason |
| --- | ---: | --- |
| Material hierarchy | 8.5/10 | Clear Level 0/1/2/3 separation without broad shadow coverage |
| Surface economy | 8/10 | Main Home surfaces are more composed; some inherited surfaces remain necessarily rounded |
| Typography | 8.5/10 | Shared weights and hierarchy are stronger; device/system rendering still varies |
| Button tactility | 8.5/10 | Shared press/loading/disabled behavior and haptic boundary are in place |
| Navigation material | 8.5/10 | Bar reads as an integrated layer without reopening the viewport defect |
| Motion restraint | 8.5/10 | Short, bounded, reduced-motion-safe transitions; no continuous decorative loops |
| Reports/Timeline | 8/10 | Stronger cockpit/rail; full metric transition coverage still merits Founder inspection |
| Retailer/Order surfaces | 8.5/10 | Identity/commercial hierarchy and tactile order controls are materially improved |
| Form quality | 8.5/10 | Compact step/form hierarchy and keyboard-safe CTA are physically evidenced |
| Overall material/motion readiness | 8/10 | Ready for Founder device review; active-day/milestone visual states remain explicitly fixture-gated |

## Test and release evidence

- Salesperson tests: 18 test files, 93 tests passed.
- Salesperson typecheck: passed.
- Android release build: passed from `rep/android` with the staging API
  environment; no backend files changed.
- Physical APK installation: passed on Moto E13 serial `ZD2229Q3KB`.
- No production deployment, `main` change, or APK binary commit is part of
  this pass.
