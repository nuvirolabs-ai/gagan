import { useEffect, useRef, type ReactNode } from "react";
import { inr } from "../api";
import { ageLabel } from "./operationalUtils";
import { Icon } from "./OperationalPrimitives";
import { formatOrderRef } from "../orderRef";
import {
  NEXT_ACTION,
  STATUS_LABEL,
  dependencyCopy,
  orderHealth,
  packLabel,
  productLabel,
  queueStatusLabel,
  storedLineValue,
  toneFor,
} from "../orderReviewModel";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

function focusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    return element.tabIndex >= 0;
  });
}

export function OrderActionControls({
  order,
  busy,
  pendingAction,
  holdOpen,
  holdReason,
  holdError,
  idSuffix = "review",
  onHoldReason,
  onStartHold,
  onCancelHold,
  onConfirmHold,
  onApprove,
  onReject,
  onRelease,
  onPack,
  onAssign,
  onCapture,
}: {
  order: any;
  busy: boolean;
  pendingAction: "approve" | "reject" | "hold" | "release" | "pack" | null;
  holdOpen: boolean;
  holdReason: string;
  holdError: string | null;
  idSuffix?: string;
  onHoldReason: (value: string) => void;
  onStartHold: () => void;
  onCancelHold: () => void;
  onConfirmHold: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRelease: () => void;
  onPack: () => void;
  onAssign: () => void;
  onCapture: () => void;
}) {
  const onHold = Boolean(order.internalStatus?.isOnHold);
  return <div className="row inspector-action-row dock-actions">
    {order.status === "placed" && <>
      <button type="button" className="button primary compact" disabled={busy} onClick={onApprove}>{pendingAction === "approve" ? "Approving…" : <>Approve <Icon name="arrow" size={13} /></>}</button>
      <button type="button" className="button danger compact secondary-action" disabled={busy} onClick={onReject}>{pendingAction === "reject" ? "Rejecting…" : "Reject"}</button>
    </>}
    {order.status === "confirmed" && <button type="button" className="button primary compact" disabled={busy} onClick={onPack}>{pendingAction === "pack" ? "Saving…" : <>Mark packed <Icon name="arrow" size={13} /></>}</button>}
    {order.status === "packed" && <button type="button" className="button primary compact" disabled={busy} onClick={onAssign}>Assign route <Icon name="arrow" size={13} /></button>}
    {order.status === "out_for_delivery" && <button type="button" className="button primary compact" disabled={busy} onClick={onCapture}>Capture delivery <Icon name="arrow" size={13} /></button>}
    {onHold
      ? <button type="button" className="button secondary compact" disabled={busy} onClick={onRelease}>{pendingAction === "release" ? "Releasing…" : "Release hold"}</button>
      : holdOpen
        ? <div className="order-hold-draft">
            <label htmlFor={`hold-reason-${idSuffix}-${order.id}`}>Hold reason</label>
            <input id={`hold-reason-${idSuffix}-${order.id}`} aria-label="Hold reason" value={holdReason} onChange={(event) => onHoldReason(event.target.value)} disabled={busy} minLength={3} maxLength={240} required />
            <button type="button" className="button secondary compact" disabled={busy} onClick={onConfirmHold}>{pendingAction === "hold" ? "Holding…" : "Confirm hold"}</button>
            <button type="button" className="button ghost compact" disabled={busy} onClick={onCancelHold}>Cancel</button>
            {holdError ? <p role="alert">{holdError}</p> : null}
          </div>
        : <button type="button" className="button secondary compact" disabled={busy} onClick={onStartHold}>Put on hold</button>}
    {(order.status === "delivered" || order.status === "rejected") && !onHold && <span className="muted small">No further action</span>}
  </div>;
}

export default function OrderReviewModal({
  order,
  busy,
  error,
  onClose,
  onOpenDetails,
  actions,
}: {
  order: any;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onOpenDetails: () => void;
  actions: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busyRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = focusable(dialogRef.current);
      if (items.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      restore?.focus();
    };
  }, []);

  const lines = Array.isArray(order.items) ? order.items : [];
  const health = orderHealth(order);
  const action = NEXT_ACTION[order.status] ?? "Inspect order";
  const titleId = "order-review-title";

  return <div className="order-review-backdrop" onClick={() => { if (!busy) onClose(); }}>
    <div
      className="order-review-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      ref={dialogRef}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="order-review-header">
        <div className="order-review-identity">
          <p className="order-review-kicker">Order review</p>
          <h2 id={titleId}>{formatOrderRef(order)}</h2>
          <p>{order.retailer?.name ?? "Retailer unavailable"}</p>
          <p>Placed {ageLabel(order.createdAt)} ago{order.retailer?.phone ? ` · ${order.retailer.phone}` : ""}</p>
        </div>
        <div className="order-review-facts">
          <strong>{inr(Number(order.orderTotal ?? 0))}</strong>
          <span>{lines.length} {lines.length === 1 ? "item" : "items"}</span>
          <span className={`constraint ${toneFor(order)}`}>{queueStatusLabel(order)}</span>
          <span className="order-review-lifecycle">{STATUS_LABEL[order.status] ?? order.status}</span>
        </div>
        <div className="order-review-header-actions">
          <button type="button" className="text-button" onClick={onOpenDetails}>Open full order details</button>
          <button type="button" className="button ghost compact" onClick={onClose} disabled={busy}>Close</button>
        </div>
      </header>

      <div className="order-review-scroll" role="region" aria-label="Order review details">
        <section className="order-review-next">
          <span className="decision-kicker">Next safe action</span>
          <strong>{action}</strong>
          <p>{dependencyCopy(order)}</p>
        </section>
        {error ? <div className="banner error" role="alert">{error}</div> : null}
        <section className="order-review-health" aria-label="Order health">
          <div className="section-head"><div><h3>Order health</h3></div></div>
          <div className="health-matrix compact">{health.map((cell) => <div className={`health-cell ${cell.tone}`} key={cell.label}><Icon name={cell.icon} /><span><b>{cell.label}</b><small>{cell.value}</small></span></div>)}</div>
        </section>

        {/* Multi-Warehouse & Salesperson Attribution */}
        <section className="order-review-attribution-card" aria-label="Order attribution and warehouse details" style={{
          background: "#f1f5f9",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "start" }}>
            <div>
              <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                👤 Punched By / Salesperson
              </span>
              <strong style={{ fontSize: 13, color: "#0f172a", marginTop: 2, display: "block" }}>
                {order.salespersonName || order.retailer?.salesRep?.name || (order.placedBy === "rep" ? "Field Sales Rep" : "Direct Retailer")}
              </strong>
              <span style={{ fontSize: 12, color: "#64748b", display: "block", marginTop: 2 }}>
                {order.punchedByLabel || (order.placedBy === "rep" ? "Salesperson App" : "Retailer Direct")}
              </span>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                🏢 Fulfillment Warehouse
              </span>
              <strong style={{ fontSize: 13, color: "#0f172a", marginTop: 2, display: "block" }}>
                {order.warehouseName || (order.warehouseCode === "WH-002" ? "Bhopal Regional Hub" : "Indore Central Fulfillment Hub")}
              </strong>
              <span style={{ fontSize: 12, color: "#64748b", display: "block", marginTop: 2 }}>
                Code: <strong>{order.warehouseCode || "WH-001"}</strong> {order.warehouseCity ? `· ${order.warehouseCity}` : "· Indore"}
              </span>
            </div>
          </div>
        </section>

        {/* Salesperson Order Instructions: Dispatch Date, Transport Name, Remarks (Points 2, 3, 4, 5) */}
        {(order.expectedDeliveryAt || order.transportName || order.remarks || order.commercialSnapshot?.riceScheme) && (
          <section className="order-review-dispatch-card" aria-label="Dispatch and transport instructions" style={{
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "start" }}>
              <div>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                  📅 Dispatch / Delivery Date
                </span>
                <strong style={{ fontSize: 13, color: "#0f172a", marginTop: 2, display: "block" }}>
                  {order.expectedDeliveryAt
                    ? new Date(order.expectedDeliveryAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                    : "Any time (Same day eligible)"}
                </strong>
              </div>

              {order.transportName ? (
                <div>
                  <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                    🚚 Transport Name
                  </span>
                  <strong style={{ fontSize: 13, color: "#0f172a", marginTop: 2, display: "block" }}>
                    {order.transportName}
                  </strong>
                </div>
              ) : null}
            </div>

            {order.remarks ? (
              <div style={{
                marginTop: 10,
                background: "#fefce8",
                border: "1px solid #fef08a",
                borderRadius: 6,
                padding: "8px 12px",
              }}>
                <span style={{ fontSize: 11, color: "#854d0e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>
                  💬 Sales Remarks / Dispatch Instructions
                </span>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#713f12", whiteSpace: "pre-wrap", fontWeight: 500 }}>
                  {order.remarks}
                </p>
              </div>
            ) : null}

            {order.commercialSnapshot?.riceScheme ? (
              <div style={{
                marginTop: 10,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 6,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>🎁</span>
                <div>
                  <strong style={{ fontSize: 12, color: "#065f46", display: "block" }}>
                    {order.commercialSnapshot.riceScheme.schemeName || "Rice Scheme Applied"}
                  </strong>
                  <span style={{ fontSize: 11, color: "#047857" }}>
                    {order.commercialSnapshot.riceScheme.schemeDescription || "Free rice added to dispatch"}
                  </span>
                </div>
              </div>
            ) : null}
          </section>
        )}
        <section className="order-review-lines" aria-label="Commercial lines">
          <div className="section-head"><div><h3>Items <em>{lines.length} lines</em></h3></div><span className="small-note">stored order values</span></div>
          <div className="order-review-line-table">
            <div className="order-review-line order-review-line-head"><span>Product</span><span>Pack</span><span>Ordered</span><span>Unit price</span><span>Line value</span></div>
            {lines.map((item: any) => {
              const unitRate = Number(item.unitPrice ?? 0);
              const caseWeightKg = Number(
                item.caseWeightKg ??
                item.caseWeightKgSnapshot ??
                (item.variant?.unitWeightKg ? Number(item.variant.unitWeightKg) * (item.variant.unitsPerCase ?? 1) : 0)
              );
              const isBox = (item.outerPack === "Box") ||
                item.variant?.catalogIdentityMasterPack?.toUpperCase()?.includes("BOX") ||
                item.variant?.product?.category?.toLowerCase()?.includes("breakfast") ||
                item.variant?.product?.category?.toLowerCase()?.includes("mix");
              const unitLabel = isBox ? "Box" : "Bag";
              const isQuintal =
                item.rateBasis === "quintal" ||
                item.commercialSnapshot?.rateBasis === "quintal" ||
                item.variant?.listRateBasis === "quintal" ||
                (caseWeightKg >= 20 && !isBox);
              const quintalRate = item.ratePerQuintal != null
                ? item.ratePerQuintal
                : (item.commercialSnapshot?.rate && isQuintal
                  ? Number(item.commercialSnapshot.rate)
                  : (isQuintal && caseWeightKg > 0 ? Math.round((unitRate / caseWeightKg) * 100 * 100) / 100 : null));

              return (
                <div className="order-review-line" key={item.id}>
                  <b>{productLabel(item)}</b>
                  <span>{packLabel(order, item)}</span>
                  <span>{item.qtyOrdered ?? 0} {isBox ? "boxes" : "bags"}</span>
                  <span>
                    {isQuintal && quintalRate != null && quintalRate > 0 ? (
                      <div>
                        <strong style={{ display: "block" }}>{inr(quintalRate)} / quintal</strong>
                        <small style={{ color: "#64748b" }}>{inr(unitRate)} / {unitLabel.toLowerCase()}</small>
                      </div>
                    ) : (
                      inr(unitRate)
                    )}
                  </span>
                  <strong>{inr(storedLineValue(order, item))}</strong>
                </div>
              );
            })}
            <div className="order-review-line order-review-line-total"><span>Total</span><span /><span /><span /><strong>{inr(Number(order.orderTotal ?? 0))}</strong></div>
          </div>
        </section>
      </div>

      <footer className="order-review-footer" aria-label="Order actions">
        <div className="order-review-footer-copy">
          <span>Next safe action</span>
          <strong>{action}</strong>
        </div>
        {actions}
      </footer>
    </div>
  </div>;
}
