import { PrismaClient } from "@prisma/client";
import { PLATFORM_ADMIN_SURVEY_PERMISSIONS, STAFF_SURVEY_RESPOND_PERMISSIONS } from "./roleCatalog";
import { syncRolePermissions, type RoleSyncOptions } from "./roleSync";

async function main() {
  const [role, ...flags] = process.argv.slice(2);
  const modes = flags.filter((flag) => flag === "--dry-run" || flag === "--apply");
  const scopes = flags.filter((flag) => flag.startsWith("--scope="));
  const unknown = flags.filter(
    (flag) => !["--dry-run", "--apply"].includes(flag) && !flag.startsWith("--scope=")
  );
  if (
    !role ||
    modes.length > 1 ||
    scopes.length > 1 ||
    unknown.length > 0
  ) {
    throw new Error("Specify catalog role, optional --scope=platform-admin-survey|staff-survey-respond, and --dry-run or --apply");
  }

  const mode = modes[0] ?? "--dry-run";
  const scope = scopes[0]?.slice("--scope=".length);
  let options: RoleSyncOptions = {};
  if (scope !== undefined) {
    if (scope === "platform-admin-survey" && role === "platform_admin") {
      options = { permissionNames: PLATFORM_ADMIN_SURVEY_PERMISSIONS };
    } else if (scope === "staff-survey-respond" && (role === "salesperson" || role === "field_collector")) {
      options = { permissionNames: STAFF_SURVEY_RESPOND_PERMISSIONS };
    } else {
      throw new Error("The requested role-sync scope is not valid for the selected catalog role");
    }
  }

  const url = new URL(process.env.DATABASE_URL ?? "");
  // A live application apply must explicitly pin the expected database host.
  if (mode === "--apply" && (!process.env.ROLE_SYNC_EXPECTED_DB_HOST || url.hostname !== process.env.ROLE_SYNC_EXPECTED_DB_HOST)) {
    throw new Error("Database identity guard failed");
  }
  const db = new PrismaClient();
  try { console.log(JSON.stringify(await syncRolePermissions(db, role, mode === "--apply", options))); }
  finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Role sync failed; check role selection and database identity. No credentials displayed."); process.exitCode = 1; });
