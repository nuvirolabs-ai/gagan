import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { readableRole, type StaffMember } from "../staffTypes";

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", employeeRef: "" });
  const [newMode, setNewMode] = useState<"staff" | "selling_leader">("staff");
  const [newManagerId, setNewManagerId] = useState("");
  const [newReportIds, setNewReportIds] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.staff();
      setStaff(response.staff);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const newStaff = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        employeeRef: form.employeeRef.trim() || undefined,
      };
      if (newMode === "selling_leader") {
        await api.createSellingLeader({
          newStaff,
          ...(newManagerId ? { managerId: newManagerId } : {}),
          ...(newReportIds.length ? { reportIds: newReportIds } : {}),
        });
      } else {
        await api.createStaff(newStaff);
      }
      setNotice(newMode === "selling_leader" ? `${form.name} is set up as a selling Sales Leader.` : `${form.name} can now receive an assigned role.`);
      setForm({ name: "", phone: "", email: "", employeeRef: "" });
      setNewMode("staff");
      setNewManagerId("");
      setNewReportIds([]);
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create staff member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="between" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Staff access</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Give each person only the role they need.
          </p>
        </div>
        <button onClick={() => setCreating((value) => !value)}>
          {creating ? "Cancel" : "Add staff member"}
        </button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      {creating && (
        <form className="card compact-form" onSubmit={create}>
          <h2 className="section-title">New staff identity</h2>
          <div className="field">
            <label htmlFor="new-staff-mode">Setup</label>
            <select id="new-staff-mode" value={newMode} onChange={(event) => setNewMode(event.target.value as "staff" | "selling_leader")}>
              <option value="staff">Staff identity</option>
              <option value="selling_leader">Selling Sales Leader</option>
            </select>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="staff-name">Full name</label>
              <input id="staff-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="staff-phone">Phone</label>
              <input id="staff-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" required />
            </div>
            <div className="field">
              <label htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="staff-ref">Employee reference <span className="muted">(optional)</span></label>
              <input id="staff-ref" value={form.employeeRef} onChange={(event) => setForm({ ...form, employeeRef: event.target.value })} />
            </div>
          </div>
          {newMode === "selling_leader" ? (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="new-leader-manager">Reports to</label>
                <select id="new-leader-manager" value={newManagerId} onChange={(event) => setNewManagerId(event.target.value)}>
                  <option value="">Top level</option>
                  {staff.filter((person) => person.status === "active").map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </div>
              <div className="field">
                <span>Direct reports</span>
                {staff.filter((person) => person.status === "active").map((person) => (
                  <label className="check-row" key={person.id}>
                    <input type="checkbox" checked={newReportIds.includes(person.id)} onChange={(event) => setNewReportIds((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))} />
                    {person.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <button type="submit" disabled={busy}>{busy ? "Creating…" : newMode === "selling_leader" ? "Create selling Sales Leader" : "Create staff member"}</button>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="muted" style={{ padding: 22 }}>Loading…</div>
        ) : staff.length === 0 ? (
          <div className="empty-state">No staff identities yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Person</th><th>Access</th><th>Status</th><th className="right">Manage</th></tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div style={{ fontWeight: 650 }}>{member.name}</div>
                    <div className="small muted">{member.email} · {member.phone}</div>
                  </td>
                  <td>
                    <div className="chip-row">
                      {member.roles.length === 0 ? <span className="muted small">No role</span> : member.roles.map(({ role }) => (
                        <span className="pill" key={role.id}>{readableRole(role.name)}</span>
                      ))}
                    </div>
                  </td>
                  <td><span className={`pill status-${member.status}`}>{member.status}</span></td>
                  <td className="right"><Link className="text-action" to={`/staff/${member.id}`}>Manage access</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
