import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { IssueService } from "../issueService";

const tierId = randomUUID();
const retailers = [randomUUID(), randomUUID()];
const salesReps = [randomUUID(), randomUUID()];
const staff = [randomUUID(), randomUUID()];
const service = new IssueService(prisma);

beforeAll(async () => {
  await prisma.tier.create({ data: { id: tierId, name: `feedback-v2-${tierId}` } });
  for (let index = 0; index < salesReps.length; index++) {
    await prisma.salesRep.create({ data: { id: salesReps[index], name: `Feedback V2 Rep ${index}`, phone: salesReps[index] } });
    await prisma.staffUser.create({ data: { id: staff[index], name: `Feedback V2 Staff ${index}`, phone: staff[index], email: `${staff[index]}@example.test`, salesRepId: salesReps[index] } });
    await prisma.retailer.create({ data: { id: retailers[index], name: `Feedback V2 ${retailers[index]}`, phone: retailers[index], shopAddress: "Disposable local test", tierId, salesRepId: salesReps[index] } });
  }
});
afterAll(async () => {
  const ids = (await prisma.serviceIssue.findMany({ where: { retailerId: { in: retailers } }, select: { id: true } })).map(({ id }) => id);
  await prisma.customerActivity.deleteMany({ where: { serviceIssueId: { in: ids } } });
  await prisma.auditEvent.deleteMany({ where: { subjectType: "service_issue", subjectId: { in: ids } } });
  await prisma.serviceIssue.deleteMany({ where: { retailerId: { in: retailers } } });
  await prisma.retailer.deleteMany({ where: { id: { in: retailers } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: staff } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: salesReps } } });
  await prisma.tier.delete({ where: { id: tierId } });
});

describe("retailer service requests on disposable PostgreSQL", () => {
  it("serializes identical create retries and rejects changed payloads", async () => {
    const clientReference = `feedback-${randomUUID()}`;
    const [first, second] = await Promise.all([
      service.raiseRetailerRequest({ retailerId: retailers[0], description: "Need delivery update", clientReference }),
      service.raiseRetailerRequest({ retailerId: retailers[0], description: "Need delivery update", clientReference }),
    ]);
    expect(first.id).toBe(second.id);
    expect(await prisma.serviceIssue.count({ where: { retailerId: retailers[0], clientReference } })).toBe(1);
    await expect(service.raiseRetailerRequest({ retailerId: retailers[0], description: "Different request", clientReference })).rejects.toMatchObject({ code: "idempotency_payload_conflict" });
  });
  it("scope, terminal state and withdrawal audit survive concurrent replay", async () => {
    const issue = await service.raiseRetailerRequest({ retailerId: retailers[0], description: "Please inspect cartons", clientReference: `feedback-${randomUUID()}` });
    await expect(service.withdrawRetailerRequest(issue.id, retailers[1])).rejects.toMatchObject({ code: "issue_not_found" });
    const [a, b] = await Promise.all([service.withdrawRetailerRequest(issue.id, retailers[0]), service.withdrawRetailerRequest(issue.id, retailers[0])]);
    expect(a.id).toBe(b.id);
    expect(a.status).toBe("withdrawn");
    expect(await prisma.auditEvent.count({ where: { subjectType: "service_issue", subjectId: issue.id, action: "service_issue.retailer_withdrawn" } })).toBe(1);
    expect((await service.retailerRequests(retailers[0])).some((row: any) => row.id === issue.id && row.status === "withdrawn")).toBe(true);
    expect((await service.retailerRequests(retailers[1])).some((row: any) => row.id === issue.id)).toBe(false);
    await expect(service.updateStatus({ issueId: issue.id, actorStaffId: randomUUID(), status: "in_progress", scopeStaffIds: null })).rejects.toMatchObject({ code: "issue_already_closed" });
  });
  it("requires operator action after work becomes in progress", async () => {
    const issue = await service.raiseRetailerRequest({ retailerId: retailers[0], description: "Please inspect invoice", clientReference: `feedback-${randomUUID()}` });
    await prisma.serviceIssue.update({ where: { id: issue.id }, data: { status: "in_progress" } });
    await expect(service.withdrawRetailerRequest(issue.id, retailers[0])).rejects.toMatchObject({ code: "issue_not_withdrawable" });
  });
  it("shows Retailer-origin requests only in the assigned Admin team scope", async () => {
    const issue = await service.raiseRetailerRequest({ retailerId: retailers[0], description: "Scoped retailer request", clientReference: `feedback-${randomUUID()}` });
    const ownerQueue = await service.list({ scopeStaffIds: [staff[0]], retailerId: retailers[0] });
    const otherQueue = await service.list({ scopeStaffIds: [staff[1]], retailerId: retailers[0] });
    expect(ownerQueue.some((row: { id: string }) => row.id === issue.id)).toBe(true);
    expect(otherQueue.some((row: { id: string }) => row.id === issue.id)).toBe(false);
  });
  it("shows a retailer-origin resolved request to only the currently assigned salesperson", async () => {
    const issue = await service.raiseRetailerRequest({
      retailerId: retailers[0], description: "Shared issue lifecycle", clientReference: `feedback-${randomUUID()}`,
    });
    await service.updateStatus({
      issueId: issue.id, actorStaffId: staff[1], status: "resolved",
      resolutionNote: "UAT resolved", scopeStaffIds: null,
    });
    const own = await service.listForSalesperson(staff[0], retailers[0]);
    const other = await service.listForSalesperson(staff[1], retailers[0]);
    expect(own.find((row: { id: string }) => row.id === issue.id)?.status).toBe("resolved");
    expect(other.some((row: { id: string }) => row.id === issue.id)).toBe(false);
  });
  it("does not reveal a former team's staff-raised issue after retailer reassignment", async () => {
    const staffIssue = await service.raise({
      salespersonId: staff[0], retailerId: retailers[0], type: "service_request", description: "Former team private issue",
    });
    const retailerIssue = await service.raiseRetailerRequest({
      retailerId: retailers[0], description: "Current team request", clientReference: `feedback-${randomUUID()}`,
    });
    try {
      await prisma.retailer.update({ where: { id: retailers[0] }, data: { salesRepId: salesReps[1] } });
      const oldTeam = await service.list({ scopeStaffIds: [staff[0]], retailerId: retailers[0] });
      const newTeam = await service.list({ scopeStaffIds: [staff[1]], retailerId: retailers[0] });
      expect(oldTeam.some((row: { id: string }) => row.id === staffIssue.id)).toBe(true);
      expect(newTeam.some((row: { id: string }) => row.id === staffIssue.id)).toBe(false);
      expect(newTeam.some((row: { id: string }) => row.id === retailerIssue.id)).toBe(true);
      await expect(service.updateStatus({ issueId: staffIssue.id, actorStaffId: staff[1], status: "in_progress", scopeStaffIds: [staff[1]] }))
        .rejects.toMatchObject({ code: "outside_reporting_scope" });
      await expect(service.updateStatus({ issueId: retailerIssue.id, actorStaffId: staff[1], status: "in_progress", scopeStaffIds: [staff[1]] }))
        .resolves.toMatchObject({ status: "in_progress" });
    } finally {
      await prisma.retailer.update({ where: { id: retailers[0] }, data: { salesRepId: salesReps[0] } });
    }
  });
});
