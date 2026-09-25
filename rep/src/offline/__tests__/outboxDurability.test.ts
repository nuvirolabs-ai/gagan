import { describe, expect, it, vi } from "vitest";
import { createOutbox } from "../outbox";
import { createAccountBoundary } from "../../auth/accountBoundary";

function setup() {
  const data=new Map<string,string>();
  const storage={getItem:vi.fn(async(k:string)=>data.get(k)??null),setItem:vi.fn(async(k:string,v:string)=>{data.set(k,v);})};
  const boundary=createAccountBoundary(); boundary.set("A");
  const sender=vi.fn(async(_payload:any)=>({ok:true}));
  const create=(accountId="A")=>createOutbox({accountId,isCurrentAccount:boundary.bind(accountId),storage,senders:{customer_activity:sender,location_ping:vi.fn()}});
  return {data,storage,boundary,sender,create};
}
describe("durability and account boundaries",()=>{
  it("serializes two concurrent enqueues across queue instances",async()=>{
    const s=setup(),a=s.create(),b=s.create();
    await Promise.all([a.queueActivity("one",{}),b.queueActivity("two",{})]);
    expect((await a.items()).map(i=>i.id)).toEqual(["one","two"]);
  });
  it("retains pending work across a new queue instance/restart",async()=>{
    const s=setup(); await s.create().queueActivity("one",{});
    expect(await s.create().summary()).toMatchObject({pending:1});
    await s.create().flush(); expect(s.sender).toHaveBeenCalledTimes(1);
  });
  it("durably acknowledges only successful work when another sender fails",async()=>{
    const s=setup(),q=s.create();
    await q.queueActivity("one",{}); await q.queueActivity("two",{});
    s.sender.mockResolvedValueOnce({ok:true}).mockRejectedValueOnce(new Error("offline"));
    await q.flush();
    expect((await s.create().items()).map(i=>[i.id,i.state])).toEqual([["one","SYNCED"],["two","LOCAL_PENDING"]]);
    await s.create().flush(); expect(s.sender).toHaveBeenCalledTimes(3);
  });
  it("reports an enqueue storage failure and never claims it was queued",async()=>{
    const s=setup(),q=s.create();
    await q.queueActivity("one",{});
    s.storage.setItem.mockRejectedValueOnce(new Error("disk full"));
    await expect(q.queueActivity("two",{})).rejects.toThrow("disk full");
    expect((await q.items()).map(i=>i.id)).toEqual(["one"]);
    await q.queueActivity("two",{});
    expect(await q.summary()).toMatchObject({pending:2});
  });
  it("retains the same id after acknowledgement storage fails",async()=>{
    const s=setup(),q=s.create();
    await q.queueActivity("one",{});
    s.sender.mockImplementationOnce(async()=>{s.storage.setItem.mockRejectedValueOnce(new Error("write failed"));return {ok:true};});
    await expect(q.flush()).rejects.toThrow("write failed");
    expect(await s.create().summary()).toMatchObject({pending:1});
    await s.create().flush();
    expect(s.sender.mock.calls.map(c=>c[0].clientReference)).toEqual(["one","one"]);
  });
  it("surfaces a read error instead of succeeding with an empty queue",async()=>{
    const s=setup(),q=s.create();
    s.storage.getItem.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(q.flush()).rejects.toThrow("storage unavailable");
    expect(s.sender).not.toHaveBeenCalled();
  });
  it("rejects malformed envelopes without overwriting their bytes",async()=>{
    const s=setup(),q=s.create();
    s.data.set("gagan.rep.outbox.v2.A",JSON.stringify({version:2,accountId:"A",items:[{id:"broken"}]}));
    const before=s.data.get("gagan.rep.outbox.v2.A");
    await expect(q.queueActivity("one",{})).rejects.toThrow("outbox_storage_corrupt");
    expect(s.data.get("gagan.rep.outbox.v2.A")).toBe(before);
  });
  it("does not assign ownerless legacy data to the next login",async()=>{
    const s=setup(); s.data.set("gagan.rep.outbox.v1","legacy pending payload");
    await expect(s.create().items()).rejects.toThrow("outbox_legacy_storage_needs_owner_recovery");
    expect(s.data.get("gagan.rep.outbox.v1")).toBe("legacy pending payload");
  });
  it("revokes reads, enqueues and replay at logout but retains A's pending work",async()=>{
    const s=setup(),a=s.create();await a.queueActivity("one",{privateNote:"A"});
    s.boundary.set(null);
    await expect(a.items()).rejects.toThrow("account_changed");
    await expect(a.flush()).rejects.toThrow("account_changed");
    await expect(a.queueActivity("two",{})).rejects.toThrow("account_changed");
    s.boundary.set("B");const b=s.create("B");
    expect(await b.items()).toEqual([]);await b.flush();
    expect(s.sender).not.toHaveBeenCalled();
    s.boundary.set("A");
    await expect(a.flush()).rejects.toThrow("account_changed");
    expect(await s.create().summary()).toMatchObject({pending:1});
  });
  it("stops a batch on account switch and persists only A's in-flight acknowledgement",async()=>{
    const s=setup(),a=s.create();
    await a.queueActivity("one",{});await a.queueActivity("two",{});
    s.sender.mockImplementationOnce(async()=>{s.boundary.set("B");return {ok:true};});
    await expect(a.flush()).rejects.toThrow("account_changed");
    expect(s.sender).toHaveBeenCalledTimes(1);
    expect(await s.create("B").items()).toEqual([]);
    s.boundary.set("A");
    expect((await s.create().items()).map(i=>[i.id,i.state])).toEqual([["one","SYNCED"],["two","SYNCING"]]);
    await s.create().flush();expect(s.sender).toHaveBeenCalledTimes(2);
  });
  it("cannot clear business work during logout or while pending",async()=>{
    const s=setup(),q=s.create();await q.queueActivity("one",{});
    await expect(q.clear()).rejects.toThrow("pending_work_retained");
    expect(await q.summary()).toMatchObject({pending:1});
  });
});
