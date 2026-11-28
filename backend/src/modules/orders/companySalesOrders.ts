import { Prisma, SalesOrderCompany } from "@prisma/client";
import { z } from "zod";
import type { CommercialSnapshot } from "../commercial/service";

export class CompanySalesOrderError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export const companyOrderSummary = {
  select: {
    id: true,
    company: true,
    reference: true,
    deliveryCity: true,
    deliveryAddress: true,
    routeId: true,
    dispatchedAt: true,
    deliveredAt: true,
    deliveryResolvedAt: true,
    podCapturedAt: true,
    sapSalesOrderId: true,
    sapSyncStatus: true,
  },
  orderBy: { company: "asc" as const },
};

export function promotionLine(snapshot: Prisma.JsonValue | null) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || snapshot.isFreeItem !== true) return null;
  return snapshot;
}

export async function createCompanySalesOrders(
  tx: Prisma.TransactionClient,
  order: { id: string; items: { id: string; variantId: string; commercialSnapshot: Prisma.JsonValue | null }[] },
  reference: string,
  routing: NonNullable<CommercialSnapshot["routing"]> & { deliveryAddress: string },
) {
  const companyByVariant = new Map(routing.lines.map(line => [line.variantId, line.entity]));
  const itemIdsByCompany = new Map<SalesOrderCompany, string[]>();
  for (const item of order.items) {
    const promotion = promotionLine(item.commercialSnapshot);
    const promotionCompany = promotion?.fulfillingCompany;
    const company = routing.destination === "INDORE_CITY"
      ? "jain_traders"
      : promotionCompany === "jain_traders" || promotionCompany === "padam_international"
        ? promotionCompany
        : companyByVariant.get(item.variantId);
    if (!company) {
      if (!promotion) throw new CompanySalesOrderError("company_order_line_unassigned");
      continue;
    }
    const ids = itemIdsByCompany.get(company) ?? [];
    ids.push(item.id);
    itemIdsByCompany.set(company, ids);
  }

  for (const [company, itemIds] of itemIdsByCompany) {
    const document = await tx.companySalesOrder.create({
      data: {
        orderId: order.id,
        company,
        reference: `${reference}-${company === "jain_traders" ? "JT" : "PI"}`,
        deliveryCity: routing.destinationCity,
        deliveryAddress: routing.deliveryAddress,
      },
    });
    await tx.orderItem.updateMany({
      where: { orderId: order.id, id: { in: itemIds } },
      data: { companySalesOrderId: document.id },
    });
  }
}

export const dispatchAssignmentSchema = z.object({
  routeId: z.string().trim().min(1).optional(),
  companyRoutes: z.array(z.object({
    companySalesOrderId: z.string().min(1),
    routeId: z.string().trim().min(1),
  })).min(1).max(2).optional(),
  deliverySlot: z.string().datetime().optional(),
}).refine(input => Boolean(input.routeId) !== Boolean(input.companyRoutes));

export async function assignCompanyDispatch(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: z.infer<typeof dispatchAssignmentSchema>,
  dispatchedAt: Date,
) {
  const companyOrders = await tx.companySalesOrder.findMany({ where: { orderId }, select: { id: true } });
  if (!companyOrders.length) {
    if (!input.routeId) throw new CompanySalesOrderError("dispatch_route_required");
    return input.routeId;
  }
  if (await tx.orderItem.count({ where: { orderId, companySalesOrderId: null } })) {
    throw new CompanySalesOrderError("company_order_line_unassigned");
  }
  const companyRoutes = input.companyRoutes ?? (companyOrders.length === 1 && input.routeId
    ? [{ companySalesOrderId: companyOrders[0].id, routeId: input.routeId }]
    : []);
  const byId = new Map(companyRoutes.map(route => [route.companySalesOrderId, route.routeId]));
  if (companyRoutes.length !== companyOrders.length || companyOrders.some(order => !byId.has(order.id))) {
    throw new CompanySalesOrderError("company_dispatch_routes_required");
  }
  for (const companyOrder of companyOrders) {
    await tx.companySalesOrder.update({
      where: { id: companyOrder.id },
      data: { routeId: byId.get(companyOrder.id)!, dispatchedAt },
    });
  }
  const routes = [...new Set(byId.values())];
  return routes.length === 1 ? routes[0] : null;
}
