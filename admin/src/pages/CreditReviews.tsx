import { useEffect, useState } from "react";
import { api, inr } from "../api";

export default function CreditReviews() {
  // Existing state
  const [proposals, setProposals] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [kycPending, setKycPending] = useState<any[]>([]);
  const [kycSelected, setKycSelected] = useState<string | null>(null);
  const [kycEvidence, setKycEvidence] = useState("");
  const [kycReason, setKycReason] = useState("");
  const [kycChallengeId, setKycChallengeId] = useState("");
  const [kycOtp, setKycOtp] = useState("");

  // Gap 7: Credit Policy & Mode Gate state
  const [policyData, setPolicyData] = useState<{
    mode: "shadow" | "enforce";
    stats?: any;
    exposure?: any;
    overrides?: any[];
    recentOverrides?: any[];
  } | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const [retailersList, setRetailersList] = useState<any[]>([]);

  // Override Limit Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    retailerId: "",
    newLimit: "",
    reason: "",
    expiresDays: "14",
  });
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const load = async () => {
    try {
      const [ratingResult, shadowResult, kycResult] = await Promise.all([
        api.ratingProposals().catch(() => ({ proposals: [] })),
        api.shadowComparisons().catch(() => ({ comparisons: [] })),
        api.kycPending().catch(() => ({ profiles: [], cases: [] })),
      ]);
      setProposals(ratingResult?.proposals ?? []);
      setComparisons(shadowResult?.comparisons ?? []);
      setKycPending(kycResult?.profiles ?? kycResult?.cases ?? []);
    } catch {
      // Non-blocking
    }
  };

  const loadCreditPolicy = async () => {
    setPolicyLoading(true);
    try {
      const [pol, ret] = await Promise.all([
        api.creditPolicy(),
        api.retailers().catch(() => ({ retailers: [] })),
      ]);
      setPolicyData(pol);
      setRetailersList(ret.retailers ?? []);
      if (ret.retailers?.length > 0 && !overrideForm.retailerId) {
        setOverrideForm((prev) => ({ ...prev, retailerId: ret.retailers[0].id }));
      }
    } catch (err: any) {
      setError(err.message ?? "Could not load credit policy");
    } finally {
      setPolicyLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadCreditPolicy();
  }, []);

  const handleToggleMode = async (newMode: "shadow" | "enforce") => {
    if (newMode === policyData?.mode) return;
    const confirmMsg =
      newMode === "enforce"
        ? "Switch to ENFORCED credit mode? In enforced mode, orders that exceed credit limits or have overdue balances will be immediately blocked from placement."
        : "Switch to SHADOW mode? Credit limits will continue to be simulated and logged for telemetry, but orders will NOT be blocked.";
    if (!window.confirm(confirmMsg)) return;

    setTogglingMode(true);
    setError("");
    try {
      const result = await api.setCreditMode(newMode);
      setNotice(result.message ?? `Credit policy mode switched to ${newMode.toUpperCase()}`);
      await loadCreditPolicy();
    } catch (err: any) {
      setError(err.message ?? "Failed to update credit policy mode");
    } finally {
      setTogglingMode(false);
    }
  };

  const handleOverrideLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideForm.retailerId || !overrideForm.newLimit || !overrideForm.reason.trim()) {
      setError("Please fill all required override fields.");
      return;
    }
    setSubmittingOverride(true);
    setError("");
    try {
      const res = await api.overrideRetailerCreditLimit(overrideForm.retailerId, {
        newLimit: parseFloat(overrideForm.newLimit),
        reason: overrideForm.reason.trim(),
        expiresDays: parseInt(overrideForm.expiresDays, 10) || 14,
      });
      setNotice(res.message ?? "Credit limit override applied successfully");
      setShowOverrideModal(false);
      setOverrideForm({
        retailerId: retailersList[0]?.id ?? "",
        newLimit: "",
        reason: "",
        expiresDays: "14",
      });
      await loadCreditPolicy();
    } catch (err: any) {
      setError(err.message ?? "Failed to apply limit override");
    } finally {
      setSubmittingOverride(false);
    }
  };

  const begin = async (id: string) => {
    if (reason.trim().length < 5) return setError("Add a confirmation reason.");
    try {
      const challenge = await api.requestAdminStepUp();
      setSelected(id);
      setChallengeId(challenge.challengeId);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const confirm = async () => {
    if (!selected || otp.length !== 6) return;
    try {
      await api.completeAdminStepUp(challengeId, otp);
      await api.confirmRatingProposal(selected, reason.trim());
      setSelected(null);
      setOtp("");
      setReason("");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const beginKyc = async (retailerId: string) => {
    if (kycEvidence.trim().length < 3 || kycReason.trim().length < 5) {
      return setError("Add the KYC evidence reference and confirmation reason.");
    }
    try {
      const challenge = await api.requestAdminStepUp();
      setKycSelected(retailerId);
      setKycChallengeId(challenge.challengeId);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const confirmKyc = async () => {
    if (!kycSelected || kycOtp.length !== 6) return;
    try {
      await api.completeAdminStepUp(kycChallengeId, kycOtp);
      await api.confirmKyc(kycSelected, kycEvidence.trim(), kycReason.trim());
      setKycSelected(null);
      setKycChallengeId("");
      setKycOtp("");
      setKycEvidence("");
      setKycReason("");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="detail-narrow">
      <div className="between" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Credit Policy & Risk Control</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Master credit gate (Shadow vs Enforced mode), credit exposure monitor, and temporary limit override workflow.
          </p>
        </div>
        <button className="secondary" onClick={() => { void load(); void loadCreditPolicy(); }}>
          Refresh
        </button>
      </div>

      {error && <div className="banner error" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="banner success" style={{ marginBottom: 14 }}>{notice}</div>}

      {/* Gap 7: Master Credit Gate & Policy Exposure Card */}
      <section className="card" style={{ marginBottom: 20, border: "1px solid var(--border, #dfe3e3)" }}>
        <div className="between" style={{ borderBottom: "1px solid var(--border, #eee)", paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Credit Policy Enforcement Gate</h2>
              {policyData?.mode === "enforce" ? (
                <span className="pill status-confirmed" style={{ fontSize: 13, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>
                  ● ENFORCED MODE
                </span>
              ) : (
                <span className="pill" style={{ fontSize: 13, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
                  ○ SHADOW MODE
                </span>
              )}
            </div>
            <p className="muted small" style={{ margin: "6px 0 0 0" }}>
              {policyData?.mode === "enforce"
                ? "Active credit blocking enabled. Orders exceeding limits or beyond grace periods cannot be punched."
                : "Simulation mode active. Credit rules are calculated and logged for analytics, but orders are NOT blocked."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={policyData?.mode === "shadow" ? "primary" : "secondary"}
              disabled={togglingMode || policyLoading || policyData?.mode === "shadow"}
              onClick={() => handleToggleMode("shadow")}
              style={{ fontSize: 13 }}
            >
              Shadow Mode
            </button>
            <button
              className={policyData?.mode === "enforce" ? "primary" : "secondary"}
              disabled={togglingMode || policyLoading || policyData?.mode === "enforce"}
              onClick={() => handleToggleMode("enforce")}
              style={{ fontSize: 13 }}
            >
              Enforce Mode
            </button>
          </div>
        </div>

        {/* Exposure Metrics */}
        {(policyData?.exposure || policyData?.stats) && (() => {
          const exp = policyData.exposure || policyData.stats;
          return (
            <div className="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
              <div className="metric card" style={{ padding: 12 }}>
                <div className="metric-label" style={{ fontSize: 11 }}>Monitored Accounts</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{exp.totalRetailers ?? 0}</div>
              </div>
              <div className="metric card" style={{ padding: 12 }}>
                <div className="metric-label" style={{ fontSize: 11 }}>Total Credit Pool</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{inr(exp.totalCreditLimit ?? 0)}</div>
              </div>
              <div className="metric card" style={{ padding: 12 }}>
                <div className="metric-label" style={{ fontSize: 11 }}>Total Outstanding</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{inr(exp.totalOutstanding ?? 0)}</div>
              </div>
              <div className="metric card" style={{ padding: 12 }}>
                <div className="metric-label" style={{ fontSize: 11 }}>Over Limit Accounts</div>
                <div className="metric-value" style={{ fontSize: 20, color: (exp.retailersOverLimit ?? exp.retailersExceedingLimit ?? 0) > 0 ? "var(--danger)" : "inherit" }}>
                  {exp.retailersOverLimit ?? exp.retailersExceedingLimit ?? 0}
                </div>
              </div>
              <div className="metric card" style={{ padding: 12 }}>
                <div className="metric-label" style={{ fontSize: 11 }}>Shadow Blocks (30d)</div>
                <div className="metric-value" style={{ fontSize: 20, color: "#d97706" }}>
                  {exp.shadowBlocks30d ?? 0}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="between" style={{ paddingTop: 8 }}>
          <span className="muted small">Need to temporarily extend a retailer's credit limit for seasonal volume?</span>
          <button onClick={() => setShowOverrideModal(true)}>
            + Grant Temporary Limit Override
          </button>
        </div>
      </section>

      {/* Recent Limit Overrides Table */}
      {(() => {
        const overridesList = policyData?.recentOverrides ?? policyData?.overrides ?? [];
        if (overridesList.length === 0) return null;
        return (
          <section className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Recent Credit Limit Overrides</h3>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted, #f8f9fa)", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px" }}>Retailer</th>
                  <th style={{ padding: "8px 10px" }}>Previous Limit</th>
                  <th style={{ padding: "8px 10px" }}>Temporary Limit</th>
                  <th style={{ padding: "8px 10px" }}>Reason</th>
                  <th style={{ padding: "8px 10px" }}>Expires At</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {overridesList.map((ov: any) => {
                  const isExpired = ov.expiresAt && new Date(ov.expiresAt) < new Date();
                  return (
                  <tr key={ov.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                      {ov.retailer?.name ?? "Retailer"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{inr(ov.previousLimit)}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--green)" }}>{inr(ov.newLimit)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>{ov.reason}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {ov.expiresAt ? new Date(ov.expiresAt).toLocaleDateString() : "Permanent"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {isExpired ? (
                        <span className="pill" style={{ background: "#fee2e2", color: "#991b1b" }}>Expired</span>
                      ) : (
                        <span className="pill status-confirmed">Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      );
    })()}

      {/* Modal: Grant Temporary Limit Override */}
      {showOverrideModal && (
        <div className="modal-backdrop" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div className="card" style={{ width: 500, maxWidth: "90vw" }}>
            <h3 style={{ marginTop: 0 }}>Grant Credit Limit Override</h3>
            <p className="page-sub">Sets a temporary elevated credit limit that automatically expires back to baseline.</p>
            <form onSubmit={handleOverrideLimit}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Select Retailer</label>
                <select
                  value={overrideForm.retailerId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, retailerId: e.target.value })}
                  required
                >
                  {retailersList.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · Current Limit: {inr(r.creditLimit)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="field">
                  <label>New Temporary Limit (₹)</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={overrideForm.newLimit}
                    onChange={(e) => setOverrideForm({ ...overrideForm, newLimit: e.target.value })}
                    placeholder="e.g. 150000"
                    required
                  />
                </div>
                <div className="field">
                  <label>Valid Duration</label>
                  <select
                    value={overrideForm.expiresDays}
                    onChange={(e) => setOverrideForm({ ...overrideForm, expiresDays: e.target.value })}
                  >
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 16 }}>
                <label>Approval Reason / Commercial Justification</label>
                <textarea
                  rows={2}
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  placeholder="e.g. Festive stock buildup approved by Credit Head"
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="secondary" onClick={() => setShowOverrideModal(false)}>Cancel</button>
                <button type="submit" disabled={submittingOverride}>
                  {submittingOverride ? "Applying…" : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KYC confirmation section */}
      {kycPending.length > 0 ? (
        <section className="card" style={{ marginBottom: 20 }}>
          <h2>KYC confirmation</h2>
          <p className="muted small">Confirm submitted evidence before the retailer's first dispatch.</p>
          <select value={kycSelected ?? ""} onChange={(event) => setKycSelected(event.target.value || null)}>
            <option value="">Select retailer</option>
            {kycPending.map((profile) => (
              <option key={profile.retailerId} value={profile.retailerId}>
                {profile.retailer.name} · {profile.retailer.phone}
              </option>
            ))}
          </select>
          <label className="field">
            <span>Evidence reference</span>
            <input value={kycEvidence} onChange={(event) => setKycEvidence(event.target.value)} placeholder="Document or case reference" />
          </label>
          <label className="field">
            <span>Confirmation reason</span>
            <input value={kycReason} onChange={(event) => setKycReason(event.target.value)} />
          </label>
          {kycChallengeId && kycSelected ? (
            <div className="step-up-box">
              <label className="field">
                <span>Verification code</span>
                <input maxLength={6} value={kycOtp} onChange={(event) => setKycOtp(event.target.value.replace(/\D/g, ""))} />
              </label>
              <button disabled={kycOtp.length !== 6} onClick={() => void confirmKyc()}>
                Verify KYC
              </button>
            </div>
          ) : (
            <button disabled={!kycSelected} onClick={() => kycSelected && void beginKyc(kycSelected)}>
              Confirm KYC evidence
            </button>
          )}
        </section>
      ) : null}

      {/* Rating proposals section */}
      <h2 style={{ marginTop: 24 }}>Rating Proposals Awaiting Lead Confirmation</h2>
      {proposals.length === 0 ? (
        <div className="card empty-state">No rating changes need review.</div>
      ) : (
        proposals.map((proposal) => (
          <section className="card" key={proposal.id} style={{ marginBottom: 16 }}>
            <div className="between">
              <div>
                <strong>{proposal.creditProfile.retailer.name}</strong>
                <p className="muted small">{proposal.trigger.replaceAll("_", " ")}</p>
              </div>
              <h2>{proposal.previousRating} → {proposal.proposedRating}</h2>
            </div>
            <div className="metric-grid">
              <div className="metric">
                <div className="metric-label">Average DSO</div>
                <div className="metric-value">{proposal.evidence.averageDso ?? "—"} days</div>
              </div>
              <div className="metric">
                <div className="metric-label">Clean invoices</div>
                <div className="metric-value">{proposal.evidence.cleanInvoiceCount ?? 0}</div>
              </div>
            </div>
            <label className="field">
              <span>Confirmation reason</span>
              <input aria-label="Confirmation reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            {selected === proposal.id ? (
              <div className="step-up-box">
                <label className="field">
                  <span>Verification code</span>
                  <input aria-label="Verification code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} />
                </label>
                <button disabled={otp.length !== 6} onClick={() => void confirm()}>
                  Verify and confirm
                </button>
              </div>
            ) : (
              <button onClick={() => void begin(proposal.id)}>Confirm rating</button>
            )}
          </section>
        ))
      )}

      {/* Shadow mode comparisons */}
      {comparisons.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <h2>Shadow-mode mismatches</h2>
          <p className="page-sub">Legacy and policy decisions differed. Export is available from the CSV endpoint.</p>
          {comparisons.map((item) => (
            <div className="card between" key={item.id} style={{ marginBottom: 8 }}>
              <div>
                <strong>{item.retailer.name}</strong>
                <div className="muted small">Legacy {item.legacyResult} · Engine {item.engineResult}</div>
              </div>
              <span className="pill status-suspended">Review</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
