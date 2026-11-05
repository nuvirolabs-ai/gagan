import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdminIdentity, AdminRequest } from "../../lib/adminAuth";

export interface ModuleItem {
  id: string;
  group: "Finance" | "Sales" | "Warehouse" | "Field Operations" | "System";
  label: string;
  description: string;
  route: string;
  permissions: string[];
}

export const MODULE_CATALOG: ModuleItem[] = [
  // Finance
  {
    id: "billing-entities",
    group: "Finance",
    label: "Billing Entities Audit (Jain / Padam)",
    description: "Multi-firm split routing, order editing, payment reconciliation & accounting closing",
    route: "/billing-entities",
    permissions: ["financial.correct", "recovery.view"],
  },
  {
    id: "financial-statements",
    group: "Finance",
    label: "P&L Account & Balance Sheet",
    description: "Company-wise Trading, Profit & Loss statement and Balance Sheet",
    route: "/financial-statements",
    permissions: ["financial.correct", "recovery.view"],
  },
  {
    id: "ledger",
    group: "Finance",
    label: "Retailer Ledger & Balances",
    description: "Debtor accounts, invoice ledger, and statement export",
    route: "/ledger",
    permissions: ["financial.correct", "recovery.view"],
  },
  {
    id: "collections",
    group: "Finance",
    label: "Collections & Receipts",
    description: "Confirm customer payment receipts and bank remittances",
    route: "/collections",
    permissions: ["collection.confirm"],
  },
  {
    id: "corrections",
    group: "Finance",
    label: "Financial Corrections",
    description: "Credit notes, debit notes, and ledger line adjustments",
    route: "/corrections",
    permissions: ["financial.correct"],
  },
  {
    id: "recovery",
    group: "Finance",
    label: "Dues & Recovery",
    description: "Overdue debt recovery, aging brackets, and payment promises",
    route: "/recovery",
    permissions: ["recovery.view", "recovery.update"],
  },
  {
    id: "kyc",
    group: "Finance",
    label: "KYC Verification",
    description: "Verify GSTIN, PAN, and shop documents for new retailers",
    route: "/kyc",
    permissions: ["kyc.view", "kyc.review"],
  },
  {
    id: "credit-reviews",
    group: "Finance",
    label: "Credit Reviews & Ratings",
    description: "Approve credit limits and credit rating proposals",
    route: "/credit-reviews",
    permissions: ["credit.rating_confirm"],
  },
  {
    id: "legal",
    group: "Finance",
    label: "Legal Decisions",
    description: "Legal disputes and formal notice enforcement",
    route: "/legal",
    permissions: ["legal.decide"],
  },

  // Sales
  {
    id: "orders",
    group: "Sales",
    label: "Orders Desk",
    description: "Manage sales orders, check credit limits, and confirm bookings",
    route: "/orders",
    permissions: ["approval.second_invoice", "performance.view_team"],
  },
  {
    id: "approvals",
    group: "Sales",
    label: "Invoice Approvals",
    description: "2nd/3rd invoice approvals and manager overrides",
    route: "/approvals",
    permissions: ["approval.second_invoice", "approval.third_invoice"],
  },
  {
    id: "retailers",
    group: "Sales",
    label: "Retailers Directory",
    description: "Customer accounts, addresses, price tiers, and store profiles",
    route: "/retailers",
    permissions: ["retailer.proposal_review"],
  },
  {
    id: "retailer-approvals",
    group: "Sales",
    label: "New Retailer Approvals",
    description: "Review new onboarding proposals submitted by field force",
    route: "/retailer-approvals",
    permissions: ["retailer.proposal_review"],
  },
  {
    id: "commercial",
    group: "Sales",
    label: "Commercial Quote Desk",
    description: "Freight quotes, special terms, and advance requirement checks",
    route: "/commercial",
    permissions: ["commercial.status.view", "commercial.advance.view", "commercial.advance.confirm"],
  },
  {
    id: "catalog",
    group: "Sales",
    label: "Catalog & Pricing",
    description: "Products, brand variants, tax slabs, and price tier structures",
    route: "/catalog",
    permissions: ["catalog.manage"],
  },
  {
    id: "sales-leader",
    group: "Sales",
    label: "Sales Leaderboard",
    description: "Team performance, salesperson KPI tracking, and conversion rates",
    route: "/sales-leader",
    permissions: ["performance.view_team"],
  },
  {
    id: "sales-organisation",
    group: "Sales",
    label: "Sales Organisation Hierarchy",
    description: "Reporting structure, territory mapping, and team trees",
    route: "/sales-organisation",
    permissions: ["org.view_all"],
  },

  // Warehouse
  {
    id: "warehouse-orders",
    group: "Warehouse",
    label: "Warehouse Picking & Dispatch",
    description: "Pick lists, bag counts, driver allocation, and dispatch passes",
    route: "/warehouse-orders",
    permissions: ["order.warehouse_process"],
  },
  {
    id: "warehouses",
    group: "Warehouse",
    label: "Warehouses & Depots",
    description: "Warehouse locations, stock depots, and fulfillment points",
    route: "/warehouses",
    permissions: ["order.warehouse_process"],
  },

  // Field Operations
  {
    id: "field-team",
    group: "Field Operations",
    label: "Field Attendance & Leaves",
    description: "Daily check-in / check-out times, GPS location, and leaves",
    route: "/field-team",
    permissions: ["attendance.review"],
  },
  {
    id: "field-planning",
    group: "Field Operations",
    label: "Beat & Route Planning",
    description: "Daily beat plans, scheduled store visits, and task assignments",
    route: "/field-planning",
    permissions: ["route.manage"],
  },
  {
    id: "field-expenses",
    group: "Field Operations",
    label: "Field Expenses & Claims",
    description: "Travel expenses, fuel claims, and manager approvals",
    route: "/field-expenses",
    permissions: ["expense.review"],
  },
  {
    id: "market-surveys",
    group: "Field Operations",
    label: "Market Surveys",
    description: "Competitor pricing surveys, retail stock audits, and field forms",
    route: "/market-surveys",
    permissions: ["survey.manage"],
  },
  {
    id: "locations",
    group: "Field Operations",
    label: "Store GPS Locations",
    description: "Geofencing, store coordinates verification, and map view",
    route: "/locations",
    permissions: ["location.view"],
  },
  {
    id: "visits",
    group: "Field Operations",
    label: "Field Visits Log",
    description: "Store visit timeline, meeting notes, and order outcomes",
    route: "/visits",
    permissions: ["visit.view"],
  },
  {
    id: "service-issues",
    group: "Field Operations",
    label: "Service Issues & Complaints",
    description: "Customer complaints, damaged bag issues, and delivery delays",
    route: "/service-issues",
    permissions: ["issue.review"],
  },
  {
    id: "salesperson-feedback",
    group: "Field Operations",
    label: "Salesperson Feedback",
    description: "Feedback and comments submitted by ground sales reps",
    route: "/salesperson-feedback",
    permissions: ["feedback.review"],
  },

  // System
  {
    id: "staff",
    group: "System",
    label: "Staff & User Access Control",
    description: "Create user logins, assign module checkmarks, and manage passwords",
    route: "/staff",
    permissions: ["staff.manage"],
  },
  {
    id: "settings",
    group: "System",
    label: "Business Settings",
    description: "Global configurations, MOQ limits, and credit policy parameters",
    route: "/settings",
    permissions: ["staff.manage"],
  },
  {
    id: "broadcasts",
    group: "System",
    label: "Broadcasts & Alerts",
    description: "Push notifications, SMS announcements, and price change alerts",
    route: "/broadcasts",
    permissions: ["staff.manage"],
  },
  {
    id: "roles",
    group: "System",
    label: "RBAC Roles & Matrix",
    description: "System role definitions and raw permission editor",
    route: "/roles",
    permissions: ["staff.manage"],
  },
  {
    id: "imports",
    group: "System",
    label: "Data Imports",
    description: "Bulk upload catalog, price lists, and inventory snapshots",
    route: "/imports",
    permissions: ["data.import", "staff.manage"],
  },
];

function getPermissionsForModules(moduleIds: string[]): string[] {
  const perms = new Set<string>();
  for (const modId of moduleIds) {
    const found = MODULE_CATALOG.find((m) => m.id === modId);
    if (found) {
      for (const p of found.permissions) perms.add(p);
    }
  }
  return [...perms];
}

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").trim(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  modules: z.array(z.string()).min(1, "Select at least one module"),
});

const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").trim(),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  modules: z.array(z.string()).min(1, "Select at least one module"),
});

export function createUserAccessRouter() {
  const router = Router();

  // 1. List all available modules catalog
  router.get("/user-access/modules", requireAdminIdentity, (_req, res) => {
    res.json({ modules: MODULE_CATALOG });
  });

  // 2. List all users who have Admin portal logins with their assigned modules
  router.get("/user-access/users", requireAdminIdentity, async (_req, res) => {
    const adminUsers = await prisma.adminUser.findMany({
      include: {
        staffUser: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const users = adminUsers.map((admin) => {
      const staff = admin.staffUser;
      let modules: string[] = [];
      let customRoleFound = false;

      // First check if user has a custom role with stored modules JSON
      for (const sr of staff?.roles ?? []) {
        if (sr.role.description?.startsWith('{"modules":')) {
          try {
            const parsed = JSON.parse(sr.role.description);
            if (Array.isArray(parsed.modules)) {
              modules = parsed.modules;
              customRoleFound = true;
              break;
            }
          } catch {
            // ignore JSON error
          }
        }
      }

      // If no explicit modules stored (e.g. legacy accounts, sales_coordinator, or superadmin)
      if (!customRoleFound) {
        const roleNames = staff?.roles.map((r) => r.role.name) ?? [];
        if (admin.email === "admin@gagan.test") {
          modules = MODULE_CATALOG.map((m) => m.id);
        } else if (roleNames.includes("accounts") || admin.email === "accounts@gagantoordal.com") {
          modules = [
            "billing-entities",
            "financial-statements",
            "ledger",
            "collections",
            "corrections",
            "recovery",
            "kyc",
            "approvals",
          ];
        } else if (roleNames.includes("sales_coordinator") || admin.email === "coordinator@gagantoordal.com") {
          modules = [
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
        } else if (roleNames.includes("warehouse_manager") || roleNames.includes("warehouse_operator")) {
          modules = [
            "warehouse-orders",
            "warehouses",
            "retailer-approvals",
            "retailers",
          ];
        } else {
          // Infer modules from held permissions
          const heldPermissions = new Set<string>();
          for (const sr of staff?.roles ?? []) {
            for (const rp of sr.role.permissions) {
              heldPermissions.add(rp.permission.name);
            }
          }
          modules = MODULE_CATALOG.filter((mod) =>
            mod.permissions.some((p) => heldPermissions.has(p))
          ).map((mod) => mod.id);
        }
      }

      return {
        id: staff?.id ?? admin.id,
        adminUserId: admin.id,
        name: admin.name,
        email: admin.email,
        phone: staff?.phone ?? "",
        employeeRef: staff?.employeeRef ?? "",
        status: staff?.status ?? "active",
        roles: staff?.roles.map((r) => r.role.name) ?? [],
        modules,
        isSuperAdmin: admin.email === "admin@gagan.test",
        createdAt: admin.createdAt,
      };
    });

    res.json({ users });
  });

  // 3. Create a new user with checkmarked modules
  router.post("/user-access/users", requireAdminIdentity, async (req: AdminRequest, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const { name, email, phone, password, modules } = parsed.data;

    // Check duplicate email
    const existingAdmin = await prisma.adminUser.findUnique({ where: { email } });
    if (existingAdmin) {
      return res.status(409).json({ error: `A user with email ${email} already exists.` });
    }
    const existingStaffEmail = await prisma.staffUser.findUnique({ where: { email } });
    if (existingStaffEmail) {
      return res.status(409).json({ error: `Staff user with email ${email} already exists.` });
    }

    // Check duplicate phone
    const existingPhone = await prisma.staffUser.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(409).json({ error: `A staff member with phone ${phone} already exists.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create AdminUser
    const admin = await prisma.adminUser.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    // Create linked StaffUser
    const staff = await prisma.staffUser.create({
      data: {
        name,
        email,
        phone,
        adminUserId: admin.id,
        status: "active",
      },
    });

    // Resolve required permissions
    const neededPermNames = getPermissionsForModules(modules);
    for (const pName of neededPermNames) {
      await prisma.permission.upsert({
        where: { name: pName },
        update: {},
        create: { name: pName },
      });
    }

    const dbPermissions = await prisma.permission.findMany({
      where: { name: { in: neededPermNames } },
      select: { id: true },
    });

    // Create custom role
    const roleSlug = `user_${staff.id.replace(/-/g, "").slice(0, 10)}`;
    const role = await prisma.role.create({
      data: {
        name: roleSlug,
        description: JSON.stringify({ modules }),
        color: "#0284c7",
        isSystem: false,
        permissions: {
          create: dbPermissions.map((p) => ({ permissionId: p.id })),
        },
      },
    });

    // Connect staff to role
    await prisma.staffRole.create({
      data: {
        staffId: staff.id,
        roleId: role.id,
      },
    });

    res.status(201).json({
      success: true,
      user: {
        id: staff.id,
        adminUserId: admin.id,
        name,
        email,
        phone,
        status: staff.status,
        modules,
      },
    });
  });

  // 4. Update existing user details and checkmarked modules
  router.put("/user-access/users/:id", requireAdminIdentity, async (req: AdminRequest, res) => {
    const { id } = req.params;
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const { name, email, phone, password, modules } = parsed.data;

    // Find staff and linked admin
    const staff = await prisma.staffUser.findFirst({
      where: {
        OR: [{ id }, { adminUserId: id }],
      },
      include: {
        adminUser: true,
        roles: { include: { role: true } },
      },
    });

    const admin = staff?.adminUser;

    if (!admin || !staff) {
      return res.status(404).json({ error: "User identity not found" });
    }

    // Check duplicate email if changed
    if (email !== admin.email) {
      const emailClash = await prisma.adminUser.findFirst({
        where: { email, id: { not: admin.id } },
      });
      if (emailClash) return res.status(409).json({ error: `Email ${email} is already taken.` });
    }

    // Check duplicate phone if changed
    if (phone !== staff.phone) {
      const phoneClash = await prisma.staffUser.findFirst({
        where: { phone, id: { not: staff.id } },
      });
      if (phoneClash) return res.status(409).json({ error: `Phone ${phone} is already taken.` });
    }

    // Update AdminUser
    const adminUpdateData: { name: string; email: string; passwordHash?: string } = {
      name,
      email,
    };
    if (password && password.trim().length >= 6) {
      adminUpdateData.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: adminUpdateData,
    });

    // Update StaffUser
    await prisma.staffUser.update({
      where: { id: staff.id },
      data: { name, email, phone },
    });

    // If superadmin, prevent locking out modules, but allow info update
    if (admin.email === "admin@gagan.test") {
      return res.json({
        success: true,
        user: {
          id: staff.id,
          adminUserId: admin.id,
          name,
          email,
          phone,
          status: staff.status,
          modules: MODULE_CATALOG.map((m) => m.id),
        },
      });
    }

    // Resolve needed permissions
    const neededPermNames = getPermissionsForModules(modules);
    for (const pName of neededPermNames) {
      await prisma.permission.upsert({
        where: { name: pName },
        update: {},
        create: { name: pName },
      });
    }

    const dbPermissions = await prisma.permission.findMany({
      where: { name: { in: neededPermNames } },
      select: { id: true },
    });

    // Look for existing custom role
    let customRole = staff.roles.find(
      (r) => r.role.description?.startsWith('{"modules":') || r.role.name.startsWith("user_")
    )?.role;

    if (!customRole) {
      const roleSlug = `user_${staff.id.replace(/-/g, "").slice(0, 10)}`;
      customRole = await prisma.role.create({
        data: {
          name: roleSlug,
          description: JSON.stringify({ modules }),
          color: "#0284c7",
          isSystem: false,
        },
      });
      await prisma.staffRole.create({
        data: {
          staffId: staff.id,
          roleId: customRole.id,
        },
      });
    } else {
      await prisma.role.update({
        where: { id: customRole.id },
        data: {
          description: JSON.stringify({ modules }),
        },
      });
    }

    // Replace permissions on the custom role
    await prisma.rolePermission.deleteMany({
      where: { roleId: customRole.id },
    });

    await prisma.rolePermission.createMany({
      data: dbPermissions.map((p) => ({
        roleId: customRole!.id,
        permissionId: p.id,
      })),
    });

    res.json({
      success: true,
      user: {
        id: staff.id,
        adminUserId: admin.id,
        name,
        email,
        phone,
        status: staff.status,
        modules,
      },
    });
  });

  // 5. Reset User Password
  router.post("/user-access/users/:id/reset-password", requireAdminIdentity, async (req: AdminRequest, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    let admin = await prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      const staff = await prisma.staffUser.findUnique({
        where: { id },
        include: { adminUser: true },
      });
      admin = staff?.adminUser ?? null;
    }

    if (!admin) {
      return res.status(404).json({ error: "User identity not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    res.json({ success: true, message: "Password updated successfully" });
  });

  // 6. Toggle Active/Suspended status
  router.patch("/user-access/users/:id/status", requireAdminIdentity, async (req: AdminRequest, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== "active" && status !== "suspended") {
      return res.status(400).json({ error: "Status must be 'active' or 'suspended'" });
    }

    const staff = await prisma.staffUser.findFirst({
      where: {
        OR: [{ id }, { adminUserId: id }],
      },
      include: { adminUser: true },
    });

    if (!staff) {
      return res.status(404).json({ error: "Staff record not found" });
    }

    if (staff.adminUser?.email === "admin@gagan.test") {
      return res.status(400).json({ error: "Cannot suspend super admin account" });
    }

    await prisma.staffUser.update({
      where: { id: staff.id },
      data: { status },
    });

    res.json({ success: true, status });
  });

  return router;
}
