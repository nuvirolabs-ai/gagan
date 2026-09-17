import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import {
  applyRealCatalogueManifest,
  assertRealCatalogueTarget,
  buildRealCatalogueManifest,
  promoteRealCatalogueManifest,
  publishRealCatalogueManifest,
  realCatalogueDecisionsSha256,
  resolveRealCatalogueDecisions,
  type DriveImageEntry,
} from "../realCatalogue";

const imageIndex: DriveImageEntry[] = [
  {
    folder: "Rice",
    folderId: "rice-folder",
    fileName: "IMG_BROKEN (30 Kg x 1).jpg",
    driveFileId: "drive-broken",
  },
  {
    folder: "Sehmat Poha -Sabudana - Instant Mix",
    folderId: "instant-folder",
    fileName: "IMG_MOONG MIX (500 gm x 60).jpg",
    driveFileId: "drive-mix",
  },
];

function workbookBuffer() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["SKU WISE ITEM LIST"],
    ["S.NO", "TYPE OF ITEM", "BRAND NAME", "GROUP NAME", "ITEM NAME", "SKU NAME", "PACKING SIZE", "MASTER BAG/BOX SIZE", "PRICE\nPER QUINTAL"],
    [1, "RICE", "GAGAN", "GAGAN BASMATI RICE", "BROKEN", "BROKEN (30 Kg x 1)", "30 KG", "30KG BAG", 5400],
    [2, "RICE", "GAGAN", "GAGAN BASMATI RICE", "BROKEN", "BROKEN (30 Kg x 1)", "30 KG", "30KG BAG", 5400],
    [3, "INSTANT MIX", "SEHMAT", "SEHMAT INSTANT MIX", "MOONG MIX", "MOONG MIX (500 gm x 60)", "500 GM", "30KG BAG", 8000],
    [4, "RICE", "SEHMAT", "SEHMAT RICE", "G11", "SEHMAT G11", "30 KG", "30KG BAG", 4000],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "PRODUCT LIST");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("real catalogue source mapping", () => {
  it("normalizes the observed header, deduplicates exact rows, and preserves source rows", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    expect(manifest.source).toMatchObject({
      sheet: "PRODUCT LIST",
      headerRow: 2,
      dataRows: 4,
      uniqueVariantRows: 3,
      duplicateSourceRows: [4],
    });
    expect(manifest.records[0].sourceRows).toEqual([3, 4]);
    expect(manifest.records[0].unitsPerCase).toBe(1);
    expect(manifest.records[0].caseWeightKg).toBe("30");
  });

  it("uses exact image identity and keeps unresolved cases pending review", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const rice = manifest.records.find((record) => record.source.skuName.startsWith("BROKEN"));
    const instant = manifest.records.find((record) => record.source.skuName.startsWith("MOONG MIX"));
    const incomplete = manifest.records.find((record) => record.source.skuName === "SEHMAT G11");

    expect(rice?.image).toMatchObject({ status: "matched", assetPath: expect.stringMatching(/^\/catalog-images\/real\/[a-f0-9]+\.jpg$/) });
    expect(instant?.routingClass).toBe("INSTANT_MIX");
    expect(instant?.routingBagEquivalent).toBeNull();
    expect(incomplete?.unitsPerCase).toBe(1);
    expect(incomplete?.unitWeightKg).toBe("30");
    expect(incomplete?.caseWeightKg).toBe("30");
    expect(incomplete?.conversionSource).toBe("packing_size_and_master_bag");
    expect(incomplete?.readinessBlockers).toContain("stable_internal_catalogue_identity_requires_approval");
    expect(manifest.records.every((record) => record.catalogStatus === "pending_review")).toBe(true);
  });

  it("creates a stable source batch identity for repeat dry runs", () => {
    const first = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const second = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    expect(second.source.sha256).toBe(first.source.sha256);
    expect(second.source.batchKey).toBe(first.source.batchKey);
    expect(second.records.map((record) => record.variantKey)).toEqual(first.records.map((record) => record.variantKey));
  });

  it("resolves only explicit decisions and keeps omitted rows pending", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const row = manifest.records[0];
    const resolved = resolveRealCatalogueDecisions(manifest, {
      schemaVersion: 1,
      approval: {
        approvalId: "approval-test-1",
        revision: 1,
        approvedBy: "owner-test",
        approvedAt: "2026-09-17T00:00:00.000Z",
        scope: "two reviewed catalogue rows",
        source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
      },
      imageMappingRevision: "images-v1",
      records: [{
        variantKey: row.variantKey,
        productInternalCode: "GAGAN-INT-BROKEN",
        variantInternalCode: "GAGAN-INT-BROKEN-30KG",
        gstPercent: "5",
        priceLists: [{ tierId: "tier-gold", rate: "5400", rateBasis: "quintal", gstIncluded: false }],
        inventory: { sapMaterialId: "reviewed-material", warehouseCode: "WH-001", evidence: "owner mapping sheet row 1" },
        routing: { routingClass: "OTHER", routingBagEquivalent: "1.000", sellingEntity: null },
        image: { driveFileId: "drive-broken", mappingRevision: "images-v1", evidence: "exact SKU filename" },
      }],
    });

    expect(resolved.manifest.records[0]).toMatchObject({ catalogStatus: "active", productInternalCode: "GAGAN-INT-BROKEN", variantInternalCode: "GAGAN-INT-BROKEN-30KG", gstPercent: "5", approvalRevision: 1 });
    expect(resolved.manifest.records[0].readinessBlockers).toEqual([]);
    expect(resolved.manifest.records[1].catalogStatus).toBe("pending_review");
    expect(resolved.manifest.records[1].readinessBlockers).toContain("stable_internal_catalogue_identity_requires_approval");
    expect(resolved.approvalSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects an image decision outside the exact candidate set", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    expect(() => resolveRealCatalogueDecisions(manifest, {
      schemaVersion: 1,
      approval: {
        approvalId: "approval-test-2",
        revision: 1,
        approvedBy: "owner-test",
        approvedAt: "2026-09-17T00:00:00.000Z",
        scope: "invalid image test",
        source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
      },
      imageMappingRevision: "images-v1",
      records: [{ variantKey: manifest.records[0].variantKey, image: { driveFileId: "not-a-candidate", mappingRevision: "images-v1" } }],
    })).toThrow("decision_image_not_a_candidate");
  });

  it("rejects a reviewed quintal rate that changes the supplied workbook amount", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    expect(() => resolveRealCatalogueDecisions(manifest, {
      schemaVersion: 1,
      approval: {
        approvalId: "approval-test-price",
        revision: 1,
        approvedBy: "owner-test",
        approvedAt: "2026-09-17T00:00:00.000Z",
        scope: "invalid price change test",
        source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
      },
      imageMappingRevision: "images-v1",
      records: [{
        variantKey: manifest.records[0].variantKey,
        priceLists: [{ tierId: "tier-gold", rate: "5401", rateBasis: "quintal", gstIncluded: false }],
      }],
    })).toThrow("decision_price_does_not_match_source");
  });

  it("rejects duplicate internal codes across different approved identities", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    expect(() => resolveRealCatalogueDecisions(manifest, {
      schemaVersion: 1,
      approval: {
        approvalId: "approval-test-identity-collision",
        revision: 1,
        approvedBy: "owner-test",
        approvedAt: "2026-09-17T00:00:00.000Z",
        scope: "duplicate identity test",
        source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
      },
      imageMappingRevision: "images-v1",
      records: manifest.records.slice(0, 2).map((record, index) => ({
        variantKey: record.variantKey,
        productCatalogKey: `approved-product-${index}`,
        productInternalCode: "GAGAN-INT-P-COLLISION",
        variantInternalCode: `GAGAN-INT-V-${index}`,
      })),
    })).toThrow("duplicate_decisions_productInternalCode");
  });

  it("records GST-exclusive workbook interpretation without selecting a target tier", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const resolved = resolveRealCatalogueDecisions(manifest, {
      schemaVersion: 1,
      approval: {
        approvalId: "approval-test-price-basis",
        revision: 1,
        approvedBy: "owner-test",
        approvedAt: "2026-09-17T00:00:00.000Z",
        decisionSource: "owner approval in current task",
        scope: "workbook rates are GST-exclusive quintal rates; target tier remains unresolved",
        source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
      },
      pricing: {
        sourceRateBasis: "quintal",
        gstTreatment: "exclusive",
        targetTierId: null,
        targetTierStatus: "unresolved",
        evidence: "owner approval: workbook prices are before GST and retain per-quintal basis",
      },
      imageMappingRevision: "images-v1",
      records: [],
    });

    expect(resolved.decisions.pricing).toEqual({
      sourceRateBasis: "quintal",
      gstTreatment: "exclusive",
      targetTierId: null,
      targetTierStatus: "unresolved",
      evidence: "owner approval: workbook prices are before GST and retain per-quintal basis",
    });
    expect(resolved.manifest.records.every((record) => record.catalogStatus === "pending_review")).toBe(true);
  });

  it("keeps an explicit retirement allowlist narrow and durable", () => {
    const manifest = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const decisions = resolveRealCatalogueDecisions(manifest, {
      schemaVersion: 1,
      approval: {
        approvalId: "approval-test-retirement",
        revision: 1,
        approvedBy: "owner-test",
        approvedAt: "2026-09-17T00:00:00.000Z",
        scope: "one identified legacy test product",
        source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
      },
      imageMappingRevision: "images-v1",
      records: [],
      retireCandidates: [{
        productId: "legacy-product-id",
        expectedName: "Legacy demo product",
        expectedSapMaterialId: null,
        variantIds: ["legacy-variant-id"],
        reason: "verified test-only record with no historical order references",
      }],
    });
    expect(decisions.decisions.retireCandidates).toEqual([{
      productId: "legacy-product-id",
      expectedName: "Legacy demo product",
      expectedSapMaterialId: null,
      variantIds: ["legacy-variant-id"],
      reason: "verified test-only record with no historical order references",
    }]);
  });

  it("requires the exact staging identity rather than a database-name prefix", () => {
    process.env.REAL_CATALOGUE_ALLOW_STAGING = "1";
    expect(() => assertRealCatalogueTarget(
      "postgresql://localhost/gagan_staging_other?schema=public",
      "gagan-staging",
      { serviceName: "gagan-api", serviceId: "srv-dak1ppu1egvs7397s9c0", hostname: "https://gagan-srat.onrender.com", databaseName: "gagan_staging_other", schema: "public" },
    )).toThrow("staging_database_identity_guard_failed");
    expect(() => assertRealCatalogueTarget(
      "postgresql://localhost/gagan_staging_9ftt?schema=public",
      "gagan-staging",
      { serviceName: "gagan-api", serviceId: "srv-dak1ppu1egvs7397s9c0", hostname: "https://gagan-srat.onrender.com", databaseName: "gagan_staging_9ftt", schema: "public" },
    )).not.toThrow();
    delete process.env.REAL_CATALOGUE_ALLOW_STAGING;
  });

  it("changes the import batch for a new approval revision while reusing stable identities", async () => {
    if (!process.env.DATABASE_URL) return;
    const url = new URL(process.env.DATABASE_URL);
    if (!(url.hostname === "localhost" || url.hostname === "127.0.0.1") || !url.pathname.includes("test")) return;
    const base = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const run = crypto.randomUUID();
    const sourceSha256 = crypto.createHash("sha256").update(`${base.source.sha256}:${run}`).digest("hex");
    const sourceRecord = {
      ...base.records[0],
      productKey: `real-catalogue:test-product:${run}`,
      variantKey: `real-catalogue:test-variant:${run}`,
      catalogProductKey: null,
      catalogVariantKey: null,
      image: { ...base.records[0].image, assetPath: "/catalog-images/real/revision-one.jpg" },
    };
    const manifest = {
      ...base,
      source: { ...base.source, sha256: sourceSha256, batchKey: `real-catalogue:test:${sourceSha256}` },
      records: [sourceRecord],
    };
    const stableProductKey = `real-catalogue:stable-product:${run}`;
    const stableVariantKey = `real-catalogue:stable-variant:${run}`;
    const reviewedManifest = {
      ...manifest,
      records: [{ ...sourceRecord, catalogProductKey: stableProductKey, catalogVariantKey: stableVariantKey }],
    };
    const actor = await prisma.staffUser.findFirstOrThrow();
    const approval = (revision: number, imageMappingRevision: string) => ({
      approvalId: "catalogue-approval-test",
      approvalRevision: revision,
      approvalSha256: realCatalogueDecisionsSha256({
        schemaVersion: 1,
        approval: {
          approvalId: "catalogue-approval-test",
          revision,
          approvedBy: "test-owner",
          approvedAt: "2026-09-17T00:00:00.000Z",
          scope: "batch advancement regression",
          source: { workbookSha256: base.source.sha256, sourceVersion: base.source.version },
        },
        imageMappingRevision,
        records: [],
      }),
      imageMappingRevision,
      scope: "batch advancement regression",
    });
    const firstApproval = approval(1, "images-v1");
    const sourceImport = await applyRealCatalogueManifest(prisma, manifest, { actorStaffId: actor.id, targetLabel: "disposable-local" });
    const first = await applyRealCatalogueManifest(prisma, reviewedManifest, { actorStaffId: actor.id, targetLabel: "disposable-local", approval: firstApproval });
    const replay = await applyRealCatalogueManifest(prisma, reviewedManifest, { actorStaffId: actor.id, targetLabel: "disposable-local", approval: firstApproval });
    const secondManifest = { ...reviewedManifest, records: [{ ...reviewedManifest.records[0], image: { ...reviewedManifest.records[0].image, assetPath: "/catalog-images/real/revision-two.jpg" } }] };
    const second = await applyRealCatalogueManifest(prisma, secondManifest, { actorStaffId: actor.id, targetLabel: "disposable-local", approval: approval(2, "images-v2") });

    expect(sourceImport).toMatchObject({ createdProducts: 1, createdVariants: 1, pendingReviewRows: 1 });
    expect(first).toMatchObject({ updatedProducts: 1, updatedVariants: 1, pendingReviewRows: 1 });
    expect(replay).toEqual(first);
    expect(second).toMatchObject({ updatedProducts: 1, updatedVariants: 1, pendingReviewRows: 1 });
    expect(await prisma.product.count({ where: { catalogKey: stableProductKey } })).toBe(1);
    expect(await prisma.product.count({ where: { catalogKey: sourceRecord.productKey } })).toBe(0);
    expect(await prisma.variant.count({ where: { catalogKey: stableVariantKey } })).toBe(1);
    expect(await prisma.variant.count({ where: { catalogKey: sourceRecord.variantKey } })).toBe(0);
    expect(await prisma.variant.findUniqueOrThrow({ where: { catalogKey: stableVariantKey } })).toMatchObject({ imageUrl: "/catalog-images/real/revision-two.jpg" });
    expect(await prisma.catalogImportBatch.count({ where: { sourceSha256 } })).toBe(3);

    await prisma.catalogImportBatch.deleteMany({ where: { sourceSha256 } });
    const variant = await prisma.variant.findUnique({ where: { catalogKey: stableVariantKey } });
    if (variant) await prisma.variant.delete({ where: { id: variant.id } });
    const product = await prisma.product.findUnique({ where: { catalogKey: stableProductKey } });
    if (product) await prisma.product.delete({ where: { id: product.id } });
  });

  it("persists approved internal identity while deferring routing until promotion", async () => {
    if (!process.env.DATABASE_URL) return;
    const url = new URL(process.env.DATABASE_URL);
    if (!(url.hostname === "localhost" || url.hostname === "127.0.0.1") || !url.pathname.includes("test")) return;
    const base = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const run = crypto.randomUUID();
    const sourceSha256 = crypto.createHash("sha256").update(`${base.source.sha256}:approved-fields:${run}`).digest("hex");
    const sourceRecord = {
      ...base.records[0],
      productKey: `real-catalogue:product:${run}`,
      variantKey: `real-catalogue:variant:${run}`,
      productInternalCode: `GAGAN-INT-P-${run}`,
      variantInternalCode: `GAGAN-INT-V-${run}`,
      routingClass: "OTHER" as const,
      routingBagEquivalent: "1.000",
      image: { ...base.records[0].image, assetPath: `/catalog-images/real/${run}.jpg` },
    };
    const manifest = {
      ...base,
      source: { ...base.source, sha256: sourceSha256, batchKey: `real-catalogue:approved-fields:${sourceSha256}` },
      records: [sourceRecord],
    };
    const actor = await prisma.staffUser.findFirstOrThrow();
    try {
      await applyRealCatalogueManifest(prisma, manifest, { actorStaffId: actor.id, targetLabel: "disposable-local" });
      expect(await prisma.product.findUniqueOrThrow({ where: { catalogKey: sourceRecord.productKey } })).toMatchObject({ internalCode: sourceRecord.productInternalCode });
      expect(await prisma.variant.findUniqueOrThrow({ where: { catalogKey: sourceRecord.variantKey } })).toMatchObject({
        internalCode: sourceRecord.variantInternalCode,
        routingClass: null,
        routingBagEquivalent: null,
      });
    } finally {
      await prisma.catalogImportBatch.deleteMany({ where: { sourceSha256 } });
      const variant = await prisma.variant.findUnique({ where: { catalogKey: sourceRecord.variantKey } });
      if (variant) await prisma.variant.delete({ where: { id: variant.id } });
      const product = await prisma.product.findUnique({ where: { catalogKey: sourceRecord.productKey } });
      if (product) await prisma.product.delete({ where: { id: product.id } });
    }
  });

  it("archives only an exact legacy retirement candidate during promotion", async () => {
    if (!process.env.DATABASE_URL) return;
    const url = new URL(process.env.DATABASE_URL);
    if (!(url.hostname === "localhost" || url.hostname === "127.0.0.1") || !url.pathname.includes("test")) return;
    const base = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const run = crypto.randomUUID();
    const sourceSha256 = crypto.createHash("sha256").update(`${base.source.sha256}:retirement:${run}`).digest("hex");
    const sourceRecord = {
      ...base.records[0],
      productKey: `real-catalogue:product:${run}`,
      variantKey: `real-catalogue:variant:${run}`,
      image: { ...base.records[0].image, assetPath: `/catalog-images/real/${run}.jpg` },
    };
    const manifest = {
      ...base,
      source: { ...base.source, sha256: sourceSha256, batchKey: `real-catalogue:promotion:${sourceSha256}` },
      records: [sourceRecord],
    };
    const actor = await prisma.staffUser.findFirstOrThrow();
    const tier = await prisma.tier.findFirstOrThrow();
    const legacyProduct = await prisma.product.create({ data: { name: `Catalogue retirement test ${run}`, category: "Daal", sapMaterialId: `DEMO-RETIRE-${run}` } });
    const legacyVariant = await prisma.variant.create({ data: { productId: legacyProduct.id, unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: "1", catalogStatus: "test" } });
    let sourceProductId: string | undefined;
    let sourceVariantId: string | undefined;
    try {
      await applyRealCatalogueManifest(prisma, manifest, { actorStaffId: actor.id, targetLabel: "disposable-local" });
      const sourceProduct = await prisma.product.findUniqueOrThrow({ where: { catalogKey: sourceRecord.productKey } });
      const sourceVariant = await prisma.variant.findUniqueOrThrow({ where: { catalogKey: sourceRecord.variantKey } });
      sourceProductId = sourceProduct.id;
      sourceVariantId = sourceVariant.id;
      const inventory = await prisma.inventorySnapshot.create({ data: { productId: sourceProduct.id, variantId: sourceVariant.id, sapMaterialId: `PROMOTION-MAT-${run}`, warehouseCode: "WH-001", onHand: 100, available: 100, status: "available", syncedAt: new Date() } });
      const decisions = {
        schemaVersion: 1,
        approval: {
          approvalId: `promotion-approval-${run}`,
          revision: 1,
          approvedBy: "owner-test",
          approvedAt: "2026-09-17T00:00:00.000Z",
          scope: "promotion retirement regression",
          source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
        },
        imageMappingRevision: "images-v1",
        records: [{
          variantKey: sourceRecord.variantKey,
          productInternalCode: `PROMOTION-P-${run}`,
          variantInternalCode: `PROMOTION-V-${run}`,
          gstPercent: "5",
          priceLists: [{ tierId: tier.id, rate: "5400", rateBasis: "quintal", gstIncluded: false }],
          inventory: { sapMaterialId: inventory.sapMaterialId, warehouseCode: inventory.warehouseCode, evidence: "disposable promotion regression" },
          routing: { routingClass: "OTHER", routingBagEquivalent: "1", sellingEntity: null },
          image: { driveFileId: "drive-broken", mappingRevision: "images-v1", assetPath: `/catalog-images/real/${sourceRecord.variantKey.replace("real-catalogue:variant:", "")}.jpg` },
        }],
        retireCandidates: [{ productId: legacyProduct.id, expectedName: legacyProduct.name, expectedSapMaterialId: legacyProduct.sapMaterialId, variantIds: [legacyVariant.id], reason: "explicit disposable test retirement" }],
      };
      const result = await promoteRealCatalogueManifest(prisma, manifest, { actorStaffId: actor.id, targetLabel: "disposable-local", decisions });
      expect(result).toMatchObject({ phase: "promote", updatedProducts: 1, updatedVariants: 1, retiredProducts: 1, retiredVariants: 1, pendingReviewRows: 0 });
      expect(await prisma.product.findUniqueOrThrow({ where: { id: legacyProduct.id } })).toMatchObject({ catalogKey: null, catalogStatus: "archived" });
      expect(await prisma.variant.findUniqueOrThrow({ where: { id: legacyVariant.id } })).toMatchObject({ catalogStatus: "archived" });
    } finally {
      if (sourceVariantId) await prisma.priceList.deleteMany({ where: { variantId: sourceVariantId } });
      await prisma.catalogImportBatch.deleteMany({ where: { sourceSha256 } });
      if (sourceVariantId) await prisma.variant.delete({ where: { id: sourceVariantId } });
      if (sourceProductId) await prisma.product.delete({ where: { id: sourceProductId } });
      await prisma.variant.delete({ where: { id: legacyVariant.id } });
      await prisma.product.delete({ where: { id: legacyProduct.id } });
    }
  });

  it("publishes every reviewed row for browsing with an explicit placeholder while keeping it non-orderable", async () => {
    if (!process.env.DATABASE_URL) return;
    const url = new URL(process.env.DATABASE_URL);
    if (!(url.hostname === "localhost" || url.hostname === "127.0.0.1") || !url.pathname.includes("test")) return;
    const base = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const sourceRecord = base.records.find((record) => record.source.skuName === "SEHMAT G11")!;
    const run = crypto.randomUUID();
    const sourceSha256 = crypto.createHash("sha256").update(`${base.source.sha256}:publish:${run}`).digest("hex");
    const manifest = {
      ...base,
      source: { ...base.source, sha256: sourceSha256, batchKey: `real-catalogue:publish:${sourceSha256}` },
      records: [{
        ...sourceRecord,
        productKey: `real-catalogue:publish-product:${run}`,
        variantKey: `real-catalogue:publish-variant:${run}`,
        image: { ...sourceRecord.image },
      }],
    };
    const actor = await prisma.staffUser.findFirstOrThrow();
    const tierIds = (await prisma.tier.findMany({ select: { id: true } })).map((tier) => tier.id);
    const decisions = {
      schemaVersion: 1,
      approval: {
        approvalId: `publish-approval-${run}`,
        revision: 1,
        approvedBy: "owner-test",
        approvedAt: "2026-09-17T00:00:00.000Z",
        scope: "publish visible catalogue regression",
        source: { workbookSha256: manifest.source.sha256, sourceVersion: manifest.source.version },
      },
      pricing: {
        sourceRateBasis: "quintal",
        gstTreatment: "exclusive",
        targetTierId: null,
        targetTierStatus: "all_existing_tiers",
        scope: "all_retailers",
        evidence: "owner-approved publish regression",
      },
      imageMappingRevision: "images-publish-v1",
      records: [{
        variantKey: manifest.records[0].variantKey,
        productInternalCode: `PUBLISH-P-${run}`,
        variantInternalCode: `PUBLISH-V-${run}`,
        image: { placeholderLabel: "Image coming soon", mappingRevision: "images-publish-v1", evidence: "missing image placeholder regression" },
      }],
    };
    try {
      await applyRealCatalogueManifest(prisma, manifest, { actorStaffId: actor.id, targetLabel: "disposable-local" });
      const first = await publishRealCatalogueManifest(prisma, manifest, { actorStaffId: actor.id, targetLabel: "disposable-local", decisions });
      const replay = await publishRealCatalogueManifest(prisma, manifest, { actorStaffId: actor.id, targetLabel: "disposable-local", decisions });
      const product = await prisma.product.findUniqueOrThrow({ where: { catalogKey: manifest.records[0].productKey } });
      const variant = await prisma.variant.findUniqueOrThrow({ where: { catalogKey: manifest.records[0].variantKey } });
      expect(first).toMatchObject({ phase: "publish", publishedProducts: 1, publishedVariants: 1, placeholderImages: 1, pendingImages: 0, orderableVariants: 0 });
      expect(replay).toEqual(first);
      expect(product.catalogStatus).toBe("published");
      expect(variant).toMatchObject({ catalogStatus: "published", catalogImageStatus: "placeholder", catalogImageLabel: "Image coming soon" });
      expect(await prisma.priceList.count({ where: { variantId: variant.id } })).toBe(tierIds.length);
      expect(await prisma.priceList.findMany({ where: { variantId: variant.id } })).toEqual(expect.arrayContaining(tierIds.map((tierId) => expect.objectContaining({ tierId, rateBasis: "quintal", price: expect.anything() }))));
    } finally {
      const variant = await prisma.variant.findUnique({ where: { catalogKey: manifest.records[0].variantKey } });
      if (variant) await prisma.priceList.deleteMany({ where: { variantId: variant.id } });
      await prisma.catalogImportBatch.deleteMany({ where: { sourceSha256 } });
      if (variant) await prisma.variant.delete({ where: { id: variant.id } });
      const product = await prisma.product.findUnique({ where: { catalogKey: manifest.records[0].productKey } });
      if (product) await prisma.product.delete({ where: { id: product.id } });
    }
  });
});
