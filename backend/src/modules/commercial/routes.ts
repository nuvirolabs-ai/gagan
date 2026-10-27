import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma, CommercialStatusCode } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { resolveWarehouse, orderAttribution, STATIC_WAREHOUSES } from "../orders/orderAttribution";
import { requireAuth, AuthedRequest } from "../../lib/auth";
import { requireRep, assignedRetailer, RepRequest } from "../../lib/repAuth";
import { requireAdmin, AdminRequest, requireAdminIdentity } from "../../lib/adminAuth";
import { Permissions } from "../identity/roleCatalog";
import { quoteFor, setFreight, CommercialError, invoiceBalances, snapshot,quoteDelivery } from "./service";
import { postInvoicePayment } from "./payment";
import { PaymentSettlementError } from "../payments/paymentService";
import { internalStatusForQuote } from "../commercialStatus/statusService";
import { enableOrdering, getOrderingSetup, OrderingSetupError } from "../catalog/orderingSetup";
import { resolveSalesOrderAllocation } from "./routing";

const items=z.array(z.object({variantId:z.string().min(1),qty:z.number().int().positive()})).min(1).max(200);
const money=z.string().regex(/^\d+(\.\d{1,2})?$/).refine(s=>Number(s)<=9999999999.99);
const gst=money.refine(s=>Number(s)<=100);
const entity=z.enum(["jain_traders","padam_international"]);
const routingClass=z.enum(["LAXMI_TOOR","INSTANT_MIX","OTHER"]);
const routingBags=z.string().regex(/^\d+(\.\d{1,3})?$/).refine(s=>Number(s)<=999999999.999);
const payment=z.object({invoiceId:z.string(),amount:money,jainAmount:money,padamAmount:money,method:z.enum(["cash","bank_transfer","upi","cheque"]),reference:z.string().trim().min(1).max(200),confirmed:z.literal(true)});
const router=Router();
router.post("/admin/commercial/orders/:id/delivery-quote",requireAdmin,async(req,res)=>{
 const body=z.object({lines:z.array(z.object({orderItemId:z.string(),cases:z.number().int().nonnegative(),weightKg:z.number().nonnegative().optional()}))}).parse(req.body);
 const order=await prisma.order.findUnique({where:{id:req.params.id},include:{items:true}});
 if(!order || !order.commercialSnapshot) return res.status(404).json({error:"commercial_order_not_found"});
 const lines=body.lines.map(r=>{const item=order.items.find(i=>i.id===r.orderItemId);if(!item)throw new CommercialError("unknown_delivery_line",400);return {...r,variantId:item.variantId};});
 res.json({commercial:quoteDelivery(snapshot(order.commercialSnapshot)!,lines)});
});

router.post("/commercial/quotes",requireAuth,async(req:AuthedRequest,res)=>{
  const body=z.object({items}).parse(req.body);
  res.json({quote:await quoteFor(req.retailerId!,body.items)});
});
router.get("/commercial/quotes/:id",requireAuth,async(req:AuthedRequest,res)=>{
  const quote=await prisma.commercialQuote.findFirst({where:{id:req.params.id,retailerId:req.retailerId}});
  if (!quote) return res.status(404).json({error:"quote_not_found"});
  res.json({quote});
});
router.post("/rep/commercial/quotes",requireRep,async(req:RepRequest,res)=>{
  const body=z.object({retailerId:z.string(),items}).parse(req.body);
  if (!await assignedRetailer(req.repId!,body.retailerId)) return res.status(404).json({error:"retailer_not_found"});
  res.json({quote:await quoteFor(body.retailerId,body.items)});
});
router.get("/rep/commercial/quotes/:id",requireRep,async(req:RepRequest,res)=>{
  const quote=await prisma.commercialQuote.findUnique({where:{id:req.params.id}});
  if (!quote || !await assignedRetailer(req.repId!,quote.retailerId)) return res.status(404).json({error:"quote_not_found"});
  res.json({quote});
});
router.get("/admin/commercial",requireAdminIdentity,async(req:AdminRequest,res)=>{
  if(!req.staffAuth!.permissions.some(p=>p===Permissions.STAFF_MANAGE || p===Permissions.COLLECTION_CONFIRM)) return res.status(403).json({error:"permission_required"});
  const [variants,tiers,prices,quotes,invoices,warehousesList,cityRoutings]=await Promise.all([
    prisma.variant.findMany({include:{product:true}}),prisma.tier.findMany(),prisma.priceList.findMany(),
    prisma.commercialQuote.findMany({where:{acceptedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"},take:50,include:{retailer:{select:{id:true,name:true}}}}),
    prisma.invoice.findMany({
      where:{commercialSnapshot:{not: Prisma.DbNull}},
      orderBy:{createdAt:"desc"},
      take:100,
      include:{
        retailer:{
          select:{
            id:true,
            name:true,
            deliveryCity:true,
            shopAddress:true,
            salesRepId:true,
            salesRep:{select:{id:true,name:true,phone:true}}
          }
        },
        order:{
          select:{
            id:true,
            orderNo:true,
            placedBy:true,
            placedByRepId:true,
            commercialSnapshot:true,
            commercialStatusEvents:{
              where:{code:CommercialStatusCode.SALES_ORDER_PUNCHED},
              select:{code:true,actorStaff:{select:{name:true}}}
            }
          }
        },
        lines:true,
        allocations:{include:{payment:true}}
      }
    }),
    prisma.warehouse.findMany({where:{isActive:true},select:{code:true,name:true,city:true,address:true}}).catch(()=>[]),
    prisma.cityRouting.findMany({select:{city:true,primaryWarehouseCode:true}}).catch(()=>[])
  ]);

  const warehouses = (warehousesList && warehousesList.length > 0) ? warehousesList : STATIC_WAREHOUSES;
  const enrichedInvoices = invoices.filter(i=>i.commercialSnapshot!==null).map(inv => {
    const invoiceOrder = inv.order ? { ...inv.order, retailer: inv.retailer } : { retailer: inv.retailer };
    const attribution = orderAttribution(invoiceOrder);
    const wh = resolveWarehouse(invoiceOrder, warehouses, cityRoutings);
    return {
      ...inv,
      salespersonName: attribution.salespersonName,
      salespersonPhone: attribution.salespersonPhone,
      punchedByName: attribution.punchedByName,
      punchedByRole: attribution.punchedByRole,
      punchedByLabel: attribution.punchedByLabel,
      warehouseCode: wh.code,
      warehouseName: wh.name,
      warehouseCity: wh.city,
    };
  });

  res.json({
    variants,
    tiers,
    prices,
    quotes:await Promise.all(quotes.map(async quote=>({
      ...quote,
      commercialStatus: await internalStatusForQuote(quote.id),
    }))),
    invoices: enrichedInvoices
  });
});
router.get("/admin/commercial/entity-audit", requireAdminIdentity, async (req: AdminRequest, res) => {
  if (!req.staffAuth!.permissions.some(p => p === Permissions.STAFF_MANAGE || p === Permissions.COLLECTION_CONFIRM || p === Permissions.FINANCIAL_CORRECT || p === Permissions.RECOVERY_VIEW)) {
    return res.status(403).json({ error: "permission_required" });
  }

  const { from, to, city, entity: filterEntity, q } = req.query as Record<string, string | undefined>;

  const dateFilter: Prisma.DateTimeFilter | undefined = (from || to) ? {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
  } : undefined;

  const orders = await prisma.order.findMany({
    where: {
      commercialSnapshot: { not: Prisma.DbNull },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    include: {
      retailer: {
        select: {
          id: true,
          name: true,
          phone: true,
          deliveryCity: true,
          shopAddress: true,
          salesRep: { select: { id: true, name: true, phone: true } },
        },
      },
      invoice: {
        include: {
          lines: true,
          allocations: { include: { payment: true } },
        },
      },
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const extractSnapshot = (cs: any) => {
    if (!cs || typeof cs !== "object") return null;
    if (cs.quote && typeof cs.quote === "object") return cs.quote;
    return cs;
  };

  let totalRevenue = 0;
  let totalOrdersCount = 0;
  let splitOrdersCount = 0;

  const jainSummary = {
    totalRevenue: 0,
    goodsValue: 0,
    gstAmount: 0,
    freightAmount: 0,
    paymentsCollected: 0,
    outstandingAmount: 0,
    totalBags: 0,
    ordersCount: 0,
    reasons: {
      INDORE_CITY_OVERRIDE: 0,
      LAXMI_ALWAYS_JAIN: 0,
      ELIGIBLE_THRESHOLD_LT_5_BAGS: 0,
      FIXED_OR_OTHER: 0,
    },
  };

  const padamSummary = {
    totalRevenue: 0,
    goodsValue: 0,
    gstAmount: 0,
    freightAmount: 0,
    paymentsCollected: 0,
    outstandingAmount: 0,
    totalBags: 0,
    ordersCount: 0,
    reasons: {
      ELIGIBLE_THRESHOLD_GTE_5_BAGS: 0,
      FIXED_OR_OTHER: 0,
    },
  };

  const destinationsSummary = {
    indoreCity: { count: 0, total: 0 },
    outsideIndore: { count: 0, total: 0 },
  };

  const auditedOrders = [];

  for (const o of orders) {
    const snap = extractSnapshot(o.commercialSnapshot);
    if (!snap) continue;

    const deliveryCity = (snap.routing?.destinationCity || o.retailer?.deliveryCity || "").trim();
    const destination = (snap.routing?.destination || (deliveryCity.toLowerCase() === "indore" || deliveryCity.toLowerCase() === "indore city" ? "INDORE_CITY" : "OUTSIDE_INDORE")) as "INDORE_CITY" | "OUTSIDE_INDORE";

    if (city === "indore" && destination !== "INDORE_CITY") continue;
    if (city === "outside_indore" && destination !== "OUTSIDE_INDORE") continue;

    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      const matchName = o.retailer?.name?.toLowerCase().includes(needle);
      const matchCity = deliveryCity.toLowerCase().includes(needle);
      const matchOrderNo = String(o.orderNo).includes(needle);
      const matchRef = `ggn-${String(o.orderNo).padStart(8, "0")}`.toLowerCase().includes(needle);
      if (!matchName && !matchCity && !matchOrderNo && !matchRef) continue;
    }

    const rawLines: any[] = Array.isArray(snap.lines) ? snap.lines : [];
    const freight = snap.freight;

    const jainLines: any[] = [];
    const padamLines: any[] = [];

    let jainGoods = 0;
    let jainGst = 0;
    let jainFreight = 0;
    let jainBags = 0;

    let padamGoods = 0;
    let padamGst = 0;
    let padamFreight = 0;
    let padamBags = 0;

    for (const l of rawLines) {
      const lineEntity = l.entity || "jain_traders";
      const base = Number(l.base ?? (Number(l.rate ?? 0) * Number(l.cases ?? 1)));
      const gstVal = Number(l.gst ?? 0);
      const tot = Number(l.total ?? (base + gstVal));
      const bags = Number(l.cases ?? l.qty ?? 1);

      const routingLine = snap.routing?.lines?.find((rl: any) => rl.variantId === l.variantId);
      const reason = routingLine?.reason || (destination === "INDORE_CITY" ? "INDORE_CITY_OVERRIDE" : "STANDARD_ALLOCATION");

      const processedLine = {
        variantId: l.variantId,
        productName: l.productName || "Product",
        pack: l.pack || "",
        cases: bags,
        weightKg: Number(l.weightKg ?? 0),
        rate: Number(l.rate ?? 0),
        rateBasis: l.rateBasis || "case",
        base: Math.round(base * 100) / 100,
        gst: Math.round(gstVal * 100) / 100,
        total: Math.round(tot * 100) / 100,
        routingClass: routingLine?.routingClass || l.routingClass || "OTHER",
        reason,
      };

      if (lineEntity === "padam_international") {
        padamLines.push(processedLine);
        padamGoods += base;
        padamGst += gstVal;
        padamBags += bags;
      } else {
        jainLines.push(processedLine);
        jainGoods += base;
        jainGst += gstVal;
        jainBags += bags;
      }
    }

    if (freight && freight.entity) {
      const fAmt = Number(freight.amount ?? 0);
      const fGst = Number(freight.gst ?? 0);
      if (freight.entity === "padam_international") {
        padamFreight += (fAmt + fGst);
      } else {
        jainFreight += (fAmt + fGst);
      }
    }

    const jainTotal = jainGoods + jainGst + jainFreight;
    const padamTotal = padamGoods + padamGst + padamFreight;
    const orderGrandTotal = Number(snap.total ?? (jainTotal + padamTotal));

    const isSplit = jainTotal > 0 && padamTotal > 0;

    if (filterEntity === "jain_traders" && jainTotal <= 0) continue;
    if (filterEntity === "padam_international" && padamTotal <= 0) continue;
    if (filterEntity === "split" && !isSplit) continue;

    let paidJain = 0;
    let paidPadam = 0;
    let totalPaid = 0;

    if (o.invoice) {
      for (const alloc of (o.invoice.allocations || [])) {
        const j = Number(alloc.jainAmount ?? 0);
        const p = Number(alloc.padamAmount ?? 0);
        paidJain += j;
        paidPadam += p;
        totalPaid += (j + p || Number(alloc.amount ?? 0));
      }
    }

    const outstandingJain = Math.max(0, jainTotal - paidJain);
    const outstandingPadam = Math.max(0, padamTotal - paidPadam);

    totalRevenue += orderGrandTotal;
    totalOrdersCount++;
    if (isSplit) splitOrdersCount++;

    if (destination === "INDORE_CITY") {
      destinationsSummary.indoreCity.count++;
      destinationsSummary.indoreCity.total += orderGrandTotal;
    } else {
      destinationsSummary.outsideIndore.count++;
      destinationsSummary.outsideIndore.total += orderGrandTotal;
    }

    if (jainTotal > 0) {
      jainSummary.totalRevenue += jainTotal;
      jainSummary.goodsValue += jainGoods;
      jainSummary.gstAmount += jainGst;
      jainSummary.freightAmount += jainFreight;
      jainSummary.paymentsCollected += paidJain;
      jainSummary.outstandingAmount += outstandingJain;
      jainSummary.totalBags += jainBags;
      jainSummary.ordersCount++;

      for (const jl of jainLines) {
        if (jl.reason === "INDORE_CITY_OVERRIDE") jainSummary.reasons.INDORE_CITY_OVERRIDE++;
        else if (jl.reason === "LAXMI_ALWAYS_JAIN") jainSummary.reasons.LAXMI_ALWAYS_JAIN++;
        else if (jl.reason === "ELIGIBLE_THRESHOLD_LT_5_BAGS") jainSummary.reasons.ELIGIBLE_THRESHOLD_LT_5_BAGS++;
        else jainSummary.reasons.FIXED_OR_OTHER++;
      }
    }

    if (padamTotal > 0) {
      padamSummary.totalRevenue += padamTotal;
      padamSummary.goodsValue += padamGoods;
      padamSummary.gstAmount += padamGst;
      padamSummary.freightAmount += padamFreight;
      padamSummary.paymentsCollected += paidPadam;
      padamSummary.outstandingAmount += outstandingPadam;
      padamSummary.totalBags += padamBags;
      padamSummary.ordersCount++;

      for (const pl of padamLines) {
        if (pl.reason === "ELIGIBLE_THRESHOLD_GTE_5_BAGS") padamSummary.reasons.ELIGIBLE_THRESHOLD_GTE_5_BAGS++;
        else padamSummary.reasons.FIXED_OR_OTHER++;
      }
    }

    auditedOrders.push({
      id: o.id,
      orderNo: o.orderNo,
      createdAt: o.createdAt,
      status: o.status,
      retailerId: o.retailer?.id,
      retailerName: o.retailer?.name ?? "Retailer",
      retailerPhone: o.retailer?.phone,
      deliveryCity,
      destination,
      isSplit,
      explanation: snap.routing?.explanation ?? (destination === "INDORE_CITY" ? "Indore City destination routes to Jain Traders." : "Standard billing allocation."),
      eligibleContributionBags: Number(snap.routing?.eligibleContributionBags ?? 0),
      jain: {
        goods: Math.round(jainGoods * 100) / 100,
        gst: Math.round(jainGst * 100) / 100,
        freight: Math.round(jainFreight * 100) / 100,
        total: Math.round(jainTotal * 100) / 100,
        bags: jainBags,
        itemsCount: jainLines.length,
        lines: jainLines,
        paid: Math.round(paidJain * 100) / 100,
        outstanding: Math.round(outstandingJain * 100) / 100,
      },
      padam: {
        goods: Math.round(padamGoods * 100) / 100,
        gst: Math.round(padamGst * 100) / 100,
        freight: Math.round(padamFreight * 100) / 100,
        total: Math.round(padamTotal * 100) / 100,
        bags: padamBags,
        itemsCount: padamLines.length,
        lines: padamLines,
        paid: Math.round(paidPadam * 100) / 100,
        outstanding: Math.round(outstandingPadam * 100) / 100,
      },
      grandTotal: Math.round(orderGrandTotal * 100) / 100,
      invoiceNumber: o.invoice?.invoiceNumber ?? null,
      invoiceStatus: o.invoice?.status ?? null,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOutstanding: Math.round(Math.max(0, orderGrandTotal - totalPaid) * 100) / 100,
    });
  }

  res.json({
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders: totalOrdersCount,
      splitOrdersCount,
      jain: {
        ...jainSummary,
        totalRevenue: Math.round(jainSummary.totalRevenue * 100) / 100,
        goodsValue: Math.round(jainSummary.goodsValue * 100) / 100,
        gstAmount: Math.round(jainSummary.gstAmount * 100) / 100,
        freightAmount: Math.round(jainSummary.freightAmount * 100) / 100,
        paymentsCollected: Math.round(jainSummary.paymentsCollected * 100) / 100,
        outstandingAmount: Math.round(jainSummary.outstandingAmount * 100) / 100,
      },
      padam: {
        ...padamSummary,
        totalRevenue: Math.round(padamSummary.totalRevenue * 100) / 100,
        goodsValue: Math.round(padamSummary.goodsValue * 100) / 100,
        gstAmount: Math.round(padamSummary.gstAmount * 100) / 100,
        freightAmount: Math.round(padamSummary.freightAmount * 100) / 100,
        paymentsCollected: Math.round(padamSummary.paymentsCollected * 100) / 100,
        outstandingAmount: Math.round(padamSummary.outstandingAmount * 100) / 100,
      },
      destinations: {
        indoreCity: {
          count: destinationsSummary.indoreCity.count,
          total: Math.round(destinationsSummary.indoreCity.total * 100) / 100,
        },
        outsideIndore: {
          count: destinationsSummary.outsideIndore.count,
          total: Math.round(destinationsSummary.outsideIndore.total * 100) / 100,
        },
      },
    },
    orders: auditedOrders,
  });
});

router.post("/admin/commercial/entity-audit/simulate", requireAdminIdentity, async (req: AdminRequest, res) => {
  const body = z.object({
    destinationCity: z.string().trim().min(1),
    lines: z.array(z.object({
      variantId: z.string().default("sim-item"),
      productName: z.string().default("Simulated Item"),
      routingClass: z.enum(["LAXMI_TOOR", "INSTANT_MIX", "OTHER"]),
      quantity: z.number().int().positive(),
      caseWeightKg: z.number().positive(),
      routingBagEquivalent: z.number().positive().nullable().optional(),
      estimatedRate: z.number().positive().default(1000),
      gstPercent: z.number().nonnegative().default(5),
    })).min(1),
  }).parse(req.body);

  const plan = resolveSalesOrderAllocation({
    destinationCity: body.destinationCity,
    lines: body.lines.map((l, idx) => ({
      variantId: l.variantId || `sim-${idx}`,
      quantity: l.quantity,
      routingClass: l.routingClass,
      routingBagEquivalent: l.routingClass === "INSTANT_MIX" ? null : (l.routingBagEquivalent ? String(l.routingBagEquivalent) : "1.000"),
      caseWeightKg: String(l.caseWeightKg),
    })),
  });

  res.json({ plan });
});

router.get("/admin/commercial/retailers/:id/outstanding",requireAdminIdentity,async(req:AdminRequest,res)=>{
  if(!req.staffAuth!.permissions.some(p=>p===Permissions.STAFF_MANAGE || p===Permissions.COLLECTION_CONFIRM)) return res.status(403).json({error:"permission_required"});
  const totals=await prisma.$transaction(async tx=>{
    const invoices=await tx.invoice.findMany({where:{retailerId:req.params.id,outstandingAmount:{gt:0}}});
    let jain=new Prisma.Decimal(0),padam=new Prisma.Decimal(0),legacy=new Prisma.Decimal(0);
    for(const i of invoices){if(i.commercialSnapshot===null){legacy=legacy.plus(i.outstandingAmount);continue;}const b=await invoiceBalances(tx,i.id);jain=jain.plus(b.jain);padam=padam.plus(b.padam);}
    return {jain:jain.toFixed(2),padam:padam.toFixed(2),legacyUnattributed:legacy.toFixed(2),combined:jain.plus(padam).plus(legacy).toFixed(2)};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  res.json({retailerId:req.params.id,...totals,usage:"reporting_only"});
});
router.put("/admin/commercial/skus/:id",requireAdmin,async(req:AdminRequest,res)=>{
  const body=z.object({
    // Legacy static ownership remains available for old catalog rows. When a
    // routing class is configured, the quote engine is authoritative for the
    // actual company assigned to the line.
    sellingEntity:entity.nullable().optional(),
    gstPercent:gst,
    tierId:z.string(),
    rate:money,
    rateBasis:z.enum(["case","quintal"]),
    routingClass:routingClass.nullable().optional(),
    routingBagEquivalent:routingBags.nullable().optional(),
  }).transform(value=>({
    ...value,
    sellingEntity:value.sellingEntity ?? null,
    routingClass:value.routingClass ?? null,
    routingBagEquivalent:value.routingBagEquivalent ?? null,
  })).superRefine((value,ctx)=>{
    if (value.routingClass === "OTHER" && (!value.routingBagEquivalent || Number(value.routingBagEquivalent) <= 0)) {
      ctx.addIssue({code:z.ZodIssueCode.custom,path:["routingBagEquivalent"],message:"OTHER requires a positive approved bag equivalent"});
    }
    if (value.routingClass === "LAXMI_TOOR" && value.routingBagEquivalent !== null) {
      ctx.addIssue({code:z.ZodIssueCode.custom,path:["routingBagEquivalent"],message:"LAXMI_TOOR does not use a bag equivalent"});
    }
    if (value.routingClass === "INSTANT_MIX" && value.routingBagEquivalent !== null) {
      ctx.addIssue({code:z.ZodIssueCode.custom,path:["routingBagEquivalent"],message:"INSTANT_MIX uses the fixed ordered KG ÷ 5 conversion; leave bag equivalent blank"});
    }
    if (!value.routingClass && value.routingBagEquivalent !== null) {
      ctx.addIssue({code:z.ZodIssueCode.custom,path:["routingClass"],message:"Routing class is required for a bag equivalent"});
    }
    if (!value.sellingEntity && !value.routingClass) {
      ctx.addIssue({code:z.ZodIssueCode.custom,path:["sellingEntity"],message:"Choose a legacy company or configure a routing class"});
    }
  }).parse({
    ...req.body,
    sellingEntity: req.body.sellingEntity || null,
    routingClass: req.body.routingClass || null,
    routingBagEquivalent: req.body.routingBagEquivalent || null,
  });
  const managed = await prisma.variant.findUnique({ where: { id: req.params.id }, select: { catalogKey: true } });
  if (managed?.catalogKey) {
    try {
      const setup = await getOrderingSetup(req.params.id);
      const prices = setup.effective.prices.filter(price => price.tierId !== body.tierId);
      prices.push({ tierId: body.tierId, rate: body.rate, rateBasis: body.rateBasis });
      const result = await enableOrdering(req.params.id, setup.revision, {
        gstPercent: body.gstPercent, sellingEntity: body.sellingEntity,
        routingClass: body.routingClass, routingBagEquivalent: body.routingBagEquivalent,
        prices,
      }, req.staffAuth!.staffId);
      return res.json({ variant: result.pack });
    } catch (error) {
      if (error instanceof OrderingSetupError) return res.status(error.status).json({ error: error.code, blockers: error.blockers });
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || (error.code === "P2010" && error.meta?.code === "40001"))) return res.status(409).json({ error: "setup_changed" });
      throw error;
    }
  }
  const result=await prisma.$transaction(async tx=>{
    // Finalizing GST retires the narrowly-scoped pre-GST ordering exception.
    // The invoice guard remains fail-closed if a caller does not supply a
    // configured GST value.
    const variant=await tx.variant.update({where:{id:req.params.id},data:{sellingEntity:body.sellingEntity,gstPercent:body.gstPercent,gstPendingOrderAllowed:false,routingClass:body.routingClass,routingBagEquivalent:body.routingBagEquivalent}});
    await tx.priceList.upsert({where:{tierId_variantId:{tierId:body.tierId,variantId:variant.id}},update:{price:body.rate,rateBasis:body.rateBasis},create:{tierId:body.tierId,variantId:variant.id,productId:variant.productId,price:body.rate,rateBasis:body.rateBasis}});
    await tx.auditEvent.create({data:{actorStaffId:req.staffAuth!.staffId,action:"commercial.sku_configured",subjectType:"variant",subjectId:variant.id,metadata:body}});
    return variant;
  });
  res.json({variant:result});
});
router.put("/admin/commercial/quotes/:id/freight",requireAdmin,async(req:AdminRequest,res)=>{
  const body=z.object({revision:z.number().int().positive(),freight:z.object({entity,amount:money,gstPercent:gst,recordedQuintals:money,recordedKilometres:money})}).parse(req.body);
  res.json({quote:await setFreight(req.params.id,body.revision,body.freight,req.staffAuth!.staffId)});
});
router.get("/admin/commercial/invoices/:id/balances",requireAdminIdentity,async(req:AdminRequest,res)=>{
  if (!req.staffAuth!.permissions.includes(Permissions.COLLECTION_CONFIRM)) return res.status(403).json({error:"permission_required"});
  const balances=await prisma.$transaction(tx=>invoiceBalances(tx,req.params.id));
  res.json({invoiceId:req.params.id,jain:balances.jain.toFixed(2),padam:balances.padam.toFixed(2),total:balances.invoice.outstandingAmount.toFixed(2)});
});
router.post("/admin/commercial/invoices/:id/payments",requireAdminIdentity,async(req:AdminRequest,res)=>{
  if (!req.staffAuth!.permissions.includes(Permissions.COLLECTION_CONFIRM)) return res.status(403).json({error:"permission_required"});
  if (!req.staffAuth!.stepUpUntil || req.staffAuth!.stepUpUntil <= new Date()) return res.status(403).json({error:"step_up_required"});
  const body=payment.parse({...req.body,invoiceId:req.params.id});
  const invoice=await prisma.invoice.findUnique({where:{id:body.invoiceId}});
  if (!invoice) return res.status(404).json({error:"invoice_not_found"});
  res.json(await postInvoicePayment(invoice.retailerId,req.staffAuth!.staffId,req.header("idempotency-key") ?? "",body));
});
router.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{
  if(error instanceof z.ZodError) return res.status(400).json({error:"invalid_commercial_input",details:error.flatten()});
  if(error instanceof CommercialError) return res.status(error.status).json({error:error.code,...(error.details ? {details:error.details} : {})});
  if(error instanceof PaymentSettlementError) return res.status(409).json({error:error.code});
  next(error);
});
export default router;
