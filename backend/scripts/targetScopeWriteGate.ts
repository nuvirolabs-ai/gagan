import { prisma } from "../src/lib/prisma";
import { setTargetWritesPaused } from "../src/modules/performance/targetScopeCutover";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main() {
  const expectedDatabase = option("--expected-database");
  const pause = process.argv.includes("--pause");
  const release = process.argv.includes("--release");
  if (!expectedDatabase || pause === release) throw new Error("expected_database_and_one_gate_action_required");
  const identity = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (identity[0]?.name !== expectedDatabase) throw new Error("database_identity_mismatch");
  if (!process.argv.includes("--apply")) {
    process.stdout.write(`${JSON.stringify({ database: expectedDatabase, action: pause ? "pause" : "release", applied: false })}\n`);
    return;
  }
  await setTargetWritesPaused(prisma, pause);
  process.stdout.write(`${JSON.stringify({ database: expectedDatabase, paused: pause, applied: true })}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
