import { describe, expect, it } from "vitest";
import { activeRetailerVisit } from "../activeRetailerVisit";

const openVisit = { id: "visit-1", retailerId: "store-1", checkedOutAt: null };

describe("active retailer visit selection", () => {
  it("restores the visit when the salesperson returns to its retailer", () => {
    expect(activeRetailerVisit([openVisit], "store-1")).toEqual({
      activeVisit: openVisit,
      activeVisitElsewhere: null,
    });
  });

  it("keeps a visit at another retailer visible instead of allowing a second check-in", () => {
    expect(activeRetailerVisit([openVisit], "store-2")).toEqual({
      activeVisit: null,
      activeVisitElsewhere: openVisit,
    });
  });

  it("ignores closed history when deciding whether to block a new check-in", () => {
    expect(activeRetailerVisit([{ ...openVisit, checkedOutAt: "2026-09-25T08:00:00Z" }], "store-2"))
      .toEqual({ activeVisit: null, activeVisitElsewhere: null });
  });
});
