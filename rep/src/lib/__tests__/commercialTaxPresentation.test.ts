import { describe, expect, it } from "vitest";
import { commercialTaxPresentation, isLineGstPending } from "../commercialTaxPresentation";

describe("commercial tax presentation", () => {
  it("marks a pending-tax quote as pre-tax", () => {
    expect(commercialTaxPresentation({ taxStatus: "PENDING", total: 3610, lines: [{ gstPercent: null, gst: null }] }))
      .toEqual({ pending: true, totalLabel: "Pre-tax total", gstLabel: "GST pending — final tax will be applied before invoicing." });
  });

  it("keeps a configured quote labelled as its grand total", () => {
    expect(commercialTaxPresentation({ taxStatus: "READY", total: 3610, lines: [{ gstPercent: 5, gst: 172 }] }))
      .toEqual({ pending: false, totalLabel: "Grand total", gstLabel: null });
  });

  it("does not render a placeholder zero as GST when the quote explicitly says pending", () => {
    expect(isLineGstPending({ gstPercent: 0, gst: 0 }, { taxStatus: "PENDING" })).toBe(true);
    expect(isLineGstPending({ gstPercent: 5, gst: 172 }, { taxStatus: "PENDING" })).toBe(false);
  });
});
