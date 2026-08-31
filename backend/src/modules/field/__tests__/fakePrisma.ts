import { vi } from "vitest";

/**
 * A hand-rolled Prisma double. Every model used by the field services gets the
 * handful of methods those services call, so a test can state exactly what the
 * database returns without a live schema.
 */
export function fakePrisma(overrides: Record<string, any> = {}) {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  });

  const db: Record<string, any> = {
    appConfig: model(),
    workdaySession: model(),
    leaveRequest: model(),
    workingCalendar: model(),
    routePlan: model(),
    routePlanStop: model(),
    customerActivity: model(),
    fieldTask: model(),
    locationPing: model(),
    fieldExpense: model(),
    serviceIssue: model(),
    salesTarget: model(),
    salesVisit: model(),
    staffUser: model(),
    retailer: model(),
    order: model(),
    invoice: model(),
    collectionSubmission: model(),
    auditEvent: model(),
    ...overrides,
  };

  db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));
  return db;
}

export const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
