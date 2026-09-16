import { PrismaClient } from "@prisma/client";
import { syncRolePermissions } from "./roleSync";

async function main() {
  const [role, mode = "--dry-run"] = process.argv.slice(2);
  if (!role || !["--dry-run", "--apply"].includes(mode)) throw new Error("Specify catalog role and --dry-run or --apply");
  const url = new URL(process.env.DATABASE_URL ?? "");
  // A live application apply must explicitly pin the expected database host.
  if (mode === "--apply" && (!process.env.ROLE_SYNC_EXPECTED_DB_HOST || url.hostname !== process.env.ROLE_SYNC_EXPECTED_DB_HOST)) {
    throw new Error("Database identity guard failed");
  }
  const db = new PrismaClient();
  try { console.log(JSON.stringify(await syncRolePermissions(db, role, mode === "--apply"))); }
  finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Role sync failed; check role selection and database identity. No credentials displayed."); process.exitCode = 1; });
