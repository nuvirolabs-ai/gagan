import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { calculateCommercialQuote, CommercialQuoteLine, ManagerFreight } from "../../lib/commercialQuote";
import { resolveSalesOrderAllocation, RoutingPolicyError, SalesOrderRoutingPlan } from "./routing";

export type CommercialSnapshot = ReturnType<typeof calculateCommercialQuote> & { routing?: SalesOrderRoutingPlan };
export class CommercialError extends Error { constructor(public code: string, public status = 409, public details?: unknown) { super(code); } }
export const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function snapshot(value: Prisma.JsonValue | null): CommercialSnapshot | null {
  return value === null ? null : value as unknown as CommercialSnapshot;
}
export function quoteDelivery(accepted:CommercialSnapshot, resolutions:{variantId:string;cases:number;weightKg?:number}[]) {
  if(resolutions.length!==accepted.lines.length || new Set(resolutions.map(l=>l.variantId)).size!==resolutions.length) throw new CommercialError("incomplete_delivery_resolution",400);
  const next = calculateCommercialQuote({lines:accepted.lines.map(line=>{
    const resolution=resolutions.find(r=>r.variantId===line.variantId);
    if(!resolution || !Number.isSafeInteger(resolution.cases) || resolution.cases<0 || (resolution.weightKg!==undefined && (!Number.isFinite(resolution.weightKg) || resolution.weightKg<0 || new Prisma.Decimal(resolution.weightKg).decimalPlaces()>3))) throw new CommercialError("invalid_delivery_resolution",400);
    return {...line,cases:resolution.cases,deliveredWeightKg:resolution.weightKg===undefined?new Prisma.Decimal(line.caseWeightKg).mul(resolution.cases).toString():String(resolution.weightKg)};
  }),freight:accepted.freight ?? undefined});
  return accepted.routing ? { ...next, routing: accepted.routing } : next;
}
export function normalizedLines(items: {variantId: string; qty: number}[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.variantId || !Number.isSafeInteger(item.qty) || item.qty <= 0) throw new CommercialError("invalid_order_items",400);
    const qty = (map.get(item.variantId) ?? 0) + item.qty;
    if (qty > 2147483647) throw new CommercialError("invalid_order_items",400);
    map.set(item.variantId, qty);
  }
  if (!map.size) throw new CommercialError("invalid_order_items",400);
  return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([variantId,qty])=>({variantId,qty}));
}

export async function quoteFor(retailerId: string, input: {variantId:string;qty:number}[]) {
  const items = normalizedLines(input);
  return prisma.$transaction(async tx => {
    const retailer = await tx.retailer.findUniqueOrThrow({where:{id:retailerId}});
    const ids = items.map(i=>i.variantId);
    const [variants, prices, overrides] = await Promise.all([
      tx.variant.findMany({
        where: { id: { in: ids }, catalogStatus: "active", product: { catalogStatus: "active" } },
        include: { product: true },
      }),
      tx.priceList.findMany({where:{tierId:retailer.tierId,variantId:{in:ids}}}),
      tx.priceOverride.findMany({where:{retailerId,variantId:{in:ids}}}),
    ]);
    if (variants.length !== ids.length) throw new CommercialError("catalog_item_not_orderable",409);
    // Unconfigured legacy carts retain their established case-price contract.
    // A routed SKU explicitly opts the cart into the new policy. A stored
    // proposal delivery city alone must not break an older static commercial
    // catalog; the router still fails closed if routed SKUs lack a city.
    const routingRequested = variants.some(v => v.routingClass !== null);
    if (variants.every(v=>v.sellingEntity === null) && !routingRequested) return null;
    let routing: SalesOrderRoutingPlan | undefined;
    if (routingRequested) {
      try {
        routing = resolveSalesOrderAllocation({
          destinationCity: retailer.deliveryCity,
          lines: items.map(item => {
            const variant = variants.find(v => v.id === item.variantId)!;
            return {
              variantId: variant.id,
              quantity: item.qty,
              routingClass: variant.routingClass,
              routingBagEquivalent: variant.routingBagEquivalent,
              caseWeightKg: variant.unitWeightKg.mul(variant.unitsPerCase),
            };
          }),
        });
      } catch (error) {
        if (error instanceof RoutingPolicyError) throw new CommercialError(error.code, 422, error.details);
        throw error;
      }
    }
    const routedEntity = new Map(routing?.lines.map(line => [line.variantId, line.entity]));
    const lines: CommercialQuoteLine[] = items.map(item=>{
      const v = variants.find(v=>v.id===item.variantId)!;
      const selectedEntity = routedEntity.get(v.id) ?? v.sellingEntity;
      if (!selectedEntity) throw new CommercialError("sku_commercial_configuration_required");
      const price = overrides.find(p=>p.variantId===v.id) ?? prices.find(p=>p.variantId===v.id);
      if (!price) throw new CommercialError("sku_price_required");
      return {variantId:v.id, productName:v.product.name, pack:`${v.unitSize} × ${v.unitsPerCase}`, itemCode:v.product.sapMaterialId,
        entity:selectedEntity as CommercialQuoteLine["entity"], cases:item.qty,
        caseWeightKg:v.unitWeightKg.mul(v.unitsPerCase).toString(),rate:price.price.toString(),
        rateBasis:price.rateBasis as "case"|"quintal",gstPercent:v.gstPercent?.toString() ?? null};
    });
    const commercial = calculateCommercialQuote({lines});
    const commercialSnapshot: CommercialSnapshot = routing ? { ...commercial, routing } : commercial;
    return tx.commercialQuote.create({data:{retailerId,snapshot:asJson(commercialSnapshot),expiresAt:new Date(Date.now()+30*60_000)}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}

export async function setFreight(id:string, revision:number, freight:ManagerFreight, actorStaffId:string) {
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "CommercialQuote" WHERE "id"=${id} FOR UPDATE`;
    const quote = await tx.commercialQuote.findUnique({where:{id}});
    if (!quote) throw new CommercialError("quote_not_found",404);
    if (quote.acceptedAt || quote.revision!==revision || quote.expiresAt < new Date()) throw new CommercialError("quote_changed_or_expired");
    const current = snapshot(quote.snapshot)!;
    const next = calculateCommercialQuote({lines:current.lines,freight});
    const nextSnapshot: CommercialSnapshot = current.routing ? { ...next, routing: current.routing } : next;
    const result = await tx.commercialQuote.update({where:{id},data:{snapshot:asJson(nextSnapshot),revision:{increment:1},freightConfirmedByStaffId:actorStaffId}});
    await tx.auditEvent.create({data:{actorStaffId,action:"commercial.freight_confirmed",subjectType:"commercial_quote",subjectId:id,metadata:asJson({revision:result.revision,freight:nextSnapshot.freight})}});
    return result;
  });
}

/** Invoice-specific balances only. Never use retailer totals to allocate cash. */
export async function invoiceBalances(tx:Prisma.TransactionClient, invoiceId:string) {
  const invoice = await tx.invoice.findUnique({where:{id:invoiceId},include:{allocations:true}});
  if (!invoice) throw new CommercialError("invoice_not_found",404);
  const saved=snapshot(invoice.commercialSnapshot);
  if (!saved) throw new CommercialError("legacy_invoice_has_no_entity_attribution");
  const original=(entity:string)=>new Prisma.Decimal(saved.entities.find(e=>e.entity===entity)?.total ?? 0);
  const jain=invoice.allocations.reduce((n,a)=>n.minus(a.jainAmount ?? 0),original("jain_traders"));
  const padam=invoice.allocations.reduce((n,a)=>n.minus(a.padamAmount ?? 0),original("padam_international"));
  if (jain.isNegative() || padam.isNegative() || !jain.plus(padam).eq(invoice.outstandingAmount)) throw new CommercialError("invoice_entity_balance_review_required");
  return {invoice,jain,padam};
}
