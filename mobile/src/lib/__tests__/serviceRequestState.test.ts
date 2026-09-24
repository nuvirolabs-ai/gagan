import { describe, expect, it } from "vitest";
import { canWithdrawServiceRequest, mergeServiceRequest, type ServiceRequestRow } from "../serviceRequestState";

const open: ServiceRequestRow = { id: "a", description: "Please call", status: "open", createdAt: "2026-09-24" };

describe("retailer service-request presentation", () => {
  it("offers withdrawal only while submitted/open", () => {
    expect(canWithdrawServiceRequest(open)).toBe(true);
    for (const status of ["in_progress", "resolved", "closed", "rejected", "withdrawn"]) {
      expect(canWithdrawServiceRequest({ ...open, status })).toBe(false);
    }
  });
  it("updates only the matching row after an accepted withdrawal", () => {
    const other = { ...open, id: "b" };
    const next = mergeServiceRequest([open, other], { ...open, status: "withdrawn" });
    expect(next[0].status).toBe("withdrawn");
    expect(next[1]).toBe(other);
  });
});
