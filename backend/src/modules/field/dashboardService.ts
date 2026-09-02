import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { distanceBetweenMeters } from "../location/locationDomain";
import { AttendanceService } from "./attendanceService";
import { RouteService } from "./routeService";
import { ActivityService } from "./activityService";
import { TaskService } from "./taskService";
import { TrackingService } from "./trackingService";
import {
  compareTargets,
  endOfDay,
  eachDay,
  isProductiveVisit,
  startOfDay,
  workedMinutes,
} from "./fieldDomain";
import { buildPerformanceVisuals } from "./performanceVisuals";

type Db = PrismaClient | any;

export interface PeriodInput {
  from: Date;
  to: Date;
}

function money(value: unknown): number {
  return value == null ? 0 : Number(value);
}

/**
 * Read-side aggregation for the salesperson's Today screen, performance
 * dashboard and activity timeline.
 *
 * Every number here is computed from canonical rows — orders, visits,
 * collection submissions, workday sessions. A metric with no source data is
 * reported as zero for counts, or omitted entirely (targets), never invented.
 */
export class FieldDashboardService {
  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly attendance = new AttendanceService(prisma ?? defaultPrisma),
    private readonly routes = new RouteService(prisma ?? defaultPrisma),
    private readonly activities = new ActivityService(prisma ?? defaultPrisma),
    private readonly tasks = new TaskService(prisma ?? defaultPrisma),
    private readonly tracking = new TrackingService(prisma ?? defaultPrisma)
  ) {}

  private async salesRepIdFor(salespersonId: string): Promise<string | null> {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: salespersonId },
      select: { salesRepId: true },
    });
    return staff?.salesRepId ?? null;
  }

  /** Counts for one window, from the canonical order/visit/collection rows. */
  async metricsFor(input: { salespersonId: string; from: Date; to: Date }) {
    const salesRepId = await this.salesRepIdFor(input.salespersonId);
    const range = { gte: input.from, lte: input.to };

    const [visits, orders, collections, newCustomers, workdays] = await Promise.all([
      this.prisma.salesVisit.findMany({
        where: { salespersonId: input.salespersonId, checkedInAt: range },
        select: {
          id: true,
          retailerId: true,
          outcome: true,
          checkedOutAt: true,
          activities: { select: { type: true } },
        },
      }),
      salesRepId
        ? this.prisma.order.findMany({
            where: { placedByRepId: salesRepId, placedBy: "rep", createdAt: range },
            select: { id: true, orderTotal: true, status: true, retailerId: true },
          })
        : Promise.resolve([]),
      this.prisma.collectionSubmission.findMany({
        where: { collectorStaffId: input.salespersonId, submittedAt: range },
        select: { id: true, amount: true, status: true },
      }),
      salesRepId
        ? this.prisma.retailer.count({ where: { salesRepId, createdAt: range } })
        : Promise.resolve(0),
      this.prisma.workdaySession.findMany({
        where: { salespersonId: input.salespersonId, startedAt: range },
        select: { workedMinutes: true, startedAt: true, endedAt: true, status: true },
      }),
    ]);

    const productiveVisits = visits.filter((visit: any) =>
      isProductiveVisit({
        outcome: visit.outcome,
        activityTypes: visit.activities.map((activity: any) => activity.type),
      })
    ).length;

    const confirmedCollections = collections.filter((row: any) => row.status === "confirmed");

    return {
      visits: visits.length,
      productiveVisits,
      customersCovered: new Set(visits.map((visit: any) => visit.retailerId)).size,
      orders: orders.length,
      orderValue: orders.reduce((sum: number, order: any) => sum + money(order.orderTotal), 0),
      rejectedOrders: orders.filter((order: any) => order.status === "rejected").length,
      collectionsSubmitted: collections.length,
      // Submitted value is what the salesperson did; confirmed value is what
      // Accounts has actually accepted. Both are shown so the salesperson can
      // see the difference rather than assuming submission is settlement.
      collectionValueSubmitted: collections.reduce((sum: number, row: any) => sum + money(row.amount), 0),
      collectionValueConfirmed: confirmedCollections.reduce(
        (sum: number, row: any) => sum + money(row.amount),
        0
      ),
      newCustomers,
      daysWorked: workdays.length,
      minutesWorked: workdays.reduce(
        (sum: number, day: any) =>
          sum + (day.workedMinutes ?? (day.endedAt ? workedMinutes(day.startedAt, day.endedAt) : 0)),
        0
      ),
    };
  }

  private async targetsFor(input: { salespersonId: string; from: Date; to: Date }) {
    return this.prisma.salesTarget.findMany({
      where: {
        salespersonId: input.salespersonId,
        periodStart: { lte: startOfDay(input.to) },
        periodEnd: { gte: startOfDay(input.from) },
      },
    });
  }

  /** Everything the Today screen needs, in one round trip. */
  async today(input: { salespersonId: string; now?: Date }) {
    const now = input.now ?? new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = endOfDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));

    const [session, tracking, route, tasks, metrics, followUps, receivables, monthMetrics, targets] =
      await Promise.all([
        this.attendance.openSession(input.salespersonId),
        this.tracking.state({ salespersonId: input.salespersonId }),
        this.routes.routeForDate(input.salespersonId, now),
        this.tasks.forSalesperson({ salespersonId: input.salespersonId, limit: 20 }),
        this.metricsFor({ salespersonId: input.salespersonId, from: dayStart, to: dayEnd }),
        this.activities.openFollowUps(input.salespersonId, dayEnd),
        this.pendingCollections(input.salespersonId),
        this.metricsFor({ salespersonId: input.salespersonId, from: monthStart, to: monthEnd }),
        this.targetsFor({ salespersonId: input.salespersonId, from: monthStart, to: monthEnd }),
      ]);

    const attendanceForDay = await this.attendance.attendanceHistory({
      salespersonId: input.salespersonId,
      from: dayStart,
      to: dayStart,
      today: now,
    });

    return {
      date: dayStart.toISOString().slice(0, 10),
      attendance: {
        mark: attendanceForDay[0]?.mark ?? "absent",
        sessionId: session?.id ?? null,
        startedAt: session?.startedAt ?? null,
        // Elapsed time is computed on read while the day is open, so the
        // client does not have to keep a running total.
        minutesSoFar: session ? workedMinutes(session.startedAt, now) : attendanceForDay[0]?.workedMinutes ?? null,
        status: session ? "open" : attendanceForDay[0]?.startedAt ? "closed" : "not_started",
      },
      tracking,
      route,
      tasks: tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueAt: task.dueAt,
        overdue: task.dueAt != null && task.dueAt < now,
        retailer: task.retailer,
      })),
      followUps: followUps.map((activity: any) => ({
        id: activity.id,
        retailer: activity.retailer,
        type: activity.type,
        notes: activity.notes,
        followUpAt: activity.followUpAt,
      })),
      pendingCollections: receivables,
      todayMetrics: metrics,
      monthMetrics,
      targets: compareTargets(
        targets.map((target: any) => ({
          metric: target.metric,
          targetValue: money(target.targetValue),
        })),
        {
          order_value: monthMetrics.orderValue,
          visits: monthMetrics.visits,
          collection_value: monthMetrics.collectionValueConfirmed,
          new_customers: monthMetrics.newCustomers,
        }
      ),
    };
  }

  /**
   * Receivables the salesperson is expected to chase, read from the stored
   * per-retailer overdue position. The salesperson never edits these numbers —
   * finance owns them.
   */
  async pendingCollections(salespersonId: string) {
    const salesRepId = await this.salesRepIdFor(salespersonId);
    if (!salesRepId) return { retailers: [], totalOverdue: 0, totalOutstanding: 0 };
    const retailers = await this.prisma.retailer.findMany({
      where: { salesRepId, overdueAmount: { gt: 0 } },
      select: {
        id: true,
        name: true,
        phone: true,
        shopAddress: true,
        overdueAmount: true,
        currentBalance: true,
      },
      orderBy: { overdueAmount: "desc" },
      take: 25,
    });
    return {
      retailers: retailers.map((retailer: any) => ({
        id: retailer.id,
        name: retailer.name,
        phone: retailer.phone,
        shopAddress: retailer.shopAddress,
        overdue: money(retailer.overdueAmount),
        outstanding: money(retailer.currentBalance),
      })),
      totalOverdue: retailers.reduce((sum: number, r: any) => sum + money(r.overdueAmount), 0),
      totalOutstanding: retailers.reduce((sum: number, r: any) => sum + money(r.currentBalance), 0),
    };
  }

  /** Today plus a chosen period, with target comparison for the period. */
  async performance(input: { salespersonId: string; from: Date; to: Date; now?: Date }) {
    const now = input.now ?? new Date();
    const [today, period, targets, visuals] = await Promise.all([
      this.metricsFor({ salespersonId: input.salespersonId, from: startOfDay(now), to: endOfDay(now) }),
      this.metricsFor({ salespersonId: input.salespersonId, from: input.from, to: input.to }),
      this.targetsFor({ salespersonId: input.salespersonId, from: input.from, to: input.to }),
      this.performanceVisuals({ salespersonId: input.salespersonId, from: input.from, to: input.to }),
    ]);
    const attendance = await this.attendance.attendanceHistory({
      salespersonId: input.salespersonId,
      from: input.from,
      to: input.to,
      today: now,
    });
    return {
      today,
      period: {
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        ...period,
        attendance: {
          present: attendance.filter((day) => day.mark === "present").length,
          leave: attendance.filter((day) => day.mark === "leave").length,
          absent: attendance.filter((day) => day.mark === "absent").length,
          workingDays: attendance.filter((day) => day.mark !== "holiday" && day.mark !== "not_due").length,
        },
      },
      targets: compareTargets(
        targets.map((target: any) => ({ metric: target.metric, targetValue: money(target.targetValue) })),
        {
          order_value: period.orderValue,
          visits: period.visits,
          collection_value: period.collectionValueConfirmed,
          new_customers: period.newCustomers,
        }
      ),
      visuals,
    };
  }

  /** One bounded read model for the Activity > Performance visuals. */
  private async performanceVisuals(input: { salespersonId: string; from: Date; to: Date }) {
    const salesRepId = await this.salesRepIdFor(input.salespersonId);
    const range = { gte: input.from, lte: input.to };
    const [orders, visits, collections, routeCompletionTrend] = await Promise.all([
      salesRepId
        ? this.prisma.order.findMany({
            where: { placedByRepId: salesRepId, placedBy: "rep", createdAt: range },
            select: {
              createdAt: true,
              orderTotal: true,
              items: { select: { variant: { select: { product: { select: { category: true } } } } } },
            },
          })
        : Promise.resolve([]),
      this.prisma.salesVisit.findMany({
        where: { salespersonId: input.salespersonId, checkedInAt: range },
        select: { checkedInAt: true, outcome: true, activities: { select: { type: true } } },
      }),
      this.prisma.collectionSubmission.findMany({
        where: { collectorStaffId: input.salespersonId, submittedAt: range },
        select: { submittedAt: true, amount: true, status: true },
      }),
      typeof this.routes.routeHistory === "function"
        ? this.routes.routeHistory(input.salespersonId, input.from, input.to)
        : Promise.resolve([]),
    ]);
    return buildPerformanceVisuals({
      from: input.from,
      to: input.to,
      orders: (orders as any[]).map((order) => ({
        createdAt: order.createdAt,
        orderTotal: money(order.orderTotal),
        categories: order.items.map((item: any) => item.variant.product.category),
      })),
      visits: (visits as any[]).map((visit) => ({
        checkedInAt: visit.checkedInAt,
        outcome: visit.outcome,
        activityTypes: visit.activities.map((activity: any) => activity.type),
      })),
      collections: (collections as any[]).map((collection) => ({
        submittedAt: collection.submittedAt,
        amount: money(collection.amount),
        status: collection.status,
      })),
      routeCompletionTrend: (routeCompletionTrend as any[]).map((plan) => ({
        date: plan.planDate,
        completionPct: plan.progress.completionPct,
      })),
    });
  }

  /**
   * The salesperson's own chronological history, projected from canonical rows.
   * Nothing is duplicated into a timeline table — this is a read of what
   * already happened.
   */
  async activityFeed(input: { salespersonId: string; from: Date; to: Date; limit?: number }) {
    const salesRepId = await this.salesRepIdFor(input.salespersonId);
    const range = { gte: input.from, lte: input.to };

    const [workdays, visits, activities, orders, collections, tasks, expenses, issues] =
      await Promise.all([
        this.prisma.workdaySession.findMany({
          where: { salespersonId: input.salespersonId, startedAt: range },
          select: { id: true, startedAt: true, endedAt: true, workedMinutes: true },
        }),
        this.prisma.salesVisit.findMany({
          where: { salespersonId: input.salespersonId, checkedInAt: range },
          select: {
            id: true,
            checkedInAt: true,
            checkedOutAt: true,
            outcome: true,
            verificationStatus: true,
            retailer: { select: { id: true, name: true } },
          },
        }),
        this.prisma.customerActivity.findMany({
          where: { salespersonId: input.salespersonId, occurredAt: range },
          select: {
            id: true,
            occurredAt: true,
            type: true,
            notes: true,
            retailer: { select: { id: true, name: true } },
          },
        }),
        salesRepId
          ? this.prisma.order.findMany({
              where: { placedByRepId: salesRepId, placedBy: "rep", createdAt: range },
              select: {
                id: true,
                orderNo: true,
                createdAt: true,
                orderTotal: true,
                status: true,
                retailer: { select: { id: true, name: true } },
              },
            })
          : Promise.resolve([]),
        this.prisma.collectionSubmission.findMany({
          where: { collectorStaffId: input.salespersonId, submittedAt: range },
          select: {
            id: true,
            submittedAt: true,
            amount: true,
            method: true,
            status: true,
            retailer: { select: { id: true, name: true } },
          },
        }),
        this.prisma.fieldTask.findMany({
          where: { assignedToStaffId: input.salespersonId, completedAt: range },
          select: { id: true, title: true, completedAt: true },
        }),
        this.prisma.fieldExpense.findMany({
          where: { salespersonId: input.salespersonId, submittedAt: range },
          select: { id: true, submittedAt: true, amount: true, category: true, status: true },
        }),
        this.prisma.serviceIssue.findMany({
          where: { raisedByStaffId: input.salespersonId, createdAt: range },
          select: {
            id: true,
            createdAt: true,
            type: true,
            status: true,
            retailer: { select: { id: true, name: true } },
          },
        }),
      ]);

    const entries: Array<{
      id: string;
      kind: string;
      at: Date;
      title: string;
      detail: string | null;
      retailer: { id: string; name: string } | null;
      amount: number | null;
    }> = [];

    for (const day of workdays) {
      entries.push({
        id: `workday-start-${day.id}`,
        kind: "workday_started",
        at: day.startedAt,
        title: "Day started",
        detail: null,
        retailer: null,
        amount: null,
      });
      if (day.endedAt) {
        entries.push({
          id: `workday-end-${day.id}`,
          kind: "workday_ended",
          at: day.endedAt,
          title: "Day ended",
          detail: day.workedMinutes != null ? `${day.workedMinutes} minutes worked` : null,
          retailer: null,
          amount: null,
        });
      }
    }
    for (const visit of visits) {
      entries.push({
        id: `visit-${visit.id}`,
        kind: "visit",
        at: visit.checkedInAt,
        title: "Visit",
        detail: visit.outcome ?? visit.verificationStatus,
        retailer: visit.retailer,
        amount: null,
      });
    }
    for (const activity of activities) {
      entries.push({
        id: `activity-${activity.id}`,
        kind: "activity",
        at: activity.occurredAt,
        title: activity.type,
        detail: activity.notes,
        retailer: activity.retailer,
        amount: null,
      });
    }
    for (const order of orders) {
      entries.push({
        id: `order-${order.id}`,
        kind: "order",
        at: order.createdAt,
        title: `Order GGN-${String(order.orderNo).padStart(8, "0")}`,
        detail: order.status,
        retailer: order.retailer,
        amount: money(order.orderTotal),
      });
    }
    for (const collection of collections) {
      entries.push({
        id: `collection-${collection.id}`,
        kind: "collection",
        at: collection.submittedAt,
        title: "Collection submitted",
        detail: `${collection.method} · ${collection.status}`,
        retailer: collection.retailer,
        amount: money(collection.amount),
      });
    }
    for (const task of tasks) {
      entries.push({
        id: `task-${task.id}`,
        kind: "task_completed",
        at: task.completedAt!,
        title: "Task completed",
        detail: task.title,
        retailer: null,
        amount: null,
      });
    }
    for (const expense of expenses) {
      entries.push({
        id: `expense-${expense.id}`,
        kind: "expense",
        at: expense.submittedAt,
        title: "Expense submitted",
        detail: `${expense.category} · ${expense.status}`,
        retailer: null,
        amount: money(expense.amount),
      });
    }
    for (const issue of issues) {
      entries.push({
        id: `issue-${issue.id}`,
        kind: "service_issue",
        at: issue.createdAt,
        title: "Service issue raised",
        detail: `${issue.type} · ${issue.status}`,
        retailer: issue.retailer,
        amount: null,
      });
    }

    return entries
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, Math.min(input.limit ?? 120, 300));
  }

  /**
   * Assigned customers with their geotag state, optionally ordered by how far
   * they are from a supplied position. The payload is provider-neutral: it is
   * plain coordinates, so it can back a list, a native map, or a navigation
   * hand-off without this service knowing which.
   */
  async customerMap(input: {
    salespersonId: string;
    origin?: { latitude: number; longitude: number } | null;
  }) {
    const salesRepId = await this.salesRepIdFor(input.salespersonId);
    if (!salesRepId) return { customers: [], geotagged: 0, missingGeotag: 0 };
    const retailers = await this.prisma.retailer.findMany({
      where: { salesRepId },
      select: {
        id: true,
        name: true,
        phone: true,
        shopAddress: true,
        overdueAmount: true,
        location: { select: { latitude: true, longitude: true, status: true } },
      },
      orderBy: { name: "asc" },
    });

    const customers = retailers.map((retailer: any) => {
      const latitude = retailer.location?.latitude == null ? null : Number(retailer.location.latitude);
      const longitude = retailer.location?.longitude == null ? null : Number(retailer.location.longitude);
      const distanceMeters =
        input.origin && latitude != null && longitude != null
          ? Math.round(distanceBetweenMeters(input.origin, { latitude, longitude }))
          : null;
      return {
        id: retailer.id,
        name: retailer.name,
        phone: retailer.phone,
        shopAddress: retailer.shopAddress,
        overdue: money(retailer.overdueAmount),
        latitude,
        longitude,
        locationStatus: retailer.location?.status ?? "NOT_SET",
        distanceMeters,
      };
    });

    if (input.origin) {
      customers.sort((a: any, b: any) => {
        if (a.distanceMeters == null && b.distanceMeters == null) return a.name.localeCompare(b.name);
        if (a.distanceMeters == null) return 1;
        if (b.distanceMeters == null) return -1;
        return a.distanceMeters - b.distanceMeters;
      });
    }

    return {
      customers,
      geotagged: customers.filter((c: any) => c.latitude != null && c.longitude != null).length,
      missingGeotag: customers.filter((c: any) => c.latitude == null || c.longitude == null).length,
    };
  }
}

export const defaultFieldDashboardService = new FieldDashboardService();
