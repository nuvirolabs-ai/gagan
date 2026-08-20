export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

interface LegacyStorage {
  removeItem(key: string): Promise<void>;
}

interface SessionStoreConfig {
  secureKey: string;
  legacyKeys: string[];
}

export function createSessionStore(
  secure: SecureStorage,
  legacy: LegacyStorage,
  config: SessionStoreConfig
) {
  const removeLegacy = () => Promise.all(config.legacyKeys.map((key) => legacy.removeItem(key)));

  return {
    async load(): Promise<SessionTokens | null> {
      const value = await secure.getItemAsync(config.secureKey);
      if (!value) return null;
      try {
        const parsed = JSON.parse(value) as Partial<SessionTokens>;
        if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") {
          throw new Error("invalid_session");
        }
        return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
      } catch {
        await secure.deleteItemAsync(config.secureKey);
        return null;
      }
    },
    async save(tokens: SessionTokens): Promise<void> {
      await secure.setItemAsync(config.secureKey, JSON.stringify(tokens));
      await removeLegacy();
    },
    async clear(): Promise<void> {
      await secure.deleteItemAsync(config.secureKey);
      await removeLegacy();
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
