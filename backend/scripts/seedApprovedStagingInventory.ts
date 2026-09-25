import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  assertRealCatalogueTarget,
  resolveRealCatalogueDecisions,
  type RealCatalogueManifest,
} from "../src/modules/catalog/realCatalogue";
import { internalStagingInventoryEnabled, upsertInventorySnapshot } from "../src/modules/inventory/inventoryService";

const CONTROLLED_QUANTITY = 100;
const CONTROLLED_SOURCE = "staging_uat";

function argument(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function requiredArgument(name: string) {
  const value = argument(name);
  if (!value) throw new Error(`${name}_required`);
  return value;
}

async function main() {
  const manifestPath = requiredArgument("--manifest-input");
  const decisionsPath = requiredArgument("--decisions");
  const actorStaffId = requiredArgument("--actor");
  const targetLabel = requiredArgument("--target");
  if (targetLabel !== "gagan-staging") throw new Error("staging_inventory_target_not_allowlisted");
  if (process.env.REAL_CATALOGUE_CONFIRM !== "REAL_CATALOGUE_V1") throw new Error("explicit catalogue_apply_confirmation_required");
  if (!internalStagingInventoryEnabled()) throw new Error("internal_staging_inventory_requires_staging_mock");

  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8")) as RealCatalogueManifest;
  const decisionsInput = JSON.parse(fs.readFileSync(path.resolve(decisionsPath), "utf8")) as unknown;
  const resolved = resolveRealCatalogueDecisions(manifest, decisionsInput);
  const keys = resolved.decisions.gstPendingOrdering?.variantKeys ?? [];
  if (keys.length !== 6) throw new Error("approved_pending_gst_scope_must_contain_six_variants");

  const targetIdentity = {
    serviceName: argument("--service"),
    serviceId: argument("--service-id"),
    hostname: argument("--hostname"),
    databaseName: argument("--database"),
    schema: argument("--schema"),
  };
  assertRealCatalogueTarget(process.env.DATABASE_URL ?? "", targetLabel, targetIdentity);

  const database = new PrismaClient();
  try {
    const result = await database.$transaction(async tx => {
      const now = new Date();
      const rows: Array<{ variantKey: string; variantId: string; internalMaterialId: string; warehouseCode: string; quantity: number }> = [];
      for (const variantKey of keys) {
        const record = resolved.manifest.records.find(item => item.variantKey === variantKey);
        if (!record?.inventoryMapping?.internalMaterialId || record.inventoryMapping.warehouseCode !== "WH-001") {
          throw new Error(`approved_staging_inventory_mapping_missing_${variantKey}`);
        }
        if (record.inventoryMapping.internalMaterialId !== record.variantInternalCode) {
          throw new Error(`approved_staging_inventory_identity_mismatch_${variantKey}`);
        }
        const product = await tx.product.findUnique({ where: { catalogKey: record.catalogProductKey ?? record.productKey } });
        const variant = await tx.variant.findUnique({ where: { catalogKey: record.catalogVariantKey ?? record.variantKey } });
        if (!product || !variant || variant.productId !== product.id) throw new Error(`staging_inventory_catalogue_identity_missing_${variantKey}`);
        if (product.sapMaterialId !== null) throw new Error(`staging_inventory_would_replace_sap_identity_${variantKey}`);
        await upsertInventorySnapshot(tx, {
          productId: product.id,
          variantId: variant.id,
          internalMaterialId: record.inventoryMapping.internalMaterialId,
          warehouseCode: record.inventoryMapping.warehouseCode,
          onHand: CONTROLLED_QUANTITY,
          committed: 0,
          syncedAt: now,
          source: CONTROLLED_SOURCE,
        });
        rows.push({ variantKey, variantId: variant.id, internalMaterialId: record.inventoryMapping.internalMaterialId, warehouseCode: record.inventoryMapping.warehouseCode, quantity: CONTROLLED_QUANTITY });
      }
      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: "real_catalogue.staging_inventory_seeded",
          subjectType: "RealCataloguePendingGstScope",
          subjectId: resolved.decisions.approval.approvalId,
          metadata: {
            source: CONTROLLED_SOURCE,
            approvalRevision: resolved.decisions.approval.revision,
            approvalSha256: resolved.approvalSha256,
            quantity: CONTROLLED_QUANTITY,
            warehouseCode: "WH-001",
            rows,
            note: "Controlled synthetic staging UAT inventory only; not physical or SAP stock.",
          },
        },
      });
      return { seeded: rows.length, quantityPerVariant: CONTROLLED_QUANTITY, warehouseCode: "WH-001", source: CONTROLLED_SOURCE, approvalSha256: resolved.approvalSha256 };
    }, { timeout: 120_000, maxWait: 10_000 });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await database.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "staging_inventory_seed_failed");
  process.exitCode = 1;
});
