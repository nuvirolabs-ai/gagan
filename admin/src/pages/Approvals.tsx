import { useEffect, useState } from "react";
import { api, inr } from "../api";

type ApprovalRequest = {
  id: string;
  approvalType: string;
  status: string;
  deadlineAt?: string | null;
  retailer: { id: string; name: string };
  order?: { id: string; orderNo: number; orderTotal: number | string; createdAt: string } | null;
  assessment: { reasons: string[]; projectedExposure: number | string };
};

const REASON_LABELS: Record<string, string> = {
  new_customer_second_invoice: "Second invoice approval",
  new_customer_third_invoice: "Third invoice approval",
  new_customer_50000_cap: "₹50,000 new-customer cap",
  so_price_list_variation: "Sales-order price variation",
  invoice_overdue_45_days: "Invoice overdue beyond 45 days",
  invoice_overdue_60_days: "Invoice overdue beyond 60 days",
  previous_invoice_pending: "Previous invoice pending",
  one_or_more_outstanding: "Outstanding invoices present",
  repeated_monthly_approval: "Repeated approval this month",
  rating_f_advance_required: "Advance payment confirmation",
};

function reasonLabel(code: string) {
  return REASON_LABELS[code] ?? code.replaceAll("_", " ");
}

export default function Approvals() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);
  const [disputePosition, setDisputePosition] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.approvals();
      setRequests(result.requests);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const open = async (id: string) => {
    try {
      const result = await api.approval(id);
      setSelected(result.request);
      setReason("");
      setDisputePosition("");
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const raiseDispute = async () => {
    if (!selected || disputePosition.trim().length < 10) {
      setError("Add a written position with supporting context.");
      return;
    }
    try {
      await api.raiseApprovalDispute(selected.id, disputePosition.trim());
      setSelected(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const beginDecision = async (result: "approved" | "rejected") => {
    if (result === "rejected" && reason.trim().length < 3) {
      setError("Add a clear rejection reason.");
      return;
    }
    try {
      const challenge = await api.requestAdminStepUp();
      setPendingDecision(result);
      setChallengeId(challenge.challengeId);
      setOtp("");
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const verifyAndDecide = async () => {
    if (!selected || !pendingDecision || otp.length !== 6) return;
    try {
      await api.completeAdminStepUp(challengeId, otp);
      await api.decideApproval(selected.id, pendingDecision, reason.trim() || undefined);
      setSelected(null);
      setPendingDecision(null);
      setChallengeId("");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">Approvals</h1>
      <p className="page-sub">One shared queue for web and staff app decisions.</p>
      {error && <div className="alert error">{error}</div>}
      <div className="approval-layout">
        <section className="card approval-list">
          {loading ? <div className="empty-state">Loading approvals…</div> : requests.length === 0 ? (
            <div className="empty-state">No orders need your approval.</div>
          ) : requests.map((request) => (
            <button
              className={`approval-row ${selected?.id === request.id ? "selected" : ""}`}
              key={request.id}
              onClick={() => void open(request.id)}
              aria-label={`${request.retailer.name}, order ${request.order?.orderNo ?? ""}`}
            >
              <span><strong>{request.retailer.name}</strong><small>Order #{request.order?.orderNo} · {reasonLabel(request.assessment.reasons[0])}</small></span>
              <strong>{inr(Number(request.order?.orderTotal ?? 0))}</strong>
            </button>
          ))}
        </section>

        <section className="card approval-detail">
          {!selected ? <div className="empty-state">Select an order to review its evidence.</div> : (
            <>
              <div className="muted small">{selected.retailer.name}</div>
              <h2>Order #{selected.order?.orderNo}</h2>
              <div className="approval-exposure">
                <strong>{inr(Number(selected.assessment.projectedExposure))} projected exposure</strong>
                <span>{inr(Number(selected.order?.orderTotal ?? 0))} order value</span>
              </div>
              <div className="reason-list">{selected.assessment.reasons.map((code) => <div className="reason-card" key={code}>{reasonLabel(code)}</div>)}</div>
              {selected.deadlineAt ? <p className="muted small">Decision due {new Date(selected.deadlineAt).toLocaleString("en-IN")}</p> : null}
              {selected.status === "rejected" ? (
                <div className="step-up-box">
                  <strong>Order held · dispute available</strong>
                  <p>Dispatch stays blocked while the written positions are reviewed.</p>
                  <label className="field"><span>Written position</span><textarea value={disputePosition} onChange={(event) => setDisputePosition(event.target.value)} rows={4} /></label>
                  <button onClick={() => void raiseDispute()}>Open dispute</button>
                </div>
              ) : <>
              <label className="field"><span>Decision note</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label>
              {!pendingDecision ? (
                <div className="approval-actions">
                  <button className="danger-outline" onClick={() => void beginDecision("rejected")}>Reject order</button>
                  <button onClick={() => void beginDecision("approved")}>Approve order</button>
                </div>
              ) : (
                <div className="step-up-box">
                  <strong>Verify this sensitive decision</strong>
                  <p>Enter the six-digit code sent to your registered phone.</p>
                  <label className="field"><span>Verification code</span><input aria-label="Verification code" inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label>
                  <button disabled={otp.length !== 6} onClick={() => void verifyAndDecide()}>Verify and {pendingDecision === "approved" ? "approve" : "reject"}</button>
                </div>
              )}
              </>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
