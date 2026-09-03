import { prisma } from "../../lib/prisma";

export const INDORE_GROUPS = [
  "Kirana Independent",
  "Wholesale Kirana",
  "Modern Trade",
  "HORECA",
  "Institutional",
];

export const INDORE_TRANSPORTERS = [
  "VRL Logistics Indore",
  "Gati KWE",
  "Associated Road Carriers",
  "TCI Freight",
  "Local Tempo Palasia",
  "Local Tempo Sanwer Road Mandi",
];

export const INDORE_BEATS: Array<{ name: string; city: string }> = [
  { name: "Palasia / New Palasia", city: "Indore" },
  { name: "Rajwada / Sarafa", city: "Indore" },
  { name: "Vijay Nagar", city: "Indore" },
  { name: "Bhawarkua", city: "Indore" },
  { name: "MG Road", city: "Indore" },
  { name: "Sudama Nagar", city: "Indore" },
  { name: "Sapna Sangeeta", city: "Indore" },
  { name: "Rau / Mhow", city: "Indore" },
  { name: "Sanwer Road Mandi", city: "Indore" },
  { name: "Chhoti Gwaltoli", city: "Indore" },
];

export const INDORE_BUYER_CATEGORIES: Array<{ name: string; subCategories: string[] }> = [
  { name: "Retailer", subCategories: ["Kirana", "General Store", "Supermarket"] },
  { name: "Wholesaler", subCategories: ["City Wholesale", "Mandi Wholesale"] },
  { name: "Modern Trade", subCategories: ["Local Chain", "National Chain"] },
  { name: "HORECA", subCategories: ["Hotel", "Restaurant", "Caterer"] },
];

type MastersDb = Pick<
  typeof prisma,
  "retailerGroup" | "transporter" | "beat" | "buyerCategory" | "buyerSubCategory" | "salesRep"
>;

export async function ensureRetailerMasters(db: MastersDb = prisma) {
  if ((await db.retailerGroup.count()) === 0) {
    await db.retailerGroup.createMany({ data: INDORE_GROUPS.map((name) => ({ name })) });
  }
  if ((await db.transporter.count()) === 0) {
    await db.transporter.createMany({ data: INDORE_TRANSPORTERS.map((name) => ({ name })) });
  }
  if ((await db.beat.count()) === 0) {
    await db.beat.createMany({ data: INDORE_BEATS });
  }
  if ((await db.buyerCategory.count()) === 0) {
    for (const category of INDORE_BUYER_CATEGORIES) {
      await db.buyerCategory.create({
        data: {
          name: category.name,
          subCategories: { create: category.subCategories.map((name) => ({ name })) },
        },
      });
    }
  }
}

export async function listRetailerMasters(db: MastersDb = prisma) {
  await ensureRetailerMasters(db);
  const [groups, transporters, beats, buyerCategories, salesmen] = await Promise.all([
    db.retailerGroup.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.transporter.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.beat.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    db.buyerCategory.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        subCategories: {
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    db.salesRep.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, phone: true, territory: true } }),
  ]);

  return {
    groups,
    transporters,
    beats,
    buyerCategories,
    salesmen,
    grades: ["A", "B", "C", "D"] as const,
    paymentTerms: [7, 15, 21, 30, 45] as const,
  };
}
