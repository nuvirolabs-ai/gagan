import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const run = randomUUID().replace(/\D/g, "").slice(0, 8);
const app = createApp();

let retailerId = "";
let retailerPhone = "";
let staffId = "";
let staffPhone = "";
let salesRepId = "";

beforeAll(async () => {
  const tier = await prisma.tier.findFirstOrThrow();
  retailerPhone = `+9191${run}`;
  const retailer = await prisma.retailer.create({
    data: {
      id: randomUUID(),
      name: `Retailer MSG91 ${run}`,
      phone: retailerPhone,
      shopAddress: "123 Main St",
      tierId: tier.id,
    },
  });
  retailerId = retailer.id;

  staffPhone = `+9192${run}`;
  const repRole =
    (await prisma.role.findFirst({ where: { name: "salesperson" } })) ??
    (await prisma.role.findFirst({ where: { name: "sales_rep" } }));

  const salesRep = await prisma.salesRep.create({
    data: {
      id: randomUUID(),
      name: `Rep MSG91 ${run}`,
      phone: staffPhone,
    },
  });
  salesRepId = salesRep.id;

  const staff = await prisma.staffUser.create({
    data: {
      id: randomUUID(),
      name: `Staff MSG91 ${run}`,
      email: `staff-msg91-${run}@test.invalid`,
      phone: staffPhone,
      salesRepId: salesRep.id,
      roles: repRole ? { create: { roleId: repRole.id } } : undefined,
    },
  });
  staffId = staff.id;
});

afterAll(async () => {
  await prisma.staffRole.deleteMany({ where: { staffId } }).catch(() => {});
  await prisma.staffUser.delete({ where: { id: staffId } }).catch(() => {});
  await prisma.salesRep.delete({ where: { id: salesRepId } }).catch(() => {});
  await prisma.retailer.delete({ where: { id: retailerId } }).catch(() => {});
});

describe("MSG91 Auth Integration", () => {
  describe("Retailer Auth: POST /auth/msg91/verify", () => {
    it("returns 400 when access token is missing", async () => {
      const res = await request(app)
        .post("/auth/msg91/verify")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("missing_token");
    });

    it("auto-provisions and returns session when phone is not yet registered as a retailer", async () => {
      const res = await request(app)
        .post("/auth/msg91/verify")
        .send({
          accessToken: "mock_token_unregistered",
          phone: "9999900000",
        });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.retailer).toBeDefined();
      expect(res.body.retailer.phone).toBe("9999900000");
    });

    it("successfully creates session and returns tokens for registered retailer", async () => {
      const res = await request(app)
        .post("/auth/msg91/verify")
        .send({
          accessToken: "mock_valid_token",
          phone: retailerPhone,
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.retailer.id).toBe(retailerId);
      expect(res.body.retailer.name).toBe(`Retailer MSG91 ${run}`);

      // Verify the returned token works against /auth/me
      const meRes = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.retailer.id).toBe(retailerId);
    });
  });

  describe("Salesperson Auth: POST /rep/auth/msg91/verify", () => {
    it("returns 400 when access token is missing", async () => {
      const res = await request(app)
        .post("/rep/auth/msg91/verify")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("missing_token");
    });

    it("auto-provisions and returns session when phone is not yet registered as staff", async () => {
      const res = await request(app)
        .post("/rep/auth/msg91/verify")
        .send({
          accessToken: "mock_token_unregistered_staff",
          phone: "9999911111",
        });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.staff).toBeDefined();
      expect(res.body.staff.phone).toBe("9999911111");
    });

    it("successfully creates session and returns staff details for registered salesperson", async () => {
      const res = await request(app)
        .post("/rep/auth/msg91/verify")
        .send({
          accessToken: "mock_valid_staff_token",
          phone: staffPhone,
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.staff.id).toBe(staffId);
      expect(res.body.rep.id).toBe(salesRepId);

      // Verify the returned token works against /rep/me
      const meRes = await request(app)
        .get("/rep/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.staff.id).toBe(staffId);
    });
  });
});
