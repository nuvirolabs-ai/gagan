import { describe, expect, it } from "vitest";
import { SessionFetchError } from "../../auth/sessionFetch";
import { isOperationalReadFallbackError } from "../networkErrors";
import {
  createOperationalReadCache,
  isOperationalRoutePayload,
  isOperationalTodayPayload,
  loadOperationalRead,
  OPERATIONAL_CACHE_MAX_AGE_MS,
  OPERATIONAL_CACHE_MAX_BYTES,
} from "../operationalReadCache";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

function route() {
  return {
    id: "route-1",
    name: "Today",
    progress: { visited: 1, skipped: 0, pending: 1, total: 2, completionPct: 50 },
    stops: [{
      id: "stop-1",
      sequence: 1,
      status: "pending",
      retailer: { id: "retailer-1", name: "Sharma Store", shopAddress: "MG Road" },
    }],
  };
}

function today(orderValue = 100) {
  return {
    attendance: { status: "open" },
    route: route(),
    todayMetrics: { orderValue },
    targets: [],
    tasks: [],
    followUps: [],
    notifications: [],
    serviceIssues: [],
  };
}

describe("bounded operational Today/Route read cache", () => {
  it("populates from online Today and falls back only for a transient transport failure", async () => {
    const storage = memoryStorage();
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example/", storage, now: () => 1000 });
    let online = true;
    const read = () => loadOperationalRead({
      kind: "today",
      cache,
      load: async () => { if (!online) throw new TypeError("Network request failed"); return today(); },
      validate: isOperationalTodayPayload,
      isFallbackError: isOperationalReadFallbackError,
    });

    expect((await read()).source).toBe("network");
    online = false;
    const recovered = await read();
    expect(recovered.source).toBe("cache");
    expect(recovered.value.todayMetrics).toEqual({ orderValue: 100 });
  });

  it("returns a safe error when offline with no cache", async () => {
    const storage = memoryStorage();
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage });
    const failure = new TypeError("Network request failed");
    await expect(loadOperationalRead({
      kind: "today", cache, load: async () => { throw failure; },
      validate: isOperationalTodayPayload, isFallbackError: isOperationalReadFallbackError,
    })).rejects.toBe(failure);
  });

  it("keeps Account A's Today and Route snapshots unreachable by Account B", async () => {
    const storage = memoryStorage();
    const a = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage });
    const b = createOperationalReadCache({ accountId: "staff-b", apiOrigin: "https://staging.example", storage });
    await a.save("today", today());
    await a.save("route", route());
    expect(await b.read("today")).toBeNull();
    expect(await b.read("route")).toBeNull();
    expect(a.key).not.toBe(b.key);
  });

  it("fails closed after logout/account change", async () => {
    const storage = memoryStorage();
    let current = true;
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage, isCurrentAccount: () => current });
    await cache.save("today", today());
    current = false;
    expect(await cache.read("today")).toBeNull();
    expect(await cache.save("today", today(200))).toBe(false);
  });

  it("expires snapshots instead of rendering an old operational day", async () => {
    const storage = memoryStorage();
    let clock = 1_000;
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage, now: () => clock });
    await cache.save("today", today());
    clock += OPERATIONAL_CACHE_MAX_AGE_MS + 1;
    expect(await cache.read("today")).toBeNull();
  });

  it("ignores and removes malformed cache data without crashing", async () => {
    const storage = memoryStorage();
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage });
    await storage.setItem(cache.key, "{not valid json");
    expect(await cache.read("today")).toBeNull();
    expect(await storage.getItem(cache.key)).toBeNull();
  });

  it("rejects a structurally unsafe cached route and Today payload", async () => {
    expect(isOperationalRoutePayload({ route: "not-a-route" })).toBe(false);
    expect(isOperationalTodayPayload({ targets: "not-an-array" })).toBe(false);
    expect(isOperationalTodayPayload({ accessToken: "must-not-be-cached" })).toBe(false);
  });

  it("does not use cache for authentication, authorization or business 4xx responses", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isOperationalReadFallbackError(new SessionFetchError(status, { error: "rejected" }))).toBe(false);
    }
    expect(isOperationalReadFallbackError(new SessionFetchError(500, { error: "outage" }))).toBe(true);
  });

  it("replaces the snapshot after an authoritative online refresh", async () => {
    const storage = memoryStorage();
    let clock = 1_000;
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage, now: () => clock });
    await cache.save("today", today(100));
    clock += 10;
    const result = await loadOperationalRead({
      kind: "today", cache, load: async () => today(250),
      validate: isOperationalTodayPayload, isFallbackError: isOperationalReadFallbackError,
    });
    expect(result.source).toBe("network");
    expect((await cache.read("today"))?.payload.todayMetrics).toEqual({ orderValue: 250 });
  });

  it("does not fall back when the server returns a malformed read response", async () => {
    const storage = memoryStorage();
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage });
    await cache.save("today", today(100));
    await expect(loadOperationalRead({
      kind: "today", cache, load: async () => ({ targets: "unsafe" }),
      validate: isOperationalTodayPayload, isFallbackError: isOperationalReadFallbackError,
    })).rejects.toThrow("operational_read_malformed");
  });

  it("keeps a single bounded envelope containing only Today and Route snapshots", async () => {
    const storage = memoryStorage();
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage });
    await cache.save("today", today());
    await cache.save("route", route());
    const raw = await storage.getItem(cache.key);
    expect(raw && JSON.parse(raw).snapshots).toEqual(expect.objectContaining({ today: expect.any(Object), route: expect.any(Object) }));
    expect(raw && JSON.stringify(JSON.parse(raw).snapshots).length).toBeLessThan(OPERATIONAL_CACHE_MAX_BYTES);
  });

  it("does not overwrite prior cache state when a storage write fails", async () => {
    const base = memoryStorage();
    await base.setItem("seed", "ok");
    const failing = {
      ...base,
      async setItem() { throw new Error("storage unavailable"); },
    };
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage: failing });
    expect(await cache.save("today", today())).toBe(false);
    expect(await cache.read("today")).toBeNull();
  });

  it("rejects a cache payload above its storage bound", async () => {
    const storage = memoryStorage();
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage });
    expect(await cache.save("today", { large: "x".repeat(OPERATIONAL_CACHE_MAX_BYTES) })).toBe(false);
    expect(await cache.read("today")).toBeNull();
  });

  it("allows repeated focus refreshes to remain live and serialized", async () => {
    const storage = memoryStorage();
    const cache = createOperationalReadCache({ accountId: "staff-a", apiOrigin: "https://staging.example", storage });
    let calls = 0;
    const read = () => loadOperationalRead({
      kind: "route", cache, load: async () => { calls += 1; return route(); },
      validate: isOperationalRoutePayload, isFallbackError: isOperationalReadFallbackError,
    });
    const results = await Promise.all([read(), read(), read()]);
    expect(calls).toBe(3);
    expect(results.every((result) => result.source === "network")).toBe(true);
    expect((await cache.read("route"))?.payload.id).toBe("route-1");
  });

  it("prunes old account partitions after a bounded number of accounts", async () => {
    const storage = memoryStorage();
    for (let index = 0; index < 5; index += 1) {
      await createOperationalReadCache({ accountId: `staff-${index}`, apiOrigin: "https://staging.example", storage, now: () => index + 1 }).save("today", today(index));
    }
    const oldest = createOperationalReadCache({ accountId: "staff-0", apiOrigin: "https://staging.example", storage });
    expect(await oldest.read("today")).toBeNull();
  });
});
