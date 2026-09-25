import { describe, expect, it } from "vitest";
import {
  auditTargetRows,
  fingerprintTarget,
  parseTargetScopeMapping,
  validateTargetScopeMapping,
} from "../targetScopeMigration";

const rows = Array.from({ length: 8 }, (_, index) => ({
  id: `target-${index}`,
  salespersonId: `owner-${index}`,
  metric: "order_value",
  periodStart: new Date("2026-09-01T00:00:00.000Z"),
  periodEnd: new Date("2026-09-30T00:00:00.000Z"),
  targetValue: `${(index + 1) * 1000}.00`,
  createdByStaffId: `creator-${index}`,
  createdAt: new Date("2026-08-25T10:00:00.000Z"),
  updatedAt: new Date("2026-08-25T10:00:00.000Z"),
  scope: null,
}));

const approvals = Object.fromEntries(rows.slice(0, 7).map((row) => [
  row.id,
  { scope: "PERSONAL" as const, evidence: `Approved fixture source for ${row.id}` },
]));

describe("historical target scope mapping", () => {
  it("audits every row without mutating source rows and marks unsupported meaning ambiguous", () => {
    const before = structuredClone(rows);
    const report = auditTargetRows(rows, approvals);

    expect(report).toHaveLength(8);
    expect(report[0]).toMatchObject({
      targetId: "target-0",
      ownerId: "owner-0",
      metric: "order_value",
      targetValue: "1000.00",
      createdByStaffId: "creator-0",
      scope: "PERSONAL",
      ambiguity: null,
    });
    expect(report[7]).toMatchObject({
      targetId: "target-7",
      scope: null,
      ambiguity: "classification_required",
    });
    expect(report[0].fingerprint).toHaveLength(64);
    expect(rows).toEqual(before);
  });

  it("rejects incomplete, extra, duplicate, ambiguous, and changed-row mappings", () => {
    const approved = auditTargetRows(rows, {
      ...approvals,
      "target-7": { scope: "TEAM", evidence: "Approved local fixture only" },
    });
    expect(() => validateTargetScopeMapping(rows, approved)).not.toThrow();
    expect(() => validateTargetScopeMapping(rows, approved.slice(1))).toThrow("target_scope_mapping_drift");
    expect(() => validateTargetScopeMapping(rows, [...approved, approved[0]])).toThrow("target_scope_mapping_drift");
    expect(() => validateTargetScopeMapping(rows, [...approved.slice(0, 7), { ...approved[7], targetId: "extra" }])).toThrow("target_scope_mapping_drift");
    expect(() => validateTargetScopeMapping(rows, auditTargetRows(rows, approvals))).toThrow("target_scope_unresolved");
    expect(() => validateTargetScopeMapping([{ ...rows[0], targetValue: "9999.00" }, ...rows.slice(1)], approved)).toThrow("target_scope_mapping_drift");
    expect(() => validateTargetScopeMapping([{ ...rows[0], createdByStaffId: "other" }, ...rows.slice(1)], approved)).toThrow("target_scope_mapping_drift");
  });

  it("fingerprints owner, metric, period, value, creator, and revision evidence", () => {
    const first = fingerprintTarget(rows[0]);
    for (const change of [
      { salespersonId: "different" },
      { metric: "visits" },
      { periodStart: new Date("2026-08-01T00:00:00.000Z") },
      { periodEnd: new Date("2026-10-01T00:00:00.000Z") },
      { targetValue: "2000.00" },
      { createdByStaffId: "different" },
      { updatedAt: new Date("2026-08-26T00:00:00.000Z") },
    ]) {
      expect(fingerprintTarget({ ...rows[0], ...change })).not.toBe(first);
    }
  });

  it("rejects malformed external mapping documents before database access", () => {
    const valid = auditTargetRows(rows, {
      ...approvals,
      "target-7": { scope: "TEAM", evidence: "Approved local fixture only" },
    });
    expect(parseTargetScopeMapping(valid)).toEqual(valid);
    expect(() => parseTargetScopeMapping([{ ...valid[0], scope: "UNKNOWN" }])).toThrow("target_scope_mapping_invalid");
    expect(() => parseTargetScopeMapping([{ ...valid[0], fingerprint: "short" }])).toThrow("target_scope_mapping_invalid");
    expect(() => parseTargetScopeMapping({ rows: valid })).toThrow("target_scope_mapping_invalid");
  });
});
