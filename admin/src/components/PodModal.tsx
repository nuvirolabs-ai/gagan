import { useEffect, useMemo, useState } from "react";
import { Breakdown } from "../pages/Commercial";
import { api, inr } from "../api";
import { formatOrderRef } from "../orderRef";
import { explain } from "../errorCopy";
import { acceptedFreight, billingInvoiceLabel, deliveryScope, firmNames, type BillingInvoice } from "../invoiceDocument";

interface Props {
  order: any;
  onClose: () => void;
  onDone: (message: string) => void;
}

interface Line {
  orderItemId: string;
  name: string;
  companySalesOrderId: string | null;
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
  const [selection, setSelection] = useState("");
  const [podType, setPodType] = useState("photo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commercial,setCommercial]=useState<any>(null);
  const [quotedInput,setQuotedInput]=useState("");
  const [transportationAmount, setTransportationAmount] = useState<number>(0);

  const [allLines, setLines] = useState<Line[]>(() =>
    order.items.map((i: any) => {
      const caseWeightKg = Number(i.caseWeightKgSnapshot ?? Number(i.variant.unitWeightKg) * i.variant.unitsPerCase);
      return {
        orderItemId: i.id,
        companySalesOrderId: i.companySalesOrderId,
        name: i.variant.product.name,
        qtyOrdered: i.qtyOrdered,
        casePrice: Number(i.unitPrice),
        caseWeightKg,
        qtyDelivered: String(i.qtyOrdered),
        weightKg: String(caseWeightKg * i.qtyOrdered),
      };
    })
  );
  const documents = order.companySalesOrders ?? [];
  const { pending, company, canDeliverTogether, chosen } = deliveryScope(documents, selection);
  const freight = acceptedFreight(order.commercialSnapshot);
  const allowFreight = chosen && (!order.commercialSnapshot || (Boolean(freight) && (!company || company.company === freight?.entity)));
  const transportation = allowFreight && transportationAmount > 0 ? transportationAmount : undefined;
  const lines = chosen ? allLines.filter(line => !company || line.companySalesOrderId === company.id) : [];
  const deliveryInput = JSON.stringify({
    lines: lines.map(line => ({
      orderItemId: line.orderItemId,
      cases: Number(line.qtyDelivered),
      weightKg: line.weightKg === "" ? undefined : Number(line.weightKg),
    })),
    companySalesOrderId: company?.id,
    transportationAmount: transportation,
    transportationEntity: transportation ? freight?.entity : undefined,
  });
  const requiresQuote = Boolean(order.commercialSnapshot);
  useEffect(() => {
    let active = true;
    setCommercial(null);
    if (requiresQuote && chosen) {
      const { lines: resolutions, ...options } = JSON.parse(deliveryInput);
      api.deliveryQuote(order.id, resolutions, options).then(result => {
        if (active) {
          setCommercial(result.commercial);
          setQuotedInput(deliveryInput);
          setError(null);
        }
      }).catch(cause => {
        if (active) setError(explain(cause, "Could not price delivery. Check cases and weight."));
      });
    }
    return () => { active = false; };
  }, [chosen, deliveryInput, order.id, requiresQuote]);

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
  const finalInvoiceTotal = requiresQuote ? Number(commercial?.total ?? 0) : preview.total + (transportation ?? 0);
  const ready = lines.length > 0 && (!requiresQuote || (commercial && quotedInput === deliveryInput));

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const result=await api.capturePod(
        order.id,
        podType,
        lines.map((l) => {
          const weight = parseFloat(l.weightKg);
          return {
            orderItemId: l.orderItemId,
            qtyDelivered: parseInt(l.qtyDelivered, 10) || 0,
            weightDeliveredKg: Number.isFinite(weight) ? weight : undefined,
          };
        }),
        transportation,
        transportation ? freight?.entity : undefined,
        company?.id,
      );
      const invoices: BillingInvoice[] = result.invoices ?? (result.invoice ? [result.invoice] : []);
      const labels = invoices.filter(invoice => !company || invoice.sellingEntity === company.company).map(billingInvoiceLabel);
      onDone(labels.length ? `Delivery recorded. Issued ${labels.join(", ")}.` : "Delivery recorded.");
    } catch (err) {
      setError(explain(err, "Could not capture delivery"));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>
          Capture delivery — {formatOrderRef(order)}
        </h2>
        <p className="muted small" style={{ margin: "0 0 18px" }}>
          {order.retailer.name} · invoice is generated from delivered weight
        </p>

        {error && <div className="banner error">{error}</div>}
        {commercial && <Breakdown value={commercial}/>}

        {documents.length > 0 && (
          <label className="field">Company sales order delivered
            <select value={company?.id ?? selection} onChange={event => {
              setSelection(event.target.value);
              setTransportationAmount(0);
              setError(null);
            }}>
              <option value="">Select a company sales order</option>
              {canDeliverTogether && <option value="all">All companies on this route</option>}
              {pending.map(document => (
                <option key={document.id} value={document.id}>
                  {firmNames[document.company]} · {document.reference}{document.routeId ? ` · Route ${document.routeId}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
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
                    {order.commercialSnapshot ? "See server breakdown" : inr(row.lineTotal)}
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
          {allowFreight && <div className="between" style={{ marginTop: 10, alignItems: "center" }}>
            <label htmlFor="podFreight" style={{ fontWeight: 600, color: "#92400e" }}>
              {freight ? `${firmNames[freight.entity]} freight before GST (${freight.gstPercent}% GST)` : "Transport charge"}
            </label>
            <input
              type="number"
              id="podFreight"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={transportationAmount === 0 ? "" : transportationAmount}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setTransportationAmount(val < 0 ? 0 : val);
              }}
              style={{ width: 120, padding: "4px 8px", textAlign: "right", borderRadius: 4, border: "1px solid #d97706" }}
            />
          </div>}
          <div className="between" style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Estimated billing total</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "var(--green)" }}>{ready ? inr(finalInvoiceTotal) : "—"}</span>
          </div>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button className="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !ready}>
            {busy ? "Posting…" : "Record delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}
