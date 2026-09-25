import type { Prisma, PrismaClient } from "@prisma/client";
import { VALID_ORDER_STATUSES, round2 } from "./metricsDomain";
import { periodForDay } from "./period";
import type { FounderTeam, FounderTeamNode } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;

export class TeamService {
  constructor(private readonly db: Db) {}

  async getTeam(now = new Date()): Promise<FounderTeam> {
    const period = periodForDay(now);
    const [salespeople, orders] = await Promise.all([
      this.db.staffUser.findMany({
        where: { status: "active", roles: { some: { role: { name: "salesperson" } } } },
        select: { id: true, name: true, managerId: true, salesRepId: true, manager: { select: { id: true, name: true } } },
      }),
      this.db.order.findMany({
        where: {
          createdAt: { gte: period.start, lt: period.end },
          status: { in: [...VALID_ORDER_STATUSES] },
        },
        select: {
          orderTotal: true,
          retailerId: true,
          retailer: { select: { salesRepId: true } },
        },
      }),
    ]);

    const byRep = new Map<string, { value: number; retailers: Set<string> }>();
    for (const order of orders) {
      const salesRepId = order.retailer.salesRepId;
      if (!salesRepId) continue;
      const bucket = byRep.get(salesRepId) ?? { value: 0, retailers: new Set() };
      bucket.value = round2(bucket.value + Number(order.orderTotal));
      bucket.retailers.add(order.retailerId);
      byRep.set(salesRepId, bucket);
    }

    const managers = new Map<string, FounderTeamNode>();
    const unassigned: FounderTeamNode[] = [];
    for (const person of salespeople) {
      const stats = person.salesRepId ? byRep.get(person.salesRepId) : undefined;
      const node: FounderTeamNode = {
        id: person.id,
        name: person.name,
        role: "salesperson",
        orderValue: stats?.value ?? 0,
        activeRetailers: stats?.retailers.size ?? 0,
      };
      if (person.manager) {
        const manager = managers.get(person.manager.id) ?? {
          id: person.manager.id,
          name: person.manager.name,
          role: "manager",
          orderValue: 0,
          activeRetailers: 0,
          children: [],
        };
        manager.children = [...(manager.children ?? []), node];
        manager.orderValue = round2(manager.orderValue + node.orderValue);
        manager.activeRetailers += node.activeRetailers;
        managers.set(person.manager.id, manager);
      } else {
        unassigned.push(node);
      }
    }

    return {
      asOf: now.toISOString(),
      period: { start: period.start.toISOString(), end: period.end.toISOString(), label: period.label },
      nodes: [...managers.values(), ...unassigned],
    };
  }
}
