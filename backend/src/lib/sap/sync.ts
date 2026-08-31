import { SapEntity } from "@prisma/client";
import { prisma } from "../prisma";
import { getSapConnector } from "./index";
import { nextQuarterlyCheckpoint } from "../../modules/credit/reviewSchedule";
import { upsertInventorySnapshot } from "../../modules/inventory/inventoryService";

export interface SyncOutcome {
  entity: SapEntity;
  skipped?: boolean;
  received: number;
  linked: number;
  created: number;
  updated: number;
  message?: string;
}

async function watermark(entity: SapEntity): Promise<Date | null> {
  const state = await prisma.sapSyncState.findUnique({ where: { entity } });
  return state?.lastSyncedAt ?? null;
}

async function markRunning(entity: SapEntity) {
  await prisma.sapSyncState.upsert({
    where: { entity },
    update: { lastStatus: "running" },
    create: { entity, lastStatus: "running" },
  });
}

async function markDone(entity: SapEntity, count: number, at: Date) {
  await prisma.sapSyncState.upsert({
    where: { entity },
    update: { lastStatus: "ok", lastSyncedAt: at, recordCount: count, lastMessage: null },
    create: { entity, lastStatus: "ok", lastSyncedAt: at, recordCount: count },
  });
}

async function markFailed(entity: SapEntity, message: string) {
  await prisma.sapSyncState.upsert({
    where: { entity },
    update: { lastStatus: "failed", lastMessage: message },
    create: { entity, lastStatus: "failed", lastMessage: message },
  });
}

/**
 * Wraps one entity's pull with watermark handling and status bookkeeping. The
 * watermark only advances on success, so a failed run is retried from where it
 * left off rather than skipping records.
 */
async function runEntity(
  entity: SapEntity,
  work: (since: Date | null) => Promise<Omit<SyncOutcome, "entity">>
): Promise<SyncOutcome> {
  const connector = getSapConnector();
  if (!connector.enabled) {
    return { entity, skipped: true, received: 0, linked: 0, created: 0, updated: 0, message: "SAP is not configured" };
  }

  await markRunning(entity);
  const startedAt = new Date();
  try {
    const result = await work(await watermark(entity));
    await markDone(entity, result.received, startedAt);
    return { entity, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await markFailed(entity, message);
    throw err;
  }
}

/**
 * Customers. Matches on sapCustomerId first, then falls back to phone so
 * retailers onboarded in the app before SAP access get linked rather than
 * duplicated (spec §7: "nullable SAP ID fields already in place so records can
 * be linked once sync is built").
 */
export function syncCustomers() {
  return runEntity("customers", async (since) => {
    const rows = await getSapConnector().fetchCustomers(since);
    let linked = 0;
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing =
        (await prisma.retailer.findFirst({ where: { sapCustomerId: row.sapCustomerId } })) ??
        (row.phone ? await prisma.retailer.findUnique({ where: { phone: row.phone } }) : null);

      const tier = row.priceGroup
        ? await prisma.tier.findUnique({ where: { name: row.priceGroup } })
        : null;

      if (!existing) {
        // Without a phone the retailer could never sign in, so skip rather than
        // create an unusable record.
        if (!row.phone) continue;
        await prisma.$transaction(async (tx) => {
          const retailer = await tx.retailer.create({
            data: {
              name: row.name,
              phone: row.phone!,
              shopAddress: row.shopAddress ?? "",
              tierId: tier?.id ?? (await tx.tier.findFirstOrThrow()).id,
              creditLimit: row.creditLimit ?? 0,
              sapCustomerId: row.sapCustomerId,
            },
          });
          const nextReviewAt = nextQuarterlyCheckpoint(retailer.createdAt);
          await tx.creditProfile.create({
            data: { retailerId: retailer.id, rating: "N", accountCreatedAt: retailer.createdAt, nextReviewAt },
          });
        });
        created++;
        continue;
      }

      if (existing.sapCustomerId && existing.sapCustomerId !== row.sapCustomerId) {
        await prisma.reconciliationIssue.upsert({
          where: {
            kind_referenceType_referenceId: {
              kind: "duplicate_sap_account",
              referenceType: "retailer",
              referenceId: existing.id,
            },
          },
          update: {
            status: "open",
            resolvedAt: null,
            details: {
              existingSapCustomerId: existing.sapCustomerId,
              incomingSapCustomerId: row.sapCustomerId,
            },
          },
          create: {
            retailerId: existing.id,
            kind: "duplicate_sap_account",
            referenceType: "retailer",
            referenceId: existing.id,
            ownerRole: "credit_team",
            details: {
              existingSapCustomerId: existing.sapCustomerId,
              incomingSapCustomerId: row.sapCustomerId,
            },
          },
        });
        continue;
      }

      const wasUnlinked = !existing.sapCustomerId;
      await prisma.retailer.update({
        where: { id: existing.id },
        data: {
          sapCustomerId: row.sapCustomerId,
          name: row.name,
          shopAddress: row.shopAddress ?? existing.shopAddress,
          ...(tier ? { tierId: tier.id } : {}),
          ...(row.creditLimit != null ? { creditLimit: row.creditLimit } : {}),
        },
      });
      await prisma.creditProfile.upsert({
        where: { retailerId: existing.id },
        update: {},
        create: {
          retailerId: existing.id,
          rating: "N",
          accountCreatedAt: existing.createdAt,
          nextReviewAt: nextQuarterlyCheckpoint(existing.createdAt),
        },
      });
      if (wasUnlinked) linked++;
      else updated++;
    }

    return { received: rows.length, linked, created, updated };
  });
}

/** Materials, matched on sapMaterialId then product name. */
export function syncMaterials() {
  return runEntity("materials", async (since) => {
    const rows = await getSapConnector().fetchMaterials(since);
    let linked = 0;
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing =
        (await prisma.product.findFirst({ where: { sapMaterialId: row.sapMaterialId } })) ??
        (await prisma.product.findFirst({ where: { name: row.name } }));

      if (!existing) {
        await prisma.product.create({
          data: {
            name: row.name,
            category: row.category ?? "Uncategorised",
            sapMaterialId: row.sapMaterialId,
            variants: {
              create: [
                {
                  unitSize: row.unitSize ?? "1 kg",
                  unit: row.unit ?? "kg",
                  unitsPerCase: row.unitsPerCase ?? 1,
                  unitWeightKg: row.unitWeightKg ?? 1,
                },
              ],
            },
          },
        });
        created++;
        continue;
      }

      const wasUnlinked = !existing.sapMaterialId;
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          sapMaterialId: row.sapMaterialId,
          category: row.category ?? existing.category,
        },
      });
      if (wasUnlinked) linked++;
      else updated++;
    }

    return { received: rows.length, linked, created, updated };
  });
}

/** Pricing conditions → PriceList rows for the matching tier. */
export function syncPricing() {
  return runEntity("pricing", async (since) => {
    const rows = await getSapConnector().fetchPricing(since);
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const product = await prisma.product.findFirst({
        where: { sapMaterialId: row.sapMaterialId },
        include: { variants: true },
      });
      const tier = await prisma.tier.findUnique({ where: { name: row.priceGroup } });
      // A price for a material or price group we don't know yet is not an error;
      // the next materials sync may introduce it.
      if (!product || !tier || product.variants.length === 0) {
        skipped++;
        continue;
      }

      const variant = product.variants[0];
      await prisma.priceList.upsert({
        where: { tierId_variantId: { tierId: tier.id, variantId: variant.id } },
        update: { price: row.price },
        create: {
          tierId: tier.id,
          variantId: variant.id,
          productId: product.id,
          price: row.price,
        },
      });
      updated++;
    }

    return {
      received: rows.length,
      linked: 0,
      created: 0,
      updated,
      message: skipped ? `${skipped} price row(s) had no matching material or tier` : undefined,
    };
  });
}

/** Persist warehouse-aware stock snapshots behind the SAP abstraction. */
export function syncStock() {
  return runEntity("stock", async (since) => {
    const connector = getSapConnector();
    const rows = await connector.fetchStock(since);

    // Demo inventory is deliberately disposable. Once a real (or fixture)
    // SAP stock pull succeeds, SAP becomes the source of truth and the
    // seeded fallback rows must not remain visible for products that SAP did
    // not return. The next loop writes the current warehouse snapshots.
    await prisma.inventorySnapshot.deleteMany({ where: { source: "demo-seed" } });

    let matched = 0;
    let updated = 0;
    for (const row of rows) {
      const product = await prisma.product.findFirst({
        where: { sapMaterialId: row.sapMaterialId },
        include: { variants: { take: 1 } },
      });
      if (!product || product.variants.length === 0) continue;
      matched++;
      await upsertInventorySnapshot(prisma, {
        productId: product.id,
        variantId: product.variants[0].id,
        sapMaterialId: row.sapMaterialId,
        warehouseCode: row.warehouseCode,
        onHand: row.availableQty + row.committedQty,
        committed: row.committedQty,
        syncedAt: new Date(),
      });
      updated++;
    }
    return {
      received: rows.length,
      linked: matched,
      created: 0,
      updated,
      message: matched < rows.length ? `${rows.length - matched} stock row(s) had no matching material or variant` : undefined,
    };
  });
}

/** Full master-data pull, in dependency order. */
export async function syncAll(): Promise<SyncOutcome[]> {
  const customers = await syncCustomers();
  const materials = await syncMaterials();
  const pricing = await syncPricing();
  const stock = await syncStock();
  return [customers, materials, pricing, stock];
}
