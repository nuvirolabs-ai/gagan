/**
 * Pre-deployment readiness check for the sales reporting hierarchy.
 *
 *   npm run check:sales-org-readiness
 *   DATABASE_URL='<staging connection string>' npm run check:sales-org-readiness
 *   npm run check:sales-org-readiness -- --report
 *
 * Reporting lines now decide what every manager can see and approve. That is
 * the intended behaviour, but it means an organisation whose `managerId`
 * columns are empty deploys into a state where managers see nothing. This
 * script is how you find that out before the deploy rather than after it.
 *
 * The exit code is deliberately narrow:
 *
 *   non-zero  the hierarchy is *structurally* invalid — a cycle, a manager id
 *             pointing at nobody, someone reporting to themselves, or an
 *             inactive manager still holding active reports. These corrupt
 *             scope resolution and must be fixed.
 *
 *   zero      everything else, including unplaced staff. Somebody has to be at
 *             the top of the tree, and a brand-new deployment legitimately has
 *             nobody placed yet. Failing on that would make the check useless
 *             on the one day it matters most.
 *
 * Unplaced and disconnected staff are reported loudly as warnings, because they
 * are the operational risk even though they are not a structural fault.
 */
import { PrismaClient } from "@prisma/client";
import { auditChains } from "../src/modules/org/hierarchyDomain";

const prisma = new PrismaClient();

interface StaffRow {
  id: string;
  name: string;
  status: string;
  managerId: string | null;
  salesRepId: string | null;
  adminUserId: string | null;
  roles: string[];
}

/** Roles whose holders are expected to sit somewhere in the reporting tree. */
const FIELD_ROLES = new Set(["salesperson", "field_collector", "field_manager"]);

async function load(): Promise<StaffRow[]> {
  const staff = await prisma.staffUser.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      managerId: true,
      salesRepId: true,
      adminUserId: true,
      roles: { select: { role: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return staff.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    managerId: row.managerId,
    salesRepId: row.salesRepId,
    adminUserId: row.adminUserId,
    roles: row.roles.map((assignment) => assignment.role.name),
  }));
}

async function main() {
  const wantReport = process.argv.includes("--report");
  const staff = await load();
  const active = staff.filter((row) => row.status === "active");
  const byId = new Map(staff.map((row) => [row.id, row]));

  const { depth, cycles, invalidRefs, selfManaged } = auditChains(staff);

  const directReports = new Map<string, StaffRow[]>();
  for (const person of staff) {
    if (!person.managerId || person.managerId === person.id) continue;
    directReports.set(person.managerId, [
      ...(directReports.get(person.managerId) ?? []),
      person,
    ]);
  }

  // Retailer counts per salesperson, one grouped query rather than one each.
  const repCounts = await prisma.retailer.groupBy({
    by: ["salesRepId"],
    _count: { _all: true },
  });
  const retailersByRep = new Map(
    repCounts.map((row) => [row.salesRepId, row._count._all])
  );
  const unownedRetailers =
    repCounts.find((row) => row.salesRepId === null)?._count._all ?? 0;

  const fieldStaff = active.filter((row) => row.roles.some((role) => FIELD_ROLES.has(role)));
  const salespeople = active.filter((row) => row.salesRepId !== null);
  const managers = active.filter((row) => (directReports.get(row.id) ?? []).length > 0);

  const unplaced = fieldStaff.filter((row) => row.managerId === null);
  // Someone has to be at the top. A leader with no manager but with reports is
  // the root of a tree, not a gap; a person with neither is floating.
  const topLevel = unplaced.filter((row) => (directReports.get(row.id) ?? []).length > 0);
  const floating = unplaced.filter((row) => (directReports.get(row.id) ?? []).length === 0);
  // Disconnected = has a manager, but the chain upward never reaches a root.
  const disconnected = active.filter((row) => row.managerId !== null && depth.get(row.id) === -1);
  const inactiveManagersWithReports = staff.filter(
    (row) =>
      row.status !== "active" &&
      (directReports.get(row.id) ?? []).some((report) => report.status === "active")
  );
  const managersWithoutReports = active.filter(
    (row) => row.roles.includes("field_manager") && (directReports.get(row.id) ?? []).length === 0
  );
  const salespeopleWithoutManager = salespeople.filter((row) => row.managerId === null);

  const line = (label: string, value: number | string) =>
    console.log(`${label.padEnd(34)} ${value}`);

  console.log("SALES ORGANISATION READINESS");
  console.log(`Database: ${new URL(process.env.DATABASE_URL ?? "postgres://unknown/unknown").pathname.slice(1)}`);
  console.log("");
  line("ACTIVE FIELD STAFF", fieldStaff.length);
  line("MANAGERS", managers.length);
  line("SALESPERSONS", salespeople.length);
  line("UNASSIGNED STAFF", unplaced.length);
  line("  of which top-level leaders", topLevel.length);
  line("  of which floating (no manager, no reports)", floating.length);
  line("DISCONNECTED STAFF", disconnected.length);
  line("INVALID MANAGER REFERENCES", invalidRefs.length);
  line("CYCLES", cycles.length);
  line("RETAILERS WITH UNASSIGNED SALES REP", unownedRetailers);
  console.log("");

  const structural: string[] = [];

  if (cycles.length) {
    structural.push(`${cycles.length} cycle(s) in the reporting tree`);
    for (const loop of cycles) console.log(`  CYCLE: ${loop.join(" → ")} → (back to start)`);
  }
  if (invalidRefs.length) {
    structural.push(`${invalidRefs.length} manager id(s) pointing at a missing employee`);
    for (const person of invalidRefs) {
      console.log(`  INVALID MANAGER REF: ${person.name} → ${person.managerId}`);
    }
  }
  if (selfManaged.length) {
    structural.push(`${selfManaged.length} employee(s) reporting to themselves`);
    for (const person of selfManaged) console.log(`  SELF-MANAGED: ${person.name}`);
  }
  if (inactiveManagersWithReports.length) {
    structural.push(
      `${inactiveManagersWithReports.length} inactive manager(s) still holding active reports`
    );
    for (const person of inactiveManagersWithReports) {
      const reports = (directReports.get(person.id) ?? []).filter((r) => r.status === "active");
      console.log(
        `  INACTIVE MANAGER: ${person.name} (${person.status}) still has ${reports.length} active report(s)`
      );
    }
  }

  // Warnings: real operational risk, but the tree is still resolvable.
  if (salespeopleWithoutManager.length) {
    console.log(
      `  WARNING: ${salespeopleWithoutManager.length} active salesperson(s) have no manager, so no manager sees their work:`
    );
    for (const person of salespeopleWithoutManager) console.log(`    - ${person.name}`);
  }
  if (managersWithoutReports.length) {
    console.log(
      `  WARNING: ${managersWithoutReports.length} field_manager(s) have no reports, so their team screens will be empty:`
    );
    for (const person of managersWithoutReports) console.log(`    - ${person.name}`);
  }
  if (unownedRetailers > 0) {
    console.log(
      `  WARNING: ${unownedRetailers} retailer(s) have no sales rep, so they appear on nobody's book.`
    );
  }

  if (wantReport) {
    console.log("");
    console.log("| Employee | Role | Current managerId | Manager name | Direct reports | Depth | Retailers | Unassigned? |");
    console.log("|---|---|---|---|---|---|---|---|");
    for (const person of active) {
      const managerName = person.managerId ? byId.get(person.managerId)?.name ?? "MISSING" : "—";
      const depthValue = depth.get(person.id);
      console.log(
        `| ${person.name} | ${person.roles.join(", ") || "—"} | ${person.managerId ?? "null"} ` +
          `| ${managerName} | ${(directReports.get(person.id) ?? []).length} ` +
          `| ${depthValue === -1 ? "broken" : depthValue} ` +
          `| ${person.salesRepId ? retailersByRep.get(person.salesRepId) ?? 0 : "—"} ` +
          `| ${person.managerId ? "no" : "yes"} |`
      );
    }
  }

  console.log("");
  if (structural.length) {
    console.log("FAIL — the hierarchy is structurally invalid:");
    for (const problem of structural) console.log(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  const risky = floating.length + managersWithoutReports.length + unownedRetailers;
  console.log(
    risky
      ? "OK (structurally valid). Reporting lines are incomplete — see the warnings above."
      : "OK. The reporting hierarchy is structurally valid and fully populated."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
