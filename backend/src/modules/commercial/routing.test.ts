import { describe, expect, it } from "vitest";
import { resolveSalesOrderAllocation } from "./routing";

const line = (
  variantId: string,
  routingClass: string,
  quantity = 1,
  routingBagEquivalent: string | null = routingClass === "OTHER" ? "1" : null,
  caseWeightKg = "30",
) => ({
  variantId,
  quantity,
  routingClass,
  routingBagEquivalent,
  caseWeightKg,
});

const instant = (variantId: string, kilograms: number | string, quantity = 1) =>
  line(variantId, "INSTANT_MIX", quantity, null, String(kilograms));

const entitiesById = (plan: ReturnType<typeof resolveSalesOrderAllocation>) =>
  Object.fromEntries(plan.lines.map((entry) => [entry.variantId, entry.entity]));

describe("Jain/Padam sales-order routing policy", () => {
  it("routes the entire Indore City order to Jain, regardless of threshold", () => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Indore City",
      lines: [line("laxmi", "LAXMI_TOOR"), line("other", "OTHER", 10)],
    });
    expect(plan.ruleVersion).toBe("jain-padam-v2");
    expect(plan.destination).toBe("INDORE_CITY");
    expect(entitiesById(plan)).toEqual({ laxmi: "jain_traders", other: "jain_traders" });
    expect(plan.lines.every((entry) => entry.reason === "INDORE_CITY_OVERRIDE")).toBe(true);
    expect(plan.eligibleContributionBags).toBe("0.000");
  });

  it.each([
    { name: "3 KG Instant Mix + 3 OTHER bags", kilograms: "3", otherQuantity: 3, mixContribution: "0.600", contribution: "3.600", entity: "jain_traders" },
    { name: "10 KG Instant Mix + 3 OTHER bags", kilograms: "10", otherQuantity: 3, mixContribution: "2.000", contribution: "5.000", entity: "padam_international" },
    { name: "25 KG Instant Mix only", kilograms: "25", otherQuantity: 0, mixContribution: "5.000", contribution: "5.000", entity: "padam_international" },
    { name: "24 KG Instant Mix only", kilograms: "24", otherQuantity: 0, mixContribution: "4.800", contribution: "4.800", entity: "jain_traders" },
  ])("applies the approved Instant Mix conversion: $name", ({ kilograms, otherQuantity, mixContribution, contribution, entity }) => {
    const lines = [instant("mix", kilograms), ...(otherQuantity ? [line("other", "OTHER", otherQuantity)] : [])];
    const plan = resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines });
    expect(plan.eligibleContributionBags).toBe(contribution);
    expect(plan.lines.every((entry) => entry.entity === entity)).toBe(true);
    const mix = plan.lines.find((entry) => entry.variantId === "mix");
    expect(mix?.contributionBasis).toBe("INSTANT_MIX_KG_DIV_5");
    expect(Number(mix?.orderedKg)).toBe(Number(kilograms));
    expect(mix?.contributionBags).toBe(mixContribution);
  });

  it.each([
    { name: "Laxmi + 10 KG Instant Mix + 2 OTHER bags", kilograms: "10", otherQuantity: 2, contribution: "4.000", expected: { laxmi: "jain_traders", mix: "jain_traders", other: "jain_traders" } },
    { name: "Laxmi + 10 KG Instant Mix + 3 OTHER bags", kilograms: "10", otherQuantity: 3, contribution: "5.000", expected: { laxmi: "jain_traders", mix: "padam_international", other: "padam_international" } },
  ])("excludes Laxmi and aggregates Instant Mix with OTHER: $name", ({ kilograms, otherQuantity, contribution, expected }) => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("laxmi", "LAXMI_TOOR"), instant("mix", kilograms), line("other", "OTHER", otherQuantity)],
    });
    expect(plan.eligibleContributionBags).toBe(contribution);
    expect(entitiesById(plan)).toEqual(expected);
  });

  it.each(["Indore", "Indore City"])("applies the all-Jain override for %s to an Instant Mix threshold case", (destinationCity) => {
    const plan = resolveSalesOrderAllocation({
      destinationCity,
      lines: [instant("mix", 25), line("other", "OTHER", 5)],
    });
    expect(plan.destination).toBe("INDORE_CITY");
    expect(plan.lines.map((entry) => entry.entity)).toEqual(["jain_traders", "jain_traders"]);
    expect(plan.eligibleContributionBags).toBe("0.000");
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
    expect(entitiesById(plan)).toEqual({
      laxmi: "jain_traders",
      rice: "padam_international",
      dal: "padam_international",
    });
  });

  it("preserves exact decimal Instant Mix contributions without rounding", () => {
    const plan = resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [instant("mix", "24.001")],
    });
    expect(plan.eligibleContributionBags).toBe("4.8002");
    expect(plan.lines[0]).toMatchObject({ orderedKg: "24.001", contributionBags: "4.8002" });
  });

  it("requires explicit contribution metadata for OTHER products", () => {
    expect(() => resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("other", "OTHER", 1, null)],
    })).toThrow("ROUTING_DATA_NOT_READY");
  });

  it("rejects a manually supplied Instant Mix bag equivalent so the fixed policy cannot be overridden", () => {
    expect(() => resolveSalesOrderAllocation({
      destinationCity: "Bhopal",
      lines: [line("mix", "INSTANT_MIX", 1, "1", "5")],
    })).toThrow("ROUTING_DATA_NOT_READY");
  });

  it("requires explicit destination and SKU classifications", () => {
    expect(() => resolveSalesOrderAllocation({ destinationCity: null, lines: [line("x", "OTHER")] })).toThrow("ROUTING_DESTINATION_REQUIRED");
    expect(() => resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines: [line("x", "UNKNOWN")] })).toThrow("ROUTING_CLASS_INVALID");
  });

  it("is deterministic for equivalent input ordering", () => {
    const a = resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines: [line("b", "OTHER", 3), line("a", "OTHER", 2)] });
    const b = resolveSalesOrderAllocation({ destinationCity: "Bhopal", lines: [line("a", "OTHER", 2), line("b", "OTHER", 3)] });
    expect(a).toEqual(b);
  });
});
