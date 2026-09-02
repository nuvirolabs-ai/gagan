import { useEffect, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

const TABS = ["", "open", "in_progress", "resolved", "closed", "rejected"];

const LABEL: Record<string, string> = {
  "": "All",
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
};

const PILL: Record<string, string> = {
  open: "placed",
  in_progress: "placed",
  resolved: "confirmed",
  closed: "confirmed",
  rejected: "rejected",
};

/**
 * Customer service issues raised from the field. This is the customer's
 * complaint queue — arrears and recovery stay in the Recovery module.
 */
export default function ServiceIssues() {
  const [status, setStatus] = useState("");
  const [issues, setIssues] = useState<any[]>([]);
  const [team, setTeam] = useState("");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.serviceIssues(status ? { status } : undefined);
      setIssues(result.issues ?? []);
      setError(null);
    } catch (err) {
      setError(explain(err, "Could not load service issues"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const update = async (id: string, next: string) => {
    if (["resolved", "closed", "rejected"].includes(next) && resolution.trim().length < 3) {
      setError("Add a resolution note before closing an issue.");
      return;
    }
    try {
      await api.updateServiceIssue(id, {
        status: next,
        assignedTeam: team.trim() || undefined,
        resolutionNote: resolution.trim() || undefined,
      });
      setResolution("");
      await load();
    } catch (err) {
      setError(explain(err, "Could not update the issue"));
    }
  };

  return (
    <div>
      <h1 className="page-title">Service issues</h1>
      <p className="page-sub">
        Complaints and service requests raised by salespeople at the store. Each one also appears on
        that customer's activity timeline.
      </p>
      {error && <div className="banner error">{error}</div>}

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab || "all"}
            className={`tab ${status === tab ? "active" : ""}`}
            onClick={() => setStatus(tab)}
          >
            {LABEL[tab]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>Assign to team</label>
            <input
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              placeholder="Logistics"
            />
          </div>
          <div className="field">
            <label>Resolution note (required to close)</label>
            <input
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="Replacement cartons dispatched on 12 March"
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : issues.length === 0 ? (
          <div className="empty-state">No issues in this filter.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Raised by</th>
                <th>Description</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {issues.map((issue: any) => (
                <tr key={issue.id}>
                  <td>{issue.retailer?.name ?? issue.retailerId}</td>
                  <td>{issue.type.replace(/_/g, " ")}</td>
                  <td>{issue.priority}</td>
                  <td>{issue.raisedBy?.name ?? issue.raisedByStaffId}</td>
                  <td className="small">{issue.description}</td>
                  <td>
                    <span className={`pill ${PILL[issue.status] ?? ""}`}>
                      {issue.status.replace("_", " ")}
                    </span>
                    {issue.assignedTeam ? (
                      <div className="small muted">{issue.assignedTeam}</div>
                    ) : null}
                  </td>
                  <td>
                    {["open", "in_progress"].includes(issue.status) ? (
                      <div className="row" style={{ gap: 6 }}>
                        {issue.status === "open" ? (
                          <button className="sm secondary" onClick={() => void update(issue.id, "in_progress")}>
                            Start
                          </button>
                        ) : null}
                        <button className="sm" onClick={() => void update(issue.id, "resolved")}>
                          Resolve
                        </button>
                        <button className="sm secondary" onClick={() => void update(issue.id, "closed")}>
                          Close
                        </button>
                        <button className="sm danger" onClick={() => void update(issue.id, "rejected")}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="small muted">{issue.resolutionNote ?? "—"}</span>
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
