import {randomUUID} from "node:crypto";
import {afterAll,describe,it,expect} from "vitest";
import {prisma} from "../../../lib/prisma";
import {createOrderForRetailer} from "../../../lib/orders";
import {enqueueInvoice} from "../../../lib/sap/outbox";
import {createInvoiceForDelivery} from "../invoiceService";
const key=randomUUID(),tier=randomUUID(),retailer=randomUUID(),product=randomUUID(),variant=randomUUID();
afterAll(async()=>{
 const orders=await prisma.order.findMany({where:{retailerId:retailer}});
 const ledger=await prisma.ledgerEntry.findMany({where:{retailerId:retailer}});
 await prisma.sapOutbox.deleteMany({where:{referenceId:{in:[...orders,...ledger].map(row=>row.id)}}});
 await prisma.financialLedgerEntry.deleteMany({where:{retailerId:retailer}});
 await prisma.invoiceLine.deleteMany({where:{invoice:{retailerId:retailer}}});
 await prisma.invoice.deleteMany({where:{retailerId:retailer}});await prisma.ledgerEntry.deleteMany({where:{retailerId:retailer}});
 await prisma.delivery.deleteMany({where:{order:{retailerId:retailer}}});
 await prisma.dispatchAuthorization.deleteMany({where:{order:{retailerId:retailer}}});
 await prisma.approvalRequest.deleteMany({where:{retailerId:retailer}});
 await prisma.creditDecisionComparison.deleteMany({where:{retailerId:retailer}});await prisma.creditAssessment.deleteMany({where:{retailerId:retailer}});
 await prisma.orderItem.deleteMany({where:{order:{retailerId:retailer}}});await prisma.order.deleteMany({where:{retailerId:retailer}});
 await prisma.creditProfile.deleteMany({where:{retailerId:retailer}});await prisma.retailer.deleteMany({where:{id:retailer}});
 await prisma.priceList.deleteMany({where:{variantId:variant}});await prisma.inventorySnapshot.deleteMany({where:{productId:product}});
 await prisma.variant.deleteMany({where:{id:variant}});await prisma.product.deleteMany({where:{id:product}});await prisma.tier.deleteMany({where:{id:tier}});
});
describe("accepted historical case conversion",()=>{
 it("30kg accepted case remains 30kg after master becomes 60kg, including invoice/SAP replay",async()=>{
  await prisma.tier.create({data:{id:tier,name:key}});
  await prisma.retailer.create({data:{id:retailer,name:key,phone:key,shopAddress:"Local",tierId:tier,creditLimit:500000,sapCustomerId:`UAT-${key}`}});
  await prisma.creditProfile.create({data:{retailerId:retailer,rating:"N",kycVerifiedAt:new Date()}});
  await prisma.product.create({data:{id:product,name:key,category:"Local",sapMaterialId:key,variants:{create:{id:variant,unit:"kg",unitSize:"1kg",unitsPerCase:30,unitWeightKg:1}}}});
  await prisma.priceList.create({data:{tierId:tier,productId:product,variantId:variant,price:3000}});
  await prisma.inventorySnapshot.create({data:{productId:product,variantId:variant,sapMaterialId:key,warehouseCode:"WH-001",onHand:100,available:100,status:"available",syncedAt:new Date()}});
  const result=await createOrderForRetailer(retailer,[{variantId:variant,qty:1}],"retailer",undefined,undefined,key);
  expect(result.ok).toBe(true);if(!result.ok) throw new Error(JSON.stringify(result.body));
  const order=result.order;
  expect(Number(order.items[0].caseWeightKgSnapshot)).toBe(30);
  await expect(prisma.orderItem.update({where:{id:order.items[0].id},data:{caseWeightKgSnapshot:60}})).rejects.toThrow();
  await prisma.variant.update({where:{id:variant},data:{unitsPerCase:60}});
  // Fixture transition: this test isolates billing, not employee UI lifecycle acceptance.
  await prisma.order.update({where:{id:order.id},data:{status:"out_for_delivery"}});
  const invoice=await createInvoiceForDelivery({orderId:order.id,idempotencyKey:key,occurredAt:new Date(),lines:[{orderItemId:order.items[0].id,deliveredCases:1,deliveredWeightKg:30}]});
  expect(Number(invoice.total)).toBe(3000);
  const ledger=await prisma.ledgerEntry.findFirstOrThrow({where:{orderId:order.id,type:"invoice"}});
  const first=await prisma.sapOutbox.findUniqueOrThrow({where:{kind_referenceId:{kind:"invoice",referenceId:ledger.id}}});
  expect(first.payload).toMatchObject({amount:3000,lines:[{lineTotal:3000,billedWeightKg:30}]});
  await prisma.variant.update({where:{id:variant},data:{unitWeightKg:2}});
  await enqueueInvoice(prisma,ledger.id);
  const retry=await prisma.sapOutbox.findUniqueOrThrow({where:{kind_referenceId:{kind:"invoice",referenceId:ledger.id}}});
  expect(retry.payload).toEqual(first.payload);
  expect(Number((await prisma.invoice.findUniqueOrThrow({where:{id:invoice.id}})).total)).toBe(3000);
 });
 it("does not silently reinterpret a legacy ledger-only invoice after master change",async()=>{
  const order=await prisma.order.create({data:{retailerId:retailer,status:"delivered",orderTotal:3000,items:{create:{variantId:variant,qtyOrdered:1,qtyDelivered:1,weightDelivered:30,unitPrice:3000}}},include:{items:true}});
  expect(order.items[0].caseWeightKgSnapshot).toBeNull();
  const entry=await prisma.ledgerEntry.create({data:{retailerId:retailer,orderId:order.id,type:"invoice",amount:3000,balanceAfter:3000}});
  await expect(enqueueInvoice(prisma,entry.id)).rejects.toThrow("legacy_invoice_conversion_review_required");
  expect(Number((await prisma.ledgerEntry.findUniqueOrThrow({where:{id:entry.id}})).amount)).toBe(3000);
  expect(await prisma.sapOutbox.count({where:{referenceId:entry.id}})).toBe(0);
 });
});
