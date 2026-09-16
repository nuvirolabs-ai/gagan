import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { explain } from "../errorCopy";

type QuestionType = "single_choice" | "multiple_choice" | "yes_no" | "rating" | "number" | "text";
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
    retailerIds: draft.audience === "selected_retailers" ? draft.retailerIds : [],
    salespersonIds: draft.audience === "selected_salespersons" ? draft.salespersonIds : [],
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

  useEffect(() => { void load(); }, [load]);

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

  const people = useMemo(() => draft?.audience === "selected_retailers" ? retailers : staff, [draft?.audience, retailers, staff]);
  const selectedIds = draft?.audience === "selected_retailers" ? draft.retailerIds : draft?.salespersonIds ?? [];

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

              {draft.audience.startsWith("selected_") ? <div className="assignment-box"><div className="section-kicker">{draft.audience === "selected_retailers" ? "Selected retailers" : "Selected salespeople"}</div><div className="assignment-grid">{people.map((person: any) => { const id = person.id; const active = selectedIds.includes(id); return <label key={id} className="check-row"><input type="checkbox" checked={active} onChange={() => setDraft({ ...draft, ...(draft.audience === "selected_retailers" ? { retailerIds: active ? draft.retailerIds.filter((item) => item !== id) : [...draft.retailerIds, id] } : { salespersonIds: active ? draft.salespersonIds.filter((item) => item !== id) : [...draft.salespersonIds, id] }) })} /><span>{person.name ?? person.businessName ?? id}<small>{person.phone ?? person.email ?? ""}</small></span></label>; })}</div></div> : null}

              <div className="section-kicker">Questions</div>
              {draft.questions.map((question, index) => <div className="question-builder" key={index}><div className="between"><strong>Question {index + 1}</strong><div className="row"><button className="sm secondary" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>↑</button><button className="sm secondary" disabled={index === draft.questions.length - 1} onClick={() => moveQuestion(index, 1)}>↓</button><button className="sm danger" disabled={draft.questions.length === 1} onClick={() => removeQuestion(index)}>Remove</button></div></div><div className="form-grid"><div className="field"><label>Prompt</label><input value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="What is moving fastest this week?" /></div><div className="field"><label>Type</label><select value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value as QuestionType })}>{Object.entries(TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></div></div><label className="check-row inline-check"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} />Required answer</label>{["single_choice", "multiple_choice"].includes(question.type) ? <div className="option-editor">{question.options.map((option, optionIndex) => <div className="row" key={optionIndex}><input value={option.label} onChange={(event) => updateQuestion(index, { options: question.options.map((item, i) => i === optionIndex ? { ...item, label: event.target.value } : item) })} placeholder={`Option ${optionIndex + 1}`} /><button className="sm danger" onClick={() => updateQuestion(index, { options: question.options.filter((_, i) => i !== optionIndex) })}>×</button></div>)}<button className="sm secondary" onClick={() => updateQuestion(index, { options: [...question.options, { label: "" }] })}>Add option</button></div> : null}{["rating", "number"].includes(question.type) ? <div className="form-grid"><div className="field"><label>Minimum (optional)</label><input type="number" value={question.minValue ?? ""} onChange={(event) => updateQuestion(index, { minValue: event.target.value === "" ? undefined : Number(event.target.value) })} /></div><div className="field"><label>Maximum (optional)</label><input type="number" value={question.maxValue ?? ""} onChange={(event) => updateQuestion(index, { maxValue: event.target.value === "" ? undefined : Number(event.target.value) })} /></div></div> : null}{question.type === "text" ? <div className="field"><label>Maximum characters (optional)</label><input type="number" value={question.maxLength ?? ""} onChange={(event) => updateQuestion(index, { maxLength: event.target.value === "" ? undefined : Number(event.target.value) })} /></div> : null}</div>)}
              <div className="row" style={{ marginTop: 12 }}><button className="secondary" onClick={addQuestion}>Add question</button><button onClick={() => void save()}>Save draft</button></div>
            </div>
          ) : selected ? (
            <div className="card"><div className="between"><div><div className="eyebrow">{selected.status}</div><h2>{selected.title}</h2><p className="muted">{selected.description || "No description"}</p></div><div className="row">{selected.status === "draft" ? <button onClick={() => setDraft(draftFromSurvey(selected))}>Edit</button> : null}{selected.status === "draft" ? <button onClick={() => void transition("activate")}>Activate</button> : null}{selected.status === "active" ? <button className="secondary" onClick={() => void transition("close")}>Close survey</button> : null}</div></div><div className="survey-preview">{selected.questions.map((question: any, index: number) => <div className="preview-question" key={question.id}><strong>{index + 1}. {question.prompt}</strong><span>{TYPE_LABELS[question.type as QuestionType]}{question.required ? " · required" : ""}</span></div>)}</div></div>
          ) : <div className="card empty-state">Select a survey to review it, or create a new draft.</div>}

          {selected && selected.status !== "draft" ? <><div className="card"><div className="between"><div><div className="eyebrow">Response analytics</div><h2>{summary?.responseCount ?? responses.length} responses</h2></div><span className="small muted">Computed from submitted answers</span></div>{summary?.questions?.map((item: any) => <div key={item.questionId} className="summary-row"><strong>{item.prompt}</strong>{item.answers ? item.answers.map((answer: any) => <span key={answer.optionId}>{answer.label}: {answer.count}</span>) : <span>{item.answered} answered{item.average != null ? ` · average ${Number(item.average).toFixed(1)}` : ""}</span>}</div>)}</div><div className="card" style={{ padding: 0 }}><div className="section-kicker" style={{ padding: "16px 16px 0" }}>Submitted responses</div>{responses.length === 0 ? <div className="empty-state">No responses yet.</div> : <table><thead><tr><th>Respondent</th><th>Context</th><th>Submitted</th><th>Answers</th></tr></thead><tbody>{responses.map((response) => <tr key={response.id}><td>{response.respondentStaff?.name ?? response.respondentRetailer?.name ?? response.respondentType}</td><td>{response.contextRetailer?.name ?? "—"}</td><td className="small">{new Date(response.submittedAt).toLocaleString()}</td><td className="small">{response.answers.map((answer: any) => `${answer.prompt}: ${answer.value ?? answer.options.map((option: any) => option.label).join(", ")}`).join(" · ")}</td></tr>)}</tbody></table>}</div></> : null}
        </div>
      </div>
    </div>
  );
}
