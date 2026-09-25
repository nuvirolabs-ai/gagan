import { describe, expect, it } from "vitest";
import { canChangeRepCatalogQuantity } from "../catalogOrdering";

describe("Salesperson catalogue quantity policy", () => {
  it("allows an explicitly orderable, stocked variant while GST is pending", () => {
    expect(canChangeRepCatalogQuantity({
      price: 1620,
      orderable: true,
      gstPending: true,
      availability: { status: "available", available: 100 },
    }, 0, 1)).toBe(true);
  });

  it("keeps other setup-pending rows blocked even with stock and a display price", () => {
    expect(canChangeRepCatalogQuantity({
      price: 2500,
      orderable: false,
      gstPending: true,
      availability: { status: "available", available: 100 },
    }, 0, 1)).toBe(false);
  });

  it("preserves stock and price checks while allowing reduction of saved quantity", () => {
    const soldOut = { price: 1620, orderable: true, availability: { status: "available", available: 0 } };
    expect(canChangeRepCatalogQuantity(soldOut, 0, 1)).toBe(false);
    expect(canChangeRepCatalogQuantity(soldOut, 2, 1)).toBe(true);
    expect(canChangeRepCatalogQuantity({ ...soldOut, price: null }, 2, 1)).toBe(false);
  });
});
