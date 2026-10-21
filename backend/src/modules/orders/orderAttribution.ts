import { CommercialStatusCode, type PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface ResolvedWarehouse {
  code: string;
  name: string;
  city: string;
  address?: string | null;
}

export const DEFAULT_WAREHOUSE: ResolvedWarehouse = {
  code: "WH-001",
  name: "Indore Central Fulfillment Hub",
  city: "Indore",
  address: "Plot 14-16, Sector B, Sanwer Road Industrial Area",
};

export const STATIC_WAREHOUSES: ResolvedWarehouse[] = [
  DEFAULT_WAREHOUSE,
  {
    code: "WH-002",
    name: "Bhopal Regional Hub",
    city: "Bhopal",
    address: "Govindpura Industrial Estate, Raisen Road",
  },
];

export function punchedByName(order: any): string | null {
  return (
    order.commercialStatusEvents?.find(
      (event: any) => event.code === CommercialStatusCode.SALES_ORDER_PUNCHED
    )?.actorStaff?.name ?? null
  );
}

export function resolveWarehouse(
  order: any,
  warehouses: ResolvedWarehouse[] = STATIC_WAREHOUSES,
  routings: Array<{ city: string; primaryWarehouseCode: string }> = [
    { city: "Indore", primaryWarehouseCode: "WH-001" },
    { city: "Ujjain", primaryWarehouseCode: "WH-001" },
    { city: "Dewas", primaryWarehouseCode: "WH-001" },
    { city: "Bhopal", primaryWarehouseCode: "WH-002" },
  ]
): ResolvedWarehouse {
  const deliveryCity = (order.retailer?.deliveryCity || "").trim().toLowerCase();
  const shopAddress = (order.retailer?.shopAddress || "").toLowerCase();
  const destination = (order.commercialSnapshot?.routing?.destinationCity || "").toLowerCase();

  // 1. Explicit warehouseCode on order or delivery
  const explicitCode = order.warehouseCode || order.delivery?.warehouseCode;
  if (explicitCode) {
    const matched = warehouses.find((w) => w.code.toLowerCase() === String(explicitCode).toLowerCase());
    if (matched) return matched;
  }

  // 2. City routing match
  if (deliveryCity) {
    const matchedRouting = routings.find((r) => r.city.trim().toLowerCase() === deliveryCity);
    if (matchedRouting) {
      const wh = warehouses.find((w) => w.code.toLowerCase() === matchedRouting.primaryWarehouseCode.toLowerCase());
      if (wh) return wh;
    }
  }

  // 3. Address / destination match
  const matchedCity = warehouses.find((w) => {
    const c = w.city.toLowerCase();
    return (
      (deliveryCity && deliveryCity.includes(c)) ||
      (destination && destination.includes(c)) ||
      (shopAddress && shopAddress.includes(c))
    );
  });
  if (matchedCity) return matchedCity;

  // 4. Fallback to default
  return warehouses.find((w) => w.code === DEFAULT_WAREHOUSE.code) || warehouses[0] || DEFAULT_WAREHOUSE;
}

export function orderAttribution(order: any, legacyCreatorName?: string | null) {
  const isSalespersonOrder = order.placedBy === "rep";
  const punchActor = punchedByName(order);
  const repName = punchActor ?? legacyCreatorName ?? order.retailer?.salesRep?.name ?? order.creatorName ?? null;

  const salespersonName = isSalespersonOrder
    ? (repName || "Field Sales Rep")
    : (order.retailer?.salesRep?.name || null);

  const punchedByNameResolved = isSalespersonOrder
    ? (repName || "Field Sales Rep")
    : (order.retailer?.name || "Retailer Direct");

  const punchedByRole = isSalespersonOrder ? "Salesperson" : "Retailer";

  const punchedByLabel = isSalespersonOrder
    ? `Punched by Sales Rep: ${salespersonName || "Sales Rep"}`
    : salespersonName
    ? `Placed by Retailer: ${order.retailer?.name ?? "Customer"} (Assigned Rep: ${salespersonName})`
    : `Placed by Retailer: ${order.retailer?.name ?? "Customer"} (Direct)`;

  return {
    source: isSalespersonOrder ? "SALESPERSON_APP" : "RETAILER_APP",
    creatorName: isSalespersonOrder ? punchActor ?? legacyCreatorName ?? order.creatorName ?? null : null,
    salespersonName,
    salespersonPhone: order.retailer?.salesRep?.phone ?? null,
    punchedByName: punchedByNameResolved,
    punchedByRole,
    punchedByLabel,
  };
}

export async function attributeOrders<T extends any[]>(orders: T, db: any = prisma) {
  const { attributed } = await attributeOrdersWithWarehouses(orders, db);
  return attributed;
}

export function enrichOrderItems(items: any[], order?: any) {
  return (items ?? []).map((item: any) => {
    const caseWeightKg = Number(
      item.caseWeightKg ??
      item.caseWeightKgSnapshot ??
      (item.variant ? Number(item.variant.unitWeightKg ?? 0) * (item.variant.unitsPerCase ?? 1) : 0)
    );
    const unitPrice = Number(item.unitPrice ?? 0);

    const quoteLines = order?.commercialSnapshot?.quote?.lines || order?.commercialSnapshot?.lines;
    const quoteLine = Array.isArray(quoteLines)
      ? quoteLines.find((l: any) => l.variantId === item.variantId || l.variantId === item.variant?.id)
      : null;

    const snapshotRateBasis = item.commercialSnapshot?.rateBasis || quoteLine?.rateBasis;
    const snapshotRate = item.commercialSnapshot?.rate != null
      ? Number(item.commercialSnapshot.rate)
      : (quoteLine?.rate != null ? Number(quoteLine.rate) : null);

    const variantRateBasis = item.variant?.listRateBasis || item.variant?.priceList?.find((p: any) => p.rateBasis === "quintal")?.rateBasis;

    const isBox = (item.variant?.catalogIdentityMasterPack && String(item.variant.catalogIdentityMasterPack).toUpperCase().includes("BOX")) ||
      (item.variant?.product?.category && (String(item.variant.product.category).toLowerCase().includes("breakfast") || String(item.variant.product.category).toLowerCase().includes("mix")));
    const outerPack: "Bag" | "Box" = isBox ? "Box" : "Bag";

    const isQuintal =
      String(snapshotRateBasis || "").toLowerCase() === "quintal" ||
      String(variantRateBasis || "").toLowerCase() === "quintal" ||
      item.commercialSnapshot?.quintals != null ||
      (caseWeightKg >= 20 && !isBox);

    const rateBasis: "quintal" | "case" = isQuintal ? "quintal" : "case";

    let ratePerQuintal: number | null = null;
    if (snapshotRate != null && isQuintal) {
      ratePerQuintal = snapshotRate;
    } else if (item.variant?.listRateBasis === "quintal" && item.variant?.listRate != null) {
      ratePerQuintal = Number(item.variant.listRate);
    } else if (isQuintal && caseWeightKg > 0) {
      ratePerQuintal = Math.round((unitPrice / caseWeightKg) * 100 * 100) / 100;
    }

    const ratePerKg = ratePerQuintal != null
      ? Math.round((ratePerQuintal / 100) * 100) / 100
      : (caseWeightKg > 0 ? Math.round((unitPrice / caseWeightKg) * 100) / 100 : null);

    return {
      ...item,
      qtyOrdered: item.qtyOrdered,
      unitPrice,
      caseWeightKg,
      rateBasis,
      commercialRate: isQuintal ? (ratePerQuintal ?? unitPrice) : unitPrice,
      ratePerQuintal,
      ratePerKg,
      outerPack,
      rateLabel: isQuintal && ratePerQuintal != null
        ? `₹${ratePerQuintal.toLocaleString("en-IN")} / quintal`
        : `₹${unitPrice.toLocaleString("en-IN")} / ${outerPack.toLowerCase()}`,
    };
  });
}

export async function attributeOrdersWithWarehouses<T extends any[]>(orders: T, db: any = prisma) {
  // Batch resolve any missing sales rep names for legacy rep orders
  const needsLegacyName = orders.filter(
    (order: any) =>
      order.placedBy === "rep" && !punchedByName(order) && !order.creatorName && order.placedByRepId
  );

  let reps: Array<{ id: string; name: string }> = [];
  if (needsLegacyName.length && db?.salesRep?.findMany) {
    try {
      reps = await db.salesRep.findMany({
        where: { id: { in: [...new Set(needsLegacyName.map((order: any) => order.placedByRepId))] } },
        select: { id: true, name: true },
      });
    } catch {
      reps = [];
    }
  }
  const namesByRepId = new Map(reps.map((rep) => [rep.id, rep.name]));

  // Load warehouses & city routing if available
  let warehouses: ResolvedWarehouse[] = STATIC_WAREHOUSES;
  let routings: Array<{ city: string; primaryWarehouseCode: string }> = [];

  if (db?.warehouse?.findMany) {
    try {
      const dbWarehouses = await db.warehouse.findMany({
        where: { isActive: true },
        select: { code: true, name: true, city: true, address: true },
      });
      if (Array.isArray(dbWarehouses) && dbWarehouses.length > 0) {
        warehouses = dbWarehouses;
      }
    } catch {}
  }

  if (db?.cityRouting?.findMany) {
    try {
      const dbRoutings = await db.cityRouting.findMany({
        where: { isActive: true },
        select: { city: true, primaryWarehouseCode: true },
      });
      if (Array.isArray(dbRoutings) && dbRoutings.length > 0) {
        routings = dbRoutings;
      }
    } catch {}
  }

  const attributed = orders.map((order: any) => {
    const { commercialStatusEvents: _events, ...publicOrder } = order;
    const attribution = orderAttribution(order, namesByRepId.get(order.placedByRepId) ?? null);
    const wh = resolveWarehouse(order, warehouses, routings);
    const items = Array.isArray(publicOrder.items) ? enrichOrderItems(publicOrder.items, order) : publicOrder.items;

    return {
      ...publicOrder,
      ...attribution,
      items,
      warehouseCode: wh.code,
      warehouseName: wh.name,
      warehouseCity: wh.city,
      warehouse: wh,
    };
  });

  return { attributed, warehouses };
}
