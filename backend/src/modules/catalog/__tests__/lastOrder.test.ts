import { describe, expect, it } from "vitest";
import { presentLastOrder, type LastOrderSource } from "../lastOrder";

const order: LastOrderSource = {
  id: "ord-1",
  createdAt: new Date("2026-08-20T10:00:00.000Z"),
  status: "delivered",
  items: [
    {
      variantId: "v-chana",
      qtyOrdered: 3,
      variant: {
        unitSize: "1 kg",
        unitsPerCase: 30,
        product: {
          id: "p-chana",
          name: "Chana Dal",
          category: "Daal",
          imageUrl: "/catalog-images/chana-dal.png",
        },
      },
    },
    {
      variantId: "v-gone",
      qtyOrdered: 2,
      variant: {
        unitSize: "1 kg",
        unitsPerCase: 30,
        product: {
          id: "p-gone",
          name: "Delisted",
          category: "Daal",
          imageUrl: null,
        },
      },
    },
  ],
};

describe("presentLastOrder", () => {
  it("uses the current price, never the historic unit price", () => {
    const prices = new Map<string, number | null>([
      ["v-chana", 2990],
      ["v-gone", null],
    ]);
    const view = presentLastOrder(order, prices, (url) => url);

    expect(view?.items).toEqual([
      expect.objectContaining({
        variantId: "v-chana",
        qty: 3,
        price: 2990,
        packDetail: "1 kg × 30",
      }),
    ]);
    expect(view?.items.every((item) => item.price !== 2850)).toBe(true);
  });

  it("returns null when nothing is currently orderable", () => {
    expect(presentLastOrder(order, new Map(), (url) => url)).toBeNull();
    expect(presentLastOrder(null, new Map([["v-chana", 2990]]), (url) => url)).toBeNull();
  });

  it("does not invent a last order for an empty item list", () => {
    expect(
      presentLastOrder(
        { ...order, items: [] },
        new Map([["v-chana", 2990]]),
        (url) => url
      )
    ).toBeNull();
  });
});
