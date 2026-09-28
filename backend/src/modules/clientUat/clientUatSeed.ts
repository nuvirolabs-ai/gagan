import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { REASON_CATALOG } from "../credit/reasonCodes";
import { SOP_V4_POLICY, serializePolicy } from "../credit/policy";
import { prisma } from "../../lib/prisma";
import { deriveCataloguePublicationInput, publishDraftCatalogue } from "../catalog/draftCataloguePublication";
import { productCatalogueIdentity, variantCatalogueIdentity } from "../catalog/catalogueIdentity";
import { enableOrdering, getOrderingSetup } from "../catalog/orderingSetup";
import { ROLE_DEFINITIONS } from "../identity/roleCatalog";
import { internalStagingInventoryEnabled, upsertInventorySnapshot } from "../inventory/inventoryService";
import { loadClientUatSource, type ClientUatProduct, type ClientUatSource, type ClientUatSourcePaths } from "./clientUatSource";

export const CLIENT_UAT_SNAPSHOT_SUBJECT = "client-uat-15-day";
export const CLIENT_UAT_INVENTORY_SOURCE = "staging_uat";
export const CLIENT_UAT_WAREHOUSE = "WH-001";
export const CLIENT_UAT_OPENING_CASES = 1000;
export const CLIENT_UAT_GST_PERCENT = "5.00";
export const CLIENT_UAT_SELLING_ENTITY = "jain_traders" as const;
export const CLIENT_UAT_TIER = "Gold";

export const CLIENT_UAT_DEFAULTS = {
  adminEmail: "client-uat-admin@gagan.test",
  adminName: "Client UAT Admin",
  adminPassword: "uat-admin-15d",
  salespersonName: "Client UAT Salesperson",
  salespersonPhone: "9000000001",
  salespersonEmail: "client-uat-sales@gagan.test",
  salespersonEmployeeRef: "SALES-001",
  creditLimit: 100_000,
  minOrderValue: 0,
  outerPack: "Bag" as const,
};

export type ClientUatSeedOptions = {
  source: ClientUatSource;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  actorStaffId?: string;
  databaseIdentity?: string;
  gitSha?: string;
  renderApi?: string | null;
  renderServiceId?: string | null;
  adminUrl?: string | null;
  retailerApk?: { path: string | null; version: string | null };
  salespersonApk?: { path: string | null; version: string | null };
};

type SeedResult = {
  snapshotAuditEventId: string;
  adminStaffId: string;
  salespersonStaffId: string;
  salespersonName: string;
  salespersonPhone: string;
  salespersonEmployeeRef: string;
  tiers: number;
  products: number;
  variants: number;
  priceRows: number;
  inventoryRows: number;
  retailers: number;
  assignments: number;
  placeholders: number;
  imagesReused: number;
  sourceManifestHash: string;
  effectiveFrom: string;
  effectiveUntil: string;
};

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizedProductName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function brandForProduct(productName: string) {
  const normalized = normalizedProductName(productName);
  if (normalized.startsWith("NEEL GAGAN ")) return "Neel Gagan";
  if (normalized.startsWith("GAGAN ")) return "Gagan";
  if (normalized.startsWith("SEHMAT ")) return "Sehmat";
  return productName.split(/\s+/)[0] || "Gagan";
}

function deployedGitSha(): string {
  if (process.env.CLIENT_UAT_GIT_SHA) return process.env.CLIENT_UAT_GIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function databaseIdentity(): string {
  if (process.env.CLIENT_UAT_DATABASE_IDENTITY) return process.env.CLIENT_UAT_DATABASE_IDENTITY;
  const raw = process.env.DATABASE_URL;
  if (!raw) return "unknown";
  try {
    return new URL(raw).pathname.replace(/^\//, "") || "unknown";
  } catch {
    return "unparseable";
  }
}

function manifestHash(source: ClientUatSource) {
  return ["products", "pricing", "retailers", "assignments"].map((type) => source.sources[type as keyof typeof source.sources].sha256).join(":");
}

function sourceRows(source: ClientUatSource) {
  return {
    products: source.products,
    pricing: source.pricing,
    retailers: source.retailers,
    assignments: source.assignments,
  };
}

async function seedPlatformData() {
  const password = process.env.CLIENT_UAT_ADMIN_PASSWORD ?? CLIENT_UAT_DEFAULTS.adminPassword;
  const admin = await prisma.adminUser.upsert({
    where: { email: CLIENT_UAT_DEFAULTS.adminEmail },
    update: { name: CLIENT_UAT_DEFAULTS.adminName, passwordHash: await bcrypt.hash(password, 10) },
    create: { email: CLIENT_UAT_DEFAULTS.adminEmail, name: CLIENT_UAT_DEFAULTS.adminName, passwordHash: await bcrypt.hash(password, 10) },
  });
  const adminStaff = await prisma.staffUser.upsert({
    where: { employeeRef: "ADMIN-CLIENT-UAT" },
    update: { name: CLIENT_UAT_DEFAULTS.adminName, phone: "9000000002", email: CLIENT_UAT_DEFAULTS.adminEmail, adminUserId: admin.id, status: "active" },
    create: { name: CLIENT_UAT_DEFAULTS.adminName, phone: "9000000002", email: CLIENT_UAT_DEFAULTS.adminEmail, employeeRef: "ADMIN-CLIENT-UAT", adminUserId: admin.id, status: "active" },
  });

  const permissionNames = [...new Set(ROLE_DEFINITIONS.flatMap((definition) => definition.permissions))];
  const permissionIds = new Map<string, string>();
  for (const name of permissionNames) {
    const permission = await prisma.permission.upsert({ where: { name }, update: {}, create: { name } });
    permissionIds.set(name, permission.id);
  }
  const roleIds = new Map<string, string>();
  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({ where: { name: definition.name }, update: { description: definition.description }, create: { name: definition.name, description: definition.description } });
    roleIds.set(role.name, role.id);
    for (const permissionName of definition.permissions) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permissionIds.get(permissionName)! } }, update: {}, create: { roleId: role.id, permissionId: permissionIds.get(permissionName)! } });
    }
  }
  for (const roleName of ["platform_admin", "warehouse_operator"]) {
    await prisma.staffRole.upsert({ where: { staffId_roleId: { staffId: adminStaff.id, roleId: roleIds.get(roleName)! } }, update: {}, create: { staffId: adminStaff.id, roleId: roleIds.get(roleName)! } });
  }

  const [gold, silver] = await Promise.all([
    prisma.tier.upsert({ where: { name: "Gold" }, update: { description: "Client UAT compatibility tier", paymentTermDays: 15 }, create: { name: "Gold", description: "Client UAT compatibility tier", paymentTermDays: 15 } }),
    prisma.tier.upsert({ where: { name: "Silver" }, update: { description: "Client UAT compatibility tier", paymentTermDays: 15 }, create: { name: "Silver", description: "Client UAT compatibility tier", paymentTermDays: 15 } }),
  ]);
  await prisma.creditPolicyVersion.updateMany({ where: { version: { not: SOP_V4_POLICY.version } }, data: { active: false } });
  const policy = await prisma.creditPolicyVersion.upsert({
    where: { version: SOP_V4_POLICY.version },
    update: { name: SOP_V4_POLICY.name, active: true, rules: json(serializePolicy(SOP_V4_POLICY)), reasonCatalog: json(REASON_CATALOG), approvedByStaffId: adminStaff.id, approvedAt: new Date() },
    create: { version: SOP_V4_POLICY.version, name: SOP_V4_POLICY.name, active: true, rules: json(serializePolicy(SOP_V4_POLICY)), reasonCatalog: json(REASON_CATALOG), approvedByStaffId: adminStaff.id, approvedAt: new Date() },
  });
  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: { freeDeliveryThreshold: 10_000, minOrderValue: CLIENT_UAT_DEFAULTS.minOrderValue, supportPhone: "9000000000", creditRolloutMode: "enforce", creditPolicyApprovedAt: new Date(), creditPolicyApprovedByStaffId: adminStaff.id, creditPolicyApprovedVersion: policy.version },
    create: { id: "singleton", freeDeliveryThreshold: 10_000, minOrderValue: CLIENT_UAT_DEFAULTS.minOrderValue, supportPhone: "9000000000", creditRolloutMode: "enforce", creditPolicyApprovedAt: new Date(), creditPolicyApprovedByStaffId: adminStaff.id, creditPolicyApprovedVersion: policy.version },
  });

  let salesRep = await prisma.salesRep.findFirst({ where: { phone: CLIENT_UAT_DEFAULTS.salespersonPhone } });
  if (!salesRep) salesRep = await prisma.salesRep.create({ data: { name: CLIENT_UAT_DEFAULTS.salespersonName, phone: CLIENT_UAT_DEFAULTS.salespersonPhone, territory: "Client UAT" } });
  else salesRep = await prisma.salesRep.update({ where: { id: salesRep.id }, data: { name: CLIENT_UAT_DEFAULTS.salespersonName, territory: "Client UAT" } });
  const salesperson = await prisma.staffUser.upsert({
    where: { employeeRef: CLIENT_UAT_DEFAULTS.salespersonEmployeeRef },
    update: { name: CLIENT_UAT_DEFAULTS.salespersonName, phone: CLIENT_UAT_DEFAULTS.salespersonPhone, email: CLIENT_UAT_DEFAULTS.salespersonEmail, salesRepId: salesRep.id, status: "active" },
    create: { name: CLIENT_UAT_DEFAULTS.salespersonName, phone: CLIENT_UAT_DEFAULTS.salespersonPhone, email: CLIENT_UAT_DEFAULTS.salespersonEmail, employeeRef: CLIENT_UAT_DEFAULTS.salespersonEmployeeRef, salesRepId: salesRep.id, status: "active" },
  });
  await prisma.staffRole.upsert({ where: { staffId_roleId: { staffId: salesperson.id, roleId: roleIds.get("salesperson")! } }, update: {}, create: { staffId: salesperson.id, roleId: roleIds.get("salesperson")! } });
  return { adminStaff, salesperson, salesRep, tiers: [gold, silver] };
}

function sourceProductRows(source: ClientUatSource) {
  const groups = new Map<string, ClientUatProduct[]>();
  for (const row of source.products) {
    const semantic = deriveCataloguePublicationInput({
      product: { name: row.productName, brandName: brandForProduct(row.productName), groupName: row.category, category: row.category, imageUrl: row.imageUrl ?? undefined, description: row.description ?? undefined },
      pack: { unitSize: row.unitSize, unit: row.unit, unitsPerCase: row.unitsPerCase, unitWeightKg: row.unitWeightKg, outerPack: CLIENT_UAT_DEFAULTS.outerPack },
    });
    const identity = productCatalogueIdentity(semantic);
    groups.set(identity.catalogKey, [...(groups.get(identity.catalogKey) ?? []), row]);
  }
  return groups;
}

async function seedCatalogue(source: ClientUatSource, actorStaffId: string) {
  const priceByKey = new Map(source.pricing.map((price) => [price.canonicalKey, price]));
  const variantByKey = new Map<string, { id: string; productId: string; internalCode: string; product: { id: string; imageUrl: string | null }; imageWasReused: boolean }>();
  let imagesReused = 0;
  for (const rows of sourceProductRows(source).values()) {
    const first = rows[0];
    const baseSemantic = deriveCataloguePublicationInput({
      product: { name: first.productName, brandName: brandForProduct(first.productName), groupName: first.category, category: first.category, imageUrl: first.imageUrl ?? undefined, description: first.description ?? undefined },
      pack: { unitSize: first.unitSize, unit: first.unit, unitsPerCase: first.unitsPerCase, unitWeightKg: first.unitWeightKg, outerPack: CLIENT_UAT_DEFAULTS.outerPack },
    });
    const productIdentity = productCatalogueIdentity(baseSemantic);
    let product = await prisma.product.findUnique({ where: { catalogKey: productIdentity.catalogKey }, include: { variants: true } });
    if (!product) {
      product = await prisma.product.create({ data: { name: first.productName, category: first.category, imageUrl: first.imageUrl, description: first.description, catalogStatus: "pending_review", variants: { create: rows.map((row) => ({ unitSize: row.unitSize, unit: row.unit, unitsPerCase: row.unitsPerCase, unitWeightKg: row.unitWeightKg, imageUrl: row.imageUrl, catalogStatus: "pending_review", catalogImageStatus: row.imageUrl ? "exact" : "placeholder", catalogImageLabel: row.imageUrl ? "Approved pack image" : "Image coming soon" })) } }, include: { variants: true } });
    } else {
      product = await prisma.product.update({ where: { id: product.id }, data: { name: first.productName, category: first.category, ...(first.imageUrl ? { imageUrl: first.imageUrl } : {}), description: first.description }, include: { variants: true } });
    }
    for (const row of rows) {
      const semantic = deriveCataloguePublicationInput({
        product: { name: row.productName, brandName: brandForProduct(row.productName), groupName: row.category, category: row.category, imageUrl: row.imageUrl ?? undefined, description: row.description ?? undefined },
        pack: { unitSize: row.unitSize, unit: row.unit, unitsPerCase: row.unitsPerCase, unitWeightKg: row.unitWeightKg, outerPack: CLIENT_UAT_DEFAULTS.outerPack },
      });
      const identity = variantCatalogueIdentity(semantic);
      let variant = await prisma.variant.findUnique({ where: { catalogKey: identity.catalogKey } });
      if (!variant) {
        variant = await prisma.variant.findFirst({ where: { productId: product.id, unitSize: row.unitSize, unit: row.unit, unitsPerCase: row.unitsPerCase, unitWeightKg: row.unitWeightKg } });
      }
      if (!variant) {
        variant = await prisma.variant.create({ data: { productId: product.id, unitSize: row.unitSize, unit: row.unit, unitsPerCase: row.unitsPerCase, unitWeightKg: row.unitWeightKg, imageUrl: row.imageUrl, catalogStatus: "pending_review", catalogImageStatus: row.imageUrl ? "exact" : "placeholder", catalogImageLabel: row.imageUrl ? "Approved pack image" : "Image coming soon" } });
      } else {
        const imageWasReused = !row.imageUrl && Boolean(variant.imageUrl || product.imageUrl);
        if (imageWasReused) imagesReused += 1;
        variant = await prisma.variant.update({ where: { id: variant.id }, data: { productId: product.id, unitSize: row.unitSize, unit: row.unit, unitsPerCase: row.unitsPerCase, unitWeightKg: row.unitWeightKg, ...(row.imageUrl ? { imageUrl: row.imageUrl, catalogImageStatus: "exact", catalogImageLabel: "Approved pack image" } : {}), ...(!row.imageUrl && !variant.imageUrl && !product.imageUrl ? { catalogImageStatus: "placeholder", catalogImageLabel: "Image coming soon" } : {}) } });
      }
      if (variant.catalogStatus === "pending_review" || !variant.catalogKey) await publishDraftCatalogue(variant.id, semantic, actorStaffId);
      const published = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id }, include: { product: true } });
      const price = priceByKey.get(row.canonicalKey);
      if (!price) throw new Error(`client_uat_price_missing_${row.canonicalKey}`);
      if (!published.internalCode) throw new Error(`client_uat_variant_identity_missing_${row.canonicalKey}`);
      const existingInventory = await prisma.inventorySnapshot.findUnique({ where: { internalMaterialId_warehouseCode: { internalMaterialId: published.internalCode, warehouseCode: CLIENT_UAT_WAREHOUSE } } });
      if (!existingInventory) await upsertInventorySnapshot(prisma, { productId: published.productId, variantId: published.id, internalMaterialId: published.internalCode, warehouseCode: CLIENT_UAT_WAREHOUSE, onHand: CLIENT_UAT_OPENING_CASES, committed: 0, syncedAt: new Date(), source: CLIENT_UAT_INVENTORY_SOURCE });
      else await prisma.inventorySnapshot.update({ where: { id: existingInventory.id }, data: { syncedAt: new Date() } });
      const setup = await getOrderingSetup(published.id);
      const orderValues = { gstPercent: CLIENT_UAT_GST_PERCENT, sellingEntity: CLIENT_UAT_SELLING_ENTITY, routingClass: null, routingBagEquivalent: null, prices: (await prisma.tier.findMany({ orderBy: { name: "asc" } })).map((tier) => ({ tierId: tier.id, rate: price.casePrice.toFixed(2), rateBasis: "case" as const })) };
      await enableOrdering(published.id, setup.revision, orderValues, actorStaffId);
      variantByKey.set(row.canonicalKey, { id: published.id, productId: published.productId, internalCode: published.internalCode, product: { id: published.product.id, imageUrl: published.product.imageUrl }, imageWasReused: Boolean(!row.imageUrl && (published.imageUrl || published.product.imageUrl)) });
    }
  }
  const sourceProductKeys = [...new Set([...variantByKey.values()].map((variant) => variant.productId))];
  const sourceVariantIds = [...variantByKey.values()].map((variant) => variant.id);
  const variants = await prisma.variant.findMany({ where: { id: { in: sourceVariantIds } }, select: { id: true, productId: true, catalogKey: true } });
  await prisma.priceOverride.deleteMany({ where: { variantId: { in: sourceVariantIds } } });
  await prisma.product.updateMany({ where: { OR: [{ catalogKey: null }, { catalogKey: { notIn: sourceProductKeys.map((id) => variants.find((variant) => variant.productId === id)?.catalogKey ?? "") } }], id: { notIn: sourceProductKeys } }, data: { catalogStatus: "archived" } });
  await prisma.variant.updateMany({ where: { id: { notIn: sourceVariantIds } }, data: { catalogStatus: "archived" } });
  return { variantByKey, imagesReused };
}

async function seedRetailers(source: ClientUatSource, salespersonId: string, effectiveUntil: Date) {
  const tier = await prisma.tier.findUniqueOrThrow({ where: { name: CLIENT_UAT_TIER } });
  const saved = [];
  for (const row of source.retailers) {
    const retailer = await prisma.retailer.upsert({
      where: { phone: row.phone },
      update: { name: row.name, shopAddress: row.shopAddress, status: "active", tierId: tier.id, salesRepId: salespersonId, sapCustomerId: row.sapCustomerId, creditLimit: CLIENT_UAT_DEFAULTS.creditLimit, currentBalance: 0, overdueAmount: 0, deliveryCity: "Indore" },
      create: { name: row.name, shopAddress: row.shopAddress, phone: row.phone, status: "active", tierId: tier.id, salesRepId: salespersonId, sapCustomerId: row.sapCustomerId, creditLimit: CLIENT_UAT_DEFAULTS.creditLimit, currentBalance: 0, overdueAmount: 0, deliveryCity: "Indore" },
    });
    await prisma.creditProfile.upsert({ where: { retailerId: retailer.id }, update: { rating: "A", billingPattern: "regular", kycVerifiedAt: new Date(), nextReviewAt: effectiveUntil, kycEvidence: json({ source: "client_uat_fixture", rule: "clean UAT retailer with no historical exposure" }), ratingConfirmedAt: new Date(), advancePaymentOnly: false, lockedAt: null, lockReason: null }, create: { retailerId: retailer.id, rating: "A", billingPattern: "regular", kycVerifiedAt: new Date(), nextReviewAt: effectiveUntil, kycEvidence: json({ source: "client_uat_fixture", rule: "clean UAT retailer with no historical exposure" }), ratingConfirmedAt: new Date(), advancePaymentOnly: false } });
    await prisma.kycCase.upsert({ where: { retailerId: retailer.id }, update: { status: "approved", submittedAt: new Date(), reviewedAt: new Date() }, create: { retailerId: retailer.id, status: "approved", submittedAt: new Date(), reviewedAt: new Date() } });
    saved.push(retailer);
  }
  return saved;
}

function snapshotMetadata(source: ClientUatSource, options: Required<Pick<ClientUatSeedOptions, "effectiveFrom" | "effectiveUntil">> & Omit<ClientUatSeedOptions, "source" | "effectiveFrom" | "effectiveUntil">, actorStaffId: string, sourceManifestHash: string, counts: { products: number; variants: number; priceRows: number; inventoryRows: number; retailers: number; assignments: number; placeholders: number; imagesReused: number }, salesperson: { name: string; phone: string; employeeRef: string }) {
  return json({
    effectiveFrom: options.effectiveFrom.toISOString(),
    effectiveUntil: options.effectiveUntil.toISOString(),
    sourceManifestHash,
    sourceFiles: source.sources,
    normalizedRows: sourceRows(source),
    rawRowCounts: { products: source.counts.rawProductRows, pricing: source.counts.rawPricingRows, retailers: source.counts.rawRetailerRows, assignments: source.counts.rawAssignmentRows },
    canonicalSkuCount: source.counts.canonicalSkuCount,
    duplicatesCollapsed: source.counts.duplicatesCollapsed,
    pricingConflicts: source.conflicts,
    duplicateResolutionRule: "last supplied row wins for conflicting duplicate pricing/SKU values",
    pricingInterpretation: "INR/kg; backend case price = price/kg x unitWeightKg x unitsPerCase; same case price written to every configured tier",
    inventoryFixture: { source: CLIENT_UAT_INVENTORY_SOURCE, warehouseCode: CLIENT_UAT_WAREHOUSE, openingCasesPerSku: CLIENT_UAT_OPENING_CASES, committed: 0, identity: "Variant.internalCode", sapMaterialIdsCreated: false },
    salesperson,
    retailerCount: counts.retailers,
    tierCompatibility: "All UAT retailers use Gold; every configured tier receives the same master-derived case price and no retailer overrides remain.",
    uatDefaults: { gstPercent: CLIENT_UAT_GST_PERCENT, sellingEntity: CLIENT_UAT_SELLING_ENTITY, routingClass: null, outerPack: CLIENT_UAT_DEFAULTS.outerPack, creditRating: "A", creditLimit: CLIENT_UAT_DEFAULTS.creditLimit, creditRolloutMode: "enforce", minOrderValue: CLIENT_UAT_DEFAULTS.minOrderValue, deliveryCity: "Indore" },
    gitSha: options.gitSha ?? deployedGitSha(),
    databaseIdentity: options.databaseIdentity ?? databaseIdentity(),
    renderApi: options.renderApi ?? null,
    renderServiceId: options.renderServiceId ?? null,
    adminUrl: options.adminUrl ?? null,
    retailerApk: options.retailerApk ?? null,
    salespersonApk: options.salespersonApk ?? null,
    loaderActorStaffId: actorStaffId,
    counts,
  });
}

export async function seedClientUat(options: ClientUatSeedOptions, db: PrismaClient = prisma): Promise<SeedResult> {
  if (!internalStagingInventoryEnabled()) throw new Error("CLIENT_UAT_REQUIRES_NODE_ENV_STAGING_OR_TEST_AND_SAP_MODE_MOCK");
  if (db !== prisma) throw new Error("client_uat_seed_requires_configured_prisma_singleton");
  const effectiveFrom = options.effectiveFrom ?? new Date();
  const effectiveUntil = options.effectiveUntil ?? new Date(effectiveFrom.getTime() + 15 * 24 * 60 * 60 * 1000);
  const sourceManifestHash = manifestHash(options.source);
  const platform = await seedPlatformData();
  const actorStaffId = options.actorStaffId ?? platform.adminStaff.id;
  const catalogue = await seedCatalogue(options.source, actorStaffId);
  const sourceVariantIds = [...catalogue.variantByKey.values()].map((variant) => variant.id);
  const retailers = await seedRetailers(options.source, platform.salesRep.id, effectiveUntil);
  const sourcePhones = new Set(options.source.retailers.map((retailer) => retailer.phone));
  for (const retailer of retailers) {
    const assignment = options.source.assignments.find((item) => item.retailerPhone === retailer.phone);
    if (!assignment || assignment.salespersonEmployeeRef !== CLIENT_UAT_DEFAULTS.salespersonEmployeeRef) throw new Error(`client_uat_assignment_missing_${retailer.phone}`);
  }
  await prisma.retailer.updateMany({ where: { salesRepId: platform.salesRep.id, phone: { notIn: [...sourcePhones] } }, data: { status: "suspended" } });
  const counts = { products: new Set([...catalogue.variantByKey.values()].map((variant) => variant.productId)).size, variants: sourceVariantIds.length, priceRows: sourceVariantIds.length * (await prisma.tier.count()), inventoryRows: sourceVariantIds.length, retailers: retailers.length, assignments: options.source.assignments.length, placeholders: options.source.products.filter((row) => !row.imageUrl).length, imagesReused: catalogue.imagesReused };
  const metadata = snapshotMetadata(options.source, { ...options, effectiveFrom, effectiveUntil }, actorStaffId, sourceManifestHash, counts, { name: platform.salesperson.name, phone: platform.salesperson.phone, employeeRef: platform.salesperson.employeeRef! });
  const latest = await prisma.auditEvent.findFirst({ where: { action: "staging.client_uat_snapshot", subjectType: "ClientUatEnvironment", subjectId: CLIENT_UAT_SNAPSHOT_SUBJECT }, orderBy: { createdAt: "desc" } });
  const latestMetadata = latest?.metadata as { sourceManifestHash?: string } | null | undefined;
  const audit = latest && latestMetadata?.sourceManifestHash === sourceManifestHash ? latest : await prisma.auditEvent.create({ data: { actorStaffId, action: "staging.client_uat_snapshot", subjectType: "ClientUatEnvironment", subjectId: CLIENT_UAT_SNAPSHOT_SUBJECT, metadata } });
  return { snapshotAuditEventId: audit.id, adminStaffId: platform.adminStaff.id, salespersonStaffId: platform.salesperson.id, salespersonName: platform.salesperson.name, salespersonPhone: platform.salesperson.phone, salespersonEmployeeRef: platform.salesperson.employeeRef!, tiers: await prisma.tier.count(), products: counts.products, variants: counts.variants, priceRows: counts.priceRows, inventoryRows: counts.inventoryRows, retailers: counts.retailers, assignments: counts.assignments, placeholders: counts.placeholders, imagesReused: counts.imagesReused, sourceManifestHash, effectiveFrom: effectiveFrom.toISOString(), effectiveUntil: effectiveUntil.toISOString() };
}

export async function seedClientUatFromPaths(paths: ClientUatSourcePaths, options: Omit<ClientUatSeedOptions, "source"> = {}) {
  const source = await loadClientUatSource(paths);
  return seedClientUat({ ...options, source });
}
