import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { TargetService, currentMonth, type MetricActuals, type Period } from "../performance/targetService";
import { RankingService } from "../performance/rankingService";
import { OpportunityService } from "../intelligence/opportunityService";
import { AttendanceService } from "../field/attendanceService";
import { RouteService } from "../field/routeService";
import {
  assessRisk,
  project,
  sellingDaysIn,
  type Projection,
  type RiskAssessment,
} from "../performance/projectionDomain";
import { buildProgress, startOfDay, type TargetMetric } from "../performance/targetDomain";

type Db = PrismaClient | any;

export interface LeaderMember {
  salespersonId: string;
  name: string;
  territory: string | null;
  attendance: string;
  actuals: MetricActuals;
  targets: Array<{ metric: TargetMetric; target: number; actual: number; completionPct: number }>;
  headlineTarget: { metric: TargetMetric; target: number; actual: number; completionPct: number } | null;
  projection: Projection;
  risk: RiskAssessment;
  rank: number | null;
  route: { completionPct: number; visited: number; total: number } | null;
}

/**
 * The team view a sales leader works from.
 *
 * It answers who is ahead, who is behind, why, and what to do about it. Every
 * number comes from the same canonical rows the salesperson's own screen reads,
 * so a manager and their team never see different truths. Projections are run
 * rate only, and are labelled as such.
 */
export class SalesLeaderService {
  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly targets = new TargetService(prisma ?? defaultPrisma),
    private readonly ranking = new RankingService(prisma ?? defaultPrisma),
    private readonly opportunities = new OpportunityService(prisma ?? defaultPrisma),
    private readonly attendance = new AttendanceService(prisma ?? defaultPrisma),
    private readonly routes = new RouteService(prisma ?? defaultPrisma)
  ) {}

  async load(input: { territory?: string | null; period?: Period; now?: Date }) {
    const now = input.now ?? new Date();
    const period = input.period ?? currentMonth(now);

    const staff = await this.prisma.staffUser.findMany({
      where: {
        status: "active",
        salesRepId: { not: null },
        ...(input.territory ? { salesRep: { territory: input.territory } } : {}),
      },
      select: { id: true, name: true, salesRepId: true, salesRep: { select: { territory: true } } },
      orderBy: { name: "asc" },
    });

    if (staff.length === 0) {
      return this.emptyTeam(period, input.territory ?? null);
    }

    const people: Array<{
      staffId: string;
      name: string;
      salesRepId: string | null;
      territory: string | null;
    }> = staff.map((member: any) => ({
      staffId: member.id,
      name: member.name,
      salesRepId: member.salesRepId as string | null,
      territory: member.salesRep?.territory ?? null,
    }));

    // Four batched reads for the whole team, plus the working calendar. None of
    // this loops per salesperson.
    const [actualsByStaff, targets, teamAttendance, calendar, standings] = await Promise.all([
      this.targets.bulkActuals({ salespeople: people, period }),
      this.prisma.salesTarget.findMany({
        where: {
          salespersonId: { in: people.map((person) => person.staffId) },
          periodStart: { lte: startOfDay(period.to) },
          periodEnd: { gte: startOfDay(period.from) },
        },
      }),
      this.attendance.teamAttendance(now),
      this.prisma.workingCalendar.findMany({
        where: { date: { gte: startOfDay(period.from), lte: startOfDay(period.to) }, isWorkingDay: false },
        select: { date: true },
      }),
      this.ranking.rank({
        scope: input.territory ? "territory" : "company",
        territory: input.territory ?? null,
        period,
        now,
      }),
    ]);

    const nonWorkingDays = new Set(
      (calendar as any[]).map((row) => startOfDay(row.date).toISOString().slice(0, 10))
    );
    const sellingDays = sellingDaysIn({
      periodStart: period.from,
      periodEnd: period.to,
      now,
      nonWorkingDays,
    });

    const targetsByStaff = new Map<string, any[]>();
    for (const target of targets as any[]) {
      targetsByStaff.set(target.salespersonId, [
        ...(targetsByStaff.get(target.salespersonId) ?? []),
        target,
      ]);
    }
    const attendanceByStaff = new Map(
      (teamAttendance as any[]).map((row) => [row.salespersonId, row.mark])
    );
    const rankByStaff = new Map(
      standings.entries.map((entry) => [entry.salespersonId, entry.rank])
    );

    // Route progress is per salesperson and small; it is the one per-person
    // read, kept because a beat is a per-person plan by definition.
    const routes = await Promise.all(
      people.map((person) => this.routes.routeForDate(person.staffId, now))
    );

    const members: LeaderMember[] = people.map((person, index) => {
      const actuals = actualsByStaff.get(person.staffId) ?? ({} as MetricActuals);
      const stored = targetsByStaff.get(person.staffId) ?? [];
      const progress = stored
        .filter((target: any) => Number(target.targetValue) > 0)
        .map((target: any) => {
          const built = buildProgress({
            metric: target.metric as TargetMetric,
            target: Number(target.targetValue),
            actual: actuals[target.metric as TargetMetric] ?? 0,
            periodStart: target.periodStart,
            periodEnd: target.periodEnd,
          });
          return {
            metric: built.metric,
            target: built.target,
            actual: built.actual,
            completionPct: built.completionPct,
          };
        });

      const headline =
        progress.find((entry) => entry.metric === "order_value") ?? progress[0] ?? null;
      const projection = project({
        actual: headline ? headline.actual : actuals.order_value ?? 0,
        sellingDays,
      });
      const route = routes[index];

      const reasons: string[] = [];
      if (route && route.progress.total > 0 && route.progress.completionPct < 60) {
        reasons.push(
          `Today's beat is ${route.progress.completionPct}% complete (${route.progress.visited} of ${route.progress.total} stops).`
        );
      }
      const mark = attendanceByStaff.get(person.staffId) ?? "absent";
      if (mark === "absent") reasons.push("Not marked present today.");

      return {
        salespersonId: person.staffId,
        name: person.name,
        territory: person.territory,
        attendance: mark,
        actuals,
        targets: progress,
        headlineTarget: headline,
        projection,
        risk: assessRisk({
          target: headline?.target ?? 0,
          projected: projection.projected,
          reasons,
        }),
        rank: rankByStaff.get(person.staffId) ?? null,
        route: route
          ? {
              completionPct: route.progress.completionPct,
              visited: route.progress.visited,
              total: route.progress.total,
            }
          : null,
      };
    });

    const teamTargets = members.flatMap((member) => member.targets);
    const teamTarget = teamTargets
      .filter((target) => target.metric === "order_value")
      .reduce((sum, target) => sum + target.target, 0);
    const teamActual = members.reduce((sum, member) => sum + (member.actuals.order_value ?? 0), 0);
    const teamProjection = project({ actual: teamActual, sellingDays });

    return {
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      territory: input.territory ?? null,
      sellingDays,
      team: {
        salespeople: members.length,
        target: teamTarget,
        actual: teamActual,
        completionPct: teamTarget > 0 ? Math.round((teamActual / teamTarget) * 100) : 0,
        projection: teamProjection,
        risk: assessRisk({ target: teamTarget, projected: teamProjection.projected }),
        present: members.filter((member) => member.attendance === "present").length,
        visits: members.reduce((sum, member) => sum + (member.actuals.visits ?? 0), 0),
        productiveOutlets: members.reduce(
          (sum, member) => sum + (member.actuals.productive_outlets ?? 0),
          0
        ),
        orders: members.reduce((sum, member) => sum + (member.actuals.order_count ?? 0), 0),
        collections: members.reduce(
          (sum, member) => sum + (member.actuals.collection_value ?? 0),
          0
        ),
        newRetailers: members.reduce((sum, member) => sum + (member.actuals.new_customers ?? 0), 0),
      },
      members,
      leaderboard: {
        metric: standings.metric,
        metricLabel: standings.metricLabel,
        metricReason: standings.metricReason,
        entries: standings.entries,
      },
      /** Ranked by need, each carrying the measurement that produced it. */
      recommendedActions: await this.recommendedActions({ members, now }),
    };
  }

  /**
   * Turns the team's state into things a manager could do, reusing the same
   * next-best-action engine the salespeople see so a manager is never chasing
   * a different set of facts.
   */
  private async recommendedActions(input: { members: LeaderMember[]; now: Date }) {
    const atRisk = input.members
      .filter((member) => member.risk.level !== "on_track")
      .sort(
        (a, b) => (a.risk.projectedAchievementPct ?? 100) - (b.risk.projectedAchievementPct ?? 100)
      )
      .slice(0, 3);

    const actions: Array<{
      type: string;
      salespersonId: string;
      salespersonName: string;
      action: string;
      why: string;
      priority: number;
    }> = [];

    for (const member of atRisk) {
      actions.push({
        type: "COACH_AT_RISK",
        salespersonId: member.salespersonId,
        salespersonName: member.name,
        action: `Call ${member.name}`,
        why:
          member.risk.reasons[0] ??
          `${member.name} is behind the pace this period.`,
        priority: 90 - (member.risk.projectedAchievementPct ?? 0) / 10,
      });
    }

    // The heaviest field findings for the two most at-risk salespeople, so a
    // manager's suggestion names the stores rather than the person only.
    for (const member of atRisk.slice(0, 2)) {
      const found = await this.opportunities.forSalesperson({
        salespersonId: member.salespersonId,
        now: input.now,
        limit: 2,
      });
      for (const trigger of found.triggers) {
        actions.push({
          type: `REVIEW_${trigger.type}`,
          salespersonId: member.salespersonId,
          salespersonName: member.name,
          action: `Review ${member.name}: ${trigger.retailerName}`,
          why: trigger.why,
          priority: Math.min(88, trigger.priority),
        });
      }
    }

    return actions.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }

  private emptyTeam(period: Period, territory: string | null) {
    const sellingDays = { total: 0, elapsed: 0, remaining: 0 };
    return {
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      territory,
      sellingDays,
      team: {
        salespeople: 0,
        target: 0,
        actual: 0,
        completionPct: 0,
        projection: project({ actual: 0, sellingDays }),
        risk: assessRisk({ target: 0, projected: null }),
        present: 0,
        visits: 0,
        productiveOutlets: 0,
        orders: 0,
        collections: 0,
        newRetailers: 0,
      },
      members: [] as LeaderMember[],
      leaderboard: {
        metric: "order_value" as const,
        metricLabel: "Order value",
        metricReason: "Nobody in this scope to rank.",
        entries: [] as any[],
      },
      recommendedActions: [] as any[],
    };
  }
}

export const defaultSalesLeaderService = new SalesLeaderService();
