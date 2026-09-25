import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { METRIC_DEFINITIONS, type TargetMetric, type TargetProgress } from "./targetDomain";
import {
  newRetailerMilestones,
  personalBest,
  rankAchievements,
  targetAchievements,
  type CandidateAchievement,
} from "./achievementDomain";

type Db = PrismaClient | any;

export interface AchievementSubject {
  kind: "salesperson" | "retailer";
  id: string;
}

export interface EvaluationInput {
  subject: AchievementSubject;
  progress: readonly TargetProgress[];
  /** Prior completed-period values per metric, for personal bests. */
  previousPeriodValues?: Partial<Record<TargetMetric, number[]>>;
  newRetailersAdded?: number;
  ranking?: {
    rank: number | null;
    previousRank: number | null;
    participants: number;
    scopeLabel: string;
  };
  periodStart: Date;
  periodEnd: Date;
}

/**
 * The one place achievements are decided and recorded.
 *
 * Both apps read from here; neither decides on its own what deserves a
 * celebration, so a milestone means the same thing everywhere and can only be
 * earned once. Recording is idempotent through the unique dedupe key, so the
 * engine can be run on every Today load without ever firing twice.
 */
export class AchievementService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  /** Decides what has been earned without touching the database. */
  static candidates(input: EvaluationInput): CandidateAchievement[] {
    const candidates: CandidateAchievement[] = [];

    for (const progress of input.progress) {
      candidates.push(...targetAchievements(progress));

      const history = input.previousPeriodValues?.[progress.metric];
      if (history && history.length > 0) {
        const definition = METRIC_DEFINITIONS[progress.metric];
        const best = personalBest({
          metric: progress.metric,
          unit: definition.unit,
          label: definition.label,
          actual: progress.actual,
          previousPeriodValues: history,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        });
        if (best) candidates.push(best);
      }
    }

    if (input.newRetailersAdded != null) {
      candidates.push(
        ...newRetailerMilestones({
          added: input.newRetailersAdded,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        })
      );
    }

    if (input.ranking) {
      candidates.push(
        ...rankAchievements({
          ...input.ranking,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        })
      );
    }

    return candidates;
  }

  /**
   * Records anything newly earned and returns only what was new, so a caller
   * can celebrate exactly once. Losing a race to another request is not an
   * error — the other request already recorded it.
   */
  async record(input: EvaluationInput): Promise<any[]> {
    const candidates = AchievementService.candidates(input);
    if (candidates.length === 0) return [];

    const existing = await this.prisma.achievementEvent.findMany({
      where: {
        subjectKind: input.subject.kind,
        subjectId: input.subject.id,
        dedupeKey: { in: candidates.map((candidate) => candidate.dedupeKey) },
      },
      select: { dedupeKey: true },
    });
    const already = new Set(existing.map((row: any) => row.dedupeKey));
    const fresh = candidates.filter((candidate) => !already.has(candidate.dedupeKey));

    const recorded: any[] = [];
    for (const candidate of fresh) {
      try {
        recorded.push(
          await this.prisma.achievementEvent.create({
            data: {
              subjectKind: input.subject.kind,
              subjectId: input.subject.id,
              type: candidate.type,
              metric: candidate.metric,
              periodStart: input.periodStart,
              periodEnd: input.periodEnd,
              threshold: candidate.threshold,
              actual: candidate.actual,
              title: candidate.title,
              message: candidate.message,
              expiresAt: input.periodEnd,
              evidence: candidate.evidence as any,
              dedupeKey: candidate.dedupeKey,
            },
          })
        );
      } catch (error: any) {
        // Another request recorded the same milestone first. Nothing to do.
        if (error?.code !== "P2002") throw error;
      }
    }
    return recorded.map((event) => this.publicEvent(event, candidates));
  }

  /** Events worth showing now, newest first. */
  async recent(input: {
    subject: AchievementSubject;
    limit?: number;
    now?: Date;
  }): Promise<any[]> {
    const now = input.now ?? new Date();
    const events = await this.prisma.achievementEvent.findMany({
      where: {
        subjectKind: input.subject.kind,
        subjectId: input.subject.id,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: { earnedAt: "desc" },
      take: Math.min(input.limit ?? 20, 50),
    });
    return events.map((event: any) => this.publicEvent(event));
  }

  /**
   * Celebration strength is decided here rather than in either app, so the
   * Retailer app cannot decide to throw confetti at something the Salesperson
   * app treats as a quiet banner.
   */
  private publicEvent(event: any, candidates: readonly CandidateAchievement[] = []) {
    const candidate = candidates.find((entry) => entry.dedupeKey === event.dedupeKey);
    return {
      id: event.id,
      type: event.type,
      metric: event.metric,
      title: event.title,
      message: event.message,
      threshold: event.threshold == null ? null : Number(event.threshold),
      actual: event.actual == null ? null : Number(event.actual),
      earnedAt: event.earnedAt,
      expiresAt: event.expiresAt,
      celebration: candidate?.celebration ?? celebrationFor(event.type),
      evidence: event.evidence ?? null,
      // Stated plainly so no surface can imply this carries a prize.
      reward: null as null,
    };
  }
}

/** Kept in step with the domain's own levels for events read back from storage. */
export function celebrationFor(type: string): "major" | "minor" {
  return ["TARGET_100", "TARGET_EXCEEDED", "PERSONAL_BEST", "TOP_3"].includes(type)
    ? "major"
    : "minor";
}

export const defaultAchievementService = new AchievementService();
