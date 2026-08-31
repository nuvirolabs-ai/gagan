/**
 * The offline write queue's state machine, with no storage or network in it.
 *
 * Only writes that the server can safely accept late belong here: structured
 * customer activity and location pings. Money never does — an order or a
 * collection is submitted online, against a live credit and ledger position,
 * so nothing in this queue can finalise a financial fact.
 */

export type OutboxState = "LOCAL_PENDING" | "SYNCING" | "SYNCED" | "FAILED";

/** The write kinds allowed to wait offline. */
export type OutboxKind = "customer_activity" | "location_ping";

export interface OutboxItem {
  /** Device-generated; also sent as the server's idempotency reference. */
  id: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  state: OutboxState;
  attempts: number;
  lastError: string | null;
  createdAt: number;
}

/** Give up after this many failures and let the salesperson see the failure. */
export const MAX_ATTEMPTS = 5;

/** Keep the queue bounded so a long offline stretch cannot fill the device. */
export const MAX_QUEUE = 500;

export function enqueue(items: readonly OutboxItem[], item: OutboxItem): OutboxItem[] {
  // A retried enqueue of the same client reference must not double up.
  if (items.some((existing) => existing.id === item.id)) return [...items];
  const next = [...items, item];
  return next.length > MAX_QUEUE ? next.slice(next.length - MAX_QUEUE) : next;
}

/** Everything still waiting to reach the server, oldest first. */
export function pending(items: readonly OutboxItem[]): OutboxItem[] {
  return items
    .filter((item) => item.state === "LOCAL_PENDING" || item.state === "SYNCING")
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function markSyncing(items: readonly OutboxItem[], ids: readonly string[]): OutboxItem[] {
  const target = new Set(ids);
  return items.map((item) => (target.has(item.id) ? { ...item, state: "SYNCING" as const } : item));
}

export function markSynced(items: readonly OutboxItem[], ids: readonly string[]): OutboxItem[] {
  const target = new Set(ids);
  return items.map((item) => (target.has(item.id) ? { ...item, state: "SYNCED" as const } : item));
}

/**
 * A failed attempt goes back to LOCAL_PENDING so the next flush retries it,
 * until it has failed enough times to be worth telling the salesperson about.
 */
export function markFailed(
  items: readonly OutboxItem[],
  ids: readonly string[],
  error: string
): OutboxItem[] {
  const target = new Set(ids);
  return items.map((item) => {
    if (!target.has(item.id)) return item;
    const attempts = item.attempts + 1;
    return {
      ...item,
      attempts,
      lastError: error,
      state: attempts >= MAX_ATTEMPTS ? ("FAILED" as const) : ("LOCAL_PENDING" as const),
    };
  });
}

/** Drop settled rows once they are no longer interesting to show. */
/**
 * Hand exhausted writes back to the queue. Automatic flushes respect the
 * attempt cap so a dead zone cannot spin the radio forever; a salesperson
 * pressing "Sync now" is a new decision, so it clears the cap instead of
 * stranding their work on the phone.
 */
export function retryFailed(items: readonly OutboxItem[]): OutboxItem[] {
  return items.map((item) =>
    item.state === "FAILED"
      ? { ...item, state: "LOCAL_PENDING" as const, attempts: 0, lastError: null }
      : item
  );
}

export function prune(items: readonly OutboxItem[], keepSyncedCount = 20): OutboxItem[] {
  const synced = items.filter((item) => item.state === "SYNCED");
  const keep = new Set(synced.slice(-keepSyncedCount).map((item) => item.id));
  return items.filter((item) => item.state !== "SYNCED" || keep.has(item.id));
}

export interface OutboxSummary {
  pending: number;
  failed: number;
  synced: number;
}

export function summarise(items: readonly OutboxItem[]): OutboxSummary {
  return {
    pending: items.filter((item) => item.state === "LOCAL_PENDING" || item.state === "SYNCING")
      .length,
    failed: items.filter((item) => item.state === "FAILED").length,
    synced: items.filter((item) => item.state === "SYNCED").length,
  };
}

export function newItem(
  kind: OutboxKind,
  id: string,
  payload: Record<string, unknown>,
  createdAt: number
): OutboxItem {
  return { id, kind, payload, state: "LOCAL_PENDING", attempts: 0, lastError: null, createdAt };
}
