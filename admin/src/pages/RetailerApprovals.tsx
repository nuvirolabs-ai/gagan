import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { proposalIntentSourceLabel } from "../orderAttribution";
import { explain } from "../errorCopy";

const TABS = ["pending", "approved", "rejected"] as const;

const STATUS_PILL: Record<string, string> = {
  pending: "placed",
  approved: "confirmed",
  rejected: "rejected",
  withdrawn: "",
};

/**
 * New stores put forward from the field.
 *
 * Approving one creates a single canonical retailer assigned to the salesperson
 * who proposed it. The store still enters at `pending_kyc`, so admitting it to
 * the customer master never doubles as granting credit or clearing KYC.
 */
export default function RetailerApprovals() {
  const [status, setStatus] = useState<(typeof TABS)[number]>("pending");
  const [proposals, setProposals] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tierId, setTierId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);

  // New UX: Salesperson filter, search, tutorial toggle, and batch action
  const [salespersonFilter, setSalespersonFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showTutorial, setShowTutorial] = useState<boolean>(true);
  const [batchBusy, setBatchBusy] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, tierList] = await Promise.all([
        api.retailerProposals(status, salespersonFilter || undefined),
        api.tiers().catch(() => ({ tiers: [] })),
      ]);
      setProposals(list.proposals ?? []);
      setSelectedProposal(null);
      setTiers(tierList.tiers ?? tierList ?? []);
      setError(null);
    } catch (err) {
      setError(explain(err, "Could not load retailer requests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, salespersonFilter]);

  // Extract distinct salespeople from proposal list
  const salespeople = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const p of proposals) {
      const id = p.submittedBy?.id || p.submittedByStaffId || "unknown";
      const name = p.submittedBy?.name || p.submittedByStaffId || "Salesperson";
      const prev = map.get(id);
      if (prev) {
        prev.count++;
      } else {
        map.set(id, { id, name, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [proposals]);

  // Filtered proposals based on search
  const filteredProposals = useMemo(() => {
    let list = proposals;
    if (salespersonFilter) {
      list = list.filter(
        (p) => (p.submittedBy?.id || p.submittedByStaffId) === salespersonFilter
      );
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const nameMatch = p.businessName?.toLowerCase().includes(q);
        const ownerMatch = p.ownerName?.toLowerCase().includes(q);
        const phoneMatch = p.phone?.includes(q);
        const addressMatch = p.shopAddress?.toLowerCase().includes(q);
        return nameMatch || ownerMatch || phoneMatch || addressMatch;
      });
    }
    return list;
  }, [proposals, salespersonFilter, searchQuery]);

  // Cluster counts
  const totalPunchedDemands = useMemo(() => {
    return filteredProposals.reduce(
      (sum, p) => sum + (Array.isArray(p.orderIntents) ? p.orderIntents.length : 0),
      0
    );
  }, [filteredProposals]);

  const approve = async (id: string) => {
    try {
      await api.approveRetailerProposal(id, tierId || undefined);
      setMessage("Store added to the customer master. It starts at pending KYC.");
      setError(null);
      await load();
    } catch (err) {
      setMessage(null);
      setError(explain(err));
    }
  };

  const reject = async (id: string) => {
    if (reason.trim().length < 3) {
      setError("Give the salesperson a reason before rejecting.");
      return;
    }
    try {
      await api.rejectRetailerProposal(id, reason.trim());
      setReason("");
      setMessage("Rejected. The salesperson can see the reason.");
      setError(null);
      await load();
    } catch (err) {
      setMessage(null);
      setError(explain(err));
    }
  };

  const batchApproveAll = async () => {
    const pendingList = filteredProposals.filter((p) => p.status === "pending");
    if (pendingList.length === 0) return;
    if (
      !window.confirm(
        `Approve all ${pendingList.length} pending stores for this salesperson? They will enter the customer master at pending KYC and punched demands will convert to official orders.`
      )
    ) {
      return;
    }
    setBatchBusy(true);
    setError(null);
    setMessage(null);
    let count = 0;
    try {
      for (const item of pendingList) {
        await api.approveRetailerProposal(item.id, tierId || undefined);
        count++;
      }
      setMessage(
        `Successfully approved all ${count} stores into the customer master. They start at pending KYC.`
      );
      await load();
    } catch (err) {
      setError(explain(err, `Approved ${count} stores before encountering an issue`));
      await load();
    } finally {
      setBatchBusy(false);
    }
  };

  const activeSalespersonName =
    salespeople.find((s) => s.id === salespersonFilter)?.name || "All Salespeople";

  return (
    <div>
      <header className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-label">Sales Operations / Field Governance</div>
          <h1 className="page-title">New retailers</h1>
          <p className="page-sub">
            Stores proposed by salespeople. Approving creates one canonical customer, assigned to the
            salesperson who put it forward.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => setShowTutorial((v) => !v)}
            aria-expanded={showTutorial}
          >
            {showTutorial ? "Hide Tutorial" : "💡 How It Works (Tutorial)"}
          </button>
        </div>
      </header>

      {/* Self-Tutorial Walkthrough Guide */}
      {showTutorial && (
        <section
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 20,
          }}
          aria-label="Sales Lead Walkthrough Guide"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <strong style={{ fontSize: 15, color: "#1e40af" }}>
              📖 Self-Tutorial: How to approve field stores without manuals
            </strong>
            <button
              type="button"
              className="text-button"
              style={{ fontSize: 13, color: "#1e40af" }}
              onClick={() => setShowTutorial(false)}
            >
              ✕ Dismiss
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 16,
              fontSize: 13,
              color: "#1e3a8a",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                padding: "12px 14px",
                borderRadius: 6,
                border: "1px solid #dbeafe",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>1. Inspect Proposal</div>
              <div>
                Click any store row to inspect the shop owner, GSTIN, Aadhaar document, and GPS pin
                captured in the field.
              </div>
            </div>
            <div
              style={{
                background: "#ffffff",
                padding: "12px 14px",
                borderRadius: 6,
                border: "1px solid #dbeafe",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>2. Account Setup</div>
              <div>
                Assign the retailer account. Standard single pricing applies automatically across the catalogue.
              </div>
            </div>
            <div
              style={{
                background: "#ffffff",
                padding: "12px 14px",
                borderRadius: 6,
                border: "1px solid #dbeafe",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>3. Approve or Batch Approve</div>
              <div>
                Click <strong>Approve</strong> or <strong>Batch Approve</strong>. The store enters the
                customer master at <em>pending_kyc</em> and its punched demand auto-converts to an official
                order!
              </div>
            </div>
            <div
              style={{
                background: "#ffffff",
                padding: "12px 14px",
                borderRadius: 6,
                border: "1px solid #dbeafe",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>4. If Rejecting</div>
              <div>
                Write a short reason (e.g. "duplicate shop" or "invalid phone"). The salesperson will
                see your note in their mobile app.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Cluster & Salesperson Summary Header */}
      <section
        style={{
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "14px 18px",
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
        aria-label="Cluster & Salesperson Scope"
      >
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>
            Assigned Field Scope
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
            {activeSalespersonName} · Pune East Kirana Cluster
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            Cluster coverage: 30 retailers assigned · Filter proposals submitted by your team
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Visible Stores</div>
            <strong style={{ fontSize: 18, color: "#111827" }}>{filteredProposals.length}</strong>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Punched Orders</div>
            <strong style={{ fontSize: 18, color: "#2563eb" }}>{totalPunchedDemands}</strong>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Current Queue</div>
            <strong style={{ fontSize: 18, color: status === "pending" ? "#d97706" : "#166534" }}>
              {status}
            </strong>
          </div>
        </div>
      </section>

      {/* Salesperson Filter Pills */}
      {salespeople.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
          role="group"
          aria-label="Salesperson filter"
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4b5563", marginRight: 4 }}>
            Salesperson:
          </span>
          <button
            type="button"
            className={`button ${salespersonFilter === "" ? "primary" : "secondary"} compact`}
            onClick={() => setSalespersonFilter("")}
            style={{ fontSize: 12 }}
          >
            All Salespeople ({proposals.length})
          </button>
          {salespeople.map((sp) => (
            <button
              type="button"
              key={sp.id}
              className={`button ${salespersonFilter === sp.id ? "primary" : "secondary"} compact`}
              onClick={() => setSalespersonFilter(sp.id)}
              style={{ fontSize: 12 }}
            >
              👤 {sp.name} ({sp.count})
            </button>
          ))}
        </div>
      )}

      {error && <div className="banner error">{error}</div>}
      {message && <div className="banner">{message}</div>}

      <div className="tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`tab ${status === tab ? "active" : ""}`}
              onClick={() => setStatus(tab)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ minWidth: 240 }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search store name, phone, contact…"
            aria-label="Search retailer proposals"
            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
          />
        </div>
      </div>

      {status === "pending" ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="form-grid" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Tier to apply on approval</label>
              <select value={tierId} onChange={(event) => setTierId(event.target.value)}>
                <option value="">Use the proposed tier</option>
                {tiers.map((tier: any) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Rejection reason (required to reject)</label>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Already served under another account"
              />
            </div>
            {filteredProposals.length > 0 && (
              <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="button"
                  className="button primary"
                  style={{ background: "#15803d", borderColor: "#15803d", width: "100%", height: 38 }}
                  onClick={() => void batchApproveAll()}
                  disabled={batchBusy}
                >
                  {batchBusy ? "Approving cluster…" : `✓ Batch Approve All Visible (${filteredProposals.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : filteredProposals.length === 0 ? (
          <div className="empty-state">
            {searchQuery
              ? `No ${status} requests match "${searchQuery}".`
              : `No ${status} requests.`}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Shop</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Location</th>
                <th>Proposed by</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredProposals.map((proposal: any) => (
                <tr
                  key={proposal.id}
                  className={selectedProposal?.id === proposal.id ? "selected" : ""}
                  onClick={() => setSelectedProposal(proposal)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <strong>{proposal.businessName}</strong>
                    {proposal.notes ? <div className="small muted">{proposal.notes}</div> : null}
                    {proposal.status === "pending" && proposal.orderIntents?.length ? (
                      <div className="small muted" style={{ marginTop: 3 }}>
                        {proposal.orderIntents.length} punched demand
                        {proposal.orderIntents.length === 1 ? "" : "s"} · unpriced until retailer approval
                        {proposal.orderIntents.map((intent: any) => (
                          <div key={intent.id} style={{ fontSize: 11, color: "#2563eb" }}>
                            {proposalIntentSourceLabel(intent)}
                            {intent.punchedAt
                              ? ` · ${new Date(intent.punchedAt).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}`
                              : ""}
                            {` · ${intent.retailer?.name ?? proposal.businessName}`}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {proposal.phone}
                    {proposal.ownerName ? (
                      <div className="small muted">{proposal.ownerName}</div>
                    ) : null}
                  </td>
                  <td className="small">{proposal.shopAddress}</td>
                  <td className="small">
                    {proposal.latitude == null ? (
                      "Not captured"
                    ) : (
                      <a
                        href={`https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#2563eb", textDecoration: "underline" }}
                      >
                        {`${Number(proposal.latitude).toFixed(5)}, ${Number(proposal.longitude).toFixed(5)}`}
                      </a>
                    )}
                  </td>
                  <td>{proposal.submittedBy?.name ?? proposal.submittedByStaffId}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[proposal.status] ?? ""}`}>
                      {proposal.status}
                    </span>
                    {proposal.rejectionReason ? (
                      <div className="small muted">{proposal.rejectionReason}</div>
                    ) : null}
                  </td>
                  <td>
                    {proposal.status === "pending" ? (
                      <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button className="sm" onClick={() => void approve(proposal.id)}>
                          Approve
                        </button>
                        <button className="sm danger" onClick={() => void reject(proposal.id)}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="small muted">
                        {proposal.reviewedBy?.name ? `by ${proposal.reviewedBy.name}` : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Proposal Inspection Panel */}
      {selectedProposal ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="eyebrow">Proposal review</div>
              <h2 style={{ margin: "0 0 4px" }}>{selectedProposal.businessName}</h2>
              <div className="small muted">
                Submitted by {selectedProposal.submittedBy?.name ?? selectedProposal.submittedByStaffId} ·{" "}
                {selectedProposal.phone}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className={`pill ${STATUS_PILL[selectedProposal.status] ?? ""}`}>
                {selectedProposal.status}
              </span>
              {selectedProposal.status === "pending" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="sm" onClick={() => void approve(selectedProposal.id)}>
                    Approve Store
                  </button>
                  <button className="sm danger" onClick={() => void reject(selectedProposal.id)}>
                    Reject Store
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 18 }}>
            <div>
              <div className="section-kicker">Business</div>
              <div><strong>Group:</strong> {selectedProposal.groupName ?? "—"}</div>
              <div><strong>Contact:</strong> {selectedProposal.ownerName ?? "—"}</div>
              <div><strong>Mobile:</strong> {selectedProposal.phone}</div>
              <div><strong>Telephone:</strong> {selectedProposal.telephone ?? "—"}</div>
              <div><strong>Transporter:</strong> {selectedProposal.transporter ?? "—"}</div>
            </div>
            <div>
              <div className="section-kicker">Address & delivery</div>
              <div>{selectedProposal.shopAddress}</div>
              <div>
                {[
                  selectedProposal.pinCode,
                  selectedProposal.tehsil,
                  selectedProposal.district,
                  selectedProposal.state,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Location details not supplied"}
              </div>
              <div><strong>Delivery city:</strong> {selectedProposal.deliveryCity ?? "—"}</div>
              <div>
                <strong>Shop duration:</strong>{" "}
                {selectedProposal.shopDurationYears == null
                  ? "—"
                  : `${selectedProposal.shopDurationYears} years`}
              </div>
              {selectedProposal.latitude != null && (
                <div style={{ marginTop: 4 }}>
                  <a
                    href={`https://www.google.com/maps?q=${selectedProposal.latitude},${selectedProposal.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: "#2563eb" }}
                  >
                    📍 Open GPS coordinates in Google Maps
                  </a>
                </div>
              )}
            </div>
            <div>
              <div className="section-kicker">Commercial</div>
              <div><strong>GSTIN:</strong> {selectedProposal.gstin ?? "—"}</div>
              <div><strong>Payment terms:</strong> {selectedProposal.paymentTerms ?? "—"}</div>
              <div><strong>UPI ID:</strong> {selectedProposal.upiId ?? "—"}</div>
              <div>
                <strong>Salesman:</strong>{" "}
                {selectedProposal.submittedBy?.name ?? "Authenticated salesperson"}
              </div>
            </div>
            <div>
              <div className="section-kicker">Identity</div>
              <div>
                <strong>Aadhaar:</strong> {selectedProposal.aadhaarNumberMasked ?? "Not supplied"}
              </div>
              <div className="small muted">
                Full Aadhaar is encrypted and is never returned to this page.
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", marginBottom: 4 }}>
                    FRONT SIDE
                  </div>
                  {selectedProposal.aadhaarPhoto?.signedUrl ? (
                    <img
                      src={selectedProposal.aadhaarPhoto.signedUrl}
                      alt="Aadhaar Front Side Preview"
                      style={{
                        display: "block",
                        maxWidth: 200,
                        maxHeight: 130,
                        objectFit: "contain",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <div className="small muted">Front photo unavailable</div>
                  )}
                </div>

                {selectedProposal.aadhaarPhotoBack?.signedUrl ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", marginBottom: 4 }}>
                      BACK SIDE
                    </div>
                    <img
                      src={selectedProposal.aadhaarPhotoBack.signedUrl}
                      alt="Aadhaar Back Side Preview"
                      style={{
                        display: "block",
                        maxWidth: 200,
                        maxHeight: 130,
                        objectFit: "contain",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {selectedProposal.orderIntents?.length ? (
            <div
              style={{
                marginTop: 18,
                background: "#f8fafc",
                padding: "12px 16px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
              }}
            >
              <div className="section-kicker" style={{ color: "#2563eb" }}>
                Punched Order Demand ({selectedProposal.orderIntents.length})
              </div>
              <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#475569" }}>
                This store has preliminary punched demand submitted from the mobile field app. Approving
                this proposal will automatically convert it into an official order for the warehouse.
              </p>
              {selectedProposal.orderIntents.map((intent: any) => (
                <div
                  key={intent.id}
                  style={{
                    fontSize: 12,
                    padding: "6px 0",
                    borderBottom: "1px dashed #e2e8f0",
                  }}
                >
                  <strong>{proposalIntentSourceLabel(intent)}</strong> · Punched at{" "}
                  {intent.punchedAt
                    ? new Date(intent.punchedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                  {intent.items?.length ? (
                    <div style={{ marginTop: 4, color: "#334155" }}>
                      Lines:{" "}
                      {intent.items
                        .map((i: any) => `${i.qty} cases (SKU: ${i.variantId})`)
                        .join(", ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {selectedProposal.notes ? (
            <div style={{ marginTop: 18 }}>
              <div className="section-kicker">Notes</div>
              <div>{selectedProposal.notes}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
