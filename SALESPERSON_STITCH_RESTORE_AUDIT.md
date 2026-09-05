# Salesperson Stitch Restore Audit

## Scope

This restore is isolated from the dirty canonical checkout at
`/Users/tanutejas/Documents/Gagan`. The feature branch starts from the fetched
`origin/codex/gagan-staging` HEAD, `e47e38e99cf08c0d71542ea230815c33dca17a26`,
and does not merge `main`.

Approved Stitch reference:

- branch: `codex/gagan-salesperson-stitch-redesign`
- reference commit: `c5e85b1`
- implementation commit: `062ed67`

## Audit classification

| Area | Finding | Classification | Restore treatment |
| --- | --- | --- | --- |
| Home | The dirty canonical worktree added a dashboard-like Visual Read block with rings and bars, replacing the approved field-companion composition. | Accidental surface change | Restore the approved Stitch Home composition: header, next stop, sales instrument, milestones, metrics, route, quick actions, attention, and field-day state. |
| Theme | The dirty canonical worktree introduced a separate Apple-blue/orange palette that does not match the approved Stitch source. | Accidental surface change | Restore the Stitch blue/navy neutral token system from the approved reference. |
| Navigation | The latest staging branch already contains the normal-flow tab viewport fix. | Later valid fix | Preserve e47 and keep one small scroll-content gap only. |
| Reports | Performance cockpit and presentation helpers are part of the approved Stitch surface. | Approved visual layer | Restore the Stitch performance presentation and preserve the existing read-only API contract. |
| Outlets / More / Sales Kit | The approved Stitch source contains the intended compact field-companion surfaces. | Approved visual layer | Restore those screen compositions without changing navigation or business contracts. |
| OTP/session recovery | The dirty canonical checkout contains web-safe session storage and recoverable OTP challenge handling. | Later functional/support fix | Preserve the current staging implementation on this restore branch. |
| Admin, Founder, Retailer, backend | Outside the requested Salesperson visual restore scope. | Unrelated | No changes are made by this restore. |

## Functional preservation rule

The restore changes presentation composition, tokens, shared UI primitives, and
the salesperson viewport policy only. It does not change order, pricing,
credit, inventory, attendance, route, SAP, offline, or target calculations.
The existing New Retailer, secure-photo, and storage boundaries remain on the
latest staging base.

## Validation plan

1. Run Salesperson tests and typecheck.
2. Build a standalone release APK with the staging API embedded.
3. Install it on the connected Moto E13 (`ZD2229Q3KB`).
4. Capture Home, Outlets, Reports, More, retailer detail, order-taking, and
   New Retailer evidence where the seeded session exposes those routes.
5. Verify the normal-flow tab bar has no dead band or touch-offset regression.
6. Push only `codex/gagan-salesperson-stitch-restore`.

This branch stops before integration into `codex/gagan-staging`.
