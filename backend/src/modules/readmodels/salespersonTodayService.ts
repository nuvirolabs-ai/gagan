import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { FieldDashboardService } from "../field/dashboardService";
import { TargetService, currentMonth, type Period } from "../performance/targetService";
import { AchievementService } from "../performance/achievementService";
import { RankingService } from "../performance/rankingService";
import { OpportunityService } from "../intelligence/opportunityService";
import { remainingSentence, type TargetProgress } from "../performance/targetDomain";

type Db = PrismaClient | any;

/** How many actions Today shows before it stops being a to-do list. */
export const TODAY_OPPORTUNITY_LIMIT = 4;

/**
 * Everything the salesperson's Today screen needs, in one request.
 *
 * The screen combines the field day, targets, standing, recognition and next
 * best actions. Fetching those separately would be six round trips on a phone
 * that is often on one bar of signal, so they are composed here and the app
 * makes one call.
 */
export class SalespersonTodayService {
  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly field = new FieldDashboardService(prisma ?? defaultPrisma),
    private readonly targets = new TargetService(prisma ?? defaultPrisma),
    private readonly achievements = new AchievementService(prisma ?? defaultPrisma),
    private readonly ranking = new RankingService(prisma ?? defaultPrisma),
    private readonly opportunities = new OpportunityService(prisma ?? defaultPrisma)
  ) {}

  async load(input: { salespersonId: string; now?: Date }) {
    const now = input.now ?? new Date();
    const period = currentMonth(now);

    // The field day and the period's measurements are independent, so they are
    // fetched together rather than one after the other.
    const [day, actuals] = await Promise.all([
      this.field.today({ salespersonId: input.salespersonId, now }),
      this.targets.actualsFor({ salespersonId: input.salespersonId, period }),
    ]);

    const [progress, standing, opportunities] = await Promise.all([
      this.targets.progressFor({ salespersonId: input.salespersonId, period, now, actuals }),
      this.ranking.standingFor({ salespersonId: input.salespersonId, period, now }),
      this.opportunities.forSalesperson({
        salespersonId: input.salespersonId,
        now,
        limit: TODAY_OPPORTUNITY_LIMIT,
      }),
    ]);

    // Recognition is evaluated against what was just measured, so a milestone
    // crossed by this morning's order is celebrated on this load and never again.
    const previousPeriodValues = await this.previousPeriodValues({
      salespersonId: input.salespersonId,
      period,
    });
    const newlyEarned = await this.achievements.record({
      subject: { kind: "salesperson", id: input.salespersonId },
      progress,
      previousPeriodValues,
      newRetailersAdded: actuals.new_customers,
      ranking: {
        rank: standing.rank,
        previousRank: standing.previousRank,
        participants: standing.participants,
        scopeLabel: standing.scopeLabel,
      },
      periodStart: period.from,
      periodEnd: period.to,
    });
    const recentAchievements = await this.achievements.recent({
      subject: { kind: "salesperson", id: input.salespersonId },
      limit: 5,
      now,
    });

    const headline = TargetService.headline(progress);

    return {
      ...day,
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      /** The one target the screen leads with, already in plain words. */
      headlineTarget: headline
        ? { ...headline, sentence: remainingSentence(headline) }
        : null,
      targets: progress.map((entry: TargetProgress) => ({
        ...entry,
        sentence: remainingSentence(entry),
      })),
      ranking: standing,
      achievements: {
        /** Earned on this load — the app celebrates exactly these. */
        new: newlyEarned,
        recent: recentAchievements,
      },
      opportunities: {
        summary: opportunities.summary,
        actions: opportunities.triggers,
        generatedAt: opportunities.generatedAt,
        windowDays: opportunities.windowDays,
        retailersConsidered: opportunities.retailersConsidered,
      },
    };
  }

  /**
   * The same metrics over the three completed periods before this one, so a
   * personal best is measured against a real history rather than asserted.
   */
  private async previousPeriodValues(input: { salespersonId: string; period: Period }) {
    const windows: Period[] = [];
    let cursor = input.period.from;
    for (let index = 0; index < 3; index += 1) {
      const end = new Date(cursor.getTime() - 1);
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      windows.push({ from: start, to: end });
      cursor = start;
    }

    const measured = await Promise.all(
      windows.map((window) =>
        this.targets.actualsFor({ salespersonId: input.salespersonId, period: window })
      )
    );

    const byMetric: Record<string, number[]> = {};
    for (const actuals of measured) {
      for (const [metric, value] of Object.entries(actuals)) {
        byMetric[metric] = [...(byMetric[metric] ?? []), value];
      }
    }
    return byMetric as any;
  }
}

export const defaultSalespersonTodayService = new SalespersonTodayService();
