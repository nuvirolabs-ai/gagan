import { describe, expect, it } from "vitest";
import { RouteService } from "../routeService";
import { day, fakePrisma } from "./fakePrisma";

describe("planning a route", () => {
  const stops = [{ retailerId: "retailer-1" }, { retailerId: "retailer-2" }];

  it("refuses to schedule a store that is not assigned to that salesperson", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1", status: "active" });
    prisma.retailer.findMany.mockResolvedValue([{ id: "retailer-1" }]);

    await expect(
      new RouteService(prisma).upsertPlan({
        salespersonId: "staff-1",
        planDate: day("2026-03-10"),
        createdByStaffId: "manager-1",
        stops,
      })
    ).rejects.toMatchObject({
      code: "retailer_not_assigned_to_salesperson",
      status: 422,
      details: { unassigned: ["retailer-2"] },
    });
    expect(prisma.routePlan.upsert).not.toHaveBeenCalled();
  });

  it("refuses to plan for a salesperson who is not an active field user", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: null, status: "active" });

    await expect(
      new RouteService(prisma).upsertPlan({
        salespersonId: "staff-1",
        planDate: day("2026-03-10"),
        createdByStaffId: "manager-1",
        stops,
      })
    ).rejects.toMatchObject({ code: "salesperson_not_available" });
  });

  it("rejects the same store twice in one day", async () => {
    const prisma = fakePrisma();
    await expect(
      new RouteService(prisma).upsertPlan({
        salespersonId: "staff-1",
        planDate: day("2026-03-10"),
        createdByStaffId: "manager-1",
        stops: [{ retailerId: "retailer-1" }, { retailerId: "retailer-1" }],
      })
    ).rejects.toMatchObject({ code: "route_stop_duplicated" });
  });

  it("will not rewrite a route the salesperson has already started", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1", status: "active" });
    prisma.retailer.findMany.mockResolvedValue([{ id: "retailer-1" }, { id: "retailer-2" }]);
    prisma.routePlan.findUnique.mockResolvedValue({
      id: "plan-1",
      stops: [{ id: "stop-1", retailerId: "retailer-1", status: "visited" }],
    });

    await expect(
      new RouteService(prisma).upsertPlan({
        salespersonId: "staff-1",
        planDate: day("2026-03-10"),
        createdByStaffId: "manager-1",
        stops,
      })
    ).rejects.toMatchObject({ code: "route_already_in_progress" });
  });

  it("numbers stops in the order they were given", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1", status: "active" });
    prisma.retailer.findMany.mockResolvedValue([{ id: "retailer-1" }, { id: "retailer-2" }]);
    prisma.routePlan.findUnique.mockResolvedValue(null);
    prisma.routePlan.upsert.mockResolvedValue({ id: "plan-1" });

    await new RouteService(prisma).upsertPlan({
      salespersonId: "staff-1",
      planDate: day("2026-03-10"),
      createdByStaffId: "manager-1",
      stops,
    });

    expect(prisma.routePlanStop.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ retailerId: "retailer-1", sequence: 1 }),
        expect.objectContaining({ retailerId: "retailer-2", sequence: 2 }),
      ],
    });
  });

  it("only publishes a draft", async () => {
    const prisma = fakePrisma();
    prisma.routePlan.findUnique.mockResolvedValue({ id: "plan-1", status: "published" });
    await expect(
      new RouteService(prisma).publishPlan({ planId: "plan-1", actorStaffId: "manager-1" })
    ).rejects.toMatchObject({ code: "route_plan_not_draft" });
  });
});

describe("manual beat templates", () => {
  const stops = [{ retailerId: "retailer-1" }, { retailerId: "retailer-2" }];

  it("lists only the caller's own templates", async () => {
    const prisma = fakePrisma();
    prisma.beatTemplate.findMany.mockResolvedValue([{ id: "beat-1", salespersonId: "staff-1" }]);
    const result = await new RouteService(prisma).listBeatTemplates({ salespersonId: "staff-1", origin: "self" });
    expect(result).toEqual([{ id: "beat-1", salespersonId: "staff-1" }]);
    expect(prisma.beatTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { salespersonId: "staff-1", origin: "self" },
    }));
  });

  it("rejects an unassigned retailer before creating a template", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1", status: "active" });
    prisma.retailer.findMany.mockResolvedValue([{ id: "retailer-1" }]);
    await expect(new RouteService(prisma).saveBeatTemplate({
      salespersonId: "staff-1", actorStaffId: "staff-1", origin: "self", name: "North", stops,
    })).rejects.toMatchObject({ code: "retailer_not_assigned_to_salesperson", status: 422 });
    expect(prisma.beatTemplate.create).not.toHaveBeenCalled();
  });

  it("refuses a salesperson editing a leader template", async () => {
    const prisma = fakePrisma();
    prisma.beatTemplate.findUnique.mockResolvedValue({ id: "beat-1", salespersonId: "staff-1", origin: "leader" });
    await expect(new RouteService(prisma).saveBeatTemplate({
      templateId: "beat-1", salespersonId: "staff-1", actorStaffId: "staff-1", origin: "self", name: "North", stops,
    })).rejects.toMatchObject({ code: "beat_template_not_found", status: 404 });
  });

  it("refuses to apply over an existing dated route", async () => {
    const prisma = fakePrisma();
    prisma.beatTemplate.findUnique.mockResolvedValue({ id: "beat-1", salespersonId: "staff-1", name: "North", stops });
    prisma.routePlan.findUnique.mockResolvedValue({ id: "plan-1" });
    await expect(new RouteService(prisma).applyBeatTemplate({
      templateId: "beat-1", salespersonId: "staff-1", actorStaffId: "manager-1", planDate: day("2026-10-01"),
      scopeStaffIds: ["staff-1"],
    })).rejects.toMatchObject({ code: "route_date_occupied", status: 409 });
    expect(prisma.routePlan.create).not.toHaveBeenCalled();
  });

  it("copies ordered stops into a draft without changing the template", async () => {
    const prisma = fakePrisma();
    prisma.beatTemplate.findUnique.mockResolvedValue({
      id: "beat-1", salespersonId: "staff-1", name: "North", stops: [
        { retailerId: "retailer-2", purpose: "service", note: "Call" },
        { retailerId: "retailer-1", purpose: "sales_call", note: null },
      ],
    });
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1", status: "active" });
    prisma.retailer.findMany.mockResolvedValue([{ id: "retailer-1" }, { id: "retailer-2" }]);
    prisma.routePlan.findUnique.mockResolvedValue(null);
    prisma.routePlan.create.mockResolvedValue({ id: "plan-2", status: "draft" });
    const plan = await new RouteService(prisma).applyBeatTemplate({
      templateId: "beat-1", salespersonId: "staff-1", actorStaffId: "manager-1", planDate: day("2026-10-01"),
      scopeStaffIds: ["staff-1"],
    });
    expect(plan).toMatchObject({ id: "plan-2", status: "draft" });
    expect(prisma.routePlan.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "draft", stops: { create: [
        expect.objectContaining({ retailerId: "retailer-2", sequence: 1, purpose: "service" }),
        expect.objectContaining({ retailerId: "retailer-1", sequence: 2, purpose: "sales_call" }),
      ] },
    }) });
    expect(prisma.beatTemplate.update).not.toHaveBeenCalled();
  });
});

describe("running a route", () => {
  it("locks the salesperson before a stop so plan replacement cannot erase a concurrent skip", async () => {
    const prisma = fakePrisma();
    prisma.routePlanStop.findUnique.mockResolvedValue({
      id: "stop-1", status: "pending", routePlan: { salespersonId: "staff-1" }, visits: [],
    });
    prisma.routePlanStop.update.mockResolvedValue({ id: "stop-1", status: "skipped" });
    await new RouteService(prisma).skipStop({ stopId: "stop-1", salespersonId: "staff-1", reason: "Shop shut" });
    const lockTargets = prisma.$queryRaw.mock.calls.map(([strings]: [TemplateStringsArray]) => strings.join(""));
    expect(lockTargets[0]).toContain('FROM "StaffUser"');
    expect(lockTargets[1]).toContain('FROM "RoutePlanStop"');
  });

  it("hides another salesperson's stop behind a not-found", async () => {
    const prisma = fakePrisma();
    prisma.routePlanStop.findUnique.mockResolvedValue({
      id: "stop-1",
      status: "pending",
      routePlan: { salespersonId: "staff-2" },
    });

    await expect(
      new RouteService(prisma).skipStop({
        stopId: "stop-1",
        salespersonId: "staff-1",
        reason: "Shop shut",
      })
    ).rejects.toMatchObject({ code: "route_stop_not_found", status: 404 });
  });

  it("requires a reason to skip a stop", async () => {
    const prisma = fakePrisma();
    await expect(
      new RouteService(prisma).skipStop({ stopId: "stop-1", salespersonId: "staff-1", reason: "  " })
    ).rejects.toMatchObject({ code: "skip_reason_required" });
  });

  it("will not skip a stop that was already visited", async () => {
    const prisma = fakePrisma();
    prisma.routePlanStop.findUnique.mockResolvedValue({
      id: "stop-1",
      status: "visited",
      routePlan: { salespersonId: "staff-1" },
    });
    await expect(
      new RouteService(prisma).skipStop({
        stopId: "stop-1",
        salespersonId: "staff-1",
        reason: "Shop shut",
      })
    ).rejects.toMatchObject({ code: "route_stop_already_settled" });
  });

  it("links the planned stop at check-in without counting the visit as complete", async () => {
    const prisma = fakePrisma();
    prisma.salesVisit.findUnique.mockResolvedValue({id:"visit-1",salespersonId:"staff-1",retailerId:"retailer-1",routeStopId:null});
    prisma.routePlanStop.findFirst.mockResolvedValue({
      id: "stop-1",
      purpose: "collection",
      sequence: 2,
    });
    prisma.routePlanStop.findUnique.mockResolvedValue({ id: "stop-1", status: "pending", visits: [] });

    const at = new Date("2026-03-10T11:00:00Z");
    const stop = await new RouteService(prisma).linkVisitToPlannedStop({
      visitId: "visit-1",
      salespersonId: "staff-1",
      retailerId: "retailer-1",
      at,
    });

    expect(stop).toMatchObject({ id: "stop-1" });
    expect(prisma.routePlanStop.updateMany).not.toHaveBeenCalled();
    expect(prisma.routePlanStop.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "pending", visits: { none: {} } }),
    }));
    // The visit inherits why the stop was planned, so an unplanned check-in and
    // a planned one are told apart later.
    expect(prisma.salesVisit.update).toHaveBeenCalledWith({
      where: { id: "visit-1" },
      data: { routeStopId: "stop-1", purpose: "collection" },
    });
  });

  it("leaves an unplanned visit alone", async () => {
    const prisma = fakePrisma();
    prisma.salesVisit.findUnique.mockResolvedValue({id:"visit-1",salespersonId:"staff-1",retailerId:"retailer-9",routeStopId:null});
    prisma.routePlanStop.findFirst.mockResolvedValue(null);

    const stop = await new RouteService(prisma).linkVisitToPlannedStop({
      visitId: "visit-1",
      salespersonId: "staff-1",
      retailerId: "retailer-9",
    });

    expect(stop).toBeNull();
    expect(prisma.salesVisit.update).not.toHaveBeenCalled();
  });

  it("reports progress and the next store for the day", async () => {
    const prisma = fakePrisma();
    prisma.routePlan.findUnique.mockResolvedValue({
      id: "plan-1",
      planDate: day("2026-03-10"),
      name: "Kothrud",
      status: "published",
      publishedAt: new Date(),
      completedAt: null,
      stops: [
        {
          id: "stop-1",
          sequence: 1,
          status: "visited",
          purpose: "sales_call",
          retailer: { id: "r1", name: "A", phone: "1", shopAddress: "x", location: null },
        },
        {
          id: "stop-2",
          sequence: 2,
          status: "pending",
          purpose: "collection",
          retailer: {
            id: "r2",
            name: "B",
            phone: "2",
            shopAddress: "y",
            location: { latitude: "18.5", longitude: "73.8", status: "VERIFIED" },
          },
        },
      ],
    });

    const route = await new RouteService(prisma).routeForDate("staff-1", day("2026-03-10"));
    expect(route?.progress).toMatchObject({ total: 2, visited: 1, pending: 1, completionPct: 50 });
    expect(route?.nextStop?.id).toBe("stop-2");
    expect(route?.nextStop?.retailer.latitude).toBe(18.5);
    expect(route?.stops[0].retailer.locationStatus).toBe("NOT_SET");
  });

  it("has no route when none was planned", async () => {
    const prisma = fakePrisma();
    prisma.routePlan.findUnique.mockResolvedValue(null);
    expect(await new RouteService(prisma).routeForDate("staff-1", day("2026-03-10"))).toBeNull();
  });
});
