import { Prisma, PrismaClient } from "@prisma/client";
import {
  HistoricalTargetRow,
  TargetScopeMappingEntry,
  validateTargetScopeMapping,
} from "./targetScopeMigration";

type Reader = Pick<PrismaClient, "salesTarget">;

export async function getHistoricalTargetRows(client: Reader): Promise<HistoricalTargetRow[]> {
  return client.salesTarget.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      salespersonId: true,
      metric: true,
      periodStart: true,
      periodEnd: true,
      targetValue: true,
      createdByStaffId: true,
      createdAt: true,
      updatedAt: true,
      scope: true,
    },
  });
}

export async function setTargetWritesPaused(client: PrismaClient, paused: boolean): Promise<void> {
  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('LOCK TABLE "SalesTarget" IN SHARE ROW EXCLUSIVE MODE');
    const changed = await tx.$executeRaw`
      UPDATE "TargetWriteGate" SET "paused" = ${paused} WHERE "name" = 'sales_target_writes'
    `;
    if (changed !== 1) throw new Error("target_write_gate_missing");
  }, { timeout: 30_000 });
}

export async function backfillTargetScopes(
  client: PrismaClient,
  mapping: readonly TargetScopeMappingEntry[],
  options: { apply?: boolean } = {},
): Promise<{ total: number; changed: number; applied: boolean }> {
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('LOCK TABLE "SalesTarget" IN SHARE ROW EXCLUSIVE MODE');
    const gate = await tx.$queryRaw<Array<{ paused: boolean }>>`
      SELECT "paused" FROM "TargetWriteGate" WHERE "name" = 'sales_target_writes'
    `;
    if (options.apply && gate[0]?.paused !== true) throw new Error("target_writes_not_quiesced");

    const rows = await getHistoricalTargetRows(tx);
    validateTargetScopeMapping(rows, mapping);
    const changed = rows.filter((row) => row.scope === null).length;

    if (options.apply) {
      for (const entry of mapping) {
        await tx.$executeRaw`
          UPDATE "SalesTarget"
          SET "scope" = CAST(${entry.scope} AS "SalesTargetScope")
          WHERE "id" = ${entry.targetId} AND "scope" IS NULL
        `;
      }
      const after = await getHistoricalTargetRows(tx);
      validateTargetScopeMapping(after, mapping);
      if (after.some((row) => row.scope === null)) throw new Error("target_scope_unresolved");
    }
    return { total: rows.length, changed, applied: options.apply === true };
  }, { timeout: 30_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
