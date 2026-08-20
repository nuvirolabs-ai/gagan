# Foundation and Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reproducible, tested, deployable baseline before changing financial or credit behavior.

**Architecture:** Preserve current endpoints while separating Express application construction from process startup and separating scheduled work into a worker entrypoint. Add validated configuration, deterministic tests, CI, health/readiness endpoints, and a fresh-database migration gate.

**Tech Stack:** TypeScript, Express 4, Prisma, PostgreSQL, Vitest, Supertest, GitHub Actions, Expo TypeScript, Vite.

---

## File map

**Create**

- `.gitignore` — repository-wide exclusions
- `.github/workflows/ci.yml` — builds, lint, tests, migration verification
- `backend/.env.example` — documented non-secret configuration
- `backend/vitest.config.ts` — test configuration
- `backend/src/app.ts` — Express app factory
- `backend/src/server.ts` — API process startup/shutdown
- `backend/src/worker.ts` — worker process startup/shutdown
- `backend/src/platform/config/env.ts` — validated environment
- `backend/src/platform/http/asyncRoute.ts` — Express 4 rejection wrapper
- `backend/src/platform/http/requestId.ts` — correlation ID middleware
- `backend/src/platform/health/readiness.ts` — dependency readiness
- `backend/src/__tests__/health.test.ts` — API smoke tests
- `backend/src/__tests__/config.test.ts` — production fail-closed tests
- `backend/src/__tests__/invoicing.test.ts` — current invoice characterization
- `backend/src/__tests__/ageing.test.ts` — current ageing characterization
- `scripts/verify.sh` — complete local/CI verification command

**Modify**

- `backend/package.json` — test and worker scripts/dependencies
- `backend/src/index.ts` — compatibility re-export/start shim or removal after entrypoint switch
- `backend/src/jobs.ts` — export one-run schedule registration without API ownership
- `backend/tsconfig.json` — test/build exclusions as needed
- `mobile/package.json`, `rep/package.json` — add `typecheck`
- `admin/package.json` — add `typecheck` and non-warning lint gate
- `README.md` — environment, verification, API/worker commands

## Task 1: Establish source-control baseline

**Files:**

- Create: `.gitignore`
- Verify: `backend/.gitignore`, `mobile/.gitignore`, `rep/.gitignore`, `admin/.gitignore`

- [ ] **Step 1: Create repository-wide ignores**

```gitignore
.DS_Store
**/node_modules/
**/dist/
**/.expo/
**/.env
**/.env.*
!**/.env.example
*.log
coverage/
playwright-report/
test-results/
```

- [ ] **Step 2: Initialize and inspect Git**

Run: `git init && git status --short`
Expected: source files and docs are untracked; `.env`, `node_modules`, build output, and Expo state are absent.

- [ ] **Step 3: Commit the approved baseline**

```bash
git add .
git commit -m "chore: establish Gagan prototype baseline"
```

Expected: one root commit containing source, requirements, design, and plans but no secrets or generated dependencies.

## Task 2: Add backend test harness and characterization tests

**Files:**

- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/__tests__/invoicing.test.ts`
- Create: `backend/src/__tests__/ageing.test.ts`

- [ ] **Step 1: Install test dependencies**

Run: `cd backend && npm install --save-dev vitest supertest @types/supertest`
Expected: lockfile updates and packages install successfully.

- [ ] **Step 2: Add scripts**

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 3: Write invoice characterization tests**

```ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { buildInvoice } from "../lib/invoicing";

describe("buildInvoice", () => {
  it("prices delivered weight instead of ordered cases", () => {
    const result = buildInvoice([{
      id: "line-1",
      unitPrice: new Prisma.Decimal(5400),
      qtyOrdered: 1,
      qtyDelivered: 1,
      weightDelivered: new Prisma.Decimal(11.4),
      variant: { unitsPerCase: 12, unitWeightKg: new Prisma.Decimal(1) },
    }]);
    expect(result.total).toBe(5130);
    expect(result.lines[0].basis).toBe("delivered_weight");
  });

  it("falls back to delivered cases when weight is absent", () => {
    const result = buildInvoice([{
      id: "line-1",
      unitPrice: new Prisma.Decimal(3150),
      qtyOrdered: 3,
      qtyDelivered: 2,
      weightDelivered: null,
      variant: { unitsPerCase: 30, unitWeightKg: new Prisma.Decimal(1) },
    }]);
    expect(result.total).toBe(6300);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- src/__tests__/invoicing.test.ts`
Expected: PASS, preserving current delivered-weight behavior.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts backend/src/__tests__
git commit -m "test: add backend characterization harness"
```

## Task 3: Validate runtime configuration and fail closed in production

**Files:**

- Create: `backend/src/platform/config/env.ts`
- Create: `backend/src/__tests__/config.test.ts`
- Create: `backend/.env.example`
- Modify: backend files reading `process.env`

- [ ] **Step 1: Write failing configuration tests**

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "../platform/config/env";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/gagan_test",
  JWT_SECRET: "a".repeat(32),
  PAYMENT_PROVIDER: "mock",
  SAP_MODE: "disabled",
};

describe("parseEnv", () => {
  it("rejects missing secrets", () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: "" })).toThrow();
  });

  it("rejects mock providers in production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(/mock/i);
  });
});
```

- [ ] **Step 2: Verify red state**

Run: `cd backend && npm test -- src/__tests__/config.test.ts`
Expected: FAIL because `parseEnv` does not exist.

- [ ] **Step 3: Implement validated configuration**

```ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000),
  PAYMENT_PROVIDER: z.string().default("mock"),
  SAP_MODE: z.string().default("disabled"),
  DISABLE_JOBS: z.enum(["true", "false"]).default("false"),
});

export function parseEnv(input: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const env = schema.parse(input);
  if (env.NODE_ENV === "production" && (env.PAYMENT_PROVIDER === "mock" || env.SAP_MODE === "mock")) {
    throw new Error("Mock payment and SAP adapters are forbidden in production");
  }
  return env;
}

export const env = parseEnv(process.env);
```

- [ ] **Step 4: Document every variable without values**

Create `backend/.env.example` with all API, worker, SMS, payment, SAP, queue, storage, and monitoring variable names and safe development defaults only.

- [ ] **Step 5: Run tests and build**

Run: `cd backend && npm test -- src/__tests__/config.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/.env.example backend/src/platform/config backend/src/__tests__/config.test.ts backend/src
git commit -m "feat: validate runtime configuration"
```

## Task 4: Separate API construction, server startup, and worker startup

**Files:**

- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/worker.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/jobs.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Write failing API smoke test**

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("health", () => {
  it("returns liveness without starting a network listener", async () => {
    const response = await request(createApp()).get("/health/live");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Verify red state**

Run: `cd backend && npm test -- src/__tests__/health.test.ts`
Expected: FAIL because `createApp` and `/health/live` do not exist.

- [ ] **Step 3: Implement the app factory**

Move middleware and route registration from `src/index.ts` into `createApp()`. Keep one terminal error handler. Do not call `listen()` or start jobs from `app.ts`.

- [ ] **Step 4: Implement process entrypoints**

`server.ts` loads validated env, listens, installs SIGTERM/SIGINT handlers, and closes the HTTP server and Prisma cleanly. `worker.ts` loads validated env, starts durable/scheduled processors, and shuts them down cleanly. During this plan `jobs.ts` may retain timers only in the worker process.

- [ ] **Step 5: Update scripts**

```json
{
  "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
  "dev:worker": "ts-node-dev --respawn --transpile-only src/worker.ts",
  "start": "node dist/server.js",
  "start:worker": "node dist/worker.js"
}
```

- [ ] **Step 6: Verify**

Run: `cd backend && npm test -- src/__tests__/health.test.ts && npm run build`
Expected: PASS; importing `createApp()` does not open ports or start timers.

- [ ] **Step 7: Commit**

```bash
git add backend/src/app.ts backend/src/server.ts backend/src/worker.ts backend/src/index.ts backend/src/jobs.ts backend/src/__tests__/health.test.ts backend/package.json
git commit -m "refactor: separate API and worker processes"
```

## Task 5: Add correlation IDs, async route protection, readiness, and API hardening

**Files:**

- Create: `backend/src/platform/http/asyncRoute.ts`
- Create: `backend/src/platform/http/requestId.ts`
- Create: `backend/src/platform/health/readiness.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/__tests__/health.test.ts`

- [ ] **Step 1: Add failing tests**

Test that `/health/ready` returns 200 with a successful dependency probe, that every response contains `x-request-id`, and that a rejected async handler reaches the JSON error middleware.

- [ ] **Step 2: Verify red state**

Run: `cd backend && npm test -- src/__tests__/health.test.ts`
Expected: FAIL for missing readiness/request ID behavior.

- [ ] **Step 3: Implement**

```ts
import { RequestHandler } from "express";

export const asyncRoute = (handler: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
```

Add request IDs, `helmet`, restricted CORS from configuration, a JSON body limit, and database readiness. Wrap async route handlers or register an Express-compatible async error package consistently.

- [ ] **Step 4: Verify**

Run: `cd backend && npm test && npm run build`
Expected: PASS with no unhandled promise rejection in the test output.

- [ ] **Step 5: Commit**

```bash
git add backend/src/platform backend/src/app.ts backend/src/__tests__ backend/package.json backend/package-lock.json
git commit -m "feat: harden API process baseline"
```

## Task 6: Add full verification script and CI

**Files:**

- Create: `scripts/verify.sh`
- Create: `.github/workflows/ci.yml`
- Modify: package scripts in all four packages
- Modify: `README.md`

- [ ] **Step 1: Add deterministic package commands**

Retailer and staff packages receive `typecheck: tsc --noEmit`. Admin receives explicit `typecheck` and lint commands. Backend exposes test, typecheck, build, Prisma validate, and migration-deploy checks.

- [ ] **Step 2: Create verification script**

```bash
#!/usr/bin/env bash
set -euo pipefail
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run build
npm --prefix mobile run typecheck
npm --prefix rep run typecheck
npm --prefix admin run lint
npm --prefix admin run build
```

- [ ] **Step 3: Create CI workflow**

Use pinned Node LTS and PostgreSQL 16 service. Install with `npm ci`, apply `prisma migrate deploy` to an empty CI database, run `scripts/verify.sh`, and cache npm directories. Never use the development `.env`.

- [ ] **Step 4: Verify a fresh migration locally**

Create an explicit disposable database, set `DATABASE_URL` only for the command, run `npx prisma migrate deploy`, then `npx prisma migrate status`.
Expected: all migrations applied. Do not mark the existing `gagan_dev` migration applied without separate reconciliation.

- [ ] **Step 5: Run full verification**

Run: `bash scripts/verify.sh`
Expected: exit 0.

- [ ] **Step 6: Update README and commit**

```bash
git add .github scripts README.md backend mobile/package.json rep/package.json admin/package.json
git commit -m "ci: add reproducible production baseline checks"
```

## Exit gate

- [ ] Repository contains no secret/generated files.
- [ ] Full verification exits 0.
- [ ] Fresh PostgreSQL migration succeeds.
- [ ] API and worker build and start separately.
- [ ] Async failures reach the JSON error boundary.
- [ ] Production configuration rejects mock adapters.
- [ ] CI runs the same verification used locally.
