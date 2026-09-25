import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { getHistoricalTargetRows } from "../src/modules/performance/targetScopeCutover";
import { auditTargetRows, TargetScopeEvidence } from "../src/modules/performance/targetScopeMigration";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main() {
  const expectedDatabase = option("--expected-database");
  if (!expectedDatabase) throw new Error("expected_database_required");
  const identity = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (identity[0]?.name !== expectedDatabase) throw new Error("database_identity_mismatch");

  const file = option("--proposals");
  const proposals = file
    ? JSON.parse(await readFile(file, "utf8")) as Record<string, TargetScopeEvidence>
    : {};
  if (!proposals || Array.isArray(proposals) || typeof proposals !== "object") {
    throw new Error("target_scope_proposals_invalid");
  }
  const rows = await getHistoricalTargetRows(prisma);
  const ids = new Set(rows.map((row) => row.id));
  if (Object.keys(proposals).some((id) => !ids.has(id))) throw new Error("target_scope_proposals_stale");
  process.stdout.write(`${JSON.stringify({ database: expectedDatabase, rows: auditTargetRows(rows, proposals) }, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
