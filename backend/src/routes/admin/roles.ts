import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createRbacRouter() {
  const router = Router();

  const getPermissionCategory = (name: string): string => {
    if (name.startsWith("order.") || name.startsWith("dispatch.")) return "Orders & Fulfillment";
    if (name.startsWith("commercial.")) return "Commercial & Pricing";
    if (name.startsWith("catalog.") || name.startsWith("data.")) return "Catalog & Master Data";
    if (name.startsWith("kyc.") || name.startsWith("retailer.")) return "Retailers & KYC";
    if (
      name.startsWith("credit.") ||
      name.startsWith("financial.") ||
      name.startsWith("recovery.") ||
      name.startsWith("collection.")
    ) {
      return "Credit & Collections";
    }
    if (
      name.startsWith("attendance.") ||
      name.startsWith("route.") ||
      name.startsWith("location.") ||
      name.startsWith("visit.") ||
      name.startsWith("task.")
    ) {
      return "Field Force & Tracking";
    }
    if (name.startsWith("approval.") || name.startsWith("legal.") || name.startsWith("founder.")) {
      return "Approvals & Executive";
    }
    if (name.startsWith("survey.") || name.startsWith("issue.") || name.startsWith("feedback.")) {
      return "Surveys & Field Quality";
    }
    return "Organization & Admin";
  };

  const ensureRbacSeed = async () => {
    try {
      // Mark known system roles
      const systemRoleNames = [
        "platform_admin",
        "salesperson",
        "field_manager",
        "warehouse_manager",
        "catalog_manager",
        "accounts",
        "credit_team_lead",
        "founder_director",
        "field_collector",
        "dispatch",
        "sales_coordinator",
        "credit_team",
        "warehouse_operator",
      ];

      await prisma.role.updateMany({
        where: { name: { in: systemRoleNames } },
        data: { isSystem: true },
      });

      // Assign default colors if null
      const roleColorMap: Record<string, string> = {
        platform_admin: "#dc2626", // Red
        field_manager: "#7c3aed", // Purple
        salesperson: "#2563eb", // Blue
        warehouse_manager: "#059669", // Emerald
        catalog_manager: "#d97706", // Amber
        accounts: "#0891b2", // Cyan
        credit_team_lead: "#4f46e5", // Indigo
        founder_director: "#9333ea", // Violet
        field_collector: "#0284c7", // Sky
        dispatch: "#16a34a", // Green
      };

      for (const [rName, color] of Object.entries(roleColorMap)) {
        await prisma.role.updateMany({
          where: { name: rName, color: null },
          data: { color },
        });
      }

      // Check if custom demonstration role exists (Gap 18)
      const regionalAuditRole = await prisma.role.findUnique({
        where: { name: "regional_compliance_lead" },
      });

      if (!regionalAuditRole) {
        const samplePerms = await prisma.permission.findMany({
          where: {
            name: {
              in: [
                "activity.log",
                "org.view_all",
                "kyc.view",
                "kyc.review",
                "retailer.proposal_review",
                "commercial.status.view",
                "expense.review",
                "survey.responses_view",
              ],
            },
          },
        });

        const createdRole = await prisma.role.create({
          data: {
            name: "regional_compliance_lead",
            description: "Regional Compliance & KYC Audit Officer with cross-district oversight",
            color: "#ea580c", // Orange
            isSystem: false,
          },
        });

        if (samplePerms.length > 0) {
          await prisma.rolePermission.createMany({
            data: samplePerms.map((p) => ({
              roleId: createdRole.id,
              permissionId: p.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    } catch (err) {
      console.warn("Could not seed RBAC:", err);
    }
  };

  void ensureRbacSeed();

  // 1. GET /admin/rbac/roles - list all roles with permissions and counts
  router.get("/rbac/roles", async (req, res) => {
    try {
      await ensureRbacSeed();

      const roles = await prisma.role.findMany({
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          staff: {
            include: {
              staff: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            take: 5,
          },
          _count: {
            select: {
              staff: true,
              permissions: true,
            },
          },
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      });

      const totalPermissions = await prisma.permission.count();
      const distinctStaffWithRoles = await prisma.staffRole.groupBy({
        by: ["staffId"],
      });

      const metrics = {
        totalRoles: roles.length,
        customRoles: roles.filter((r) => !r.isSystem).length,
        totalPermissions,
        staffEnforced: distinctStaffWithRoles.length,
      };

      const formattedRoles = roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        color: r.color || "#1e40af",
        isSystem: r.isSystem,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        permissionCount: r._count.permissions,
        staffCount: r._count.staff,
        permissionIds: r.permissions.map((p) => p.permissionId),
        permissions: r.permissions.map((p) => ({
          id: p.permission.id,
          name: p.permission.name,
          description: p.permission.description,
          category: p.permission.category || getPermissionCategory(p.permission.name),
        })),
        sampleStaff: r.staff.map((s) => ({
          id: s.staff.id,
          name: s.staff.name,
          email: s.staff.email,
        })),
      }));

      return res.json({
        roles: formattedRoles,
        metrics,
      });
    } catch (err) {
      console.error("Failed to fetch RBAC roles:", err);
      return res.status(500).json({ error: "Failed to fetch RBAC roles" });
    }
  });

  // 2. GET /admin/rbac/permissions - list all 51+ permissions grouped by category
  router.get("/rbac/permissions", async (req, res) => {
    try {
      const permissions = await prisma.permission.findMany({
        orderBy: { name: "asc" },
      });

      const formatted = permissions.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category || getPermissionCategory(p.name),
      }));

      // Group permissions by category
      const categories: Record<string, typeof formatted> = {};
      for (const p of formatted) {
        if (!categories[p.category]) categories[p.category] = [];
        categories[p.category].push(p);
      }

      return res.json({
        permissions: formatted,
        categories,
        total: formatted.length,
      });
    } catch (err) {
      console.error("Failed to fetch permissions:", err);
      return res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  const createRoleSchema = z.object({
    name: z.string().min(2, "Role name must have at least 2 characters"),
    description: z.string().optional(),
    color: z.string().optional().default("#1e40af"),
    permissionIds: z.array(z.string()).default([]),
  });

  // 3. POST /admin/rbac/roles - create a new custom role
  router.post("/rbac/roles", async (req, res) => {
    try {
      const parsed = createRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid role payload", details: parsed.error.issues });
      }

      const { name, description, color, permissionIds } = parsed.data;

      const formattedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

      const existing = await prisma.role.findUnique({ where: { name: formattedName } });
      if (existing) {
        return res.status(409).json({ error: `A role with the name "${formattedName}" already exists.` });
      }

      const role = await prisma.role.create({
        data: {
          name: formattedName,
          description: description?.trim() || null,
          color: color || "#1e40af",
          isSystem: false,
        },
      });

      if (permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissionIds.map((pId) => ({
            roleId: role.id,
            permissionId: pId,
          })),
          skipDuplicates: true,
        });
      }

      await prisma.auditEvent.create({
        data: {
          action: "role.create",
          subjectType: "role",
          subjectId: role.id,
          metadata: {
            roleName: role.name,
            permissionCount: permissionIds.length,
          },
        },
      });

      return res.status(201).json({ role });
    } catch (err) {
      console.error("Failed to create role:", err);
      return res.status(500).json({ error: "Failed to create role" });
    }
  });

  // 4. PUT /admin/rbac/roles/:id - update role details
  router.put("/rbac/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { description, color } = req.body;

      const role = await prisma.role.update({
        where: { id },
        data: {
          ...(typeof description === "string" ? { description: description.trim() } : {}),
          ...(typeof color === "string" ? { color } : {}),
        },
      });

      await prisma.auditEvent.create({
        data: {
          action: "role.update",
          subjectType: "role",
          subjectId: id,
          metadata: { roleName: role.name },
        },
      });

      return res.json({ role });
    } catch (err) {
      console.error("Failed to update role:", err);
      return res.status(500).json({ error: "Failed to update role" });
    }
  });

  // 5. PUT /admin/rbac/roles/:id/permissions - update granular permission matrix for a role
  router.put("/rbac/roles/:id/permissions", async (req, res) => {
    try {
      const { id } = req.params;
      const { permissionIds } = req.body;

      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ error: "permissionIds must be an array of strings" });
      }

      const role = await prisma.role.findUnique({ where: { id } });
      if (!role) return res.status(404).json({ error: "Role not found" });

      // Transaction: replace permissions
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        prisma.rolePermission.createMany({
          data: permissionIds.map((pId: string) => ({
            roleId: id,
            permissionId: pId,
          })),
          skipDuplicates: true,
        }),
      ]);

      await prisma.auditEvent.create({
        data: {
          action: "role.permissions_update",
          subjectType: "role",
          subjectId: id,
          metadata: {
            roleName: role.name,
            newPermissionCount: permissionIds.length,
          },
        },
      });

      return res.json({ success: true, count: permissionIds.length });
    } catch (err) {
      console.error("Failed to update role permissions:", err);
      return res.status(500).json({ error: "Failed to update role permissions" });
    }
  });

  // 6. DELETE /admin/rbac/roles/:id - delete custom role (with safety lock on system roles)
  router.delete("/rbac/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const role = await prisma.role.findUnique({
        where: { id },
        include: { _count: { select: { staff: true } } },
      });

      if (!role) return res.status(404).json({ error: "Role not found" });

      if (role.isSystem) {
        return res.status(403).json({
          error: `Cannot delete system protected role "${role.name}". Only custom roles can be removed.`,
        });
      }

      if (role._count.staff > 0) {
        return res.status(400).json({
          error: `Cannot delete role "${role.name}" because it is currently assigned to ${role._count.staff} staff member(s). Please reassign staff first.`,
        });
      }

      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        prisma.role.delete({ where: { id } }),
      ]);

      await prisma.auditEvent.create({
        data: {
          action: "role.delete",
          subjectType: "role",
          subjectId: id,
          metadata: { roleName: role.name },
        },
      });

      return res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete role:", err);
      return res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // 7. GET /admin/rbac/audit-trail - security audit events for RBAC
  router.get("/rbac/audit-trail", async (req, res) => {
    try {
      const events = await prisma.auditEvent.findMany({
        where: {
          OR: [
            { subjectType: { in: ["role", "permission", "staff_role", "broadcast"] } },
            { action: { startsWith: "role." } },
            { action: { startsWith: "broadcast." } },
            { action: { startsWith: "staff." } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return res.json({ events });
    } catch (err) {
      console.error("Failed to fetch RBAC audit trail:", err);
      return res.status(500).json({ error: "Failed to fetch RBAC audit trail" });
    }
  });

  return router;
}
