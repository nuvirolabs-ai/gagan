import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { readableRole, type Role, type StaffMember } from "../staffTypes";
import { explain } from "../errorCopy";
import { AuthContext } from "../auth-context";
import ExpenseClaims from "../components/ExpenseClaims";

type CollectionAssignment = {
  id: string;
  retailer: { id: string; name: string; phone: string; shopAddress?: string };
};

type CollectionRetailer = { id: string; name: string; phone: string };

function staffMemberHasPermission(member: StaffMember | undefined, roleCatalog: Role[], permissionName: string) {
  return member?.roles.some(({ role }) => roleCatalog.some((catalogRole) =>
    catalogRole.id === role.id
    && catalogRole.permissions.some(({ permission }) => permission.name === permissionName)
  )) ?? false;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function StaffDetail() {
  const { staffId = "" } = useParams();
  const auth = useContext(AuthContext);
  const canManageOrg = auth?.permissions.includes("org.manage") ?? false;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState("");
  const [delegatorStaffId, setDelegatorStaffId] = useState("");
  const [delegatedRoleId, setDelegatedRoleId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [collectionAssignments, setCollectionAssignments] = useState<CollectionAssignment[]>([]);
  const [collectionRetailers, setCollectionRetailers] = useState<CollectionRetailer[]>([]);
  const [collectionRetailerId, setCollectionRetailerId] = useState("");
  const [retailerSearch, setRetailerSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [leaderManagerId, setLeaderManagerId] = useState("");
  const [setupResult, setSetupResult] = useState<any | null>(null);

  const member = staff.find((item) => item.id === staffId);
  const canCollect = staffMemberHasPermission(member, roles, "collection.submit");
  const delegator = staff.find((item) => item.id === delegatorStaffId);
  const delegatorRoleIds = useMemo(
    () => new Set(delegator?.roles.map(({ role }) => role.id) ?? []),
    [delegator]
  );

  const load = useCallback(async (retailerQuery = "") => {
    setLoading(true);
    try {
      const [staffResponse, roleResponse] = await Promise.all([api.staff(), api.roles()]);
      const currentMember = staffResponse.staff.find((item: StaffMember) => item.id === staffId);
      setStaff(staffResponse.staff);
      setRoles(roleResponse.roles);
      const mayCollect = staffMemberHasPermission(currentMember, roleResponse.roles, "collection.submit");
      if (currentMember) {
        const assignmentResponse = await api.collectionAssignments(staffId);
        setCollectionAssignments(assignmentResponse.assignments);
        if (mayCollect && currentMember.status === "active") {
          const retailerResponse = await api.collectionAssignmentRetailers(staffId, retailerQuery);
          setCollectionRetailers(retailerResponse.retailers);
        } else {
          setCollectionRetailers([]);
        }
      } else {
        setCollectionAssignments([]);
        setCollectionRetailers([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff access");
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setNotice(success);
      await load(retailerSearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update access");
    } finally {
      setBusy(false);
    }
  };

  const assignRole = (event: React.FormEvent) => {
    event.preventDefault();
    if (!roleId) return;
    const name = roles.find((role) => role.id === roleId)?.name;
    if (name === "salesperson" && !member?.salesRepId && !member?.roles.some(({ role }) => role.name === "field_manager")) {
      setError("Use Set up salesperson below to link the sales identity and role together.");
      return;
    }
    if (name === "field_manager" || (name === "salesperson" && member?.roles.some(({ role }) => role.name === "field_manager"))) {
      setError("Use the Selling Sales Leader or Manager only setup below for this role change.");
      return;
    }
    void run(() => api.assignStaffRole(staffId, roleId), "Role assigned.");
  };

  const setupSellingLeader = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.setupSellingLeader(staffId, {
        ...(canManageOrg && leaderManagerId ? { managerId: leaderManagerId === "__root__" ? null : leaderManagerId } : {}),
        ...(canManageOrg && selectedReports.length ? { reportIds: selectedReports } : {}),
      });
      setSetupResult(result);
      setNotice("Selling Sales Leader setup completed.");
      setSelectedReports([]);
      await load(retailerSearch);
    } catch (err) {
      setNotice(null);
      setError(explain(err, "Could not complete Selling Sales Leader setup"));
    } finally { setBusy(false); }
  };

  const setupSalesperson = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.setupSalesperson(staffId, {
        ...(canManageOrg && leaderManagerId ? { managerId: leaderManagerId === "__root__" ? null : leaderManagerId } : {}),
      });
      setSetupResult(result);
      setNotice("Salesperson setup completed.");
      await load(retailerSearch);
    } catch (err) {
      setNotice(null);
      setError(explain(err, "Could not complete salesperson setup"));
    } finally { setBusy(false); }
  };

  const assignCollectionRetailer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!collectionRetailerId) return;
    void run(() => api.assignCollectionRetailer(staffId, collectionRetailerId), "Retailer collection access assigned.");
  };

  const searchCollectionRetailers = (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    void api.collectionAssignmentRetailers(staffId, retailerSearch)
      .then((response) => {
        setCollectionRetailers(response.retailers);
        setCollectionRetailerId("");
        setNotice("Retailer list updated.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not search retailers"))
      .finally(() => setBusy(false));
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

      {auth?.permissions.includes("expense.review") ? <ExpenseClaims salespersonId={staffId} /> : null}

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
        <h2 className="section-title">Sales leadership</h2>
        {member.roles.some(({ role }) => role.name === "salesperson") && !member.salesRepId ? (
          <p className="banner error">Salesperson identity needs setup before personal work can open.</p>
        ) : null}
        <p className="small muted">SalesRep link: {member.salesRepId ?? "Not linked"}</p>
        <p className="small muted">Current direct reports: {member.directReports?.map((report) => report.name).join(", ") || "None"}</p>
        {canManageOrg ? <div className="field">
          <label htmlFor="leader-manager">Reports to</label>
          <select id="leader-manager" value={leaderManagerId} onChange={(event) => setLeaderManagerId(event.target.value)}>
            <option value="">Keep current reporting line</option>
            <option value="__root__">Top level</option>
            {staff.filter((item) => item.id !== staffId && item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div> : null}
        {canManageOrg ? <div className="field">
          <span>Direct reports to confirm</span>
          {staff.filter((item) => item.id !== staffId && item.status === "active").map((item) => (
            <label key={item.id} className="check-row">
              <input
                type="checkbox"
                aria-label={`${item.name} reports to ${member.name}`}
                checked={selectedReports.includes(item.id)}
                onChange={(event) => setSelectedReports((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
              />
              {item.name}{item.managerId === staffId ? " (already reports here)" : ""}
            </label>
          ))}
        </div> : null}
        <div className="inline-form">
          {!member.salesRepId && !member.roles.some(({ role }) => role.name === "field_manager") ? <button disabled={busy || member.status !== "active"} onClick={() => void setupSalesperson()}>Set up salesperson</button> : null}
          <button disabled={busy || member.status !== "active"} onClick={() => void setupSellingLeader()}>Set up selling Sales Leader</button>
          <button className="secondary" disabled={busy || member.status !== "active"} onClick={() => void run(() => api.setupManagerOnly(staffId), "Manager-only setup completed.")}>Set up manager only</button>
        </div>
        {setupResult ? <p className="small muted">Verified link: {setupResult.staff?.salesRepId ?? "none"} · Roles: {setupResult.roles?.join(", ")}</p> : null}
      </section>

      <section className="card">
        <h2 className="section-title">Collection rights</h2>
        <p className="section-copy">Collection requires the Field Collector role and an active retailer assignment.</p>
        <div className="role-list">
          {collectionAssignments.length === 0 ? <p className="muted small">No retailers assigned for collection.</p> : collectionAssignments.map(({ id, retailer }) => (
            <div className="role-row" key={id}>
              <div><strong>{retailer.name}</strong><div className="small muted">{retailer.phone}{retailer.shopAddress ? ` · ${retailer.shopAddress}` : ""}</div></div>
              <button className="ghost sm" disabled={busy} onClick={() => void run(() => api.unassignCollectionRetailer(id), `Collection access removed for ${retailer.name}.`)} aria-label={`Remove ${retailer.name}`} title={`Remove ${retailer.name}`}>Remove</button>
            </div>
          ))}
        </div>
        {!canCollect ? <p className="muted small">Assign the Field Collector role above to enable new collection access.</p> : member.status !== "active" ? <p className="muted small">Restore this staff account before assigning retailers.</p> : <>
          <form className="inline-form" onSubmit={searchCollectionRetailers}>
            <div className="field grow">
              <label htmlFor="collection-retailer-search">Search retailers</label>
              <input id="collection-retailer-search" type="search" value={retailerSearch} onChange={(event) => setRetailerSearch(event.target.value)} placeholder="Name or phone" />
            </div>
            <button type="submit" className="secondary" disabled={busy}>Search</button>
          </form>
          <form className="inline-form" onSubmit={assignCollectionRetailer}>
            <div className="field grow">
              <label htmlFor="collection-retailer">Retailer to assign</label>
              <select id="collection-retailer" value={collectionRetailerId} onChange={(event) => setCollectionRetailerId(event.target.value)} required>
                <option value="">Choose a retailer</option>
                {collectionRetailers.map((retailer) => <option key={retailer.id} value={retailer.id}>{retailer.name} · {retailer.phone}</option>)}
              </select>
            </div>
            <button type="submit" disabled={busy || !collectionRetailerId}>Assign retailer</button>
          </form>
        </>}
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
