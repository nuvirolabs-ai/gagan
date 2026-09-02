import { describe, expect, it } from "vitest";
import {
  accountModel,
  currentSkuPrice,
  featuredGroup,
  formatDeliveryWhen,
  greetingForHour,
  headerCopy,
  homeSurface,
  reorderLines,
  selectHero,
} from "../homePresentation";
import type { HomeLastOrder, HomeProductGroup, HomeScheme } from "../../types/home";

const groups: HomeProductGroup[] = [
  {
    id: "g-toor",
    name: "Gagan Toor Dal",
    category: "Daal",
    imageUrl: "/catalog-images/toor-dal-1kg.png",
    description: null,
    productIds: ["p-toor"],
    hasMultiplePacks: true,
    skus: [
      {
        id: "v-toor-1",
        productId: "p-toor",
        productName: "Gagan Toor Dal | 1 KG",
        packLabel: "1 kg",
        packDetail: "1 kg × 30",
        unitSize: "1 kg",
        unit: "kg",
        unitsPerCase: 30,
        price: 3150,
      },
    ],
  },
  {
    id: "g-chana",
    name: "Chana Dal",
    category: "Daal",
    imageUrl: "/catalog-images/chana-dal.png",
    description: null,
    productIds: ["p-chana"],
    hasMultiplePacks: false,
    skus: [
      {
        id: "v-chana",
        productId: "p-chana",
        productName: "Chana Dal",
        packLabel: "1 kg",
        packDetail: "1 kg × 30",
        unitSize: "1 kg",
        unit: "kg",
        unitsPerCase: 30,
        price: 2990,
      },
    ],
  },
];

const scheme: HomeScheme = {
  name: "GOLD SCHEME",
  headline: "Buy ₹25,000 this week & get ₹500 discount",
  targetAmount: 25000,
  discountAmount: 500,
  progress: 16300,
  remaining: 8700,
};

const lastOrder: HomeLastOrder = {
  id: "ord-old",
  createdAt: "2026-08-20T10:00:00.000Z",
  status: "delivered",
  items: [
    {
      variantId: "v-chana",
      productId: "p-chana",
      name: "Chana Dal",
      category: "Daal",
      imageUrl: "/catalog-images/chana-dal.png",
      packLabel: "1 kg",
      packDetail: "1 kg × 30",
      qty: 3,
      price: 2850,
    },
  ],
};

describe("greetingForHour", () => {
  it("splits the day into morning, afternoon and evening", () => {
    expect(greetingForHour(8)).toBe("home.goodMorning");
    expect(greetingForHour(13)).toBe("home.goodAfternoon");
    expect(greetingForHour(19)).toBe("home.goodEvening");
  });
});

describe("headerCopy", () => {
  it("prefers an in-flight order over scheme progress", () => {
    const copy = headerCopy({
      activeOrder: {
        id: "o1",
        orderNo: 12,
        status: "out_for_delivery",
        orderTotal: 17560,
        itemCount: 2,
        createdAt: "2026-09-02T08:00:00.000Z",
        expectedDeliveryAt: "2026-09-02T18:00:00.000Z",
      },
      scheme,
      now: new Date("2026-09-02T10:00:00"),
    });
    expect(copy.kind).toBe("active_order");
    expect(copy.subtitle).toBe("home.orderOnTheWay");
    expect(copy.deliveryCue).toMatch(/^Next delivery · /);
  });

  it("uses scheme remaining when there is no active order", () => {
    expect(headerCopy({ activeOrder: null, scheme }).kind).toBe("scheme");
    expect(headerCopy({ activeOrder: null, scheme }).subtitle).toBe("home.schemeAway");
  });

  it("falls back to stock-up copy", () => {
    expect(headerCopy({ activeOrder: null, scheme: null }).kind).toBe("stock_up");
  });

  it("does not invent a delivery day without expectedDeliveryAt", () => {
    const copy = headerCopy({
      activeOrder: {
        id: "o1",
        orderNo: 12,
        status: "confirmed",
        orderTotal: 100,
        itemCount: 1,
        createdAt: "2026-09-02T08:00:00.000Z",
        expectedDeliveryAt: null,
      },
      scheme: null,
    });
    expect(copy.deliveryCue).toBeNull();
  });
});

describe("selectHero", () => {
  it("uses the real featured scheme and never fills a fake offer", () => {
    const hero = selectHero({ scheme, activeOrder: null, productGroups: groups });
    expect(hero?.kind).toBe("scheme");
    expect(hero?.kicker).toBe("GOLD SCHEME");
    expect(hero?.title).toContain("₹25,000");
    expect(hero?.foot).toContain("8,700");
  });

  it("does not invent a scheme hero when scheme is absent", () => {
    const hero = selectHero({
      scheme: null,
      activeOrder: {
        id: "o1",
        orderNo: 4,
        status: "packed",
        orderTotal: 17560,
        itemCount: 2,
        createdAt: "2026-09-02T08:00:00.000Z",
        expectedDeliveryAt: null,
      },
      productGroups: groups,
    });
    expect(hero?.kind).toBe("active_order");
    expect(hero?.title.toLowerCase()).not.toContain("discount");
  });

  it("falls back to a real product, then to no hero", () => {
    const assortment = selectHero({ scheme: null, activeOrder: null, productGroups: groups });
    expect(assortment?.kind).toBe("assortment");
    expect(assortment?.title).toContain("Gagan Toor Dal");

    expect(selectHero({ scheme: null, activeOrder: null, productGroups: [] })).toBeNull();
  });
});

describe("accountModel", () => {
  it("does not treat a missing summary as ₹0", () => {
    expect(accountModel(undefined).kind).toBe("unavailable");
    expect(accountModel(null).outstanding).toBeNull();
    expect(accountModel(undefined).outstanding).not.toBe(0);
  });

  it("uses the paid-up state when outstanding is actually zero", () => {
    expect(
      accountModel({
        outstanding: 0,
        overdue: 0,
        creditLimit: 100000,
        used: 0,
        available: 100000,
        utilisationPct: 0,
      }).kind
    ).toBe("clear");
  });

  it("keeps overdue visible when there is a due balance", () => {
    const model = accountModel({
      outstanding: 62412,
      overdue: 40500,
      creditLimit: 100000,
      used: 62412,
      available: 37588,
      utilisationPct: 62,
    });
    expect(model.kind).toBe("due");
    expect(model.outstanding).toBe(62412);
    expect(model.overdue).toBe(40500);
    expect(model.available).toBe(37588);
  });
});

describe("reorderLines", () => {
  it("reprices from the live catalog, never the historic last-order price", () => {
    const lines = reorderLines(lastOrder, groups);
    expect(lines).toEqual([
      expect.objectContaining({
        variantId: "v-chana",
        qty: 3,
        unitPrice: 2990,
      }),
    ]);
    expect(lines[0]?.unitPrice).not.toBe(2850);
    expect(currentSkuPrice(groups, "v-chana")).toBe(2990);
  });

  it("drops SKUs that are no longer priced", () => {
    const unpriced: HomeProductGroup[] = [
      {
        ...groups[1],
        skus: [{ ...groups[1].skus[0], price: null }],
      },
    ];
    expect(reorderLines(lastOrder, unpriced)).toEqual([]);
    expect(reorderLines(null, groups)).toEqual([]);
  });
});

describe("formatDeliveryWhen", () => {
  const now = new Date(2026, 8, 2, 10, 0, 0);
  it("labels today and tomorrow without inventing a slot", () => {
    expect(formatDeliveryWhen(new Date(2026, 8, 2, 18, 0, 0).toISOString(), now)).toMatch(/^Today,/);
    expect(formatDeliveryWhen(new Date(2026, 8, 3, 18, 0, 0).toISOString(), now)).toBe("Tomorrow");
    expect(formatDeliveryWhen(null, now)).toBeNull();
  });
});

describe("featuredGroup", () => {
  it("prefers a group that actually has photography", () => {
    expect(featuredGroup(groups)?.id).toBe("g-toor");
    expect(featuredGroup([])).toBeNull();
  });
});

describe("homeSurface", () => {
  it("keeps the skeleton up until the first payload arrives", () => {
    expect(homeSurface(true, null)).toBe("skeleton");
    expect(homeSurface(false, null)).toBe("error");
    expect(homeSurface(true, { retailer: { name: "Mahesh Store" } })).toBe("ready");
  });

  it("does not treat a loading frame as a ₹0 account", () => {
    expect(homeSurface(true, null)).not.toBe("ready");
    expect(accountModel(undefined).kind).toBe("unavailable");
  });
});

describe("SKU identity", () => {
  it("keeps pack selection on the variant id", () => {
    const lines = reorderLines(lastOrder, groups);
    expect(lines[0]?.variantId).toBe("v-chana");
    expect(lines[0]?.variantId).not.toBe(lastOrder.items[0].productId);
  });
});

describe("long values stay numeric, not truncated in data", () => {
  it("keeps crore-scale balances and long store names intact", () => {
    const model = accountModel({
      outstanding: 1_24_00_000,
      overdue: 98_00_000,
      creditLimit: 2_00_00_000,
      used: 1_24_00_000,
      available: 76_00_000,
      utilisationPct: 62,
    });
    expect(model.outstanding).toBe(12400000);
    expect("Mahesh Kirana & General Stores Pvt. Ltd.".length).toBeGreaterThan(20);
  });
});
