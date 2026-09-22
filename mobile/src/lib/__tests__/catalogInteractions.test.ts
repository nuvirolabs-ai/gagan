import { describe, expect, it } from "vitest";
import { canChangeCatalogQuantity, resolveCatalogCategory } from "../catalogInteractions";

describe("catalog interactions", () => {
  it("does not allow a non-orderable SKU to enter the cart", () => {
    expect(canChangeCatalogQuantity({ price: 100, orderable: false }, 0, 1)).toBe(false);
    expect(canChangeCatalogQuantity({ price: 100, orderable: false }, 1, 0)).toBe(true);
  });

  it("keeps availability guards for unavailable stock while allowing removal", () => {
    expect(canChangeCatalogQuantity({ price: 100, orderable: true, availability: { status: "available", available: 0 } }, 0, 1)).toBe(false);
    expect(canChangeCatalogQuantity({ price: 100, orderable: true, availability: { status: "available", available: 0 } }, 1, 0)).toBe(true);
    expect(canChangeCatalogQuantity({ price: 100, orderable: true, availability: { status: "unknown" } }, 0, 1)).toBe(true);
  });

  it("allows an API-approved GST-pending variant but still blocks other pending rows", () => {
    expect(canChangeCatalogQuantity({
      price: 1620,
      orderable: true,
      gstPending: true,
      availability: { status: "available", available: 100 },
    }, 0, 1)).toBe(true);
    expect(canChangeCatalogQuantity({
      price: 2500,
      orderable: false,
      gstPending: true,
      availability: { status: "available", available: 100 },
    }, 0, 1)).toBe(false);
  });

  it("accepts a banner category only when the current catalogue exposes it", () => {
    expect(resolveCatalogCategory("Daal", ["Daal", "Rice"])).toBe("Daal");
    expect(resolveCatalogCategory("Pulses", ["Pulses", "Rice"])).toBe("Pulses");
    expect(resolveCatalogCategory("Daal", ["Rice"])).toBe("All");
  });
});
