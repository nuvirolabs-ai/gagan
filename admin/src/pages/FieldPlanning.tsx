import { useEffect, useState } from "react";
import { api } from "../api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Route and task planning for the field team.
 *
 * A route plan only schedules retailers already assigned to that salesperson —
 * the server rejects anything else — so this screen never becomes a second
 * customer-assignment system.
 */
export default function FieldPlanning() {
  const [tab, setTab] = useState<"routes" | "tasks" | "targets">("routes");
  const [staff, setStaff] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [planDate, setPlanDate] = useState(today());
  const [planSalesperson, setPlanSalesperson] = useState("");
  const [planName, setPlanName] = useState("");
  const [planStops, setPlanStops] = useState<string[]>([]);

  const [taskForm, setTaskForm] = useState({
    assignedToStaffId: "",
    title: "",
    description: "",
    retailerId: "",
    priority: "normal",
    dueAt: "",
  });

  const [targetForm, setTargetForm] = useState({
    salespersonId: "",
    metric: "order_value",
    targetValue: "",
  });

  const load = async () => {
    try {
      const [staffResult, retailerResult, planResult, taskResult, targetResult] = await Promise.all([
        api.staff(),
        api.retailers(),
        api.routePlans({ from: today(), to: today() }),
        api.fieldTasks(),
        api.salesTargets(),
      ]);
      // Only staff linked to a sales rep can run a field day.
      setStaff((staffResult.staff ?? []).filter((member: any) => member.salesRepId));
      setRetailers(retailerResult.retailers ?? []);
      setPlans(planResult.plans ?? []);
      setTasks(taskResult.tasks ?? []);
      setTargets(targetResult.targets ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load field planning");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleStop = (retailerId: string) =>
    setPlanStops((current) =>
      current.includes(retailerId)
        ? current.filter((id) => id !== retailerId)
        : [...current, retailerId]
    );

  const savePlan = async (publish: boolean) => {
    if (!planSalesperson || planStops.length === 0) {
      setError("Pick a salesperson and at least one store.");
      return;
    }
    try {
      const result = await api.saveRoutePlan({
        salespersonId: planSalesperson,
        planDate: new Date(`${planDate}T00:00:00.000Z`).toISOString(),
        name: planName.trim() || undefined,
        stops: planStops.map((retailerId) => ({ retailerId })),
      });
      if (publish) await api.publishRoutePlan(result.plan.id);
      setMessage(publish ? "Route published to the salesperson." : "Route saved as a draft.");
      setError(null);
      setPlanStops([]);
      setPlanName("");
      await load();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Could not save the route");
    }
  };

  const assignTask = async () => {
    if (!taskForm.assignedToStaffId || taskForm.title.trim().length < 3) {
      setError("Pick a salesperson and give the task a title.");
      return;
    }
    try {
      await api.assignFieldTask({
        assignedToStaffId: taskForm.assignedToStaffId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        retailerId: taskForm.retailerId || undefined,
        priority: taskForm.priority,
        dueAt: taskForm.dueAt ? new Date(`${taskForm.dueAt}T18:00:00.000Z`).toISOString() : undefined,
      });
      setTaskForm({ ...taskForm, title: "", description: "", retailerId: "", dueAt: "" });
      setMessage("Task assigned. It appears on that salesperson's Today screen.");
      setError(null);
      await load();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Could not assign the task");
    }
  };

  const saveTarget = async () => {
    const value = Number(targetForm.targetValue);
    if (!targetForm.salespersonId || !Number.isFinite(value) || value <= 0) {
      setError("Pick a salesperson and enter a positive target.");
      return;
    }
    const now = new Date();
    try {
      await api.setSalesTarget({
        salespersonId: targetForm.salespersonId,
        metric: targetForm.metric,
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
        periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString(),
        targetValue: value,
      });
      setTargetForm({ ...targetForm, targetValue: "" });
      setMessage("Target saved for this month.");
      setError(null);
      await load();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Could not save the target");
    }
  };

  return (
    <div>
      <h1 className="page-title">Routes &amp; tasks</h1>
      <p className="page-sub">
        Plan the field day. Stores must already be assigned to the salesperson — planning a route
        never changes who owns a customer.
      </p>
      {error && <div className="banner error">{error}</div>}
      {message && <div className="banner">{message}</div>}

      <div className="tabs">
        <button className={`tab ${tab === "routes" ? "active" : ""}`} onClick={() => setTab("routes")}>
          Routes
        </button>
        <button className={`tab ${tab === "tasks" ? "active" : ""}`} onClick={() => setTab("tasks")}>
          Tasks
        </button>
        <button className={`tab ${tab === "targets" ? "active" : ""}`} onClick={() => setTab("targets")}>
          Targets
        </button>
      </div>

      {tab === "routes" ? (
        <>
          <div className="card">
            <h2 className="section-title">Plan a route</h2>
            <div className="form-grid">
              <div className="field">
                <label>Salesperson</label>
                <select
                  value={planSalesperson}
                  onChange={(event) => setPlanSalesperson(event.target.value)}
                >
                  <option value="">Select…</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={planDate}
                  onChange={(event) => setPlanDate(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Route name</label>
                <input
                  value={planName}
                  onChange={(event) => setPlanName(event.target.value)}
                  placeholder="Kothrud & Baner beat"
                />
              </div>
            </div>

            <h3 className="section-title" style={{ marginTop: 16 }}>
              Stops in visit order ({planStops.length} selected)
            </h3>
            <div className="chip-row">
              {retailers.map((retailer: any) => {
                const index = planStops.indexOf(retailer.id);
                return (
                  <button
                    key={retailer.id}
                    className={index >= 0 ? "" : "secondary"}
                    onClick={() => toggleStop(retailer.id)}
                  >
                    {index >= 0 ? `${index + 1}. ` : ""}
                    {retailer.name}
                  </button>
                );
              })}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="secondary" onClick={() => void savePlan(false)}>
                Save draft
              </button>
              <button onClick={() => void savePlan(true)}>Save &amp; publish</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {plans.length === 0 ? (
              <div className="empty-state">No routes planned for today.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Salesperson</th>
                    <th>Route</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Stops</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan: any) => {
                    const visited = plan.stops.filter((stop: any) => stop.status === "visited").length;
                    return (
                      <tr key={plan.id}>
                        <td>{plan.salesperson?.name ?? plan.salespersonId}</td>
                        <td>{plan.name ?? "—"}</td>
                        <td>{new Date(plan.planDate).toLocaleDateString("en-IN")}</td>
                        <td>
                          <span className={`pill ${plan.status === "published" ? "confirmed" : "placed"}`}>
                            {plan.status}
                          </span>
                          {plan.status === "draft" ? (
                            <button
                              className="sm"
                              style={{ marginLeft: 8 }}
                              onClick={async () => {
                                await api.publishRoutePlan(plan.id);
                                await load();
                              }}
                            >
                              Publish
                            </button>
                          ) : null}
                        </td>
                        <td className="small">
                          {visited}/{plan.stops.length} visited ·{" "}
                          {plan.stops.map((stop: any) => stop.retailer?.name).join(", ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : tab === "tasks" ? (
        <>
          <div className="card">
            <h2 className="section-title">Assign a task</h2>
            <div className="form-grid">
              <div className="field">
                <label>Salesperson</label>
                <select
                  value={taskForm.assignedToStaffId}
                  onChange={(event) =>
                    setTaskForm({ ...taskForm, assignedToStaffId: event.target.value })
                  }
                >
                  <option value="">Select…</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Title</label>
                <input
                  value={taskForm.title}
                  onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                  placeholder="Collect the signed delivery note"
                />
              </div>
              <div className="field">
                <label>Customer (optional)</label>
                <select
                  value={taskForm.retailerId}
                  onChange={(event) => setTaskForm({ ...taskForm, retailerId: event.target.value })}
                >
                  <option value="">None</option>
                  {retailers.map((retailer: any) => (
                    <option key={retailer.id} value={retailer.id}>
                      {retailer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Priority</label>
                <select
                  value={taskForm.priority}
                  onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="field">
                <label>Due date</label>
                <input
                  type="date"
                  value={taskForm.dueAt}
                  onChange={(event) => setTaskForm({ ...taskForm, dueAt: event.target.value })}
                />
              </div>
            </div>
            <button onClick={() => void assignTask()}>Assign task</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {tasks.length === 0 ? (
              <div className="empty-state">No tasks assigned.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Salesperson</th>
                    <th>Customer</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task: any) => (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.assignedTo?.name ?? task.assignedToStaffId}</td>
                      <td>{task.retailer?.name ?? "—"}</td>
                      <td>{task.priority}</td>
                      <td>{task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-IN") : "—"}</td>
                      <td>
                        <span className={`pill ${task.status === "done" ? "confirmed" : "placed"}`}>
                          {task.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        {task.status === "open" || task.status === "in_progress" ? (
                          <button
                            className="sm ghost"
                            onClick={async () => {
                              await api.cancelFieldTask(task.id);
                              await load();
                            }}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h2 className="section-title">Set a target for this month</h2>
            <p className="section-copy">
              The salesperson's app only shows target-versus-achievement for metrics that have a
              stored target. Nothing is inferred.
            </p>
            <div className="form-grid">
              <div className="field">
                <label>Salesperson</label>
                <select
                  value={targetForm.salespersonId}
                  onChange={(event) =>
                    setTargetForm({ ...targetForm, salespersonId: event.target.value })
                  }
                >
                  <option value="">Select…</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Metric</label>
                <select
                  value={targetForm.metric}
                  onChange={(event) => setTargetForm({ ...targetForm, metric: event.target.value })}
                >
                  <option value="order_value">Order value</option>
                  <option value="visits">Visits</option>
                  <option value="collection_value">Collections</option>
                  <option value="new_customers">New customers</option>
                </select>
              </div>
              <div className="field">
                <label>Target</label>
                <input
                  value={targetForm.targetValue}
                  onChange={(event) =>
                    setTargetForm({ ...targetForm, targetValue: event.target.value })
                  }
                  placeholder="400000"
                />
              </div>
            </div>
            <button onClick={() => void saveTarget()}>Save target</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {targets.length === 0 ? (
              <div className="empty-state">No targets set.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Salesperson</th>
                    <th>Metric</th>
                    <th>Period</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target: any) => (
                    <tr key={target.id}>
                      <td>{target.salesperson?.name ?? target.salespersonId}</td>
                      <td>{target.metric.replace("_", " ")}</td>
                      <td>
                        {new Date(target.periodStart).toLocaleDateString("en-IN")} –{" "}
                        {new Date(target.periodEnd).toLocaleDateString("en-IN")}
                      </td>
                      <td>{target.targetValue.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
