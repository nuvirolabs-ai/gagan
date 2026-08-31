import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  enqueue,
  markFailed,
  markSynced,
  markSyncing,
  newItem,
  pending,
  prune,
  retryFailed,
  summarise,
  type OutboxItem,
  type OutboxKind,
  type OutboxSummary,
} from "./outboxDomain";

const STORAGE_KEY = "gagan.rep.outbox.v1";

export interface OutboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** How each queued write is actually delivered once the device is back online. */
export interface OutboxSenders {
  customer_activity(payload: any): Promise<unknown>;
  location_ping(payloads: any[]): Promise<unknown>;
}

/**
 * A durable queue for field writes that can safely arrive late. Reads and
 * writes go through AsyncStorage so a queued activity survives the app being
 * killed in a basement with no signal.
 */
export function createOutbox(options: {
  senders: OutboxSenders;
  storage?: OutboxStorage;
  now?: () => number;
}) {
  const storage = options.storage ?? AsyncStorage;
  const now = options.now ?? Date.now;
  let flushing: Promise<OutboxSummary> | null = null;

  async function read(): Promise<OutboxItem[]> {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
    } catch {
      // A corrupt queue must not brick the app; start clean instead.
      return [];
    }
  }

  async function write(items: OutboxItem[]) {
    await storage.setItem(STORAGE_KEY, JSON.stringify(prune(items)));
  }

  async function add(kind: OutboxKind, id: string, payload: Record<string, unknown>) {
    const items = enqueue(await read(), newItem(kind, id, payload, now()));
    await write(items);
    return summarise(items);
  }

  async function flushOnce(includeFailed: boolean): Promise<OutboxSummary> {
    const items = includeFailed ? retryFailed(await read()) : await read();
    const waiting = pending(items);
    if (waiting.length === 0) return summarise(items);

    let next = markSyncing(items, waiting.map((item) => item.id));
    await write(next);

    const activities = waiting.filter((item) => item.kind === "customer_activity");
    const pings = waiting.filter((item) => item.kind === "location_ping");

    for (const activity of activities) {
      try {
        await options.senders.customer_activity(activity.payload);
        next = markSynced(next, [activity.id]);
      } catch (error) {
        next = markFailed(next, [activity.id], errorText(error));
      }
    }

    if (pings.length > 0) {
      try {
        // Pings sync as one batch: it is one request per sync window rather
        // than one per reading, which is what keeps the radio (and battery)
        // use low.
        await options.senders.location_ping(pings.map((item) => item.payload));
        next = markSynced(next, pings.map((item) => item.id));
      } catch (error) {
        next = markFailed(next, pings.map((item) => item.id), errorText(error));
      }
    }

    await write(next);
    return summarise(next);
  }

  return {
    queueActivity: (clientReference: string, payload: Record<string, unknown>) =>
      add("customer_activity", clientReference, { ...payload, clientReference }),
    queuePing: (clientReference: string, payload: Record<string, unknown>) =>
      add("location_ping", clientReference, { ...payload, clientReference }),
    async summary() {
      return summarise(await read());
    },
    async items() {
      return read();
    },
    /**
     * Concurrent callers share one in-flight flush rather than racing.
     * `includeFailed` is for an explicit "Sync now": it gives writes that ran
     * out of automatic retries one more chance.
     */
    flush(options: { includeFailed?: boolean } = {}): Promise<OutboxSummary> {
      if (!flushing) {
        flushing = flushOnce(options.includeFailed ?? false).finally(() => {
          flushing = null;
        });
      }
      return flushing;
    },
    async clear() {
      await storage.setItem(STORAGE_KEY, "[]");
    },
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "sync_failed";
}

export type Outbox = ReturnType<typeof createOutbox>;
