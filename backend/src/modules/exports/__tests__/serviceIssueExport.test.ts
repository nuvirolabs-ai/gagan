import { describe, expect, it } from "vitest";
import { ServiceIssueExportService } from "../serviceIssueExportService";

describe("service issue export bounds", () => {
  it("rejects an oversized matching set instead of returning a partial workbook", async () => {
    const db = { serviceIssue: { findMany: async () => Array.from({ length: 5_001 }) } } as any;
    await expect(new ServiceIssueExportService(db).excel({ scopeStaffIds: null }))
      .rejects.toMatchObject({ code: "export_too_large", status: 413 });
  });
});
