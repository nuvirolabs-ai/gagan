import { describe, expect, it } from "vitest";
import { createSessionStore } from "../sessionStore";

function setup() {
  const secure = new Map<string, string>();
  const removed: string[] = [];
  const store = createSessionStore(
    {
      getItemAsync: async (key) => secure.get(key) ?? null,
      setItemAsync: async (key, value) => { secure.set(key, value); },
      deleteItemAsync: async (key) => { secure.delete(key); },
    },
    { removeItem: async (key) => { removed.push(key); } },
    { secureKey: "staff-session", legacyKeys: ["gagan_rep_token"] }
  );
  return { store, secure, removed };
}

describe("staff secure session store", () => {
  it("stores both rotating tokens securely and deletes the legacy token", async () => {
    const { store, secure, removed } = setup();
    await store.save({ accessToken: "access", refreshToken: "refresh" });

    await expect(store.load()).resolves.toEqual({ accessToken: "access", refreshToken: "refresh" });
    expect(secure.get("staff-session")).toBe(JSON.stringify({ accessToken: "access", refreshToken: "refresh" }));
    expect(removed).toEqual(["gagan_rep_token"]);
  });
});
