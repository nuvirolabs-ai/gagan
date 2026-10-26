import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, inr } from "../api";
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

const UNDER_PROCESS_CHECKBOXES = [
  { code: "ACCOUNT_OPENED", label: "#️⃣ New Account Opening (New Account)" },
  { code: "RATE_APPROVAL_SENT", label: "🍓 Order Sent for Rate Approval" },
  { code: "SALES_ORDER_APPROVAL_SENT", label: "❤️ Sales Order Sent for Approval" },
  { code: "SALES_ORDER_CREATED", label: "👍 Sales Order Created" },
  { code: "SALES_ORDER_ON_HOLD", label: "❌ Sales Order on Hold" },
  { code: "ADVANCE_PAYMENT_RECEIVED", label: "✍️ Advance Payment Required for Sales Order" },
];

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
  onApproveCancellation,
  onRejectCancellation,
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
  onApproveCancellation?: (note?: string) => void;
  onRejectCancellation?: (note: string) => void;
}) {
  const onHold = Boolean(order.internalStatus?.isOnHold);
  return <div className="inspector-action-container" style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
    {order.cancellationStatus === "pending" && (
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#b45309", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          <Icon name="alert" size={16} /> Cancellation Requested by Sales Rep
        </div>
        <div style={{ fontSize: 13, color: "#92400e", marginBottom: 8, lineHeight: 1.4 }}>
          <strong>Reason:</strong> {order.cancellationReason || "No remark provided"}
          {order.cancellationRequestedAt && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "#a16207" }}>
              ({new Date(order.cancellationRequestedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="button danger compact"
            disabled={busy}
            onClick={() => {
              const note = window.prompt("Approval Remark / Note for Salesperson (Optional):", "Cancellation approved per sales request");
              if (note !== null) onApproveCancellation?.(note || undefined);
            }}
          >
            Approve Cancellation & Reject Order
          </button>
          <button
            type="button"
            className="button secondary compact"
            disabled={busy}
            onClick={() => {
              const note = window.prompt("Decline Remark for Salesperson (Required):", "");
              if (note && note.trim().length >= 3) {
                onRejectCancellation?.(note.trim());
              } else if (note !== null) {
                alert("Please provide a reason of at least 3 characters explaining why this order cannot be cancelled.");
              }
            }}
          >
            Decline Request
          </button>
        </div>
      </div>
    )}
    <div className="row inspector-action-row dock-actions">
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
    </div>
  </div>;
}

export default function OrderReviewModal({
  order,
  busy,
  error,
  onClose,
  onOpenDetails,
  actions,
  duplicateInfo,
  onCancelDuplicate,
  onStatusChange,
}: {
  order: any;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onOpenDetails: () => void;
  actions: ReactNode;
  duplicateInfo?: { isDuplicate: boolean; duplicateOfOrderRef?: string; duplicateOrderId?: string; reason?: string };
  onCancelDuplicate?: (orderId: string, remarks: string) => Promise<void> | void;
  onStatusChange?: (orderId: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  busyRef.current = busy;
  onCloseRef.current = onClose;

  const [checkedCodes, setCheckedCodes] = useState<Set<string>>(() => {
    const set = new Set<string>();
    const timeline = order.internalStatus?.timeline || [];
    timeline.forEach((t: any) => { if (t.code) set.add(t.code); });
    if (order.internalStatus?.currentCode) set.add(order.internalStatus.currentCode);
    if (order.internalStatus?.isOnHold || order.isOnHold) set.add("SALES_ORDER_ON_HOLD");
    return set;
  });
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [duplicateCancelOpen, setDuplicateCancelOpen] = useState(false);
  const [duplicateRemarks, setDuplicateRemarks] = useState(
    duplicateInfo?.duplicateOfOrderRef
      ? `Duplicate order of ${duplicateInfo.duplicateOfOrderRef} confirmed by operations`
      : "Duplicate order cancelled by operations"
  );
  const [cancellingDuplicate, setCancellingDuplicate] = useState(false);

  const toggleCode = async (code: string) => {
    const isCurrentlyChecked = checkedCodes.has(code);
    const nextChecked = !isCurrentlyChecked;
    setSavingCode(code);
    try {
      await api.toggleCommercialStatus(order.id, code, nextChecked);
      setCheckedCodes((prev) => {
        const next = new Set(prev);
        if (nextChecked) next.add(code);
        else next.delete(code);
        return next;
      });
      if (onStatusChange) onStatusChange(order.id);
    } catch (err) {
      console.error("Failed to toggle status code:", err);
    } finally {
      setSavingCode(null);
    }
  };

  const handleCancelDuplicate = async () => {
    setCancellingDuplicate(true);
    try {
      if (onCancelDuplicate) {
        await onCancelDuplicate(order.id, duplicateRemarks);
      } else {
        await api.reject(order.id, duplicateRemarks);
      }
      if (onStatusChange) onStatusChange(order.id);
      onClose();
    } catch (err) {
      console.error("Failed to cancel duplicate order:", err);
    } finally {
      setCancellingDuplicate(false);
    }
  };

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

        {/* Duplicate Order Warning (Point 5) */}
        {duplicateInfo?.isDuplicate && (
          <section className="order-duplicate-banner" aria-label="Duplicate order warning" style={{
            background: "#fffbeb",
            border: "2px solid #f59e0b",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <strong style={{ fontSize: 14, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                  ⚠️ Potential Duplicate Order Detected
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#b45309" }}>
                  {duplicateInfo.reason || `This order matches order ${duplicateInfo.duplicateOfOrderRef} with identical items and party details.`}
                </p>
              </div>
              <button
                type="button"
                className="button danger compact"
                onClick={() => setDuplicateCancelOpen(true)}
                style={{ whiteSpace: "nowrap" }}
              >
                Cancel Duplicate Order
              </button>
            </div>

            {duplicateCancelOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #fde68a" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#92400e", display: "block", marginBottom: 4 }}>
                  Cancellation Remarks / Reason
                </label>
                <textarea
                  value={duplicateRemarks}
                  onChange={(e) => setDuplicateRemarks(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="button danger compact"
                    disabled={cancellingDuplicate}
                    onClick={handleCancelDuplicate}
                  >
                    {cancellingDuplicate ? "Cancelling…" : "Confirm Cancel & Add Remarks"}
                  </button>
                  <button
                    type="button"
                    className="button ghost compact"
                    onClick={() => setDuplicateCancelOpen(false)}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Party Details: Name, Mobile, Address, City/Station (Point 1) */}
        <section className="order-review-party-card" aria-label="Customer party details" style={{
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "start" }}>
            <div>
              <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                🏪 Party Details
              </span>
              <strong style={{ fontSize: 14, color: "#0f172a", marginTop: 2, display: "block" }}>
                {order.retailer?.name ?? "Retailer unavailable"}
              </strong>
              <span style={{ fontSize: 13, color: "#334155", display: "block", marginTop: 2 }}>
                📞 Mobile: <strong>{order.retailer?.phone || "Phone not provided"}</strong>
              </span>
              {checkedCodes.has("ACCOUNT_OPENED") && (
                <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                  #️⃣ New Account
                </span>
              )}
            </div>

            <div>
              <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block" }}>
                📍 Address & Station
              </span>
              <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>
                {order.retailer?.shopAddress || "Shop address not provided"}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", marginTop: 4 }}>
                Station / City: <strong>{order.retailer?.deliveryCity || order.retailer?.city || "Indore"}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Under Process Statuses & Internal Checkboxes (Points 3 & 6) */}
        <section className="order-review-checkboxes-card" aria-label="Internal order status checkboxes" style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          padding: "14px 16px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <strong style={{ fontSize: 13, color: "#166534", textTransform: "uppercase", letterSpacing: 0.5 }}>
                📋 Internal Status Checkboxes
              </strong>
              <span style={{ fontSize: 11, color: "#15803d", display: "block", marginTop: 2 }}>
                Tick to route order under appropriate operational stage (saved automatically)
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {UNDER_PROCESS_CHECKBOXES.map((chk) => {
              const isChecked = checkedCodes.has(chk.code);
              const isSaving = savingCode === chk.code;
              return (
                <label
                  key={chk.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: isChecked ? "#dcfce7" : "#ffffff",
                    border: isChecked ? "1px solid #86efac" : "1px solid #e2e8f0",
                    borderRadius: 6,
                    cursor: busy ? "not-allowed" : "pointer",
                    fontSize: 12,
                    fontWeight: isChecked ? 600 : 500,
                    color: isChecked ? "#14532d" : "#334155",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={busy || isSaving}
                    onChange={() => toggleCode(chk.code)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#15803d" }}
                  />
                  <span>{chk.label}</span>
                  {isSaving && <span style={{ fontSize: 10, color: "#6b7280" }}>…</span>}
                </label>
              );
            })}
          </div>
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
