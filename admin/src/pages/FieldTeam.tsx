import { useEffect, useState } from "react";
import { api, inr } from "../api";

const MARK_PILL: Record<string, string> = {
  present: "confirmed",
  leave: "placed",
  absent: "rejected",
  holiday: "",
  not_due: "",
};

const MARK_LABEL: Record<string, string> = {
  present: "Present",
  leave: "On leave",
  absent: "Absent",
  holiday: "Holiday",
  not_due: "—",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Team attendance, leave decisions and last known working position for one
 * date. Every number here is the same canonical data the salesperson sees in
 * their own app.
 */
export default function FieldTeam() {
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState<"attendance" | "leave" | "location">("attendance");
  const [team, setTeam] = useState<any[]>([]);
  const [leave, setLeave] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [teamResult, leaveResult, liveResult] = await Promise.all([
        api.fieldTeam(date),
        api.leaveRequests(),
        api.liveFieldPositions(),
      ]);
      setTeam(teamResult.members ?? []);
      setLeave(leaveResult.requests ?? []);
      setPositions(liveResult.salespeople ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the field team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    try {
      await api.decideLeave(id, decision, note.trim() || undefined);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the decision");
    }
  };

  const pendingLeave = leave.filter((request) => request.status === "pending");

  return (
    <div>
      <h1 className="page-title">Field team</h1>
      <p className="page-sub">
        Attendance, leave and last known working position. Salespeople are only tracked while their
        day is open, so a blank position means they are off duty, not hidden.
      </p>
      {error && <div className="banner error">{error}</div>}

      <div className="tabs">
        <button
          className={`tab ${tab === "attendance" ? "active" : ""}`}
          onClick={() => setTab("attendance")}
        >
          Attendance
        </button>
        <button className={`tab ${tab === "leave" ? "active" : ""}`} onClick={() => setTab("leave")}>
          Leave{pendingLeave.length ? ` (${pendingLeave.length})` : ""}
        </button>
        <button
          className={`tab ${tab === "location" ? "active" : ""}`}
          onClick={() => setTab("location")}
        >
          On duty now
        </button>
      </div>

      <div className="card">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="card empty-state">Loading…</div>
      ) : tab === "attendance" ? (
        <div className="card" style={{ padding: 0 }}>
          {team.length === 0 ? (
            <div className="empty-state">No field staff are configured yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Territory</th>
                  <th>Attendance</th>
                  <th>Hours</th>
                  <th>Visits</th>
                  <th>Orders</th>
                  <th>Order value</th>
                  <th>Route</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <tr key={member.salespersonId}>
                    <td>{member.name}</td>
                    <td>{member.territory ?? "—"}</td>
                    <td>
                      <span className={`pill ${MARK_PILL[member.mark] ?? ""}`}>
                        {MARK_LABEL[member.mark] ?? member.mark}
                      </span>
                    </td>
                    <td>
                      {member.workedMinutes != null
                        ? `${Math.floor(member.workedMinutes / 60)}h ${member.workedMinutes % 60}m`
                        : member.startedAt
                          ? "Still running"
                          : "—"}
                    </td>
                    <td>{member.metrics?.visits ?? 0}</td>
                    <td>{member.metrics?.orders ?? 0}</td>
                    <td>{inr(member.metrics?.orderValue ?? 0)}</td>
                    <td>
                      {member.route
                        ? `${member.route.progress.visited + member.route.progress.skipped}/${member.route.progress.total} · ${member.route.progress.completionPct}%`
                        : "No route"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === "leave" ? (
        <div className="card" style={{ padding: 0 }}>
          {leave.length === 0 ? (
            <div className="empty-state">No leave requests.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leave.map((request) => (
                  <tr key={request.id}>
                    <td>{request.salesperson?.name ?? request.salespersonId}</td>
                    <td>
                      {new Date(request.fromDate).toLocaleDateString("en-IN")} –{" "}
                      {new Date(request.toDate).toLocaleDateString("en-IN")}
                    </td>
                    <td>{request.type}</td>
                    <td className="small">{request.reason}</td>
                    <td>
                      <span
                        className={`pill ${
                          request.status === "approved"
                            ? "confirmed"
                            : request.status === "rejected"
                              ? "rejected"
                              : "placed"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td>
                      {request.status === "pending" ? (
                        <div className="row" style={{ gap: 6 }}>
                          <button className="sm" onClick={() => void decide(request.id, "approved")}>
                            Approve
                          </button>
                          <button
                            className="sm danger"
                            onClick={() => void decide(request.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="small muted">{request.decisionNote ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {pendingLeave.length > 0 ? (
            <div style={{ padding: 16 }}>
              <div className="field">
                <label>Decision note (applies to the next decision)</label>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Cover arranged with Anil"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {positions.length === 0 ? (
            <div className="empty-state">
              Nobody has an open workday right now, so no positions are being recorded.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Territory</th>
                  <th>Day started</th>
                  <th>Last position</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((person) => (
                  <tr key={person.salespersonId}>
                    <td>{person.name}</td>
                    <td>{person.territory ?? "—"}</td>
                    <td>{new Date(person.startedAt).toLocaleTimeString("en-IN")}</td>
                    <td>
                      {person.lastPing
                        ? `${person.lastPing.latitude.toFixed(5)}, ${person.lastPing.longitude.toFixed(5)}`
                        : "No reading yet"}
                    </td>
                    <td className="small muted">
                      {person.lastPing
                        ? new Date(person.lastPing.recordedAt).toLocaleTimeString("en-IN")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
