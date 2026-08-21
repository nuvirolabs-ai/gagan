# Final Supabase Project Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `nftxvimumwvhjrmwtlfs` the repository’s documented final Supabase database without placing credentials in source control.

**Architecture:** The backend remains the only database client and connects through Supabase’s session pooler. The final project is treated as production infrastructure; the database password and all provider credentials remain deployment secrets. Existing migrations are applied to the final project and no old project is deleted automatically.

**Tech Stack:** Prisma migrations, PostgreSQL/Supabase session pooler, Node/Express backend, Markdown environment templates, GitHub.

---

### Task 1: Replace the staging database template with the final production template

**Files:**
- Create: `backend/.env.production.example`
- Delete: `backend/.env.staging.example`

- [x] **Step 1: Create the production template with the final project reference**

Use `NODE_ENV=production`, project ref `nftxvimumwvhjrmwtlfs`, and region `ap-northeast-1`. Keep passwords and provider credentials as placeholders.

- [x] **Step 2: Remove the staging-named template**

Delete only `backend/.env.staging.example`; do not delete the old Supabase project or any database data.

- [x] **Step 3: Check the template for secrets and formatting**

Run `git diff --check` and verify that the file contains `<DB_PASSWORD>` rather than a real password.

### Task 2: Document the final Supabase deployment contract

**Files:**
- Modify: `README.md`

- [x] **Step 1: Add production database setup instructions**

Document that production uses `backend/.env.production.example`, that `DATABASE_URL` must be configured in the hosting provider’s secret store, and that the password must never be committed.

- [x] **Step 2: Document the final project identity**

Record the final project URL and reference ID, and state that migrations are run with `prisma migrate deploy` before starting the API/worker.

- [x] **Step 3: State the data-cutover boundary**

Make clear that the cutover applies schema migrations only; importing old-project records is a separate, explicit operation.

### Task 3: Verify the final project and repository references

**Files:** None.

- [x] **Step 1: Confirm Supabase CLI linkage**

Run `supabase projects list` and confirm `nftxvimumwvhjrmwtlfs` is visible and linked.

- [x] **Step 2: Confirm migration state**

Run `prisma migrate status` against the final project using a secret `DATABASE_URL`; expect all migrations applied.

- [x] **Step 3: Search for stale project references**

Run `git grep` for the old project ref and old pooler region; expect no matches in tracked source.

- [x] **Step 4: Run repository verification**

Run `bash scripts/verify.sh` and confirm the existing backend, mobile, sales, and admin checks pass.

### Task 4: Commit and publish the cutover

**Files:** The files from Tasks 1–2.

- [x] **Step 1: Review the diff**

Confirm no secrets, database passwords, or API keys are present.

- [x] **Step 2: Commit**

Use commit message `chore: make Supabase project production final`.

- [x] **Step 3: Push to GitHub**

Push the commit to `origin/main` and report the commit link.
