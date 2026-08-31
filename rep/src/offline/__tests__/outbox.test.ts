import { describe, expect, it, vi } from "vitest";
import { createOutbox } from "../outbox";
import {
  MAX_ATTEMPTS,
  MAX_QUEUE,
  enqueue,
  markFailed,
  newItem,
  pending,
  prune,
  retryFailed,
  summarise,
} from "../outboxDomain";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("outbox state machine", () => {
  it("ignores a re-enqueue of the same client reference", () => {
    const first = enqueue([], newItem("customer_activity", "a-1", {}, 1));
    const second = enqueue(first, newItem("customer_activity", "a-1", {}, 2));
    expect(second).toHaveLength(1);
  });

  it("keeps the queue bounded during a long offline stretch", () => {
    let items = [] as ReturnType<typeof newItem>[];
    for (let index = 0; index < MAX_QUEUE + 25; index += 1) {
      items = enqueue(items, newItem("location_ping", `p-${index}`, {}, index));
    }
    expect(items).toHaveLength(MAX_QUEUE);
    // The newest readings survive; the oldest are dropped.
    expect(items[items.length - 1].id).toBe(`p-${MAX_QUEUE + 24}`);
  });

  it("retries a failure until it has tried enough times to report it", () => {
    let items = [newItem("customer_activity", "a-1", {}, 1)];
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      items = markFailed(items, ["a-1"], "offline");
      expect(items[0].state).toBe("LOCAL_PENDING");
    }
    items = markFailed(items, ["a-1"], "offline");
    expect(items[0]).toMatchObject({ state: "FAILED", attempts: MAX_ATTEMPTS, lastError: "offline" });
    expect(pending(items)).toEqual([]);
  });

  it("returns waiting writes oldest first", () => {
    const items = [
      newItem("customer_activity", "a-2", {}, 200),
      newItem("customer_activity", "a-1", {}, 100),
    ];
    expect(pending(items).map((item) => item.id)).toEqual(["a-1", "a-2"]);
  });

  it("prunes settled rows but keeps everything unsent", () => {
    const items = [
      { ...newItem("customer_activity", "a-1", {}, 1), state: "SYNCED" as const },
      { ...newItem("customer_activity", "a-2", {}, 2), state: "SYNCED" as const },
      newItem("customer_activity", "a-3", {}, 3),
    ];
    const kept = prune(items, 1);
    expect(kept.map((item) => item.id)).toEqual(["a-2", "a-3"]);
  });

  it("hands an exhausted write back to the queue with a clean slate", () => {
    const items = [
      { ...newItem("customer_activity", "a-1", {}, 1), state: "FAILED" as const, attempts: 5, lastError: "offline" },
      { ...newItem("customer_activity", "a-2", {}, 2), state: "SYNCED" as const },
    ];
    const retried = retryFailed(items);
    expect(retried[0]).toMatchObject({ state: "LOCAL_PENDING", attempts: 0, lastError: null });
    // Already-delivered writes are not resent.
    expect(retried[1].state).toBe("SYNCED");
  });

  it("summarises what the salesperson is waiting on", () => {
    const items = [
      newItem("customer_activity", "a-1", {}, 1),
      { ...newItem("customer_activity", "a-2", {}, 2), state: "FAILED" as const },
      { ...newItem("customer_activity", "a-3", {}, 3), state: "SYNCED" as const },
    ];
    expect(summarise(items)).toEqual({ pending: 1, failed: 1, synced: 1 });
  });
});

describe("outbox queue", () => {
  it("holds a write while offline and delivers it on the next flush", async () => {
    const senders = {
      customer_activity: vi
        .fn()
        .mockRejectedValueOnce(new Error("Network request failed"))
        .mockResolvedValueOnce({ ok: true }),
      location_ping: vi.fn(),
    };
    const outbox = createOutbox({ senders, storage: memoryStorage(), now: () => 1 });

    await outbox.queueActivity("device-1", { retailerId: "r-1", type: "stock_check" });
    expect(await outbox.summary()).toMatchObject({ pending: 1 });

    const offline = await outbox.flush();
    expect(offline).toMatchObject({ pending: 1, failed: 0 });

    const online = await outbox.flush();
    expect(online).toMatchObject({ pending: 0, synced: 1 });
    expect(senders.customer_activity).toHaveBeenCalledTimes(2);
  });

  it("sends the client reference with the payload so a replay is idempotent", async () => {
    const senders = { customer_activity: vi.fn().mockResolvedValue({}), location_ping: vi.fn() };
    const outbox = createOutbox({ senders, storage: memoryStorage(), now: () => 1 });

    await outbox.queueActivity("device-abc", { retailerId: "r-1", type: "note" });
    await outbox.flush();

    expect(senders.customer_activity).toHaveBeenCalledWith(
      expect.objectContaining({ clientReference: "device-abc" })
    );
  });

  it("sends buffered pings as one batch rather than one request each", async () => {
    const senders = { customer_activity: vi.fn(), location_ping: vi.fn().mockResolvedValue({}) };
    let clock = 0;
    const outbox = createOutbox({
      senders,
      storage: memoryStorage(),
      now: () => (clock += 1),
    });

    await outbox.queuePing("p-1", { latitude: 18.5, longitude: 73.8, accuracyMeters: 12 });
    await outbox.queuePing("p-2", { latitude: 18.6, longitude: 73.9, accuracyMeters: 14 });
    await outbox.flush();

    expect(senders.location_ping).toHaveBeenCalledTimes(1);
    expect(senders.location_ping.mock.calls[0][0]).toHaveLength(2);
  });

  it("shares one in-flight flush between concurrent callers", async () => {
    let release: (value: unknown) => void = () => {};
    const inFlight = new Promise((resolve) => {
      release = resolve;
    });
    const senders = {
      customer_activity: vi.fn().mockReturnValue(inFlight),
      location_ping: vi.fn(),
    };
    const outbox = createOutbox({ senders, storage: memoryStorage(), now: () => 1 });
    await outbox.queueActivity("device-1", {});

    const both = Promise.all([outbox.flush(), outbox.flush()]);
    release({});
    await both;

    // The second caller joined the first flush instead of sending again.
    expect(senders.customer_activity).toHaveBeenCalledTimes(1);
  });

  it("starts clean rather than crashing on a corrupt queue", async () => {
    const storage = memoryStorage();
    await storage.setItem("gagan.rep.outbox.v1", "{not json");
    const outbox = createOutbox({
      senders: { customer_activity: vi.fn(), location_ping: vi.fn() },
      storage,
      now: () => 1,
    });
    expect(await outbox.summary()).toEqual({ pending: 0, failed: 0, synced: 0 });
  });

  it("leaves an exhausted write alone on an automatic flush", async () => {
    const senders = {
      customer_activity: vi.fn().mockRejectedValue(new Error("Network request failed")),
      location_ping: vi.fn(),
    };
    const storage = memoryStorage();
    const outbox = createOutbox({ senders, storage, now: () => 1 });
    await outbox.queueActivity("device-1", {});
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) await outbox.flush();
    expect(await outbox.summary()).toMatchObject({ pending: 0, failed: 1 });

    senders.customer_activity.mockClear();
    await outbox.flush();
    // The automatic flush respects the cap, so nothing is retried.
    expect(senders.customer_activity).not.toHaveBeenCalled();
  });

  it("gives an exhausted write another chance when the salesperson syncs by hand", async () => {
    const senders = {
      customer_activity: vi.fn().mockRejectedValue(new Error("Network request failed")),
      location_ping: vi.fn(),
    };
    const outbox = createOutbox({ senders, storage: memoryStorage(), now: () => 1 });
    await outbox.queueActivity("device-1", {});
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) await outbox.flush();
    expect(await outbox.summary()).toMatchObject({ failed: 1 });

    senders.customer_activity.mockResolvedValueOnce({ ok: true });
    const result = await outbox.flush({ includeFailed: true });
    expect(result).toMatchObject({ pending: 0, failed: 0, synced: 1 });
  });

  it("does nothing when there is nothing waiting", async () => {
    const senders = { customer_activity: vi.fn(), location_ping: vi.fn() };
    const outbox = createOutbox({ senders, storage: memoryStorage(), now: () => 1 });
    await outbox.flush();
    expect(senders.customer_activity).not.toHaveBeenCalled();
    expect(senders.location_ping).not.toHaveBeenCalled();
  });
});
