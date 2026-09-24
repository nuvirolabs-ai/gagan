import { describe, expect, it } from "vitest";
import { orderAttributionLabel } from "../../lib/orderAttribution";

describe("retailer order attribution", () => {
  it("names the salesperson for rep orders and the app for retailer orders", () => {
    expect(orderAttributionLabel({ source: "SALESPERSON_APP", creatorName: "Asha Verma" }))
      .toBe("Order punched by Asha Verma");
    expect(orderAttributionLabel({ source: "RETAILER_APP" }))
      .toBe("Order placed via Retailer App");
  });

  it("keeps older order payloads readable without inventing a salesperson name", () => {
    expect(orderAttributionLabel({ placedBy: "rep" })).toBe("Order punched by Salesperson");
  });
});
