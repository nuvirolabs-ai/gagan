import { useCallback, useEffect, useState } from "react";
import { api, inr } from "../api";
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

export default function Orders() {
  const [tab, setTab] = useState("placed");
  const [orders, setOrders] = useState<any[]>([]);
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

  return (
    <div>
      <h1 className="page-title">Order queue</h1>
      <p className="page-sub">Approve, pack and dispatch retailer orders.</p>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 22 }} className="muted">
            Loading…
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 22 }} className="muted">
            No orders in this state.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Retailer</th>
                <th>Items</th>
                <th className="right">Value</th>
                <th>Status</th>
                <th className="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>
                      GGN-{String(o.orderNo).padStart(5, "0")}
                    </div>
                    <div className="muted small">
                      {new Date(o.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </td>
                  <td>
                    <div>{o.retailer.name}</div>
                    <div className="muted small">{o.retailer.phone}</div>
                  </td>
                  <td className="small">
                    {o.items.map((i: any) => (
                      <div key={i.id}>
                        {i.variant.product.name} × {i.qtyOrdered}
                      </div>
                    ))}
                  </td>
                  <td className="right" style={{ fontWeight: 700 }}>
                    {inr(Number(o.orderTotal))}
                  </td>
                  <td>
                    <span className={`pill ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  </td>
                  <td className="right">
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {o.status === "placed" && (
                        <>
                          <button
                            className="sm"
                            disabled={busyId === o.id}
                            onClick={() => act(o.id, () => api.approve(o.id), "Order approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="sm danger"
                            disabled={busyId === o.id}
                            onClick={() => act(o.id, () => api.reject(o.id), "Order rejected")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {o.status === "confirmed" && (
                        <button
                          className="sm"
                          disabled={busyId === o.id}
                          onClick={() => act(o.id, () => api.pack(o.id), "Order marked packed")}
                        >
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
                      {(o.status === "delivered" || o.status === "rejected") && (
                        <span className="muted small">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
