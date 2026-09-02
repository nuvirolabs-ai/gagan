import { useCallback, useEffect, useState } from "react";
import { api, inr } from "../api";
import { formatOrderRef } from "../orderRef";
import PodModal from "../components/PodModal";
import AssignModal from "../components/AssignModal";

const TABS = [
  { key: "placed", label: "Awaiting approval" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
};

const NEXT_ACTION: Record<string, string> = {
  placed: "Approve or reject this order.",
  confirmed: "Mark packed when the warehouse has picked it.",
  packed: "Assign a dispatch route.",
  out_for_delivery: "Capture proof of delivery.",
  delivered: "Complete. Invoice is on the ledger.",
  rejected: "Closed. No further fulfilment.",
};

function sapLabel(order: any) {
  const status = order.sapSyncStatus ?? "pending";
  if (status === "synced") return "Synced";
  if (status === "failed") return "Failed";
  return "Pending";
}

export default function Orders() {
  const [tab, setTab] = useState("placed");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [podOrder, setPodOrder] = useState<any | null>(null);
  const [assignOrder, setAssignOrder] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.orders(tab);
      setOrders(res.orders);
      setSelectedId((current) =>
        res.orders.some((order: any) => order.id === current) ? current : res.orders[0]?.id ?? null
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  const act = async (id: string, fn: () => Promise<unknown>, message: string) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const actions = (o: any) => (
    <div className="row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
      {o.status === "placed" && (
        <>
          <button className="sm" disabled={busyId === o.id} onClick={() => act(o.id, () => api.approve(o.id), "Order approved")}>
            Approve
          </button>
          <button className="sm danger" disabled={busyId === o.id} onClick={() => act(o.id, () => api.reject(o.id), "Order rejected")}>
            Reject
          </button>
        </>
      )}
      {o.status === "confirmed" && (
        <button className="sm" disabled={busyId === o.id} onClick={() => act(o.id, () => api.pack(o.id), "Order marked packed")}>
          Mark packed
        </button>
      )}
      {o.status === "packed" && (
        <button className="sm" disabled={busyId === o.id} onClick={() => setAssignOrder(o)}>
          Assign route
        </button>
      )}
      {o.status === "out_for_delivery" && (
        <button className="sm" disabled={busyId === o.id} onClick={() => setPodOrder(o)}>
          Capture delivery
        </button>
      )}
      {(o.status === "delivered" || o.status === "rejected") && <span className="muted small">No further action</span>}
    </div>
  );

  return (
    <div>
      <p className="eyebrow">Sales</p>
      <h1 className="page-title">Order workspace</h1>
      <p className="page-sub">Approve, pack, dispatch, then capture delivery. Select a row for commercial and SAP state.</p>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="workspace">
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="empty-state quiet">No orders in this state. That queue is clear.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Retailer</th>
                  <th>Items</th>
                  <th className="right">Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className={selectedId === o.id ? "selected" : ""}
                    onClick={() => setSelectedId(o.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div style={{ fontWeight: 700 }}>{formatOrderRef(o)}</div>
                      <div className="muted small">
                        {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    </td>
                    <td>
                      <div>{o.retailer.name}</div>
                      <div className="muted small">{o.retailer.phone}</div>
                    </td>
                    <td className="small">
                      {o.items.slice(0, 2).map((i: any) => (
                        <div key={i.id}>
                          {i.variant.product.name} × {i.qtyOrdered}
                        </div>
                      ))}
                      {o.items.length > 2 ? <div className="muted">+{o.items.length - 2} more</div> : null}
                    </td>
                    <td className="right" style={{ fontWeight: 700 }}>
                      {inr(Number(o.orderTotal))}
                    </td>
                    <td>
                      <span className={`pill ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="inspector">
          {!selected ? (
            <div className="empty-state quiet">Select an order to see the next action.</div>
          ) : (
            <>
              <p className="eyebrow">Selected</p>
              <h2>{formatOrderRef(selected)}</h2>
              <p className="muted small" style={{ margin: "0 0 14px" }}>
                {selected.retailer.name} · {selected.retailer.phone}
              </p>
              <dl className="kv">
                <dt>Value</dt>
                <dd>{inr(Number(selected.orderTotal))}</dd>
                <dt>Status</dt>
                <dd>
                  <span className={`pill ${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
                </dd>
                <dt>SAP</dt>
                <dd>
                  {sapLabel(selected)}
                  {selected.sapDocNum != null ? ` · DocNum ${selected.sapDocNum}` : ""}
                  {selected.sapDocEntry != null ? ` · DocEntry ${selected.sapDocEntry}` : ""}
                </dd>
                <dt>Route</dt>
                <dd>{selected.delivery?.routeId ?? "Not assigned"}</dd>
              </dl>
              <p className="inspector-next">{NEXT_ACTION[selected.status]}</p>
              <ul className="inspector-lines">
                {selected.items.map((i: any) => (
                  <li key={i.id}>
                    {i.variant.product.name} × {i.qtyOrdered} · {inr(Number(i.unitPrice))}
                  </li>
                ))}
              </ul>
              {actions(selected)}
            </>
          )}
        </aside>
      </div>

      {assignOrder && (
        <AssignModal
          order={assignOrder}
          onClose={() => setAssignOrder(null)}
          onDone={(msg) => {
            setAssignOrder(null);
            setNotice(msg);
            load();
          }}
        />
      )}
      {podOrder && (
        <PodModal
          order={podOrder}
          onClose={() => setPodOrder(null)}
          onDone={(msg) => {
            setPodOrder(null);
            setNotice(msg);
            load();
          }}
        />
      )}
    </div>
  );
}
