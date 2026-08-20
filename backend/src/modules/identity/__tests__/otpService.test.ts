import { describe, expect, it, vi } from "vitest";
import {
  createSmsProvider,
  type SmsProvider,
} from "../providers/provider";
import {
  normalizeIndianPhone,
  OtpError,
  OtpService,
  type OtpChallengeRecord,
  type OtpRepository,
} from "../otpService";

class MemoryOtpRepository implements OtpRepository {
  challenges: OtpChallengeRecord[] = [];

  async latest(realm: string, phone: string) {
    return [...this.challenges]
      .filter((item) => item.realm === realm && item.phone === phone)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  }

  async countRecentByIpHash(ipHash: string, since: Date) {
    return this.challenges.filter(
      (item) => item.requestIpHash === ipHash && item.createdAt >= since
    ).length;
  }

  async create(challenge: OtpChallengeRecord) {
    this.challenges.push(challenge);
    return challenge;
  }

  async find(id: string) {
    return this.challenges.find((item) => item.id === id) ?? null;
  }

  async incrementAttempts(id: string) {
    const challenge = this.challenges.find((item) => item.id === id)!;
    challenge.attempts += 1;
    return challenge.attempts;
  }

  async consume(id: string, at: Date) {
    const challenge = this.challenges.find((item) => item.id === id)!;
    if (challenge.consumedAt) return false;
    challenge.consumedAt = at;
    return true;
  }
}

function setup(now = new Date("2026-08-20T10:00:00.000Z")) {
  const repository = new MemoryOtpRepository();
  const sendOtp = vi.fn().mockResolvedValue(undefined);
  const provider: SmsProvider = { sendOtp };
  let currentTime = now;
  const service = new OtpService({
    repository,
    provider,
    hashSecret: "otp-test-secret-that-is-long-enough",
    codeGenerator: () => "123456",
    now: () => currentTime,
  });
  return {
    repository,
    sendOtp,
    service,
    advance(ms: number) {
      currentTime = new Date(currentTime.getTime() + ms);
    },
  };
}

describe("normalizeIndianPhone", () => {
  it.each([
    ["98123 45670", "+919812345670"],
    ["09812345670", "+919812345670"],
    ["+91-98123-45670", "+919812345670"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIndianPhone(input)).toBe(expected);
  });

  it("rejects an invalid Indian mobile number", () => {
    expect(() => normalizeIndianPhone("12345")).toThrow(OtpError);
  });
});

describe("OtpService", () => {
  it("stores only a hash and consumes a valid challenge once", async () => {
    const { repository, sendOtp, service } = setup();
    const issued = await service.request({
      realm: "retailer",
      phone: "9812345670",
      correlationId: "request-1",
      requestIp: "203.0.113.10",
      accountExists: true,
    });

    expect(issued).toEqual({ accepted: true, challengeId: expect.any(String) });
    expect(sendOtp).toHaveBeenCalledWith("+919812345670", "123456", "request-1");
    expect(repository.challenges[0].codeHash).not.toContain("123456");
    expect(JSON.stringify(repository.challenges)).not.toContain('"code":"123456"');

    await expect(
      service.verify({
        challengeId: issued.challengeId!,
        realm: "retailer",
        phone: "9812345670",
        code: "123456",
      })
    ).resolves.toEqual({ verified: true });
    await expect(
      service.verify({
        challengeId: issued.challengeId!,
        realm: "retailer",
        phone: "9812345670",
        code: "123456",
      })
    ).rejects.toMatchObject({ code: "challenge_used" });
  });

  it("expires after five minutes", async () => {
    const { service, advance } = setup();
    const issued = await service.request({
      realm: "staff",
      phone: "9812345670",
      correlationId: "request-1",
      accountExists: true,
    });
    advance(5 * 60_000 + 1);
    await expect(
      service.verify({
        challengeId: issued.challengeId!,
        realm: "staff",
        phone: "9812345670",
        code: "123456",
      })
    ).rejects.toMatchObject({ code: "challenge_expired" });
  });

  it("enforces resend cooldown", async () => {
    const { service } = setup();
    const input = {
      realm: "staff" as const,
      phone: "9812345670",
      correlationId: "request-1",
      accountExists: true,
    };
    await service.request(input);
    await expect(service.request(input)).rejects.toMatchObject({ code: "resend_cooldown" });
  });

  it("locks a challenge after five failed attempts", async () => {
    const { service } = setup();
    const issued = await service.request({
      realm: "staff",
      phone: "9812345670",
      correlationId: "request-1",
      accountExists: true,
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.verify({
          challengeId: issued.challengeId!,
          realm: "staff",
          phone: "9812345670",
          code: "000000",
        })
      ).rejects.toMatchObject({ code: "incorrect_code" });
    }
    await expect(
      service.verify({
        challengeId: issued.challengeId!,
        realm: "staff",
        phone: "9812345670",
        code: "123456",
      })
    ).rejects.toMatchObject({ code: "attempt_limit" });
  });

  it("returns the same neutral response for an unknown account without sending", async () => {
    const { service, sendOtp } = setup();
    await expect(
      service.request({
        realm: "retailer",
        phone: "9812345670",
        correlationId: "request-1",
        accountExists: false,
      })
    ).resolves.toEqual({ accepted: true, challengeId: expect.any(String) });
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it("limits recent requests from one IP", async () => {
    const { service, repository, advance } = setup();
    for (let index = 0; index < 10; index += 1) {
      repository.challenges.push({
        id: `existing-${index}`,
        realm: "retailer",
        phone: `+9190000000${String(index).padStart(2, "0")}`,
        codeHash: "hash",
        requestIpHash: "631f08140b24b7274d12df3c37a1a80ce5876dafd7007d772e0114fddf88b682",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date("2026-08-20T10:05:00.000Z"),
        resendAvailableAt: new Date("2026-08-20T10:01:00.000Z"),
        consumedAt: null,
        createdAt: new Date("2026-08-20T10:00:00.000Z"),
      });
    }
    advance(1);
    await expect(
      service.request({
        realm: "retailer",
        phone: "9812345670",
        correlationId: "request-1",
        requestIp: "203.0.113.10",
        accountExists: true,
      })
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("createSmsProvider", () => {
  it("refuses the mock adapter in production", () => {
    expect(() => createSmsProvider("mock", "production", { mock: { sendOtp: vi.fn() } }))
      .toThrow(/mock/i);
  });

  it("selects a registered production adapter", () => {
    const provider = { sendOtp: vi.fn() };
    expect(createSmsProvider("msg91", "production", { msg91: provider })).toBe(provider);
  });
});
