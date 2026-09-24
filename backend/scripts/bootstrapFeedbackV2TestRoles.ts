/** Only for the dedicated disposable local feedback-v2 test database. */
import { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS } from "../src/modules/identity/roleCatalog";

const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "localhost" || url.pathname !== "/gagan_feedback_v2_test_20260924") {
  throw new Error("Refusing role bootstrap outside the disposable feedback-v2 database");
}

const prisma = new PrismaClient();
async function main() {
  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: definition.name },
      create: { name: definition.name, description: definition.description },
      update: { description: definition.description },
    });
    for (const name of definition.permissions) {
      const permission = await prisma.permission.upsert({ where: { name }, create: { name }, update: {} });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
  const tier = await prisma.tier.upsert({ where: { name: "Feedback V2 disposable fixture" }, create: { name: "Feedback V2 disposable fixture" }, update: {} });
  await prisma.retailer.upsert({ where: { phone: "9000000001" }, create: { name: "Feedback V2 disposable store", phone: "9000000001", shopAddress: "Local test only", tierId: tier.id }, update: {} });
  const product = await prisma.product.upsert({ where: { catalogKey: "feedback-v2-test-product" }, create: { catalogKey: "feedback-v2-test-product", name: "Disposable test product", category: "Test" }, update: {} });
  await prisma.variant.upsert({ where: { catalogKey: "feedback-v2-test-variant" }, create: { catalogKey: "feedback-v2-test-variant", productId: product.id, unitSize: "1 kg", unit: "kg" }, update: {} });
  await prisma.staffUser.upsert({ where: { email: "feedback-v2-disposable@test.invalid" }, create: { name: "Feedback V2 disposable actor", phone: "9000000002", email: "feedback-v2-disposable@test.invalid" }, update: {} });
  console.log(`Prepared ${ROLE_DEFINITIONS.length} role definitions in the disposable test database`);
}
main().finally(() => prisma.$disconnect());
