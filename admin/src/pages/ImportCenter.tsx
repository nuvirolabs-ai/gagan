import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";

type ImportType = { type: string; label: string; description: string; required: string[]; optional: string[]; modes: string[] };
type ImportRow = { rowNumber: number; values: Record<string, string>; errors: string[]; warnings: string[]; action: string; match?: { label: string } };

function labelFor(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ImportCenter() {
  const [types, setTypes] = useState<ImportType[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [mode, setMode] = useState("upsert");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(() => types.find((item) => item.type === selectedType), [types, selectedType]);
  const load = useCallback(async () => {
    try {
      const [typeResult, historyResult] = await Promise.all([api.importTypes(), api.imports()]);
      setTypes(typeResult.types ?? []);
      setHistory(historyResult.imports ?? []);
      if (!selectedType && typeResult.types?.[0]) setSelectedType(typeResult.types[0].type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Import Center");
    }
  }, [selectedType]);
  useEffect(() => { void load(); }, [load]);

  const selectType = (type: ImportType) => {
    setSelectedType(type.type);
    setMode(type.modes.includes("upsert") ? "upsert" : type.modes[0]);
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const previewFile = async () => {
    if (!file || !selected) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await api.importPreview(selected.type, mode, file);
      setPreview(result);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview this file");
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!preview?.job?.id || preview.summary?.failedRows) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await api.applyImport(preview.job.id);
      setPreview({ ...preview, summary: result, applied: true });
      setNotice(result.failedRows ? "Import completed with row-level errors." : "Import applied successfully. Existing records were updated safely.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply this import");
    } finally { setBusy(false); }
  };

  const downloadTemplate = async (format: "csv" | "xlsx") => {
    if (!selected) return;
    try { downloadBlob(await api.importTemplate(selected.type, format), `gagan-${selected.type}-template.${format}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not download template"); }
  };

  const downloadErrors = async () => {
    if (!preview?.job?.id) return;
    try { downloadBlob(await api.importErrors(preview.job.id), `gagan-${selectedType}-errors.csv`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not download errors"); }
  };

  return (
    <div className="import-center">
      <div className="import-heading">
        <div>
          <p className="eyebrow">System / controlled data</p>
          <h1 className="page-title">Data Import Center</h1>
          <p className="page-sub">Bring approved master data into Gagan with a preview, validation, and an explicit apply step.</p>
        </div>
        <div className="import-environment"><span className="status-dot" /> staging · mock SAP · read-only connector</div>
      </div>

      {error ? <div className="banner error">{error}</div> : null}
      {notice ? <div className="banner success">{notice}</div> : null}

      <section className="import-safety">
        <div><span className="import-kicker">SAFE OPERATING MODE</span><strong>Preview first. Apply only what you can explain.</strong></div>
        <span>Up to 10,000 rows · .csv or .xlsx · canonical Gagan data only</span>
      </section>

      <div className="import-layout">
        <aside className="import-types">
          <div className="section-label">Supported imports</div>
          {types.map((type) => <button key={type.type} className={`import-type ${selectedType === type.type ? "active" : ""}`} onClick={() => selectType(type)}><span>{type.label}</span><small>{type.description}</small></button>)}
          <div className="import-not-supported"><span className="section-label">Not exposed</span><p>Orders, payments, credit decisions, warehouse master, and SAP execution remain outside this V1.</p></div>
        </aside>

        <main className="import-workspace">
          {selected ? <>
            <div className="import-work-header"><div><span className="section-label">Import type</span><h2>{selected.label}</h2><p>{selected.description}</p></div><div className="import-actions"><button className="secondary sm" onClick={() => void downloadTemplate("csv")}>Template CSV</button><button className="secondary sm" onClick={() => void downloadTemplate("xlsx")}>Template XLSX</button></div></div>
            <div className="import-controls">
              <label className="import-file"><span>Choose file</span><input aria-label="Choose file" type="file" accept=".csv,.xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} />{file ? <strong>{file.name}</strong> : <em>No file selected</em>}</label>
              <label className="import-mode">Apply mode<select value={mode} onChange={(event) => setMode(event.target.value)}>{selected.modes.map((item) => <option key={item} value={item}>{labelFor(item)}</option>)}</select></label>
              <button disabled={!file || busy} onClick={() => void previewFile()}>{busy ? "Working…" : "Preview import →"}</button>
            </div>
            <div className="import-schema"><span>Required:</span> {selected.required.join(" · ")} {selected.optional.length ? <><span className="optional-label">Optional:</span> {selected.optional.join(" · ")}</> : null}</div>
            {preview ? <ImportPreview preview={preview} busy={busy} onApply={() => void apply()} onErrors={() => void downloadErrors()} /> : <div className="import-empty"><div className="import-empty-mark">↓</div><strong>Upload a file to see its effect before it touches Gagan.</strong><p>Templates include the exact supported headers and an example row. No data is sent to SAP from this screen.</p></div>}
          </> : <div className="empty-state">No import permissions are assigned.</div>}
        </main>
      </div>

      <section className="import-history"><div className="section-label">Recent import history</div>{history.length === 0 ? <p className="muted">No imports have been previewed yet.</p> : <table><thead><tr><th>Import</th><th>File</th><th>Rows</th><th>Result</th><th>Created</th><th>When</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><strong>{labelFor(item.importType)}</strong></td><td className="small">{item.fileName}</td><td className="right">{item.totalRows}</td><td><span className={`pill ${item.status === "completed" ? "active" : item.failedRows ? "warning" : "neutral"}`}>{item.status}</span></td><td className="right">{item.createdRows + item.updatedRows}</td><td className="small muted">{new Date(item.createdAt).toLocaleString("en-IN")}</td></tr>)}</tbody></table>}</section>
    </div>
  );
}

function ImportPreview({ preview, busy, onApply, onErrors }: { preview: any; busy: boolean; onApply: () => void; onErrors: () => void }) {
  const summary = preview.summary ?? {};
  const rows: ImportRow[] = preview.rows ?? [];
  return <section className="import-preview">
    <div className="import-preview-heading"><div><span className="section-label">Validation preview</span><h2>{preview.applied ? "Applied result" : "Ready for review"}</h2><p>{preview.applied ? "The server recorded this batch and its row-level outcome." : "Nothing changes until you explicitly apply this preview."}</p></div><div className="import-preview-actions">{summary.failedRows ? <button className="secondary sm" onClick={onErrors}>Download errors</button> : null}<button disabled={busy || preview.applied || summary.failedRows > 0} onClick={onApply}>{preview.applied ? "Applied" : summary.failedRows ? "Resolve errors first" : "Apply import →"}</button></div></div>
    <div className="import-summary"><div><strong>{summary.totalRows ?? 0}</strong><span>Total rows</span></div><div className="good"><strong>{summary.validRows ?? ((summary.createdRows ?? 0) + (summary.updatedRows ?? 0))}</strong><span>Valid</span></div><div className="warning"><strong>{summary.warningRows ?? 0}</strong><span>Warnings</span></div><div className="bad"><strong>{summary.failedRows ?? 0}</strong><span>Blocked</span></div>{preview.applied ? <><div><strong>{summary.createdRows ?? 0}</strong><span>Created</span></div><div><strong>{summary.updatedRows ?? 0}</strong><span>Updated</span></div></> : null}</div>
    <div className="import-table-wrap"><table><thead><tr><th>Row</th><th>Action</th><th>Record</th><th>Validation</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.rowNumber}><td className="mono">{row.rowNumber}</td><td><span className={`pill ${row.errors.length ? "warning" : row.action === "update" ? "active" : "neutral"}`}>{row.errors.length ? "blocked" : row.action}</span></td><td>{row.match?.label ?? "New canonical record"}</td><td>{row.errors.length ? <span className="import-error-text">{row.errors.join(" · ")}</span> : row.warnings.length ? <span className="import-warning-text">{row.warnings.join(" · ")}</span> : <span className="muted">Ready</span>}</td></tr>)}</tbody></table>{rows.length > 100 ? <div className="import-table-foot">Showing first 100 of {rows.length} rows. Full validation remains recorded in the job.</div> : null}</div>
  </section>;
}
