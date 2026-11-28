import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api";
import { firmNames, type BillingFirm } from "../invoiceDocument";

type Period = "all" | "fy" | "month" | "custom";
type BillingRow = {
  company: BillingFirm | "historical";
  invoiceCount: number;
  subtotal: number;
  tax: number;
  billed: number;
  paid: number;
  credited: number;
  outstanding: number;
};
type BillingReport = {
  period: { from: string | null; to: string | null; asOfDate: string };
  rows: BillingRow[];
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});

const rowLabel = (company: BillingRow["company"]) =>
  company === "historical" ? "Historical invoices without an issuer record" : firmNames[company];

function dateRange(preset: Period) {
  const [day, month, year] = dateFormat.format(new Date()).split("/");
  const today = `${year}-${month}-${day}`;
  if (preset === "month") return { from: `${year}-${month}-01`, to: today };
  if (preset === "fy") return {
    from: `${Number(year) - (Number(month) < 4 ? 1 : 0)}-04-01`,
    to: today,
  };
  return {};
}

export default function FinancialStatements() {
  const [preset, setPreset] = useState<Period>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<{ from?: string; to?: string; period: Period }>({ period: "all" });
  const [data, setData] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.financialStatements(range).then((report: BillingReport) => {
      if (active) setData(report);
    }).catch((cause: unknown) => {
      if (active) {
        setData(null);
        setError(cause instanceof Error ? cause.message : "Could not load the billing report.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [range]);

  function applyCustomDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRange({ from: from || undefined, to: to || undefined, period: "custom" });
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Billing and receivables (INR)"],
      ["Invoice dates", data.period.from ?? "All earlier dates", data.period.to ?? "Through latest invoice"],
      ["Current balances as of", data.period.asOfDate],
      ["Issuer", "Invoices", "Subtotal", "Tax", "Billed", "Payments net of reversals", "Issued credits", "Current outstanding"],
      ...data.rows.map(row => [
        rowLabel(row.company), row.invoiceCount, row.subtotal, row.tax, row.billed, row.paid, row.credited, row.outstanding,
      ]),
    ];
    const csv = rows.map(row => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gagan-billing-${data.period.asOfDate.slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="page">
      <div className="between">
        <div>
          <h1>Billing and receivables</h1>
          <p className="page-sub">Issued invoices, applied payments, credits, and outstanding amounts by selling firm.</p>
        </div>
        <Link to="/billing-entities">Billing Entities Audit</Link>
      </div>
      <div className="card">
        <form onSubmit={applyCustomDates}>
          <label className="field">Invoice date range
            <select className="input" value={preset} onChange={event => {
              const next = event.target.value as Period;
              setPreset(next);
              if (next !== "custom") setRange({ ...dateRange(next), period: next });
            }}>
              <option value="all">All invoice dates</option>
              <option value="fy">Current financial year</option>
              <option value="month">This month</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label className="field">From<input type="date" className="input" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
              <label className="field">To<input type="date" className="input" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
              <button className="button" type="submit">Apply dates</button>
            </>
          )}
        </form>
      </div>
      {loading && <p role="status">Loading billing report…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && data && (
        <section className="card">
          <div className="between">
            <p>Payments, credits, and balances are current as of {dateFormat.format(new Date(data.period.asOfDate))} for the invoices in this range.</p>
            <button className="button secondary" type="button" onClick={exportCsv}>Export CSV</button>
          </div>
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Issuer</th><th scope="col">Invoices</th><th scope="col">Subtotal</th>
                  <th scope="col">Tax</th><th scope="col">Billed</th><th scope="col">Net payments</th>
                  <th scope="col">Issued credits</th><th scope="col">Current outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row.company}>
                    <th scope="row">{rowLabel(row.company)}</th>
                    <td>{row.invoiceCount}</td><td>{inr(row.subtotal)}</td><td>{inr(row.tax)}</td>
                    <td>{inr(row.billed)}</td><td>{inr(row.paid)}</td><td>{inr(row.credited)}</td><td>{inr(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
