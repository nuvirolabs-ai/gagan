import { useState } from "react";
import { api } from "../api";
import { formatOrderRef } from "../orderRef";

interface Props {
  order: any;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function AssignModal({ order, onClose, onDone }: Props) {
  const [routeId, setRouteId] = useState("ROUTE-A");
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.assign(order.id, routeId, slot ? new Date(slot).toISOString() : undefined);
      onDone(`${formatOrderRef(order)} sent out on ${routeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign route");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>
          Assign route — {formatOrderRef(order)}
        </h2>
        <p className="muted small" style={{ margin: "0 0 18px" }}>
          {order.retailer.name} · {order.retailer.shopAddress}
        </p>

        {error && <div className="banner error">{error}</div>}

        <div className="field">
          <label htmlFor="routeId">Route</label>
          <input
            id="routeId"
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="slot">Delivery slot (optional)</label>
          <input
            id="slot"
            type="datetime-local"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          />
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            {busy ? "Assigning…" : "Send out for delivery"}
          </button>
        </div>
      </form>
    </div>
  );
}
