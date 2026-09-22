import { describe, expect, it } from "vitest";
import { catalogOrderingState, canChangeCatalogQuantity } from "../catalogOrdering";
import { catalogueOrderingState } from "../../../../backend/src/modules/catalog/catalogueVisibility";

const valid = { price: 1990, ...catalogueOrderingState("active"), availability: { status: "available", available: 10 } };

describe("Salesperson catalogue ordering controls", () => {
  it("marks the approved pre-GST staging state without disabling ordering", () => {
    expect(catalogueOrderingState("active", null, true)).toEqual({
      orderable: true,
      orderingStatus: "gst_pending",
      orderingReason: "GST pending — invoice blocked until configured",
      gstPending: true,
    });
  });

  it("allows adding and adjusting a configured, priced, available variant", () => {
    expect(catalogOrderingState(valid)).toEqual({ canIncrease: true, message: null });
    expect(canChangeCatalogQuantity(valid, 0, 1)).toBe(true);
    expect(canChangeCatalogQuantity(valid, 1, 2)).toBe(true);
  });
  it("keeps a published pack disabled even with a price and stock, without exposing internal reasons", () => {
    const published = { ...valid, ...catalogueOrderingState("published") };
    expect(catalogOrderingState(published)).toEqual({ canIncrease: false, message: "Not available for ordering" });
    expect(canChangeCatalogQuantity(published, 0, 1)).toBe(false);
  });
  it.each([
    { ...valid, price: null },
    { ...valid, availability: undefined },
    { ...valid, availability: { status: "unknown", available: null } },
    { ...valid, availability: { status: "stale", available: 10 } },
    { ...valid, availability: { status: "unavailable", available: 10 } },
    { ...valid, availability: { status: "available", available: 0 } },
  ])("keeps missing-price and non-available variants disabled: %j", (variant) => {
    expect(catalogOrderingState(variant).canIncrease).toBe(false);
    expect(canChangeCatalogQuantity(variant, 0, 1)).toBe(false);
  });
  it("allows removal of a saved priced line that becomes unavailable", () => {
    const blocked = { ...valid, ...catalogueOrderingState("published") };
    expect(canChangeCatalogQuantity(blocked, 2, 1)).toBe(true);
    expect(canChangeCatalogQuantity(blocked, 1, 0)).toBe(true);
    expect(canChangeCatalogQuantity(blocked, 2, 3)).toBe(false);
  });
});
