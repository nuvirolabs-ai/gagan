import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../lib/auth";
import { requireRep, assignedRetailer, RepRequest } from "../../lib/repAuth";
import { requireAdmin, AdminRequest, requireAdminIdentity } from "../../lib/adminAuth";
import { Permissions } from "../identity/roleCatalog";
import { quoteFor, setFreight, CommercialError, invoiceBalances, snapshot,quoteDelivery } from "./service";
import { postInvoicePayment } from "./payment";
import { PaymentSettlementError } from "../payments/paymentService";
import { internalStatusForQuote } from "../commercialStatus/statusService";

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
  const [variants,tiers,prices,quotes,invoices]=await Promise.all([
    prisma.variant.findMany({include:{product:true}}),prisma.tier.findMany(),prisma.priceList.findMany(),
    prisma.commercialQuote.findMany({where:{acceptedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"},take:50,include:{retailer:{select:{id:true,name:true}}}}),
    prisma.invoice.findMany({where:{commercialSnapshot:{not: Prisma.DbNull}},orderBy:{createdAt:"desc"},take:100,include:{retailer:{select:{id:true,name:true}},order:{select:{orderNo:true}},lines:true,allocations:{include:{payment:true}}}}),
  ]);
  res.json({variants,tiers,prices,quotes:await Promise.all(quotes.map(async quote=>({
    ...quote,
    commercialStatus: await internalStatusForQuote(quote.id),
  }))),invoices:invoices.filter(i=>i.commercialSnapshot!==null)});
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
  const result=await prisma.$transaction(async tx=>{
    const variant=await tx.variant.update({where:{id:req.params.id},data:{sellingEntity:body.sellingEntity,gstPercent:body.gstPercent,routingClass:body.routingClass,routingBagEquivalent:body.routingBagEquivalent}});
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
