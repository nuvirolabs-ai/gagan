import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_WAREHOUSE_CODE = "WH-001";
export const INVENTORY_STALE_AFTER_MS = 60 * 60 * 1000;

export function internalStagingInventoryEnabled() {
  return ["staging", "test"].includes(process.env.NODE_ENV ?? "") && process.env.SAP_MODE === "mock";
}

/** The caller has already scoped snapshots to one warehouse. Preserve external
 * mappings, and accept internal inventory only for the exact UAT variant. */
export function selectInventorySnapshot<T extends {
  sapMaterialId: string | null; internalMaterialId?: string | null;
  productId: string; variantId: string | null; source: string;
}>(product: { id: string; sapMaterialId: string | null }, variant: { id: string; internalCode: string | null }, snapshots: T[]): T | undefined {
  if (product.sapMaterialId) return snapshots.find(s => s.sapMaterialId === product.sapMaterialId);
  if (!internalStagingInventoryEnabled() || !variant.internalCode) return undefined;
  return snapshots.find(s => s.sapMaterialId === null && s.source === "staging_uat"
    && s.internalMaterialId === variant.internalCode && s.variantId === variant.id && s.productId === product.id);
}

export type InventoryInput = {
  productId: string;
  variantId?: string | null;
  sapMaterialId?: string;
  internalMaterialId?: string;
  warehouseCode?: string;
  onHand: number;
  committed?: number;
  syncedAt?: Date;
  source?: string;
};

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
  const sapMaterialId = input.sapMaterialId?.trim() || null;
  const internalMaterialId = input.internalMaterialId?.trim() || null;
  if ((sapMaterialId === null) === (internalMaterialId === null)) {
    throw new Error("inventory_identity_required_exactly_once");
  }
  if (internalMaterialId !== null) {
    if (!internalStagingInventoryEnabled() || !input.variantId || input.source !== "staging_uat") {
      throw new Error("internal_inventory_requires_staging_mock_variant");
    }
  }
  const committed = input.committed ?? 0;
  const available = Math.max(input.onHand - committed, 0);
  const syncedAt = input.syncedAt ?? new Date();
  const warehouseCode = input.warehouseCode ?? DEFAULT_WAREHOUSE_CODE;
  const data = {
    productId: input.productId,
    variantId: input.variantId ?? null,
    sapMaterialId,
    internalMaterialId,
    warehouseCode,
    onHand: input.onHand,
    committed,
    available,
    status: statusFor(available),
    source: internalMaterialId !== null ? "staging_uat" : input.source ?? "sap",
    syncedAt,
  };
  if (internalMaterialId !== null) {
    return db.inventorySnapshot.upsert({
      where: { internalMaterialId_warehouseCode: { internalMaterialId, warehouseCode } },
      update: data,
      create: data,
    });
  }
  return db.inventorySnapshot.upsert({
    where: {
      sapMaterialId_warehouseCode: {
        sapMaterialId: sapMaterialId!,
        warehouseCode,
      },
    },
    update: data,
    create: data,
  });
}

export async function inventoryForVariant(
  db: Db,
  variantId: string,
  now = new Date(),
  warehouseCode = DEFAULT_WAREHOUSE_CODE
) {
  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant) return null;
  const candidates = await db.inventorySnapshot.findMany({ where: {
    warehouseCode,
    ...(variant.product.sapMaterialId ? { sapMaterialId: variant.product.sapMaterialId } : { variantId }),
  } });
  const snapshot = selectInventorySnapshot(variant.product, variant, candidates);
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
