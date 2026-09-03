export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function createSessionStore(secure: {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}) {
  const key = "founder.session.v1";
  return {
    async load(): Promise<SessionTokens | null> {
      const value = await secure.getItemAsync(key);
      if (!value) return null;
      try {
        const parsed = JSON.parse(value) as Partial<SessionTokens>;
        if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") {
          throw new Error("invalid");
        }
        return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
      } catch {
        await secure.deleteItemAsync(key);
        return null;
      }
    },
    async save(tokens: SessionTokens) {
      await secure.setItemAsync(key, JSON.stringify(tokens));
    },
    async clear() {
      await secure.deleteItemAsync(key);
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
