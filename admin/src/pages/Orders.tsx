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
  const selectedTab = TABS.find((item) => item.key === tab)?.label ?? "Orders";
  const queueValue = orders.reduce((sum, order) => sum + Number(order.orderTotal ?? 0), 0);

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
    <div className="row inspector-action-row">
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
    <div className="page-shell orders-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Sales / Orders</p>
          <h1 className="page-title">Orders</h1>
          <p className="page-sub">Move each order through its next safe step. Select a row to inspect the work.</p>
        </div>
        <div className="header-context"><span className="live-indicator"><span className="live-dot" /> Live queue</span></div>
      </header>

      <section className="orders-summary" aria-label="Current order queue summary">
        <div className="summary-stat"><span className="metric-label">Current queue</span><strong>{selectedTab}</strong></div>
        <div className="summary-stat"><span className="metric-label">Orders</span><strong>{loading ? "—" : orders.length}</strong></div>
        <div className="summary-stat"><span className="metric-label">Queue value</span><strong>{loading ? "—" : inr(queueValue)}</strong></div>
        <div className="summary-note"><span className="status-mark" /> Select an order to see the next action.</div>
      </section>

      <div className="tabs queue-tabs" aria-label="Order status">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="workspace">
        <div className="table-wrap orders-table-wrap">
          {loading ? (
            <div className="table-loading" aria-label="Loading orders">
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state quiet">No orders in this state. That queue is clear.</div>
          ) : (
            <table className="orders-table">
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

        <aside className="inspector order-inspector" aria-label="Selected order">
          {!selected ? (
            <div className="empty-state quiet">Select an order to see the next action.</div>
          ) : (
            <>
              <div className="inspector-identity">
                <p className="eyebrow">Order</p>
                <h2>{formatOrderRef(selected)}</h2>
                <p className="muted small">
                {selected.retailer.name} · {selected.retailer.phone}
                </p>
              </div>
              <div className="inspector-status-row">
                <span className={`pill ${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
                <strong>{inr(Number(selected.orderTotal))}</strong>
              </div>
              <div className="inspector-attention">
                <span className="eyebrow">Next action</span>
                <p>{NEXT_ACTION[selected.status]}</p>
              </div>
              <div className="inspector-section">
                <h3>Order facts</h3>
                <dl className="kv">
                  <dt>Route</dt>
                  <dd>{selected.delivery?.routeId ?? "Not assigned"}</dd>
                  <dt>SAP</dt>
                  <dd>{sapLabel(selected)}{selected.sapDocNum != null ? ` · DocNum ${selected.sapDocNum}` : ""}</dd>
                </dl>
              </div>
              <div className="inspector-section">
                <h3>Items <span>{selected.items.length}</span></h3>
                <ul className="inspector-lines">
                {selected.items.map((i: any) => (
                  <li key={i.id}>
                    <span>{i.variant.product.name} × {i.qtyOrdered}</span>
                    <span className="muted">{inr(Number(i.unitPrice))}</span>
                  </li>
                ))}
                </ul>
              </div>
              <div className="inspector-actions">{actions(selected)}</div>
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
