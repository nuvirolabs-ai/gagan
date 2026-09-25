import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The last identity the server confirmed, kept on the device so the app can
 * open in a dead zone.
 *
 * The cached permissions only decide which parts of the UI are drawn. Every
 * action is still authorised server-side on the request itself, so a stale
 * cache can show a salesperson a button, never let them use it.
 */
export interface CachedIdentity {
  staff: {
    id: string;
    name: string;
    phone: string;
    email: string;
    permissions: string[];
  };
  rep: { id: string; name: string; phone: string } | null;
  cachedAt: number;
}

export const IDENTITY_CACHE_KEY = "gagan.rep.identity.v1";

/** After this long with no contact, the cached identity is not trusted. */
export const IDENTITY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function isCachedIdentity(value: unknown): value is CachedIdentity {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as CachedIdentity;
  return (
    typeof candidate.cachedAt === "number" &&
    typeof candidate.staff?.id === "string" &&
    typeof candidate.staff?.name === "string" &&
    Array.isArray(candidate.staff?.permissions)
  );
}

export function createIdentityCache(storage: CacheStorage = AsyncStorage, now = () => Date.now()) {
  return {
    async save(identity: Omit<CachedIdentity, "cachedAt">): Promise<void> {
      await storage.setItem(
        IDENTITY_CACHE_KEY,
        JSON.stringify({ ...identity, cachedAt: now() })
      );
    },
    /** Returns null for a missing, unreadable, malformed or stale cache. */
    async load(): Promise<CachedIdentity | null> {
      try {
        const raw = await storage.getItem(IDENTITY_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!isCachedIdentity(parsed)) return null;
        if (now() - parsed.cachedAt > IDENTITY_CACHE_MAX_AGE_MS) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    async clear(): Promise<void> {
      await storage.removeItem(IDENTITY_CACHE_KEY);
    },
  };
}

export const staffIdentityCache = createIdentityCache();
