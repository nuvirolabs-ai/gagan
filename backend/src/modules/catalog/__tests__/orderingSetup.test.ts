import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { createApp } from "../../../app";
import { enableOrdering, getOrderingSetup, saveOrderingDraft } from "../orderingSetup";
import { catalogueOrderingState } from "../catalogueVisibility";
import bcrypt from "bcryptjs";

const run = randomUUID();
const ids = { product: randomUUID(), selected: randomUUID(), sibling: randomUUID(), tier: randomUUID() };
const actor = `local-catalog-${run}`;
const authIds = { admin: randomUUID(), adminStaff: randomUUID(), manager: randomUUID(), managerStaff: randomUUID() };
const authPassword = randomUUID();
let baseValues: { gstPercent: string | null; sellingEntity: string | null; routingClass: string | null; routingBagEquivalent: string | null; prices: { tierId: string; rate: string; rateBasis: "quintal" }[] } = { gstPercent: "5", sellingEntity: null, routingClass: "LAXMI_TOOR", routingBagEquivalent: null, prices: [{ tierId: ids.tier, rate: "4800", rateBasis: "quintal" }] };

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Catalog setup tier ${run}` } });
  const [adminRole, managerRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "field_manager" } }),
  ]);
  const passwordHash = await bcrypt.hash(authPassword, 10);
  await prisma.adminUser.createMany({ data: [
    { id: authIds.admin, name: "Catalog setup admin", email: `${authIds.admin}@test.invalid`, passwordHash },
    { id: authIds.manager, name: "Catalog setup manager", email: `${authIds.manager}@test.invalid`, passwordHash },
  ] });
  await prisma.staffUser.create({ data: { id: authIds.adminStaff, name: "Catalog setup admin", phone: authIds.adminStaff, email: `${authIds.adminStaff}@test.invalid`, adminUserId: authIds.admin, roles: { create: { roleId: adminRole.id } } } });
  await prisma.staffUser.create({ data: { id: authIds.managerStaff, name: "Catalog setup manager", phone: authIds.managerStaff, email: `${authIds.managerStaff}@test.invalid`, adminUserId: authIds.manager, roles: { create: { roleId: managerRole.id } } } });
  baseValues = { ...baseValues, prices: (await prisma.tier.findMany()).map(tier => ({ tierId: tier.id, rate: "4800", rateBasis: "quintal" as const })) };
  await prisma.product.create({ data: { id: ids.product, catalogKey: `local-product-${run}`, internalCode: `LOCAL-P-${run}`, name: "Local catalogue fixture", category: "test", catalogStatus: "published", sapMaterialId: `LOCAL-MAT-${run}` } });
  for (const [index, id] of [ids.selected, ids.sibling].entries()) await prisma.variant.create({ data: { id, productId: ids.product, catalogKey: `local-variant-${id}`, internalCode: `LOCAL-V-${id}`, unitSize: index === 0 ? "5" : "10", unit: "kg", unitsPerCase: 4, unitWeightKg: index === 0 ? 5 : 10, catalogStatus: "published", imageUrl: `https://example.test/${id}.jpg` } });
  await prisma.inventorySnapshot.create({ data: { productId: ids.product, variantId: ids.selected, sapMaterialId: `LOCAL-MAT-${run}`, warehouseCode: "WH-001", onHand: 25, committed: 5, available: 20, status: "available", source: "local_test", syncedAt: new Date() } });
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [authIds.adminStaff, authIds.managerStaff] } } });
  await prisma.staffRole.deleteMany({ where: { staffId: { in: [authIds.adminStaff, authIds.managerStaff] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [authIds.adminStaff, authIds.managerStaff] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [authIds.admin, authIds.manager] } } });
  await prisma.auditEvent.deleteMany({ where: { subjectId: ids.selected } });
  await prisma.catalogOrderingDraft.deleteMany({ where: { variantId: { in: [ids.selected, ids.sibling] } } });
  await prisma.priceList.deleteMany({ where: { variantId: { in: [ids.selected, ids.sibling] } } });
  await prisma.inventorySnapshot.deleteMany({ where: { productId: ids.product } });
  await prisma.variant.deleteMany({ where: { productId: ids.product } });
  await prisma.product.delete({ where: { id: ids.product } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("per-pack ordering setup", () => {
  it("requires authenticated admin permission for reads and writes", async () => {
    const app = createApp();
    expect((await request(app).get(`/admin/variants/${ids.selected}/ordering-setup`)).status).toBe(401);
    expect((await request(app).post(`/admin/variants/${ids.selected}/enable-ordering`).send({ revision: "a".repeat(64), values: baseValues })).status).toBe(401);
    const managerLogin = await request(app).post("/admin/auth/login").send({ email: `${authIds.manager}@test.invalid`, password: authPassword });
    expect(managerLogin.status).toBe(200);
    expect((await request(app).get(`/admin/variants/${ids.selected}/ordering-setup`).set("Authorization", `Bearer ${managerLogin.body.accessToken}`)).status).toBe(403);
    expect((await request(app).put(`/admin/variants/${ids.selected}/ordering-draft`).set("Authorization", `Bearer ${managerLogin.body.accessToken}`).send({ revision: "a".repeat(64), values: baseValues })).status).toBe(403);
    const adminLogin = await request(app).post("/admin/auth/login").send({ email: `${authIds.admin}@test.invalid`, password: authPassword });
    expect(adminLogin.status).toBe(200);
    const allowed = await request(app).get(`/admin/variants/${ids.selected}/ordering-setup`).set("Authorization", `Bearer ${adminLogin.body.accessToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.pack.id).toBe(ids.selected);
  });

  it("saves incomplete draft without changing effective configuration and restores it on reload", async () => {
    const initial = await getOrderingSetup(ids.selected);
    const incomplete = { ...baseValues, gstPercent: null, prices: [{ ...baseValues.prices[0], rate: "" }] };
    const saved = await saveOrderingDraft(ids.selected, initial.revision, incomplete, actor);
    expect(saved.hasDraft).toBe(true);
    expect((await getOrderingSetup(ids.selected)).values).toEqual(incomplete);
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: ids.selected } })).catalogStatus).toBe("published");
    expect(await prisma.priceList.count({ where: { variantId: ids.selected } })).toBe(0);
  });

  it("blocks missing GST, prices and routing without partial writes", async () => {
    const state = await getOrderingSetup(ids.selected);
    await expect(enableOrdering(ids.selected, state.revision, { ...baseValues, gstPercent: null, routingClass: null, prices: [] }, actor)).rejects.toMatchObject({ code: "setup_blocked" });
    expect(await prisma.priceList.count({ where: { variantId: ids.selected } })).toBe(0);
  });

  it("enables only the selected pack with the stored quintal rate", async () => {
    const state = await getOrderingSetup(ids.selected);
    const result = await enableOrdering(ids.selected, state.revision, baseValues, actor);
    expect(result.pack.status).toBe("active");
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: ids.sibling } })).catalogStatus).toBe("published");
    expect(await prisma.priceList.findUnique({ where: { tierId_variantId: { tierId: ids.tier, variantId: ids.selected } } })).toMatchObject({ rateBasis: "quintal" });
    expect((await prisma.auditEvent.findMany({ where: { subjectId: ids.selected, action: "catalog.ordering_enabled" } })).length).toBe(1);
    await expect(enableOrdering(ids.selected, state.revision, baseValues, actor)).rejects.toMatchObject({ code: "setup_changed" });
    expect((await prisma.auditEvent.findMany({ where: { subjectId: ids.selected, action: "catalog.ordering_enabled" } })).length).toBe(1);
  });

  it("rejects stale concurrent edits and preserves active configuration", async () => {
    const state = await getOrderingSetup(ids.selected);
    await saveOrderingDraft(ids.selected, state.revision, { ...baseValues, prices: [{ ...baseValues.prices[0], rate: "5000" }] }, actor);
    await expect(enableOrdering(ids.selected, state.revision, { ...baseValues, prices: [{ ...baseValues.prices[0], rate: "7000" }] }, actor)).rejects.toMatchObject({ code: "setup_changed" });
    const effective = await prisma.priceList.findUniqueOrThrow({ where: { tierId_variantId: { tierId: ids.tier, variantId: ids.selected } } });
    expect(effective.price.toString()).toBe("4800");
  });

  it("does not grant a missing-GST exception to an unapproved pack", async () => {
    const state = await getOrderingSetup(ids.sibling);
    await expect(enableOrdering(ids.sibling, state.revision, { ...baseValues, gstPercent: null, gstPendingOrderAllowed: true }, actor)).rejects.toMatchObject({ code: "setup_blocked" });
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: ids.sibling } })).gstPendingOrderAllowed).toBe(false);
  });

  it("blocks an active-pack edit when stock verification expires without changing prices", async () => {
    await prisma.inventorySnapshot.updateMany({ where: { productId: ids.product }, data: { syncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    const state = await getOrderingSetup(ids.selected);
    expect(state.inventory?.status).toBe("stale");
    await expect(enableOrdering(ids.selected, state.revision, { ...baseValues, prices: baseValues.prices.map(price => ({ ...price, rate: "7000" })) }, actor)).rejects.toMatchObject({ code: "setup_blocked" });
    expect((await prisma.priceList.findUniqueOrThrow({ where: { tierId_variantId: { tierId: ids.tier, variantId: ids.selected } } })).price.toString()).toBe("4800");
    await prisma.inventorySnapshot.updateMany({ where: { productId: ids.product }, data: { syncedAt: new Date() } });
  });

  it("keeps the existing Commercial edit path on the same managed-pack safeguards", async () => {
    const app = createApp();
    const login = await request(app).post("/admin/auth/login").send({ email: `${authIds.admin}@test.invalid`, password: authPassword });
    expect(login.status).toBe(200);
    const response = await request(app).put(`/admin/commercial/skus/${ids.selected}`)
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ gstPercent: "5", sellingEntity: null, routingClass: "LAXMI_TOOR", routingBagEquivalent: null, tierId: ids.tier, rate: "4850", rateBasis: "quintal" });
    expect(response.status).toBe(200);
    const selectedPrice = await prisma.priceList.findUniqueOrThrow({ where: { tierId_variantId: { tierId: ids.tier, variantId: ids.selected } } });
    expect(selectedPrice.price.toString()).toBe("4850");
    expect(selectedPrice.rateBasis).toBe("quintal");
    expect((await prisma.variant.findUniqueOrThrow({ where: { id: ids.sibling } })).catalogStatus).toBe("published");
  });

  it("preserves an already approved GST-pending exception without making it invoice-ready", async () => {
    await prisma.variant.update({ where: { id: ids.sibling }, data: { routingClass: "LAXMI_TOOR", gstPendingOrderAllowed: true } });
    const state = await getOrderingSetup(ids.sibling);
    const result = await enableOrdering(ids.sibling, state.revision, { ...baseValues, gstPercent: null }, actor);
    expect(result.pack.status).toBe("active");
    const sibling = await prisma.variant.findUniqueOrThrow({ where: { id: ids.sibling } });
    expect(sibling.gstPercent).toBeNull();
    expect(catalogueOrderingState(sibling.catalogStatus, null, sibling.gstPendingOrderAllowed)).toMatchObject({ orderable: true, taxStatus: "PENDING" });
  });

  it("rejects concurrent activation retries without duplicate writes", async () => {
    const app = createApp();
    const login = await request(app).post("/admin/auth/login").send({ email: `${authIds.admin}@test.invalid`, password: authPassword });
    const state = await getOrderingSetup(ids.selected);
    const beforeCount = await prisma.auditEvent.count({ where: { subjectId: ids.selected, action: "catalog.ordering_setup_changed" } });
    const values = { ...baseValues, prices: baseValues.prices.map(price => ({ ...price, rate: "4900" })) };
    const attempts = await Promise.all([1, 2].map(() => request(app).post(`/admin/variants/${ids.selected}/enable-ordering`).set("Authorization", `Bearer ${login.body.accessToken}`).send({ revision: state.revision, values })));
    expect(attempts.map(attempt => attempt.status).sort()).toEqual([200, 409]);
    expect(await prisma.auditEvent.count({ where: { subjectId: ids.selected, action: "catalog.ordering_setup_changed" } })).toBe(beforeCount + 1);
  });

  it("blocks activation when the authorised inventory link is missing", async () => {
    await prisma.inventorySnapshot.deleteMany({ where: { productId: ids.product } });
    const state = await getOrderingSetup(ids.selected);
    expect(state.inventory).toBeNull();
    await expect(enableOrdering(ids.selected, state.revision, baseValues, actor)).rejects.toMatchObject({ code: "setup_blocked" });
  });
});
