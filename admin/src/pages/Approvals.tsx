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
  disputes?: Array<{ id: string; status: string; writtenPosition: string; resolution?: string | null }>;
  commercialStatus?: { currentLabel?: string | null; isOnHold?: boolean; holdReason?: string | null; timeline?: Array<{ id: string; label: string; createdAt: string; actor?: { name: string } | null }> } | null;
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
  const [tab, setTab] = useState<"orders" | "expenses" | "leaves">("orders");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);
  const [disputePosition, setDisputePosition] = useState("");
  const [pendingDisputeOutcome, setPendingDisputeOutcome] = useState<"approved" | "rejected" | null>(null);

  // Gap 16: Expenses State
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseMetrics, setExpenseMetrics] = useState<any | null>(null);
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // Gap 16: Leaves State
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveMetrics, setLeaveMetrics] = useState<any | null>(null);
  const [leaveFilter, setLeaveFilter] = useState("all");
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    type: "expense" | "leave";
    id: string;
    decision: "approved" | "rejected";
    title: string;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

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

  const loadExpenses = async () => {
    setExpenseLoading(true);
    try {
      const res = await api.portalExpenses(expenseFilter === "all" ? undefined : expenseFilter);
      setExpenses(res.expenses ?? []);
      setExpenseMetrics(res.metrics ?? null);
      setError("");
    } catch (err: any) {
      setError(err.message ?? "Failed to load expenses");
    } finally {
      setExpenseLoading(false);
    }
  };

  const loadLeaves = async () => {
    setLeaveLoading(true);
    try {
      const res = await api.portalLeaves(leaveFilter === "all" ? undefined : leaveFilter);
      setLeaves(res.leaves ?? []);
      setLeaveMetrics(res.metrics ?? null);
      setError("");
    } catch (err: any) {
      setError(err.message ?? "Failed to load leaves");
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "orders") {
      void load();
    } else if (tab === "expenses") {
      void loadExpenses();
    } else if (tab === "leaves") {
      void loadLeaves();
    }
  }, [tab, expenseFilter, leaveFilter]);

  const handleDecideExpense = async (id: string, decision: "approved" | "rejected", note?: string) => {
    try {
      await api.decidePortalExpense(id, decision, note);
      setNotice(`✅ Expense claim ${decision === "approved" ? "approved" : "rejected"} successfully.`);
      setDecisionModal(null);
      setDecisionNote("");
      await loadExpenses();
    } catch (err: any) {
      setError(err.message ?? "Failed to record expense decision");
    }
  };

  const handleDecideLeave = async (id: string, decision: "approved" | "rejected", note?: string) => {
    try {
      await api.decidePortalLeave(id, decision, note);
      setNotice(`✅ Leave request ${decision === "approved" ? "approved" : "rejected"} successfully.`);
      setDecisionModal(null);
      setDecisionNote("");
      await loadLeaves();
    } catch (err: any) {
      setError(err.message ?? "Failed to record leave decision");
    }
  };

  const open = async (id: string) => {
    try {
      const result = await api.approval(id);
      setSelected(result.request);
      setReason("");
      setDisputePosition("");
      setPendingDisputeOutcome(null);
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

  const beginDisputeResolution = async (outcome: "approved" | "rejected") => {
    if (reason.trim().length < 10) {
      setError("Add the factual resolution before closing the dispute.");
      return;
    }
    try {
      const challenge = await api.requestAdminStepUp();
      setPendingDisputeOutcome(outcome);
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

  const verifyAndResolveDispute = async () => {
    const dispute = selected?.disputes?.find((item) => item.status !== "resolved");
    if (!dispute || !pendingDisputeOutcome || otp.length !== 6) return;
    try {
      await api.completeAdminStepUp(challengeId, otp);
      await api.resolveApprovalDispute(dispute.id, pendingDisputeOutcome, reason.trim());
      setSelected(null);
      setPendingDisputeOutcome(null);
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
      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && <div className="banner success" style={{ marginBottom: 12 }}>{notice}</div>}

      {/* Top Level Tab Switcher */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid #e5e7eb", paddingBottom: 12, marginBottom: 16 }}>
        <button
          type="button"
          className={`button ${tab === "orders" ? "primary" : "secondary"}`}
          style={{
            fontWeight: 700,
            borderRadius: 8,
            padding: "8px 16px",
            background: tab === "orders" ? "#165a31" : "#f3f4f6",
            color: tab === "orders" ? "#ffffff" : "#374151",
            borderColor: tab === "orders" ? "#165a31" : "#d1d5db",
          }}
          onClick={() => setTab("orders")}
        >
          💳 Credit & Order Holds ({requests.length})
        </button>
        <button
          type="button"
          className={`button ${tab === "expenses" ? "primary" : "secondary"}`}
          style={{
            fontWeight: 700,
            borderRadius: 8,
            padding: "8px 16px",
            background: tab === "expenses" ? "#165a31" : "#f3f4f6",
            color: tab === "expenses" ? "#ffffff" : "#374151",
            borderColor: tab === "expenses" ? "#165a31" : "#d1d5db",
          }}
          onClick={() => {
            setTab("expenses");
            void loadExpenses();
          }}
        >
          💰 Field Expenses (Gap 16)
        </button>
        <button
          type="button"
          className={`button ${tab === "leaves" ? "primary" : "secondary"}`}
          style={{
            fontWeight: 700,
            borderRadius: 8,
            padding: "8px 16px",
            background: tab === "leaves" ? "#165a31" : "#f3f4f6",
            color: tab === "leaves" ? "#ffffff" : "#374151",
            borderColor: tab === "leaves" ? "#165a31" : "#d1d5db",
          }}
          onClick={() => {
            setTab("leaves");
            void loadLeaves();
          }}
        >
          🌴 Leave Requests (Gap 16)
        </button>
      </div>

      {tab === "orders" && (
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
                <span><strong>{request.retailer.name}</strong><small>Order #{request.order?.orderNo} · {reasonLabel(request.assessment.reasons[0])}{request.commercialStatus?.currentLabel ? ` · ${request.commercialStatus.currentLabel}` : ""}</small></span>
                <strong>{inr(Number(request.order?.orderTotal ?? 0))}</strong>
              </button>
            ))}
          </section>

          <section className="card approval-detail">
            {!selected ? <div className="empty-state">Select an order to review its evidence.</div> : (
              <>
                <div className="muted small">{selected.retailer.name}</div>
                <h2>Order #{selected.order?.orderNo}</h2>
                {selected.commercialStatus ? <div className="internal-status-detail"><strong>{selected.commercialStatus.isOnHold ? "❌ Sales Order On Hold" : selected.commercialStatus.currentLabel ?? "No internal status recorded"}</strong>{selected.commercialStatus.holdReason ? <span>Reason: {selected.commercialStatus.holdReason}</span> : null}<div className="internal-status-timeline">{(selected.commercialStatus.timeline ?? []).slice(-4).map((event) => <span key={event.id}>{event.label} · {new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{event.actor?.name ? ` · ${event.actor.name}` : ""}</span>)}</div></div> : null}
                <div className="approval-exposure">
                  <strong>{inr(Number(selected.assessment.projectedExposure))} projected exposure</strong>
                  <span>{inr(Number(selected.order?.orderTotal ?? 0))} order value</span>
                </div>
                <div className="reason-list">{selected.assessment.reasons.map((code) => <div className="reason-card" key={code}>{reasonLabel(code)}</div>)}</div>
                {selected.deadlineAt ? <p className="muted small">Decision due {new Date(selected.deadlineAt).toLocaleString("en-IN")}</p> : null}
                {selected.status === "rejected" ? (
                  <div className="step-up-box">
                    {selected.disputes?.some((item) => item.status !== "resolved") ? <>
                      <strong>Resolve written dispute</strong>
                      <p>{selected.disputes.find((item) => item.status !== "resolved")?.writtenPosition}</p>
                      <label className="field"><span>Factual resolution</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} /></label>
                      {!pendingDisputeOutcome ? <div className="approval-actions">
                        <button className="danger-outline" onClick={() => void beginDisputeResolution("rejected")}>Uphold rejection</button>
                        <button onClick={() => void beginDisputeResolution("approved")}>Approve after review</button>
                      </div> : <>
                        <label className="field"><span>Verification code</span><input aria-label="Verification code" inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label>
                        <button disabled={otp.length !== 6} onClick={() => void verifyAndResolveDispute()}>Verify and close dispute</button>
                      </>}
                    </> : <>
                      <strong>Order held · dispute available</strong>
                      <p>Dispatch stays blocked while the written positions are reviewed.</p>
                      <label className="field"><span>Written position</span><textarea value={disputePosition} onChange={(event) => setDisputePosition(event.target.value)} rows={4} /></label>
                      <button onClick={() => void raiseDispute()}>Open dispute</button>
                    </>}
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
      )}

      {/* TAB 2: Field Expenses (Gap 16) */}
      {tab === "expenses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>TOTAL CLAIMS</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                {expenseMetrics?.totalClaims ?? expenses.length}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Field expense submissions</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>PENDING REVIEW</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#d97706" }}>
                {expenseMetrics?.pendingClaims ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>
                Amount: <strong>{inr(expenseMetrics?.pendingAmount ?? 0)}</strong>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>APPROVED CLAIMS</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#16a34a" }}>
                {expenseMetrics?.approvedClaims ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>Passed for payroll payout</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>REJECTED CLAIMS</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#dc2626" }}>
                {expenseMetrics?.rejectedClaims ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>Disallowed claims</div>
            </div>
          </div>

          {/* Action & Filter Row */}
          <div className="between" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>FILTER:</span>
              {[
                { value: "all", label: "ALL" },
                { value: "submitted", label: "PENDING (SUBMITTED)" },
                { value: "approved", label: "APPROVED" },
                { value: "rejected", label: "REJECTED" },
              ].map((st) => (
                <button
                  key={st.value}
                  type="button"
                  className={`tab ${expenseFilter === st.value ? "active" : ""}`}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setExpenseFilter(st.value)}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="secondary"
              onClick={() => void loadExpenses()}
              disabled={expenseLoading}
            >
              🔄 Refresh Claims
            </button>
          </div>

          {/* Expenses Table */}
          {expenseLoading ? (
            <p>Loading expense claims…</p>
          ) : expenses.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              No expense claims found matching filter.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#4b5563" }}>
                      <th style={{ padding: "10px 14px" }}>Claim Date & Category</th>
                      <th style={{ padding: "10px 14px" }}>Salesperson</th>
                      <th style={{ padding: "10px 14px" }}>Claim Amount</th>
                      <th style={{ padding: "10px 14px" }}>Purpose / Notes</th>
                      <th style={{ padding: "10px 14px" }}>Receipt Photo</th>
                      <th style={{ padding: "10px 14px" }}>Status</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700, color: "#111827" }}>
                            {new Date(e.expenseDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "#e0f2fe",
                              color: "#0369a1",
                              textTransform: "uppercase",
                              fontWeight: 700,
                              marginTop: 2,
                              display: "inline-block",
                            }}
                          >
                            {e.category}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#111827" }}>👤 {e.salespersonName}</div>
                          <div style={{ color: "#6b7280", fontSize: 11 }}>📞 {e.salespersonPhone}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 14, color: "#111827" }}>
                          {inr(e.amount)}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#374151", maxWidth: 280 }}>
                          <div>{e.description}</div>
                          {e.decisionNote && (
                            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
                              Decision: "{e.decisionNote}" {e.decidedByName ? `by ${e.decidedByName}` : ""}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {e.receiptUrl ? (
                            <button
                              type="button"
                              className="sm secondary"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, padding: "3px 8px" }}
                              onClick={() => setSelectedReceipt(e)}
                            >
                              📄 View Bill
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>No bill</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: e.status === "approved" ? "#dcfce7" : e.status === "rejected" ? "#fee2e2" : "#fef3c7",
                              color: e.status === "approved" ? "#15803d" : e.status === "rejected" ? "#b91c1c" : "#b45309",
                            }}
                          >
                            {e.status === "submitted" ? "Pending Review" : e.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          {e.status === "submitted" ? (
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button
                                type="button"
                                className="sm primary"
                                style={{ background: "#15803d", borderColor: "#15803d", fontWeight: 700 }}
                                onClick={() =>
                                  setDecisionModal({
                                    type: "expense",
                                    id: e.id,
                                    decision: "approved",
                                    title: `Approve ₹${e.amount} (${e.category}) for ${e.salespersonName}`,
                                  })
                                }
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="sm danger-outline"
                                onClick={() =>
                                  setDecisionModal({
                                    type: "expense",
                                    id: e.id,
                                    decision: "rejected",
                                    title: `Reject ₹${e.amount} claim for ${e.salespersonName}`,
                                  })
                                }
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#6b7280" }}>
                              Decided {e.decidedAt ? new Date(e.decidedAt).toLocaleDateString("en-IN") : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Leave Requests (Gap 16) */}
      {tab === "leaves" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>TOTAL LEAVE REQUESTS</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                {leaveMetrics?.totalLeaves ?? leaves.length}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Field staff absences</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>PENDING APPROVAL</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#d97706" }}>
                {leaveMetrics?.pendingLeaves ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>Awaiting manager sign-off</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>APPROVED LEAVES</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#16a34a" }}>
                {leaveMetrics?.approvedLeaves ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>Authorized roster absences</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>REJECTED LEAVES</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#dc2626" }}>
                {leaveMetrics?.rejectedLeaves ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>Declined applications</div>
            </div>
          </div>

          {/* Action & Filter Row */}
          <div className="between" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>FILTER:</span>
              {[
                { value: "all", label: "ALL" },
                { value: "pending", label: "PENDING" },
                { value: "approved", label: "APPROVED" },
                { value: "rejected", label: "REJECTED" },
              ].map((st) => (
                <button
                  key={st.value}
                  type="button"
                  className={`tab ${leaveFilter === st.value ? "active" : ""}`}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setLeaveFilter(st.value)}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="secondary"
              onClick={() => void loadLeaves()}
              disabled={leaveLoading}
            >
              🔄 Refresh Leaves
            </button>
          </div>

          {/* Leaves Table */}
          {leaveLoading ? (
            <p>Loading leave requests…</p>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              No leave requests found matching filter.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#4b5563" }}>
                      <th style={{ padding: "10px 14px" }}>Leave Schedule & Duration</th>
                      <th style={{ padding: "10px 14px" }}>Salesperson</th>
                      <th style={{ padding: "10px 14px" }}>Type</th>
                      <th style={{ padding: "10px 14px" }}>Reason & Notes</th>
                      <th style={{ padding: "10px 14px" }}>Status</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => {
                      const from = new Date(l.fromDate);
                      const to = new Date(l.toDate);
                      const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1);

                      return (
                        <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#111827" }}>
                              {from.toLocaleDateString("en-IN")} → {to.toLocaleDateString("en-IN")}
                            </div>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{days} {days === 1 ? "day" : "days"} requested</span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, color: "#111827" }}>👤 {l.salespersonName}</div>
                            <div style={{ color: "#6b7280", fontSize: 11 }}>📞 {l.salespersonPhone}</div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: l.type === "sick" ? "#fee2e2" : l.type === "casual" ? "#e0f2fe" : "#fef3c7",
                                color: l.type === "sick" ? "#b91c1c" : l.type === "casual" ? "#0369a1" : "#92400e",
                              }}
                            >
                              {l.type}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", color: "#374151", maxWidth: 300 }}>
                            <div>{l.reason}</div>
                            {l.decisionNote && (
                              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
                                Manager Note: "{l.decisionNote}" {l.decidedByName ? `by ${l.decidedByName}` : ""}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 700,
                                background: l.status === "approved" ? "#dcfce7" : l.status === "rejected" ? "#fee2e2" : "#fef3c7",
                                color: l.status === "approved" ? "#15803d" : l.status === "rejected" ? "#b91c1c" : "#b45309",
                              }}
                            >
                              {l.status === "pending" ? "Pending Approval" : l.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "right" }}>
                            {l.status === "pending" ? (
                              <div style={{ display: "inline-flex", gap: 6 }}>
                                <button
                                  type="button"
                                  className="sm primary"
                                  style={{ background: "#15803d", borderColor: "#15803d", fontWeight: 700 }}
                                  onClick={() =>
                                    setDecisionModal({
                                      type: "leave",
                                      id: l.id,
                                      decision: "approved",
                                      title: `Approve ${l.type.toUpperCase()} leave for ${l.salespersonName}`,
                                    })
                                  }
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="sm danger-outline"
                                  onClick={() =>
                                    setDecisionModal({
                                      type: "leave",
                                      id: l.id,
                                      decision: "rejected",
                                      title: `Reject leave request for ${l.salespersonName}`,
                                    })
                                  }
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: "#6b7280" }}>
                                Decided {l.decidedAt ? new Date(l.decidedAt).toLocaleDateString("en-IN") : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Decision Note Prompt */}
      {decisionModal && (
        <div className="modal-backdrop" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div className="card" style={{ width: 480, maxWidth: "90vw" }}>
            <h3 style={{ marginTop: 0 }}>{decisionModal.title}</h3>
            <p className="page-sub">Enter a manager decision note / remark for the employee record.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (decisionModal.type === "expense") {
                  void handleDecideExpense(decisionModal.id, decisionModal.decision, decisionNote);
                } else {
                  void handleDecideLeave(decisionModal.id, decisionModal.decision, decisionNote);
                }
              }}
            >
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Decision Remark (Optional)</label>
                <textarea
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder={
                    decisionModal.decision === "approved"
                      ? "e.g. Approved as per field beat policy"
                      : "e.g. Disallowed due to missing tax invoice"
                  }
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="secondary" onClick={() => setDecisionModal(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={decisionModal.decision === "approved" ? "primary" : "danger-outline"}
                  style={decisionModal.decision === "approved" ? { background: "#15803d", borderColor: "#15803d", fontWeight: 700 } : {}}
                >
                  Confirm {decisionModal.decision === "approved" ? "Approval" : "Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receipt Photo Preview */}
      {selectedReceipt && (
        <div className="modal-backdrop" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div className="card" style={{ width: 560, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: "0 0 2px" }}>🧾 Expense Receipt Bill Proof</h3>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {selectedReceipt.salespersonName} · {inr(selectedReceipt.amount)} ({selectedReceipt.category})
                </div>
              </div>
              <button type="button" className="sm ghost" onClick={() => setSelectedReceipt(null)}>✕</button>
            </div>

            <div style={{ maxHeight: 350, overflow: "hidden", background: "#f3f4f6", borderRadius: 8, textAlign: "center", marginBottom: 14 }}>
              <img
                src={selectedReceipt.receiptUrl}
                alt="Receipt Proof"
                style={{ maxWidth: "100%", maxHeight: 340, objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/catalog-images/basmati-rice.png";
                }}
              />
            </div>

            <div style={{ background: "#f9fafb", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              <div><strong>Purpose:</strong> {selectedReceipt.description}</div>
              <div style={{ color: "#6b7280", marginTop: 4, fontSize: 12 }}>
                Submitted: {new Date(selectedReceipt.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button type="button" className="secondary" onClick={() => setSelectedReceipt(null)}>
                Close
              </button>

              {selectedReceipt.status === "submitted" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="danger-outline"
                    onClick={() => {
                      const item = selectedReceipt;
                      setSelectedReceipt(null);
                      setDecisionModal({
                        type: "expense",
                        id: item.id,
                        decision: "rejected",
                        title: `Reject ₹${item.amount} claim for ${item.salespersonName}`,
                      });
                    }}
                  >
                    Reject Claim
                  </button>
                  <button
                    type="button"
                    className="primary"
                    style={{ background: "#15803d", borderColor: "#15803d", fontWeight: 700 }}
                    onClick={() => {
                      const item = selectedReceipt;
                      setSelectedReceipt(null);
                      setDecisionModal({
                        type: "expense",
                        id: item.id,
                        decision: "approved",
                        title: `Approve ₹${item.amount} (${item.category}) for ${item.salespersonName}`,
                      });
                    }}
                  >
                    Approve Claim
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
