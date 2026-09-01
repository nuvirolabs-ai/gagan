import { describe, expect, it } from "vitest";
import { buildBaseline } from "../baselineDomain";
import { sortTriggers, summarise, triggersFor, type TriggerContext } from "../triggerDomain";

const at = (iso: string) => new Date(`${iso}T10:00:00.000Z`);
const NOW = at("2026-03-20");

const order = (iso: string, value = 20000, lineItems = 6, categories: string[] = ["Daal"]) => ({
  placedAt: at(iso),
  value,
  lineItems,
  categories,
});

/** A shop with a clean 12-day cycle and a ₹22,400 typical basket. */
function steadyShop(overrides: Partial<TriggerContext> = {}): TriggerContext {
  const baseline = buildBaseline({
    retailerId: "r1",
    orders: [
      order("2026-03-04", 22400),
      order("2026-02-20", 22400),
      order("2026-02-08", 22000),
      order("2026-01-27", 23000),
    ],
    visits: [{ visitedAt: at("2026-03-04") }],
    now: NOW,
  });
  return {
    retailerId: "r1",
    retailerName: "Sharma Stores",
    salespersonId: "staff-1",
    baseline,
    overdueAmount: 0,
    valueShare: 0.05,
    now: NOW,
    ...overrides,
  };
}

describe("order cycle triggers", () => {
  it("fires when a shop is meaningfully past its usual cycle, and explains why", () => {
    const triggers = triggersFor(steadyShop());
    const due = triggers.find((trigger) => trigger.type === "ORDER_DUE");
    expect(due).toBeDefined();
    expect(due!.why).toBe(
      "Usually orders every 12 days, based on 4 recent orders. It has been 16 days."
    );
    expect(due!.measurements).toEqual(
      expect.arrayContaining([
        { label: "Usual order cycle", value: "12 days" },
        { label: "Days since last order", value: "16 days" },
      ])
    );
    expect(due!.recommendedAction).toBe("Follow up today");
  });

  it("hedges rather than predicting", () => {
    const due = triggersFor(steadyShop()).find((trigger) => trigger.type === "ORDER_DUE")!;
    expect(due.why).toMatch(/Usually|Typical|based on recent orders/i);
    expect(`${due.headline} ${due.why} ${due.recommendedAction}`).not.toMatch(
      /will order|predicts|forecast|guaranteed|certain/i
    );
  });

  it("does not fire a day or two after the usual cycle", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-07"), order("2026-02-23"), order("2026-02-11")],
      visits: [],
      now: at("2026-03-20"),
    });
    // 13 days into a 12-day cycle is not a missed cycle.
    expect(triggersFor(steadyShop({ baseline })).some((t) => t.type === "ORDER_DUE")).toBe(false);
  });

  it("never fires from history too thin to support it", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-01-02")],
      visits: [],
      now: NOW,
    });
    const triggers = triggersFor(steadyShop({ baseline }));
    expect(triggers.some((t) => t.type === "ORDER_DUE")).toBe(false);
    expect(triggers.some((t) => t.type === "ORDER_VALUE_BELOW_NORMAL")).toBe(false);
  });

  it("fires nothing at all for a shop that has never ordered", () => {
    const baseline = buildBaseline({ retailerId: "r1", orders: [], visits: [], now: NOW });
    expect(triggersFor(steadyShop({ baseline }))).toEqual([]);
  });

  it("raises a big account to a missed high-value outlet instead of a plain order due", () => {
    const triggers = triggersFor(steadyShop({ valueShare: 0.3 }));
    expect(triggers.some((t) => t.type === "HIGH_VALUE_RETAILER_MISSED")).toBe(true);
    // The same fact is never reported twice.
    expect(triggers.some((t) => t.type === "ORDER_DUE")).toBe(false);
  });

  it("ranks a missed high-value outlet above an ordinary one", () => {
    const ordinary = triggersFor(steadyShop()).find((t) => t.type === "ORDER_DUE")!;
    const important = triggersFor(steadyShop({ valueShare: 0.3 })).find(
      (t) => t.type === "HIGH_VALUE_RETAILER_MISSED"
    )!;
    expect(important.priority).toBeGreaterThan(ordinary.priority);
  });
});

describe("basket triggers", () => {
  it("notices an order well below the usual basket and sizes the gap", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-18", 11200), order("2026-03-04", 22400), order("2026-02-20", 22400)],
      visits: [],
      now: NOW,
    });
    const trigger = triggersFor(steadyShop({ baseline }))!.find(
      (t) => t.type === "ORDER_VALUE_BELOW_NORMAL"
    )!;
    expect(trigger.why).toBe(
      "Typical order is ₹22,400 based on 3 recent orders. The last one was ₹11,200."
    );
    expect(trigger.measurements).toContainEqual({
      label: "Potential opportunity",
      value: "₹11,200 below normal",
    });
  });

  it("leaves a slightly smaller order alone", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-18", 19000), order("2026-03-04", 22400), order("2026-02-20", 22400)],
      visits: [],
      now: NOW,
    });
    expect(
      triggersFor(steadyShop({ baseline })).some((t) => t.type === "ORDER_VALUE_BELOW_NORMAL")
    ).toBe(false);
  });

  it("notices a narrower range than usual", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [
        order("2026-03-18", 22000, 2),
        order("2026-03-04", 22400, 8),
        order("2026-02-20", 22400, 8),
      ],
      visits: [],
      now: NOW,
    });
    const trigger = triggersFor(steadyShop({ baseline })).find(
      (t) => t.type === "LINE_ITEMS_BELOW_NORMAL"
    )!;
    expect(trigger.why).toBe(
      "Usually takes 8 lines an order, based on 3 recent orders. The last one had 2."
    );
  });

  it("stays quiet about range for a shop that only ever buys a line or two", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-18", 22000, 1), order("2026-03-04", 22400, 2), order("2026-02-20", 22400, 2)],
      visits: [],
      now: NOW,
    });
    expect(
      triggersFor(steadyShop({ baseline })).some((t) => t.type === "LINE_ITEMS_BELOW_NORMAL")
    ).toBe(false);
  });
});

describe("category opportunity", () => {
  it("names a category the shop usually buys but skipped", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [
        order("2026-03-04", 22400, 6, ["Daal"]),
        order("2026-02-20", 22400, 6, ["Daal", "Rice"]),
        order("2026-02-08", 22000, 6, ["Daal", "Rice"]),
        order("2026-01-27", 23000, 6, ["Daal", "Rice"]),
      ],
      visits: [],
      now: NOW,
    });
    const trigger = triggersFor(steadyShop({ baseline })).find(
      (t) => t.type === "CATEGORY_REORDER_OPPORTUNITY"
    )!;
    expect(trigger.headline).toContain("Rice");
    expect(trigger.recommendedAction).toBe("Offer Rice on the next visit");
  });

  it("says nothing when the last order covered everything they usually buy", () => {
    expect(
      triggersFor(steadyShop()).some((t) => t.type === "CATEGORY_REORDER_OPPORTUNITY")
    ).toBe(false);
  });
});

describe("collection trigger", () => {
  it("fires on the canonical overdue figure and outranks a possible order", () => {
    const triggers = triggersFor(steadyShop({ overdueAmount: 42000 }));
    const collection = triggers.find((t) => t.type === "COLLECTION_DUE")!;
    expect(collection.headline).toBe("Sharma Stores has ₹42,000 overdue");
    expect(collection.why).toContain("Finance shows");
    const orderDue = triggers.find((t) => t.type === "ORDER_DUE")!;
    expect(collection.priority).toBeGreaterThan(orderDue.priority);
  });

  it("stays quiet on a shop with nothing overdue", () => {
    expect(triggersFor(steadyShop()).some((t) => t.type === "COLLECTION_DUE")).toBe(false);
  });
});

describe("visit trigger", () => {
  it("fires when a visit is far past the shop's own rhythm", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-04"), order("2026-02-20"), order("2026-02-08")],
      visits: [{ visitedAt: at("2026-01-10") }],
      now: NOW,
    });
    expect(triggersFor(steadyShop({ baseline })).some((t) => t.type === "VISIT_OVERDUE")).toBe(true);
  });

  it("does not fire for a shop visited recently", () => {
    expect(triggersFor(steadyShop()).some((t) => t.type === "VISIT_OVERDUE")).toBe(false);
  });
});

describe("every trigger explains itself", () => {
  it("carries a reason, measurements, an action and a relevance window", () => {
    const triggers = triggersFor(steadyShop({ overdueAmount: 5000, valueShare: 0.2 }));
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(trigger.why.length).toBeGreaterThan(10);
      expect(trigger.measurements.length).toBeGreaterThan(0);
      expect(trigger.recommendedAction.length).toBeGreaterThan(0);
      expect(trigger.priority).toBeGreaterThanOrEqual(0);
      expect(trigger.priority).toBeLessThanOrEqual(100);
      expect(trigger.expiresAt.getTime()).toBeGreaterThan(trigger.generatedAt.getTime());
      expect(trigger.salespersonId).toBe("staff-1");
      expect(trigger.retailerId).toBe("r1");
    }
  });
});

describe("ordering and summarising", () => {
  it("puts the most important first and breaks ties stably", () => {
    const triggers = triggersFor(steadyShop({ overdueAmount: 42000 }));
    const sorted = sortTriggers(triggers);
    expect(sorted[0].type).toBe("COLLECTION_DUE");
    expect(sortTriggers([...triggers].reverse()).map((t) => t.type)).toEqual(
      sorted.map((t) => t.type)
    );
  });

  it("rolls triggers into the short lines Today shows", () => {
    const first = triggersFor(steadyShop({ overdueAmount: 20000 }));
    const second = triggersFor(
      steadyShop({ retailerId: "r2", retailerName: "Verma Kirana", overdueAmount: 22000 })
    );
    const summary = summarise([...first, ...second]);
    expect(summary).toContainEqual(
      expect.objectContaining({
        type: "COLLECTION_DUE",
        count: 2,
        headline: "₹42,000 collections due",
      })
    );
    expect(summary).toContainEqual(
      expect.objectContaining({
        type: "ORDER_DUE",
        count: 2,
        headline: "2 retailers overdue for an order",
      })
    );
  });

  it("leads with the most urgent line, not the alphabetically first", () => {
    // One overdue payment and one category nudge: the money comes first even
    // though both are a single finding.
    const summary = summarise(triggersFor(steadyShop({ overdueAmount: 42000 })));
    expect(summary[0].type).toBe("COLLECTION_DUE");
    expect(summary[0].priority).toBeGreaterThan(summary[summary.length - 1].priority);
  });

  it("uses the singular for a single finding", () => {
    const summary = summarise(triggersFor(steadyShop()));
    expect(summary.find((s) => s.type === "ORDER_DUE")?.headline).toBe(
      "1 retailer overdue for an order"
    );
  });
});
