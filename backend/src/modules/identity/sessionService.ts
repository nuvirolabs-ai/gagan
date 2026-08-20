import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { IdentityRealm } from "@prisma/client";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { effectivePermissions } from "./permissions";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
const STEP_UP_TTL_SECONDS = 10 * 60;

export type SessionRealm = "retailer" | "staff" | "admin";

export class SessionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
}

export interface DeviceSessionRecord {
  id: string;
  realm: string;
  subjectId: string;
  tokenFamilyId: string;
  refreshTokenHash: string;
  deviceName: string | null;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionRepository {
  create(record: DeviceSessionRecord): Promise<DeviceSessionRecord>;
  find(id: string): Promise<DeviceSessionRecord | null>;
  rotate(id: string, expectedHash: string, nextHash: string, at: Date): Promise<boolean>;
  revokeSession(id: string, at: Date): Promise<void>;
  revokeFamily(tokenFamilyId: string, at: Date): Promise<void>;
  revokeSubject(realm: string, subjectId: string, at: Date): Promise<void>;
  list(realm: string, subjectId: string): Promise<DeviceSessionRecord[]>;
}

export interface AuthoritySource {
  load(
    realm: SessionRealm,
    subjectId: string,
    at: Date
  ): Promise<{ active: boolean; permissions: string[]; delegationIds: string[] }>;
}

export interface AccessTokenClaims {
  sub: string;
  realm: SessionRealm;
  sessionId: string;
  permissions: string[];
  delegationIds: string[];
  stepUpUntil?: number;
  iat: number;
  exp: number;
}

export const prismaSessionRepository: SessionRepository = {
  create(record) {
    return prisma.deviceSession.create({
      data: { ...record, realm: record.realm as IdentityRealm },
    });
  },
  find(id) {
    return prisma.deviceSession.findUnique({ where: { id } });
  },
  async rotate(id, expectedHash, nextHash, at) {
    const result = await prisma.deviceSession.updateMany({
      where: { id, refreshTokenHash: expectedHash, revokedAt: null, expiresAt: { gt: at } },
      data: { refreshTokenHash: nextHash, lastUsedAt: at },
    });
    return result.count === 1;
  },
  async revokeSession(id, at) {
    await prisma.deviceSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
  },
  async revokeFamily(tokenFamilyId, at) {
    await prisma.deviceSession.updateMany({
      where: { tokenFamilyId, revokedAt: null },
      data: { revokedAt: at },
    });
  },
  async revokeSubject(realm, subjectId, at) {
    await prisma.deviceSession.updateMany({
      where: { realm: realm as IdentityRealm, subjectId, revokedAt: null },
      data: { revokedAt: at },
    });
  },
  list(realm, subjectId) {
    return prisma.deviceSession.findMany({
      where: { realm: realm as IdentityRealm, subjectId },
      orderBy: { lastUsedAt: "desc" },
    });
  },
};

const prismaAuthoritySource: AuthoritySource = {
  async load(realm, subjectId, at) {
    if (realm === "retailer") {
      const retailer = await prisma.retailer.findUnique({
        where: { id: subjectId },
        select: { id: true },
      });
      return { active: Boolean(retailer), permissions: [], delegationIds: [] };
    }
    return effectivePermissions(subjectId, at);
  },
};

interface SessionServiceOptions {
  repository?: SessionRepository;
  authority?: AuthoritySource;
  jwtSecret: string;
  tokenHashSecret: string;
  now?: () => Date;
}

interface CreateSessionInput {
  realm: SessionRealm;
  subjectId: string;
  deviceName?: string;
  userAgent?: string;
  ipHash?: string;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  session: DeviceSessionRecord;
}

function safeHashEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export class SessionService {
  private readonly repository: SessionRepository;
  private readonly authority: AuthoritySource;
  private readonly now: () => Date;

  constructor(private readonly options: SessionServiceOptions) {
    this.repository = options.repository ?? prismaSessionRepository;
    this.authority = options.authority ?? prismaAuthoritySource;
    this.now = options.now ?? (() => new Date());
  }

  private hashRefreshToken(token: string): string {
    return createHmac("sha256", this.options.tokenHashSecret).update(token).digest("hex");
  }

  private newRefreshToken(sessionId: string): string {
    return `${sessionId}.${randomBytes(32).toString("base64url")}`;
  }

  private signAccessToken(
    session: DeviceSessionRecord,
    authority: { permissions: string[]; delegationIds: string[] },
    stepUpUntil?: number
  ): string {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const claims: AccessTokenClaims = {
      sub: session.subjectId,
      realm: session.realm as SessionRealm,
      sessionId: session.id,
      permissions: [...authority.permissions].sort(),
      delegationIds: [...authority.delegationIds].sort(),
      ...(stepUpUntil ? { stepUpUntil } : {}),
      iat: issuedAt,
      exp: issuedAt + ACCESS_TTL_SECONDS,
    };
    return jwt.sign(claims, this.options.jwtSecret, { algorithm: "HS256" });
  }

  verifyAccessToken(token: string, expectedRealm?: SessionRealm): AccessTokenClaims {
    let claims: AccessTokenClaims;
    try {
      claims = jwt.verify(token, this.options.jwtSecret, {
        algorithms: ["HS256"],
        clockTimestamp: Math.floor(this.now().getTime() / 1000),
      }) as AccessTokenClaims;
    } catch {
      throw new SessionError("invalid_access_token", 401);
    }
    if (
      !claims.sub ||
      !claims.sessionId ||
      !Array.isArray(claims.permissions) ||
      !["retailer", "staff", "admin"].includes(claims.realm) ||
      (expectedRealm && claims.realm !== expectedRealm)
    ) {
      throw new SessionError("invalid_access_token", 401);
    }
    return claims;
  }

  async authenticateAccessToken(
    token: string,
    expectedRealm: SessionRealm
  ): Promise<AccessTokenClaims> {
    const claims = this.verifyAccessToken(token, expectedRealm);
    const session = await this.repository.find(claims.sessionId);
    const now = this.now();
    if (
      !session ||
      session.realm !== expectedRealm ||
      session.subjectId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      throw new SessionError("session_revoked", 401);
    }
    let authority;
    try {
      authority = await this.activeAuthority(expectedRealm, claims.sub, now);
    } catch (error) {
      await this.repository.revokeFamily(session.tokenFamilyId, now);
      throw error;
    }
    return {
      ...claims,
      permissions: [...authority.permissions].sort(),
      delegationIds: [...authority.delegationIds].sort(),
    };
  }

  private async activeAuthority(realm: SessionRealm, subjectId: string, at: Date) {
    const authority = await this.authority.load(realm, subjectId, at);
    if (!authority.active) throw new SessionError("subject_inactive", 401);
    return authority;
  }

  async createSession(input: CreateSessionInput): Promise<SessionResult> {
    const now = this.now();
    const authority = await this.activeAuthority(input.realm, input.subjectId, now);
    const id = randomUUID();
    const refreshToken = this.newRefreshToken(id);
    const session = await this.repository.create({
      id,
      realm: input.realm,
      subjectId: input.subjectId,
      tokenFamilyId: randomUUID(),
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      deviceName: input.deviceName ?? null,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      revokedAt: null,
    });
    return {
      accessToken: this.signAccessToken(session, authority),
      refreshToken,
      session,
    };
  }

  async refresh(refreshToken: string): Promise<SessionResult> {
    const [sessionId, secret, ...extra] = refreshToken.split(".");
    if (!sessionId || !secret || extra.length) throw new SessionError("invalid_refresh_token", 401);
    const session = await this.repository.find(sessionId);
    if (!session) throw new SessionError("invalid_refresh_token", 401);
    const now = this.now();
    if (session.revokedAt) throw new SessionError("session_revoked", 401);
    if (session.expiresAt <= now) {
      await this.repository.revokeSession(session.id, now);
      throw new SessionError("session_expired", 401);
    }

    const suppliedHash = this.hashRefreshToken(refreshToken);
    if (!safeHashEqual(session.refreshTokenHash, suppliedHash)) {
      await this.repository.revokeFamily(session.tokenFamilyId, now);
      throw new SessionError("refresh_replay", 401);
    }

    let authority;
    try {
      authority = await this.activeAuthority(
        session.realm as SessionRealm,
        session.subjectId,
        now
      );
    } catch (error) {
      await this.repository.revokeFamily(session.tokenFamilyId, now);
      throw error;
    }

    const nextRefreshToken = this.newRefreshToken(session.id);
    const nextHash = this.hashRefreshToken(nextRefreshToken);
    if (!(await this.repository.rotate(session.id, suppliedHash, nextHash, now))) {
      await this.repository.revokeFamily(session.tokenFamilyId, now);
      throw new SessionError("refresh_replay", 401);
    }
    const rotated = { ...session, refreshTokenHash: nextHash, lastUsedAt: now };
    return {
      accessToken: this.signAccessToken(rotated, authority),
      refreshToken: nextRefreshToken,
      session: rotated,
    };
  }

  async revokeSession(id: string, realm: SessionRealm, subjectId: string): Promise<void> {
    const session = await this.repository.find(id);
    if (!session || session.realm !== realm || session.subjectId !== subjectId) {
      throw new SessionError("session_not_found", 404);
    }
    await this.repository.revokeSession(id, this.now());
  }

  revokeAll(realm: SessionRealm, subjectId: string): Promise<void> {
    return this.repository.revokeSubject(realm, subjectId, this.now());
  }

  listSessions(realm: SessionRealm, subjectId: string): Promise<DeviceSessionRecord[]> {
    return this.repository.list(realm, subjectId);
  }

  async elevateSession(
    sessionId: string,
    realm: SessionRealm,
    subjectId: string
  ): Promise<{ accessToken: string; stepUpUntil: Date }> {
    const session = await this.repository.find(sessionId);
    const now = this.now();
    if (
      !session ||
      session.realm !== realm ||
      session.subjectId !== subjectId ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      throw new SessionError("session_revoked", 401);
    }
    const authority = await this.activeAuthority(realm, subjectId, now);
    const stepUpUntilSeconds = Math.floor(now.getTime() / 1000) + STEP_UP_TTL_SECONDS;
    return {
      accessToken: this.signAccessToken(session, authority, stepUpUntilSeconds),
      stepUpUntil: new Date(stepUpUntilSeconds * 1000),
    };
  }
}

export function hasRecentStepUp(claims: AccessTokenClaims, at = new Date()): boolean {
  return Boolean(claims.stepUpUntil && claims.stepUpUntil > Math.floor(at.getTime() / 1000));
}
