import {randomInt,randomUUID} from "node:crypto";
import {afterAll,describe,it,expect} from "vitest";
import {prisma} from "../../../lib/prisma";
import {applyImport,previewImport} from "../importService";
const prefix="IMPORT-"+randomUUID(),actor="local-import-uat";
const jobs:string[]=[];
const names:string[]=[];
async function fixture(suffix:string){
 const name=prefix+"-"+suffix;names.push(name+"A",name+"B");
 const csv="product_name,category,unit_size,unit,units_per_case,unit_weight_kg\n"+[name+"A",name+"B"].map(name=>`${name},Test,1kg,kg,1,1`).join("\n");
 const preview=await previewImport(prisma,{type:"products",fileName:"local.csv",buffer:Buffer.from(csv),mode:"create_only",actorStaffId:actor});
 jobs.push(preview.job.id);return {id:preview.job.id,name};
}
afterAll(async()=>{
 const staff=await prisma.staffUser.findMany({where:{employeeRef:{startsWith:prefix}}});
 await prisma.staffUser.deleteMany({where:{id:{in:staff.map(row=>row.id)}}});
 await prisma.salesRep.deleteMany({where:{id:{in:staff.flatMap(row=>row.salesRepId?[row.salesRepId]:[])}}});
 await prisma.auditEvent.deleteMany({where:{OR:[{subjectId:{in:jobs}},{actorStaffId:actor}]}});
 await prisma.importJob.deleteMany({where:{id:{in:jobs}}});
 await prisma.variant.deleteMany({where:{product:{name:{in:names}}}});
 await prisma.product.deleteMany({where:{name:{in:names}}});
});
describe("Import Center ownership on PostgreSQL",()=>{
 it("manager-link retry does not recreate the already-applied salesperson identity",async()=>{
  const manager=await prisma.staffUser.create({data:{name:prefix,phone:randomUUID(),email:`manager-${prefix}@uat.invalid`,employeeRef:prefix+"-manager"}});
  const employeeRef=prefix+"-employee";
  const phone=`9${randomInt(100000000,999999999)}`;
  const preview=await previewImport(prisma,{type:"salespeople",mode:"create_only",actorStaffId:actor,fileName:"staff.csv",buffer:Buffer.from(`name,phone,email,employee_ref,manager_employee_ref\nUAT,${phone},${prefix}@uat.invalid,${employeeRef},${manager.employeeRef}`)});
  jobs.push(preview.job.id);
  const interrupted=prisma.$extends({query:{auditEvent:{async create({args,query}){
   if(args.data.action==="staff.manager_changed") throw new Error("manager audit interrupted");return query(args);
  }}}});
  expect((await applyImport(interrupted as typeof prisma,preview.job.id,actor,true)).job.status).toBe("completed_with_errors");
  const first=await prisma.staffUser.findUniqueOrThrow({where:{employeeRef}});expect(first.managerId).toBeNull();
  expect((await applyImport(prisma,preview.job.id,actor,true)).job.status).toBe("completed");
  const final=await prisma.staffUser.findUniqueOrThrow({where:{employeeRef}});
  expect(final.id).toBe(first.id);expect(final.salesRepId).toBe(first.salesRepId);expect(final.managerId).toBe(manager.id);
 });
 it("row failure preserves successful progress and retry skips already-applied rows",async()=>{
  const job=await fixture("partial");
  const interrupted=prisma.$extends({query:{product:{async create({args,query}){
   if(args.data.name===job.name+"B") throw new Error("temporary row failure");
   return query(args);
  }}}});
  expect((await applyImport(interrupted as typeof prisma,job.id,actor,true)).job.status).toBe("completed_with_errors");
  expect(await prisma.product.count({where:{name:{startsWith:job.name}}})).toBe(1);
  expect((await applyImport(prisma,job.id,actor,true)).job.status).toBe("completed");
  expect(await prisma.product.count({where:{name:{startsWith:job.name}}})).toBe(2);
  expect(await prisma.auditEvent.count({where:{actorStaffId:actor,action:"import.product_applied",metadata:{path:["importJobId"],equals:job.id}}})).toBe(2);
 });
 it("retries the second pack of a new product without IDs after a partial apply",async()=>{
  const name=prefix+"-multi-pack";names.push(name);
  const csv=`product_name,category,unit_size,unit,units_per_case,unit_weight_kg\n${name},Test,500 g,g,20,0.5\n${name},Test,500 g,g,60,0.5`;
  const preview=await previewImport(prisma,{type:"products",fileName:"multi.csv",buffer:Buffer.from(csv),mode:"create_only",actorStaffId:actor});
  jobs.push(preview.job.id);
  expect(preview.summary.validRows).toBe(2);
  const interrupted=prisma.$extends({query:{variant:{async create({args,query}){
   if(args.data.unitsPerCase===60)throw new Error("temporary second-pack failure");return query(args);
  }}}});
  expect((await applyImport(interrupted as typeof prisma,preview.job.id,actor,true)).job.status).toBe("completed_with_errors");
  const first=await prisma.product.findFirstOrThrow({where:{name},include:{variants:true}});
  expect(first.variants.map(variant=>variant.unitsPerCase)).toEqual([20]);
  expect((await applyImport(prisma,preview.job.id,actor,true)).job.status).toBe("completed");
  const final=await prisma.product.findFirstOrThrow({where:{name},include:{variants:true}});
  expect(final.id).toBe(first.id);
  expect(final.variants.map(variant=>variant.unitsPerCase).sort()).toEqual([20,60]);
  expect(final.catalogStatus).toBe("pending_review");
  expect(final.variants.every(variant=>variant.catalogStatus==="pending_review")).toBe(true);
 });
 it("edits a pending variant under an active product without changing active product metadata",async()=>{
  const name=prefix+"-active-parent";names.push(name);
  const product=await prisma.product.create({data:{name,category:"Original",catalogStatus:"active",variants:{create:{unitSize:"500 g",unit:"g",unitsPerCase:20,unitWeightKg:0.5,catalogStatus:"pending_review"}}},include:{variants:true}});
  const csv=`product_name,category,unit_size,unit,units_per_case,unit_weight_kg,product_id,variant_id\n${name},Changed,500 g,g,60,0.5,${product.id},${product.variants[0].id}`;
  const preview=await previewImport(prisma,{type:"products",fileName:"pending-pack.csv",buffer:Buffer.from(csv),mode:"update_only",actorStaffId:actor});
  jobs.push(preview.job.id);
  expect(preview.summary.validRows).toBe(1);
  expect((await applyImport(prisma,preview.job.id,actor,true)).job.status).toBe("completed");
  const saved=await prisma.product.findUniqueOrThrow({where:{id:product.id},include:{variants:true}});
  expect(saved).toMatchObject({category:"Original",catalogStatus:"active"});
  expect(saved.variants[0]).toMatchObject({unitsPerCase:60,catalogStatus:"pending_review"});
 });
 it("revalidates an invalidated preview and does not overwrite a new matching record",async()=>{
  const job=await fixture("invalid");
  await prisma.product.create({data:{name:job.name+"A",category:"Existing",variants:{create:{unitSize:"1kg",unit:"kg",unitsPerCase:2,unitWeightKg:1}}}});
  expect((await applyImport(prisma,job.id,actor,true)).job.status).toBe("completed_with_errors");
  expect((await prisma.product.findFirstOrThrow({where:{name:job.name+"A"}})).category).toBe("Existing");
  expect(await prisma.product.count({where:{name:{startsWith:job.name}}})).toBe(2);
 });
 it("two apply callers return one execution result and one completed audit",async()=>{
  const job=await fixture("race");
  const results=await Promise.all([applyImport(prisma,job.id,actor,true),applyImport(prisma,job.id,actor,true)]);
  expect(results.map(result=>result.job.status)).toEqual(["completed","completed"]);
  expect(await prisma.product.count({where:{name:{startsWith:job.name}}})).toBe(2);
  expect(await prisma.auditEvent.count({where:{subjectId:job.id,action:"import.applied"}})).toBe(1);
  expect((await applyImport(prisma,job.id,actor,true)).job.status).toBe("completed");
  expect(await prisma.auditEvent.count({where:{subjectId:job.id,action:"import.applied"}})).toBe(1);
 });
 it("interruption after row writes rolls back effects and leaves a safe retry",async()=>{
  const job=await fixture("interrupt");
  const interrupted=prisma.$extends({query:{importJob:{async update({args,query}){
   if(args.where.id===job.id && args.data.status==="completed") throw new Error("simulated process interruption");
   return query(args);
  }}}});
  await expect(applyImport(interrupted as typeof prisma,job.id,actor,true)).rejects.toThrow("simulated process interruption");
  expect(await prisma.product.count({where:{name:{startsWith:job.name}}})).toBe(0);
  expect((await prisma.importJob.findUniqueOrThrow({where:{id:job.id}})).status).toBe("preview");
  expect((await applyImport(prisma,job.id,actor,true)).job.status).toBe("completed");
  expect(await prisma.product.count({where:{name:{startsWith:job.name}}})).toBe(2);
 });
});
