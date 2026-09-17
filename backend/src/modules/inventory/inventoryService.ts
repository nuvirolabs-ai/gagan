import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_WAREHOUSE_CODE = "WH-001";
export const INVENTORY_STALE_AFTER_MS = 60 * 60 * 1000;

export type InventoryInput = {
  productId: string;
  variantId?: string | null;
  sapMaterialId?: string | null;
  /** Controlled staging/UAT identity; never copied into an SAP field. */
  inventoryIdentity?: string | null;
  warehouseCode?: string;
  onHand: number;
  committed?: number;
  syncedAt?: Date;
  source?: string;
};

export type InventoryIdentity = { kind: "internal" | "sap"; value: string };

export function inventoryIdentityForProduct(product: {
  inventoryIdentity?: string | null;
  sapMaterialId?: string | null;
}): InventoryIdentity | null {
  const internal = product.inventoryIdentity?.trim();
  if (internal) return { kind: "internal", value: internal };
  const sap = product.sapMaterialId?.trim();
  return sap ? { kind: "sap", value: sap } : null;
}

export function inventoryLookupKey(snapshot: {
  inventoryIdentity?: string | null;
  sapMaterialId?: string | null;
}): string | null {
  const identity = inventoryIdentityForProduct(snapshot);
  return identity ? `${identity.kind}:${identity.value}` : null;
}

export class InventoryValidationError extends Error {
  constructor(
    public readonly code: "inventory_unavailable" | "inventory_stale" | "insufficient_inventory",
    public readonly details: Record<string, unknown>
  ) {
    super(code);
    this.name = "InventoryValidationError";
  }
}

function statusFor(available: number): "available" | "low" | "unavailable" {
  if (available <= 0) return "unavailable";
  return available <= 10 ? "low" : "available";
}

export async function upsertInventorySnapshot(db: Db = prisma, input: InventoryInput) {
  const internal = input.inventoryIdentity?.trim() || null;
  const sap = input.sapMaterialId?.trim() || null;
  if ((internal && sap) || (!internal && !sap)) throw new Error("inventory_identity_required_exactly_once");
  const committed = input.committed ?? 0;
  const available = Math.max(input.onHand - committed, 0);
  const syncedAt = input.syncedAt ?? new Date();
  const warehouseCode = input.warehouseCode ?? DEFAULT_WAREHOUSE_CODE;
  const where = internal
    ? { inventoryIdentity_warehouseCode: { inventoryIdentity: internal, warehouseCode } }
    : { sapMaterialId_warehouseCode: { sapMaterialId: sap!, warehouseCode } };
  return db.inventorySnapshot.upsert({
    where,
    update: {
      productId: input.productId,
      variantId: input.variantId ?? null,
      onHand: input.onHand,
      committed,
      available,
      status: statusFor(available),
      source: input.source ?? "sap",
      syncedAt,
    },
    create: {
      productId: input.productId,
      variantId: input.variantId ?? null,
      ...(sap ? { sapMaterialId: sap } : { inventoryIdentity: internal! }),
      warehouseCode,
      onHand: input.onHand,
      committed,
      available,
      status: statusFor(available),
      source: input.source ?? "sap",
      syncedAt,
    },
  });
}

export async function inventoryForVariant(
  db: Db,
  variantId: string,
  now = new Date(),
  warehouseCode = DEFAULT_WAREHOUSE_CODE
) {
  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  const identity = variant ? inventoryIdentityForProduct(variant.product) : null;
  if (!identity) return null;
  const snapshot = identity.kind === "internal"
    ? await db.inventorySnapshot.findUnique({ where: { inventoryIdentity_warehouseCode: { inventoryIdentity: identity.value, warehouseCode } } })
    : await db.inventorySnapshot.findUnique({ where: { sapMaterialId_warehouseCode: { sapMaterialId: identity.value, warehouseCode } } });
  if (!snapshot) return null;
  const stale = now.getTime() - snapshot.syncedAt.getTime() > INVENTORY_STALE_AFTER_MS;
  return {
    ...snapshot,
    onHand: Number(snapshot.onHand),
    committed: Number(snapshot.committed),
    available: Number(snapshot.available),
    status: stale ? "stale" as const : snapshot.status,
  };
}

export async function validateOrderInventory(
  db: Db,
  items: Array<{ variantId: string; qty: number }>,
  now = new Date(),
  warehouseCode = DEFAULT_WAREHOUSE_CODE
): Promise<void> {
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.qty);

  for (const [variantId, qty] of quantities) {
    if (qty <= 0) continue;
    const snapshot = await inventoryForVariant(db, variantId, now, warehouseCode);
    if (!snapshot) {
      throw new InventoryValidationError("inventory_unavailable", { variantId, warehouseCode });
    }
    if (snapshot.status === "stale") {
      throw new InventoryValidationError("inventory_stale", { variantId, warehouseCode, syncedAt: snapshot.syncedAt });
    }
    if (snapshot.status === "unavailable" || Number(snapshot.available) < qty) {
      throw new InventoryValidationError("insufficient_inventory", {
        variantId,
        warehouseCode,
        requested: qty,
        available: Number(snapshot.available),
      });
    }
  }
}
