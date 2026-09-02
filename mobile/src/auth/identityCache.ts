import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Last server-confirmed shop identity. Used only to keep the retailer UI open
 * when `/auth/me` cannot be reached. Writes still require a live session.
 */
export interface CachedRetailer {
  id: string;
  name: string;
  phone: string;
  cachedAt: number;
}

export const RETAILER_IDENTITY_CACHE_KEY = "gagan.retailer.identity.v1";
export const RETAILER_IDENTITY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function isCachedRetailer(value: unknown): value is CachedRetailer {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as CachedRetailer;
  return (
    typeof candidate.cachedAt === "number" &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.phone === "string"
  );
}

export function createRetailerIdentityCache(storage: CacheStorage = AsyncStorage, now = () => Date.now()) {
  return {
    async save(identity: Omit<CachedRetailer, "cachedAt">): Promise<void> {
      await storage.setItem(
        RETAILER_IDENTITY_CACHE_KEY,
        JSON.stringify({ ...identity, cachedAt: now() })
      );
    },
    async load(): Promise<CachedRetailer | null> {
      try {
        const raw = await storage.getItem(RETAILER_IDENTITY_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!isCachedRetailer(parsed)) return null;
        if (now() - parsed.cachedAt > RETAILER_IDENTITY_CACHE_MAX_AGE_MS) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    async clear(): Promise<void> {
      await storage.removeItem(RETAILER_IDENTITY_CACHE_KEY);
    },
  };
}

export const retailerIdentityCache = createRetailerIdentityCache();
