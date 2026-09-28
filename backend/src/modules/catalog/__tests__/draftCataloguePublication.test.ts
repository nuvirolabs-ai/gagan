import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { normalizeCatalogueText, productCatalogueIdentity, variantCatalogueIdentity } from "../catalogueIdentity";
import { publishDraftCatalogue, publishDraftCatalogueFromBusinessInput, publishExistingDraftCatalogueFromBusinessInput } from "../draftCataloguePublication";
import { getOrderingSetup } from "../orderingSetup";

const actor = `catalogue-publication-${randomUUID()}`;
const productIds: string[] = [];
const variantIds: string[] = [];

function scenario(label = randomUUID()) {
  const fields = { brandName: "UAT", groupName: "UAT DAAL", productLabel: label };
  return {
    oneKg: { ...fields, skuName: `${label} (1 Kg x 30)`, packingSize: "1 KG", masterBagBoxSize: "30KG BAG" },
    fiveKg: { ...fields, skuName: `${label} (5 Kg x 6)`, packingSize: "5 KG", masterBagBoxSize: "30KG BAG" },
  };
}

async function createPack(options: {
  name: string;
  pack?: { unitSize: string; unit: string; unitsPerCase: number; unitWeightKg: number };
  productStatus?: string;
  identity?: ReturnType<typeof productCatalogueIdentity> | null;
}) {
  const pack = options.pack ?? { unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1 };
  const product = await prisma.product.create({
    data: {
      name: options.name,
      category: "Daal",
      catalogStatus: options.productStatus ?? "pending_review",
      catalogKey: options.identity?.catalogKey ?? null,
      internalCode: options.identity?.internalCode ?? null,
      catalogIdentityBrand: options.identity?.brand ?? null,
      catalogIdentityGroup: options.identity?.group ?? null,
      catalogIdentityLabel: options.identity?.label ?? null,
    },
  });
  const variant = await prisma.variant.create({
    data: { productId: product.id, ...pack, catalogStatus: "pending_review", catalogImageStatus: "pending", catalogImageLabel: "Image pending confirmation" },
  });
  productIds.push(product.id);
  variantIds.push(variant.id);
  return { product, variant };
}

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { subjectId: { in: variantIds } } });
  await prisma.variant.deleteMany({ where: { id: { in: variantIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.$disconnect();
});

describe("draft catalogue publication", () => {
  it("derives catalogue identity from normal Admin business fields", async () => {
    const name = `Gagan Simple Daal ${randomUUID()}`;
    const result = await publishDraftCatalogueFromBusinessInput({
      product: { name, brandName: "Gagan", groupName: "Gagan Daal", category: "Daal", imageUrl: "https://example.test/daal.png" },
      pack: { unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1, outerPack: "Bag" },
    }, actor);
    expect(result.outcome).toBe("published");
    if (result.outcome !== "published") throw new Error("expected published result");
    productIds.push(result.product.id);
    variantIds.push(result.variant.id);

    expect(result).toMatchObject({
      outcome: "published",
      duplicateDecision: "assigned",
      product: { catalogStatus: "published", catalogIdentityBrand: "GAGAN", catalogIdentityGroup: "GAGAN DAAL", catalogIdentityLabel: name.replace(/^Gagan\s+/i, "").toUpperCase() },
      variant: { catalogStatus: "published", catalogIdentitySkuName: normalizeCatalogueText(`${name.replace(/^Gagan\s+/i, "")} (1 kg x 30)`), catalogIdentityPackingSize: "1KG", catalogIdentityMasterPack: "30KG BAG" },
    });
    const saved = await prisma.variant.findUniqueOrThrow({ where: { id: result.variant.id }, include: { product: true } });
    expect(saved.product.imageUrl).toBe("https://example.test/daal.png");
    expect(saved.imageUrl).toBe("https://example.test/daal.png");
    expect(saved.catalogImageStatus).toBe("exact");
    expect(saved.catalogImageLabel).toBe("Approved pack image");
    expect(saved.gstPercent).toBeNull();
    expect(saved.sellingEntity).toBeNull();
    expect(saved.routingClass).toBeNull();
    expect(saved.product.sapMaterialId).toBeNull();
    expect(await prisma.priceList.count({ where: { variantId: result.variant.id } })).toBe(0);
    expect(await prisma.inventorySnapshot.count({ where: { variantId: result.variant.id } })).toBe(0);
    expect((await getOrderingSetup(result.variant.id)).blockers).not.toContain("Approved catalogue identity is missing.");
    expect((await getOrderingSetup(result.variant.id)).blockers).not.toContain("Approved pack image is missing.");
  });

  it("approves an explicit placeholder when a new published product has no image", async () => {
    const name = `Gagan Placeholder Daal ${randomUUID()}`;
    const result = await publishDraftCatalogueFromBusinessInput({
      product: { name, brandName: "Gagan", groupName: "Gagan Daal", category: "Daal" },
      pack: { unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1, outerPack: "Bag" },
    }, actor);
    expect(result.outcome).toBe("published");
    if (result.outcome !== "published") throw new Error("expected published result");
    productIds.push(result.product.id);
    variantIds.push(result.variant.id);

    const saved = await prisma.variant.findUniqueOrThrow({ where: { id: result.variant.id } });
    expect(saved.imageUrl).toBeNull();
    expect(saved.catalogImageStatus).toBe("placeholder");
    expect(saved.catalogImageLabel).toBe("Image coming soon");
    const setup = await getOrderingSetup(result.variant.id);
    expect(setup.blockers).not.toContain("Approved pack image is missing.");
  });

  it("publishes a new draft without inventing commercial, inventory, or SAP data", async () => {
    const pack = scenario().oneKg;
    const { product, variant } = await createPack({ name: `UAT publication ${randomUUID()}` });
    const result = await publishDraftCatalogue(variant.id, pack, actor);
    expect(result).toMatchObject({
      outcome: "published",
      duplicateDecision: "assigned",
      product: { id: product.id, catalogStatus: "published", catalogKey: productCatalogueIdentity(pack).catalogKey, internalCode: productCatalogueIdentity(pack).internalCode, catalogIdentityBrand: "UAT" },
      variant: { id: variant.id, catalogStatus: "published", catalogKey: variantCatalogueIdentity(pack).catalogKey, internalCode: variantCatalogueIdentity(pack).internalCode },
    });
    const saved = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id }, include: { product: true } });
    expect(saved.gstPercent).toBeNull();
    expect(saved.sellingEntity).toBeNull();
    expect(saved.routingClass).toBeNull();
    expect(saved.product.sapMaterialId).toBeNull();
    expect(await prisma.priceList.count({ where: { variantId: variant.id } })).toBe(0);
    expect(await prisma.inventorySnapshot.count({ where: { variantId: variant.id } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { subjectId: variant.id, action: "catalog.catalogue_published" } })).toBe(1);
    const setup = await getOrderingSetup(variant.id);
    expect(setup.blockers).not.toContain("Approved catalogue identity is missing.");
    expect(setup.blockers).toContain("Approved pack image is missing.");
  });

  it("rejects contradictory semantic metadata before minting a key", async () => {
    const { product, variant } = await createPack({ name: `UAT mismatch ${randomUUID()}` });
    await expect(publishDraftCatalogue(variant.id, { ...scenario().oneKg, skuName: "TESTING (500 g x 20)", packingSize: "500 G", masterBagBoxSize: "10KG BAG" }, actor)).rejects.toMatchObject({ code: "catalogue_semantics_pack_mismatch" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).catalogKey).toBeNull();
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).catalogKey).toBeNull();
  });

  it("publishes another pack on the same product without a second product identity", async () => {
    const packs = scenario();
    const { product, variant } = await createPack({ name: `UAT multipack ${randomUUID()}` });
    await publishDraftCatalogue(variant.id, packs.oneKg, actor);
    const second = await prisma.variant.create({ data: { productId: product.id, unitSize: "5 kg", unit: "kg", unitsPerCase: 6, unitWeightKg: 5, catalogStatus: "pending_review", catalogImageStatus: "pending", catalogImageLabel: "Image pending confirmation" } });
    variantIds.push(second.id);
    const result = await publishDraftCatalogue(second.id, packs.fiveKg, actor);
    const savedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(savedProduct.catalogStatus).toBe("published");
    expect(savedProduct.catalogKey).toBe(productCatalogueIdentity(packs.oneKg).catalogKey);
    expect(result).toMatchObject({ variant: { id: second.id, catalogStatus: "published", catalogKey: variantCatalogueIdentity(packs.fiveKg).catalogKey } });
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } })).catalogStatus).toBe("published");
  });

  it("does not downgrade an active product when a new pack is published", async () => {
    const packs = scenario();
    const identity = productCatalogueIdentity(packs.fiveKg);
    const { product, variant } = await createPack({
      name: `UAT active ${randomUUID()}`,
      productStatus: "active",
      identity,
      pack: { unitSize: "5 kg", unit: "kg", unitsPerCase: 6, unitWeightKg: 5 },
    });
    await publishDraftCatalogue(variant.id, packs.fiveKg, actor);
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(saved.catalogStatus).toBe("active");
    expect(saved.catalogKey).toBe(identity.catalogKey);
  });

  it("publishes an existing draft using stored semantic provenance and only the outer pack", async () => {
    const pack = scenario().oneKg;
    const { product, variant } = await createPack({ name: `UAT existing draft ${randomUUID()}`, identity: productCatalogueIdentity(pack) });
    const result = await publishExistingDraftCatalogueFromBusinessInput(variant.id, "Box", actor);
    expect(result).toMatchObject({
      outcome: "published",
      duplicateDecision: "assigned",
      product: { id: product.id, catalogKey: productCatalogueIdentity(pack).catalogKey, internalCode: productCatalogueIdentity(pack).internalCode },
      variant: { id: variant.id, catalogKey: variantCatalogueIdentity({ ...pack, masterBagBoxSize: "30KG BOX" }).catalogKey, catalogIdentityMasterPack: "30KG BOX" },
    });
    const saved = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id }, include: { product: true } });
    expect(saved.product.id).toBe(product.id);
    expect(saved.catalogStatus).toBe("published");
  });

  it("stores a restated tuple only when it derives the existing product key", async () => {
    const packs = scenario();
    const identity = productCatalogueIdentity(packs.oneKg);
    const { product, variant } = await createPack({ name: `UAT restate ${randomUUID()}`, productStatus: "published", identity });
    await prisma.product.update({ where: { id: product.id }, data: { catalogIdentityBrand: null, catalogIdentityGroup: null, catalogIdentityLabel: null } });
    await publishDraftCatalogue(variant.id, packs.oneKg, actor);
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(saved.catalogKey).toBe(identity.catalogKey);
    expect(saved.catalogIdentityBrand).toBe("UAT");

    const wrongPacks = scenario();
    const wrongIdentity = productCatalogueIdentity(wrongPacks.oneKg);
    const wrong = await createPack({ name: `UAT wrong restate ${randomUUID()}`, productStatus: "published", identity: wrongIdentity });
    await prisma.product.update({ where: { id: wrong.product.id }, data: { catalogIdentityBrand: null, catalogIdentityGroup: null, catalogIdentityLabel: null } });
    const blocked = await publishDraftCatalogue(wrong.variant.id, { ...wrongPacks.oneKg, brandName: "OTHER" }, actor);
    expect(blocked).toMatchObject({ outcome: "blocked", code: "catalogue_identity_mismatch" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: wrong.product.id } })).catalogKey).toBe(wrongIdentity.catalogKey);
    expect(await prisma.auditEvent.count({ where: { subjectId: wrong.variant.id, action: "catalog.catalogue_publication_blocked" } })).toBe(1);
  });

  it("returns an existing publication without a second assignment audit", async () => {
    const pack = scenario().oneKg;
    const { variant } = await createPack({ name: `UAT retry ${randomUUID()}` });
    await publishDraftCatalogue(variant.id, pack, actor);
    const retry = await publishDraftCatalogue(variant.id, {}, actor);
    expect(retry).toMatchObject({ outcome: "published", duplicateDecision: "already_published", variant: { id: variant.id } });
    expect(await prisma.auditEvent.count({ where: { subjectId: variant.id, action: "catalog.catalogue_published" } })).toBe(1);
  });

  it("points an exact canonical pack back at the current row and does not mint another product", async () => {
    const packs = scenario();
    const current = await createPack({ name: `UAT current ${randomUUID()}` });
    await publishDraftCatalogue(current.variant.id, packs.oneKg, actor);
    const duplicate = await createPack({ name: `UAT duplicate ${randomUUID()}` });
    const blocked = await publishDraftCatalogue(duplicate.variant.id, packs.oneKg, actor);
    expect(blocked).toMatchObject({ outcome: "blocked", code: "canonical_pack_exists", productId: current.product.id, variantId: current.variant.id });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: duplicate.product.id } })).catalogKey).toBeNull();

    const otherPacks = scenario();
    const other = await createPack({ name: `UAT other product ${randomUUID()}`, productStatus: "published", identity: productCatalogueIdentity(otherPacks.fiveKg) });
    await prisma.variant.delete({ where: { id: other.variant.id } });
    variantIds.splice(variantIds.indexOf(other.variant.id), 1);
    const pending = await createPack({ name: `UAT pending other ${randomUUID()}`, pack: { unitSize: "5 kg", unit: "kg", unitsPerCase: 6, unitWeightKg: 5 } });
    const productBlocked = await publishDraftCatalogue(pending.variant.id, otherPacks.fiveKg, actor);
    expect(productBlocked).toMatchObject({ outcome: "blocked", code: "canonical_product_exists", productId: other.product.id });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: pending.product.id } })).catalogKey).toBeNull();
  });

  it("blocks a duplicate business publication before creating an orphan draft", async () => {
    const input = {
      product: { name: `Gagan Duplicate Daal ${randomUUID()}`, brandName: "Gagan", groupName: "Gagan Daal", category: "Daal" },
      pack: { unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1, outerPack: "Bag" as const },
    };
    const first = await publishDraftCatalogueFromBusinessInput(input, actor);
    expect(first.outcome).toBe("published");
    if (first.outcome !== "published") throw new Error("expected first publication");
    productIds.push(first.product.id);
    variantIds.push(first.variant.id);
    const productCount = await prisma.product.count();
    const variantCount = await prisma.variant.count();
    await expect(publishDraftCatalogueFromBusinessInput(input, actor)).rejects.toMatchObject({ code: "product_name_exists" });
    expect(await prisma.product.count()).toBe(productCount);
    expect(await prisma.variant.count()).toBe(variantCount);
  });
});
