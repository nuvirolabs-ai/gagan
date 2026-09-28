import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { approvedCatalogueImage } from "./catalogueVisibility";
import { DEFAULT_WAREHOUSE_CODE, inventoryForVariant } from "../inventory/inventoryService";

const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const setupSchema = z.object({
  gstPercent: money.refine(value => Number(value) <= 100).nullable(),
  sellingEntity: z.enum(["jain_traders", "padam_international"]).nullable(),
  routingClass: z.enum(["LAXMI_TOOR", "INSTANT_MIX", "OTHER"]).nullable(),
  routingBagEquivalent: z.string().regex(/^\d+(?:\.\d{1,3})?$/).nullable(),
  prices: z.array(z.object({ tierId: z.string().min(1), rate: z.union([money, z.literal("")]), rateBasis: z.enum(["case", "quintal"]) })),
});
export type OrderingSetupValues = z.infer<typeof setupSchema>;

export class OrderingSetupError extends Error {
  constructor(public code: string, public status = 409, public blockers: string[] = []) { super(code); }
}

function serialize(values: unknown) { return JSON.stringify(values); }
function fingerprint(values: unknown) { return crypto.createHash("sha256").update(serialize(values)).digest("hex"); }

async function current(db: Prisma.TransactionClient | typeof prisma, variantId: string) {
  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: true, priceList: { orderBy: { tierId: "asc" } } } });
  if (!variant) throw new OrderingSetupError("pack_not_found", 404);
  const [tiers, stock, draft] = await Promise.all([
    db.tier.findMany({ orderBy: { name: "asc" } }),
    inventoryForVariant(db, variantId),
    db.catalogOrderingDraft.findUnique({ where: { variantId } }),
  ]);
  const effective: OrderingSetupValues = {
    gstPercent: variant.gstPercent?.toString() ?? null,
    sellingEntity: variant.sellingEntity as OrderingSetupValues["sellingEntity"],
    routingClass: variant.routingClass as OrderingSetupValues["routingClass"],
    routingBagEquivalent: variant.routingBagEquivalent?.toString() ?? null,
    prices: variant.priceList.map(price => ({ tierId: price.tierId, rate: price.price.toString(), rateBasis: price.rateBasis as "case" | "quintal" })),
  };
  const inventory = stock ? { warehouseCode: stock.warehouseCode, available: stock.available, status: stock.status, source: stock.source, syncedAt: stock.syncedAt.toISOString() } : null;
  const revision = fingerprint({ variant: {
    id: variant.id, productId: variant.productId, catalogStatus: variant.catalogStatus,
    productStatus: variant.product.catalogStatus, catalogKey: variant.catalogKey,
    internalCode: variant.internalCode, pack: [variant.unitSize, variant.unit, variant.unitsPerCase, variant.unitWeightKg.toString()],
    gstPendingOrderAllowed: variant.gstPendingOrderAllowed,
  }, effective, inventory, draftUpdatedAt: draft?.updatedAt.toISOString() ?? null });
  return { variant, tiers, inventory, effective, draft, revision };
}

function blockersFor(state: Awaited<ReturnType<typeof current>>, values: OrderingSetupValues) {
  const blockers: string[] = [];
  const { variant, inventory, tiers } = state;
  if (!["pending_review", "published", "active"].includes(variant.catalogStatus) || !["pending_review", "published", "active"].includes(variant.product.catalogStatus)) blockers.push("Pack is not in an editable catalogue state.");
  if (!variant.catalogKey || !variant.internalCode || !variant.product.catalogKey || !variant.product.internalCode) blockers.push("Approved catalogue identity is missing.");
  if (approvedCatalogueImage(variant) === "missing") blockers.push("Approved pack image is missing.");
  if (variant.unitsPerCase <= 0 || !variant.unitWeightKg.isPositive()) blockers.push("Approved pack conversion is missing.");
  if (values.gstPercent === null && !variant.gstPendingOrderAllowed) blockers.push("Select an approved GST rate.");
  if (values.routingClass && values.sellingEntity) blockers.push("Dynamic routing cannot also have a fixed selling company.");
  if (!values.routingClass && !values.sellingEntity) blockers.push("Select the approved billing rule.");
  if (values.routingClass === "OTHER" && (!values.routingBagEquivalent || Number(values.routingBagEquivalent) <= 0)) blockers.push("Enter the approved bag equivalent for Other routing.");
  if (values.routingClass !== "OTHER" && values.routingBagEquivalent !== null) blockers.push("Remove the bag equivalent for this routing rule.");
  const tierIds = new Set(tiers.map(tier => tier.id));
  const priceIds = values.prices.map(price => price.tierId);
  if (new Set(priceIds).size !== priceIds.length || priceIds.some(id => !tierIds.has(id))) blockers.push("Price tier selection changed. Reload setup.");
  if (!tiers.length || tiers.some(tier => !values.prices.some(price => price.tierId === tier.id && Number(price.rate) > 0))) blockers.push("Set a positive rate for each applicable price tier.");
  if (!inventory) blockers.push("Waiting for inventory. Use the authorised inventory import or refresh.");
  else if (inventory.status === "stale") blockers.push("Stock verification has expired. Refresh stock through the authorised inventory flow.");
  else if (inventory.status === "unavailable" || inventory.available <= 0) blockers.push("This pack is out of stock.");
  return blockers;
}

function packLabel(variant: { unitSize: string; unit: string; unitsPerCase: number }) {
  const unitSize = variant.unitSize.trim().replace(/\s+/g, " ");
  const unit = variant.unit.trim();
  const unitAlreadyIncluded = unit && new RegExp(`\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b$`, "i").test(unitSize);
  return `${unitAlreadyIncluded ? unitSize : `${unitSize} ${unit}`} × ${variant.unitsPerCase}`;
}

export async function getOrderingSetup(variantId: string) {
  const state = await current(prisma, variantId);
  const values = state.draft ? setupSchema.parse(state.draft.values) : state.effective;
  return present(state, values);
}

function present(state: Awaited<ReturnType<typeof current>>, values: OrderingSetupValues) {
  const { variant, inventory, tiers, effective, revision } = state;
  return {
    revision,
    product: { id: variant.product.id, name: variant.product.name, status: variant.product.catalogStatus },
    pack: { id: variant.id, label: packLabel(variant), unitSize: variant.unitSize, unit: variant.unit, unitsPerCase: variant.unitsPerCase, unitWeightKg: Number(variant.unitWeightKg), caseWeightKg: Number(variant.unitWeightKg) * variant.unitsPerCase, status: variant.catalogStatus },
    tiers: tiers.map(tier => ({ id: tier.id, name: tier.name })), inventory, values, effective,
    hasDraft: !!state.draft,
    gstPendingException: variant.gstPendingOrderAllowed,
    blockers: blockersFor(state, values),
  };
}

export async function saveOrderingDraft(variantId: string, revision: string, input: unknown, actorStaffId: string) {
  const values = setupSchema.parse(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Variant" WHERE id = ${variantId} FOR UPDATE`;
    const state = await current(tx, variantId);
    if (state.revision !== revision) throw new OrderingSetupError("setup_changed");
    await tx.catalogOrderingDraft.upsert({ where: { variantId }, create: { variantId, values, updatedByStaffId: actorStaffId }, update: { values, updatedByStaffId: actorStaffId } });
    await tx.auditEvent.create({ data: { actorStaffId, action: "catalog.ordering_draft_saved", subjectType: "variant", subjectId: variantId, metadata: { before: state.draft?.values ?? null, after: values } } });
    return present(await current(tx, variantId), values);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function enableOrdering(variantId: string, revision: string, input: unknown, actorStaffId: string) {
  const values = setupSchema.parse(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Variant" WHERE id = ${variantId} FOR UPDATE`;
    const state = await current(tx, variantId);
    if (state.revision !== revision) throw new OrderingSetupError("setup_changed");
    const blockers = blockersFor(state, values);
    if (blockers.length) throw new OrderingSetupError("setup_blocked", 409, blockers);
    const before = state.effective;
    const isAlreadyActive = state.variant.catalogStatus === "active";
    await tx.variant.update({ where: { id: variantId }, data: {
      catalogStatus: "active", sellingEntity: values.sellingEntity, gstPercent: values.gstPercent,
      gstPendingOrderAllowed: values.gstPercent === null && state.variant.gstPendingOrderAllowed,
      routingClass: values.routingClass, routingBagEquivalent: values.routingBagEquivalent,
    } });
    if (state.variant.product.catalogStatus === "pending_review" || state.variant.product.catalogStatus === "published") await tx.product.update({ where: { id: state.variant.productId }, data: { catalogStatus: "active" } });
    for (const price of values.prices) await tx.priceList.upsert({ where: { tierId_variantId: { tierId: price.tierId, variantId } }, create: { tierId: price.tierId, variantId, productId: state.variant.productId, price: price.rate, rateBasis: price.rateBasis }, update: { price: price.rate, rateBasis: price.rateBasis } });
    await tx.catalogOrderingDraft.deleteMany({ where: { variantId } });
    await tx.auditEvent.create({ data: { actorStaffId, action: isAlreadyActive ? "catalog.ordering_setup_changed" : "catalog.ordering_enabled", subjectType: "variant", subjectId: variantId, metadata: { before, after: values, pack: { productId: state.variant.productId, variantId }, inventory: state.inventory } } });
    return present(await current(tx, variantId), values);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
