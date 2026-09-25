import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";

const run = randomUUID();
const ids = { adminUser: randomUUID(), staff: randomUUID() };
const productName = `ADM-02 import ${run}`;
const actorPhone = `89${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "1")}`;
const app = createApp();
let token = "";
let importJobId = "";

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
  await prisma.adminUser.create({
    data: {
      id: ids.adminUser,
      email: `adm02-${run}@test.invalid`,
      name: "ADM-02 local import test",
      passwordHash: "test-only",
    },
  });
  await prisma.staffUser.create({
    data: {
      id: ids.staff,
      adminUserId: ids.adminUser,
      name: "ADM-02 local import test",
      phone: actorPhone,
      email: `adm02-staff-${run}@test.invalid`,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  const session = await lazyIdentitySessionService.createSession({
    realm: "admin",
    subjectId: ids.staff,
    deviceName: "adm02-import-integration-test",
  });
  token = session.accessToken;
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: ids.staff } });
  await prisma.auditEvent.deleteMany({ where: { actorStaffId: ids.staff } });
  if (importJobId) await prisma.importJob.deleteMany({ where: { id: importJobId } });
  await prisma.variant.deleteMany({ where: { product: { name: productName } } });
  await prisma.product.deleteMany({ where: { name: productName } });
  await prisma.staffUser.deleteMany({ where: { id: ids.staff } });
  await prisma.adminUser.deleteMany({ where: { id: ids.adminUser } });
  expect(await prisma.importJob.count({ where: { id: importJobId } })).toBe(0);
  expect(await prisma.product.count({ where: { name: productName } })).toBe(0);
  expect(await prisma.staffUser.count({ where: { id: ids.staff } })).toBe(0);
  expect(await prisma.adminUser.count({ where: { id: ids.adminUser } })).toBe(0);
});

describe("Admin Import Center PostgreSQL/API workflow", () => {
  it("matches template headers, previews without writes, then applies and reads back one product", async () => {
    const template = await request(app)
      .get("/admin/imports/templates/products.csv")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const headers = template.text.split(/\r?\n/, 1)[0].split(",");
    expect(headers).toEqual([
      "product_name",
      "category",
      "unit_size",
      "unit",
      "units_per_case",
      "unit_weight_kg",
      "description",
      "image_url",
      "sap_material_id",
    ]);

    const csv = [
      headers.join(","),
      `${productName},Test,1 kg,kg,12,1,,,`,
      "",
    ].join("\n");
    const preview = await request(app)
      .post("/admin/imports/preview")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "text/csv")
      .set("x-import-type", "products")
      .set("x-import-mode", "create_only")
      .set("x-file-name", `adm02-${run}.csv`)
      .send(csv)
      .expect(201);
    importJobId = preview.body.job.id;

    expect(preview.body.headers).toEqual(headers);
    expect(preview.body.summary).toMatchObject({ totalRows: 1, validRows: 1, failedRows: 0 });
    expect(preview.body.rows[0]).toMatchObject({ rowNumber: 2, action: "create", errors: [] });
    expect(await prisma.product.count({ where: { name: productName } })).toBe(0);

    const savedPreview = await request(app)
      .get(`/admin/imports/${importJobId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(savedPreview.body.job.status).toBe("preview");
    expect(savedPreview.body.headers).toEqual(headers);

    await request(app)
      .post(`/admin/imports/${importJobId}/apply`)
      .set("Authorization", `Bearer ${token}`)
      .send({ confirm: false })
      .expect(400);
    expect(await prisma.product.count({ where: { name: productName } })).toBe(0);

    const applied = await request(app)
      .post(`/admin/imports/${importJobId}/apply`)
      .set("Authorization", `Bearer ${token}`)
      .send({ confirm: true })
      .expect(200);
    expect(applied.body).toMatchObject({
      job: { id: importJobId, status: "completed" },
      totalRows: 1,
      createdRows: 1,
      updatedRows: 0,
      failedRows: 0,
    });

    const product = await prisma.product.findFirstOrThrow({
      where: { name: productName },
      include: { variants: true },
    });
    expect(product).toMatchObject({
      category: "Test",
      variants: [expect.objectContaining({ unitSize: "1 kg", unit: "kg", unitsPerCase: 12 })],
    });
    const completedJob = await request(app)
      .get(`/admin/imports/${importJobId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(completedJob.body.job).toMatchObject({
      status: "completed",
      createdRows: 1,
      failedRows: 0,
    });
  });
});
