import { describe, expect, it, vi } from "vitest";
import { AttendanceService, FieldServiceError } from "../attendanceService";
import { day, fakePrisma } from "./fakePrisma";

function storage() {
  return () =>
    ({
      put: vi.fn().mockResolvedValue({
        objectKey: "attendance_photo/2026/03/abc",
        checksum: "x",
        contentType: "image/jpeg",
        sizeBytes: 10,
      }),
      read: vi.fn(),
      signedReadUrl: vi.fn(),
      delete: vi.fn(),
    }) as any;
}

const coordinates = { latitude: 18.52, longitude: 73.85, accuracyMeters: 12 };

describe("clocking in", () => {
  it("opens a workday for today and records where it started", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ attendanceSelfieRequired: false });
    prisma.workdaySession.findFirst.mockResolvedValue(null);
    prisma.workdaySession.findUnique.mockResolvedValue(null);
    prisma.workdaySession.create.mockResolvedValue({ id: "session-1" });

    const service = new AttendanceService(prisma, storage());
    await service.clockIn({
      ...coordinates,
      salespersonId: "staff-1",
      now: new Date("2026-03-10T09:00:00Z"),
    });

    expect(prisma.workdaySession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salespersonId: "staff-1",
          status: "open",
          workDate: day("2026-03-10"),
          startLatitude: 18.52,
        }),
      })
    );
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  it("refuses a second open workday", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({});
    prisma.workdaySession.findFirst.mockResolvedValue({ id: "session-1", status: "open" });

    const service = new AttendanceService(prisma, storage());
    await expect(
      service.clockIn({ ...coordinates, salespersonId: "staff-1" })
    ).rejects.toMatchObject({ code: "workday_already_open" });
    expect(prisma.workdaySession.create).not.toHaveBeenCalled();
  });

  it("refuses to reopen a day that was already completed", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({});
    prisma.workdaySession.findFirst.mockResolvedValue(null);
    prisma.workdaySession.findUnique.mockResolvedValue({ id: "session-1", status: "closed" });

    const service = new AttendanceService(prisma, storage());
    await expect(
      service.clockIn({ ...coordinates, salespersonId: "staff-1" })
    ).rejects.toMatchObject({ code: "workday_already_completed" });
  });

  it("requires an attendance photo only when policy asks for one", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ attendanceSelfieRequired: true });
    prisma.workdaySession.findFirst.mockResolvedValue(null);
    prisma.workdaySession.findUnique.mockResolvedValue(null);

    const service = new AttendanceService(prisma, storage());
    await expect(
      service.clockIn({ ...coordinates, salespersonId: "staff-1" })
    ).rejects.toMatchObject({ code: "attendance_photo_required", status: 422 });
  });

  it("stores an attendance photo through object storage rather than the database", async () => {
    const prisma = fakePrisma();
    const store = storage();
    prisma.appConfig.findUnique.mockResolvedValue({ attendanceSelfieRequired: true });
    prisma.workdaySession.findFirst.mockResolvedValue(null);
    prisma.workdaySession.findUnique.mockResolvedValue(null);
    prisma.workdaySession.create.mockResolvedValue({ id: "session-1" });

    const service = new AttendanceService(prisma, store);
    await service.clockIn({
      ...coordinates,
      salespersonId: "staff-1",
      photo: { contentType: "image/jpeg", bodyBase64: Buffer.from("photo").toString("base64") },
    });

    expect(prisma.workdaySession.create.mock.calls[0][0].data.startPhotoObjectKey).toBe(
      "attendance_photo/2026/03/abc"
    );
  });

  it("rejects an unsupported attendance photo type", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ attendanceSelfieRequired: true });
    prisma.workdaySession.findFirst.mockResolvedValue(null);
    prisma.workdaySession.findUnique.mockResolvedValue(null);

    const service = new AttendanceService(prisma, storage());
    await expect(
      service.clockIn({
        ...coordinates,
        salespersonId: "staff-1",
        photo: { contentType: "application/zip", bodyBase64: "AAAA" },
      })
    ).rejects.toMatchObject({ code: "attendance_photo_type_unsupported" });
  });
});

describe("clocking out", () => {
  it("closes the open session and stores the worked duration", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({});
    prisma.workdaySession.findFirst.mockResolvedValue({
      id: "session-1",
      startedAt: new Date("2026-03-10T09:00:00Z"),
    });
    prisma.workdaySession.update.mockResolvedValue({ id: "session-1", workedMinutes: 480 });

    const service = new AttendanceService(prisma, storage());
    await service.clockOut({
      ...coordinates,
      salespersonId: "staff-1",
      now: new Date("2026-03-10T17:00:00Z"),
    });

    expect(prisma.workdaySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "closed", workedMinutes: 480 }),
      })
    );
  });

  it("refuses to clock out when no day is running", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({});
    prisma.workdaySession.findFirst.mockResolvedValue(null);

    const service = new AttendanceService(prisma, storage());
    await expect(
      service.clockOut({ ...coordinates, salespersonId: "staff-1" })
    ).rejects.toMatchObject({ code: "workday_not_open" });
  });
});

describe("attendance history", () => {
  it("derives present, leave, holiday and absent from canonical rows", async () => {
    const prisma = fakePrisma();
    prisma.workdaySession.findMany.mockResolvedValue([
      { workDate: day("2026-03-09"), startedAt: new Date("2026-03-09T09:00:00Z"), endedAt: null, workedMinutes: null },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([
      { fromDate: day("2026-03-10"), toDate: day("2026-03-10"), type: "sick" },
    ]);
    prisma.workingCalendar.findMany.mockResolvedValue([
      { date: day("2026-03-09"), isWorkingDay: true },
      { date: day("2026-03-10"), isWorkingDay: true },
      { date: day("2026-03-11"), isWorkingDay: true },
      { date: day("2026-03-12"), isWorkingDay: false },
    ]);

    const service = new AttendanceService(prisma, storage());
    const days = await service.attendanceHistory({
      salespersonId: "staff-1",
      from: day("2026-03-09"),
      to: day("2026-03-12"),
      today: day("2026-03-11"),
    });

    expect(days.map((d) => [d.date, d.mark])).toEqual([
      ["2026-03-09", "present"],
      ["2026-03-10", "leave"],
      ["2026-03-11", "absent"],
      ["2026-03-12", "holiday"],
    ]);
  });
});

describe("leave", () => {
  it("rejects an inverted date range", async () => {
    const service = new AttendanceService(fakePrisma(), storage());
    await expect(
      service.requestLeave({
        salespersonId: "staff-1",
        fromDate: day("2026-03-12"),
        toDate: day("2026-03-10"),
        type: "casual",
        reason: "Family",
      })
    ).rejects.toMatchObject({ code: "leave_range_invalid" });
  });

  it("rejects a request overlapping an existing one", async () => {
    const prisma = fakePrisma();
    prisma.leaveRequest.findFirst.mockResolvedValue({ id: "leave-1" });
    const service = new AttendanceService(prisma, storage());
    await expect(
      service.requestLeave({
        salespersonId: "staff-1",
        fromDate: day("2026-03-10"),
        toDate: day("2026-03-12"),
        type: "casual",
        reason: "Family",
      })
    ).rejects.toMatchObject({ code: "leave_overlaps_existing_request" });
  });

  it("never lets a salesperson approve their own leave", async () => {
    const prisma = fakePrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: "leave-1",
      status: "pending",
      salespersonId: "staff-1",
    });
    const service = new AttendanceService(prisma, storage());
    await expect(
      service.decideLeave({
        leaveId: "leave-1",
        decidedByStaffId: "staff-1",
        decision: "approved",
      })
    ).rejects.toMatchObject({ code: "leave_self_decision_forbidden", status: 403 });
  });

  it("records who decided a leave request and when", async () => {
    const prisma = fakePrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: "leave-1",
      status: "pending",
      salespersonId: "staff-1",
    });
    prisma.leaveRequest.update.mockResolvedValue({ id: "leave-1", status: "approved" });
    const service = new AttendanceService(prisma, storage());
    await service.decideLeave({
      leaveId: "leave-1",
      decidedByStaffId: "manager-1",
      decision: "approved",
      note: "Covered by Anil",
    });
    expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "approved",
          decidedByStaffId: "manager-1",
          decisionNote: "Covered by Anil",
        }),
      })
    );
  });

  it("refuses to decide an already-decided request", async () => {
    const prisma = fakePrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: "leave-1",
      status: "approved",
      salespersonId: "staff-1",
    });
    const service = new AttendanceService(prisma, storage());
    await expect(
      service.decideLeave({ leaveId: "leave-1", decidedByStaffId: "manager-1", decision: "rejected" })
    ).rejects.toBeInstanceOf(FieldServiceError);
  });
});
