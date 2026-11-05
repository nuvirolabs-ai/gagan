import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { syncRolePermissions } from "./roleSync";

export async function ensureAdminAccountsAndCoordinator() {
  try {
    // 1. Sync role permissions for accounts and sales_coordinator from roleCatalog
    await syncRolePermissions(prisma, "accounts", true).catch((err) =>
      console.warn("[PROVISIONING] Accounts role sync warning:", err)
    );
    await syncRolePermissions(prisma, "sales_coordinator", true).catch((err) =>
      console.warn("[PROVISIONING] Sales Coordinator role sync warning:", err)
    );

    const defaultPassword = "admin123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 2. Provision / Update Accounts Team Admin User
    const accountsEmail = "accounts@gagantoordal.com";
    const accountsName = "Gagan Accounts Team";
    const accountsRole = await prisma.role.findUnique({ where: { name: "accounts" } });

    if (accountsRole) {
      let accountsAdmin = await prisma.adminUser.findUnique({ where: { email: accountsEmail } });
      if (!accountsAdmin) {
        accountsAdmin = await prisma.adminUser.create({
          data: {
            email: accountsEmail,
            name: accountsName,
            passwordHash,
          },
        });
      } else {
        await prisma.adminUser.update({
          where: { id: accountsAdmin.id },
          data: { name: accountsName, passwordHash },
        });
      }

      // Link or create StaffUser
      let accountsStaff = await prisma.staffUser.findFirst({
        where: {
          OR: [{ email: accountsEmail }, { adminUserId: accountsAdmin.id }, { phone: "9000000004" }],
        },
      });

      if (!accountsStaff) {
        accountsStaff = await prisma.staffUser.create({
          data: {
            email: accountsEmail,
            name: accountsName,
            phone: "9000000004",
            employeeRef: "ACC-001",
            adminUserId: accountsAdmin.id,
            status: "active",
          },
        });
      } else {
        accountsStaff = await prisma.staffUser.update({
          where: { id: accountsStaff.id },
          data: {
            email: accountsEmail,
            name: accountsName,
            adminUserId: accountsAdmin.id,
            status: "active",
          },
        });
      }

      await prisma.staffRole.upsert({
        where: { staffId_roleId: { staffId: accountsStaff.id, roleId: accountsRole.id } },
        create: { staffId: accountsStaff.id, roleId: accountsRole.id },
        update: {},
      });

      // Ensure explicit modules role for Accounts
      const accountsModules = [
        "billing-entities",
        "financial-statements",
        "ledger",
        "collections",
        "corrections",
        "recovery",
        "kyc",
        "approvals",
      ];
      const accountsCustomRole = await prisma.role.upsert({
        where: { name: "user_accounts_portal" },
        create: {
          name: "user_accounts_portal",
          description: JSON.stringify({ modules: accountsModules }),
          color: "#059669",
          isSystem: false,
        },
        update: {
          description: JSON.stringify({ modules: accountsModules }),
        },
      });
      await prisma.staffRole.upsert({
        where: { staffId_roleId: { staffId: accountsStaff.id, roleId: accountsCustomRole.id } },
        create: { staffId: accountsStaff.id, roleId: accountsCustomRole.id },
        update: {},
      });
    }

    // Also update any legacy test account for accounts if present
    const legacyAccounts = await prisma.adminUser.findUnique({ where: { email: "client-uat-accounts@gagan.test" } });
    if (legacyAccounts) {
      await prisma.adminUser.update({
        where: { id: legacyAccounts.id },
        data: { passwordHash },
      });
    }

    // 3. Provision / Update Sales Coordinator Admin User
    const coordinatorEmail = "coordinator@gagantoordal.com";
    const coordinatorName = "Gagan Sales Coordinator";
    const coordinatorRole = await prisma.role.findUnique({ where: { name: "sales_coordinator" } });

    if (coordinatorRole) {
      let coordinatorAdmin = await prisma.adminUser.findUnique({ where: { email: coordinatorEmail } });
      if (!coordinatorAdmin) {
        coordinatorAdmin = await prisma.adminUser.create({
          data: {
            email: coordinatorEmail,
            name: coordinatorName,
            passwordHash,
          },
        });
      } else {
        await prisma.adminUser.update({
          where: { id: coordinatorAdmin.id },
          data: { name: coordinatorName, passwordHash },
        });
      }

      let coordinatorStaff = await prisma.staffUser.findFirst({
        where: {
          OR: [{ email: coordinatorEmail }, { adminUserId: coordinatorAdmin.id }, { phone: "9000000005" }],
        },
      });

      if (!coordinatorStaff) {
        coordinatorStaff = await prisma.staffUser.create({
          data: {
            email: coordinatorEmail,
            name: coordinatorName,
            phone: "9000000005",
            employeeRef: "COORD-001",
            adminUserId: coordinatorAdmin.id,
            status: "active",
          },
        });
      } else {
        coordinatorStaff = await prisma.staffUser.update({
          where: { id: coordinatorStaff.id },
          data: {
            email: coordinatorEmail,
            name: coordinatorName,
            adminUserId: coordinatorAdmin.id,
            status: "active",
          },
        });
      }

      await prisma.staffRole.upsert({
        where: { staffId_roleId: { staffId: coordinatorStaff.id, roleId: coordinatorRole.id } },
        create: { staffId: coordinatorStaff.id, roleId: coordinatorRole.id },
        update: {},
      });

      // Ensure explicit modules role for Sales Coordinator
      const coordinatorModules = [
        "orders",
        "retailers",
        "commercial",
        "catalog",
        "retailer-approvals",
        "approvals",
        "sales-leader",
        "sales-organisation",
        "collections",
        "market-surveys",
        "salesperson-feedback",
        "service-issues",
        "field-planning",
        "visits",
      ];
      const coordinatorCustomRole = await prisma.role.upsert({
        where: { name: "user_coordinator_portal" },
        create: {
          name: "user_coordinator_portal",
          description: JSON.stringify({ modules: coordinatorModules }),
          color: "#2563eb",
          isSystem: false,
        },
        update: {
          description: JSON.stringify({ modules: coordinatorModules }),
        },
      });
      await prisma.staffRole.upsert({
        where: { staffId_roleId: { staffId: coordinatorStaff.id, roleId: coordinatorCustomRole.id } },
        create: { staffId: coordinatorStaff.id, roleId: coordinatorCustomRole.id },
        update: {},
      });
    }

    console.log("[PROVISIONING] Accounts and Sales Coordinator identities verified successfully.");
  } catch (err) {
    console.error("[PROVISIONING] Error ensuring Accounts and Coordinator:", err);
  }
}
