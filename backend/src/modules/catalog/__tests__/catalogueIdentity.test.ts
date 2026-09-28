import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { productCatalogueIdentity, semanticPackMatches, variantCatalogueIdentity } from "../catalogueIdentity";
import { deriveCataloguePublicationInput } from "../draftCataloguePublication";
import { buildRealCatalogueManifest } from "../realCatalogue";

const BROKEN_PRODUCT_KEY = "real-catalogue:product:724e5996749c901ed4779afe64cbd20ae9eceac8031a52d6ffccc46b84dd4655";
const BROKEN_VARIANT_KEY = "real-catalogue:variant:02231e3b302d337360ec2267a0651f8b3592c8c5a2374ca06f1b8521c3d5f84b";

function workbook() {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["SKU WISE ITEM LIST"],
    ["S.NO", "TYPE OF ITEM", "BRAND NAME", "GROUP NAME", "ITEM NAME", "SKU NAME", "PACKING SIZE", "MASTER BAG/BOX SIZE", "PRICE\nPER QUINTAL"],
    [1, "RICE", "GAGAN", "GAGAN BASMATI RICE", "BROKEN", "BROKEN (30 Kg x 1)", "30 KG", "30KG BAG", 5400],
  ]);
  XLSX.utils.book_append_sheet(book, sheet, "PRODUCT LIST");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

function workbookFor(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["SKU WISE ITEM LIST"],
    ["S.NO", "TYPE OF ITEM", "BRAND NAME", "GROUP NAME", "ITEM NAME", "SKU NAME", "PACKING SIZE", "MASTER BAG/BOX SIZE", "PRICE\nPER QUINTAL"],
    ...rows,
  ]);
  XLSX.utils.book_append_sheet(book, sheet, "PRODUCT LIST");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

function expectAdminIdentityMatchesWorkbook(row: unknown[], input: Parameters<typeof deriveCataloguePublicationInput>[0]) {
  const record = buildRealCatalogueManifest(workbookFor([row]), "catalogue.xlsx").records[0];
  const semantic = deriveCataloguePublicationInput(input);
  const product = productCatalogueIdentity(semantic);
  const variant = variantCatalogueIdentity(semantic);
  const workbookProduct = productCatalogueIdentity({ brandName: String(row[2]), groupName: String(row[3]), productLabel: String(record.productName).replace(new RegExp(`^${String(row[2])}\\s+`, "i"), "") });
  const workbookVariant = variantCatalogueIdentity({ brandName: String(row[2]), groupName: String(row[3]), skuName: String(row[5]), packingSize: String(row[6]), masterBagBoxSize: String(row[7]) });
  expect(product.catalogKey).toBe(record.productKey);
  expect(product.internalCode).toBe(workbookProduct.internalCode);
  expect(variant.catalogKey).toBe(record.variantKey);
  expect(variant.internalCode).toBe(workbookVariant.internalCode);
}

describe("catalogue identity", () => {
  it("keeps the workbook product and variant keys after the helper extraction", () => {
    const record = buildRealCatalogueManifest(workbook(), "catalogue.xlsx").records[0];
    const product = productCatalogueIdentity({ brandName: "GAGAN", groupName: "GAGAN BASMATI RICE", productLabel: "BROKEN" });
    const variant = variantCatalogueIdentity({
      brandName: "GAGAN",
      groupName: "GAGAN BASMATI RICE",
      skuName: "BROKEN (30 Kg x 1)",
      packingSize: "30 KG",
      masterBagBoxSize: "30KG BAG",
    });
    expect(record.productKey).toBe(BROKEN_PRODUCT_KEY);
    expect(record.variantKey).toBe(BROKEN_VARIANT_KEY);
    expect(product).toMatchObject({ catalogKey: BROKEN_PRODUCT_KEY, internalCode: `GAGAN-INT-P-${BROKEN_PRODUCT_KEY.split(":").at(-1)}` });
    expect(variant).toMatchObject({ catalogKey: BROKEN_VARIANT_KEY, internalCode: `GAGAN-INT-V-${BROKEN_VARIANT_KEY.split(":").at(-1)}` });
  });

  it("does not treat the stored display name as the product identity", () => {
    const fromName = productCatalogueIdentity({ brandName: "UAT Testing Daal", groupName: "UAT Testing Daal", productLabel: "UAT Testing Daal" });
    const fromTuple = productCatalogueIdentity({ brandName: "GAGAN", groupName: "GAGAN BASMATI RICE", productLabel: "BROKEN" });
    expect(fromName.catalogKey).not.toBe(fromTuple.catalogKey);
  });

  it("matches workbook identity for a Gagan product whose display name includes the brand prefix", () => {
    expectAdminIdentityMatchesWorkbook(
      [1, "DAAL", "GAGAN", "GAGAN TOOR DAL", "TOOR DAL", "TOOR DAL (1 Kg x 30)", "1 KG", "30KG BAG", 5400],
      {
        product: { name: "Gagan Toor Dal", brandName: "Gagan", groupName: "Gagan Toor Dal", category: "Daal" },
        pack: { unitSize: "1 KG", unit: "kg", unitsPerCase: 30, unitWeightKg: 1, outerPack: "Bag" },
      },
    );
  });

  it("matches workbook identity for an alternate brand without hardcoding Gagan", () => {
    expectAdminIdentityMatchesWorkbook(
      [1, "DAAL", "LAXMI", "LAXMI TOOR", "TOOR DAL", "TOOR DAL (1 Kg x 30)", "1 KG", "30KG BAG", 5400],
      {
        product: { name: "Laxmi Toor Dal", brandName: "Laxmi", groupName: "Laxmi Toor", category: "Daal" },
        pack: { unitSize: "1 KG", unit: "kg", unitsPerCase: 30, unitWeightKg: 1, outerPack: "Bag" },
      },
    );
  });

  it("does not equate broad Admin category with canonical product group", () => {
    const semantic = deriveCataloguePublicationInput({
      product: { name: "Gagan Broken", brandName: "Gagan", groupName: "Gagan Basmati Rice", category: "Rice" },
      pack: { unitSize: "30 KG", unit: "kg", unitsPerCase: 1, unitWeightKg: 30, outerPack: "Bag" },
    });
    expect(productCatalogueIdentity(semantic).catalogKey).toBe(BROKEN_PRODUCT_KEY);
    expect(productCatalogueIdentity({ brandName: "Gagan", groupName: "Rice", productLabel: "Broken" }).catalogKey).not.toBe(BROKEN_PRODUCT_KEY);
  });

  it("rejects semantic metadata that describes a different pack", () => {
    const actual = { unitWeightKg: 1, unitsPerCase: 30 };
    expect(semanticPackMatches({ skuName: "TESTING (1 Kg x 30)", packingSize: "1 KG", masterBagBoxSize: "30KG BAG" }, actual)).toBe(true);
    expect(semanticPackMatches({ skuName: "TESTING (500 g x 20)", packingSize: "500 G", masterBagBoxSize: "10KG BAG" }, actual)).toBe(false);
    expect(semanticPackMatches({ skuName: "TESTING (1 Kg x 30)", packingSize: "1 KG", masterBagBoxSize: "20KG BAG" }, actual)).toBe(false);
  });
});
