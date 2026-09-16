import { describe, expect, it } from "vitest";
import { resolveSalesOrderAllocation, RoutingPolicyError } from "./routing";

const line = (variantId: string, routingClass: string, quantity = 1, routingBagEquivalent: string | null = "1") => ({
  variantId,
  quantity,
  routingClass,
  routingBagEquivalent,
  caseWeightKg: "30",
});

describe("Jain/Padam sales-order routing policy", () => {
  it("routes the entire Indore City order to Jain, regardless of threshold", () => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Indore City",
      lines: [line("laxmi", "LAXMI_TOOR"), line("other", "OTHER", 10)],
    });
    expect(plan.destination).toBe("INDORE_CITY");
    expect(plan.lines.map((entry) => entry.entity)).toEqual(["jain_traders", "jain_traders"]);
    expect(plan.lines.map((entry) => entry.reason)).toEqual(["INDORE_CITY_OVERRIDE", "INDORE_CITY_OVERRIDE"]);
  });

  it("routes a 20-bag Indore basket to Jain before evaluating the threshold", () => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Indore",
      lines: [line("rice", "OTHER", 8), line("dal", "OTHER", 7), line("sugar", "OTHER", 5)],
    });
    expect(plan.eligibleContributionBags).toBe("0.000");
    expect(plan.lines).toHaveLength(3);
    expect(plan.lines.every((entry) => entry.entity === "jain_traders")).toBe(true);
  });

  it.each([
    ["Laxmi only", [line("laxmi", "LAXMI_TOOR")], ["jain_traders"]],
    ["Laxmi plus four eligible bags", [line("laxmi", "LAXMI_TOOR"), line("other", "OTHER", 4)], ["jain_traders", "jain_traders"]],
    ["Laxmi plus five eligible bags", [line("laxmi", "LAXMI_TOOR"), line("other", "OTHER", 5)], ["jain_traders", "padam_international"]],
    ["non-Laxmi below threshold", [line("other", "OTHER", 4)], ["jain_traders"]],
    ["non-Laxmi at threshold", [line("other", "OTHER", 5)], ["padam_international"]],
  ])("applies the documented bag threshold: %s", (_name, lines, expected) => {
    const plan = resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines });
    expect(plan.lines.map((entry) => entry.entity)).toEqual(expected);
  });

  it("aggregates eligible products while excluding Laxmi from the threshold", () => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("laxmi", "LAXMI_TOOR", 8), line("rice", "OTHER", 2), line("dal", "OTHER", 3)],
    });
    expect(plan.eligibleContributionBags).toBe("5.000");
    expect(Object.fromEntries(plan.lines.map((entry) => [entry.variantId, entry.entity]))).toEqual({
      laxmi: "jain_traders",
      rice: "padam_international",
      dal: "padam_international",
    });
  });

  it("keeps ten Laxmi bags Jain while four eligible bags keep the whole order Jain", () => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("laxmi", "LAXMI_TOOR", 10), line("other", "OTHER", 4)],
    });
    expect(plan.eligibleContributionBags).toBe("4.000");
    expect(plan.lines.map((entry) => entry.entity)).toEqual(["jain_traders", "jain_traders"]);
  });

  it.each([
    ["below five bags", 2, 2, "jain_traders"],
    ["at five bags", 2, 3, "padam_international"],
  ])("treats Khade Anaj and other dal as one eligible threshold: %s", (_name, khade, other, expected) => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("khade-anaj", "OTHER", khade), line("other-dal", "OTHER", other)],
    });
    expect(plan.eligibleContributionBags).toBe((khade + other).toFixed(3));
    expect(plan.lines.map((entry) => entry.entity)).toEqual([expected, expected]);
  });

  it("supports the only approved weight-based Instant Mix exception", () => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("laxmi", "LAXMI_TOOR"), { ...line("mix", "INSTANT_MIX", 1, null), caseWeightKg: "4.999" }],
    });
    expect(plan.lines.map((entry) => entry.entity)).toEqual(["jain_traders", "jain_traders"]);
    expect(plan.lines[1].reason).toBe("LAXMI_INSTANT_MIX_LT_5KG");
  });

  it("fails closed for mixed Instant Mix units without an approved conversion", () => {
    expect(() => resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("laxmi", "LAXMI_TOOR"), { ...line("mix", "INSTANT_MIX", 1, null), caseWeightKg: "6" }],
    })).toThrow("ROUTING_POLICY_UNRESOLVED");
  });

  it("requires explicit destination and SKU classifications", () => {
    expect(() => resolveSalesOrderAllocation({ destinationCity: null, lines: [line("x", "OTHER")] })).toThrow("ROUTING_DESTINATION_REQUIRED");
    expect(() => resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines: [line("x", "UNKNOWN")] })).toThrow("ROUTING_CLASS_INVALID");
    expect(() => resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines: [line("x", "OTHER", 1, null)] })).toThrow("ROUTING_DATA_NOT_READY");
  });

  it("is deterministic for equivalent input ordering", () => {
    const a = resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines: [line("b", "OTHER", 3), line("a", "OTHER", 2)] });
    const b = resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines: [line("a", "OTHER", 2), line("b", "OTHER", 3)] });
    expect(a).toEqual(b);
  });
});
