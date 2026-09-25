# GAGAN VIS-03 Follow-Up Readback Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify that compatible visit outcomes and a salesperson-selected follow-up date persist locally and are visible from the Rep activity feed.

**Architecture:** Extend the existing authenticated field integration test, which uses the configured disposable PostgreSQL database and real API routes. Keep hosted, native-device, GPS fabrication, migration, and production work out of scope.

**Tech Stack:** TypeScript, Vitest, Supertest, Prisma, PostgreSQL.

**Spec:** `docs/GAGAN_FORENSIC_COMPLETENESS_AUDIT.md`, GGN-VIS-03; `docs/GAGAN_GOAL_STATE.md`, GGN-VIS-03.

## Global Constraints

- Use only `backend/.env.test.local` and its named loopback disposable PostgreSQL database for DB-backed tests.
- Do not reset or reseed the existing disposable database.
- Do not create hosted visits, fabricate GPS, alter historical visits, build/install an APK, or deploy.
- Keep GGN-VIS-03 `IMPLEMENTED BUT NOT VERIFIED` until hosted and physical acceptance are separately evidenced.

## Review Focus

- Checkout must retain every compatible selected outcome while preserving the existing primary outcome.
- A selected ISO follow-up date must persist on the visit without timezone/date drift.
- A linked follow-up activity must return its selected date in the salesperson's activity feed and remain retailer/salesperson scoped.

### Task 1: Authenticated VIS-03 persistence and readback

**Files:**
- Modify: `backend/src/modules/field/__tests__/fieldIntegration.test.ts`
- Update: `docs/GAGAN_GOAL_STATE.md`

**Interfaces:**
- Uses the existing `/rep/retailers/:retailerId/check-in`, `/rep/visits/:id/check-out`, `/rep/field/activities`, and `/rep/field/activity-feed` contracts.
- Adds no route, model, or runtime interface.

- [x] Add a focused real-DB assertion for multiple compatible outcomes and a future ISO follow-up date on checkout.
- [x] Log a follow-up activity linked to that visit; verify the saved row and activity-feed response contain the exact date.
- [x] Run the focused integration test first, then the backend test suite and typecheck/build; all passed.
- [x] Record local-only evidence and unchanged hosted/physical blockers in the goal state; preserve all unrelated dirty files.
