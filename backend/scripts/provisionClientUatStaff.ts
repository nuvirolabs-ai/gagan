import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { ROLE_DEFINITIONS } from "../src/modules/identity/roleCatalog";
import { loadClientUatSourceManifest } from "../src/modules/clientUat/clientUatSource";

const USERS = {
  ops: {
    name: "Client UAT Ops",
    phone: "9000000003",
    email: "client-uat-ops@gagan.test",
    employeeRef: "OPS-CLIENT-UAT",
    passwordEnv: "CLIENT_UAT_OPS_PASSWORD",
    roles: ["client_uat_ops"],
  },
  accounts: {
    name: "Client UAT Accounts",
    phone: "9000000004",
    email: "client-uat-accounts@gagan.test",
    employeeRef: "ACCOUNTS-CLIENT-UAT",
    passwordEnv: "CLIENT_UAT_ACCOUNTS_PASSWORD",
    roles: ["accounts"],
  },
} as const;

function assertUatTarget() {
  if (process.env.CLIENT_UAT_TARGET !== "client-uat") throw new Error("CLIENT_UAT_TARGET_MUST_BE_CLIENT_UAT");
  if (process.env.CLIENT_UAT_DATABASE_IDENTITY !== "gagan_client_uat") throw new Error("CLIENT_UAT_DATABASE_IDENTITY_MUST_BE_GAGAN_CLIENT_UAT");
  if (process.env.NODE_ENV !== "staging") throw new Error("CLIENT_UAT_STAFF_PROVISIONING_REQUIRES_STAGING");
  if (process.env.SAP_MODE !== "mock") throw new Error("CLIENT_UAT_STAFF_PROVISIONING_REQUIRES_MOCK_SAP");
}

async function ensureRoles() {
  const requiredNames = new Set<string>([
    "salesperson",
    "field_collector",
    "accounts",
    "client_uat_ops",
  ]);
  const roles = new Map<string, string>();
  for (const definition of ROLE_DEFINITIONS.filter(({ name }) => requiredNames.has(name))) {
    const role = await prisma.role.upsert({
      where: { name: definition.name },
      update: { description: definition.description },
      create: { name: definition.name, description: definition.description },
    });
    roles.set(definition.name, role.id);
    for (const permissionName of definition.permissions) {
      const permission = await prisma.permission.upsert({ where: { name: permissionName }, update: {}, create: { name: permissionName } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  return roles;
}

async function upsertAdminStaff(
  user: typeof USERS[keyof typeof USERS],
  roles: Map<string, string>,
  actorStaffId: string,
) {
  const password = process.env[user.passwordEnv];
  if (!password) throw new Error(`${user.passwordEnv}_REQUIRED`);
  const admin = await prisma.adminUser.upsert({
    where: { email: user.email },
    update: { name: user.name, passwordHash: await bcrypt.hash(password, 10) },
    create: { email: user.email, name: user.name, passwordHash: await bcrypt.hash(password, 10) },
  });
  const staff = await prisma.staffUser.upsert({
    where: { employeeRef: user.employeeRef },
    update: { name: user.name, phone: user.phone, email: user.email, adminUserId: admin.id, status: "active" },
    create: { name: user.name, phone: user.phone, email: user.email, employeeRef: user.employeeRef, adminUserId: admin.id, status: "active" },
  });
  const roleIds = user.roles.map((name) => roles.get(name)!);
  await prisma.staffRole.deleteMany({ where: { staffId: staff.id, roleId: { notIn: roleIds } } });
  for (const roleId of roleIds) {
    await prisma.staffRole.upsert({ where: { staffId_roleId: { staffId: staff.id, roleId } }, update: {}, create: { staffId: staff.id, roleId } });
  }
  await prisma.auditEvent.create({
    data: {
      actorStaffId,
      action: "staging.client_uat_operational_identity_upserted",
      subjectType: "StaffUser",
      subjectId: staff.id,
      metadata: { kind: user.employeeRef, roles: user.roles },
    },
  });
  return { staffId: staff.id, adminId: admin.id, email: user.email, roles: user.roles };
}

async function main() {
  assertUatTarget();
  const source = await loadClientUatSourceManifest(process.env.CLIENT_UAT_SOURCE_MANIFEST ?? "fixtures/client-uat/source.json");
  const roles = await ensureRoles();
  const adminStaff = await prisma.staffUser.findUnique({ where: { employeeRef: "ADMIN-CLIENT-UAT" }, select: { id: true } });
  const salesperson = await prisma.staffUser.findUnique({ where: { employeeRef: "SALES-001" }, select: { id: true } });
  if (!adminStaff) throw new Error("CLIENT_UAT_ADMIN_STAFF_NOT_FOUND");
  if (!salesperson) throw new Error("CLIENT_UAT_SALESPERSON_NOT_FOUND");

  for (const roleName of ["salesperson", "field_collector"] as const) {
    await prisma.staffRole.upsert({
      where: { staffId_roleId: { staffId: salesperson.id, roleId: roles.get(roleName)! } },
      update: {},
      create: { staffId: salesperson.id, roleId: roles.get(roleName)! },
    });
  }

  const retailers = await prisma.retailer.findMany({
    where: { phone: { in: source.retailers.map(({ phone }) => phone) } },
    select: { id: true, phone: true },
  });
  if (retailers.length !== source.retailers.length) throw new Error(`CLIENT_UAT_RETAILER_SET_MISMATCH_${retailers.length}`);
  const retailerByPhone = new Map(retailers.map((retailer) => [retailer.phone, retailer.id]));
  for (const assignment of source.assignments) {
    if (assignment.salespersonEmployeeRef !== "SALES-001") throw new Error(`CLIENT_UAT_UNEXPECTED_SALESPERSON_${assignment.retailerPhone}`);
    const retailerId = retailerByPhone.get(assignment.retailerPhone);
    if (!retailerId) throw new Error(`CLIENT_UAT_RETAILER_NOT_FOUND_${assignment.retailerPhone}`);
    await prisma.collectionAssignment.upsert({
      where: { collectorStaffId_retailerId: { collectorStaffId: salesperson.id, retailerId } },
      update: { active: true, endedAt: null },
      create: { collectorStaffId: salesperson.id, retailerId, active: true },
    });
  }

  const ops = await upsertAdminStaff(USERS.ops, roles, adminStaff.id);
  const accounts = await upsertAdminStaff(USERS.accounts, roles, adminStaff.id);
  const salespersonPermissions = await prisma.staffUser.findUniqueOrThrow({
    where: { id: salesperson.id },
    select: { roles: { select: { role: { select: { permissions: { select: { permission: { select: { name: true } } } } } } } } },
  });
  const permissionNames = salespersonPermissions.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.name));
  if (permissionNames.includes("collection.confirm")) throw new Error("CLIENT_UAT_SALESPERSON_MUST_NOT_CONFIRM_COLLECTIONS");
  console.log(JSON.stringify({
    ops,
    accounts,
    salespersonStaffId: salesperson.id,
    salesRetailers: source.retailers.length,
    collectionRetailers: source.assignments.length,
    salespersonHasCollectionSubmit: permissionNames.includes("collection.submit"),
    salespersonHasCollectionConfirm: permissionNames.includes("collection.confirm"),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
