import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";

const id = randomUUID(), staffId = randomUUID();
const email = `${id}@test.invalid`, password = randomUUID();
const app = createApp();
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.includes("test")) throw new Error("Disposable local test DB required");
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
  await prisma.adminUser.create({ data: { id, email, name: "Auth regression", passwordHash: await bcrypt.hash(password, 10) } });
  await prisma.staffUser.create({ data: { id: staffId, email, phone: staffId, name: "Auth regression", adminUserId: id, roles: { create: { roleId: role.id } } } });
});
afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: staffId } });
  await prisma.staffRole.deleteMany({ where: { staffId } });
  await prisma.staffUser.deleteMany({ where: { id: staffId } });
  await prisma.adminUser.deleteMany({ where: { id } });
});

it("logs in, refreshes, exposes current survey permissions and revokes restoration on logout", async () => {
  const login = await request(app).post("/admin/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  expect(login.body).not.toHaveProperty("refreshToken");
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  const refresh = await request(app).post("/admin/auth/refresh").set("X-Gagan-Client", "admin-web").set("Cookie", cookie);
  expect(refresh.status).toBe(200);
  const me = await request(app).get("/admin/auth/me").set("Authorization", `Bearer ${refresh.body.accessToken}`);
  expect(me.status).toBe(200);
  expect(me.body.permissions).toEqual(expect.arrayContaining(["survey.manage", "survey.responses_view"]));
  expect(me.body.staffId).toBe(staffId);
  const rotated = refresh.headers["set-cookie"][0].split(";")[0];
  const logout = await request(app).post("/admin/auth/logout").set("Authorization", `Bearer ${refresh.body.accessToken}`);
  expect(logout.status).toBe(204);
  const revoked = await request(app).post("/admin/auth/refresh").set("X-Gagan-Client", "admin-web").set("Cookie", rotated);
  expect(revoked.status).toBe(401);
  const invalid = await request(app).post("/admin/auth/refresh").set("X-Gagan-Client", "admin-web").set("Cookie", "gagan_admin_refresh=invalid-refresh-token-not-a-session");
  expect(invalid.status).toBe(401);
});
