import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueue, markFailed, markSynced, markSyncing, newItem, pending, prune, retryFailed, summarise, type OutboxItem, type OutboxKind, type OutboxSummary } from "./outboxDomain";

export interface OutboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface OutboxSenders { customer_activity(payload:any):Promise<unknown>; location_ping(payloads:any[]):Promise<unknown>; }

// Shared across instances in this JS runtime, not just across flush calls.
// Never hold the storage lock over a network request: new work can persist
// while a sender waits. Each acknowledgement reloads the current queue.
const locks = new WeakMap<OutboxStorage, Map<string, Promise<unknown>>>();
const flushes = new WeakMap<OutboxStorage, Map<string, Promise<OutboxSummary>>>();
function mapFor<T>(map: WeakMap<OutboxStorage, Map<string,T>>, storage: OutboxStorage) {
  let value=map.get(storage);
  if (!value) { value=new Map(); map.set(storage,value); }
  return value;
}

export function createOutbox(options: {
  accountId: string;
  isCurrentAccount: () => boolean;
  senders: OutboxSenders;
  storage?: OutboxStorage;
  now?: () => number;
}) {
  if (!options.accountId.trim()) throw new Error("outbox_account_required");
  const storage=options.storage ?? AsyncStorage;
  const now=options.now ?? Date.now;
  // The old ownerless v1 key is deliberately retained, never automatically
  // assigned to whoever signs in next. Recovery requires verified ownership.
  const key="gagan.rep.outbox.v2."+encodeURIComponent(options.accountId);
  const assertAccount=() => { if (!options.isCurrentAccount()) throw new Error("outbox_account_changed"); };
  const serial=<T>(work: () => Promise<T>): Promise<T> => {
    const map=mapFor(locks,storage);
    const result=(map.get(key) ?? Promise.resolve()).catch(()=>{}).then(work);
    map.set(key,result);
    void result.finally(()=>{ if(map.get(key)===result) map.delete(key); }).catch(()=>{});
    return result;
  };
  async function read(): Promise<OutboxItem[]> {
    const raw=await storage.getItem(key);
    if(raw===null) {
      const legacy=await storage.getItem("gagan.rep.outbox.v1");
      if(legacy!==null) {
        let rows: any;
        try { rows=JSON.parse(legacy); } catch { throw new Error("outbox_legacy_storage_needs_owner_recovery"); }
        if(!Array.isArray(rows) || rows.some((item:any)=>item?.state!=="SYNCED")) {
          throw new Error("outbox_legacy_storage_needs_owner_recovery");
        }
      }
      return [];
    }
    let parsed: any;
    try { parsed=JSON.parse(raw); } catch { throw new Error("outbox_storage_corrupt"); }
    if(parsed?.version!==2 || parsed.accountId!==options.accountId || !Array.isArray(parsed.items)) throw new Error("outbox_storage_corrupt");
    const ids=new Set<string>();
    for(const item of parsed.items) {
      if(!item || typeof item.id!=="string" || !item.id || ids.has(item.id) ||
        !["customer_activity","location_ping"].includes(item.kind) ||
        !["LOCAL_PENDING","SYNCING","SYNCED","FAILED"].includes(item.state) ||
        !Number.isInteger(item.attempts) || item.attempts<0 || !Number.isFinite(item.createdAt) ||
        !item.payload || typeof item.payload!=="object" || Array.isArray(item.payload) ||
        !(item.lastError===null || typeof item.lastError==="string")) throw new Error("outbox_storage_corrupt");
      ids.add(item.id);
    }
    return parsed.items;
  }
  async function write(items: OutboxItem[]) {
    await storage.setItem(key,JSON.stringify({version:2,accountId:options.accountId,items:prune(items)}));
  }
  async function add(kind:OutboxKind,id:string,payload:Record<string,unknown>) {
    assertAccount();
    return serial(async()=>{
      assertAccount();
      const items=enqueue(await read(),newItem(kind,id,payload,now()));
      assertAccount();
      await write(items);
      return summarise(items);
    });
  }
  async function settle(ids:string[], error?:unknown) {
    // A response already sent as A may finish after logout. Persist its exact
    // acknowledgement to A's partition, without exposing it in B's session.
    await serial(async()=>{
      const items=await read();
      await write(error===undefined ? markSynced(items,ids) : markFailed(items,ids,error instanceof Error?error.message:"sync_failed"));
    });
  }
  async function deliver(items:OutboxItem[],send:()=>Promise<unknown>) {
    assertAccount();
    let failure:unknown;
    try { await send(); } catch(error) { failure=error ?? new Error("sync_failed"); }
    // Storage failures propagate, never get mislabelled as sender failures or
    // an empty/successful queue. A restart retries the same stable references.
    await settle(items.map(i=>i.id),failure);
  }
  async function flushOnce(includeFailed:boolean) {
    assertAccount();
    const waiting=await serial(async()=>{
      assertAccount();
      const items=includeFailed?retryFailed(await read()):await read();
      const next=pending(items);
      if(next.length) await write(markSyncing(items,next.map(i=>i.id)));
      return next;
    });
    for(const item of waiting.filter(i=>i.kind==="customer_activity")) await deliver([item],()=>options.senders.customer_activity(item.payload));
    const pings=waiting.filter(i=>i.kind==="location_ping");
    if(pings.length) await deliver(pings,()=>options.senders.location_ping(pings.map(i=>i.payload)));
    assertAccount();
    return serial(async()=>{ assertAccount(); const items=await read(); assertAccount(); return summarise(items); });
  }
  return {
    accountId:options.accountId,
    queueActivity:(id:string,payload:Record<string,unknown>)=>add("customer_activity",id,{...payload,clientReference:id}),
    queuePing:(id:string,payload:Record<string,unknown>)=>add("location_ping",id,{...payload,clientReference:id}),
    summary:()=>serial(async()=>{ assertAccount(); const items=await read(); assertAccount(); return summarise(items); }),
    items:()=>serial(async()=>{ assertAccount(); const items=await read(); assertAccount(); return items; }),
    flush({includeFailed=false}:{includeFailed?:boolean}={}):Promise<OutboxSummary> {
      try { assertAccount(); } catch(error) { return Promise.reject(error); }
      const map=mapFor(flushes,storage);
      let result=map.get(key);
      if(!result) {
        result=flushOnce(includeFailed).finally(()=>{map.delete(key);});
        map.set(key,result);
      }
      return result;
    },
    clear:()=>serial(async()=>{
      assertAccount();
      const items=await read();
      if(items.some(i=>i.state!=="SYNCED")) throw new Error("outbox_pending_work_retained");
      await write([]);
    }),
  };
}
export type Outbox=ReturnType<typeof createOutbox>;
