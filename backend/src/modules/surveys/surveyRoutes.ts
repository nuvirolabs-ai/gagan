import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { SurveyAudience, SurveyQuestionType, SurveyRespondentType, SurveyStatus } from "@prisma/client";
import {
  defaultSurveyService,
  SurveyError,
  SurveyService,
  type SurveyAnswerInput,
  type SurveyDefinitionInput,
} from "./surveyService";

const questionSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  type: z.nativeEnum(SurveyQuestionType),
  required: z.boolean().optional(),
  minValue: z.number().finite().optional(),
  maxValue: z.number().finite().optional(),
  maxLength: z.number().int().positive().max(2000).optional(),
  options: z.array(z.object({ label: z.string().trim().min(1).max(200), value: z.string().trim().max(200).optional() })).max(20).optional(),
});

const definitionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  audience: z.nativeEnum(SurveyAudience),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  retailerIds: z.array(z.string().uuid()).max(1000).optional(),
  salespersonIds: z.array(z.string().uuid()).max(1000).optional(),
  questions: z.array(questionSchema).min(1).max(50),
});

const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).max(20).optional(),
  value: z.union([z.string(), z.number().finite(), z.boolean()]).nullable().optional(),
});

const responseSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(160),
  answers: z.array(answerSchema).max(50),
  retailerId: z.string().uuid().optional(),
});

function definition(input: z.infer<typeof definitionSchema>): SurveyDefinitionInput {
  return {
    ...input,
    startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
    endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
  };
}

function sendError(error: unknown, res: any, next: any) {
  if (error instanceof SurveyError) return res.status(error.status).json({ error: error.code, details: error.details });
  return next(error);
}

/**
 * Market Survey V1 uses one backend contract for Admin authoring and the two
 * identified mobile respondents. The caller's session remains the source of
 * identity; retailer context is resolved and checked server-side.
 */
export function createSurveyRouter(options: {
  adminAuthenticate: RequestHandler;
  staffAuthenticate: RequestHandler;
  service?: SurveyService;
}) {
  const service = options.service ?? defaultSurveyService;
  const router = Router();

  router.get(
    "/admin/surveys",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_MANAGE),
    asyncRoute(async (req, res, next) => {
      try {
        const status = typeof req.query.status === "string" && Object.values(SurveyStatus).includes(req.query.status as SurveyStatus) ? req.query.status as SurveyStatus : undefined;
        res.json({ surveys: await service.listForAdmin(status) });
      } catch (error) { sendError(error, res, next); }
    })
  );

  router.post(
    "/admin/surveys",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = definitionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
      try { res.status(201).json({ survey: await service.createDraft(definition(parsed.data), req.staffAuth!.staffId) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.get(
    "/admin/surveys/:id",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_MANAGE),
    asyncRoute(async (req, res, next) => {
      try { res.json({ survey: await service.detailForAdmin(req.params.id) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.patch(
    "/admin/surveys/:id",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = definitionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
      try { res.json({ survey: await service.updateDraft(req.params.id, definition(parsed.data), req.staffAuth!.staffId) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.post(
    "/admin/surveys/:id/activate",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try { res.json({ survey: await service.activate(req.params.id, req.staffAuth!.staffId) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.post(
    "/admin/surveys/:id/close",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try { res.json({ survey: await service.close(req.params.id, req.staffAuth!.staffId) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.get(
    "/admin/surveys/:id/responses",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_RESPONSES_VIEW),
    asyncRoute(async (req, res, next) => {
      try {
        const respondentType = typeof req.query.respondentType === "string" && Object.values(SurveyRespondentType).includes(req.query.respondentType as SurveyRespondentType) ? req.query.respondentType as SurveyRespondentType : undefined;
        res.json({ responses: await service.listResponses(req.params.id, { respondentType }) });
      } catch (error) { sendError(error, res, next); }
    })
  );

  router.get(
    "/admin/surveys/:id/summary",
    options.adminAuthenticate,
    requirePermission(Permissions.SURVEY_RESPONSES_VIEW),
    asyncRoute(async (req, res, next) => {
      try { res.json({ summary: await service.summary(req.params.id) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.get(
    "/rep/surveys",
    options.staffAuthenticate,
    requirePermission(Permissions.SURVEY_RESPOND),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try { res.json({ surveys: await service.listForStaff(req.staffAuth!.staffId, typeof req.query.retailerId === "string" ? req.query.retailerId : undefined) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.get(
    "/rep/surveys/:id",
    options.staffAuthenticate,
    requirePermission(Permissions.SURVEY_RESPOND),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try { res.json(await service.getForActor(req.params.id, { kind: "staff", id: req.staffAuth!.staffId, contextRetailerId: typeof req.query.retailerId === "string" ? req.query.retailerId : undefined })); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.post(
    "/rep/surveys/:id/responses",
    options.staffAuthenticate,
    requirePermission(Permissions.SURVEY_RESPOND),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = responseSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
      try {
        const result = await service.submit(req.params.id, { kind: "staff", id: req.staffAuth!.staffId, contextRetailerId: parsed.data.retailerId }, parsed.data.idempotencyKey, parsed.data.answers as SurveyAnswerInput[]);
        res.status(result.replayed ? 200 : 201).json(result);
      } catch (error) { sendError(error, res, next); }
    })
  );

  router.get(
    "/surveys",
    requireAuth,
    asyncRoute(async (req: AuthedRequest, res, next) => {
      try { res.json({ surveys: await service.listForRetailer(req.retailerId!) }); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.get(
    "/surveys/:id",
    requireAuth,
    asyncRoute(async (req: AuthedRequest, res, next) => {
      try { res.json(await service.getForActor(req.params.id, { kind: "retailer", id: req.retailerId! })); }
      catch (error) { sendError(error, res, next); }
    })
  );

  router.post(
    "/surveys/:id/responses",
    requireAuth,
    asyncRoute(async (req: AuthedRequest, res, next) => {
      const parsed = responseSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
      try {
        const result = await service.submit(req.params.id, { kind: "retailer", id: req.retailerId! }, parsed.data.idempotencyKey, parsed.data.answers as SurveyAnswerInput[]);
        res.status(result.replayed ? 200 : 201).json(result);
      } catch (error) { sendError(error, res, next); }
    })
  );

  return router;
}
