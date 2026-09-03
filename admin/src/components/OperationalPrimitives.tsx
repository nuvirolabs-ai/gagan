import type { ReactNode } from "react";
import { inrShort, type FlowStage } from "./operationalUtils";

export function Sparkline({
  values,
  label,
  tone = "active",
  large = false,
}: {
  values: number[];
  label: string;
  tone?: "active" | "critical" | "warning" | "neutral";
  large?: boolean;
}) {
  if (values.length < 2) {
    return <div className="chart-unavailable" role="img" aria-label={`${label}: trend unavailable`}>Trend unavailable</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${90 - ((value - min) / spread) * 72}`).join(" ");
  const area = `0,100 ${points} 100,100`;
  return (
    <svg className={`sparkline ${large ? "sparkline-large" : ""} sparkline-${tone}`} viewBox="0 0 100 100" role="img" aria-label={label} preserveAspectRatio="none">
      <polygon className="spark-fill" points={area} />
      <polyline points={points} />
      <circle className="spark-end" cx="100" cy={90 - ((values.at(-1)! - min) / spread) * 72} r="2.5" />
    </svg>
  );
}

export function Icon({ name, size = 16 }: { name: "arrow" | "check" | "alert" | "clock" | "chevron" | "order" | "finance" | "stock" | "sap" | "users" | "grid"; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M3 8h10"/><path d="m9 4 4 4-4 4"/></>,
    check: <path d="m3 8 3 3 6-7"/>,
    alert: <><path d="M8 2 14 14H2L8 2Z"/><path d="M8 6v3"/><path d="M8 11h.01"/></>,
    clock: <><circle cx="8" cy="8" r="5.5"/><path d="M8 4.5v3.8l2.2 1.3"/></>,
    chevron: <path d="m6 3 5 5-5 5"/>,
    order: <><path d="M3 3h10v10H3z"/><path d="M5 6h6M5 9h4"/></>,
    finance: <><path d="M8 2v12M11 4.5c-.5-.8-1.5-1.2-2.7-1.2C6.8 3.3 6 4 6 5s.8 1.5 2.3 1.9c1.5.4 2.3 1 2.3 2s-.9 1.8-2.4 1.8c-1.3 0-2.2-.5-2.8-1.3"/></>,
    stock: <><path d="m2.5 5 5.5-3 5.5 3-5.5 3-5.5-3Z"/><path d="M2.5 5v6l5.5 3 5.5-3V5M8 8v6"/></>,
    sap: <><circle cx="8" cy="8" r="5.5"/><path d="M5 10.2c.8.8 1.7 1.2 2.9 1.2 1.3 0 2.1-.6 2.1-1.5 0-.8-.5-1.2-1.9-1.6-1.5-.4-2.2-.9-2.2-1.8 0-.9.8-1.6 2.1-1.6 1 0 1.8.3 2.4.9"/></>,
    users: <><circle cx="8" cy="5" r="2.2"/><path d="M3.5 13c.5-2.1 2-3.2 4.5-3.2s4 .9 4.5 3.2"/></>,
    grid: <><rect x="2.5" y="2.5" width="4" height="4"/><rect x="9.5" y="2.5" width="4" height="4"/><rect x="2.5" y="9.5" width="4" height="4"/><rect x="9.5" y="9.5" width="4" height="4"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="section-label">{children}</span>;
}

export function FlowMap({ stages, onSelect }: { stages: FlowStage[]; onSelect?: (stage: FlowStage) => void }) {
  const base = stages[0]?.count || 0;
  return (
    <section className="flow-map" aria-labelledby="flow-title">
      <div className="flow-heading">
        <div><SectionLabel>Order lifecycle</SectionLabel><h2 id="flow-title">How work is flowing</h2></div>
        <span className="flow-note">{base > 0 ? `${Math.round(((stages.at(-1)?.count ?? 0) / base) * 100)}% through-flow` : "No flow data"}</span>
      </div>
      <div className="flow-track">
        {stages.map((stage, index) => {
          const node = (
            <span className={`flow-node stage-${index + 1} tone-${stage.tone}`}>
              <span className="node-header"><span className="node-label">{stage.label}</span><span className={`node-status status-${stage.tone}`}><i />{stage.tone}</span></span>
              <strong>{stage.count.toLocaleString("en-IN")}</strong>
              <span className="node-value">{inrShort(stage.value)}</span>
              <small>{stage.note}</small>
              <span className="node-retention">{stage.retention}</span>
              <span className="node-pressure" aria-hidden="true"><i style={{ width: `${base ? Math.max((stage.count / base) * 100, stage.count ? 4 : 0) : 0}%` }} /></span>
            </span>
          );
          return onSelect ? <button key={stage.label} className="flow-node-button" onClick={() => onSelect(stage)} aria-label={`${stage.label}: ${stage.count} orders, ${inrShort(stage.value)}`}>{node}</button> : <div key={stage.label}>{node}</div>;
        })}
      </div>
      <div className="flow-foot"><span>Current-state distribution from the Admin order queues.</span><span><b>{base.toLocaleString("en-IN")}</b> in source population</span></div>
    </section>
  );
}

export function AgeDistribution({ counts, labels = ["<2h", "2–6h", "6–12h", "12h+"] }: { counts: number[]; labels?: string[] }) {
  const max = Math.max(...counts, 1);
  return <div className="age-distribution" role="img" aria-label={`Queue age distribution: ${counts.map((count, index) => `${count} ${labels[index]}`).join(", ")}`}>
    <div className="age-title"><SectionLabel>Queue health</SectionLabel><strong>Age distribution</strong><small>Based on createdAt in the current queue.</small></div>
    <div className="age-bars">{counts.map((count, index) => <div className={index === counts.length - 1 && count > 0 ? "age-risk" : ""} key={labels[index]}><i style={{ height: `${Math.max((count / max) * 100, count ? 10 : 0)}%` }} /><b>{count}</b><span>{labels[index]}</span></div>)}</div>
  </div>;
}
