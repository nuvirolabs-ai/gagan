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
        <section className="order-review-lines" aria-label="Commercial lines">
          <div className="section-head"><div><h3>Items <em>{lines.length} lines</em></h3></div><span className="small-note">stored order values</span></div>
          <div className="order-review-line-table">
            <div className="order-review-line order-review-line-head"><span>Product</span><span>Pack</span><span>Ordered</span><span>Unit price</span><span>Line value</span></div>
            {lines.map((item: any) => <div className="order-review-line" key={item.id}>
              <b>{productLabel(item)}</b>
              <span>{packLabel(order, item)}</span>
              <span>{item.qtyOrdered ?? 0}</span>
              <span>{inr(Number(item.unitPrice ?? 0))}</span>
              <strong>{inr(storedLineValue(order, item))}</strong>
            </div>)}
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
