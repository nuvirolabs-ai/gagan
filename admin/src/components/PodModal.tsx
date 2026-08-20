import { useMemo, useState } from "react";
import { api, inr } from "../api";

interface Props {
  order: any;
  onClose: () => void;
  onDone: (message: string) => void;
}

interface Line {
  orderItemId: string;
  name: string;
  qtyOrdered: number;
  casePrice: number;
  caseWeightKg: number;
  qtyDelivered: string;
  weightKg: string;
}

/**
 * Commodities ship short or long, so the invoice is priced off the weight that
 * actually arrived, not what was ordered. This previews the billed amount before
 * the ledger is touched so ops can catch a mistyped weight.
 */
export default function PodModal({ order, onClose, onDone }: Props) {
  const [podType, setPodType] = useState("photo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<Line[]>(() =>
    order.items.map((i: any) => {
      const caseWeightKg = Number(i.variant.unitWeightKg) * i.variant.unitsPerCase;
      return {
        orderItemId: i.id,
        name: i.variant.product.name,
        qtyOrdered: i.qtyOrdered,
        casePrice: Number(i.unitPrice),
        caseWeightKg,
        qtyDelivered: String(i.qtyOrdered),
        weightKg: String(caseWeightKg * i.qtyOrdered),
      };
    })
  );

  const update = (id: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.orderItemId === id ? { ...l, ...patch } : l)));

  const preview = useMemo(() => {
    let total = 0;
    const rows = lines.map((l) => {
      const pricePerKg = l.caseWeightKg > 0 ? l.casePrice / l.caseWeightKg : 0;
      const weight = parseFloat(l.weightKg);
      const cases = parseInt(l.qtyDelivered, 10);
      const lineTotal = Number.isFinite(weight)
        ? pricePerKg * weight
        : Number.isFinite(cases)
          ? l.casePrice * cases
          : 0;
      total += lineTotal;
      return { id: l.orderItemId, pricePerKg, lineTotal };
    });
    return { rows, total };
  }, [lines]);

  const orderedTotal = Number(order.orderTotal);
  const variance = preview.total - orderedTotal;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.capturePod(
        order.id,
        podType,
        lines.map((l) => {
          const weight = parseFloat(l.weightKg);
          return {
            orderItemId: l.orderItemId,
            qtyDelivered: parseInt(l.qtyDelivered, 10) || 0,
            weightDeliveredKg: Number.isFinite(weight) ? weight : undefined,
          };
        })
      );
      onDone(`Delivery captured — invoiced ${inr(preview.total)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture delivery");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>
          Capture delivery — GGN-{String(order.orderNo).padStart(5, "0")}
        </h2>
        <p className="muted small" style={{ margin: "0 0 18px" }}>
          {order.retailer.name} · invoice is generated from delivered weight
        </p>

        {error && <div className="banner error">{error}</div>}

        <div className="field">
          <label htmlFor="podType">Proof of delivery</label>
          <select id="podType" value={podType} onChange={(e) => setPodType(e.target.value)}>
            <option value="photo">Photo</option>
            <option value="otp">OTP</option>
            <option value="signature">Signature</option>
          </select>
        </div>

        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ width: 78 }}>Cases</th>
              <th style={{ width: 100 }}>Weight (kg)</th>
              <th className="right" style={{ width: 92 }}>
                Billed
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const row = preview.rows.find((r) => r.id === l.orderItemId)!;
              return (
                <tr key={l.orderItemId}>
                  <td>
                    <div>{l.name}</div>
                    <div className="muted small">
                      ordered {l.qtyOrdered} × {l.caseWeightKg}kg · {inr(row.pricePerKg)}/kg
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={l.qtyDelivered}
                      onChange={(e) => update(l.orderItemId, { qtyDelivered: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={l.weightKg}
                      onChange={(e) => update(l.orderItemId, { weightKg: e.target.value })}
                    />
                  </td>
                  <td className="right" style={{ fontWeight: 700 }}>
                    {inr(row.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="card" style={{ marginTop: 16, background: "var(--surface-alt)" }}>
          <div className="between">
            <span className="muted">Ordered value</span>
            <span>{inr(orderedTotal)}</span>
          </div>
          <div className="between" style={{ marginTop: 6 }}>
            <span style={{ fontWeight: 700 }}>Invoice (delivered weight)</span>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{inr(preview.total)}</span>
          </div>
          {Math.abs(variance) >= 1 && (
            <div className="between small" style={{ marginTop: 6 }}>
              <span className="muted">Variance</span>
              <span style={{ color: variance < 0 ? "var(--danger)" : "var(--green)" }}>
                {variance < 0 ? "−" : "+"}
                {inr(Math.abs(variance))}
              </span>
            </div>
          )}
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy}>
            {busy ? "Posting…" : `Confirm & invoice ${inr(preview.total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
