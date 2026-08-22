import { describe, expect, it } from "vitest";
import { createLanguageStore } from "../languageStore";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => void values.set(key, value),
    removeItem: async (key: string) => void values.delete(key),
  };
}

describe("retailer language store", () => {
  it("loads null when no language is stored", async () => {
    const storage = memoryStorage();
    const store = createLanguageStore(storage, "gagan.language.retailer");
    await expect(store.loadLanguage()).resolves.toBeNull();
  });

  it("persists and loads a valid language using the app-specific key", async () => {
    const storage = memoryStorage();
    const store = createLanguageStore(storage, "gagan.language.retailer");
    await store.saveLanguage("hi");
    expect(storage.values.get("gagan.language.retailer")).toBe("hi");
    await expect(store.loadLanguage()).resolves.toBe("hi");
  });

  it("ignores invalid persisted values", async () => {
    const storage = memoryStorage();
    storage.values.set("gagan.language.retailer", "fr");
    const store = createLanguageStore(storage, "gagan.language.retailer");
    await expect(store.loadLanguage()).resolves.toBeNull();
  });
});
