import { randomInt, randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { applyImport, previewImport } from "../importService";

const suffix = randomUUID();
const actor = `retailer-phone-import-${suffix}`;
const phone = `9${randomInt(100000000, 999999999)}`;
let retailerId: string | null = null;
let jobId: string | null = null;

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { actorStaffId: actor } });
  if (jobId) await prisma.importJob.delete({ where: { id: jobId } });
  if (retailerId) await prisma.retailer.delete({ where: { id: retailerId } });
});

it("updates a legacy-phone retailer without creating a second canonical identity", async () => {
  const tier = await prisma.tier.findFirstOrThrow();
  const retailer = await prisma.retailer.create({
    data: { name: `UAT legacy ${suffix}`, phone, shopAddress: "UAT Road", tierId: tier.id },
  });
  retailerId = retailer.id;
  const csv = `name,phone,shop_address,tier\nUAT updated ${suffix},${phone},UAT Road,${tier.name}\n`;
  const preview = await previewImport(prisma, {
    type: "retailers", fileName: "uat-legacy-phone.csv", buffer: Buffer.from(csv), mode: "update_only", actorStaffId: actor,
  });
  jobId = preview.job.id;
  expect(preview.summary).toMatchObject({ totalRows: 1, validRows: 1, failedRows: 0 });
  expect(preview.rows[0].match?.id).toBe(retailer.id);

  const applied = await applyImport(prisma, preview.job.id, actor, true);
  expect(applied.job.status).toBe("completed");
  expect(await prisma.retailer.findUniqueOrThrow({ where: { id: retailer.id } }))
    .toMatchObject({ name: `UAT updated ${suffix}`, phone });
  expect(await prisma.retailer.count({ where: { phone: { in: [phone, `+91${phone}`] } } })).toBe(1);
});
