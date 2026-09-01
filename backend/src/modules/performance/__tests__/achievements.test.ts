import { describe, expect, it, vi } from "vitest";
import { buildProgress } from "../targetDomain";
import {
  MIN_RANK_PARTICIPANTS,
  dedupeKeyFor,
  newRetailerMilestones,
  personalBest,
  rankAchievements,
  targetAchievements,
} from "../achievementDomain";
import { AchievementService, celebrationFor } from "../achievementService";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const MARCH = { periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") };

const progressAt = (pct: number, target = 100000) =>
  buildProgress({ metric: "order_value", target, actual: (target * pct) / 100, ...MARCH });

describe("target milestones", () => {
  it("announces only the highest level reached", () => {
    const earned = targetAchievements(progressAt(100));
    expect(earned).toHaveLength(1);
    expect(earned[0].type).toBe("TARGET_100");
  });

  it("walks the ladder as completion rises", () => {
    expect(targetAchievements(progressAt(49))).toEqual([]);
    expect(targetAchievements(progressAt(50))[0].type).toBe("TARGET_50");
    expect(targetAchievements(progressAt(76))[0].type).toBe("TARGET_75");
    expect(targetAchievements(progressAt(95))[0].type).toBe("TARGET_90");
    expect(targetAchievements(progressAt(115))[0].type).toBe("TARGET_EXCEEDED");
  });

  it("says what is left in the milestone message", () => {
    expect(targetAchievements(progressAt(75)).at(0)?.message).toBe("₹75,000 of ₹1,00,000. ₹25,000 left.");
  });

  it("celebrates completing a target more loudly than passing 75%", () => {
    expect(targetAchievements(progressAt(75))[0].celebration).toBe("minor");
    expect(targetAchievements(progressAt(100))[0].celebration).toBe("major");
  });

  it("earns nothing against a target nobody set", () => {
    expect(targetAchievements(progressAt(0, 0))).toEqual([]);
  });

  it("keys each level separately so the ladder is not collapsed by storage", () => {
    const seventyFive = targetAchievements(progressAt(75))[0].dedupeKey;
    const hundred = targetAchievements(progressAt(100))[0].dedupeKey;
    expect(seventyFive).not.toBe(hundred);
  });
});

describe("personal best", () => {
  const base = {
    metric: "order_value",
    unit: "currency" as const,
    label: "Sales",
    ...MARCH,
  };

  it("needs a history to beat", () => {
    expect(personalBest({ ...base, actual: 90000, previousPeriodValues: [] })).toBeNull();
  });

  it("fires when the current period beats every earlier one", () => {
    const best = personalBest({ ...base, actual: 90000, previousPeriodValues: [70000, 88000] });
    expect(best).toMatchObject({ type: "PERSONAL_BEST", threshold: 88000, celebration: "major" });
    expect(best?.message).toContain("₹90,000");
  });

  it("does not fire on equalling the previous best", () => {
    expect(personalBest({ ...base, actual: 88000, previousPeriodValues: [88000] })).toBeNull();
  });

  it("does not fire on a period with nothing in it", () => {
    expect(personalBest({ ...base, actual: 0, previousPeriodValues: [50000] })).toBeNull();
  });

  it("does not fire when every earlier period was empty", () => {
    expect(personalBest({ ...base, actual: 100, previousPeriodValues: [0, 0] })).toBeNull();
  });
});

describe("new store milestones", () => {
  it("marks the first store of a period", () => {
    expect(newRetailerMilestones({ added: 1, ...MARCH })[0]).toMatchObject({
      type: "NEW_RETAILER_MILESTONE",
      threshold: 1,
    });
  });

  it("reports the highest milestone reached", () => {
    expect(newRetailerMilestones({ added: 12, ...MARCH })[0].threshold).toBe(10);
  });

  it("keys milestones apart so five and ten can both be earned in one period", () => {
    expect(newRetailerMilestones({ added: 5, ...MARCH })[0].dedupeKey).not.toBe(
      newRetailerMilestones({ added: 10, ...MARCH })[0].dedupeKey
    );
  });

  it("earns nothing before the first store", () => {
    expect(newRetailerMilestones({ added: 0, ...MARCH })).toEqual([]);
  });
});

describe("rank recognition", () => {
  const scope = { participants: 32, scopeLabel: "Pune North", ...MARCH };

  it("stays quiet when the group is too small for a rank to mean anything", () => {
    expect(
      rankAchievements({ ...scope, participants: MIN_RANK_PARTICIPANTS - 1, rank: 1, previousRank: 2 })
    ).toEqual([]);
  });

  it("announces a move up with both positions", () => {
    const [event] = rankAchievements({ ...scope, rank: 4, previousRank: 7 });
    expect(event).toMatchObject({ type: "RANK_UP", threshold: 7, actual: 4 });
    expect(event.message).toBe("#7 to #4 of 32 in Pune North.");
  });

  it("says nothing about a move down", () => {
    const events = rankAchievements({ ...scope, rank: 9, previousRank: 4 });
    expect(events.some((event) => event.type === "RANK_UP")).toBe(false);
  });

  it("recognises the top ten and the podium differently", () => {
    expect(rankAchievements({ ...scope, rank: 8, previousRank: null }).map((e) => e.type)).toEqual([
      "TOP_10",
    ]);
    const podium = rankAchievements({ ...scope, rank: 2, previousRank: null });
    expect(podium.map((e) => e.type)).toEqual(["TOP_3"]);
    expect(podium[0].celebration).toBe("major");
  });

  it("says nothing outside the top ten", () => {
    expect(rankAchievements({ ...scope, rank: 18, previousRank: null })).toEqual([]);
  });

  it("has no rank to announce when the salesperson is unranked", () => {
    expect(rankAchievements({ ...scope, rank: null, previousRank: null })).toEqual([]);
  });
});

describe("dedupe keys", () => {
  it("separate two metrics reaching the same level in one period", () => {
    expect(dedupeKeyFor({ type: "TARGET_100", metric: "order_value", ...MARCH, threshold: 100 })).not.toBe(
      dedupeKeyFor({ type: "TARGET_100", metric: "visits", ...MARCH, threshold: 100 })
    );
  });

  it("separate the same milestone in two periods", () => {
    expect(dedupeKeyFor({ type: "TARGET_100", metric: "order_value", ...MARCH, threshold: 100 })).not.toBe(
      dedupeKeyFor({
        type: "TARGET_100",
        metric: "order_value",
        periodStart: day("2026-04-01"),
        periodEnd: day("2026-04-30"),
        threshold: 100,
      })
    );
  });

  it("are stable for the same event", () => {
    const args = { type: "TOP_3" as const, ...MARCH, threshold: 3 };
    expect(dedupeKeyFor(args)).toBe(dedupeKeyFor(args));
  });
});

describe("recording achievements", () => {
  function fakePrisma(existingKeys: string[] = []) {
    return {
      achievementEvent: {
        findMany: vi.fn().mockResolvedValue(existingKeys.map((dedupeKey) => ({ dedupeKey }))),
        create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "event-1", ...data })),
      },
    } as any;
  }

  const input = {
    subject: { kind: "salesperson" as const, id: "staff-1" },
    progress: [progressAt(100)],
    ...MARCH,
  };

  it("records a newly earned milestone", async () => {
    const prisma = fakePrisma();
    const recorded = await new AchievementService(prisma).record(input);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ type: "TARGET_100", celebration: "major", reward: null });
  });

  it("stays silent the second time the same period is evaluated", async () => {
    const key = targetAchievements(progressAt(100))[0].dedupeKey;
    const prisma = fakePrisma([key]);
    expect(await new AchievementService(prisma).record(input)).toEqual([]);
    expect(prisma.achievementEvent.create).not.toHaveBeenCalled();
  });

  it("treats losing the race to another request as already earned", async () => {
    const prisma = fakePrisma();
    prisma.achievementEvent.create.mockRejectedValueOnce({ code: "P2002" });
    expect(await new AchievementService(prisma).record(input)).toEqual([]);
  });

  it("still reports a real database failure", async () => {
    const prisma = fakePrisma();
    prisma.achievementEvent.create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(new AchievementService(prisma).record(input)).rejects.toThrow("connection lost");
  });

  it("expires an event with the period it belongs to", async () => {
    const prisma = fakePrisma();
    await new AchievementService(prisma).record(input);
    expect(prisma.achievementEvent.create.mock.calls[0][0].data.expiresAt).toEqual(MARCH.periodEnd);
  });

  it("does nothing when nothing was earned", async () => {
    const prisma = fakePrisma();
    await new AchievementService(prisma).record({ ...input, progress: [progressAt(10)] });
    expect(prisma.achievementEvent.findMany).not.toHaveBeenCalled();
  });

  it("hides events whose period has passed", async () => {
    const prisma = {
      achievementEvent: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    await new AchievementService(prisma).recent({
      subject: { kind: "salesperson", id: "staff-1" },
      now: day("2026-04-05"),
    });
    expect(prisma.achievementEvent.findMany.mock.calls[0][0].where.OR).toEqual([
      { expiresAt: null },
      { expiresAt: { gte: day("2026-04-05") } },
    ]);
  });

  it("carries no reward of any kind", async () => {
    const prisma = fakePrisma();
    const [event] = await new AchievementService(prisma).record(input);
    expect(event.reward).toBeNull();
    expect(JSON.stringify(event)).not.toMatch(/bonus|payout|prize|cash|voucher/i);
  });
});

describe("celebration strength read back from storage", () => {
  it("matches what the domain decided", () => {
    expect(celebrationFor("TARGET_100")).toBe("major");
    expect(celebrationFor("PERSONAL_BEST")).toBe("major");
    expect(celebrationFor("TOP_3")).toBe("major");
    expect(celebrationFor("TARGET_75")).toBe("minor");
    expect(celebrationFor("RANK_UP")).toBe("minor");
  });
});
