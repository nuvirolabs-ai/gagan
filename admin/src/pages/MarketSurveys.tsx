import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

type QuestionType = "single_choice" | "multiple_choice" | "yes_no" | "rating" | "number" | "text" | "photo";
type Audience = "all_retailers" | "selected_retailers" | "all_salespersons" | "selected_salespersons";
type QuestionDraft = {
  prompt: string;
  type: QuestionType;
  required: boolean;
  minValue?: number;
  maxValue?: number;
  maxLength?: number;
  options: Array<{ label: string; value?: string }>;
};
type SurveyDraft = {
  title: string;
  description: string;
  audience: Audience;
  startsAt: string;
  endsAt: string;
  retailerIds: string[];
  salespersonIds: string[];
  questions: QuestionDraft[];
};

const EMPTY_QUESTION: QuestionDraft = { prompt: "", type: "text", required: true, options: [] };
const EMPTY_DRAFT: SurveyDraft = {
  title: "",
  description: "",
  audience: "all_retailers",
  startsAt: "",
  endsAt: "",
  retailerIds: [],
  salespersonIds: [],
  questions: [{ ...EMPTY_QUESTION }],
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  yes_no: "Yes / No",
  rating: "Rating",
  number: "Number",
  text: "Short text",
  photo: "Photo Required (Board/Shelf Audit)",
};

function draftFromSurvey(survey: any): SurveyDraft {
  return {
    title: survey.title,
    description: survey.description ?? "",
    audience: survey.audience,
    startsAt: survey.startsAt ? String(survey.startsAt).slice(0, 16) : "",
    endsAt: survey.endsAt ? String(survey.endsAt).slice(0, 16) : "",
    retailerIds: (survey.assignments ?? []).map((item: any) => item.retailerId).filter(Boolean),
    salespersonIds: (survey.assignments ?? []).map((item: any) => item.salespersonId).filter(Boolean),
    questions: (survey.questions ?? []).map((question: any) => ({
      prompt: question.prompt,
      type: question.type,
      required: question.required,
      minValue: question.minValue ?? undefined,
      maxValue: question.maxValue ?? undefined,
      maxLength: question.maxLength ?? undefined,
      options: (question.options ?? []).map((option: any) => ({ label: option.label, value: option.value ?? undefined })),
    })),
  };
}

function toPayload(draft: SurveyDraft) {
  return {
    ...draft,
    description: draft.description.trim() || undefined,
    startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : undefined,
    endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : undefined,
    retailerIds: draft.retailerIds,
    salespersonIds: draft.salespersonIds,
    questions: draft.questions.map((question) => ({
      ...question,
      minValue: question.type === "rating" || question.type === "number" ? question.minValue : undefined,
      maxValue: question.type === "rating" || question.type === "number" ? question.maxValue : undefined,
      maxLength: question.type === "text" ? question.maxLength : undefined,
      options: ["single_choice", "multiple_choice"].includes(question.type) ? question.options : [],
    })),
  };
}

export default function MarketSurveys() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Gap 15: Field Tasks & Geotagged Evidence State
  const [activePageTab, setActivePageTab] = useState<"surveys" | "tasks">("surveys");
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState("");
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [selectedTaskEvidence, setSelectedTaskEvidence] = useState<any | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignedToStaffId: "",
    retailerId: "",
    priority: "normal",
    dueAt: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [surveyResult, retailerResult, staffResult] = await Promise.all([api.surveys(filter || undefined), api.retailers(), api.staff()]);
      setSurveys(surveyResult.surveys ?? []);
      setRetailers(retailerResult.retailers ?? retailerResult ?? []);
      const staffRows = staffResult.staff ?? staffResult ?? [];
      setStaff(staffRows.filter((person: any) => person.salesRepId || person.salesRep));
      setError(null);
    } catch (err) { setError(explain(err, "Could not load market surveys")); }
    finally { setLoading(false); }
  }, [filter]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await api.fieldTasksList(taskStatusFilter || undefined);
      setTasks(res.tasks ?? []);
    } catch (err) {
      setError(explain(err, "Could not load field tasks"));
    } finally {
      setTasksLoading(false);
    }
  }, [taskStatusFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (activePageTab === "tasks") {
      void loadTasks();
    }
  }, [activePageTab, loadTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.assignedToStaffId) {
      setError("Please select an assigned salesperson");
      return;
    }
    try {
      await api.createFieldTask({
        ...taskForm,
        dueAt: new Date(taskForm.dueAt).toISOString(),
      });
      setMessage("✅ Field task assigned successfully!");
      setShowCreateTaskModal(false);
      setTaskForm({
        title: "",
        description: "",
        assignedToStaffId: "",
        retailerId: "",
        priority: "normal",
        dueAt: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
      });
      await loadTasks();
    } catch (err) {
      setError(explain(err, "Could not create field task"));
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!window.confirm("Cancel this field task?")) return;
    try {
      await api.cancelFieldTask(taskId);
      setMessage("Task cancelled.");
      await loadTasks();
    } catch (err) {
      setError(explain(err, "Could not cancel field task"));
    }
  };

  const open = async (id: string) => {
    try {
      const result = await api.survey(id);
      setSelected(result.survey);
      setDraft(result.survey.status === "draft" ? draftFromSurvey(result.survey) : null);
      const [responseResult, summaryResult] = await Promise.all([api.surveyResponses(id), api.surveySummary(id)]);
      setResponses(responseResult.responses ?? []);
      setSummary(summaryResult.summary ?? null);
      setError(null);
    } catch (err) { setError(explain(err, "Could not load the survey")); }
  };

  const newSurvey = () => {
    setSelected(null);
    setDraft({ ...EMPTY_DRAFT, questions: [{ ...EMPTY_QUESTION }] });
    setResponses([]);
    setSummary(null);
    setMessage(null);
  };

  const save = async () => {
    if (!draft) return;
    try {
      const result = selected ? await api.updateSurvey(selected.id, toPayload(draft)) : await api.createSurvey(toPayload(draft));
      setMessage(selected ? "Draft updated." : "Draft created. Review it, then activate when ready.");
      await load();
      await open(result.survey.id);
    } catch (err) { setError(explain(err, "Could not save the survey")); }
  };

  const transition = async (action: "activate" | "close") => {
    if (!selected) return;
    try {
      const result = action === "activate" ? await api.activateSurvey(selected.id) : await api.closeSurvey(selected.id);
      setSelected(result.survey);
      setDraft(null);
      setMessage(action === "activate" ? "Survey is live for its assigned audience." : "Survey closed. Responses remain available for review.");
      await load();
    } catch (err) { setError(explain(err, `Could not ${action} the survey`)); }
  };

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => setDraft((current) => current && ({ ...current, questions: current.questions.map((question, i) => i === index ? { ...question, ...patch, options: patch.options ?? (patch.type && !["single_choice", "multiple_choice"].includes(patch.type) ? [] : question.options) } : question) }));
  const addQuestion = () => setDraft((current) => current && ({ ...current, questions: [...current.questions, { ...EMPTY_QUESTION }] }));
  const removeQuestion = (index: number) => setDraft((current) => current && ({ ...current, questions: current.questions.filter((_, i) => i !== index) }));
  const moveQuestion = (index: number, direction: -1 | 1) => setDraft((current) => {
    if (!current) return current;
    const target = index + direction;
    if (target < 0 || target >= current.questions.length) return current;
    const questions = [...current.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    return { ...current, questions };
  });

  const toggleAssignment = (field: "retailerIds" | "salespersonIds", id: string) => setDraft((current) => {
    if (!current) return current;
    const ids = current[field];
    return { ...current, [field]: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] };
  });

  const assignmentGroup = (title: string, people: any[], field: "retailerIds" | "salespersonIds") => {
    if (!draft) return null;
    return <div className="assignment-box"><div className="section-kicker">{title}</div><div className="assignment-grid">{people.length === 0 ? <div className="empty-state">No eligible users loaded.</div> : people.map((person: any) => { const id = person.id; const active = draft[field].includes(id); return <label key={id} className="check-row"><input type="checkbox" checked={active} onChange={() => toggleAssignment(field, id)} /><span>{person.name ?? person.businessName ?? id}<small>{person.phone ?? person.email ?? ""}</small></span></label>; })}</div></div>;
  };

  return (
    <div>
      <div className="between">
        <div>
          <h1 className="page-title">Market surveys</h1>
          <p className="page-sub">Create identified field questions, publish them to a controlled audience, and review the answers in one place.</p>
        </div>
        <button onClick={newSurvey}>New survey</button>
      </div>
      {error && <div className="banner error">{error}</div>}
      {message && <div className="banner success">{message}</div>}

      {/* Top Level Tab Switcher */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid #e5e7eb", paddingBottom: 12, marginBottom: 16 }}>
        <button
          type="button"
          className={`button ${activePageTab === "surveys" ? "primary" : "secondary"}`}
          style={{
            fontWeight: 700,
            borderRadius: 8,
            padding: "8px 16px",
            background: activePageTab === "surveys" ? "#165a31" : "#f3f4f6",
            color: activePageTab === "surveys" ? "#ffffff" : "#374151",
            borderColor: activePageTab === "surveys" ? "#165a31" : "#d1d5db",
          }}
          onClick={() => setActivePageTab("surveys")}
        >
          📋 Market Surveys & Form Builder
        </button>
        <button
          type="button"
          className={`button ${activePageTab === "tasks" ? "primary" : "secondary"}`}
          style={{
            fontWeight: 700,
            borderRadius: 8,
            padding: "8px 16px",
            background: activePageTab === "tasks" ? "#165a31" : "#f3f4f6",
            color: activePageTab === "tasks" ? "#ffffff" : "#374151",
            borderColor: activePageTab === "tasks" ? "#165a31" : "#d1d5db",
          }}
          onClick={() => {
            setActivePageTab("tasks");
            void loadTasks();
          }}
        >
          📍 Field Tasks & Geotagged Evidence (Gap 15)
        </button>
      </div>

      {activePageTab === "surveys" && (
        <>
          <div className="tabs">
            {["", "draft", "active", "closed"].map((value) => <button key={value || "all"} className={`tab ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{value ? value[0].toUpperCase() + value.slice(1) : "All"}</button>)}
          </div>

          <div className="survey-layout">
            <div className="card survey-list">
              {loading ? <div className="empty-state">Loading surveys…</div> : surveys.length === 0 ? <div className="empty-state">No surveys yet. Start with a short store question.</div> : surveys.map((survey) => (
                <button key={survey.id} className={`survey-list-row ${selected?.id === survey.id ? "selected" : ""}`} onClick={() => void open(survey.id)}>
                  <span><strong>{survey.title}</strong><small>{survey.audience.replaceAll("_", " ")} · {survey.responseCount ?? 0} responses</small></span>
                  <span className={`pill ${survey.status === "active" ? "confirmed" : survey.status === "closed" ? "out_for_delivery" : "placed"}`}>{survey.status}</span>
                </button>
              ))}
            </div>

            <div className="survey-workspace">
              {draft ? (
                <div className="card">
                  <div className="between"><div><div className="eyebrow">Survey builder</div><h2>{selected ? "Edit draft" : "New market survey"}</h2></div><span className="small muted">Answers are identified</span></div>
                  <div className="form-grid">
                    <div className="field"><label>Title</label><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Store pulse — September" /></div>
                    <div className="field"><label>Audience</label><select value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as Audience, retailerIds: [], salespersonIds: [] })}><option value="all_retailers">All retailers</option><option value="selected_retailers">Selected retailers</option><option value="all_salespersons">All salespeople</option><option value="selected_salespersons">Selected salespeople</option></select></div>
                  </div>
                  <div className="form-grid">
                    <div className="field"><label>Start (optional)</label><input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /></div>
                    <div className="field"><label>End (optional)</label><input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /></div>
                  </div>
                  <div className="field"><label>Context for the field team (optional)</label><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} placeholder="A short reason helps respondents answer well." /></div>

                  {draft.audience.startsWith("selected_") ? <>{draft.audience === "selected_retailers" ? assignmentGroup("Selected retailers", retailers, "retailerIds") : assignmentGroup("Selected salespeople", staff, "salespersonIds")}{draft.audience === "selected_retailers" ? assignmentGroup("Also include selected salespeople (optional)", staff, "salespersonIds") : assignmentGroup("Also include selected retailers (optional)", retailers, "retailerIds")}</> : null}

                  <div className="section-kicker">Questions</div>
                  {draft.questions.map((question, index) => <div className="question-builder" key={index}><div className="between"><strong>Question {index + 1}</strong><div className="row"><button className="sm secondary" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>↑</button><button className="sm secondary" disabled={index === draft.questions.length - 1} onClick={() => moveQuestion(index, 1)}>↓</button><button className="sm danger" disabled={draft.questions.length === 1} onClick={() => removeQuestion(index)}>Remove</button></div></div><div className="form-grid"><div className="field"><label>Prompt</label><input value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="What is moving fastest this week?" /></div><div className="field"><label>Type</label><select value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value as QuestionType })}>{Object.entries(TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></div></div><label className="check-row inline-check"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} />Required answer</label>{question.type === "photo" && <div style={{ margin: "6px 0 10px", padding: "6px 10px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", fontSize: 12 }}>📷 <strong>Camera Audit:</strong> Salesperson must capture a live geotagged photo before answering.</div>}{["single_choice", "multiple_choice"].includes(question.type) ? <div className="option-editor">{question.options.map((option, optionIndex) => <div className="row" key={optionIndex}><input value={option.label} onChange={(event) => updateQuestion(index, { options: question.options.map((item, i) => i === optionIndex ? { ...item, label: event.target.value } : item) })} placeholder={`Option ${optionIndex + 1}`} /><button className="sm danger" onClick={() => updateQuestion(index, { options: question.options.filter((_, i) => i !== optionIndex) })}>×</button></div>)}<button className="sm secondary" onClick={() => updateQuestion(index, { options: [...question.options, { label: "" }] })}>Add option</button></div> : null}{["rating", "number"].includes(question.type) ? <div className="form-grid"><div className="field"><label>Minimum (optional)</label><input type="number" value={question.minValue ?? ""} onChange={(event) => updateQuestion(index, { minValue: event.target.value === "" ? undefined : Number(event.target.value) })} /></div><div className="field"><label>Maximum (optional)</label><input type="number" value={question.maxValue ?? ""} onChange={(event) => updateQuestion(index, { maxValue: event.target.value === "" ? undefined : Number(event.target.value) })} /></div></div> : null}{question.type === "text" ? <div className="field"><label>Maximum characters (optional)</label><input type="number" value={question.maxLength ?? ""} onChange={(event) => updateQuestion(index, { maxLength: event.target.value === "" ? undefined : Number(event.target.value) })} /></div> : null}</div>)}
                  <div className="row" style={{ marginTop: 12 }}><button className="secondary" onClick={addQuestion}>Add question</button>{selected ? <button className="secondary" onClick={() => setDraft(null)}>Review draft</button> : null}<button onClick={() => void save()}>Save draft</button></div>
                </div>
              ) : selected ? (
                <div className="card"><div className="between"><div><div className="eyebrow">{selected.status}</div><h2>{selected.title}</h2><p className="muted">{selected.description || "No description"}</p></div><div className="row">{selected.status === "draft" ? <button onClick={() => setDraft(draftFromSurvey(selected))}>Edit</button> : null}{selected.status === "draft" ? <button onClick={() => void transition("activate")}>Activate</button> : null}{selected.status === "active" ? <button className="secondary" onClick={() => void transition("close")}>Close survey</button> : null}</div></div><div className="survey-preview">{selected.questions.map((question: any, index: number) => <div className="preview-question" key={question.id}><strong>{index + 1}. {question.prompt}</strong><span>{TYPE_LABELS[question.type as QuestionType]}{question.required ? " · required" : ""}</span></div>)}</div></div>
              ) : <div className="card empty-state">Select a survey to review it, or create a new draft.</div>}

              {selected && selected.status !== "draft" ? <><div className="card"><div className="between"><div><div className="eyebrow">Response analytics</div><h2>{summary?.responseCount ?? responses.length} responses</h2></div><span className="small muted">Computed from submitted answers</span></div>{summary?.questions?.map((item: any) => <div key={item.questionId} className="summary-row"><strong>{item.prompt}</strong>{item.answers ? item.answers.map((answer: any) => <span key={answer.optionId}>{answer.label}: {answer.count}</span>) : <span>{item.answered} answered{item.average != null ? ` · average ${Number(item.average).toFixed(1)}` : ""}</span>}</div>)}</div><div className="card" style={{ padding: 0 }}><div className="section-kicker" style={{ padding: "16px 16px 0" }}>Submitted responses</div>{responses.length === 0 ? <div className="empty-state">No responses yet.</div> : <table><thead><tr><th>Respondent</th><th>Context</th><th>Submitted</th><th>Answers</th></tr></thead><tbody>{responses.map((response) => <tr key={response.id}><td>{response.respondentStaff?.name ?? response.respondentRetailer?.name ?? response.respondentType}</td><td>{response.contextRetailer?.name ?? "—"}</td><td className="small">{new Date(response.submittedAt).toLocaleString()}</td><td className="small">{response.answers.map((answer: any) => `${answer.prompt}: ${answer.value ?? answer.options.map((option: any) => option.label).join(", ")}`).join(" · ")}</td></tr>)}</tbody></table>}</div></> : null}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: Field Tasks & Geotagged Evidence (Gap 15) */}
      {activePageTab === "tasks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>TOTAL FIELD TASKS</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{tasks.length}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Assigned across salespeople</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>OPEN & PENDING</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#d97706" }}>
                {tasks.filter((t) => t.status === "open").length}
              </div>
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>Awaiting field execution</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>IN PROGRESS</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#2563eb" }}>
                {tasks.filter((t) => t.status === "in_progress").length}
              </div>
              <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 2 }}>Started by salesperson</div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>DONE WITH EVIDENCE</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: "#16a34a" }}>
                {tasks.filter((t) => t.status === "done").length}
              </div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>Verified with photo proof</div>
            </div>
          </div>

          {/* Action Row */}
          <div className="between" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>FILTER:</span>
              {["", "open", "in_progress", "done", "cancelled"].map((st) => (
                <button
                  key={st || "all"}
                  type="button"
                  className={`tab ${taskStatusFilter === st ? "active" : ""}`}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setTaskStatusFilter(st)}
                >
                  {st ? st.replace("_", " ").toUpperCase() : "ALL"}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => void loadTasks()}
                disabled={tasksLoading}
              >
                🔄 Refresh
              </button>
              <button
                type="button"
                className="primary"
                style={{ background: "#165a31", borderColor: "#165a31", fontWeight: 700 }}
                onClick={() => {
                  setTaskForm({
                    title: "",
                    description: "",
                    assignedToStaffId: staff[0]?.id || "",
                    retailerId: retailers[0]?.id || "",
                    priority: "normal",
                    dueAt: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
                  });
                  setShowCreateTaskModal(true);
                }}
              >
                ➕ Assign Field Task
              </button>
            </div>
          </div>

          {/* Field Tasks Table */}
          {tasksLoading ? (
            <p>Loading field tasks…</p>
          ) : tasks.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              No field tasks found matching filter. Click <strong>Assign Field Task</strong> to create one.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#4b5563" }}>
                      <th style={{ padding: "10px 14px" }}>Task Title & Instructions</th>
                      <th style={{ padding: "10px 14px" }}>Target Store</th>
                      <th style={{ padding: "10px 14px" }}>Assigned Salesperson</th>
                      <th style={{ padding: "10px 14px" }}>Priority</th>
                      <th style={{ padding: "10px 14px" }}>Due Date</th>
                      <th style={{ padding: "10px 14px" }}>Status</th>
                      <th style={{ padding: "10px 14px" }}>Geotagged Proof</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{task.title}</div>
                          {task.description && (
                            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2, maxWidth: 320 }}>
                              {task.description}
                            </div>
                          )}
                          {task.completionNote && (
                            <div style={{ color: "#15803d", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
                              💬 Note: "{task.completionNote}"
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#111827" }}>
                            🏢 {task.retailer?.name ?? "Retailer"}
                          </div>
                          <div style={{ color: "#6b7280", fontSize: 11 }}>
                            📍 {task.retailer?.shopAddress ?? task.retailer?.deliveryCity ?? "Indore"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#374151" }}>
                            👤 {task.assignedTo?.name ?? "Salesperson"}
                          </div>
                          {task.assignedTo?.phone && (
                            <div style={{ color: "#6b7280", fontSize: 11 }}>
                              📞 {task.assignedTo.phone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              background: task.priority === "urgent" || task.priority === "high" ? "#fee2e2" : "#f3f4f6",
                              color: task.priority === "urgent" || task.priority === "high" ? "#b91c1c" : "#4b5563",
                            }}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "#4b5563" }}>
                          {task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: task.status === "done" ? "#dcfce7" : task.status === "in_progress" ? "#dbeafe" : task.status === "cancelled" ? "#fee2e2" : "#fef3c7",
                              color: task.status === "done" ? "#15803d" : task.status === "in_progress" ? "#1e40af" : task.status === "cancelled" ? "#b91c1c" : "#92400e",
                            }}
                          >
                            {task.status.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {task.evidenceCount > 0 ? (
                            <button
                              type="button"
                              className="sm secondary"
                              style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}
                              onClick={() => setSelectedTaskEvidence(task)}
                            >
                              📸 {task.evidenceCount} Photos Proof
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>No photos</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          {task.status !== "done" && task.status !== "cancelled" && (
                            <button
                              type="button"
                              className="sm ghost"
                              style={{ color: "#dc2626", fontSize: 11 }}
                              onClick={() => void handleCancelTask(task.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal: Create Field Task */}
          {showCreateTaskModal && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 540, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
                <h3 style={{ marginTop: 0 }}>📍 Assign New Field Task</h3>
                <p className="page-sub">Assign store branding audits, competitor surveys, or merchandizing tasks to field staff.</p>

                <form onSubmit={handleCreateTask}>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Task Title *</label>
                    <input
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      placeholder="e.g. Shopfront Glow Board Inspection"
                      required
                    />
                  </div>

                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Task Instructions & Description</label>
                    <textarea
                      rows={2}
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      placeholder="e.g. Capture daytime front facade photo and verify shelf display placement"
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div className="field">
                      <label>Assign to Salesperson *</label>
                      <select
                        value={taskForm.assignedToStaffId}
                        onChange={(e) => setTaskForm({ ...taskForm, assignedToStaffId: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Salesperson --</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.phone || "No phone"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Target Store / Retailer *</label>
                      <select
                        value={taskForm.retailerId}
                        onChange={(e) => setTaskForm({ ...taskForm, retailerId: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Retailer --</option>
                        {retailers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.deliveryCity || "Indore"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div className="field">
                      <label>Priority</label>
                      <select
                        value={taskForm.priority}
                        onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Due Date *</label>
                      <input
                        type="date"
                        value={taskForm.dueAt}
                        onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="secondary" onClick={() => setShowCreateTaskModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" style={{ background: "#165a31", borderColor: "#165a31", fontWeight: 700 }}>
                      Assign Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Geotagged Evidence Viewer */}
          {selectedTaskEvidence && (
            <div className="modal-backdrop" style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div className="card" style={{ width: 560, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
                <div className="between" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: "0 0 2px" }}>📸 Geotagged Field Evidence</h3>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{selectedTaskEvidence.title}</div>
                  </div>
                  <button type="button" className="sm ghost" onClick={() => setSelectedTaskEvidence(null)}>✕</button>
                </div>

                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>Store: <strong>{selectedTaskEvidence.retailer?.name}</strong></span>
                    <span>Auditor: <strong>{selectedTaskEvidence.assignedTo?.name}</strong></span>
                  </div>
                  {selectedTaskEvidence.completionNote && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#15803d" }}>
                      Note: "{selectedTaskEvidence.completionNote}"
                    </div>
                  )}
                </div>

                {/* Evidence Photo & Coordinates */}
                {selectedTaskEvidence.evidence?.map((ev: any) => (
                  <div key={ev.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ maxHeight: 300, overflow: "hidden", background: "#f3f4f6", textAlign: "center" }}>
                      <img
                        src={ev.objectKey}
                        alt="Task Evidence Proof"
                        style={{ maxWidth: "100%", maxHeight: 280, objectFit: "contain" }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/catalog-images/basmati-rice.png";
                        }}
                      />
                    </div>
                    <div style={{ padding: 12, background: "#ffffff", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#111827" }}>
                          📍 GPS: {ev.latitude?.toFixed(4)}, {ev.longitude?.toFixed(4)}
                        </span>
                        <span style={{ background: "#ecfdf5", color: "#065f46", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          Accuracy ±{ev.accuracyMeters || 5}m
                        </span>
                      </div>
                      <div style={{ color: "#6b7280", marginTop: 4, fontSize: 11 }}>
                        Captured: {new Date(ev.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" className="secondary" onClick={() => setSelectedTaskEvidence(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
