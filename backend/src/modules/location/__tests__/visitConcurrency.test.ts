import {randomUUID} from "node:crypto";
import {beforeAll,afterAll,beforeEach,describe,it,expect} from "vitest";
import {prisma} from "../../../lib/prisma";
import {LocationService} from "../locationService";
import {RouteService} from "../../field/routeService";
import {startOfDay} from "../../field/fieldDomain";
const key=randomUUID(),staff=randomUUID(),rep=randomUUID(),tier=randomUUID(),stores=[randomUUID(),randomUUID()];
const config={maxAccuracyMeters:50,verifiedRadiusMeters:150,reviewRadiusMeters:500};
const input=(retailerId=stores[0])=>({salespersonId:staff,retailerId,latitude:18.52,longitude:73.85,accuracyMeters:10});
const service=new LocationService(prisma,config,{afterCheckIn:(visit,tx)=>new RouteService(prisma).linkVisitToPlannedStop({visitId:visit.id,...visit},tx)});
beforeAll(async()=>{
 await prisma.salesRep.create({data:{id:rep,name:key,phone:key}});
 await prisma.staffUser.create({data:{id:staff,name:key,phone:key,email:`${key}@uat.invalid`,salesRepId:rep}});
 await prisma.tier.create({data:{id:tier,name:key}});
 for(const id of stores) await prisma.retailer.create({data:{id,name:id,phone:id,shopAddress:"Local UAT",tierId:tier,salesRepId:rep}});
});
beforeEach(async()=>{await prisma.salesVisit.deleteMany({where:{salespersonId:staff}});await prisma.routePlan.deleteMany({where:{salespersonId:staff}});});
afterAll(async()=>{
 await prisma.salesVisit.deleteMany({where:{salespersonId:staff}});await prisma.routePlan.deleteMany({where:{salespersonId:staff}});
 await prisma.retailer.deleteMany({where:{id:{in:stores}}});await prisma.tier.delete({where:{id:tier}});
 await prisma.staffUser.delete({where:{id:staff}});await prisma.salesRep.delete({where:{id:rep}});
});
describe("single-open visit on PostgreSQL",()=>{
 it("same retailer parallel calls and response retry use one intended visit and route stop",async()=>{
  const plan=await prisma.routePlan.create({data:{salespersonId:staff,planDate:startOfDay(new Date()),status:"published",stops:{create:{retailerId:stores[0],sequence:1}}},include:{stops:true}});
  const visits=await Promise.all([service.checkIn(input()),service.checkIn(input())]);
  expect(visits[0].id).toBe(visits[1].id);
  expect((await service.checkIn(input())).id).toBe(visits[0].id);
  expect(await prisma.salesVisit.count({where:{salespersonId:staff,checkedOutAt:null}})).toBe(1);
  expect(visits[0].routeStopId).toBe(plan.stops[0].id);
  const before=await prisma.routePlanStop.findUniqueOrThrow({where:{id:plan.stops[0].id}});
  expect(before.status).toBe("pending");
  expect(before.visitedAt).toBeNull();
 });
 it("parallel different stores cannot leave two open visits",async()=>{
  const outcomes=await Promise.allSettled(stores.map(id=>service.checkIn(input(id))));
  expect(outcomes.filter(outcome=>outcome.status==="fulfilled")).toHaveLength(1);
  expect(await prisma.salesVisit.count({where:{salespersonId:staff,checkedOutAt:null}})).toBe(1);
 });
 it("a failed route collaborator rolls back the visit",async()=>{
  const plan=await prisma.routePlan.create({data:{salespersonId:staff,planDate:startOfDay(new Date()),status:"published",stops:{create:{retailerId:stores[0],sequence:1}}},include:{stops:true}});
  const failing=new LocationService(prisma,config,{afterCheckIn:async(visit,tx)=>{
   await new RouteService(prisma).linkVisitToPlannedStop({visitId:visit.id,...visit},tx);
   throw new Error("route failure");
  }});
  await expect(failing.checkIn(input())).rejects.toThrow("route failure");
  expect(await prisma.salesVisit.count({where:{salespersonId:staff}})).toBe(0);
  expect((await prisma.routePlanStop.findUniqueOrThrow({where:{id:plan.stops[0].id}})).status).toBe("pending");
 });
 it("database invariant also rejects writers bypassing the service",async()=>{
  await service.checkIn(input());
  await expect(prisma.salesVisit.create({data:{salespersonId:staff,retailerId:stores[1],checkInLatitude:18.52,checkInLongitude:73.85,checkInAccuracyMeters:10,verificationStatus:"STORE_LOCATION_NOT_AVAILABLE"}})).rejects.toMatchObject({code:"P2002"});
 });
 it("closing allows a later legitimate visit, with one winning checkout",async()=>{
  const visit=await service.checkIn(input());
  const results=await Promise.allSettled([service.checkOut({...input(),visitId:visit.id,outcome:"no_order",noOrderReason:"already_has_stock"}),service.checkOut({...input(),visitId:visit.id,outcome:"no_order",noOrderReason:"already_has_stock"})]);
  expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
  expect((await service.checkIn(input(stores[1]))).id).not.toBe(visit.id);
 });
 it("order activity does not settle a route stop; successful checkout does once",async()=>{
  const plan=await prisma.routePlan.create({data:{salespersonId:staff,planDate:startOfDay(new Date()),status:"published",stops:{create:{retailerId:stores[0],sequence:1}}},include:{stops:true}});
  const visit=await service.checkIn(input());
  expect((await prisma.routePlanStop.findUniqueOrThrow({where:{id:plan.stops[0].id}})).status).toBe("pending");
  const results=await Promise.allSettled([service.checkOut({...input(),visitId:visit.id,outcome:"no_order",noOrderReason:"already_has_stock"}),service.checkOut({...input(),visitId:visit.id,outcome:"no_order",noOrderReason:"already_has_stock"})]);
  expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
  const stop=await prisma.routePlanStop.findUniqueOrThrow({where:{id:plan.stops[0].id}});
  expect(stop.status).toBe("visited");
  expect(stop.visitedAt).not.toBeNull();
 });
 it("cannot skip a route stop while its visit is active",async()=>{
  const plan=await prisma.routePlan.create({data:{salespersonId:staff,planDate:startOfDay(new Date()),status:"published",stops:{create:{retailerId:stores[0],sequence:1}}},include:{stops:true}});
  await service.checkIn(input());
  await expect(new RouteService(prisma).skipStop({stopId:plan.stops[0].id,salespersonId:staff,reason:"Closed"})).rejects.toMatchObject({code:"route_stop_visit_active"});
  expect((await prisma.routePlanStop.findUniqueOrThrow({where:{id:plan.stops[0].id}})).status).toBe("pending");
 });
 it("stores multiple outcomes and rejects an unexplained sales visit atomically",async()=>{
  const visit=await service.checkIn(input());
  await expect(service.checkOut({...input(),visitId:visit.id,outcomes:["payment_collected","task_completed"]})).rejects.toMatchObject({code:"no_order_reason_required"});
  expect((await prisma.salesVisit.findUniqueOrThrow({where:{id:visit.id}})).checkedOutAt).toBeNull();
  const closed=await service.checkOut({...input(),visitId:visit.id,outcomes:["payment_collected","task_completed"],noOrderReason:"already_has_stock"});
  expect(closed.outcomes).toEqual(["payment_collected","task_completed"]);
  expect(closed.noOrderReason).toBe("already_has_stock");
  expect(closed.outcome).toBe("payment_collected");
 });
});
