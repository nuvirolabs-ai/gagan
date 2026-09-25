import { PrismaClient } from "@prisma/client";
const url=new URL(process.env.DATABASE_URL ?? "invalid:");
if(!["localhost","127.0.0.1"].includes(url.hostname) || !url.pathname.startsWith("/gagan_uat_") || process.env.NODE_ENV==="production") throw new Error("Dedicated local UAT database required");
const db=new PrismaClient();
async function run(){
 const tiers=await db.tier.findMany();
 for(const [index,name] of ["Wave1B Jain Rice (LOCAL UAT)","Wave1B Padam Dal (LOCAL UAT)"].entries()){
  const productId=`11111111-1111-4111-8111-${String(index+1).padStart(12,"0")}`;
  const variantId=`22222222-2222-4222-8222-${String(index+1).padStart(12,"0")}`;
  const product=await db.product.upsert({where:{id:productId},update:{},create:{id:productId,name,category:"Wave1B UAT",sapMaterialId:`LOCAL-W1B-${index+1}`}});
  await db.variant.upsert({where:{id:variantId},update:{},create:{id:variantId,productId,unitSize:"1 kg",unit:"kg",unitsPerCase:30,unitWeightKg:1}});
  for(const t of tiers)await db.priceList.upsert({where:{tierId_variantId:{tierId:t.id,variantId}},update:{},create:{tierId:t.id,variantId,productId,price:3000}});
  await db.inventorySnapshot.upsert({where:{sapMaterialId_warehouseCode:{sapMaterialId:product.sapMaterialId!,warehouseCode:"WH-001"}},update:{syncedAt:new Date()},create:{productId,variantId,sapMaterialId:product.sapMaterialId!,warehouseCode:"WH-001",onHand:100,available:100,status:"available",source:"local_uat",syncedAt:new Date()}});
 }
 console.log("Local Wave1B products/stock prepared. Company, rate basis and GST still require normal Admin configuration.");
}
run().finally(()=>db.$disconnect());
