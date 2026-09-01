/**
 * Field UAT fixture — one salesperson's test day, created without destroying
 * anything.
 *
 *   npm run seed:field-uat
 *   npm run seed:field-uat -- --date=2026-09-02
 *   DATABASE_URL='<staging connection string>' npm run seed:field-uat
 *
 * This is deliberately NOT `prisma:seed`. The general seed opens with a block
 * of `deleteMany()` calls across the whole schema, which is right for building
 * a database from nothing and catastrophic for one that already holds staging
 * history somebody is mid-way through testing against.
 *
 * The rules this script holds to:
 *
 *   - no global deletes, ever;
 *   - every write is an upsert or a guarded create, so running it twice changes
 *     nothing the second time;
 *   - it refuses to fabricate canonical data. If the salesperson, the retailers
 *     or the catalogue are missing it says so and stops, rather than inventing
 *     a parallel set that would then diverge from the real one;
 *   - a day already in progress is left alone. If the route has visited or
 *     skipped stops, the stop list is not rewritten — re-running the fixture
 *     during a UAT session must not erase what the tester just did.
 *
 * The date is a parameter because the general seed stamps its route with the
 * day it happened to run, which means there is no route tomorrow. Run this each
 * morning of testing instead.
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS } from "../src/modules/identity/roleCatalog";

const prisma = new PrismaClient();

/** The salesperson under test. Staging identity, seeded by the general seed. */
const SALESPERSON_PHONE = "9812345670";
const SALESPERSON_EMAIL = "ravi@gagan.test";

/** Marks rows this fixture owns, so re-runs find them instead of duplicating. */
const FIXTURE_TAG = "[UAT]";

const TARGETS: Array<{ metric: any; value: number }> = [
  { metric: "order_value", value: 400000 },
  { metric: "visits", value: 80 },
  { metric: "order_count", value: 24 },
  { metric: "line_items", value: 40 },
  { metric: "productive_outlets", value: 12 },
  { metric: "collection_value", value: 150000 },
];

/**
 * The UAT date: `--date=YYYY-MM-DD`, or today at UTC midnight.
 *
 * `RoutePlan.planDate` is a `@db.Date`, so the time component must be stripped
 * or two runs on the same day land on different rows and the unique constraint
 * stops protecting anything.
 */
export function parseUatDate(argv: string[], now = new Date()): Date {
  const flag = argv.find((argument) => argument.startsWith("--date="));
  // `flag === undefined` and `--date=` are different intents: no flag means
  // today, an empty flag is a mistake. Testing the value for truthiness would
  // silently prepare the wrong day.
  if (flag === undefined) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const raw = flag.slice("--date=".length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`--date must be YYYY-MM-DD, got "${raw}"`);
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  // JavaScript rolls 2026-02-30 forward to 2026-03-02 rather than rejecting it,
  // so the only reliable check is that the date survives a round trip.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new Error(`--date must be a real calendar date, got "${raw}"`);
  }
  return parsed;
}

/**
 * Whether the route already holds exactly the intended stops, in order.
 *
 * Order matters: a beat is a sequence, and two plans with the same stores in a
 * different order are different days' work.
 */
export function stopsMatch(
  current: Array<{ retailerId: string; sequence: number }>,
  intended: Array<{ id: string }>
): boolean {
  if (current.length !== intended.length) return false;
  const ordered = [...current].sort((a, b) => a.sequence - b.sequence);
  return ordered.every((stop, index) => stop.retailerId === intended[index].id);
}

/** A day is in progress the moment any stop has stopped being pending. */
export function isDayInProgress(stops: Array<{ status: string }>): boolean {
  return stops.some((stop) => stop.status !== "pending");
}

/**
 * Bring the deployed role→permission grants up to the committed catalogue,
 * adding only. Returns nothing; it reports through the change log.
 */
async function syncRoleCatalogue() {
  const wanted = new Set(ROLE_DEFINITIONS.flatMap((role) => role.permissions));
  let newPermissions = 0;
  for (const name of wanted) {
    const before = await prisma.permission.findUnique({ where: { name }, select: { id: true } });
    if (!before) {
      await prisma.permission.create({ data: { name } });
      newPermissions += 1;
    }
  }

  const permissionIds = new Map(
    (await prisma.permission.findMany({ select: { id: true, name: true } })).map((row) => [
      row.name,
      row.id,
    ])
  );

  let newRoles = 0;
  let newGrants = 0;
  for (const definition of ROLE_DEFINITIONS) {
    let role = await prisma.role.findUnique({ where: { name: definition.name }, select: { id: true } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: definition.name, description: definition.description },
        select: { id: true },
      });
      newRoles += 1;
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
      newGrants += 1;
    }
  }

  if (newPermissions || newRoles || newGrants) {
    changed(
      `role catalogue synced — ${newPermissions} permission(s), ${newRoles} role(s), ${newGrants} grant(s) added`
    );
  } else {
    unchanged("role catalogue already matches the committed definitions");
  }
}

const changes: string[] = [];
const kept: string[] = [];
function changed(what: string) {
  changes.push(what);
}
function unchanged(what: string) {
  kept.push(what);
}

async function main() {
  const environment = process.env.NODE_ENV ?? "";
  if (!["development", "staging", "test"].includes(environment)) {
    throw new Error(
      `refusing to run with NODE_ENV=${environment || "(unset)"}; expected development, staging or test`
    );
  }

  const uatDate = parseUatDate(process.argv);
  const dateLabel = uatDate.toISOString().slice(0, 10);
  console.log(`Field UAT fixture for ${dateLabel}\n`);

  /* ---------------------------- role catalogue ---------------------------- */

  // Roles are seed *data*, not schema, so `prisma migrate deploy` does not
  // update them. A database seeded before a permission existed keeps the old
  // grant set forever, and the salesperson gets 403 on every screen the new
  // permission guards. This reconciles the deployed grants with the catalogue.
  //
  // Additive only: it creates missing permissions and missing role links and
  // never revokes anything. Revoking is a policy decision that belongs to an
  // administrator, not to a UAT fixture.
  await syncRoleCatalogue();

  /* ------------------------- canonical prerequisites ---------------------- */

  const salesperson = await prisma.staffUser.findFirst({
    where: { OR: [{ email: SALESPERSON_EMAIL }, { phone: SALESPERSON_PHONE }] },
    select: { id: true, name: true, phone: true, salesRepId: true, managerId: true, status: true },
  });
  if (!salesperson) {
    throw new Error(
      `no salesperson found for ${SALESPERSON_PHONE} / ${SALESPERSON_EMAIL}. Run the general seed on a fresh database first.`
    );
  }
  if (!salesperson.salesRepId) {
    throw new Error(
      `${salesperson.name} has no SalesRep link, so no retailer can be assigned to them. Fix the identity before running UAT.`
    );
  }
  if (salesperson.status !== "active") {
    throw new Error(`${salesperson.name} is ${salesperson.status}, not active.`);
  }

  const actor = await prisma.staffUser.findFirst({
    where: { roles: { some: { role: { name: "platform_admin" } } } },
    select: { id: true, name: true },
  });
  if (!actor) throw new Error("no platform_admin found to attribute fixture writes to.");

  const retailers = await prisma.retailer.findMany({
    where: { salesRepId: salesperson.salesRepId },
    select: { id: true, name: true, status: true, currentBalance: true, overdueAmount: true },
    orderBy: { name: "asc" },
  });
  if (retailers.length < 5) {
    throw new Error(
      `${salesperson.name} has ${retailers.length} assigned retailers; the UAT day needs at least 5. Assign more via Retailer.salesRepId rather than letting this script invent them.`
    );
  }

  const orderable = await prisma.inventorySnapshot.count({ where: { available: { gt: 0 } } });
  if (orderable === 0) {
    throw new Error(
      "no inventory snapshot has stock available, so an order cannot be placed. Let the mock SAP sync run, or check SAP_MODE=mock."
    );
  }

  console.log(`Salesperson    ${salesperson.name} (${salesperson.phone})`);
  console.log(`Retailers      ${retailers.length} assigned`);
  console.log(`Inventory      ${orderable} snapshot(s) with stock\n`);

  /* ------------------------------- hierarchy ------------------------------ */

  if (salesperson.managerId) {
    const manager = await prisma.staffUser.findUnique({
      where: { id: salesperson.managerId },
      select: { name: true },
    });
    unchanged(`reporting line intact — reports to ${manager?.name ?? "unknown"}`);
  } else {
    // The reporting line is an organisational fact. Guessing one would put a
    // real person's work under the wrong manager, so this reports and moves on.
    unchanged(
      "NO MANAGER — Ravi's work will not appear on any manager screen. Set it in Admin → Sales organisation, or run seed:staging-hierarchy."
    );
  }

  /* --------------------------------- route -------------------------------- */

  const stopRetailers = retailers.slice(0, 5);
  const existingPlan = await prisma.routePlan.findUnique({
    where: { salespersonId_planDate: { salespersonId: salesperson.id, planDate: uatDate } },
    include: { stops: { select: { id: true, status: true } } },
  });

  const plan = await prisma.routePlan.upsert({
    where: { salespersonId_planDate: { salespersonId: salesperson.id, planDate: uatDate } },
    update: { status: "published", publishedAt: new Date(), name: `${FIXTURE_TAG} Kothrud & Baner beat` },
    create: {
      salespersonId: salesperson.id,
      planDate: uatDate,
      name: `${FIXTURE_TAG} Kothrud & Baner beat`,
      status: "published",
      publishedAt: new Date(),
      createdByStaffId: actor.id,
    },
  });

  const dayInProgress = isDayInProgress(existingPlan?.stops ?? []);
  const currentStops = await prisma.routePlanStop.findMany({
    where: { routePlanId: plan.id },
    select: { retailerId: true, sequence: true },
    orderBy: { sequence: "asc" },
  });
  const alreadyCorrect = stopsMatch(currentStops, stopRetailers);

  if (dayInProgress) {
    unchanged(
      `route for ${dateLabel} left as is — ${existingPlan!.stops.filter((s) => s.status !== "pending").length} stop(s) already worked`
    );
  } else if (alreadyCorrect) {
    unchanged(`route for ${dateLabel} already published with ${currentStops.length} stops`);
  } else {
    // Scoped to this plan only, and only while nothing has been visited.
    // Deleting a visited stop would strand the SalesVisit that points at it.
    await prisma.routePlanStop.deleteMany({ where: { routePlanId: plan.id } });
    await prisma.routePlanStop.createMany({
      data: stopRetailers.map((retailer, index) => ({
        routePlanId: plan.id,
        retailerId: retailer.id,
        sequence: index + 1,
        purpose: index === 1 ? ("collection" as const) : ("sales_call" as const),
      })),
    });
    changed(`route published for ${dateLabel} with ${stopRetailers.length} stops`);
  }

  /* -------------------------------- targets ------------------------------- */

  const periodStart = new Date(Date.UTC(uatDate.getUTCFullYear(), uatDate.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(uatDate.getUTCFullYear(), uatDate.getUTCMonth() + 1, 0));
  let targetsWritten = 0;
  for (const target of TARGETS) {
    const before = await prisma.salesTarget.findUnique({
      where: {
        salespersonId_metric_periodStart_periodEnd: {
          salespersonId: salesperson.id,
          metric: target.metric,
          periodStart,
          periodEnd,
        },
      },
      select: { id: true },
    });
    await prisma.salesTarget.upsert({
      where: {
        salespersonId_metric_periodStart_periodEnd: {
          salespersonId: salesperson.id,
          metric: target.metric,
          periodStart,
          periodEnd,
        },
      },
      update: { targetValue: target.value },
      create: {
        salespersonId: salesperson.id,
        metric: target.metric,
        periodStart,
        periodEnd,
        targetValue: target.value,
        createdByStaffId: actor.id,
      },
    });
    if (!before) targetsWritten += 1;
  }
  targetsWritten
    ? changed(`${targetsWritten} target(s) created for ${periodStart.toISOString().slice(0, 7)}`)
    : unchanged(`${TARGETS.length} targets already set for ${periodStart.toISOString().slice(0, 7)}`);

  /* --------------------------------- tasks -------------------------------- */

  const taskFixtures = [
    {
      title: `${FIXTURE_TAG} Collect the signed delivery note`,
      description: "Ask for the POD copy from the last dispatch before leaving the store.",
      priority: "high" as const,
      retailerId: stopRetailers[0].id,
      dueAt: new Date(uatDate.getTime() + 18 * 60 * 60 * 1000),
    },
    {
      title: `${FIXTURE_TAG} Photograph the new shelf display`,
      description: "One clear photo of the front shelf, for the merchandising review.",
      priority: "normal" as const,
      retailerId: stopRetailers[1].id,
      dueAt: null,
    },
  ];
  let tasksCreated = 0;
  for (const task of taskFixtures) {
    const existing = await prisma.fieldTask.findFirst({
      where: { assignedToStaffId: salesperson.id, title: task.title, status: { in: ["open", "in_progress"] } },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.fieldTask.create({
      data: { ...task, assignedToStaffId: salesperson.id, createdByStaffId: actor.id },
    });
    tasksCreated += 1;
  }
  tasksCreated
    ? changed(`${tasksCreated} follow-up task(s) created`)
    : unchanged(`${taskFixtures.length} follow-up tasks already open`);

  /* --------------------------- retailer scenarios ------------------------- */

  // One store with a verified location, so check-in has something to measure
  // distance against, and one deliberately without, so the unverified path is
  // reachable. Nothing else about the retailer is touched.
  const geoVerified = stopRetailers[0];
  const geoLocation = await prisma.retailerLocation.findUnique({
    where: { retailerId: geoVerified.id },
    select: { status: true },
  });
  if (geoLocation?.status === "VERIFIED") {
    unchanged(`${geoVerified.name} already has a verified location`);
  } else {
    await prisma.retailerLocation.upsert({
      where: { retailerId: geoVerified.id },
      update: {
        latitude: 18.5074,
        longitude: 73.8077,
        accuracyMeters: 12,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
      create: {
        retailerId: geoVerified.id,
        latitude: 18.5074,
        longitude: 73.8077,
        accuracyMeters: 12,
        status: "VERIFIED",
        source: "MIGRATION",
        capturedAt: new Date(),
        verifiedAt: new Date(),
        locationVersion: 1,
      },
    });
    changed(`${geoVerified.name} given a verified location for check-in testing`);
  }

  const withOverdue = retailers.filter((retailer) => Number(retailer.overdueAmount) > 0);
  const withBalance = retailers.filter((retailer) => Number(retailer.currentBalance) > 0);
  const unverified = await prisma.retailer.findFirst({
    where: {
      salesRepId: salesperson.salesRepId,
      id: { not: geoVerified.id },
      OR: [{ location: { is: null } }, { location: { status: { not: "VERIFIED" } } }],
    },
    select: { name: true },
  });

  /* -------------------------------- summary ------------------------------- */

  console.log("Changed:");
  console.log(changes.length ? changes.map((line) => `  + ${line}`).join("\n") : "  (nothing — already prepared)");
  console.log("\nAlready in place:");
  console.log(kept.map((line) => `  = ${line}`).join("\n"));

  console.log("\nRavi's UAT day");
  console.log(`  Phone            ${salesperson.phone}`);
  console.log(`  OTP              staging MOCK_OTP (123456 unless overridden)`);
  console.log(`  Date             ${dateLabel}`);
  console.log(`  Route stops      ${stopRetailers.map((r) => r.name).join(", ")}`);
  console.log(`  Verified geo     ${geoVerified.name}`);
  console.log(`  Unverified geo   ${unverified?.name ?? "(none — every assigned store is verified)"}`);
  console.log(`  Outstanding      ${withOverdue.length ? withOverdue.map((r) => r.name).join(", ") : "(none overdue)"}`);
  console.log(`  Carrying balance ${withBalance.length ? withBalance.map((r) => r.name).join(", ") : "(none)"}`);
  console.log(`  Targets          ${TARGETS.map((t) => t.metric).join(", ")}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`\nFIXTURE FAILED: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
