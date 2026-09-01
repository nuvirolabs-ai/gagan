import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { TargetService, currentMonth, type MetricActuals, type Period } from "./targetService";
import { buildProgress, startOfDay, type TargetMetric } from "./targetDomain";
import {
  RANKING_METRIC_LABEL,
  chooseMetric,
  rankContenders,
  rankMovement,
  type RankedEntry,
  type RankingMetric,
  type RankingScope,
} from "./rankingDomain";

type Db = PrismaClient | any;

export interface RankingRequest {
  scope: RankingScope;
  /** Required for a territory scope; ignored for company. */
  territory?: string | null;
  period?: Period;
  now?: Date;
}

export interface RankingResult {
  scope: RankingScope;
  scopeLabel: string;
  metric: RankingMetric;
  metricLabel: string;
  /** Why this metric was chosen, so a ranking is never unexplained. */
  metricReason: string;
  participants: number;
  periodStart: string;
  periodEnd: string;
  entries: Array<RankedEntry & { previousRank: number | null }>;
}

/**
 * Server-authoritative ranking.
 *
 * Nothing about a position is computed on a device: a phone showing "#4 of 32"
 * is showing what the server decided, over a scope the server chose, so two
 * salespeople can never see contradictory standings.
 */
export class RankingService {
  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly targets = new TargetService(prisma ?? defaultPrisma)
  ) {}

  /** Active field staff in scope, with the sales-rep link orders hang off. */
  private async participants(request: RankingRequest) {
    const staff = await this.prisma.staffUser.findMany({
      where: {
        status: "active",
        salesRepId: { not: null },
        ...(request.scope === "territory" && request.territory
          ? { salesRep: { territory: request.territory } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        salesRepId: true,
        salesRep: { select: { territory: true } },
      },
      orderBy: { name: "asc" },
    });
    return staff.map((member: any) => ({
      staffId: member.id,
      name: member.name,
      salesRepId: member.salesRepId as string | null,
      territory: member.salesRep?.territory ?? null,
    }));
  }

  /** The value each salesperson is ranked on, plus how the metric was chosen. */
  private async valuesFor(input: {
    people: ReadonlyArray<{ staffId: string; name: string; salesRepId: string | null }>;
    period: Period;
    now: Date;
  }) {
    const [actualsByStaff, targets] = await Promise.all([
      this.targets.bulkActuals({ salespeople: input.people, period: input.period }),
      this.prisma.salesTarget.findMany({
        where: {
          salespersonId: { in: input.people.map((person) => person.staffId) },
          periodStart: { lte: startOfDay(input.period.to) },
          periodEnd: { gte: startOfDay(input.period.from) },
        },
      }),
    ]);

    const targetsByStaff = new Map<string, any[]>();
    for (const target of targets as any[]) {
      targetsByStaff.set(target.salespersonId, [
        ...(targetsByStaff.get(target.salespersonId) ?? []),
        target,
      ]);
    }

    const choice = chooseMetric({
      participants: input.people.length,
      withTargets: targetsByStaff.size,
    });

    const contenders = input.people.map((person) => ({
      salespersonId: person.staffId,
      name: person.name,
      value: this.valueFor({
        metric: choice.metric,
        actuals: actualsByStaff.get(person.staffId),
        targets: targetsByStaff.get(person.staffId) ?? [],
        period: input.period,
        now: input.now,
      }),
    }));

    return { contenders, choice };
  }

  /**
   * Target achievement averages a salesperson's own targets, so someone
   * carrying three targets is measured across all of them rather than on
   * whichever happens to be furthest along.
   */
  private valueFor(input: {
    metric: RankingMetric;
    actuals: MetricActuals | undefined;
    targets: any[];
    period: Period;
    now: Date;
  }): number {
    const actuals = input.actuals;
    if (!actuals) return 0;
    if (input.metric === "order_value") return actuals.order_value;

    const percentages = input.targets
      .filter((target) => Number(target.targetValue) > 0)
      .map((target) =>
        buildProgress({
          metric: target.metric as TargetMetric,
          target: Number(target.targetValue),
          actual: actuals[target.metric as TargetMetric] ?? 0,
          periodStart: target.periodStart,
          periodEnd: target.periodEnd,
        }).completionPct
      );
    if (percentages.length === 0) return 0;
    return (
      Math.round(
        (percentages.reduce((sum, pct) => sum + pct, 0) / percentages.length) * 100
      ) / 100
    );
  }

  async rank(request: RankingRequest): Promise<RankingResult> {
    const now = request.now ?? new Date();
    const period = request.period ?? currentMonth(now);
    const people = await this.participants(request);

    const scopeLabel =
      request.scope === "territory" ? (request.territory ?? "your territory") : "the company";

    if (people.length === 0) {
      return {
        scope: request.scope,
        scopeLabel,
        metric: "order_value",
        metricLabel: RANKING_METRIC_LABEL.order_value,
        metricReason: "Nobody in this scope to rank.",
        participants: 0,
        periodStart: period.from.toISOString().slice(0, 10),
        periodEnd: period.to.toISOString().slice(0, 10),
        entries: [],
      };
    }

    const current = await this.valuesFor({ people, period, now });
    const ranked = rankContenders(current.contenders);

    // The same computation over the period before, so a movement is measured
    // rather than guessed.
    const previous = previousPeriod(period);
    const before = await this.valuesFor({ people, period: previous, now: previous.to });
    const previousRanks = new Map(
      rankContenders(before.contenders).map((entry) => [entry.salespersonId, entry.rank])
    );
    const hadAnyActivity = before.contenders.some((contender) => contender.value > 0);

    return {
      scope: request.scope,
      scopeLabel,
      metric: current.choice.metric,
      metricLabel: RANKING_METRIC_LABEL[current.choice.metric],
      metricReason: current.choice.reason,
      participants: people.length,
      periodStart: period.from.toISOString().slice(0, 10),
      periodEnd: period.to.toISOString().slice(0, 10),
      entries: ranked.map((entry) => ({
        ...entry,
        // With no history to compare against there is no previous position,
        // and inventing one would show everybody a fake movement arrow.
        previousRank: hadAnyActivity ? (previousRanks.get(entry.salespersonId) ?? null) : null,
      })),
    };
  }

  /** One salesperson's standing, in the scope their own territory defines. */
  async standingFor(input: {
    salespersonId: string;
    scope?: RankingScope;
    period?: Period;
    now?: Date;
  }) {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: input.salespersonId },
      select: { salesRep: { select: { territory: true } } },
    });
    const territory = staff?.salesRep?.territory ?? null;
    const scope: RankingScope = input.scope ?? (territory ? "territory" : "company");

    const result = await this.rank({
      scope,
      territory,
      period: input.period,
      now: input.now,
    });
    const entry = result.entries.find((row) => row.salespersonId === input.salespersonId) ?? null;
    return {
      scope: result.scope,
      scopeLabel: result.scopeLabel,
      metric: result.metric,
      metricLabel: result.metricLabel,
      metricReason: result.metricReason,
      participants: result.participants,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      rank: entry?.rank ?? null,
      value: entry?.value ?? 0,
      previousRank: entry?.previousRank ?? null,
      movement: entry ? rankMovement(entry.rank, entry.previousRank) : null,
    };
  }
}

/** The period of the same length immediately before this one. */
export function previousPeriod(period: Period): Period {
  const from = startOfDay(period.from);
  const to = startOfDay(period.to);
  const lengthMs = to.getTime() - from.getTime() + 86_400_000;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(from.getTime() - lengthMs);
  return { from: previousFrom, to: previousTo };
}

export const defaultRankingService = new RankingService();
