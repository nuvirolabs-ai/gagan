import { createHash } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  SurveyAudience,
  SurveyQuestionType,
  SurveyRespondentType,
  SurveyStatus,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { Permissions } from "../identity/roleCatalog";

type Db = PrismaClient;

const SURVEY_INCLUDE = {
  questions: {
    include: { options: { orderBy: { position: "asc" as const } } },
    orderBy: { position: "asc" as const },
  },
  assignments: true,
  _count: { select: { responses: true } },
} as const;

type SurveyWithDetails = Prisma.SurveyGetPayload<{ include: typeof SURVEY_INCLUDE }>;

export type SurveyQuestionInput = {
  prompt: string;
  type: SurveyQuestionType;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  maxLength?: number;
  options?: Array<{ label: string; value?: string }>;
};

export type SurveyDefinitionInput = {
  title: string;
  description?: string;
  audience: SurveyAudience;
  startsAt?: Date;
  endsAt?: Date;
  retailerIds?: string[];
  salespersonIds?: string[];
  questions: SurveyQuestionInput[];
};

export type SurveyAnswerInput = {
  questionId: string;
  optionIds?: string[];
  value?: string | number | boolean | null;
};

export type SurveyActor =
  | { kind: "retailer"; id: string }
  | { kind: "staff"; id: string; contextRetailerId?: string };

export class SurveyError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    public readonly details?: unknown
  ) {
    super(code);
  }
}

function cleanText(value: string | undefined, field: string, max: number) {
  const result = value?.trim() ?? "";
  if (!result) throw new SurveyError(`${field}_required`);
  if (result.length > max) throw new SurveyError(`${field}_too_long`);
  return result;
}

function uniqueStrings(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function dateWindow(now: Date) {
  return {
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  } as Prisma.SurveyWhereInput;
}

function fingerprint(input: {
  surveyId: string;
  respondentKey: string;
  answers: Array<{ questionId: string; optionIds: string[]; value: string | number | boolean | null }>;
}) {
  const canonical = JSON.stringify({
    surveyId: input.surveyId,
    respondentKey: input.respondentKey,
    answers: [...input.answers]
      .sort((a, b) => a.questionId.localeCompare(b.questionId))
      .map((answer) => ({
        questionId: answer.questionId,
        optionIds: [...answer.optionIds].sort(),
        value: answer.value,
      })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function surveyView(survey: SurveyWithDetails) {
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    audience: survey.audience,
    startsAt: survey.startsAt?.toISOString() ?? null,
    endsAt: survey.endsAt?.toISOString() ?? null,
    activatedAt: survey.activatedAt?.toISOString() ?? null,
    closedAt: survey.closedAt?.toISOString() ?? null,
    createdAt: survey.createdAt.toISOString(),
    updatedAt: survey.updatedAt.toISOString(),
    responseCount: survey._count.responses,
    questions: survey.questions.map((question) => ({
      id: question.id,
      position: question.position,
      prompt: question.prompt,
      type: question.type,
      required: question.required,
      minValue: question.minValue == null ? null : Number(question.minValue),
      maxValue: question.maxValue == null ? null : Number(question.maxValue),
      maxLength: question.maxLength,
      options: question.options.map((option) => ({
        id: option.id,
        position: option.position,
        label: option.label,
        value: option.value,
      })),
    })),
    assignments: survey.assignments.map((assignment) => ({
      id: assignment.id,
      audience: assignment.audience,
      retailerId: assignment.retailerId,
      salespersonId: assignment.salespersonId,
    })),
  };
}

/** Respondents only need the survey instrument, never the audience roster or
 * aggregate response count that belongs to Admin review. */
function respondentSurveyView(survey: SurveyWithDetails) {
  const view = surveyView(survey);
  const { assignments: _assignments, responseCount: _responseCount, ...respondentView } = view;
  return respondentView;
}

function validateQuestion(question: SurveyQuestionInput, index: number) {
  const prompt = cleanText(question.prompt, `question_${index + 1}_prompt`, 500);
  const types = Object.values(SurveyQuestionType) as string[];
  if (!types.includes(question.type)) throw new SurveyError("question_type_invalid");

  const options = (question.options ?? []).map((option) => ({
    label: cleanText(option.label, "option_label", 200),
    value: option.value?.trim() || undefined,
  }));
  if (options.some((option, optionIndex) => options.findIndex((candidate) => candidate.label.toLowerCase() === option.label.toLowerCase()) !== optionIndex)) {
    throw new SurveyError("duplicate_question_option");
  }
  const choiceType = question.type === SurveyQuestionType.single_choice || question.type === SurveyQuestionType.multiple_choice;
  if (choiceType && options.length < 2) throw new SurveyError("choice_options_required");
  if (!choiceType && options.length > 0) throw new SurveyError("options_not_allowed_for_question_type");

  const minValue = question.minValue;
  const maxValue = question.maxValue;
  if (minValue != null && !Number.isFinite(minValue)) throw new SurveyError("question_min_invalid");
  if (maxValue != null && !Number.isFinite(maxValue)) throw new SurveyError("question_max_invalid");
  if (minValue != null && maxValue != null && minValue > maxValue) throw new SurveyError("question_range_invalid");
  if (question.type === SurveyQuestionType.rating) {
    if ((minValue ?? 1) < 0 || (maxValue ?? 5) > 10) throw new SurveyError("rating_range_invalid");
  }
  const maxLength = question.maxLength;
  if (maxLength != null && (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 2000)) {
    throw new SurveyError("question_max_length_invalid");
  }

  return { prompt, type: question.type, required: Boolean(question.required), minValue, maxValue, maxLength, options };
}

function validateDefinition(input: SurveyDefinitionInput) {
  const title = cleanText(input.title, "title", 160);
  const description = input.description?.trim() || undefined;
  if (description && description.length > 1000) throw new SurveyError("description_too_long");
  if (!Object.values(SurveyAudience).includes(input.audience)) throw new SurveyError("audience_invalid");
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) throw new SurveyError("survey_window_invalid");
  if (!input.questions.length || input.questions.length > 50) throw new SurveyError("questions_required");

  const retailerIds = uniqueStrings(input.retailerIds);
  const salespersonIds = uniqueStrings(input.salespersonIds);
  const selectedCount = input.audience === SurveyAudience.selected_retailers ? retailerIds.length : input.audience === SurveyAudience.selected_salespersons ? salespersonIds.length : 0;
  if ((input.audience === SurveyAudience.selected_retailers || input.audience === SurveyAudience.selected_salespersons) && selectedCount === 0) {
    throw new SurveyError("selected_audience_required");
  }
  if (input.audience === SurveyAudience.all_retailers || input.audience === SurveyAudience.all_salespersons) {
    if (retailerIds.length || salespersonIds.length) throw new SurveyError("assignments_not_allowed_for_all_audience");
  }

  return {
    title,
    description,
    audience: input.audience,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    retailerIds,
    salespersonIds,
    questions: input.questions.map(validateQuestion),
  };
}

function assignmentCreateData(definition: ReturnType<typeof validateDefinition>) {
  return [
    ...definition.retailerIds.map((retailerId) => ({ audience: SurveyAudience.selected_retailers, retailerId })),
    ...definition.salespersonIds.map((salespersonId) => ({ audience: SurveyAudience.selected_salespersons, salespersonId })),
  ];
}

function currentRespondent(actor: SurveyActor) {
  if (actor.kind === "retailer") {
    return {
      respondentType: SurveyRespondentType.retailer,
      respondentKey: `retailer:${actor.id}`,
      respondentRetailerId: actor.id,
      contextRetailerId: undefined,
    } as const;
  }
  if (actor.contextRetailerId) {
    return {
      respondentType: SurveyRespondentType.salesperson_retailer,
      respondentKey: `salesperson:${actor.id}:retailer:${actor.contextRetailerId}`,
      respondentStaffId: actor.id,
      contextRetailerId: actor.contextRetailerId,
    } as const;
  }
  return {
    respondentType: SurveyRespondentType.salesperson,
    respondentKey: `salesperson:${actor.id}`,
    respondentStaffId: actor.id,
    contextRetailerId: undefined,
  } as const;
}

type SurveyAssignmentTarget = {
  audience: SurveyAudience;
  retailerId: string | null;
  salespersonId: string | null;
};

/**
 * A survey keeps its original primary audience for backwards compatibility,
 * while selected assignments may include both respondent roles. Each
 * assignment's audience is authoritative for access checks.
 */
export function isSurveyActorAllowed(
  audience: SurveyAudience,
  assignments: SurveyAssignmentTarget[],
  actor: SurveyActor,
) {
  const direct = actor.kind === "staff" && !actor.contextRetailerId;
  if (direct) {
    return audience === SurveyAudience.all_salespersons
      || assignments.some((assignment) => assignment.audience === SurveyAudience.selected_salespersons && assignment.salespersonId === actor.id);
  }

  const targetId = actor.kind === "retailer" ? actor.id : actor.contextRetailerId;
  if (!targetId) return false;
  return audience === SurveyAudience.all_retailers
    || assignments.some((assignment) => assignment.audience === SurveyAudience.selected_retailers && assignment.retailerId === targetId);
}

async function surveyForActor(db: Db, surveyId: string, actor: SurveyActor, now: Date) {
  const survey = await db.survey.findFirst({
    where: { id: surveyId, status: SurveyStatus.active, ...dateWindow(now) },
    include: SURVEY_INCLUDE,
  });
  if (!survey) throw new SurveyError("survey_not_available", 404);

  const respondent = currentRespondent(actor);
  if (actor.kind === "retailer") {
    const retailer = await db.retailer.findUnique({ where: { id: actor.id }, select: { id: true } });
    if (!retailer) throw new SurveyError("retailer_not_found", 404);
  } else {
    const staff = await db.staffUser.findUnique({ where: { id: actor.id }, select: { id: true, salesRepId: true } });
    if (!staff) throw new SurveyError("staff_not_found", 404);
    if (actor.contextRetailerId) {
      const retailer = await db.retailer.findUnique({ where: { id: actor.contextRetailerId }, select: { id: true, salesRepId: true } });
      if (!retailer || retailer.salesRepId !== staff.salesRepId) throw new SurveyError("retailer_not_assigned", 403);
    }
  }

  if (!isSurveyActorAllowed(survey.audience, survey.assignments, actor)) throw new SurveyError("survey_not_assigned", 403);

  return { survey, respondent };
}

function answerView(answer: {
  questionId: string;
  valueText: string | null;
  valueNumber: Prisma.Decimal | null;
  selectedOptions: Array<{ option: { id: string; label: string; value: string | null } }>;
  question: { prompt: string; type: SurveyQuestionType };
}) {
  return {
    questionId: answer.questionId,
    prompt: answer.question.prompt,
    type: answer.question.type,
    value: answer.valueNumber == null ? answer.valueText : Number(answer.valueNumber),
    optionIds: answer.selectedOptions.map((link) => link.option.id),
    options: answer.selectedOptions.map((link) => ({ id: link.option.id, label: link.option.label, value: link.option.value })),
  };
}

const RESPONSE_INCLUDE = {
  answers: {
    include: {
      question: { select: { prompt: true, type: true } },
      selectedOptions: { include: { option: { select: { id: true, label: true, value: true } } } },
    },
    orderBy: { question: { position: "asc" as const } },
  },
  respondentStaff: { select: { id: true, name: true, employeeRef: true } },
  respondentRetailer: { select: { id: true, name: true, phone: true } },
  contextRetailer: { select: { id: true, name: true, phone: true } },
} as const;

type ResponseWithDetails = Prisma.SurveyResponseGetPayload<{ include: typeof RESPONSE_INCLUDE }>;

function responseView(response: ResponseWithDetails) {
  return {
    id: response.id,
    surveyId: response.surveyId,
    respondentType: response.respondentType,
    respondentKey: response.respondentKey,
    respondentStaff: response.respondentStaff,
    respondentRetailer: response.respondentRetailer,
    contextRetailer: response.contextRetailer,
    submittedAt: response.submittedAt.toISOString(),
    answers: response.answers.map(answerView),
  };
}

export class SurveyService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  async createDraft(input: SurveyDefinitionInput, actorStaffId: string) {
    const definition = validateDefinition(input);
    const survey = await this.prisma.$transaction(async (tx) => {
      const created = await tx.survey.create({
        data: {
          title: definition.title,
          description: definition.description,
          audience: definition.audience,
          startsAt: definition.startsAt,
          endsAt: definition.endsAt,
          createdByStaffId: actorStaffId,
          questions: {
            create: definition.questions.map((question, position) => ({
              position,
              prompt: question.prompt,
              type: question.type,
              required: question.required,
              minValue: question.minValue,
              maxValue: question.maxValue,
              maxLength: question.maxLength,
              options: question.options.length ? { create: question.options.map((option, optionPosition) => ({ ...option, position: optionPosition })) } : undefined,
            })),
          },
          assignments: { create: assignmentCreateData(definition) },
        },
        include: SURVEY_INCLUDE,
      });
      await tx.auditEvent.create({
        data: { actorStaffId, action: "SURVEY_CREATED", subjectType: "survey", subjectId: created.id, metadata: { audience: created.audience, questionCount: definition.questions.length } },
      });
      return created;
    });
    return surveyView(survey);
  }

  async updateDraft(surveyId: string, input: SurveyDefinitionInput, actorStaffId: string) {
    const definition = validateDefinition(input);
    const survey = await this.prisma.$transaction(async (tx) => {
      const current = await tx.survey.findUnique({ where: { id: surveyId }, include: { _count: { select: { responses: true } } } });
      if (!current) throw new SurveyError("survey_not_found", 404);
      if (current.status !== SurveyStatus.draft) throw new SurveyError("survey_not_editable");
      if (current._count.responses) throw new SurveyError("survey_has_responses");
      await tx.surveyQuestion.deleteMany({ where: { surveyId } });
      await tx.surveyAssignment.deleteMany({ where: { surveyId } });
      const updated = await tx.survey.update({
        where: { id: surveyId },
        data: {
          title: definition.title,
          description: definition.description,
          audience: definition.audience,
          startsAt: definition.startsAt,
          endsAt: definition.endsAt,
          questions: {
            create: definition.questions.map((question, position) => ({
              position,
              prompt: question.prompt,
              type: question.type,
              required: question.required,
              minValue: question.minValue,
              maxValue: question.maxValue,
              maxLength: question.maxLength,
              options: question.options.length ? { create: question.options.map((option, optionPosition) => ({ ...option, position: optionPosition })) } : undefined,
            })),
          },
          assignments: { create: assignmentCreateData(definition) },
        },
        include: SURVEY_INCLUDE,
      });
      await tx.auditEvent.create({ data: { actorStaffId, action: "SURVEY_UPDATED", subjectType: "survey", subjectId: surveyId, metadata: { questionCount: definition.questions.length } } });
      return updated;
    });
    return surveyView(survey);
  }

  async listForAdmin(status?: SurveyStatus) {
    const surveys = await this.prisma.survey.findMany({ where: status ? { status } : undefined, include: SURVEY_INCLUDE, orderBy: { createdAt: "desc" } });
    return surveys.map(surveyView);
  }

  async detailForAdmin(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId }, include: SURVEY_INCLUDE });
    if (!survey) throw new SurveyError("survey_not_found", 404);
    return surveyView(survey);
  }

  async activate(surveyId: string, actorStaffId: string) {
    const survey = await this.prisma.$transaction(async (tx) => {
      const current = await tx.survey.findUnique({ where: { id: surveyId }, include: { questions: { include: { options: true } }, assignments: true } });
      if (!current) throw new SurveyError("survey_not_found", 404);
      if (current.status !== SurveyStatus.draft) throw new SurveyError("survey_not_draft");
      validateDefinition({ title: current.title, description: current.description ?? undefined, audience: current.audience, startsAt: current.startsAt ?? undefined, endsAt: current.endsAt ?? undefined, retailerIds: current.assignments.map((assignment) => assignment.retailerId).filter((id): id is string => Boolean(id)), salespersonIds: current.assignments.map((assignment) => assignment.salespersonId).filter((id): id is string => Boolean(id)), questions: current.questions.map((question) => ({ prompt: question.prompt, type: question.type, required: question.required, minValue: question.minValue == null ? undefined : Number(question.minValue), maxValue: question.maxValue == null ? undefined : Number(question.maxValue), maxLength: question.maxLength ?? undefined, options: question.options.map((option) => ({ label: option.label, value: option.value ?? undefined })) })) });
      const updated = await tx.survey.update({ where: { id: surveyId }, data: { status: SurveyStatus.active, activatedAt: new Date() }, include: SURVEY_INCLUDE });
      await tx.auditEvent.create({ data: { actorStaffId, action: "SURVEY_ACTIVATED", subjectType: "survey", subjectId: surveyId, metadata: { status: SurveyStatus.active } } });
      return updated;
    });
    return surveyView(survey);
  }

  async close(surveyId: string, actorStaffId: string) {
    const survey = await this.prisma.$transaction(async (tx) => {
      const current = await tx.survey.findUnique({ where: { id: surveyId } });
      if (!current) throw new SurveyError("survey_not_found", 404);
      if (current.status !== SurveyStatus.active) throw new SurveyError("survey_not_active");
      const updated = await tx.survey.update({ where: { id: surveyId }, data: { status: SurveyStatus.closed, closedAt: new Date() }, include: SURVEY_INCLUDE });
      await tx.auditEvent.create({ data: { actorStaffId, action: "SURVEY_CLOSED", subjectType: "survey", subjectId: surveyId, metadata: { status: SurveyStatus.closed } } });
      return updated;
    });
    return surveyView(survey);
  }

  async listForRetailer(retailerId: string) {
    const now = new Date();
    const surveys = await this.prisma.survey.findMany({
      where: { status: SurveyStatus.active, ...dateWindow(now), OR: [{ audience: SurveyAudience.all_retailers }, { assignments: { some: { audience: SurveyAudience.selected_retailers, retailerId } } }] },
      include: SURVEY_INCLUDE,
      orderBy: { activatedAt: "desc" },
    });
    const responses = await this.prisma.surveyResponse.findMany({ where: { respondentKey: `retailer:${retailerId}` }, select: { surveyId: true, submittedAt: true } });
    const submitted = new Map(responses.map((response) => [response.surveyId, response.submittedAt.toISOString()]));
    return surveys.map((survey) => ({ ...respondentSurveyView(survey), submittedAt: submitted.get(survey.id) ?? null }));
  }

  async listForStaff(staffId: string, contextRetailerId?: string) {
    const now = new Date();
    const direct = { OR: [{ audience: SurveyAudience.all_salespersons }, { assignments: { some: { audience: SurveyAudience.selected_salespersons, salespersonId: staffId } } }] };
    const contextual = contextRetailerId ? { OR: [{ audience: SurveyAudience.all_retailers }, { assignments: { some: { audience: SurveyAudience.selected_retailers, retailerId: contextRetailerId } } }] } : null;
    const surveys = await this.prisma.survey.findMany({ where: { status: SurveyStatus.active, ...dateWindow(now), OR: contextual ? [direct, contextual] : [direct] }, include: SURVEY_INCLUDE, orderBy: { activatedAt: "desc" } });
    const keys = contextRetailerId ? [`salesperson:${staffId}`, `salesperson:${staffId}:retailer:${contextRetailerId}`] : [`salesperson:${staffId}`];
    const responses = await this.prisma.surveyResponse.findMany({ where: { respondentKey: { in: keys } }, select: { surveyId: true, respondentKey: true, submittedAt: true } });
    const submitted = new Map(responses.map((response) => [`${response.surveyId}:${response.respondentKey}`, response.submittedAt.toISOString()]));
    return surveys.map((survey) => ({
      ...respondentSurveyView(survey),
      submittedAt: submitted.get(`${survey.id}:salesperson:${staffId}`) ?? (contextRetailerId ? submitted.get(`${survey.id}:salesperson:${staffId}:retailer:${contextRetailerId}`) ?? null : null),
      responseContext: contextRetailerId && isSurveyActorAllowed(survey.audience, survey.assignments, { kind: "staff", id: staffId, contextRetailerId }) ? "retailer" : "salesperson",
    }));
  }

  async getForActor(surveyId: string, actor: SurveyActor) {
    const { survey, respondent } = await surveyForActor(this.prisma, surveyId, actor, new Date());
    const response = await this.prisma.surveyResponse.findUnique({ where: { surveyId_respondentKey: { surveyId, respondentKey: respondent.respondentKey } }, include: RESPONSE_INCLUDE });
    return { survey: respondentSurveyView(survey), response: response ? responseView(response) : null };
  }

  async submit(surveyId: string, actor: SurveyActor, idempotencyKey: string, answers: SurveyAnswerInput[]) {
    const key = idempotencyKey.trim();
    if (!key || key.length > 160) throw new SurveyError("idempotency_key_required");
    const now = new Date();
    const { survey, respondent } = await surveyForActor(this.prisma, surveyId, actor, now);
    const normalized = this.normalizeAnswers(survey, answers);
    const requestFingerprint = fingerprint({ surveyId, respondentKey: respondent.respondentKey, answers: normalized });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existingKey = await tx.surveyResponse.findUnique({ where: { surveyId_idempotencyKey: { surveyId, idempotencyKey: key } }, include: RESPONSE_INCLUDE });
        if (existingKey) {
          if (existingKey.requestFingerprint !== requestFingerprint) throw new SurveyError("idempotency_conflict", 409);
          return { response: existingKey, replayed: true };
        }
        const existingRespondent = await tx.surveyResponse.findUnique({ where: { surveyId_respondentKey: { surveyId, respondentKey: respondent.respondentKey } }, include: RESPONSE_INCLUDE });
        if (existingRespondent) throw new SurveyError("survey_already_submitted", 409);
        const response = await tx.surveyResponse.create({
          data: {
            surveyId,
            respondentType: respondent.respondentType,
            respondentKey: respondent.respondentKey,
            respondentStaffId: "respondentStaffId" in respondent ? respondent.respondentStaffId : undefined,
            respondentRetailerId: "respondentRetailerId" in respondent ? respondent.respondentRetailerId : undefined,
            contextRetailerId: respondent.contextRetailerId,
            idempotencyKey: key,
            requestFingerprint,
            answers: {
              create: normalized.map((answer) => ({
                questionId: answer.questionId,
                valueText: typeof answer.value === "string" ? answer.value : typeof answer.value === "boolean" ? (answer.value ? "yes" : "no") : null,
                valueNumber: typeof answer.value === "number" ? answer.value : null,
                selectedOptions: answer.optionIds.length ? { create: answer.optionIds.map((optionId) => ({ optionId })) } : undefined,
              })),
            },
          },
          include: RESPONSE_INCLUDE,
        });
        await tx.auditEvent.create({ data: { actorStaffId: actor.kind === "staff" ? actor.id : undefined, action: "RESPONSE_SUBMITTED", subjectType: "survey_response", subjectId: response.id, metadata: { surveyId, respondentType: respondent.respondentType } } });
        return { response, replayed: false };
      });
      return { response: responseView(result.response), replayed: result.replayed };
    } catch (error) {
      if (error instanceof SurveyError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.surveyResponse.findUnique({ where: { surveyId_idempotencyKey: { surveyId, idempotencyKey: key } }, include: RESPONSE_INCLUDE });
        if (existing?.requestFingerprint === requestFingerprint) return { response: responseView(existing), replayed: true };
        if (existing) throw new SurveyError("idempotency_conflict", 409);
        throw new SurveyError("survey_already_submitted", 409);
      }
      throw error;
    }
  }

  /** Exposed for focused contract tests; persistence still happens only via submit(). */
  normalizeAnswers(survey: SurveyWithDetails, answers: SurveyAnswerInput[]) {
    const byQuestion = new Map(survey.questions.map((question) => [question.id, question]));
    const seen = new Set<string>();
    const normalized: Array<{ questionId: string; optionIds: string[]; value: string | number | boolean | null }> = [];
    for (const answer of answers) {
      if (!byQuestion.has(answer.questionId)) throw new SurveyError("question_not_in_survey");
      if (seen.has(answer.questionId)) throw new SurveyError("duplicate_question_answer");
      seen.add(answer.questionId);
      const question = byQuestion.get(answer.questionId)!;
      const optionIds = uniqueStrings(answer.optionIds);
      const allowedOptionIds = new Set(question.options.map((option) => option.id));
      if (optionIds.some((optionId) => !allowedOptionIds.has(optionId))) throw new SurveyError("option_not_in_question");

      // Clients may submit a stable answer envelope for every question. An
      // absent optional answer is not an invalid number/yes-no/text value; it
      // simply has no SurveyAnswer row. Required questions are checked below.
      if (answer.value == null && optionIds.length === 0 && !question.required) continue;

      let value: string | number | boolean | null = answer.value ?? null;
      if (question.type === SurveyQuestionType.single_choice || question.type === SurveyQuestionType.multiple_choice) {
        if (value != null) throw new SurveyError("choice_value_invalid");
        if (question.type === SurveyQuestionType.single_choice && optionIds.length > 1) throw new SurveyError("single_choice_multiple_options");
        if (question.required && optionIds.length === 0) throw new SurveyError("required_answer_missing");
      } else if (question.type === SurveyQuestionType.yes_no) {
        if (typeof value === "string") {
          const lower = value.toLowerCase();
          if (!["yes", "no"].includes(lower)) throw new SurveyError("yes_no_invalid");
          value = lower === "yes";
        }
        if (typeof value !== "boolean") throw new SurveyError("yes_no_invalid");
      } else if (question.type === SurveyQuestionType.rating || question.type === SurveyQuestionType.number) {
        if (typeof value === "string" && value.trim() !== "") value = Number(value);
        if (typeof value !== "number" || !Number.isFinite(value)) throw new SurveyError("number_answer_invalid");
        const min = question.minValue == null ? (question.type === SurveyQuestionType.rating ? 1 : undefined) : Number(question.minValue);
        const max = question.maxValue == null ? (question.type === SurveyQuestionType.rating ? 5 : undefined) : Number(question.maxValue);
        if (min != null && value < min || max != null && value > max) throw new SurveyError("number_answer_out_of_range");
      } else {
        if (typeof value !== "string") throw new SurveyError("text_answer_invalid");
        value = value.trim();
        const maxLength = question.maxLength ?? 2000;
        if (!value && question.required || value.length > maxLength) throw new SurveyError("text_answer_invalid");
      }
      normalized.push({ questionId: answer.questionId, optionIds, value });
    }
    for (const question of survey.questions) {
      if (question.required && !seen.has(question.id)) throw new SurveyError("required_answer_missing", 400, { questionId: question.id });
    }
    return normalized;
  }

  async listResponses(surveyId: string, filters?: { respondentType?: SurveyRespondentType }) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId }, select: { id: true } });
    if (!survey) throw new SurveyError("survey_not_found", 404);
    const responses = await this.prisma.surveyResponse.findMany({ where: { surveyId, respondentType: filters?.respondentType }, include: RESPONSE_INCLUDE, orderBy: { submittedAt: "desc" } });
    return responses.map(responseView);
  }

  async summary(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId }, include: { questions: { include: { options: true }, orderBy: { position: "asc" } } } });
    if (!survey) throw new SurveyError("survey_not_found", 404);
    const responses = await this.prisma.surveyResponse.findMany({ where: { surveyId }, include: { answers: { include: { selectedOptions: true } } } });
    return {
      surveyId,
      responseCount: responses.length,
      questions: survey.questions.map((question) => {
        const answers = responses.flatMap((response) => response.answers.filter((answer) => answer.questionId === question.id));
        if (question.type === SurveyQuestionType.single_choice || question.type === SurveyQuestionType.multiple_choice) {
          return { questionId: question.id, prompt: question.prompt, type: question.type, answers: question.options.map((option) => ({ optionId: option.id, label: option.label, count: answers.reduce((count, answer) => count + (answer.selectedOptions.some((selected) => selected.optionId === option.id) ? 1 : 0), 0) })) };
        }
        if (question.type === SurveyQuestionType.rating || question.type === SurveyQuestionType.number) {
          const values = answers.flatMap((answer) => answer.valueNumber == null ? [] : [Number(answer.valueNumber)]);
          return { questionId: question.id, prompt: question.prompt, type: question.type, answered: values.length, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null };
        }
        return { questionId: question.id, prompt: question.prompt, type: question.type, answered: answers.length };
      }),
    };
  }
}

export const defaultSurveyService = new SurveyService();
export { Permissions };
