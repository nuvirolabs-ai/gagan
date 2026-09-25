import { describe, expect, it, vi } from "vitest";
import { createOutbox } from "../outbox";
describe("outbox concurrent storage regression", () => {
  it("preserves an enqueue made while the sender is pending", async () => {
    const data = new Map<string,string>();
    const storage = { getItem: async (k:string) => data.get(k) ?? null, setItem: async(k:string,v:string) => { data.set(k,v); } };
    let release!: () => void;
    let started!: () => void;
    const begun = new Promise<void>(r => { started=r; });
    const waiting = new Promise<void>(r => { release=r; });
    const send = vi.fn(async () => { started(); await waiting; });
    const box = createOutbox({ accountId:"A", isCurrentAccount:() => true, storage, senders:{customer_activity:send,location_ping:vi.fn()} });
    await box.queueActivity("A1",{type:"note"});
    const flushing=box.flush();
    await begun;
    await box.queueActivity("A2",{type:"note"});
    release(); await flushing;
    expect((await box.items()).find(i=>i.id==="A2")?.state).toBe("LOCAL_PENDING");
  });
});
