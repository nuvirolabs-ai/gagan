import { describe, expect, it, vi } from "vitest";
import { OpportunityService } from "../opportunityService";

const at = (iso: string) => new Date(`${iso}T10:00:00.000Z`);
const NOW = at("2026-03-20");

const orderRow = (retailerId: string, iso: string, total: number, categories: string[]) => ({
  retailerId,
  createdAt: at(iso),
  orderTotal: String(total),
  items: categories.map((category) => ({ variant: { product: { category } } })),
});

function fakePrisma(options: {
  salesRepId?: string | null;
  retailers?: any[];
  orders?: any[];
  visits?: any[];
} = {}) {
  return {
    staffUser: {
      findUnique: vi.fn().mockResolvedValue({
        salesRepId: options.salesRepId === undefined ? "rep-1" : options.salesRepId,
      }),
    },
    retailer: { findMany: vi.fn().mockResolvedValue(options.retailers ?? []) },
    order: { findMany: vi.fn().mockResolvedValue(options.orders ?? []) },
    salesVisit: { findMany: vi.fn().mockResolvedValue(options.visits ?? []) },
  } as any;
}

describe("finding a salesperson's opportunities", () => {
  it("fires an order-due trigger from a shop's own rhythm", async () => {
    const prisma = fakePrisma({
      retailers: [
        { id: "r1", name: "Sharma Stores", overdueAmount: "0" },
        // A much larger, up-to-date account, so Sharma is an ordinary store in
        // this book rather than the whole of it.
        { id: "r2", name: "Metro Wholesale", overdueAmount: "0" },
      ],
      orders: [
        orderRow("r1", "2026-03-04", 22400, ["Daal", "Rice"]),
        orderRow("r1", "2026-02-20", 22400, ["Daal", "Rice"]),
        orderRow("r1", "2026-02-08", 22000, ["Daal", "Rice"]),
        orderRow("r2", "2026-03-18", 500000, ["Daal"]),
        orderRow("r2", "2026-03-06", 500000, ["Daal"]),
        orderRow("r2", "2026-02-22", 500000, ["Daal"]),
      ],
      visits: [
        { retailerId: "r1", checkedInAt: at("2026-03-04") },
        { retailerId: "r2", checkedInAt: at("2026-03-18") },
      ],
    });

    const result = await new OpportunityService(prisma).forSalesperson({
      salespersonId: "staff-1",
      now: NOW,
    });

    const due = result.triggers.find((trigger) => trigger.type === "ORDER_DUE");
    expect(due).toBeDefined();
    expect(due!.retailerName).toBe("Sharma Stores");
    expect(due!.why).toContain("Usually orders every 12 days");
    expect(result.retailersConsidered).toBe(2);
    expect(result.windowDays).toBeGreaterThan(0);
  });

  it("loads the whole book in a fixed number of queries", async () => {
    const retailers = Array.from({ length: 40 }, (_, index) => ({
      id: `r${index}`,
      name: `Store ${index}`,
      overdueAmount: "0",
    }));
    const prisma = fakePrisma({ retailers });
    await new OpportunityService(prisma).forSalesperson({ salespersonId: "staff-1", now: NOW });

    // One staff lookup, one retailer list, one order query, one visit query —
    // regardless of how many stores the salesperson carries.
    expect(prisma.retailer.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.salesVisit.findMany).toHaveBeenCalledTimes(1);
  });

  it("weighs a store by its share of the book", async () => {
    const orders = [
      // A large account, past its cycle.
      orderRow("r1", "2026-03-04", 400000, ["Daal"]),
      orderRow("r1", "2026-02-20", 400000, ["Daal"]),
      orderRow("r1", "2026-02-08", 400000, ["Daal"]),
      // A small one, equally past its cycle.
      orderRow("r2", "2026-03-04", 4000, ["Daal"]),
      orderRow("r2", "2026-02-20", 4000, ["Daal"]),
      orderRow("r2", "2026-02-08", 4000, ["Daal"]),
    ];
    const prisma = fakePrisma({
      retailers: [
        { id: "r1", name: "Big Traders", overdueAmount: "0" },
        { id: "r2", name: "Small Kirana", overdueAmount: "0" },
      ],
      orders,
    });
    const result = await new OpportunityService(prisma).forSalesperson({
      salespersonId: "staff-1",
      now: NOW,
    });
    expect(result.triggers[0].retailerName).toBe("Big Traders");
    expect(result.triggers[0].type).toBe("HIGH_VALUE_RETAILER_MISSED");
  });

  it("uses the canonical overdue figure for a collection trigger", async () => {
    const prisma = fakePrisma({
      retailers: [{ id: "r1", name: "Sharma Stores", overdueAmount: "40500" }],
    });
    const result = await new OpportunityService(prisma).forSalesperson({
      salespersonId: "staff-1",
      now: NOW,
    });
    expect(result.triggers.map((t) => t.type)).toContain("COLLECTION_DUE");
    expect(result.summary.find((s) => s.type === "COLLECTION_DUE")?.headline).toBe(
      "₹40,500 collections due"
    );
  });

  it("finds nothing to say about a book with no history", async () => {
    const prisma = fakePrisma({
      retailers: [{ id: "r1", name: "New Store", overdueAmount: "0" }],
    });
    const result = await new OpportunityService(prisma).forSalesperson({
      salespersonId: "staff-1",
      now: NOW,
    });
    expect(result.triggers).toEqual([]);
    expect(result.summary).toEqual([]);
  });

  it("returns nothing for staff with no book at all", async () => {
    const prisma = fakePrisma({ salesRepId: null });
    const result = await new OpportunityService(prisma).forSalesperson({
      salespersonId: "staff-1",
      now: NOW,
    });
    expect(result).toMatchObject({ triggers: [], retailersConsidered: 0 });
    expect(prisma.retailer.findMany).not.toHaveBeenCalled();
  });

  it("trims the list for Today while still counting everything in the summary", async () => {
    const retailers = Array.from({ length: 5 }, (_, index) => ({
      id: `r${index}`,
      name: `Store ${index}`,
      overdueAmount: "10000",
    }));
    const prisma = fakePrisma({ retailers });
    const result = await new OpportunityService(prisma).forSalesperson({
      salespersonId: "staff-1",
      now: NOW,
      limit: 2,
    });
    expect(result.triggers).toHaveLength(2);
    expect(result.summary.find((s) => s.type === "COLLECTION_DUE")?.count).toBe(5);
  });

  it("only considers active stores", async () => {
    const prisma = fakePrisma({ retailers: [] });
    await new OpportunityService(prisma).forSalesperson({ salespersonId: "staff-1", now: NOW });
    expect(prisma.retailer.findMany.mock.calls[0][0].where).toMatchObject({
      salesRepId: "rep-1",
      status: "active",
    });
  });

  it("excludes rejected orders from the behavioural baseline", async () => {
    const prisma = fakePrisma({ retailers: [{ id: "r1", name: "S", overdueAmount: "0" }] });
    await new OpportunityService(prisma).forSalesperson({ salespersonId: "staff-1", now: NOW });
    expect(prisma.order.findMany.mock.calls[0][0].where).toMatchObject({
      status: { not: "rejected" },
    });
  });
});

describe("one retailer's baseline", () => {
  it("summarises how that shop usually behaves", async () => {
    const prisma = fakePrisma({
      orders: [
        orderRow("r1", "2026-03-04", 22400, ["Daal"]),
        orderRow("r1", "2026-02-20", 22400, ["Daal"]),
        orderRow("r1", "2026-02-08", 22000, ["Daal"]),
      ],
      visits: [{ retailerId: "r1", checkedInAt: at("2026-03-04") }],
    });
    const baseline = await new OpportunityService(prisma).baselineForRetailer({
      retailerId: "r1",
      now: NOW,
    });
    expect(baseline).toMatchObject({
      orderCount: 3,
      medianIntervalDays: 12,
      medianOrderValue: 22400,
      daysSinceLastOrder: 16,
      hasIntervalBaseline: true,
    });
  });
});
