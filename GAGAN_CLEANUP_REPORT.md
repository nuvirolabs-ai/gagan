# Gagan worktree cleanup report

Date: 2026-09-07 (Asia/Kolkata)

## Decision

`/Users/tanutejas/Documents/Gagan-CURRENT` is the single canonical local source folder. It is a standalone clean checkout of the accepted hardened runtime at `dcbc7a933da76eeb10599d757aca8207f7cfaa0f`, with accepted APK artifacts and provenance under `artifacts/apk/`.

The completed safe archive is:

```text
/Users/tanutejas/Documents/Gagan-ARCHIVE-20260907/
```

Historical worktrees with unique commits, dirty changes, untracked evidence, or approved-reference material are preserved under `Gagan-ARCHIVE-20260907/Worktrees/`; their old Documents paths were removed only after the complete move archive and Git history bundle were verified. A full Git history bundle and the cleanup evidence are preserved at the archive root. Clean ancestor worktrees with no unique or dirty content are marked `SAFE TO REMOVE` and were removed from their old Documents paths after the standalone canonical clone was verified.

No production/main/frozen tag was a cleanup target. The Git branches and immutable tags remain in the archived repository/bundle; the frozen Salesperson template tag is explicitly preserved. The archived Git root now has only its own archived worktree registration; the moved worktrees and the two missing `/private/tmp` registrations were pruned from Git metadata without deleting archived content.

## Inventory evidence

`unique commits not in accepted` means commits reachable from that worktree HEAD but not from accepted HEAD `dcbc7a933da76eeb10599d757aca8207f7cfaa0f`. `accepted-only` shows how far that worktree is behind the accepted head. `modified/deleted` and `untracked` are the counts from `git status --short --untracked-files=all` before archival.

| Folder / registered path | Branch or state | HEAD | Unique commits not in accepted | Accepted-only | Modified/deleted | Untracked | Disposition |
|---|---|---:|---:|---:|---:|---:|---|
| `/Users/tanutejas/Documents/Gagan-CURRENT` | `codex/gagan-current` | documentation-only local consolidation commit | 1 docs-only | 0 | 0 | 0* | **KEEP** — canonical source; runtime parent is accepted `dcbc7a9` |
| `/Users/tanutejas/Documents/Gagan` | `codex/gagan-staging` | `2561cb4` | 0 | 49 | 11 | 99 | **ARCHIVE** — dirty staging checkout; preserve all work and do not merge implicitly |
| `/Users/tanutejas/Documents/Gagan-admin-approved-reference` | `codex/admin-approved-reference` | `24099fe` | 6 | 49 | 0 | 0 | **ARCHIVE** — unique Admin history |
| `/Users/tanutejas/Documents/Gagan-admin-design-lab` | `codex/admin-design-lab` | `e6ccd33` | 1 | 49 | 2 | 0 | **ARCHIVE** — approved visual reference, not runtime truth |
| `/Users/tanutejas/Documents/Gagan-admin-native` | `codex/admin-native` | `bda0c57` | 3 | 49 | 0 | 0 | **ARCHIVE** — unique Admin history |
| `/Users/tanutejas/Documents/Gagan-admin-operational-instrument` | `codex/admin-operational-instrument-v1` | `2f294bb` | 0 | 38 | 0 | 0 | **SAFE TO REMOVE** — clean ancestor; history retained |
| `/Users/tanutejas/Documents/Gagan-admin-visual-v2` | `codex/admin-visual-v2` | `42d8119` | 1 | 49 | 0 | 0 | **ARCHIVE** — unique Admin visual history |
| `/Users/tanutejas/Documents/Gagan-apk-build-0a2aadd` | detached | `0a2aadd` | 12 | 81 | 2 | 0 | **ARCHIVE** — build checkout has local package edits |
| `/Users/tanutejas/Documents/Gagan-apk-build-482392b` | detached | `482392b` | 7 | 81 | 2 | 1 | **ARCHIVE** — build checkout has local package/eas edits |
| `/Users/tanutejas/Documents/Gagan-data-import-center-v1` | `codex/import-center-ui-refinement` | `47a918d` | 0 | 29 | 0 | 0 | **SAFE TO REMOVE** — clean ancestor; history retained |
| `/Users/tanutejas/Documents/Gagan-full-e2e-uat` | `codex/gagan-full-e2e-uat-hardening` | `43ffa7f` | 0 | 8 | 0 | 49 | **ARCHIVE** — untracked hosted UAT evidence |
| `/Users/tanutejas/Documents/Gagan-p0-integrity-hardening` | `codex/gagan-p0-integrity-hardening` | `c1c0a96` | 6 | 8 | 0 | 5 | **ARCHIVE** — unique hardening lineage and test evidence |
| `/Users/tanutejas/Documents/Gagan-p0-staging-integration` | `codex/gagan-p0-staging-integration` | `dcbc7a9` | 0 | 0 | 0 | 0 | **SAFE TO REMOVE** — exact accepted source is copied to canonical; branch/tag remain |
| `/Users/tanutejas/Documents/Gagan-salesperson-final-template` | `codex/gagan-salesperson-final-template` | `69c2916` | 0 | 11 | 0 | 0 | **SAFE TO REMOVE** — immutable `gagan-salesperson-template-v1` tag and APK reference preserved |
| `/Users/tanutejas/Documents/Gagan-salesperson-performance-attendance-fix` | `codex/gagan-salesperson-performance-attendance-fix` | `02c6957` | 1 | 14 | 0 | 0 | **ARCHIVE** — unique Salesperson commit |
| `/Users/tanutejas/Documents/Gagan-salesperson-sfa-v2` | `codex/gagan-salesperson-sfa-v2` | `1d9485e` | 0 | 22 | 0 | 0 | **SAFE TO REMOVE** — clean ancestor; history retained |
| `/Users/tanutejas/Documents/Gagan-salesperson-touch-geometry-fix` | `codex/gagan-salesperson-touch-geometry-fix` | `e832b3c` | 3 | 18 | 0 | 0 | **ARCHIVE** — unique Salesperson visual/interaction history |
| `/Users/tanutejas/Documents/Gagan-salesperson-v2-1-bottom-viewport-fix` | `codex/gagan-salesperson-v2-1-bottom-viewport-fix` | `e47e38e` | 0 | 18 | 0 | 0 | **SAFE TO REMOVE** — clean ancestor; history retained |
| `/Users/tanutejas/Documents/Gagan-salesperson-v2-1-founder-refinement` | `codex/gagan-salesperson-v2-1-founder-refinement` | `bf4c6cf` | 0 | 19 | 0 | 0 | **SAFE TO REMOVE** — clean ancestor; history retained |
| `/Users/tanutejas/Documents/Gagan-salesperson-v2-2-material-motion` | `codex/gagan-salesperson-v2-2-material-motion` | `cffac69` | 2 | 18 | 0 | 0 | **ARCHIVE** — unique Salesperson motion history |
| `/Users/tanutejas/Documents/Gagan-staging-integration` | `codex/gagan-staging-integration` | `f33fdee` | 0 | 21 | 0 | 0 | **SAFE TO REMOVE** — clean ancestor; not the accepted hardened source |
| `/Users/tanutejas/Documents/Gagan-stitch-restore` | `codex/gagan-salesperson-stitch-restore` | `2561cb4` | 0 | 49 | 9 | 5 | **ARCHIVE** — dirty visual work and untracked tests |
| `/Users/tanutejas/Documents/Gagan-stitch-restore-e47` | `codex/gagan-salesperson-stitch-restore-e47` | `0486f95` | 0 | 16 | 0 | 0 | **SAFE TO REMOVE** — clean ancestor; history retained |
| `/Users/tanutejas/Documents/Gagan-stitch-salesperson-redesign` | `codex/gagan-salesperson-stitch-redesign` | `c5e85b1` | 2 | 18 | 0 | 0 | **ARCHIVE** — unique visual history |
| `/private/tmp/gagan-sfa-device` | detached, prunable | `f8a308d` | 0 | 53 | NA | NA | **SAFE TO REMOVE** — directory missing; stale worktree metadata only |
| `/private/tmp/gagan-staging-vercel.RUAj0K` | detached, prunable | `1b08b72` | 0 | 37 | NA | NA | **SAFE TO REMOVE** — directory missing; stale worktree metadata only |

\* The three APKs under `Gagan-CURRENT/artifacts/` are locally excluded non-source artifacts; the source worktree is clean.

## Unique-commit evidence for archived heads

The following unique commits were observed before archival. These are preserved by the archived repository and history bundle; no unique commit was silently discarded.

- `Gagan-admin-approved-reference`: `6eff172`, `6028265`, `bda0c57`, `4eba1d8`, `93d0880`, `24099fe`.
- `Gagan-admin-design-lab`: `e6ccd33`.
- `Gagan-admin-native`: `6eff172`, `6028265`, `bda0c57`.
- `Gagan-admin-visual-v2`: `42d8119`.
- `Gagan-apk-build-0a2aadd`: `7bc1ace`, `c3904e0`, `351bd13`, `cdd7a5e`, `f3dcdd7`, `4410efc`, `482392b`, `54dfd9c`, `343557d`, `a085e47`, `973a672`, `0a2aadd`.
- `Gagan-apk-build-482392b`: `7bc1ace`, `c3904e0`, `351bd13`, `cdd7a5e`, `f3dcdd7`, `4410efc`, `482392b`.
- `Gagan-p0-integrity-hardening`: `c9b0eae`, `01d8dec`, `d1b7350`, `824de1e`, `21fd72b`, `c1c0a96`.
- `Gagan-salesperson-performance-attendance-fix`: `02c6957`.
- `Gagan-salesperson-touch-geometry-fix`: `8bedb48`, `cffac69`, `e832b3c`.
- `Gagan-salesperson-v2-2-material-motion`: `8bedb48`, `cffac69`.
- `Gagan-stitch-salesperson-redesign`: `062ed67`, `c5e85b1`.

The dirty/untracked work preserved in the archive includes, at minimum, the 110 entries in `Gagan`, 49 hosted-UAT evidence files in `Gagan-full-e2e-uat`, five P0 evidence files in `Gagan-p0-integrity-hardening`, two Admin Design Lab edits, two APK-build package edits plus one EAS file, and the modified/test files in `Gagan-stitch-restore`.

## Protected items

- Production and `main` remain untouched.
- `gagan-staging-p0-hardened-v1` remains at tag object `dc58977ac8ad027bd275ff7add775f3ebe616f65` / commit `1859d4e1014d194b35453c4afa044b17452c7840`.
- `gagan-salesperson-template-v1` remains at tag object `ed6cd3d43dd31f6143e416d6e76cd9f48b3a125c` / commit `69c2916a31adcd861f09d4fc2405c4431a09d9b6`.
- The accepted branch `codex/gagan-p0-staging-integration` remains unchanged at `dcbc7a933da76eeb10599d757aca8207f7cfaa0f`.
- No production deployment, staging redeploy, database mutation, or client notification was performed by this cleanup.
