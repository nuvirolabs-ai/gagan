/**
 * Staging-only sales organisation.
 *
 *   NODE_ENV=development npx ts-node --transpile-only scripts/seedStagingHierarchy.ts
 *   DATABASE_URL='<staging connection string>' NODE_ENV=staging npm run seed:staging-hierarchy
 *
 * Builds a four-level reporting tree on top of whatever the main seed created,
 * so the manager surfaces can be exercised at a realistic depth:
 *
 *   Vikram Sethi        National Sales Head
 *     └ Sunita Rao      Regional Manager — MP        (created by the main seed)
 *         └ Deepak Iyer Area Manager — Indore
 *             ├ Ravi Kumar    salesperson            (created by the main seed)
 *             └ Priya Deshmukh salesperson           (created by the main seed)
 *
 * The names are invented and the email domain is `.test`, which is reserved and
 * can never resolve. Nothing here is a production identity, and the script
 * refuses to run against a production NODE_ENV.
 *
 * It is idempotent: run it as often as you like. It only ever moves the people
 * it created plus the two seeded salespeople, and it never touches
 * `Retailer.salesRepId` — a manager's book is derived from their descendants,
 * so building the tree must not move a single store.
 */
import { PrismaClient } from "@prisma/client";
import { HierarchyService } from "../src/modules/org/hierarchyService";

const prisma = new PrismaClient();
const hierarchy = new HierarchyService(prisma);

/** Marks the fixture's own rows so re-running the script does not pile them up. */
const FIXTURE_EXPENSE_NOTE = "Staging fixture — bus fare to the beat";

/** Invented people. The two salespeople below already exist from the main seed. */
const MANAGERS = [
  { key: "national", name: "Vikram Sethi", title: "National Sales Head", phone: "9812345680", email: "vikram@gagan.test", ref: "MGR-NAT-001" },
  { key: "regional", name: "Sunita Rao", title: "Regional Manager — MP", phone: "9812345672", email: "sunita@gagan.test", ref: "MGR-001" },
  { key: "area", name: "Deepak Iyer", title: "Area Manager — Indore", phone: "9812345681", email: "deepak@gagan.test", ref: "MGR-AREA-001" },
];

async function main() {
  const environment = process.env.NODE_ENV ?? "";
  if (!["development", "staging", "test"].includes(environment)) {
    throw new Error(
      `refusing to run with NODE_ENV=${environment || "(unset)"}; expected development, staging or test`
    );
  }

  const [managerRole, platformAdmin] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "field_manager" } }),
    // The actual platform admin, not merely the first staff row that happens to
    // have a portal login — every move this script makes is attributed to this
    // person in the audit trail, so picking the wrong one falsifies history.
    prisma.staffUser.findFirstOrThrow({
      where: { adminUserId: { not: null }, roles: { some: { role: { name: "platform_admin" } } } },
      select: { id: true, adminUser: { select: { passwordHash: true } } },
    }),
  ]);

  const created: Record<string, string> = {};

  for (const manager of MANAGERS) {
    // Managers work in the admin portal, so each needs an AdminUser to sign in
    // with. The password hash is copied from the existing platform admin rather
    // than inventing a second staging credential to keep track of.
    const login = await prisma.adminUser.upsert({
      where: { email: manager.email },
      update: { name: manager.name },
      create: {
        email: manager.email,
        name: manager.name,
        passwordHash: platformAdmin.adminUser!.passwordHash,
      },
    });

    const staff = await prisma.staffUser.upsert({
      where: { email: manager.email },
      update: { name: manager.name, status: "active", adminUserId: login.id },
      create: {
        name: manager.name,
        phone: manager.phone,
        email: manager.email,
        employeeRef: manager.ref,
        adminUserId: login.id,
      },
    });
    created[manager.key] = staff.id;

    const holdsRole = await prisma.staffRole.findFirst({
      where: { staffId: staff.id, roleId: managerRole.id },
    });
    if (!holdsRole) {
      await prisma.staffRole.create({ data: { staffId: staff.id, roleId: managerRole.id } });
    }
  }

  const salespeople = await prisma.staffUser.findMany({
    where: { email: { in: ["ravi@gagan.test", "priya@gagan.test"] } },
    select: { id: true, name: true },
  });
  if (salespeople.length === 0) {
    throw new Error("run the main seed first: the seeded salespeople are missing");
  }

  // Top-down, so each manager exists before anyone is pointed at them. Every
  // move goes through the same validated, audited path the admin UI uses —
  // a fixture that bypassed the guards would not prove the guards work.
  const moves: Array<{ employeeId: string; managerId: string | null; label: string }> = [
    { employeeId: created.national, managerId: null, label: "Vikram Sethi → top of tree" },
    { employeeId: created.regional, managerId: created.national, label: "Sunita Rao → Vikram Sethi" },
    { employeeId: created.area, managerId: created.regional, label: "Deepak Iyer → Sunita Rao" },
    ...salespeople.map((person) => ({
      employeeId: person.id,
      managerId: created.area,
      label: `${person.name} → Deepak Iyer`,
    })),
  ];

  const retailersBefore = await prisma.retailer.count({ where: { salesRepId: { not: null } } });

  for (const move of moves) {
    const result = await hierarchy.setManager({
      employeeId: move.employeeId,
      managerId: move.managerId,
      actorStaffId: platformAdmin.id,
      reason: "Staging hierarchy fixture",
    });
    console.log(`${result.changed ? "moved   " : "already "} ${move.label}`);
  }

  // A few pending items so the manager review queues are not empty on staging.
  // Deliberately one per level: the area manager's own expense is what proves a
  // regional manager's scope reaches past their direct reports.
  const reviewSubjects = [
    ...salespeople.map((person) => ({ id: person.id, label: person.name })),
    { id: created.area, label: "Deepak Iyer" },
  ];
  for (const subject of reviewSubjects) {
    const existing = await prisma.fieldExpense.findFirst({
      where: { salespersonId: subject.id, description: FIXTURE_EXPENSE_NOTE },
    });
    if (!existing) {
      await prisma.fieldExpense.create({
        data: {
          salespersonId: subject.id,
          expenseDate: new Date(),
          category: "travel",
          amount: "240.00",
          description: FIXTURE_EXPENSE_NOTE,
        },
      });
      console.log(`expense  pending review for ${subject.label}`);
    }
  }

  const retailersAfter = await prisma.retailer.count({ where: { salesRepId: { not: null } } });
  if (retailersBefore !== retailersAfter) {
    throw new Error(
      `building the tree changed retailer ownership (${retailersBefore} → ${retailersAfter}); it must not`
    );
  }

  console.log("");
  for (const node of await hierarchy.tree()) {
    console.log(`${"  ".repeat(node.depth)}${node.depth ? "└ " : ""}${node.name}`);
  }
  console.log(`\nRetailer assignments untouched: ${retailersAfter} still owned by their sales rep.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
