import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { explain } from "../errorCopy";


/**
 * The reporting hierarchy: who reports to whom, and every change ever made.
 *
 * Reporting lines are the scope for every manager surface in the product —
 * attendance, expenses, targets, approvals — so this page is where a manager
 * gains or loses a team. It is deliberately plain: an indented list of the
 * whole organisation, the people not yet placed in it, and one panel for the
 * person currently selected.
 */
export default function SalesOrganisation() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [managerChoice, setManagerChoice] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadChart = async () => {
    setLoading(true);
    try {
      const [tree, waiting] = await Promise.all([api.orgTree(), api.orgUnassigned()]);
      setNodes(tree.nodes ?? []);
      setUnassigned(waiting.staff ?? []);
      setError(null);
    } catch (err) {
      setError(explain(err));
    } finally {
      setLoading(false);
    }
  };

  const select = async (staffId: string) => {
    setSelectedId(staffId);
    setNotice(null);
    try {
      const [person, eligible] = await Promise.all([
        api.orgStaff(staffId),
        api.orgEligibleManagers(staffId),
      ]);
      setDetail(person);
      setCandidates(eligible.managers ?? []);
      setManagerChoice(person.staff.managerId ?? "");
      setReason("");
      setError(null);
    } catch (err) {
      setError(explain(err));
    }
  };

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.setOrgManager(selectedId, managerChoice || null, reason || undefined);
      setNotice("Reporting line updated.");
      await Promise.all([loadChart(), select(selectedId)]);
    } catch (err) {
      setError(explain(err));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadChart();
  }, []);

  return (
    <div>
      <h1 className="page-title">Sales organisation</h1>
      <p className="page-sub">
        Reporting lines decide what every manager can see and approve. Changing one takes effect
        immediately and is recorded permanently.
      </p>
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner">{notice}</div>}

      {unassigned.length > 0 && (
        <div className="card">
          <h2 className="section-title">Not yet placed ({unassigned.length})</h2>
          <p className="section-copy">
            Active employees with no manager. They sit at the top of the chart, so nobody sees their
            work on a team screen.
          </p>
          <ul className="reason-list">
            {unassigned.map((person) => (
              <li key={person.id}>
                <button className="link-button" onClick={() => void select(person.id)}>
                  {person.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="approval-layout">
        {/* minWidth:0 lets the grid column shrink; without it a wide table
            overflows its cell instead of scrolling inside it. */}
        <div className="card" style={{ padding: 0, minWidth: 0, overflowX: "auto" }}>
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : nodes.length === 0 ? (
            <div className="empty-state">No employees yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => (
                  <tr
                    key={node.id}
                    className={node.id === selectedId ? "selected" : ""}
                    onClick={() => void select(node.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      {/* Indentation is the hierarchy: depth 0 is the top of a tree. */}
                      <span
                        style={{
                          paddingLeft: `${node.depth * 20}px`,
                          // A name is one unit: breaking "Ravi Kumar" across
                          // two lines makes the indentation unreadable.
                          whiteSpace: "nowrap",
                        }}
                      >
                        {node.depth > 0 && <span className="muted">└ </span>}
                        <span>{node.name}</span>
                        {/* Only the exceptions are worth a column's width. */}
                        {node.status !== "active" && (
                          <span className="small muted"> · {node.status}</span>
                        )}
                      </span>
                    </td>
                    <td>{node.reportCount || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          {!detail ? (
            <div className="empty-state">Select someone to see their place in the chart.</div>
          ) : (
            <>
              <h2 className="section-title">{detail.staff.name}</h2>
              <p className="section-copy">
                {detail.teamSize === 0
                  ? "Nobody reports to them."
                  : `${detail.teamSize} ${detail.teamSize === 1 ? "person reports" : "people report"} to them, ${detail.directReports.length} directly.`}{" "}
                <Link to={`/staff/${detail.staff.id}`}>Open employee</Link>
              </p>

              <div className="field">
                <label>Reports to</label>
                <select value={managerChoice} onChange={(event) => setManagerChoice(event.target.value)}>
                  <option value="">— nobody (top of the tree) —</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Reason (optional)</label>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Territory reshuffle"
                />
              </div>
              <button disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Update reporting line"}
              </button>

              {detail.managementChain.length > 0 && (
                <>
                  <h3 className="section-title">Reports up through</h3>
                  <ul className="reason-list">
                    {detail.managementChain.map((link: any) => (
                      <li key={link.id}>{link.name}</li>
                    ))}
                  </ul>
                </>
              )}

              {detail.directReports.length > 0 && (
                <>
                  <h3 className="section-title">Direct reports</h3>
                  <ul className="reason-list">
                    {detail.directReports.map((report: any) => (
                      <li key={report.id}>
                        <button className="link-button" onClick={() => void select(report.id)}>
                          {report.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3 className="section-title">History</h3>
              {detail.history.length === 0 ? (
                <p className="section-copy">Their reporting line has never been changed here.</p>
              ) : (
                <ul className="reason-list">
                  {detail.history.map((event: any) => (
                    <li key={event.id}>
                      {new Date(event.changedAt).toLocaleDateString()} —{" "}
                      {event.previousManagerName ?? "nobody"} → {event.newManagerName ?? "nobody"}
                      {event.changedByName ? `, by ${event.changedByName}` : ""}
                      {event.reason ? ` (${event.reason})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
