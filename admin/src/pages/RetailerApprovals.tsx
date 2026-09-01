import { useEffect, useState } from "react";
import { api } from "../api";

const TABS = ["pending", "approved", "rejected"] as const;

/**
 * The API answers with a code; a reviewer needs a sentence. Anything not
 * listed falls back to the raw message rather than being swallowed.
 */
const ERROR_COPY: Record<string, string> = {
  tier_required:
    "Choose a tier to apply — this request did not come with one, and a customer cannot be created without it.",
  tier_not_found: "That tier no longer exists. Pick another one.",
  proposal_already_decided: "Somebody has already decided this request.",
  retailer_already_exists:
    "A customer with this phone number already exists. Assign the existing customer instead.",
  self_review_forbidden: "A salesperson cannot review their own request.",
  rejection_reason_required: "Give the salesperson a reason before rejecting.",
  proposal_not_found: "That request no longer exists.",
};

function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return ERROR_COPY[message] ?? message ?? "Something went wrong.";
}

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

  const load = async () => {
    setLoading(true);
    try {
      const [list, tierList] = await Promise.all([api.retailerProposals(status), api.tiers()]);
      setProposals(list.proposals ?? []);
      setTiers(tierList.tiers ?? tierList ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load retailer requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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

  return (
    <div>
      <h1 className="page-title">New retailers</h1>
      <p className="page-sub">
        Stores proposed by salespeople. Approving creates one canonical customer, assigned to the
        salesperson who put it forward.
      </p>
      {error && <div className="banner error">{error}</div>}
      {message && <div className="banner">{message}</div>}

      <div className="tabs">
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

      {status === "pending" ? (
        <div className="card">
          <div className="form-grid">
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
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : proposals.length === 0 ? (
          <div className="empty-state">No {status} requests.</div>
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
              {proposals.map((proposal: any) => (
                <tr key={proposal.id}>
                  <td>
                    <strong>{proposal.businessName}</strong>
                    {proposal.notes ? <div className="small muted">{proposal.notes}</div> : null}
                  </td>
                  <td>
                    {proposal.phone}
                    {proposal.ownerName ? (
                      <div className="small muted">{proposal.ownerName}</div>
                    ) : null}
                  </td>
                  <td className="small">{proposal.shopAddress}</td>
                  <td className="small">
                    {proposal.latitude == null
                      ? "Not captured"
                      : `${Number(proposal.latitude).toFixed(5)}, ${Number(proposal.longitude).toFixed(5)}`}
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
                      <div className="row" style={{ gap: 6 }}>
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
    </div>
  );
}
