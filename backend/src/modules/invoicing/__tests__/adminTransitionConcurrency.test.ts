import "express-async-errors";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll,beforeAll,describe,it,expect,vi } from "vitest";
import { prisma } from "../../../lib/prisma";
vi.mock("../../../lib/adminAuth",()=>({requireAdmin:(_req:unknown,_res:unknown,next:()=>void)=>next()}));
import routes from "../../../routes/admin/orders";
import { ApprovalService } from "../../approvals/approvalService";
import { DisputeService } from "../../approvals/disputeService";
const app=express();app.use(express.json(),routes);
const key=randomUUID(),tier=randomUUID(),retailer=randomUUID();
const orderIds:string[]=[];
beforeAll(async()=>{
 await prisma.tier.create({data:{id:tier,name:key}});
 await prisma.retailer.create({data:{id:retailer,tierId:tier,name:"State race UAT",phone:key,shopAddress:"Local"}});
});
afterAll(async()=>{
 await prisma.approvalDispute.deleteMany({where:{approvalRequest:{orderId:{in:orderIds}}}});
 await prisma.approvalRequest.deleteMany({where:{orderId:{in:orderIds}}});
 await prisma.dispatchAuthorization.deleteMany({where:{orderId:{in:orderIds}}});
 await prisma.creditAssessment.deleteMany({where:{orderId:{in:orderIds}}});
 await prisma.order.deleteMany({where:{id:{in:orderIds}}});
 await prisma.retailer.delete({where:{id:retailer}});await prisma.tier.delete({where:{id:tier}});
});
async function fixture(status:"placed"|"confirmed") {
 const order=await prisma.order.create({data:{retailerId:retailer,status,orderTotal:100}});orderIds.push(order.id);
 const policy=await prisma.creditPolicyVersion.findFirstOrThrow({where:{active:true}});
 const assessment=await prisma.creditAssessment.create({data:{retailerId:retailer,orderId:order.id,policyVersionId:policy.id,result:"allowed",projectedExposure:100,snapshot:{},reasons:[]}});
 await prisma.dispatchAuthorization.create({data:{orderId:order.id,assessmentId:assessment.id,version:1,reason:"Local UAT"}});
 return order;
}
describe("Admin state compare-and-set against real PostgreSQL",()=>{
 it("late credit rejection and dispute resolution cannot rewind a progressed order",async()=>{
  const order=await fixture("confirmed");
  const assessment=await prisma.creditAssessment.findFirstOrThrow({where:{orderId:order.id}});
  const approval=await prisma.approvalRequest.create({data:{
   retailerId:retailer,orderId:order.id,assessmentId:assessment.id,subjectType:"order",subjectId:order.id,
   approvalType:"third_invoice",requiredPermission:"approval.third_invoice",
  }});
  await expect(new ApprovalService().decide(approval.id,{
   actorStaffId:"credit-lead-1",actorPermissions:["approval.third_invoice"],result:"rejected",reason:"late review",
  })).rejects.toMatchObject({code:"order_transition_conflict"});
  const dispute=await prisma.approvalDispute.create({data:{approvalRequestId:approval.id,raisedByStaffId:"sales-coordinator-1",writtenPosition:"local race",acknowledgmentDueAt:new Date()}});
  await expect(new DisputeService().resolve(dispute.id,{
   actorStaffId:"credit-lead-1",actorPermissions:["approval.third_invoice"],outcome:"rejected",resolution:"late review",
  })).rejects.toMatchObject({code:"order_transition_conflict"});
  expect((await prisma.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe("confirmed");
  expect((await prisma.approvalRequest.findUniqueOrThrow({where:{id:approval.id}})).status).toBe("open");
  expect((await prisma.approvalDispute.findUniqueOrThrow({where:{id:dispute.id}})).status).toBe("open");
 });
 it.each([
  ["placed","approve","reject"],["confirmed","pack","reject"],
  ["placed","approve","approve"],["confirmed","pack","pack"],
 ] as const)("%s: simultaneous %s / %s has one accepted decision",async(status,first,second)=>{
  const order=await fixture(status);
  // Pause only the two initial reads to reproduce the original stale-state window.
  const read=prisma.order.findUnique.bind(prisma.order);
  let arrived=0;let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
  const spy=vi.spyOn(prisma.order,"findUnique").mockImplementation((async(args:any)=>{
    const result=await read(args);
    if(args.where.id===order.id && ++arrived<=2) {if(arrived===2) release();await barrier;}
    return result;
  }) as typeof prisma.order.findUnique);
  let results:request.Response[];
  try {results=await Promise.all([request(app).post(`/orders/${order.id}/${first}`),request(app).post(`/orders/${order.id}/${second}`)]);} finally {spy.mockRestore();}
  expect(results!.map(result=>result.status).sort()).toEqual([200,409]);
  const audits=await prisma.auditEvent.findMany({where:{subjectId:order.id,action:{startsWith:"order."}}});
  expect(audits).toHaveLength(1);
  expect(audits[0].metadata).toMatchObject({from:status});
  expect((await prisma.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe((audits[0].metadata as {to:string}).to);
 });
});
