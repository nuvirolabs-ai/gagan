import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SurveyAudience, SurveyQuestionType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { SurveyService, type SurveyDefinitionInput } from "../surveyService";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  staff: randomUUID(),
  survey: randomUUID(),
  concurrentSurvey: randomUUID(),
};
const surveyIds: string[] = [];

const service = new SurveyService(prisma);

const definition: SurveyDefinitionInput = {
  title: `Market survey ${ids.survey}`,
  description: "Local UAT survey",
  audience: SurveyAudience.all_retailers,
  questions: [
    {
      prompt: "How was product availability?",
      type: SurveyQuestionType.single_choice,
      required: true,
      options: [
        { label: "Good", value: "good" },
        { label: "Needs attention", value: "needs_attention" },
      ],
    },
    {
      prompt: "Additional context",
      type: SurveyQuestionType.text,
      required: false,
      maxLength: 200,
    },
  ],
};

async function activateNewSurvey(title: string) {
  const draft = await service.createDraft(
    { ...definition, title },
    ids.staff,
  );
  surveyIds.push(draft.id);
  await service.activate(draft.id, ids.staff);
  return prisma.survey.findUniqueOrThrow({
    where: { id: draft.id },
    include: { questions: { include: { options: true }, orderBy: { position: "asc" } }, assignments: true, _count: { select: { responses: true } } },
  });
}

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `survey-${ids.tier}` } });
  await prisma.staffUser.create({
    data: {
      id: ids.staff,
      name: "Market Survey UAT Admin",
      phone: `7${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
      email: `${ids.staff}@survey-uat.invalid`,
      employeeRef: `SURVEY-${ids.staff}`,
    },
  });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Market Survey UAT Store",
      shopAddress: "Local UAT",
      phone: `8${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
      status: "active",
      tierId: ids.tier,
    },
  });
});

afterAll(async () => {
  const responses = await prisma.surveyResponse.findMany({ where: { surveyId: { in: surveyIds } }, select: { id: true } });
  const responseIds = responses.map((response) => response.id);
  await prisma.auditEvent.deleteMany({ where: { OR: [
    { subjectType: "survey", subjectId: { in: surveyIds } },
    { subjectType: "survey_response", subjectId: { in: responseIds } },
  ] } });
  await prisma.surveyAnswerOption.deleteMany({ where: { answer: { responseId: { in: responseIds } } } });
  await prisma.surveyAnswer.deleteMany({ where: { responseId: { in: responseIds } } });
  await prisma.surveyResponse.deleteMany({ where: { id: { in: responseIds } } });
  await prisma.survey.deleteMany({ where: { id: { in: surveyIds } } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.staffUser.delete({ where: { id: ids.staff } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("market survey persistence and replay", () => {
  it("activates a draft, accepts one identified response, and replays it safely", async () => {
    const survey = await activateNewSurvey(definition.title);
    const choice = survey.questions[0].options[0];
    const answers = [
      { questionId: survey.questions[0].id, optionIds: [choice.id] },
      { questionId: survey.questions[1].id, value: "Good stock" },
    ];

    const first = await service.submit(survey.id, { kind: "retailer", id: ids.retailer }, "survey-replay-1", answers);
    const replay = await service.submit(survey.id, { kind: "retailer", id: ids.retailer }, "survey-replay-1", answers);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.response.id).toBe(first.response.id);
    expect(await prisma.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(1);
    expect(first.response.answers[0].optionIds).toEqual([choice.id]);
    const respondentView = await service.getForActor(survey.id, { kind: "retailer", id: ids.retailer });
    expect(respondentView.survey).not.toHaveProperty("assignments");
    expect(respondentView.survey).not.toHaveProperty("responseCount");
    await expect(
      service.submit(survey.id, { kind: "retailer", id: ids.retailer }, "survey-replay-1", [
        { questionId: survey.questions[0].id, optionIds: [survey.questions[0].options[1].id] },
      ]),
    ).rejects.toMatchObject({ code: "idempotency_conflict", status: 409 });
    await expect(
      service.submit(survey.id, { kind: "retailer", id: ids.retailer }, "survey-replay-2", answers),
    ).rejects.toMatchObject({ code: "survey_already_submitted", status: 409 });
  });

  it("allows concurrent identical first submissions to produce one response", async () => {
    const survey = await activateNewSurvey(`Concurrent ${ids.concurrentSurvey}`);
    const answers = [{ questionId: survey.questions[0].id, optionIds: [survey.questions[0].options[0].id] }];
    const results = await Promise.all([
      service.submit(survey.id, { kind: "retailer", id: ids.retailer }, "survey-concurrent-1", answers),
      service.submit(survey.id, { kind: "retailer", id: ids.retailer }, "survey-concurrent-1", answers),
    ]);

    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect(results[0].response.id).toBe(results[1].response.id);
    expect(await prisma.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(1);
  });
});
