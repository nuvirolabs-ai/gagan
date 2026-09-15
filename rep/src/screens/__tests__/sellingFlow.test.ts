/// <reference types="node" />
import { describe, expect, it, vi } from "vitest";
import { currentSellingVisit, openCreatedOrder } from "../sellingFlow";
import { calendarWeeks, monthCells } from "../../dateOnly";
import { readFileSync } from "node:fs";

const visit = { id: "visit-a", retailerId: "store-a", salespersonId: "staff-a", checkedInAt: "2026-09-16T08:00:00Z" };
const input = { visits: [visit], retailerId: "store-a", staffId: "staff-a", activities: [], orders: [] };
const source = (name: string) => readFileSync(new URL("../" + name, import.meta.url), "utf8");

describe("selling continuation", () => {
  it("allows a server-confirmed open visit without inventing route context", () => {
    expect(currentSellingVisit(input)).toEqual(visit);
  });
  it.each([
    { staffId: "staff-b" }, { retailerId: "store-b" }, { visitId: "visit-b" },
    { visits: [] }, { visits: [{ ...visit, checkedOutAt: "2026-09-16T09:00:00Z" }] },
    { visits: [{ ...visit, outcome: "no_order" }] },
    { visits: [{ ...visit, outcomes: ["order_placed"] }] },
    { activities: [{ visitId: visit.id, type: "no_order" }] },
    { activities: [{ visitId: visit.id, type: "order_placed" }] },
    { orders: [{ createdAt: "2026-09-16T08:30:00Z" }] },
  ])("hides no-order action for invalid/completed context %#", override => {
    expect(currentSellingVisit({ ...input, ...override })).toBeNull();
  });
  it("does not suppress a new visit because of an older order", () => {
    expect(currentSellingVisit({ ...input, orders: [{ createdAt: "2026-09-15T08:30:00Z" }] })).toEqual(visit);
  });
  it("opens the canonical created order immediately", () => {
    const replace = vi.fn(), acknowledge = vi.fn();
    openCreatedOrder({ order: { id: "order-a" } }, replace, acknowledge);
    expect(replace).toHaveBeenCalledExactlyOnceWith("OrderDetail", { orderId: "order-a" });
    expect(acknowledge).not.toHaveBeenCalled();
  });
  it("acknowledges approval before opening the same order", () => {
    const replace = vi.fn(), acknowledge = vi.fn();
    openCreatedOrder({ order: { id: "order-a" }, approvalRequest: { id: "approval-a" } }, replace, acknowledge);
    expect(replace).not.toHaveBeenCalled();
    acknowledge.mock.calls[0][0]();
    expect(replace).toHaveBeenCalledExactlyOnceWith("OrderDetail", { orderId: "order-a" });
  });
  it("never navigates on an incomplete creation response", () => {
    const replace = vi.fn();
    expect(() => openCreatedOrder({}, replace, vi.fn())).toThrow("order_response_missing_id");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("screen integration contracts", () => {
  it("renders the requested Home order without duplicating the sales surface", () => {
    const home = source("TodayScreen.tsx");
    const anchors = ["<Surface style={styles.salesSurface}>", "{!dayClosed && nextStop", '<FocusCard tone="danger"', "<View style={styles.metricStrip}>", 'title="Next up today"'];
    const positions = anchors.map(value => home.indexOf(value));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(home.split(anchors[0])).toHaveLength(2);
  });
  it("removes profile credit presentation but preserves the credit approval guard", () => {
    const profile = source("RepRetailerDetailScreen.tsx");
    expect(profile).not.toContain('t("profile.availableCredit")');
    expect(profile).not.toContain("inr(credit.available)");
    expect(profile).toContain("credit.available <= 0");
  });
  it("keeps only calendar and leave, without the vertical attendance list", () => {
    const day = source("MyDayScreen.tsx");
    expect(day).toContain('title="Attendance calendar"');
    expect(day).toContain('title={t("myday.leave")}');
    expect(day).not.toContain("days.slice(0, 30).map");
  });
  it("both check-in success paths open catalogue without awaiting profile refresh", () => {
    const profile = source("RepRetailerDetailScreen.tsx");
    expect(profile.match(/navigation.navigate\("RepCatalog", \{[^\n]+visitId: result.visit.id/g)).toHaveLength(2);
    expect(profile).not.toContain("openVisit(result.visit)");
    expect(profile).toContain("await repApi.checkIn");
    expect(profile).toContain("checkInPending.current");
  });
  it("no-order action only navigates to the existing composer with visit identity", () => {
    const catalog = source("RepCatalogScreen.tsx");
    expect(catalog).toContain('sellingVisit ? <SecondaryButton label="NOT ORDERING"');
    expect(catalog).toContain('navigation.navigate("Visit"');
    expect(catalog).toContain("visitId: sellingVisit.id");
    expect(catalog).toContain("composeActivity: true");
    expect(catalog).not.toContain("repApi.checkOut");
  });
  it("keeps seven calendar columns including Saturday on every week", () => {
    const weeks = calendarWeeks(monthCells(new Date(2026, 8, 1)));
    expect(weeks.every(week => week.length === 7)).toBe(true);
    expect(weeks[0][6]).toBe("2026-09-05");
    expect(weeks[2][3]).toBe("2026-09-16");
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });
});
