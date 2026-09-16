import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildRealCatalogueManifest, type DriveImageEntry } from "../realCatalogue";

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
    expect(incomplete?.unitsPerCase).toBeNull();
    expect(incomplete?.readinessBlockers).toContain("case_conversion_missing_from_source");
    expect(manifest.records.every((record) => record.catalogStatus === "pending_review")).toBe(true);
  });

  it("creates a stable source batch identity for repeat dry runs", () => {
    const first = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    const second = buildRealCatalogueManifest(workbookBuffer(), "catalogue.xlsx", imageIndex);
    expect(second.source.sha256).toBe(first.source.sha256);
    expect(second.source.batchKey).toBe(first.source.batchKey);
    expect(second.records.map((record) => record.variantKey)).toEqual(first.records.map((record) => record.variantKey));
  });
});
