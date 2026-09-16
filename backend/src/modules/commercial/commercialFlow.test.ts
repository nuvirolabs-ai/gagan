import {randomUUID} from "node:crypto";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
import {prisma} from "../../lib/prisma";
import {createOrderForRetailer} from "../../lib/orders";
import {createInvoiceForDelivery} from "../invoicing/invoiceService";
import {quoteFor,setFreight,snapshot,invoiceBalances} from "./service";
import {postInvoicePayment} from "./payment";
import {enqueueInvoice,drainOutbox} from "../../lib/sap/outbox";
import {settleSucceededPayment} from "../payments/paymentService";
import {CollectionService} from "../collections/collectionService";
import {issueCreditNote} from "../payments/creditNoteService";
import {MockSapConnector} from "../../lib/sap/mockConnector";

const retailer=randomUUID(),tier=randomUUID(),staff=randomUUID(),product=randomUUID();
const variants=[randomUUID(),randomUUID(),randomUUID()];
let invoiceId:string;
beforeAll(async()=>{
 await prisma.tier.create({data:{id:tier,name:tier}});
 await prisma.staffUser.create({data:{id:staff,name:"Local commercial test",phone:staff,email:`${staff}@example.invalid`}});
 await prisma.retailer.create({data:{id:retailer,name:"Local commercial test",phone:retailer,shopAddress:"Local",tierId:tier,creditLimit:9999999,sapCustomerId:`MOCK-${retailer}`}});
 await prisma.creditProfile.create({data:{retailerId:retailer,rating:"N",kycVerifiedAt:new Date()}});
 await prisma.product.create({data:{id:product,name:"Test grain",category:"Local",sapMaterialId:product}});
 for (let i=0;i<3;i++) {
  await prisma.variant.create({data:{id:variants[i],productId:product,unitSize:i===2?"5kg":"1kg",unit:"kg",unitsPerCase:i===2?6:30,unitWeightKg:i===2?5:1,sellingEntity:i===1?"padam_international":"jain_traders",gstPercent:i===1?12:5}});
  await prisma.priceList.create({data:{tierId:tier,productId:product,variantId:variants[i],price:i===1?2000:10000,rateBasis:i===1?"case":"quintal"}});
 }
 await prisma.inventorySnapshot.create({data:{productId:product,sapMaterialId:product,warehouseCode:"WH-001",onHand:10000,available:10000,status:"available",syncedAt:new Date()}});
});
async function quote(ids=variants.slice(0,2)) {
 const q=await quoteFor(retailer,ids.map(variantId=>({variantId,qty:ids.length===1 && variantId===variants[1]?2:1})));
 if(!q)throw new Error("Expected commercial quote");
 return setFreight(q.id,q.revision,{entity:ids.includes(variants[0]) || ids.includes(variants[2]) ? "jain_traders":"padam_international",amount:"100",gstPercent:"18",recordedQuintals:"0.60",recordedKilometres:"12"},staff);
}
async function order(q:Awaited<ReturnType<typeof quote>>,key=randomUUID()) {
 const result=await createOrderForRetailer(retailer,snapshot(q.snapshot)!.lines.map(l=>({variantId:l.variantId,qty:l.cases})),"retailer",undefined,undefined,key,{quoteId:q.id,revision:q.revision});
 if(!result.ok)throw new Error(JSON.stringify(result.body));return result.order;
}
async function deliver(o:any) {
 await prisma.order.update({where:{id:o.id},data:{status:"out_for_delivery"}});
 return createInvoiceForDelivery({orderId:o.id,idempotencyKey:randomUUID(),occurredAt:new Date(),lines:o.items.map((i:any)=>({orderItemId:i.id,deliveredCases:i.qtyOrdered}))});
}
describe("Wave 1B authoritative commercial lifecycle",()=>{
 it("uses the explicit Jain/Padam routing plan before the existing quote calculator",async()=>{
  await prisma.retailer.update({where:{id:retailer},data:{deliveryCity:"Bhopal"}});
  await prisma.variant.update({where:{id:variants[0]},data:{sellingEntity:null,routingClass:"LAXMI_TOOR",routingBagEquivalent:null}});
  await prisma.variant.update({where:{id:variants[1]},data:{sellingEntity:null,routingClass:"OTHER",routingBagEquivalent:"1"}});
  try {
   const q=await quoteFor(retailer,[{variantId:variants[0],qty:1},{variantId:variants[1],qty:5}]);
   expect(q).not.toBeNull();
   expect(snapshot(q!.snapshot)!.routing).toMatchObject({destination:"OUTSIDE_INDORE",eligibleContributionBags:"5.000"});
   expect(Object.fromEntries(snapshot(q!.snapshot)!.lines.map(line=>[line.variantId,line.entity]))).toEqual({
    [variants[0]]:"jain_traders",[variants[1]]:"padam_international",
   });
   expect(snapshot(q!.snapshot)!.routing!.lines.find(line=>line.variantId===variants[1])!.reason).toBe("ELIGIBLE_THRESHOLD_GTE_5_BAGS");
   const ready=await setFreight(q!.id,q!.revision,{entity:"padam_international",amount:"100",gstPercent:"18",recordedQuintals:"1.5",recordedKilometres:"12"},staff);
   const orderKey=randomUUID();
   const created=await order(ready,orderKey);
   const replayed=await order(ready,orderKey);
   expect(replayed.id).toBe(created.id);
   expect(snapshot(created.commercialSnapshot)!.routing).toEqual(snapshot(ready.snapshot)!.routing);
   const invoice=await deliver(created);
   expect(snapshot(invoice.commercialSnapshot)!.routing).toEqual(snapshot(ready.snapshot)!.routing);
   const acceptedRouting=snapshot(created.commercialSnapshot)!.routing;
   await prisma.retailer.update({where:{id:retailer},data:{deliveryCity:"Indore"}});
   await prisma.variant.update({where:{id:variants[1]},data:{routingClass:"OTHER",routingBagEquivalent:"1",sellingEntity:null}});
   const historic=await prisma.order.findUniqueOrThrow({where:{id:created.id}});
   expect(snapshot(historic.commercialSnapshot)!.routing).toEqual(acceptedRouting);
  } finally {
   await prisma.retailer.update({where:{id:retailer},data:{deliveryCity:null}});
   await prisma.variant.update({where:{id:variants[0]},data:{sellingEntity:"jain_traders",routingClass:null,routingBagEquivalent:null}});
   await prisma.variant.update({where:{id:variants[1]},data:{sellingEntity:"padam_international",routingClass:null,routingBagEquivalent:null}});
  }
 });
 it("persists the fixed Instant Mix conversion in the authoritative quote snapshot",async()=>{
  await prisma.retailer.update({where:{id:retailer},data:{deliveryCity:"Bhopal"}});
  await prisma.variant.update({where:{id:variants[2]},data:{unitSize:"3kg",unitsPerCase:1,unitWeightKg:3,sellingEntity:null,routingClass:"INSTANT_MIX",routingBagEquivalent:null}});
  await prisma.variant.update({where:{id:variants[1]},data:{sellingEntity:null,routingClass:"OTHER",routingBagEquivalent:"1"}});
  try {
   const q=await quoteFor(retailer,[{variantId:variants[2],qty:1},{variantId:variants[1],qty:3}]);
   expect(q).not.toBeNull();
   const routing=snapshot(q!.snapshot)!.routing!;
   expect(routing.eligibleContributionBags).toBe("3.600");
   expect(routing.lines.find(line=>line.variantId===variants[2])).toMatchObject({
    contributionBasis:"INSTANT_MIX_KG_DIV_5",orderedKg:"3.000",contributionBags:"0.600",entity:"jain_traders",
   });
   expect(routing.lines.find(line=>line.variantId===variants[1])?.entity).toBe("jain_traders");
  } finally {
   await prisma.variant.update({where:{id:variants[2]},data:{unitSize:"5kg",unitsPerCase:6,unitWeightKg:5,sellingEntity:"jain_traders",routingClass:null,routingBagEquivalent:null}});
   await prisma.variant.update({where:{id:variants[1]},data:{sellingEntity:"padam_international",routingClass:null,routingBagEquivalent:null}});
  }
 });
 it.each([[0],[1],[0,1],[0,1,2]])("accepts single/mixed entities and multiple packs: %j",async(...indexes)=>{
  const q=await quote(indexes.map(i=>variants[i]));const o=await order(q);
  expect(Number(o.orderTotal)).toBe(Number(snapshot(q.snapshot)!.total));
  expect(o.items.every((i:any)=>i.commercialSnapshot!==null)).toBe(true);
 });
 it("snapshots rates, company, tax, weight, freight; invoice and SAP retain them after master edits",async()=>{
  const q=await quote();const o=await order(q);
  expect(snapshot(q.snapshot)!.total).toBe("5508.00");
  expect(snapshot(q.snapshot)!.lines.find(l=>l.variantId===variants[0])).toMatchObject({base:"3000.00",gst:"150.00"});
  expect(snapshot(q.snapshot)!.lines.find(l=>l.variantId===variants[1])).toMatchObject({base:"2000.00",gst:"240.00"});
  await prisma.variant.update({where:{id:variants[0]},data:{unitsPerCase:60,gstPercent:28,sellingEntity:"padam_international"}});
  await prisma.priceList.update({where:{tierId_variantId:{tierId:tier,variantId:variants[0]}},data:{price:20000}});
  const inv=await deliver(o);invoiceId=inv.id;
  expect(Number(inv.total)).toBe(5508);expect(Number(inv.taxTotal)).toBe(408);
  expect(inv.lines.filter(l=>l.orderItemId!==null).map(l=>l.sellingEntity).sort()).toEqual(["jain_traders","padam_international"]);
  expect(inv.lines.reduce((n,l)=>n+Number(l.lineTotal),0)).toBe(5508);
  const ledger=await prisma.ledgerEntry.findFirstOrThrow({where:{orderId:o.id,type:"invoice"}});
  await enqueueInvoice(prisma,ledger.id);
  const exported=await prisma.sapOutbox.findUniqueOrThrow({where:{kind_referenceId:{kind:"invoice",referenceId:ledger.id}}});
  expect(exported.payload).toMatchObject({amount:5508,commercial:{total:"5508.00"}});
  const connector=new MockSapConnector();const posted=vi.spyOn(connector,"postInvoice");
  expect(await drainOutbox(1,connector,ledger.id)).toMatchObject({sent:1,failed:0});
  expect(posted).toHaveBeenCalledWith(expect.objectContaining({amount:5508,commercial:expect.objectContaining({total:"5508.00",entities:snapshot(q.snapshot)!.entities,lines:expect.arrayContaining(snapshot(q.snapshot)!.lines.map(l=>expect.objectContaining(l)))})}));
  await prisma.variant.update({where:{id:variants[0]},data:{unitsPerCase:30,gstPercent:5,sellingEntity:"jain_traders"}});
  await prisma.priceList.update({where:{tierId_variantId:{tierId:tier,variantId:variants[0]}},data:{price:10000}});
 });
 it("requires manager freight and latest reviewed revision",async()=>{
  const q=await quoteFor(retailer,[{variantId:variants[0],qty:1}]);
  const result=await createOrderForRetailer(retailer,[{variantId:variants[0],qty:1}],"retailer",undefined,undefined,randomUUID(),{quoteId:q!.id,revision:q!.revision});
  expect(result).toMatchObject({ok:false,body:{error:"manager_freight_confirmation_required"}});
  const ready=await setFreight(q!.id,1,{entity:"jain_traders",amount:"0",gstPercent:"0",recordedQuintals:"0.3",recordedKilometres:"0"},staff);
  expect(await createOrderForRetailer(retailer,[{variantId:variants[0],qty:1}],"retailer",undefined,undefined,randomUUID(),{quoteId:ready.id,revision:1})).toMatchObject({ok:false,body:{error:"quote_changed_or_expired"}});
 });
 it("parallel duplicate checkout and delivery produce exactly one order and invoice",async()=>{
  const q=await quote();const key=randomUUID();const results=await Promise.all([order(q,key),order(q,key)]);
  expect(results[0].id).toBe(results[1].id);
  const o=results[0];await prisma.order.update({where:{id:o.id},data:{status:"out_for_delivery"}});
  const input={orderId:o.id,idempotencyKey:randomUUID(),occurredAt:new Date(),lines:o.items.map((i:any)=>({orderItemId:i.id,deliveredCases:1}))};
  const invs=await Promise.all([createInvoiceForDelivery(input),createInvoiceForDelivery(input)]);
  expect(invs[0].id).toBe(invs[1].id);expect(await prisma.invoice.count({where:{orderId:o.id}})).toBe(1);
 });
 it("posts exact explicit invoice split once under retries without touching unrelated invoices",async()=>{
  const body={invoiceId,amount:"300.00",jainAmount:"100.00",padamAmount:"200.00",method:"cash",reference:"LOCAL-TEST",confirmed:true as const};
  const before=await prisma.invoice.findMany({where:{retailerId:retailer,id:{not:invoiceId}}});const key=randomUUID();
  const [a,b]=await Promise.all([postInvoicePayment(retailer,staff,key,body),postInvoicePayment(retailer,staff,key,body)]);
  expect(a.paymentId).toBe(b.paymentId);
  const balances=await prisma.$transaction(tx=>invoiceBalances(tx,invoiceId));
  expect(balances.jain.toFixed(2)).toBe("3168.00");expect(balances.padam.toFixed(2)).toBe("2040.00");
  for(const i of before)expect((await prisma.invoice.findUniqueOrThrow({where:{id:i.id}})).outstandingAmount.eq(i.outstandingAmount)).toBe(true);
  await expect(postInvoicePayment(retailer,staff,key,{...body,jainAmount:"101",padamAmount:"199"})).rejects.toThrow("payment_idempotency_conflict");
 });
 it("rejects unequal sums, cross-entity excess and retailer FIFO for attributed invoices",async()=>{
  const base={invoiceId,amount:"100",jainAmount:"50",padamAmount:"49",method:"cash",reference:"LOCAL",confirmed:true as const};
  await expect(postInvoicePayment(retailer,staff,randomUUID(),base)).rejects.toThrow("explicit_invoice_allocation_required");
  await expect(postInvoicePayment(retailer,staff,randomUUID(),{...base,amount:"4000",jainAmount:"4000",padamAmount:"0"})).rejects.toThrow("invoice_entity_allocation_invalid");
  const p=await prisma.payment.create({data:{retailerId:retailer,amount:100}});
  await expect(settleSucceededPayment({paymentId:p.id,occurredAt:new Date()})).rejects.toThrow("invoice_entity_allocation_required");
 });
 it("parallel payments cannot overdraw either invoice company; exact full remainder settles",async()=>{
  const base={invoiceId,amount:"2000",jainAmount:"0",padamAmount:"2000",method:"cash",reference:"LOCAL-RACE",confirmed:true as const};
  const results=await Promise.allSettled([postInvoicePayment(retailer,staff,randomUUID(),base),postInvoicePayment(retailer,staff,randomUUID(),base)]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  const b=await prisma.$transaction(tx=>invoiceBalances(tx,invoiceId));
  await postInvoicePayment(retailer,staff,randomUUID(),{...base,amount:b.jain.plus(b.padam).toFixed(2),jainAmount:b.jain.toFixed(2),padamAmount:b.padam.toFixed(2)});
  expect((await prisma.invoice.findUniqueOrThrow({where:{id:invoiceId}})).status).toBe("paid");
 });
 it("uses negotiated price override once, preserves its basis, and never invents a scheme discount",async()=>{
  await prisma.priceOverride.create({data:{retailerId:retailer,variantId:variants[0],price:9000,rateBasis:"quintal"}});
  try {const q=await quote([variants[0]]);expect(snapshot(q.snapshot)!.lines[0]).toMatchObject({rate:"9000",base:"2700.00",gst:"135.00",discount:"0.00"});}
  finally {await prisma.priceOverride.deleteMany({where:{retailerId:retailer}});}
 });
 it("cannot mutate accepted order, invoice, or company line snapshots",async()=>{
  const o=await order(await quote());const inv=await deliver(o);
  await expect(prisma.order.update({where:{id:o.id},data:{commercialSnapshot:{total:"0"}}})).rejects.toThrow();
  await expect(prisma.invoice.update({where:{id:inv.id},data:{commercialSnapshot:{total:"0"}}})).rejects.toThrow();
  await expect(prisma.invoiceLine.update({where:{id:inv.lines[0].id},data:{sellingEntity:inv.lines[0].sellingEntity==="jain_traders"?"padam_international":"jain_traders"}})).rejects.toThrow();
  await expect(issueCreditNote({invoiceId:inv.id,amount:1,actorStaffId:staff,reason:"Unscoped credit must not change ownership",occurredAt:new Date(),idempotencyKey:randomUUID()})).rejects.toThrow("entity_attributed_credit_requires_explicit_correction_contract");
 });
 it("rejects malformed company configuration, sub-paise amounts and missing confirmation",async()=>{
  await expect(prisma.variant.update({where:{id:variants[0]},data:{sellingEntity:null,gstPercent:5}})).rejects.toThrow();
  const inv=await deliver(await order(await quote()));
  const input={invoiceId:inv.id,amount:"1.001",jainAmount:"1.001",padamAmount:"0",method:"cash",reference:"LOCAL",confirmed:true as const};
  await expect(postInvoicePayment(retailer,staff,randomUUID(),input)).rejects.toThrow("invalid_payment_precision");
  await expect(postInvoicePayment(retailer,staff,randomUUID(),{...input,amount:"1",jainAmount:"1",confirmed:false as unknown as true})).rejects.toThrow("explicit_invoice_allocation_required");
 });
 it("preserves collection approval and rechecks invoice balances when concurrent collections are confirmed",async()=>{
  const inv=await deliver(await order(await quote()));
  await prisma.collectionAssignment.create({data:{collectorStaffId:staff,retailerId:retailer}});
  const svc=new CollectionService();const input={collectorStaffId:staff,actorPermissions:["collection.submit"],retailerId:retailer,invoiceScopeId:inv.id,amount:2000,jainAmount:"0",padamAmount:"2000",method:"cash" as const,reference:"LOCAL-COLLECTION",idempotencyKey:randomUUID()};
  const a=await svc.submit(input),b=await svc.submit({...input,idempotencyKey:randomUUID()});
  expect((await svc.submit(input)).id).toBe(a.id);
  await expect(svc.submit({...input,jainAmount:"1",padamAmount:"1999"})).rejects.toThrow("idempotency_key_conflict");
  expect((await prisma.invoice.findUniqueOrThrow({where:{id:inv.id}})).outstandingAmount.toFixed(2)).toBe("5508.00");
  await expect(svc.confirm(a.id,{actorStaffId:staff,actorPermissions:["collection.confirm"]})).rejects.toThrow("step_up_required");
  const authority={actorStaffId:staff,actorPermissions:["collection.confirm"],stepUpUntil:new Date(Date.now()+60000)};
  const results=await Promise.allSettled([svc.confirm(a.id,authority),svc.confirm(b.id,authority)]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  const succeeded=results[0].status==="fulfilled"?a:b;
  const replay=await svc.confirm(succeeded.id,authority);
  expect(replay.idempotent).toBe(true);
  expect(await prisma.paymentAllocation.count({where:{invoiceId:inv.id}})).toBe(1);
  const balances=await prisma.$transaction(tx=>invoiceBalances(tx,inv.id));
  expect(balances.padam.toFixed(2)).toBe("240.00");
 });
});
afterAll(async()=>{
 const orders=await prisma.order.findMany({where:{retailerId:retailer}}),ledger=await prisma.ledgerEntry.findMany({where:{retailerId:retailer}});
 await prisma.sapOutbox.deleteMany({where:{referenceId:{in:[...orders,...ledger].map(r=>r.id)}}});
 await prisma.financialLedgerEntry.deleteMany({where:{retailerId:retailer}});
 await prisma.collectionSubmission.deleteMany({where:{retailerId:retailer}});
 await prisma.collectionAssignment.deleteMany({where:{retailerId:retailer}});
 await prisma.paymentAllocation.deleteMany({where:{payment:{retailerId:retailer}}});
 await prisma.ledgerEntry.deleteMany({where:{retailerId:retailer,type:"payment"}});
 await prisma.payment.deleteMany({where:{retailerId:retailer}});
 await prisma.invoiceLine.deleteMany({where:{invoice:{retailerId:retailer}}});
 await prisma.invoice.deleteMany({where:{retailerId:retailer}});await prisma.ledgerEntry.deleteMany({where:{retailerId:retailer}});
 await prisma.delivery.deleteMany({where:{order:{retailerId:retailer}}});await prisma.dispatchAuthorization.deleteMany({where:{order:{retailerId:retailer}}});
 await prisma.approvalRequest.deleteMany({where:{retailerId:retailer}});await prisma.creditDecisionComparison.deleteMany({where:{retailerId:retailer}});await prisma.creditAssessment.deleteMany({where:{retailerId:retailer}});
 await prisma.orderItem.deleteMany({where:{order:{retailerId:retailer}}});await prisma.order.deleteMany({where:{retailerId:retailer}});
 await prisma.commercialQuote.deleteMany({where:{retailerId:retailer}});await prisma.creditProfile.deleteMany({where:{retailerId:retailer}});await prisma.retailer.deleteMany({where:{id:retailer}});
 await prisma.priceList.deleteMany({where:{variantId:{in:variants}}});await prisma.inventorySnapshot.deleteMany({where:{productId:product}});
 await prisma.variant.deleteMany({where:{id:{in:variants}}});await prisma.product.deleteMany({where:{id:product}});await prisma.tier.deleteMany({where:{id:tier}});
 await prisma.auditEvent.deleteMany({where:{actorStaffId:staff}});await prisma.staffUser.deleteMany({where:{id:staff}});
});
