import { describe, expect, it } from "vitest";
import { createRetailerIdentityCache, RETAILER_IDENTITY_CACHE_MAX_AGE_MS } from "../identityCache";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: async (key: string) => data[key] ?? null,
    setItem: async (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: async (key: string) => {
      delete data[key];
    },
  };
}

describe("retailer identity cache", () => {
  it("restores a recently confirmed shop", async () => {
    const store = memoryStore();
    const write = createRetailerIdentityCache(store, () => 1_000);
    await write.save({ id: "r-1", name: "Annapurna Foods", phone: "9810000000" });
    const read = createRetailerIdentityCache(store, () => 1_000);
    await expect(read.load()).resolves.toMatchObject({ id: "r-1", name: "Annapurna Foods" });
  });

  it("ignores a stale cache", async () => {
    const store = memoryStore();
    const write = createRetailerIdentityCache(store, () => 1_000);
    await write.save({ id: "r-1", name: "Annapurna Foods", phone: "9810000000" });
    const read = createRetailerIdentityCache(store, () => 1_000 + RETAILER_IDENTITY_CACHE_MAX_AGE_MS + 1);
    await expect(read.load()).resolves.toBeNull();
  });
});
