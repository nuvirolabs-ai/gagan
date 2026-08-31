import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { validateCoordinateInput, type CoordinateInput } from "../location/locationDomain";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import type { ObjectStorage } from "../../platform/storage/objectStorage";
import {
  dateWithinRange,
  eachDay,
  resolveAttendanceMark,
  startOfDay,
  workedMinutes,
  type AttendanceMark,
} from "./fieldDomain";

type Db = PrismaClient | any;

export class FieldServiceError extends Error {
  constructor(readonly code: string, readonly status = 409, readonly details?: unknown) {
    super(code);
    this.name = "FieldServiceError";
  }
}

export interface AttendancePhotoInput {
  contentType: string;
  bodyBase64: string;
}

export interface ClockInInput extends CoordinateInput {
  salespersonId: string;
  photo?: AttendancePhotoInput;
  now?: Date;
}

export interface ClockOutInput extends CoordinateInput {
  salespersonId: string;
  photo?: AttendancePhotoInput;
  now?: Date;
}

export interface AttendanceDay {
  date: string;
  mark: AttendanceMark;
  startedAt: Date | null;
  endedAt: Date | null;
  workedMinutes: number | null;
  leaveType: string | null;
}

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/**
 * The workday lifecycle: clock in, work, clock out. An open session is the
 * only thing that authorises movement tracking, so it is deliberately the
 * single source of "on duty" for the whole field module.
 */
export class AttendanceService {
  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly storage: () => ObjectStorage = getObjectStorage
  ) {}

  private async policy() {
    const config = await this.prisma.appConfig.findUnique({ where: { id: "singleton" } });
    return {
      selfieRequired: config?.attendanceSelfieRequired ?? false,
      trackingEnabled: config?.locationTrackingEnabled ?? true,
      pingIntervalSeconds: config?.locationPingIntervalSeconds ?? 300,
    };
  }

  /**
   * Attendance photos are stored as plain evidence through the same object
   * storage as KYC and collection receipts. No biometric template is derived
   * and no facial recognition is performed — the photo is only ever shown to
   * an authorised reviewer.
   */
  private async storePhoto(salespersonId: string, photo: AttendancePhotoInput, kind: "start" | "end") {
    if (!ALLOWED_PHOTO_TYPES.has(photo.contentType)) {
      throw new FieldServiceError("attendance_photo_type_unsupported", 415);
    }
    const body = Buffer.from(photo.bodyBase64, "base64");
    if (body.byteLength === 0) throw new FieldServiceError("attendance_photo_empty", 400);
    if (body.byteLength > MAX_PHOTO_BYTES) throw new FieldServiceError("attendance_photo_too_large", 413);
    const stored = await this.storage().put({
      purpose: "attendance_photo",
      contentType: photo.contentType,
      body,
    });
    return stored.objectKey;
  }

  async openSession(salespersonId: string) {
    return this.prisma.workdaySession.findFirst({
      where: { salespersonId, status: "open" },
      orderBy: { startedAt: "desc" },
    });
  }

  async sessionForDate(salespersonId: string, date: Date) {
    return this.prisma.workdaySession.findUnique({
      where: { salespersonId_workDate: { salespersonId, workDate: startOfDay(date) } },
    });
  }

  async clockIn(input: ClockInInput) {
    validateCoordinateInput(input);
    const now = input.now ?? new Date();
    const workDate = startOfDay(now);
    const policy = await this.policy();
    if (policy.selfieRequired && !input.photo) {
      throw new FieldServiceError("attendance_photo_required", 422);
    }

    const existingOpen = await this.openSession(input.salespersonId);
    if (existingOpen) throw new FieldServiceError("workday_already_open", 409);

    const existingForDay = await this.sessionForDate(input.salespersonId, workDate);
    if (existingForDay) throw new FieldServiceError("workday_already_completed", 409);

    const photoKey = input.photo
      ? await this.storePhoto(input.salespersonId, input.photo, "start")
      : null;

    return this.prisma.$transaction(async (tx: Db) => {
      const session = await tx.workdaySession.create({
        data: {
          salespersonId: input.salespersonId,
          workDate,
          status: "open",
          startedAt: now,
          startLatitude: input.latitude,
          startLongitude: input.longitude,
          startAccuracyMeters: input.accuracyMeters,
          startPhotoObjectKey: photoKey,
          devicePlatform: input.devicePlatform ?? null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.salespersonId,
          action: "workday.started",
          subjectType: "workday_session",
          subjectId: session.id,
          metadata: { workDate: workDate.toISOString(), withPhoto: photoKey != null },
        },
      });
      return session;
    });
  }

  async clockOut(input: ClockOutInput) {
    validateCoordinateInput(input);
    const now = input.now ?? new Date();
    const policy = await this.policy();
    if (policy.selfieRequired && !input.photo) {
      throw new FieldServiceError("attendance_photo_required", 422);
    }
    const session = await this.openSession(input.salespersonId);
    if (!session) throw new FieldServiceError("workday_not_open", 409);

    const photoKey = input.photo
      ? await this.storePhoto(input.salespersonId, input.photo, "end")
      : null;

    return this.prisma.$transaction(async (tx: Db) => {
      const closed = await tx.workdaySession.update({
        where: { id: session.id },
        data: {
          status: "closed",
          endedAt: now,
          endLatitude: input.latitude,
          endLongitude: input.longitude,
          endAccuracyMeters: input.accuracyMeters,
          endPhotoObjectKey: photoKey,
          workedMinutes: workedMinutes(session.startedAt, now),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.salespersonId,
          action: "workday.ended",
          subjectType: "workday_session",
          subjectId: session.id,
          metadata: { workedMinutes: closed.workedMinutes },
        },
      });
      return closed;
    });
  }

  /**
   * Attendance history is derived per day from the workday sessions, approved
   * leave and the working calendar. Nothing stores a per-day status column, so
   * a later leave approval retroactively corrects the history.
   */
  async attendanceHistory(input: { salespersonId: string; from: Date; to: Date; today?: Date }): Promise<AttendanceDay[]> {
    const from = startOfDay(input.from);
    const to = startOfDay(input.to);
    const today = startOfDay(input.today ?? new Date());
    const [sessions, leave, calendar]: [any[], any[], any[]] = await Promise.all([
      this.prisma.workdaySession.findMany({
        where: { salespersonId: input.salespersonId, workDate: { gte: from, lte: to } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          salespersonId: input.salespersonId,
          status: "approved",
          fromDate: { lte: to },
          toDate: { gte: from },
        },
      }),
      this.prisma.workingCalendar.findMany({ where: { date: { gte: from, lte: to } } }),
    ]);

    const sessionByDay = new Map<number, any>(
      sessions.map((session: any) => [startOfDay(session.workDate).getTime(), session])
    );
    const calendarByDay = new Map<number, boolean>(
      calendar.map((entry: any) => [startOfDay(entry.date).getTime(), entry.isWorkingDay as boolean])
    );

    return eachDay(from, to).map((date) => {
      const session = sessionByDay.get(date.getTime());
      const leaveForDay = leave.find((request: any) =>
        dateWithinRange(date, request.fromDate, request.toDate)
      );
      return {
        date: date.toISOString().slice(0, 10),
        mark: resolveAttendanceMark({
          date,
          today,
          hasWorkday: session != null,
          onApprovedLeave: leaveForDay != null,
          // Days outside the seeded calendar are treated as working days so a
          // missing calendar row never silently excuses an absence.
          isWorkingDay: calendarByDay.get(date.getTime()) ?? true,
        }),
        startedAt: session?.startedAt ?? null,
        endedAt: session?.endedAt ?? null,
        workedMinutes: session?.workedMinutes ?? null,
        leaveType: leaveForDay?.type ?? null,
      };
    });
  }

  /* --------------------------------- leave -------------------------------- */

  async requestLeave(input: {
    salespersonId: string;
    fromDate: Date;
    toDate: Date;
    type: "casual" | "sick" | "unpaid" | "other";
    reason: string;
  }) {
    const fromDate = startOfDay(input.fromDate);
    const toDate = startOfDay(input.toDate);
    if (toDate < fromDate) throw new FieldServiceError("leave_range_invalid", 400);
    if (!input.reason.trim()) throw new FieldServiceError("leave_reason_required", 400);

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        salespersonId: input.salespersonId,
        status: { in: ["pending", "approved"] },
        fromDate: { lte: toDate },
        toDate: { gte: fromDate },
      },
    });
    if (overlapping) throw new FieldServiceError("leave_overlaps_existing_request", 409);

    return this.prisma.leaveRequest.create({
      data: {
        salespersonId: input.salespersonId,
        fromDate,
        toDate,
        type: input.type,
        reason: input.reason.trim(),
      },
    });
  }

  async listLeave(input: { salespersonId?: string; status?: string }) {
    return this.prisma.leaveRequest.findMany({
      where: {
        ...(input.salespersonId ? { salespersonId: input.salespersonId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: { salesperson: { select: { id: true, name: true, phone: true } } },
      orderBy: { fromDate: "desc" },
    });
  }

  async cancelLeave(input: { leaveId: string; salespersonId: string }) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id: input.leaveId } });
    if (!request || request.salespersonId !== input.salespersonId) {
      throw new FieldServiceError("leave_request_not_found", 404);
    }
    if (request.status !== "pending") throw new FieldServiceError("leave_already_decided", 409);
    return this.prisma.leaveRequest.update({
      where: { id: request.id },
      data: { status: "cancelled" },
    });
  }

  /** Manager/admin decision. Only a pending request can be decided. */
  async decideLeave(input: {
    leaveId: string;
    decidedByStaffId: string;
    decision: "approved" | "rejected";
    note?: string;
  }) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id: input.leaveId } });
    if (!request) throw new FieldServiceError("leave_request_not_found", 404);
    if (request.status !== "pending") throw new FieldServiceError("leave_already_decided", 409);
    if (request.salespersonId === input.decidedByStaffId) {
      throw new FieldServiceError("leave_self_decision_forbidden", 403);
    }
    return this.prisma.$transaction(async (tx: Db) => {
      const decided = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: input.decision,
          decidedByStaffId: input.decidedByStaffId,
          decidedAt: new Date(),
          decisionNote: input.note?.trim() || null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.decidedByStaffId,
          action: `leave.${input.decision}`,
          subjectType: "leave_request",
          subjectId: request.id,
          metadata: { salespersonId: request.salespersonId },
        },
      });
      return decided;
    });
  }

  /** Team attendance for one date, for managers and admins. */
  async teamAttendance(date: Date) {
    const workDate = startOfDay(date);
    const [staff, sessions, leave, calendar]: [any[], any[], any[], any] = await Promise.all([
      this.prisma.staffUser.findMany({
        where: { status: "active", salesRepId: { not: null } },
        select: { id: true, name: true, phone: true, salesRep: { select: { territory: true } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.workdaySession.findMany({ where: { workDate } }),
      this.prisma.leaveRequest.findMany({
        where: { status: "approved", fromDate: { lte: workDate }, toDate: { gte: workDate } },
      }),
      this.prisma.workingCalendar.findUnique({ where: { date: workDate } }),
    ]);

    const sessionByStaff = new Map<string, any>(
      sessions.map((session: any) => [session.salespersonId, session])
    );
    const leaveByStaff = new Map<string, any>(
      leave.map((request: any) => [request.salespersonId, request])
    );

    return staff.map((member: any) => {
      const session = sessionByStaff.get(member.id);
      const leaveForDay = leaveByStaff.get(member.id);
      return {
        salespersonId: member.id,
        name: member.name,
        phone: member.phone,
        territory: member.salesRep?.territory ?? null,
        mark: resolveAttendanceMark({
          date: workDate,
          today: startOfDay(new Date()),
          hasWorkday: session != null,
          onApprovedLeave: leaveForDay != null,
          isWorkingDay: calendar?.isWorkingDay ?? true,
        }),
        startedAt: session?.startedAt ?? null,
        endedAt: session?.endedAt ?? null,
        workedMinutes: session?.workedMinutes ?? null,
        status: session?.status ?? null,
      };
    });
  }
}

export const defaultAttendanceService = new AttendanceService();
