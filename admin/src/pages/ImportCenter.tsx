import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

type ImportType = { type: string; label: string; description: string; required: string[]; optional: string[]; modes: string[] };
type ImportRow = { rowNumber: number; values: Record<string, string>; errors: string[]; warnings: string[]; action: string; match?: { label: string } };
type HistoryItem = { id: string; importType: string; fileName: string; totalRows: number; createdRows: number; updatedRows: number; failedRows: number; status: string; createdAt: string };

const SOURCE_GLYPHS: Record<string, string> = { retailers: "⌂", products: "▦", salespeople: "↗", retailer_assignments: "↔", inventory: "▤", pricing: "₹", sap_mappings: "⇄" };

function labelFor(type: string) { return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatBytes(bytes?: number) { if (!bytes) return ""; return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function modeLabel(mode: string) { return mode === "create_only" ? "Create new only" : mode === "update_only" ? "Update existing only" : "Upsert"; }
function modeDescription(mode: string) { if (mode === "create_only") return "Only rows that do not match an existing record will be created."; if (mode === "update_only") return "Only matched Gagan records will be updated."; return "Creates missing records and updates matched records."; }

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

export default function ImportCenter() {
  const [types, setTypes] = useState<ImportType[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [mode, setMode] = useState("upsert");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);

  const selected = useMemo(() => types.find((item) => item.type === selectedType), [types, selectedType]);
  const load = useCallback(async () => {
    try {
      const [typeResult, historyResult] = await Promise.all([api.importTypes(), api.imports()]);
      setTypes(typeResult.types ?? []); setHistory(historyResult.imports ?? []);
      setSelectedType((current) => current || typeResult.types?.[0]?.type || "");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load Data Import"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showConfirm) confirmCancelRef.current?.focus(); }, [showConfirm]);

  const selectType = (type: ImportType) => {
    setSelectedType(type.type); setMode(type.modes.includes("upsert") ? "upsert" : type.modes[0]); setFile(null); setPreview(null); setSelectedHistory(null); setError(null); setNotice(null);
  };
  const acceptFile = (nextFile: File | null) => { if (!nextFile) return; setFile(nextFile); setPreview(null); setError(null); setNotice(null); };
  const previewFile = async () => {
    if (!file || !selected) return;
    setBusy(true); setError(null); setNotice(null);
    try { const result = await api.importPreview(selected.type, mode, file); setPreview(result); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not preview this file"); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!preview?.job?.id || preview.summary?.failedRows) return;
    setBusy(true); setError(null); setNotice(null); setShowConfirm(false);
    try { const result = await api.applyImport(preview.job.id); setPreview({ ...preview, summary: result, applied: true }); setNotice(result.failedRows ? "Import completed with row-level errors." : "Import applied successfully. Existing records were updated safely."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not apply this import"); }
    finally { setBusy(false); }
  };
  const downloadTemplate = async (format: "csv" | "xlsx") => {
    if (!selected) return; setShowTemplateMenu(false);
    try { downloadBlob(await api.importTemplate(selected.type, format), `gagan-${selected.type}-template.${format}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not download template"); }
  };
  const downloadErrors = async () => {
    if (!preview?.job?.id) return;
    try { downloadBlob(await api.importErrors(preview.job.id), `gagan-${selectedType}-errors.csv`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not download errors"); }
  };
  const step = preview?.applied ? 4 : preview ? 3 : file ? 2 : 1;
  const previewCreateCount = preview?.summary?.createdRows ?? preview?.summary?.validRows ?? 0;
  const previewUpdateCount = preview?.summary?.updatedRows ?? 0;

  return <div className="import-center">
    <div className="import-heading"><div><p className="eyebrow">System / controlled data</p><h1 className="page-title">Data Import</h1><p className="page-sub">Bring approved master data into Gagan safely.</p></div><div className="import-environment"><span className="status-dot" /> staging · mock SAP</div></div>
    {error ? <div className="banner error" role="alert">{error}</div> : null}
    {notice ? <div className="banner success" role="status">{notice}</div> : null}
    <section className="import-safety" aria-label="Safe import guidance"><div><span className="import-info-mark" aria-hidden="true">i</span><span className="import-kicker">SAFE IMPORT</span><strong>Preview first. Nothing changes until Apply.</strong></div><span>Up to 10,000 rows · CSV/XLSX · uses existing Gagan master records</span></section>

    <div className="import-layout">
      <aside className="import-types" aria-label="Import types">
        <div className="section-label">Import sources</div>
        <div className="import-source-list">{types.map((type) => <button key={type.type} className={`import-type ${selectedType === type.type ? "active" : ""}`} onClick={() => selectType(type)}><span className="import-type-icon" aria-hidden="true">{SOURCE_GLYPHS[type.type] ?? "·"}</span><span className="import-type-copy"><strong>{type.label}</strong><small>{type.description}</small><em>{type.modes.length} supported mode{type.modes.length === 1 ? "" : "s"}</em></span></button>)}</div>
        <div className="import-history-mini"><div className="section-label">Recent job state</div>{history.length === 0 ? <p className="muted">No imports have been previewed yet.</p> : <div className="import-history-list">{history.slice(0, 5).map((item) => <button key={item.id} className={`import-history-item ${selectedHistory?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedHistory(item)}><span><strong>{labelFor(item.importType)}</strong><small>{item.fileName}</small></span><span className={`import-history-status ${item.status === "completed" ? "complete" : item.failedRows ? "failed" : "preview"}`}>{item.status}</span></button>)}</div>}{selectedHistory ? <div className="import-job-detail"><span className="section-label">Selected job</span><strong>{selectedHistory.id}</strong><small>{selectedHistory.totalRows} rows · {selectedHistory.createdRows} created · {selectedHistory.updatedRows} updated · {selectedHistory.failedRows} failed</small></div> : null}</div>
        <div className="import-not-supported"><span className="section-label">Not exposed</span><p>Orders, payments, credit decisions and SAP execution remain outside this screen.</p></div>
      </aside>

      <main className="import-workspace">{selected ? <>
        <div className="import-work-header"><div><span className="section-label">Import type</span><h2>{selected.label}</h2><p>{selected.description}</p></div><div className="import-template-menu"><button className="secondary sm" aria-haspopup="menu" aria-expanded={showTemplateMenu} onClick={() => setShowTemplateMenu((open) => !open)}>Download template <span aria-hidden="true">⌄</span></button>{showTemplateMenu ? <div className="import-template-popover" role="menu"><button role="menuitem" onClick={() => void downloadTemplate("csv")}>CSV template <small>.csv</small></button><button role="menuitem" onClick={() => void downloadTemplate("xlsx")}>Excel template <small>.xlsx</small></button></div> : null}</div></div>
        <div className="import-meta"><span><b>Required</b>{selected.required.join(" · ")}</span>{selected.optional.length ? <span><b>Optional</b>{selected.optional.join(" · ")}</span> : null}</div>
        <div className="import-steps" aria-label="Import progress">{["Upload", "Validate", "Preview", "Apply"].map((label, index) => <div key={label} className={`import-step ${step > index + 1 ? "complete" : step === index + 1 ? "current" : ""}`}><span>{step > index + 1 ? "✓" : index + 1}</span><strong>{label}</strong></div>)}</div>
        {!preview ? <div className="import-upload-grid"><div className={`import-dropzone ${file ? "has-file" : ""}`} role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files?.[0] ?? null); }}><input ref={fileInputRef} aria-label="Choose file" className="import-file-input" type="file" accept=".csv,.xlsx" onChange={(event) => acceptFile(event.target.files?.[0] ?? null)} /><span className="import-upload-mark" aria-hidden="true">↓</span>{file ? <><strong>{file.name}</strong><p>{formatBytes(file.size)} · ready to validate</p><button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Replace file</button></> : <><strong>Drop an Excel or CSV file here</strong><p>or choose a file · .xlsx · .csv · up to 10 MB</p></>}</div><div className="import-contract"><span className="section-label">Import contract</span><h3>{file ? "Ready to validate" : "No file selected"}</h3><p>{file ? "Check the file before opening the preview." : "Choose a template or upload an existing file. Nothing will be written until you review the preview."}</p><div className="import-contract-line"><span>1</span><span>Upload source file</span></div><div className="import-contract-line"><span>2</span><span>Validate against Gagan records</span></div><div className="import-contract-line"><span>3</span><span>Review, then Apply intentionally</span></div></div></div> : null}
        <div className="import-controls"><div className="import-mode-group"><span className="control-label">Import mode</span><div role="group" aria-label="Import mode" className="import-mode-options">{selected.modes.map((item) => <button key={item} type="button" className={mode === item ? "selected" : ""} onClick={() => setMode(item)}>{modeLabel(item)}</button>)}</div><small>{modeDescription(mode)}</small></div><button className="import-preview-button" disabled={!file || busy || Boolean(preview)} onClick={() => void previewFile()}>{busy ? "Validating…" : "Preview import →"}</button></div>
        {preview ? <ImportPreview preview={preview} busy={busy} onApply={() => setShowConfirm(true)} onErrors={() => void downloadErrors()} /> : null}
      </> : <div className="empty-state">No import permissions are assigned.</div>}</main>
    </div>

    {showConfirm && preview ? <div className="import-dialog-backdrop" role="presentation" onMouseDown={() => setShowConfirm(false)}><div className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-confirm-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") setShowConfirm(false); }}><span className="section-label">Confirm apply</span><h2 id="import-confirm-title">Apply {selected?.label.toLowerCase()} import?</h2><p>This action will be recorded in Import History.</p><div className="import-confirm-summary"><span><strong>{previewCreateCount}</strong>to create</span><span><strong>{previewUpdateCount}</strong>to update</span><span><strong>{preview.summary?.warningRows ?? 0}</strong>warnings</span><span><strong>{preview.summary?.failedRows ?? 0}</strong>skipped</span></div><div className="import-dialog-actions"><button ref={confirmCancelRef} className="secondary" onClick={() => setShowConfirm(false)}>Cancel</button><button onClick={() => void apply()}>Apply import</button></div></div></div> : null}
  </div>;
}

function ImportPreview({ preview, busy, onApply, onErrors }: { preview: any; busy: boolean; onApply: () => void; onErrors: () => void }) {
  const summary = preview.summary ?? {};
  const rows: ImportRow[] = preview.rows ?? [];
  const [filter, setFilter] = useState("all");
  const visibleRows = rows.slice(0, 100).filter((row) => filter === "all" || filter === "errors" && row.errors.length > 0 || filter === "warnings" && row.warnings.length > 0 || filter === "ready" && !row.errors.length && !row.warnings.length);
  const createCount = summary.createdRows ?? summary.validRows ?? 0;
  const updateCount = summary.updatedRows ?? 0;
  const applicable = createCount + updateCount;
  return <section className="import-preview"><div className="import-preview-heading"><div><span className="section-label">Import read</span><h2>{preview.applied ? "Import complete" : "Ready for review"}</h2><p>{preview.applied ? "The server recorded this batch and its row-level outcome." : "Nothing changes until you explicitly apply this preview."}</p></div><div className="import-preview-actions">{summary.failedRows ? <button className="secondary sm" onClick={onErrors}>Download errors</button> : null}{!preview.applied ? <button disabled={busy || summary.failedRows > 0} onClick={onApply}>{summary.failedRows ? "Resolve errors first" : `Apply ${applicable} records →`}</button> : <span className="import-applied-state">Applied</span>}</div></div><div className="import-summary"><div><strong>{summary.totalRows ?? 0}</strong><span>Total rows</span></div><div className="good"><strong>{createCount}</strong><span>Create</span></div><div className="good"><strong>{updateCount}</strong><span>Update</span></div><div className="warning"><strong>{summary.warningRows ?? 0}</strong><span>Warnings</span></div><div className="bad"><strong>{summary.failedRows ?? 0}</strong><span>Blocked</span></div></div>{!preview.applied && summary.failedRows === 0 ? <div className="import-decision"><span className="section-label">This import will</span><strong>{applicable} records move into Gagan after confirmation.</strong><small>{createCount} create · {updateCount} update · {summary.warningRows ?? 0} warning{(summary.warningRows ?? 0) === 1 ? "" : "s"}</small></div> : null}<div className="import-preview-toolbar"><span className="section-label">Preview rows</span><div role="group" aria-label="Preview filters" className="import-filter-group">{[["all", "All"], ["ready", "Ready"], ["warnings", "Warnings"], ["errors", "Errors"]].map(([value, label]) => <button key={value} type="button" className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></div><div className="import-table-wrap"><table><thead><tr><th>Row</th><th>Action</th><th>Record</th><th>Validation</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.rowNumber}><td className="mono">{row.rowNumber}</td><td><span className={`pill ${row.errors.length ? "warning" : row.action === "update" ? "active" : "neutral"}`}>{row.errors.length ? "blocked" : row.action}</span></td><td>{row.match?.label ?? "New canonical record"}</td><td>{row.errors.length ? <span className="import-error-text">{row.errors.join(" · ")}</span> : row.warnings.length ? <span className="import-warning-text">{row.warnings.join(" · ")}</span> : <span className="muted">Ready</span>}</td></tr>)}</tbody></table>{rows.length > 100 ? <div className="import-table-foot">Showing first 100 of {summary.totalRows ?? rows.length} rows. Full validation remains recorded in the job.</div> : null}{rows.length === 0 ? <div className="import-table-foot">No rows match this view.</div> : null}</div></section>;
}
