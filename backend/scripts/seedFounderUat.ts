/**
 * Founder UAT fixture — additive, idempotent, does not wipe staging.
 *
 *   npm run seed:founder-uat
 *
 * Creates the Founder staff identity and, when a catalogue exists, a tagged
 * retailer with enough canonical orders/collections to exercise Pulse.
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS } from "../src/modules/identity/roleCatalog";

const prisma = new PrismaClient();

const FOUNDER_PHONE = "9812345599";
const FOUNDER_EMAIL = "founder@gagan.test";
const RETAILER_PHONE = "9812345598";
const TAG = "[FOUNDER UAT]";

async function syncRoleCatalogue() {
  const wanted = new Set(ROLE_DEFINITIONS.flatMap((role) => role.permissions));
  for (const name of wanted) {
    const existing = await prisma.permission.findUnique({ where: { name }, select: { id: true } });
    if (!existing) await prisma.permission.create({ data: { name } });
  }
  const permissionIds = new Map(
    (await prisma.permission.findMany({ select: { id: true, name: true } })).map((row) => [row.name, row.id])
  );
  for (const definition of ROLE_DEFINITIONS) {
    let role = await prisma.role.findUnique({ where: { name: definition.name }, select: { id: true } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: definition.name, description: definition.description },
        select: { id: true },
      });
    }
    const held = new Set(
      (await prisma.rolePermission.findMany({ where: { roleId: role.id }, select: { permissionId: true } })).map(
        (row) => row.permissionId
      )
    );
    for (const permissionName of definition.permissions) {
      const permissionId = permissionIds.get(permissionName);
      if (!permissionId || held.has(permissionId)) continue;
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
    }
  }
}

async function upsertFounder() {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "founder_director" } });
  const existing = await prisma.staffUser.findFirst({
    where: { OR: [{ phone: FOUNDER_PHONE }, { email: FOUNDER_EMAIL }] },
  });
  const staff =
    existing ??
    (await prisma.staffUser.create({
      data: {
        name: "Ananya Shah",
        phone: FOUNDER_PHONE,
        email: FOUNDER_EMAIL,
        employeeRef: "FOUNDER-001",
      },
    }));
  const granted = await prisma.staffRole.findFirst({
    where: { staffId: staff.id, roleId: role.id },
  });
  if (!granted) {
    await prisma.staffRole.create({ data: { staffId: staff.id, roleId: role.id } });
  }
  return staff;
}

async function seedCommercialFixture() {
  const variant = await prisma.variant.findFirst({
    where: { product: { sapMaterialId: "FOUNDER-UAT-SKU" } },
    include: { product: true },
  });
  const tier = await prisma.tier.findFirst();
  if (!tier) {
    console.log("No tier in this database — founder identity only.");
    return;
  }

  const product =
    variant?.product ??
    (await prisma.product.create({
      data: {
        name: `${TAG} Executive SKU`,
        category: "uat",
        sapMaterialId: "FOUNDER-UAT-SKU",
        variants: {
          create: { unitSize: "1", unit: "kg", unitsPerCase: 1, unitWeightKg: 1 },
        },
      },
      include: { variants: true },
    }));
  const sku = variant ?? product.variants[0];
  if (!sku) return;

  await prisma.inventorySnapshot.upsert({
    where: { sapMaterialId_warehouseCode: { sapMaterialId: "FOUNDER-UAT-SKU", warehouseCode: "WH-001" } },
    update: { onHand: 0, committed: 0, available: 0, status: "unavailable", syncedAt: new Date(), variantId: sku.id, productId: product.id },
    create: {
      productId: product.id,
      variantId: sku.id,
      sapMaterialId: "FOUNDER-UAT-SKU",
      warehouseCode: "WH-001",
      onHand: 0,
      committed: 0,
      available: 0,
      status: "unavailable",
      source: "uat",
      syncedAt: new Date(),
    },
  });

  const retailer =
    (await prisma.retailer.findUnique({ where: { phone: RETAILER_PHONE } })) ??
    (await prisma.retailer.create({
      data: {
        name: `${TAG} Executive Store`,
        phone: RETAILER_PHONE,
        shopAddress: "Founder UAT",
        tierId: tier.id,
        creditLimit: 500_000,
      },
    }));

  const existingOrder = await prisma.order.findFirst({
    where: { retailerId: retailer.id, idempotencyKey: "founder-uat-blocked-order" },
  });
  if (!existingOrder) {
    const order = await prisma.order.create({
      data: {
        retailerId: retailer.id,
        idempotencyKey: "founder-uat-blocked-order",
        status: "placed",
        orderTotal: 78_000,
        items: { create: [{ variantId: sku.id, qtyOrdered: 6, unitPrice: 13_000 }] },
      },
    });
    const policy = await prisma.creditPolicyVersion.findFirst({ where: { active: true } });
    if (policy) {
      const assessment = await prisma.creditAssessment.create({
        data: {
          retailerId: retailer.id,
          orderId: order.id,
          policyVersionId: policy.id,
          result: "approval_required",
          requiredPermission: "legal.decide",
          projectedExposure: 78_000,
          snapshot: {},
          reasons: ["new_customer_cap"],
        },
      });
      await prisma.approvalRequest.create({
        data: {
          retailerId: retailer.id,
          orderId: order.id,
          assessmentId: assessment.id,
          subjectType: "order",
          subjectId: order.id,
          approvalType: "credit_cap",
          requiredPermission: "legal.decide",
          requestReason: `${TAG} credit exception`,
        },
      });
    }
  }

  const existingCollection = await prisma.collectionSubmission.findUnique({
    where: { idempotencyKey: "founder-uat-collection" },
  });
  if (!existingCollection) {
    await prisma.collectionSubmission.create({
      data: {
        retailerId: retailer.id,
        collectorStaffId: "founder-uat",
        amount: 27_100,
        method: "upi",
        idempotencyKey: "founder-uat-collection",
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });
  }

  const existingDelivered = await prisma.order.findFirst({
    where: { retailerId: retailer.id, idempotencyKey: "founder-uat-delivered-order" },
  });
  if (!existingDelivered) {
    await prisma.order.create({
      data: {
        retailerId: retailer.id,
        idempotencyKey: "founder-uat-delivered-order",
        status: "delivered",
        orderTotal: 46_800,
        items: { create: [{ variantId: sku.id, qtyOrdered: 10, qtyDelivered: 9, unitPrice: 4_680 }] },
      },
    });
  }

  const prior = [
    { key: "founder-uat-order-d2", daysAgo: 2, total: 38_000, delivered: 10, ordered: 10 },
    { key: "founder-uat-order-d4", daysAgo: 4, total: 22_000, delivered: 8, ordered: 10 },
    { key: "founder-uat-order-d8", daysAgo: 8, total: 18_000, delivered: 10, ordered: 10 },
  ];
  for (const row of prior) {
    const exists = await prisma.order.findFirst({ where: { retailerId: retailer.id, idempotencyKey: row.key } });
    if (exists) continue;
    const createdAt = new Date(Date.now() - row.daysAgo * 86_400_000);
    await prisma.order.create({
      data: {
        retailerId: retailer.id,
        idempotencyKey: row.key,
        status: "delivered",
        orderTotal: row.total,
        createdAt,
        items: { create: [{ variantId: sku.id, qtyOrdered: row.ordered, qtyDelivered: row.delivered, unitPrice: row.total / row.ordered }] },
      },
    });
  }

  const priorCollection = await prisma.collectionSubmission.findUnique({
    where: { idempotencyKey: "founder-uat-collection-d3" },
  });
  if (!priorCollection) {
    const confirmedAt = new Date(Date.now() - 3 * 86_400_000);
    await prisma.collectionSubmission.create({
      data: {
        retailerId: retailer.id,
        collectorStaffId: "founder-uat",
        amount: 11_400,
        method: "upi",
        idempotencyKey: "founder-uat-collection-d3",
        status: "confirmed",
        submittedAt: confirmedAt,
        confirmedAt,
      },
    });
  }
}

async function main() {
  await syncRoleCatalogue();
  const staff = await upsertFounder();
  await seedCommercialFixture();
  console.log(`Founder UAT ready. Staff ${staff.name} phone ${FOUNDER_PHONE}. OTP is the staging mock code.`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
