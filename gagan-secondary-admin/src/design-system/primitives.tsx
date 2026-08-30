import type { ButtonHTMLAttributes, ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export function StatusBadge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className={`dk-status dk-status-${tone}`}><span aria-hidden className="dk-status-dot" />{children}</span>;
}

export function PrimaryAction({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`dk-button dk-button-primary ${props.className ?? ""}`.trim()}>{children}</button>;
}

export function SecondaryAction({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`dk-button dk-button-secondary ${props.className ?? ""}`.trim()}>{children}</button>;
}

export function ObjectSeal({ code, name, status, tone = "neutral" }: { code: string; name: string; status?: string; tone?: StatusTone }) {
  return <span className="dk-object-seal"><span aria-hidden className="dk-object-glyph">•</span><span className="dk-object-copy"><span className="dk-object-code">{code}</span><strong>{name}</strong>{status ? <StatusBadge tone={tone}>{status}</StatusBadge> : null}</span></span>;
}

export function OperationalBand({ readings }: { readings: Array<{ label: string; value: ReactNode; context?: string; tone?: StatusTone }> }) {
  return <section className="dk-operational-band" aria-label="Operating context">{readings.map((reading) => <div className="dk-reading" key={reading.label}><span className={`dk-reading-dot dk-reading-${reading.tone ?? "neutral"}`} /><span className="dk-reading-label">{reading.label}</span><strong>{reading.value}</strong>{reading.context ? <small>{reading.context}</small> : null}</div>)}</section>;
}

