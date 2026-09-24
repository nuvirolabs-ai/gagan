/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextOrderVisitAction } from "../orderVisitAction";

const screen = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const order = { retailerId: "store-1", createdAt: "2026-09-24T09:30:00Z" };
const visit = { id: "visit-1", retailerId: "store-1", checkedInAt: "2026-09-24T09:00:00Z", checkedOutAt: null };

describe("feedback round 2 visit and new retailer flow", () => {
  it("keeps an order inside an active visit", () => {
    expect(nextOrderVisitAction(order, [visit])).toEqual({ kind: "continue_visit", visitId: "visit-1" });
  });
  it("offers next retailer only after the matching visit checked out", () => {
    expect(nextOrderVisitAction(order, [{ ...visit, checkedOutAt: "2026-09-24T10:00:00Z" }])).toEqual({ kind: "next_retailer" });
  });
  it("does not invent a visit for an order placed without check-in", () => {
    expect(nextOrderVisitAction(order, [])).toEqual({ kind: "visit_not_completed" });
    expect(nextOrderVisitAction(order, [{ ...visit, checkedInAt: "2026-09-24T10:00:00Z", checkedOutAt: "2026-09-24T11:00:00Z" }])).toEqual({ kind: "visit_not_completed" });
  });
  it("resets the shared keyboard-safe viewport for every onboarding page", () => {
    const add = screen("AddRetailerScreen.tsx");
    expect(add).toContain("<KeyboardSafeScrollView key={step}");
    expect(add).toContain("Keyboard.dismiss()");
  });
});
