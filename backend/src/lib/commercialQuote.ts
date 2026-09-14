import { Prisma } from "@prisma/client";

type DecimalInput = string;
export type SellingEntity = "jain_traders" | "padam_international";

export interface CommercialQuoteLine {
  productName?: string;
  pack?: string;
  itemCode?: string | null;
  variantId: string;
  entity: SellingEntity;
  cases: number;
  caseWeightKg: DecimalInput;
  rate: DecimalInput;
  rateBasis: "case" | "quintal";
  gstPercent: DecimalInput;
  /** Delivery-only accepted weight. Absent for checkout. */
  deliveredWeightKg?: string;
}

export interface ManagerFreight {
  entity: SellingEntity;
  /** Final charge entered by the manager, excluding explicitly configured tax. */
  amount: DecimalInput;
  recordedQuintals: DecimalInput;
  recordedKilometres: DecimalInput;
  /** Required: absence must not silently mean zero-rated freight. */
  gstPercent: DecimalInput;
}

function decimal(value: string, field: string, positive = false): Prisma.Decimal {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  const result = new Prisma.Decimal(value);
  if (!result.isFinite() || (positive && !result.isPositive())) throw new Error(`Invalid ${field}`);
  return result;
}

function money(value: string, field: string): Prisma.Decimal {
  const result = decimal(value, field);
  if (result.decimalPlaces() > 2) throw new Error(`Invalid ${field} precision`);
  return result;
}

function taxRate(value: string): Prisma.Decimal {
  const result = money(value, "GST percentage");
  if (result.gt(100)) throw new Error("Invalid GST percentage");
  return result;
}

function entity(value: SellingEntity): SellingEntity {
  if (value !== "jain_traders" && value !== "padam_international") throw new Error("Invalid selling entity");
  return value;
}

const rounded = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const serialized = (value: Prisma.Decimal) => value.toFixed(2);

/** Shared order/delivery calculation. Inputs come from authorized server records
 * or accepted transaction snapshots, never client-supplied prices. */
export function calculateCommercialQuote(input: { lines: CommercialQuoteLine[]; freight?: ManagerFreight }) {
  if (!input.lines.length) throw new Error("Quote requires items");
  const seen = new Set<string>();
  const totals = new Map<SellingEntity, { goods: Prisma.Decimal; freight: Prisma.Decimal; tax: Prisma.Decimal }>();
  const bucket = (key: SellingEntity) => {
    entity(key);
    let value = totals.get(key);
    if (!value) {
      value = { goods: new Prisma.Decimal(0), freight: new Prisma.Decimal(0), tax: new Prisma.Decimal(0) };
      totals.set(key, value);
    }
    return value;
  };
  const lines = input.lines.map(line => {
    if (!line.variantId || seen.has(line.variantId)) throw new Error("Duplicate or missing SKU");
    seen.add(line.variantId);
    if (!Number.isSafeInteger(line.cases) || line.cases < 0 || (line.cases === 0 && line.deliveredWeightKg === undefined)) throw new Error("Invalid case quantity");
    if (line.rateBasis !== "case" && line.rateBasis !== "quintal") throw new Error("Invalid rate basis");
    const caseWeight = decimal(line.caseWeightKg, "case weight", true);
    const kilograms = line.deliveredWeightKg === undefined ? caseWeight.mul(line.cases) : decimal(line.deliveredWeightKg, "delivered weight");
    const quintals = kilograms.div(100);
    const basisQuantity = line.rateBasis === "case" ? kilograms.div(caseWeight) : quintals;
    const base = rounded(money(line.rate, "rate").mul(basisQuantity));
    const gst = rounded(base.mul(taxRate(line.gstPercent)).div(100));
    const group = bucket(line.entity);
    group.goods = group.goods.add(base);
    group.tax = group.tax.add(gst);
    return { ...line, weightKg: kilograms.toString(), quintals: quintals.toString(), discount: "0.00", base: serialized(base), gst: serialized(gst), total: serialized(base.add(gst)) };
  });
  let freight;
  if (input.freight) {
    const source = input.freight;
    // Supporting measures are recorded, never multiplied into the final charge.
    decimal(source.recordedQuintals, "freight quintals");
    decimal(source.recordedKilometres, "freight kilometres");
    if (!totals.has(entity(source.entity))) throw new Error("Freight entity must sell an item in this quote");
    const amount = money(source.amount, "freight amount");
    const gst = rounded(amount.mul(taxRate(source.gstPercent)).div(100));
    const group = bucket(source.entity);
    group.freight = group.freight.add(amount);
    group.tax = group.tax.add(gst);
    freight = { ...source, gst: serialized(gst), total: serialized(amount.add(gst)) };
  }
  const entities = [...totals].map(([sellingEntity, group]) => ({
    entity: sellingEntity,
    goods: serialized(group.goods), freight: serialized(group.freight), gst: serialized(group.tax),
    total: serialized(group.goods.add(group.freight).add(group.tax)),
  }));
  return { lines, freight: freight ?? null, entities,
    total: serialized(entities.reduce((sum, group) => sum.add(group.total), new Prisma.Decimal(0))) };
}
