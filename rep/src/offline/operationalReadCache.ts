import AsyncStorage from "@react-native-async-storage/async-storage";

export type OperationalReadKind = "today" | "route";

export const OPERATIONAL_CACHE_VERSION = 1 as const;
/** Current-day data is useful across a short dead zone, not across an old day. */
export const OPERATIONAL_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** A read snapshot must never become a large secondary database on the phone. */
export const OPERATIONAL_CACHE_MAX_BYTES = 512 * 1024;
/** Bound retained account namespaces on a shared or handed-over device. */
export const OPERATIONAL_CACHE_MAX_PARTITIONS = 4;

const CACHE_PREFIX = "gagan.rep.operational.v1.";
const INDEX_KEY = `${CACHE_PREFIX}index`;
const FORBIDDEN_KEYS = /^(?:accessToken|refreshToken|password|secret|apiKey|authorization|cookie)$/i;

export interface OperationalCacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface OperationalReadSnapshot<T extends Record<string, unknown> = Record<string, unknown>> {
  payload: T;
  capturedAt: number;
  ageMs: number;
  source: "cache";
}

export interface OperationalReadCacheStore {
  read(kind: OperationalReadKind): Promise<OperationalReadSnapshot | null>;
  save(kind: OperationalReadKind, payload: unknown): Promise<boolean>;
  clear?(kind: OperationalReadKind): Promise<void>;
}

export type OperationalReadResult<T> =
  | { value: T; source: "network"; capturedAt?: never }
  | { value: T; source: "cache"; capturedAt: number };

interface StoredSnapshot {
  capturedAt: number;
  payload: Record<string, unknown>;
}

interface StoredEnvelope {
  version: typeof OPERATIONAL_CACHE_VERSION;
  accountId: string;
  apiOrigin: string;
  snapshots: Partial<Record<OperationalReadKind, StoredSnapshot>>;
}

interface IndexEntry {
  key: string;
  lastSavedAt: number;
}

interface OperationalReadCacheOptions {
  accountId: string;
  apiOrigin: string;
  storage?: OperationalCacheStorage;
  now?: () => number;
  isCurrentAccount?: () => boolean;
}

// AsyncStorage calls are asynchronous. Serialising all operations for one
// storage object prevents a Today save and a Route save from overwriting each
// other's envelope or pruning an account partition mid-write.
const storageLocks = new WeakMap<object, Promise<void>>();

async function withStorageLock<T>(storage: object, work: () => Promise<T>): Promise<T> {
  const previous = storageLocks.get(storage) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const chain = previous.catch(() => undefined).then(() => current);
  storageLocks.set(storage, chain);
  await previous.catch(() => undefined);
  try {
    return await work();
  } finally {
    release();
    if (storageLocks.get(storage) === chain) storageLocks.delete(storage);
  }
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function operationalCacheKey(accountId: string, apiOrigin: string): string {
  return `${CACHE_PREFIX}${encodeURIComponent(normalizeOrigin(apiOrigin))}.${encodeURIComponent(accountId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsForbiddenKey(value: unknown, seen = new Set<unknown>()): boolean {
  if (Array.isArray(value)) {
    if (seen.has(value)) return true;
    seen.add(value);
    return value.some((item) => containsForbiddenKey(item, seen));
  }
  if (!isRecord(value)) return false;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.test(key) || containsForbiddenKey(child, seen));
}

function isSafePayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || containsForbiddenKey(value)) return false;
  try {
    return typeof JSON.stringify(value) === "string";
  } catch {
    return false;
  }
}

function isStoredSnapshot(value: unknown): value is StoredSnapshot {
  return isRecord(value)
    && typeof value.capturedAt === "number"
    && Number.isFinite(value.capturedAt)
    && value.capturedAt >= 0
    && isSafePayload(value.payload);
}

function isStoredEnvelope(value: unknown, accountId: string, apiOrigin: string): value is StoredEnvelope {
  if (!isRecord(value)
    || value.version !== OPERATIONAL_CACHE_VERSION
    || value.accountId !== accountId
    || value.apiOrigin !== normalizeOrigin(apiOrigin)
    || !isRecord(value.snapshots)) {
    return false;
  }
  const snapshots = value.snapshots as Record<string, unknown>;
  return (["today", "route"] as OperationalReadKind[]).every((kind) => {
    const snapshot = snapshots[kind];
    return snapshot === undefined || isStoredSnapshot(snapshot);
  });
}

function parseIndex(raw: string | null): IndexEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is IndexEntry =>
      isRecord(entry)
      && typeof entry.key === "string"
      && entry.key.startsWith(CACHE_PREFIX)
      && entry.key !== INDEX_KEY
      && typeof entry.lastSavedAt === "number"
      && Number.isFinite(entry.lastSavedAt)
    );
  } catch {
    return [];
  }
}

function parseEnvelope(raw: string | null, accountId: string, apiOrigin: string): StoredEnvelope | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredEnvelope(parsed, accountId, apiOrigin) ? parsed : null;
  } catch {
    return null;
  }
}

export function isOperationalTodayPayload(value: unknown): value is Record<string, unknown> {
  if (!isSafePayload(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.targetScopeVersion !== 2) return false;
  const arrayFields = ["targets", "tasks", "followUps", "notifications", "serviceIssues"];
  if (arrayFields.some((field) => candidate[field] !== undefined && !Array.isArray(candidate[field]))) return false;
  if (candidate.pendingCollections !== undefined
    && (!isRecord(candidate.pendingCollections)
      || (candidate.pendingCollections.retailers !== undefined && !Array.isArray(candidate.pendingCollections.retailers)))) return false;
  if (candidate.opportunities !== undefined
    && (!isRecord(candidate.opportunities)
      || (candidate.opportunities.actions !== undefined && !Array.isArray(candidate.opportunities.actions)))) return false;
  if (candidate.achievements !== undefined
    && (!isRecord(candidate.achievements)
      || (candidate.achievements.new !== undefined && !Array.isArray(candidate.achievements.new)))) return false;
  return candidate.route === undefined || candidate.route === null || isOperationalRoutePayload(candidate.route);
}

export function isOperationalRoutePayload(value: unknown): value is Record<string, unknown> {
  if (!isSafePayload(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.stops) || !isRecord(candidate.progress)) return false;
  const progress = candidate.progress as Record<string, unknown>;
  const progressFields = ["visited", "skipped", "pending", "total", "completionPct"];
  if (progressFields.some((field) => progress[field] !== undefined && typeof progress[field] !== "number")) return false;
  return candidate.stops.every((stop) => {
    if (!isRecord(stop) || typeof stop.id !== "string" || !isRecord(stop.retailer)) return false;
    return typeof stop.retailer.id === "string" && typeof stop.retailer.name === "string";
  });
}

export function createOperationalReadCache(options: OperationalReadCacheOptions) {
  const storage = options.storage ?? AsyncStorage;
  const now = options.now ?? (() => Date.now());
  const accountId = options.accountId;
  const apiOrigin = normalizeOrigin(options.apiOrigin);
  const key = operationalCacheKey(accountId, apiOrigin);
  const isCurrentAccount = options.isCurrentAccount ?? (() => true);

  async function readEnvelope(): Promise<StoredEnvelope | null> {
    const raw = await storage.getItem(key);
    const parsed = parseEnvelope(raw, accountId, apiOrigin);
    if (raw && !parsed) {
      // A corrupt or old cache is disposable read state. Never allow it to
      // escape into a screen, and never turn the failure into a fake success.
      try { await storage.removeItem(key); } catch { /* fail closed */ }
    }
    return parsed;
  }

  async function removeFromIndex(): Promise<void> {
    try {
      const entries = parseIndex(await storage.getItem(INDEX_KEY));
      await storage.setItem(INDEX_KEY, JSON.stringify(entries.filter((entry) => entry.key !== key)));
    } catch {
      // Index cleanup is best-effort; the account key remains isolated and
      // bounded to one envelope even if storage is temporarily unavailable.
    }
  }

  return {
    key,
    accountId,
    apiOrigin,
    isCurrentAccount,

    async read(kind: OperationalReadKind): Promise<OperationalReadSnapshot | null> {
      if (!isCurrentAccount()) return null;
      return withStorageLock(storage, async () => {
        if (!isCurrentAccount()) return null;
        try {
          const envelope = await readEnvelope();
          const snapshot = envelope?.snapshots[kind];
          if (!snapshot) return null;
          const ageMs = Math.max(0, now() - snapshot.capturedAt);
          if (ageMs > OPERATIONAL_CACHE_MAX_AGE_MS) {
            const next: StoredEnvelope = { ...envelope, snapshots: { ...envelope.snapshots } };
            delete next.snapshots[kind];
            try {
              await storage.setItem(key, JSON.stringify(next));
            } catch { /* an expired snapshot is still never returned */ }
            return null;
          }
          return { payload: snapshot.payload, capturedAt: snapshot.capturedAt, ageMs, source: "cache" };
        } catch {
          return null;
        }
      });
    },

    async save(kind: OperationalReadKind, payload: unknown): Promise<boolean> {
      if (!isCurrentAccount() || !isSafePayload(payload)) return false;
      return withStorageLock(storage, async () => {
        if (!isCurrentAccount()) return false;
        try {
          const existingRaw = await storage.getItem(key);
          const existing = parseEnvelope(existingRaw, accountId, apiOrigin);
          const next: StoredEnvelope = {
            version: OPERATIONAL_CACHE_VERSION,
            accountId,
            apiOrigin,
            snapshots: {
              ...(existing?.snapshots ?? {}),
              [kind]: { capturedAt: now(), payload },
            },
          };
          const serialized = JSON.stringify(next);
          if (serialized.length > OPERATIONAL_CACHE_MAX_BYTES) return false;
          await storage.setItem(key, serialized);

          const entries = parseIndex(await storage.getItem(INDEX_KEY))
            .filter((entry) => entry.key !== key)
            .concat({ key, lastSavedAt: now() })
            .sort((a, b) => b.lastSavedAt - a.lastSavedAt);
          const keep = entries.slice(0, OPERATIONAL_CACHE_MAX_PARTITIONS);
          for (const entry of entries.slice(OPERATIONAL_CACHE_MAX_PARTITIONS)) {
            try { await storage.removeItem(entry.key); } catch { /* next save retries pruning */ }
          }
          await storage.setItem(INDEX_KEY, JSON.stringify(keep));
          return true;
        } catch {
          // A cache write failure must not turn an otherwise successful live
          // request into a failed user action.
          return false;
        }
      });
    },

    async clear(kind?: OperationalReadKind): Promise<void> {
      if (!isCurrentAccount()) return;
      await withStorageLock(storage, async () => {
        if (!isCurrentAccount()) return;
        try {
          if (!kind) {
            await storage.removeItem(key);
            await removeFromIndex();
            return;
          }
          const envelope = await readEnvelope();
          if (!envelope?.snapshots[kind]) return;
          const next: StoredEnvelope = { ...envelope, snapshots: { ...envelope.snapshots } };
          delete next.snapshots[kind];
          await storage.setItem(key, JSON.stringify(next));
        } catch { /* cache cleanup is never allowed to crash a screen */ }
      });
    },
  };
}

/**
 * Shared read-side policy used by screens: live data wins, only an eligible
 * transient failure can consult the bounded cache, and malformed live data
 * fails closed because the validator error is not a transport failure.
 */
export async function loadOperationalRead<T>(options: {
  kind: OperationalReadKind;
  cache: OperationalReadCacheStore;
  load: () => Promise<unknown>;
  validate: (value: unknown) => value is T;
  isFallbackError: (error: unknown) => boolean;
}): Promise<OperationalReadResult<T>> {
  try {
    const value = await options.load();
    if (!options.validate(value)) throw new Error("operational_read_malformed");
    await options.cache.save(options.kind, value);
    return { value, source: "network" };
  } catch (error) {
    if (!options.isFallbackError(error)) throw error;
    const cached = await options.cache.read(options.kind);
    if (!cached) throw error;
    if (!options.validate(cached.payload)) {
      await options.cache.clear?.(options.kind);
      throw error;
    }
    return { value: cached.payload as T, source: "cache", capturedAt: cached.capturedAt };
  }
}
