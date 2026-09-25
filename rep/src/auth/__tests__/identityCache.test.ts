import { describe, expect, it } from "vitest";
import {
  IDENTITY_CACHE_KEY,
  IDENTITY_CACHE_MAX_AGE_MS,
  createIdentityCache,
} from "../identityCache";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
    values,
  };
}

const identity = {
  staff: {
    id: "staff-1",
    name: "Ravi Kumar",
    phone: "9812345670",
    email: "ravi@gagan.test",
    permissions: ["route.execute"],
  },
  rep: { id: "rep-1", name: "Ravi Kumar", phone: "9812345670" },
};

describe("cached identity", () => {
  it("stores what the server last confirmed, stamped with when", async () => {
    const storage = memoryStorage();
    const cache = createIdentityCache(storage, () => 1_000);
    await cache.save(identity);
    expect(JSON.parse(storage.values.get(IDENTITY_CACHE_KEY)!)).toEqual({
      ...identity,
      cachedAt: 1_000,
    });
    expect(await cache.load()).toMatchObject({ staff: { name: "Ravi Kumar" } });
  });

  it("returns nothing when there is no cache", async () => {
    expect(await createIdentityCache(memoryStorage()).load()).toBeNull();
  });

  it("refuses a cache older than the maximum age", async () => {
    const storage = memoryStorage();
    const cache = createIdentityCache(storage, () => 0);
    await cache.save(identity);
    const stale = createIdentityCache(storage, () => IDENTITY_CACHE_MAX_AGE_MS + 1);
    expect(await stale.load()).toBeNull();
  });

  it("accepts a cache inside the maximum age", async () => {
    const storage = memoryStorage();
    await createIdentityCache(storage, () => 0).save(identity);
    const fresh = createIdentityCache(storage, () => IDENTITY_CACHE_MAX_AGE_MS - 1);
    expect(await fresh.load()).not.toBeNull();
  });

  it("refuses a corrupt or half-written cache rather than crashing", async () => {
    expect(
      await createIdentityCache(memoryStorage({ [IDENTITY_CACHE_KEY]: "{not json" })).load()
    ).toBeNull();
    expect(
      await createIdentityCache(
        memoryStorage({ [IDENTITY_CACHE_KEY]: JSON.stringify({ staff: { id: "x" } }) })
      ).load()
    ).toBeNull();
  });

  it("clears on sign-out", async () => {
    const storage = memoryStorage();
    const cache = createIdentityCache(storage, () => 0);
    await cache.save(identity);
    await cache.clear();
    expect(await cache.load()).toBeNull();
  });
});
