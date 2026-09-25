# Salesperson V2.1 visual fidelity audit

This is a source-and-render audit for the controlled V2.1 refinement. The
approved Salesperson V2 workflows remain the reference implementation; this
pass changes presentation, not business rules.

| Reference characteristic | Current implementation before V2.1 | V2.1 treatment |
| --- | --- | --- |
| Home vertical flow | `AppScreen` reserved measured tab-bar height while Home also added the fixed `TAB_BAR_SPACE`, leaving an unexplained lower dead region | Keep the shell's measured reservation and remove the duplicate Home reservation; retain one continuous ScrollView |
| Safe areas and scrolling | Shell and screen padding had two sources of bottom clearance | Shell owns tab-bar clearance; screen owns only normal breathing room |
| Home sections | Active-day, no-route, and day-complete branches render in the same primary document | No branch reserves a viewport-sized placeholder; sections appear in normal order |
| Color language | Older screens referenced blue, green, gold, and lime aliases with different values | Central aliases now resolve to a neutral canvas/surface, one dark structural primary, and muted alert red |
| Milestones | Achievement aliases could render bright lime treatments | Reached/current milestone treatment uses the structural instrument color; past and future states are tonal neutrals |
| Primary actions | Older blue/green references were visually inconsistent | Compatibility aliases resolve to the same structural dark; alert actions use the muted red |
| Reports hierarchy | Summary, multiple dated bar groups, and secondary surfaces required repeated scrolling | One summary, integrated metric band, one dynamic chart, compact funnel/readout, and progressive daily detail |
| Reports time windows | 30-day view could expose many daily rows | 7D stays daily; 30D is deterministically bucketed to at most six chart points |
| Reports amounts | Full INR labels could wrap on narrow devices | Chart/readout values use compact INR (`₹3L`, `₹3.42L`, `₹48.8K`) with one-line constraints |
| Zero data | Empty metric areas risked looking like broken geometry | A compact truthful no-activity state replaces repeated zero rows |
| New Retailer | Existing proposal flow carried only the legacy core fields | Four guided steps carry all 19 requested labels; the API validates the same mandatory boundary |
| Identity data | No V2.1 Aadhaar persistence boundary existed | Full Aadhaar is encrypted at rest; normal responses expose only masked last four; the photo is a private object asset |

## Rendered-state checklist

The following states are the required device evidence for release review:

- Home top, Home directly below milestones, Home route/attention, and no dead region.
- Active-day, day-complete, and no-route branches.
- New Retailer steps 1–4, final review, required-field errors, and photo preview.
- Reports 7D and 30D with each metric selected, zero collections, daily detail, and Timeline.
- Small, typical, and large phone classes; no CTA underlap or wrapped amount.

Device screenshots are recorded in `SALESPERSON_V2_1_READINESS.md` only after
they are captured from the running Android build. Source inspection alone is
not treated as visual acceptance.
