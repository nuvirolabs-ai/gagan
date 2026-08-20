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
      await api.createStaff({
        name: form.name,
        phone: form.phone,
        email: form.email,
        employeeRef: form.employeeRef.trim() || undefined,
      });
      setNotice(`${form.name} can now receive an assigned role.`);
      setForm({ name: "", phone: "", email: "", employeeRef: "" });
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
          <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create staff member"}</button>
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
