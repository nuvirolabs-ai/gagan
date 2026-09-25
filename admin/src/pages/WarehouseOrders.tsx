import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Icon, SectionLabel } from "../components/OperationalPrimitives";
import { formatOrderRef } from "../orderRef";

type QueueFilter = "all" | "confirmed" | "packed";
type WarehouseOrder = {
  id: string;
  orderNo: number;
  status: "confirmed" | "packed";
  createdAt: string;
  retailer: { id: string; name: string } | null;
  items: Array<{
    id: string;
    qtyOrdered: number;
    variant: {
      unitSize: string;
      unit: string;
      unitsPerCase: number;
      product: { name: string } | null;
    } | null;
  }>;
};

const FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
];

function statusLabel(status: WarehouseOrder["status"]) {
  return status === "confirmed" ? "Confirmed" : "Packed";
}

function createdLabel(value?: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function WarehouseOrders() {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WarehouseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.warehouseOrders(filter === "all" ? undefined : filter);
      const next = Array.isArray(result?.orders) ? result.orders as WarehouseOrder[] : [];
      setOrders(next);
      setSelectedId((current) => next.some((order) => order.id === current) ? current : next[0]?.id ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load warehouse orders");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let current = true;
    setDetailLoading(true);
    void api.warehouseOrder(selectedId)
      .then((result) => { if (current) setDetail(result.order as WarehouseOrder); })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : "Could not load order details");
      })
      .finally(() => { if (current) setDetailLoading(false); });
    return () => { current = false; };
  }, [selectedId]);

  const selected = detail?.id === selectedId
    ? detail
    : orders.find((order) => order.id === selectedId) ?? null;

  const pack = async () => {
    if (!selected || selected.status !== "confirmed") return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.packWarehouseOrder(selected.id);
      setDetail(result.order as WarehouseOrder);
      setNotice(`${formatOrderRef(selected)} marked packed`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update order");
    } finally {
      setBusy(false);
    }
  };

  return <div className="page-shell warehouse-orders-page">
    <header className="page-header warehouse-orders-header">
      <div>
        <SectionLabel>Warehouse / Order processing</SectionLabel>
        <h1 className="page-title">Warehouse orders</h1>
        <p className="page-sub">Confirmed orders ready for packing, with packed orders retained for reference.</p>
      </div>
      <div className="warehouse-queue-count" aria-live="polite">
        <span>eligible orders</span>
        <strong>{loading ? "—" : orders.length}</strong>
      </div>
    </header>

    <div className="warehouse-filters" role="group" aria-label="Order status">
      {FILTERS.map((item) => <button
        key={item.value}
        type="button"
        className={`warehouse-filter ${filter === item.value ? "selected" : ""}`}
        aria-pressed={filter === item.value}
        onClick={() => setFilter(item.value)}
      >{item.label}</button>)}
    </div>

    {error && <div className="banner error" role="alert">{error}</div>}
    {notice && <div className="banner success" role="status">{notice}</div>}

    <div className="warehouse-workspace">
      <section className="warehouse-queue" aria-label="Eligible orders">
        <div className="warehouse-section-heading">
          <div><SectionLabel>Queue</SectionLabel><h2>Eligible orders <em>{orders.length}</em></h2></div>
          <button type="button" className="button secondary compact warehouse-refresh" aria-label="Refresh orders" onClick={() => void load()} disabled={loading}>
            <Icon name="arrow" size={14} /> Refresh
          </button>
        </div>
        {loading ? <div className="empty-state quiet">Loading orders…</div>
          : orders.length === 0 ? <div className="empty-state quiet">No orders in this state.</div>
            : <div className="warehouse-order-list">{orders.map((order) => <button
              type="button"
              key={order.id}
              className={`warehouse-order-row ${selectedId === order.id ? "selected" : ""}`}
              aria-pressed={selectedId === order.id}
              onClick={() => setSelectedId(order.id)}
            >
              <span className="warehouse-order-identity">
                <strong>{formatOrderRef(order)}</strong>
                <small>{order.retailer?.name ?? "Retailer unavailable"}</small>
              </span>
              <span className="warehouse-order-lines">{order.items.length} {order.items.length === 1 ? "line" : "lines"}</span>
              <span className={`warehouse-status ${order.status}`}>{statusLabel(order.status)}</span>
              <time>{createdLabel(order.createdAt)}</time>
            </button>)}</div>}
      </section>

      <section className="warehouse-detail" aria-label="Order details">
        {!selected ? <div className="empty-state quiet">Select an eligible order to view its line items.</div>
          : <>
            <header className="warehouse-detail-header">
              <div>
                <SectionLabel>Order detail</SectionLabel>
                <h2>{formatOrderRef(selected)}</h2>
                <strong>{selected.retailer?.name ?? "Retailer unavailable"}</strong>
                <time>{createdLabel(selected.createdAt)}</time>
              </div>
              <span className={`warehouse-status ${selected.status}`}>{statusLabel(selected.status)}</span>
            </header>
            <div className="warehouse-lines-heading" aria-hidden="true"><span>Product</span><span>Pack</span><span>Quantity</span></div>
            <div className="warehouse-lines">{selected.items.map((item) => <div className="warehouse-line" key={item.id}>
              <strong>{item.variant?.product?.name ?? "Product unavailable"}</strong>
              <span>{item.variant ? `${item.variant.unitsPerCase} × ${item.variant.unitSize}` : "Pack unavailable"}</span>
              <b>{item.qtyOrdered} cases</b>
            </div>)}</div>
            {detailLoading && <p className="warehouse-detail-loading" role="status">Refreshing order detail…</p>}
            <footer className="warehouse-action">
              {selected.status === "confirmed"
                ? <button type="button" className="button primary" onClick={() => void pack()} disabled={busy || detailLoading}>
                    <Icon name="check" size={15} /> {busy ? "Saving…" : "Mark packed"}
                  </button>
                : <span className="warehouse-complete"><Icon name="check" size={15} /> Packing complete</span>}
            </footer>
          </>}
      </section>
    </div>
  </div>;
}
