import { useCallback, useEffect, useMemo, useState } from "react";
import { api, inr } from "../api";

interface InvoiceTarget {
  id: string;
  invoiceNumber: number;
  total: number;
  outstandingAmount: number;
  creditableAmount: number;
}

interface PaymentTarget {
  id: string;
  amount: number;
  reversibleAmount: number;
  channel: string;
  providerRef: string | null;
}

interface RetailerTarget {
  id: string;
  name: string;
  currentBalance: number;
  invoices: InvoiceTarget[];
  payments: PaymentTarget[];
}

function parsePositiveAmount(value: string, maximum: number): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > maximum) return null;
  if (Math.round(amount * 100) / 100 !== amount) return null;
  return amount;
}

export default function Corrections() {
  const [retailers, setRetailers] = useState<RetailerTarget[]>([]);
  const [retailerId, setRetailerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [reversalAmount, setReversalAmount] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [reviewing, setReviewing] = useState<"credit" | "reversal" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await api.correctionTargets();
    setRetailers(response.retailers);
    setRetailerId((current) =>
      response.retailers.some((retailer: RetailerTarget) => retailer.id === current)
        ? current
        : (response.retailers[0]?.id ?? "")
    );
  }, []);

  useEffect(() => {
    load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Could not load corrections")
    );
  }, [load]);

  const retailer = useMemo(
    () => retailers.find((candidate) => candidate.id === retailerId),
    [retailerId, retailers]
  );

  useEffect(() => {
    setInvoiceId((current) =>
      retailer?.invoices.some((invoice) => invoice.id === current)
        ? current
        : (retailer?.invoices[0]?.id ?? "")
    );
    setPaymentId((current) =>
      retailer?.payments.some((payment) => payment.id === current)
        ? current
        : (retailer?.payments[0]?.id ?? "")
    );
    setReviewing(null);
  }, [retailer]);

  const invoice = retailer?.invoices.find((candidate) => candidate.id === invoiceId);
  const payment = retailer?.payments.find((candidate) => candidate.id === paymentId);
  const credit = parsePositiveAmount(creditAmount, invoice?.creditableAmount ?? 0);
  const reversal = parsePositiveAmount(
    reversalAmount,
    payment?.reversibleAmount ?? 0
  );

  const confirmCredit = async () => {
    if (!invoice || credit === null || creditReason.trim().length < 5) return;
    setBusy(true);
    try {
      await api.issueCreditNote(
        invoice.id,
        credit,
        creditReason.trim(),
        crypto.randomUUID()
      );
      setNotice("Credit note issued. The original invoice remains unchanged.");
      setError(null);
      setCreditAmount("");
      setCreditReason("");
      setReviewing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not issue credit note");
    } finally {
      setBusy(false);
    }
  };

  const confirmReversal = async () => {
    if (!payment || reversal === null || reversalReason.trim().length < 5) return;
    setBusy(true);
    try {
      await api.reversePayment(
        payment.id,
        reversal,
        reversalReason.trim(),
        crypto.randomUUID()
      );
      setNotice("Payment reversal posted as a new ledger entry.");
      setError(null);
      setReversalAmount("");
      setReversalReason("");
      setReviewing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reverse payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-narrow">
      <h1 className="page-title">Financial corrections</h1>
      <p className="page-sub">
        Correct a confirmed transaction without rewriting financial history.
      </p>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      {retailers.length === 0 ? (
        <div className="card empty-state">There are no transactions available to correct.</div>
      ) : (
        <>
          <div className="card">
            <div className="field" style={{ marginBottom: 0, maxWidth: 360 }}>
              <label htmlFor="correction-retailer">Retailer</label>
              <select
                id="correction-retailer"
                value={retailerId}
                onChange={(event) => setRetailerId(event.target.value)}
              >
                {retailers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} · {inr(candidate.currentBalance)} outstanding
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="correction-grid">
            <form
              className="card"
              onSubmit={(event) => {
                event.preventDefault();
                if (credit !== null && creditReason.trim().length >= 5) {
                  setReviewing("credit");
                }
              }}
            >
              <h2 className="section-title">Credit an invoice</h2>
              <p className="section-copy">Use for verified shortage, return or billing correction.</p>
              <div className="field">
                <label htmlFor="credit-invoice">Invoice</label>
                <select
                  id="credit-invoice"
                  value={invoiceId}
                  onChange={(event) => {
                    setInvoiceId(event.target.value);
                    setReviewing(null);
                  }}
                >
                  {retailer?.invoices.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      Invoice #{candidate.invoiceNumber} · up to {inr(candidate.creditableAmount)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="credit-amount">Credit amount</label>
                <input
                  id="credit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={invoice?.creditableAmount}
                  value={creditAmount}
                  onChange={(event) => {
                    setCreditAmount(event.target.value);
                    setReviewing(null);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="credit-reason">Credit reason</label>
                <input
                  id="credit-reason"
                  value={creditReason}
                  onChange={(event) => {
                    setCreditReason(event.target.value);
                    setReviewing(null);
                  }}
                  placeholder="What was verified?"
                />
              </div>
              {reviewing === "credit" && invoice && credit !== null ? (
                <div className="confirmation-box">
                  <strong>
                    Issue a {inr(credit)} credit note for Invoice #{invoice.invoiceNumber}?
                  </strong>
                  <p>{creditReason.trim()}</p>
                  <div className="row">
                    <button type="button" disabled={busy} onClick={() => void confirmCredit()}>
                      Confirm credit note
                    </button>
                    <button type="button" className="ghost" onClick={() => setReviewing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!invoice || credit === null || creditReason.trim().length < 5}
                >
                  Review and issue
                </button>
              )}
            </form>

            <form
              className="card"
              onSubmit={(event) => {
                event.preventDefault();
                if (reversal !== null && reversalReason.trim().length >= 5) {
                  setReviewing("reversal");
                }
              }}
            >
              <h2 className="section-title">Reverse a payment</h2>
              <p className="section-copy">Use only after a confirmed bank or provider reversal.</p>
              <div className="field">
                <label htmlFor="reversal-payment">Payment</label>
                <select
                  id="reversal-payment"
                  value={paymentId}
                  onChange={(event) => {
                    setPaymentId(event.target.value);
                    setReviewing(null);
                  }}
                >
                  {retailer?.payments.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {inr(candidate.amount)} · {candidate.providerRef ?? candidate.channel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="reversal-amount">Reversal amount</label>
                <input
                  id="reversal-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={payment?.reversibleAmount}
                  value={reversalAmount}
                  onChange={(event) => {
                    setReversalAmount(event.target.value);
                    setReviewing(null);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="reversal-reason">Reversal reason</label>
                <input
                  id="reversal-reason"
                  value={reversalReason}
                  onChange={(event) => {
                    setReversalReason(event.target.value);
                    setReviewing(null);
                  }}
                  placeholder="Reference the provider notice"
                />
              </div>
              {reviewing === "reversal" && payment && reversal !== null ? (
                <div className="confirmation-box">
                  <strong>Reverse {inr(reversal)} from this payment?</strong>
                  <p>{reversalReason.trim()}</p>
                  <div className="row">
                    <button type="button" disabled={busy} onClick={() => void confirmReversal()}>
                      Confirm reversal
                    </button>
                    <button type="button" className="ghost" onClick={() => setReviewing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!payment || reversal === null || reversalReason.trim().length < 5}
                >
                  Review reversal
                </button>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
}
