# Gagan Salesperson — Performance + Attendance P0 Audit

Date: 2026-09-05  
Device: Moto E13, serial `ZD2229Q3KB`, 720 × 1600 physical display  
API: `https://gagan-staging-api.onrender.com`  
Source staging SHA: `e47e38e99cf08c0d71542ea230815c33dca17a26`  
Working branch: `codex/gagan-salesperson-performance-attendance-fix`  
Isolation: separate worktree at `/Users/tanutejas/Documents/Gagan-salesperson-performance-attendance-fix`; the dirty canonical checkout was not edited.

## Scope

This pass is limited to the two reported P0 defects:

1. coalescing duplicate Home refreshes so the same `/rep/field/today` read is not paid for concurrently by mount, focus, and app-state entry;
2. making the Home Attendance shortcut state-aware while preserving the existing attendance APIs, location guard, permission guard, and day-state rules.

The approved visual system was not redesigned. No backend, Admin, Retailer, Founder, SAP, pricing, inventory, order, credit, route, visit, or offline logic was changed.

## Physical reproduction before the fix

The current APK was installed on the Moto E13 and Home was scrolled to Quick actions. UIAutomator confirmed that Attendance was an enabled, clickable button with bounds `[49,1310][199,1422]`. A center tap at approximately `(124, 1365)` produced no visible app response. The device status bar showed a location indicator, proving that the tap entered the location path, but the day-complete Home state did not open attendance history and did not explain that the day was already closed.

Evidence:

- [Home before — top](docs/performance-attendance/evidence/before-home-top.png)
- [Home before — lower Quick actions](docs/performance-attendance/evidence/before-home-lower.png)
- [Attendance tap before — no app response](docs/performance-attendance/evidence/before-attendance-no-response.png)
- [Final Home — top](docs/performance-attendance/evidence/final-home-top.png)
- [Final Home — lower Quick actions](docs/performance-attendance/evidence/final-home-lower.png)
- [Final Attendance — My day](docs/performance-attendance/evidence/final-attendance-my-day.png)

### Attendance trace

Before the change, the Home shortcut was:

```text
dayOpen ? open end-of-day sheet : toggleDay()
```

For `attendance.status === "closed"`, that treated a completed day as if it were ready to start and called the canonical start-day flow after acquiring location. This was the wrong state transition for a visible Attendance shortcut. It could leave the user waiting on a start request or show no actionable feedback.

## Home request waterfall before

An opt-in, temporary physical trace was used during diagnosis and removed before the final build. On a cold launch it recorded:

| Event | Observation |
| --- | ---: |
| `/rep/me` | 1,134 ms |
| `/rep/field/today` request 1 | 1,855 ms |
| `/rep/field/today` request 2 | 2,077 ms |
| `/rep/field/today` request 3 | 2,438 ms |
| Home first data render | approximately 3,141 ms from the first trace event |

The three Home reads were concurrent and came from the shared FieldProvider mount effect, Home focus effect, and app-active/focus lifecycle. They represented the same canonical payload, not three different sections that needed separate reads.

The public staging health check was also measured separately:

```text
/health: HTTP 200, connect 0.114 s, time to first byte 0.937 s, total 0.937 s
```

This confirms that some of the perceived cold-start delay belongs to the hosted staging service, but the duplicate Home request was an avoidable client-side multiplier.

## Home request waterfall after

With the single-flight gate enabled, the same physical release trace recorded:

| Event | Observation |
| --- | ---: |
| `/rep/me` | 621 ms |
| `/rep/field/today` | 1,723 ms |
| concurrent `/rep/field/today` requests | 1 |
| Home render after the single response | approximately 2,497 ms from the first trace event |

The response time is still dependent on Render staging warm/cold state, but the redundant reads are gone. The gate is not a cache: it only shares an in-flight promise and permits a later refresh after the current request settles.

## Other physical measurements

These are tap-to-visible-content measurements using the same UIAutomator polling method on the Moto E13. The baseline APK was the approved Stitch restore APK; the after APK was the temporary traced build with the same visual surface plus this fix. They are directional device measurements, not synthetic benchmark claims, because hosted staging response time varies.

| Surface | Before | After / API evidence |
| --- | ---: | ---: |
| Home cold launch to first usable text | 5.94 s host poll | 2.50 s trace to Home render on the captured run |
| Home warm launch | 4.61 s host poll | staging/network-variable; single-flight trace verified |
| Outlets | 2.80 s | 2.78 s host poll; `/rep/retailers` API 390 ms |
| Retailer Detail | 2.41 s | `/rep/retailers/:id`, location, visits, activity, baseline, opportunities, today, and schemes are parallel; slowest captured request 1.30 s |
| Reports | 3.80 s | slowest captured report request 788 ms |
| More | 2.46 s | static screen; no new API request on tab entry |
| Attendance history after tap | no visible response | 422 ms leave + 342 ms attendance API; screen opened immediately |

The baseline and final physical screenshots are kept under `docs/performance-attendance/evidence/`.

## Fixes applied

### Shared Home refresh coalescing

`FieldContext.refresh()` now uses `createSingleFlight()`. Mount, focus, and app-state callers remain intact, but concurrent calls share one request. This preserves the existing refresh triggers and error handling without adding stale-result caching or changing the `/rep/field/today` contract.

Focused coverage:

- concurrent calls execute one task;
- a later call after settlement executes a fresh task.

### State-correct Attendance shortcut

The Home shortcut now resolves the existing state machine explicitly:

| Attendance state | Home action |
| --- | --- |
| closed | navigate to the existing `MyDay` attendance/history screen |
| open | open the existing end-of-day sheet |
| not started | run the existing guarded start-day flow |

The not-started path still requires foreground location and preserves the existing permission/unavailable/API error messages. No location or server call is made merely to view attendance history after a day is complete.

Focused coverage:

- closed day opens attendance history;
- open day keeps end-day behavior;
- not-started day keeps guarded start-day behavior.

## Scope review

- Backend files changed: no.
- New API endpoints: no.
- Business calculations changed: no.
- Visual redesign: no.
- Production touched: no.
- `main` touched: no.
- `codex/gagan-staging` pushed or integrated: no; this branch is intentionally held for Founder performance UAT.

## Remaining measurement caveat

The hosted staging service contributes materially to cold API time. The client-side duplication is fixed and physically verified, but a future pass should only optimize further if a new trace proves another client-side bottleneck. No fabricated performance number is used here.
