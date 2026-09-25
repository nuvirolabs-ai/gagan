import { createHash } from "node:crypto";
import { z } from "zod";

export type TargetScope = "PERSONAL" | "TEAM";

export type HistoricalTargetRow = {
  id: string;
  salespersonId: string;
  metric: string;
  periodStart: Date;
  periodEnd: Date;
  targetValue: { toString(): string };
  createdByStaffId: string | null;
  createdAt: Date;
  updatedAt: Date;
  scope: TargetScope | null;
};

export type TargetScopeEvidence = {
  scope: TargetScope;
  evidence: string;
};

export type TargetScopeMappingEntry = {
  targetId: string;
  ownerId: string;
  metric: string;
  periodStart: string;
  periodEnd: string;
  targetValue: string;
  createdByStaffId: string | null;
  scope: TargetScope | null;
  evidence: string | null;
  ambiguity: "classification_required" | null;
  fingerprint: string;
};

function canonicalValue(value: { toString(): string }): string {
  return Number(value.toString()).toFixed(2);
}

export function fingerprintTarget(row: HistoricalTargetRow): string {
  return createHash("sha256").update(JSON.stringify([
    row.id,
    row.salespersonId,
    row.metric,
    row.periodStart.toISOString(),
    row.periodEnd.toISOString(),
    canonicalValue(row.targetValue),
    row.createdByStaffId,
    row.createdAt.toISOString(),
    row.updatedAt.toISOString(),
  ])).digest("hex");
}

export function auditTargetRows(
  rows: readonly HistoricalTargetRow[],
  evidenceByTargetId: Record<string, TargetScopeEvidence> = {},
): TargetScopeMappingEntry[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id)).map((row) => {
    const proposal = evidenceByTargetId[row.id];
    const resolved = (proposal?.scope === "PERSONAL" || proposal?.scope === "TEAM")
      && Boolean(proposal.evidence?.trim());
    return {
      targetId: row.id,
      ownerId: row.salespersonId,
      metric: row.metric,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
      targetValue: canonicalValue(row.targetValue),
      createdByStaffId: row.createdByStaffId,
      scope: resolved ? proposal.scope : null,
      evidence: proposal?.evidence?.trim() || null,
      ambiguity: resolved ? null : "classification_required",
      fingerprint: fingerprintTarget(row),
    };
  });
}

const approvedMappingEntry = z.object({
  targetId: z.string().min(1),
  ownerId: z.string().min(1),
  metric: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetValue: z.string().regex(/^-?\d+\.\d{2}$/),
  createdByStaffId: z.string().nullable(),
  scope: z.enum(["PERSONAL", "TEAM"]),
  evidence: z.string().trim().min(1),
  ambiguity: z.null(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export function parseTargetScopeMapping(input: unknown): TargetScopeMappingEntry[] {
  const parsed = z.array(approvedMappingEntry).safeParse(input);
  if (!parsed.success) throw new Error("target_scope_mapping_invalid");
  return parsed.data;
}

export function validateTargetScopeMapping(
  rows: readonly HistoricalTargetRow[],
  mapping: readonly TargetScopeMappingEntry[],
): void {
  if (mapping.length !== rows.length) throw new Error("target_scope_mapping_drift");
  const entries = new Map(mapping.map((entry) => [entry.targetId, entry]));
  if (entries.size !== rows.length) throw new Error("target_scope_mapping_drift");

  for (const row of rows) {
    const entry = entries.get(row.id);
    if (!entry || entry.fingerprint !== fingerprintTarget(row)
      || entry.ownerId !== row.salespersonId || entry.metric !== row.metric
      || entry.periodStart !== row.periodStart.toISOString().slice(0, 10)
      || entry.periodEnd !== row.periodEnd.toISOString().slice(0, 10)
      || entry.targetValue !== canonicalValue(row.targetValue)
      || entry.createdByStaffId !== row.createdByStaffId
      || (row.scope !== null && row.scope !== entry.scope)) {
      throw new Error("target_scope_mapping_drift");
    }
    if ((entry.scope !== "PERSONAL" && entry.scope !== "TEAM")
      || !entry.evidence?.trim() || entry.ambiguity !== null) {
      throw new Error("target_scope_unresolved");
    }
  }
}
