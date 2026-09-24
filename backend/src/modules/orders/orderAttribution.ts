import { CommercialStatusCode, type PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type AttributionDb = Pick<PrismaClient, "salesRep">;

function punchedByName(order: any) {
  return order.commercialStatusEvents?.find(
    (event: any) => event.code === CommercialStatusCode.SALES_ORDER_PUNCHED
  )?.actorStaff?.name ?? null;
}

export function orderAttribution(order: any, legacyCreatorName?: string | null) {
  const isSalespersonOrder = order.placedBy === "rep";
  return {
    source: isSalespersonOrder ? "SALESPERSON_APP" : "RETAILER_APP",
    creatorName: isSalespersonOrder ? punchedByName(order) ?? legacyCreatorName ?? order.creatorName ?? null : null,
  };
}

export async function attributeOrders<T extends any[]>(orders: T, db: AttributionDb = prisma) {
  const needsLegacyName = orders.filter((order: any) =>
    order.placedBy === "rep" && !punchedByName(order) && !order.creatorName && order.placedByRepId
  );
  const reps = needsLegacyName.length
    ? await db.salesRep.findMany({
        where: { id: { in: [...new Set(needsLegacyName.map((order: any) => order.placedByRepId))] } },
        select: { id: true, name: true },
      })
    : [];
  const namesByRepId = new Map(reps.map((rep) => [rep.id, rep.name]));

  return orders.map((order: any) => {
    const { commercialStatusEvents: _events, placedByRepId: _repId, ...publicOrder } = order;
    return {
      ...publicOrder,
      ...orderAttribution(order, namesByRepId.get(order.placedByRepId) ?? null),
    };
  });
}
