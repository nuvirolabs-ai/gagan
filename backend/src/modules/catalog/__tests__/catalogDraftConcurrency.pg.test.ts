import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";

const name = `Catalogue concurrency ${randomUUID()}`;
const productIds: string[] = [];

afterAll(async () => {
  await prisma.variant.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
});

describe("catalogue identity indexes on PostgreSQL", () => {
  it("permits different case counts but rejects normalized duplicate packs under concurrent writes", async () => {
    const product = await prisma.product.create({ data: { name, category: "Test", catalogStatus: "pending_review" } });
    productIds.push(product.id);
    const base = { productId: product.id, unitSize: "500 GM", unit: "g", unitWeightKg: 0.5, catalogStatus: "pending_review" };
    const allowed = await Promise.all([20, 60].map((unitsPerCase) => prisma.variant.create({ data: { ...base, unitsPerCase } })));
    expect(allowed).toHaveLength(2);
    const same = await Promise.allSettled([
      prisma.variant.create({ data: { ...base, unitSize: " 500 gm ", unitsPerCase: 30 } }),
      prisma.variant.create({ data: { ...base, unitSize: "500 GM", unitsPerCase: 30 } }),
    ]);
    expect(same.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(same.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.variant.count({ where: { productId: product.id } })).toBe(3);
  });

  it("rejects concurrent case-and-trim variants of a product name", async () => {
    const attempts = await Promise.allSettled([
      prisma.product.create({ data: { name: `${name} second`, category: "Test", catalogStatus: "pending_review" } }),
      prisma.product.create({ data: { name: ` ${name.toUpperCase()} SECOND `, category: "Test", catalogStatus: "pending_review" } }),
    ]);
    const created = attempts.filter((result) => result.status === "fulfilled");
    productIds.push(...created.map((result) => result.value.id));
    expect(created).toHaveLength(1);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
