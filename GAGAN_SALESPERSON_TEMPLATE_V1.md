# GAGAN SALESPERSON TEMPLATE V1

Status: **FROZEN**  
Tag: `gagan-salesperson-template-v1`  
Finalization branch: `codex/gagan-salesperson-final-template`  
Date: 2026-09-05

## Canonical checkpoint

The runtime source used to build and physically verify this template is:

```text
8eed514315c8e8d3e971f8b1793171e20ba119ce
```

This is the verified source commit immediately before the freeze manifest and physical evidence were added. The immutable `gagan-salesperson-template-v1` tag points to the documentation-complete freeze commit reported with this checkpoint. The documentation-only freeze commit does not alter the application runtime source.

## Approved sources consolidated

| Source | SHA | Included contribution |
| --- | --- | --- |
| `origin/codex/gagan-staging` | `e47e38e99cf08c0d71542ea230815c33dca17a26` | verified staging ancestry |
| `origin/codex/gagan-salesperson-stitch-restore` | `0486f95aaa5bfdc8a50d68dddc6793ea775cec1a` | approved Stitch visual system and evidence |
| `origin/codex/gagan-salesperson-performance-attendance-fix` | `bd1d448053df0ddf251642be4e2945d6d9d09d62` | Home performance single-flight, Attendance correction, physical evidence |
| explicit banner-fit correction | `02c69576daad69d495e817e9ce43bf6f3eeef7f6` | removes the operating-pulse tagline and keeps 30D inside the Performance banner |

The approved sources are a verified linear lineage. No blind merge was performed.

## Included capability baseline

This V1 template contains:

- approved Stitch Salesperson presentation;
- corrected bottom safe-area ownership and no fixed blank band above bottom navigation;
- corrected touch geometry and center-tap behavior;
- Reports and New Retailer improvements;
- OTP and session restoration;
- offline/outbox behavior;
- route and visit behavior;
- Start Day and End Day;
- Attendance history and leave;
- retailer list and retailer detail;
- order-taking, pricing, credit, and inventory behavior;
- targets, performance, activity timeline, and Reports;
- Home `/rep/field/today` in-flight request deduplication;
- state-aware Home Attendance shortcut:
  - closed day → My Day/history;
  - open day → End Day;
  - not started → guarded Start Day;
- the explicit 30D Performance-banner fit correction.

No new feature or design change was introduced during finalization.

## Verification

### Automated

- Salesperson tests: **PASS** — 21 test files, 100 tests;
- focused single-flight tests: **PASS**;
- focused Attendance action tests: **PASS**;
- Salesperson typecheck: **PASS**;
- Android release bundle and APK: **PASS**;
- `git diff --check`: **PASS**;
- backend regression: not required; no backend source changed.

### Physical Moto E13

Device:

```text
Moto E13
Serial: ZD2229Q3KB
Display: 720 × 1600
```

Verified against the exact consolidated release APK:

| Surface / behavior | Result |
| --- | --- |
| cold launch | PASS |
| session restore | PASS |
| Home | PASS |
| Attendance center tap and My Day/history | PASS |
| Home scroll and bottom navigation | PASS |
| no fixed blank band observed | PASS |
| Outlets | PASS |
| Retailer Detail | PASS |
| Order Taking | PASS |
| Reports / Performance | PASS |
| More | PASS |
| screen off/on | PASS |
| background/foreground | PASS |
| app crash during smoke | NONE OBSERVED |
| active-day Next Visit / Start Visit / Navigate state | NOT RUN |

The active-day state was not safely available in the existing authenticated staging session; it was day-complete. No staging data was fabricated or mutated to create one.

Evidence is stored in `docs/template-v1/evidence/`:

- `home-top.png`
- `home-lower.png`
- `attendance.png`
- `outlets.png`
- `retailer-detail.png`
- `order-taking.png`
- `reports-performance.png`
- `more.png`

## Founder verification APK

```text
Filename: gagan-salesperson-final-template-8eed514.apk
Path: /Users/tanutejas/Desktop/gagan-salesperson-final-template-8eed514.apk
SHA-256: b7f7e86a18644e50294f63c296fd294875111b900d9a361fa3f36c9f7440dc94
Package: com.gagan.sales
Embedded API: https://gagan-staging-api.onrender.com
Standalone: YES
Metro runtime dependency: NO
USB runtime dependency: NO
```

## Known limitations

- The physical acceptance session was day-complete; active-day visual acceptance remains NOT RUN.
- Hosted staging response time and data state are external to this source checkpoint.
- The APK is a staging verification artifact and must not be treated as a production release.
- Future approved template evolution must use `gagan-salesperson-template-v2` or another new immutable version; V1 must not be moved or rewritten.

## Porting declaration

**THIS IS THE SOURCE TEMPLATE FOR DOGKART SALESPERSON PORTING.**

Dogkart must use this immutable commit/tag as its presentation and interaction template, not a moving Gagan branch. Dogkart porting is explicitly outside this task.

## Safety boundary

- `codex/gagan-staging` changed: **NO**
- `main` changed: **NO**
- production changed: **NO**
- Dogkart changed: **NO**
- backend source changed: **NO**

See [SALESPERSON_FINAL_TEMPLATE_AUDIT.md](SALESPERSON_FINAL_TEMPLATE_AUDIT.md) and [SALESPERSON_TEMPLATE_PORTING_BOUNDARY.md](SALESPERSON_TEMPLATE_PORTING_BOUNDARY.md) for the consolidation and reuse boundaries.
