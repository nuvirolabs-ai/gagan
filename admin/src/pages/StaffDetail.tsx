import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { readableRole, type Role, type StaffMember } from "../staffTypes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function StaffDetail() {
  const { staffId = "" } = useParams();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState("");
  const [delegatorStaffId, setDelegatorStaffId] = useState("");
  const [delegatedRoleId, setDelegatedRoleId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const member = staff.find((item) => item.id === staffId);
  const delegator = staff.find((item) => item.id === delegatorStaffId);
  const delegatorRoleIds = useMemo(
    () => new Set(delegator?.roles.map(({ role }) => role.id) ?? []),
    [delegator]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [staffResponse, roleResponse] = await Promise.all([api.staff(), api.roles()]);
      setStaff(staffResponse.staff);
      setRoles(roleResponse.roles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff access");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [staffId]);

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setNotice(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update access");
    } finally {
      setBusy(false);
    }
  };

  const assignRole = (event: React.FormEvent) => {
    event.preventDefault();
    if (!roleId) return;
    void run(() => api.assignStaffRole(staffId, roleId), "Role assigned.");
  };

  const delegate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!delegatorStaffId || !delegatedRoleId || !startsAt || !endsAt) return;
    void run(
      () => api.createDelegation(staffId, {
        delegatorStaffId,
        roleId: delegatedRoleId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
      "Authority delegated for the selected period."
    );
  };

  if (loading) return <div className="muted">Loading…</div>;
  if (!member) return <div className="card"><p>Staff member not found.</p><Link to="/staff">Back to staff</Link></div>;

  const availableRoles = roles.filter((role) => !member.roles.some((assigned) => assigned.role.id === role.id));

  return (
    <div className="detail-narrow">
      <Link className="back-link" to="/staff">← Staff access</Link>
      <div className="between detail-heading">
        <div>
          <h1 className="page-title">{member.name}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>{member.email} · {member.phone}</p>
        </div>
        <span className={`pill status-${member.status}`}>{member.status}</span>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <section className="card">
        <div className="between">
          <div>
            <h2 className="section-title">Account access</h2>
            <p className="section-copy">Suspending access signs this person out on every device.</p>
          </div>
          {member.status === "active" ? (
            <button className="danger secondary" disabled={busy} onClick={() => void run(() => api.setStaffStatus(staffId, "suspended"), "Access suspended.")}>Suspend access</button>
          ) : (
            <button disabled={busy} onClick={() => void run(() => api.setStaffStatus(staffId, "active"), "Access restored.")}>Restore access</button>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Assigned roles</h2>
        <p className="section-copy">Roles bundle the permissions needed for a job.</p>
        <div className="role-list">
          {member.roles.length === 0 ? <p className="muted small">No role assigned.</p> : member.roles.map(({ role }) => (
            <div className="role-row" key={role.id}>
              <div><strong>{readableRole(role.name)}</strong><div className="small muted">{role.description}</div></div>
              <button className="ghost sm" disabled={busy} onClick={() => void run(() => api.removeStaffRole(staffId, role.id), "Role removed.")}>Remove</button>
            </div>
          ))}
        </div>
        {availableRoles.length > 0 && (
          <form className="inline-form" onSubmit={assignRole}>
            <div className="field grow">
              <label htmlFor="add-role">Add role</label>
              <select id="add-role" value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
                <option value="">Choose a role</option>
                {availableRoles.map((role) => <option key={role.id} value={role.id}>{readableRole(role.name)}</option>)}
              </select>
            </div>
            <button type="submit" disabled={busy || !roleId}>Assign role</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Temporary authority</h2>
        <p className="section-copy">Borrow a role from an active colleague for a fixed period. It expires automatically.</p>
        {member.delegationsHeld.length > 0 && <div className="role-list">
          {member.delegationsHeld.map((delegation) => (
            <div className="role-row" key={delegation.id}>
              <div>
                <strong>{readableRole(delegation.role.name)}</strong>
                <div className="small muted">From {delegation.delegator.name} · {formatDate(delegation.startsAt)} to {formatDate(delegation.endsAt)}</div>
              </div>
              <button className="ghost sm" disabled={busy} onClick={() => void run(() => api.revokeDelegation(delegation.id), "Delegation ended.")}>End</button>
            </div>
          ))}
        </div>}
        <form className="delegation-form" onSubmit={delegate}>
          <div className="field">
            <label htmlFor="delegator">Authority owner</label>
            <select id="delegator" value={delegatorStaffId} onChange={(event) => { setDelegatorStaffId(event.target.value); setDelegatedRoleId(""); }} required>
              <option value="">Choose a colleague</option>
              {staff.filter((item) => item.id !== staffId && item.status === "active" && item.roles.length > 0).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="delegated-role">Delegated role</label>
            <select id="delegated-role" value={delegatedRoleId} onChange={(event) => setDelegatedRoleId(event.target.value)} required>
              <option value="">Choose a role</option>
              {roles.filter((role) => delegatorRoleIds.has(role.id)).map((role) => <option key={role.id} value={role.id}>{readableRole(role.name)}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="starts-at">Starts</label><input id="starts-at" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></div>
          <div className="field"><label htmlFor="ends-at">Ends</label><input id="ends-at" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></div>
          <button type="submit" disabled={busy || !delegatorStaffId || !delegatedRoleId}>Delegate authority</button>
        </form>
      </section>
    </div>
  );
}
