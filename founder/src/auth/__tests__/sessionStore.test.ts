import { describe, expect, it } from "vitest";
import { createSessionStore } from "../sessionStore";

function setup() {
  const secure = new Map<string, string>();
  const removed: string[] = [];
  const store = createSessionStore(
    {
      getItemAsync: async (key) => secure.get(key) ?? null,
      setItemAsync: async (key, value) => {
        secure.set(key, value);
      },
      deleteItemAsync: async (key) => {
        secure.delete(key);
      },
    },
    {
      removeItem: async (key) => {
        removed.push(key);
      },
    },
    { secureKey: "founder-session", legacyKeys: ["gagan_founder_token"] }
  );
  return { store, secure, removed };
}

describe("founder session store", () => {
  it("stores rotating tokens and clears legacy keys", async () => {
    const { store, secure, removed } = setup();
    await store.save({ accessToken: "access", refreshToken: "refresh" });
    await expect(store.load()).resolves.toEqual({ accessToken: "access", refreshToken: "refresh" });
    expect(secure.get("founder-session")).toBe(JSON.stringify({ accessToken: "access", refreshToken: "refresh" }));
    expect(removed).toEqual(["gagan_founder_token"]);
  });
});
