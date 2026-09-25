import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { backfillTargetScopes } from "../src/modules/performance/targetScopeCutover";
import { parseTargetScopeMapping } from "../src/modules/performance/targetScopeMigration";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main() {
  const expectedDatabase = option("--expected-database");
  const mappingFile = option("--mapping");
  const expectedHash = option("--expected-sha256");
  if (!expectedDatabase || !mappingFile || !expectedHash) throw new Error("mapping_database_and_hash_required");
  const identity = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (identity[0]?.name !== expectedDatabase) throw new Error("database_identity_mismatch");

  const bytes = await readFile(mappingFile);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expectedHash) throw new Error("target_scope_mapping_hash_mismatch");
  const mapping = parseTargetScopeMapping(JSON.parse(bytes.toString("utf8")));
  const result = await backfillTargetScopes(prisma, mapping, { apply: process.argv.includes("--apply") });
  process.stdout.write(`${JSON.stringify({ database: expectedDatabase, hash, ...result })}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
