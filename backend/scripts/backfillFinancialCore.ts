import { prisma } from "../src/lib/prisma";
import { backfillFinancialCore } from "../src/modules/payments/reconciliationService";

async function main() {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--apply");
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(", ")}`);

  const summary = await backfillFinancialCore({ apply: process.argv.includes("--apply") });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
