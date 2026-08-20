import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { IdentityRealm } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { SmsProvider } from "./providers/provider";

const OTP_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const IP_WINDOW_MS = 10 * 60_000;
const IP_REQUEST_LIMIT = 10;
const MAX_ATTEMPTS = 5;

export class OtpError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
}

export interface OtpChallengeRecord {
  id: string;
  realm: string;
  phone: string;
  codeHash: string;
  requestIpHash: string | null;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  resendAvailableAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface OtpRepository {
  latest(realm: string, phone: string): Promise<OtpChallengeRecord | null>;
  countRecentByIpHash(ipHash: string, since: Date): Promise<number>;
  create(challenge: OtpChallengeRecord): Promise<OtpChallengeRecord>;
  find(id: string): Promise<OtpChallengeRecord | null>;
  incrementAttempts(id: string): Promise<number>;
  consume(id: string, at: Date): Promise<boolean>;
}

export const prismaOtpRepository: OtpRepository = {
  latest(realm, phone) {
    return prisma.otpChallenge.findFirst({
      where: { realm: realm as IdentityRealm, phone },
      orderBy: { createdAt: "desc" },
    });
  },
  countRecentByIpHash(ipHash, since) {
    return prisma.otpChallenge.count({
      where: { requestIpHash: ipHash, createdAt: { gte: since } },
    });
  },
  create(challenge) {
    return prisma.otpChallenge.create({
      data: { ...challenge, realm: challenge.realm as IdentityRealm },
    });
  },
  find(id) {
    return prisma.otpChallenge.findUnique({ where: { id } });
  },
  async incrementAttempts(id) {
    const challenge = await prisma.otpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return challenge.attempts;
  },
  async consume(id, at) {
    const result = await prisma.otpChallenge.updateMany({
      where: {
        id,
        consumedAt: null,
        expiresAt: { gt: at },
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: { consumedAt: at },
    });
    return result.count === 1;
  },
};

export function normalizeIndianPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new OtpError("invalid_phone", 400);
  }
  return `+91${digits}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface OtpServiceOptions {
  repository?: OtpRepository;
  provider: SmsProvider;
  hashSecret: string;
  codeGenerator?: () => string;
  now?: () => Date;
}

interface OtpRequest {
  realm: "retailer" | "staff" | "admin";
  phone: string;
  correlationId: string;
  requestIp?: string;
  accountExists: boolean;
}

interface OtpVerify {
  challengeId: string;
  realm: "retailer" | "staff" | "admin";
  phone: string;
  code: string;
}

export class OtpService {
  private readonly repository: OtpRepository;
  private readonly codeGenerator: () => string;
  private readonly now: () => Date;

  constructor(private readonly options: OtpServiceOptions) {
    this.repository = options.repository ?? prismaOtpRepository;
    this.codeGenerator =
      options.codeGenerator ?? (() => randomInt(0, 1_000_000).toString().padStart(6, "0"));
    this.now = options.now ?? (() => new Date());
  }

  private hashCode(challengeId: string, code: string): string {
    return createHmac("sha256", this.options.hashSecret)
      .update(`${challengeId}:${code}`)
      .digest("hex");
  }

  async request(input: OtpRequest): Promise<{ accepted: true; challengeId?: string }> {
    const phone = normalizeIndianPhone(input.phone);
    const now = this.now();

    // Account discovery always receives the same public response.
    if (!input.accountExists) {
      const decoyChallengeId = randomUUID();
      this.hashCode(decoyChallengeId, this.codeGenerator());
      return { accepted: true, challengeId: decoyChallengeId };
    }

    const requestIpHash = input.requestIp ? sha256(input.requestIp) : null;
    if (requestIpHash) {
      const recentCount = await this.repository.countRecentByIpHash(
        requestIpHash,
        new Date(now.getTime() - IP_WINDOW_MS)
      );
      if (recentCount >= IP_REQUEST_LIMIT) throw new OtpError("rate_limited", 429);
    }

    const latest = await this.repository.latest(input.realm, phone);
    if (latest && latest.resendAvailableAt > now) {
      throw new OtpError("resend_cooldown", 429);
    }

    const id = randomUUID();
    const code = this.codeGenerator();
    await this.repository.create({
      id,
      realm: input.realm,
      phone,
      codeHash: this.hashCode(id, code),
      requestIpHash,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      consumedAt: null,
      createdAt: now,
    });
    await this.options.provider.sendOtp(phone, code, input.correlationId);
    return { accepted: true, challengeId: id };
  }

  async verify(input: OtpVerify): Promise<{ verified: true }> {
    const phone = normalizeIndianPhone(input.phone);
    const challenge = await this.repository.find(input.challengeId);
    if (!challenge || challenge.realm !== input.realm || challenge.phone !== phone) {
      throw new OtpError("invalid_challenge", 401);
    }
    const now = this.now();
    if (challenge.consumedAt) throw new OtpError("challenge_used", 401);
    if (challenge.expiresAt <= now) throw new OtpError("challenge_expired", 401);
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new OtpError("attempt_limit", 429);
    }

    const expected = Buffer.from(challenge.codeHash, "hex");
    const supplied = Buffer.from(this.hashCode(challenge.id, input.code), "hex");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      await this.repository.incrementAttempts(challenge.id);
      throw new OtpError("incorrect_code", 401);
    }
    if (!(await this.repository.consume(challenge.id, now))) {
      throw new OtpError("challenge_used", 401);
    }
    return { verified: true };
  }
}
