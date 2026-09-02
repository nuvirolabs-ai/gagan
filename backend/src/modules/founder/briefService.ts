import type { Prisma, PrismaClient } from "@prisma/client";
import {
  fillVsComparable,
  largestRisk,
  moneyVsComparable,
  pendingDecisionLine,
  teamConcern,
} from "./briefDomain";
import { addDays, startOfDay } from "./period";
import { PulseService } from "./pulseService";
import type { FounderBrief } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

export class BriefService {
  constructor(
    _db: Db,
    private readonly pulse = new PulseService(_db)
  ) {}

  async getBrief(input: { kind?: string; staffId: string; name: string; now?: Date }): Promise<FounderBrief> {
    const now = input.now ?? new Date();
    const kind = input.kind === "evening" ? "evening" : "morning";
    const pulseAt = kind === "morning" ? afternoonYesterday(now) : now;
    const pulse = await this.pulse.getPulse({
      staffId: input.staffId,
      name: input.name,
      now: pulseAt,
    });

    const orders = metric(pulse.metrics, "orders");
    const collections = metric(pulse.metrics, "collections");
    const fill = metric(pulse.metrics, "fillRate");
    const team = pulse.health.find((row) => row.domain === "Sales Team");

    const statements = [
      kind === "morning"
        ? moneyVsComparable("Orders", orders?.value ?? null, previousFromDelta(orders))
        : moneyVsComparable("Orders", orders?.value ?? null, previousFromDelta(orders)),
      moneyVsComparable("Collections", collections?.value ?? null, previousFromDelta(collections)),
      fillVsComparable(fill?.value ?? null, previousFromDelta(fill)),
      largestRisk(pulse.issues),
      kind === "morning" ? teamConcern(team?.reason ?? null, team?.status ?? null) : null,
      kind === "morning" ? pendingDecisionLine(pulse.pendingDecisions.count) : null,
      kind === "evening" ? largestUnresolved(pulse.issues) : null,
    ].filter((row): row is string => Boolean(row));

    const omitted: string[] = [];
    if (orders?.availability === "unavailable") omitted.push("orders");
    if (collections?.availability === "unavailable") omitted.push("collections");
    if (fill?.availability === "unavailable") omitted.push("fulfilment");
    if (pulse.issues.length === 0) omitted.push("unresolved issue");

    return {
      kind,
      asOf: pulse.asOf,
      title: kind === "morning" ? "Morning brief" : "Evening brief",
      statements,
      omitted,
    };
  }
}

function afternoonYesterday(now: Date): Date {
  return new Date(addDays(startOfDay(now), -1).getTime() + 16 * 3_600_000);
}

function metric(metrics: Array<{ id: string; value: number | null; availability: string; delta: { amount: number; direction: string } | null }>, id: string) {
  return metrics.find((row) => row.id === id);
}

function previousFromDelta(row: { value: number | null; delta: { amount: number; direction: string } | null } | undefined): number | null {
  if (!row || row.value == null || !row.delta) return null;
  if (row.delta.direction === "up") return row.value - row.delta.amount;
  if (row.delta.direction === "down") return row.value + row.delta.amount;
  return row.value;
}

function largestUnresolved(issues: Array<{ title: string }>): string | null {
  if (issues.length === 0) return null;
  return `Biggest unresolved issue: ${issues[0].title}.`;
}
