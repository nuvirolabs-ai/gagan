import { describe, expect, it } from "vitest";
import {
  hasRecentStepUp,
  SessionError,
  SessionService,
  type AuthoritySource,
  type DeviceSessionRecord,
  type SessionRepository,
} from "../sessionService";

class MemorySessionRepository implements SessionRepository {
  sessions: DeviceSessionRecord[] = [];

  async create(record: DeviceSessionRecord) {
    this.sessions.push(record);
    return record;
  }

  async find(id: string) {
    return this.sessions.find((session) => session.id === id) ?? null;
  }

  async rotate(id: string, expectedHash: string, nextHash: string, at: Date) {
    const session = this.sessions.find((candidate) => candidate.id === id);
    if (!session || session.revokedAt || session.refreshTokenHash !== expectedHash) return false;
    session.refreshTokenHash = nextHash;
    session.lastUsedAt = at;
    return true;
  }

  async revokeSession(id: string, at: Date) {
    const session = this.sessions.find((candidate) => candidate.id === id);
    if (session && !session.revokedAt) session.revokedAt = at;
  }

  async revokeFamily(tokenFamilyId: string, at: Date) {
    for (const session of this.sessions) {
      if (session.tokenFamilyId === tokenFamilyId && !session.revokedAt) session.revokedAt = at;
    }
  }

  async revokeSubject(realm: string, subjectId: string, at: Date) {
    for (const session of this.sessions) {
      if (session.realm === realm && session.subjectId === subjectId && !session.revokedAt) {
        session.revokedAt = at;
      }
    }
  }

  async list(realm: string, subjectId: string) {
    return this.sessions.filter(
      (session) => session.realm === realm && session.subjectId === subjectId
    );
  }
}

function setup() {
  const repository = new MemorySessionRepository();
  let currentTime = new Date("2026-08-20T10:00:00.000Z");
  let active = true;
  const authority: AuthoritySource = {
    async load(realm) {
      return {
        active,
        permissions: realm === "staff" ? ["order.create_for_retailer"] : [],
        delegationIds: [],
      };
    },
  };
  const service = new SessionService({
    repository,
    authority,
    jwtSecret: "session-test-secret-longer-than-thirty-two-characters",
    tokenHashSecret: "refresh-test-secret-longer-than-thirty-two-characters",
    now: () => currentTime,
  });
  return {
    repository,
    service,
    suspend() {
      active = false;
    },
    advance(ms: number) {
      currentTime = new Date(currentTime.getTime() + ms);
    },
    now: () => currentTime,
  };
}

describe("SessionService", () => {
  it("issues a 15-minute realm-scoped access token and a 30-day refresh session", async () => {
    const { repository, service } = setup();
    const result = await service.createSession({
      realm: "staff",
      subjectId: "staff-1",
      deviceName: "Field iPhone",
    });
    const claims = service.verifyAccessToken(result.accessToken);

    expect(claims).toMatchObject({
      sub: "staff-1",
      realm: "staff",
      sessionId: result.session.id,
      permissions: ["order.create_for_retailer"],
    });
    expect(claims.exp - claims.iat).toBe(15 * 60);
    expect(result.session.expiresAt.getTime() - result.session.createdAt.getTime())
      .toBe(30 * 24 * 60 * 60_000);
    expect(repository.sessions[0].refreshTokenHash).not.toBe(result.refreshToken);
    expect(JSON.stringify(repository.sessions)).not.toContain(result.refreshToken);
  });

  it("revokes the refresh family when an old token is replayed", async () => {
    const { repository, service } = setup();
    const original = await service.createSession({ realm: "staff", subjectId: "staff-1" });
    const rotated = await service.refresh(original.refreshToken);

    expect(rotated.refreshToken).not.toBe(original.refreshToken);
    await expect(service.refresh(original.refreshToken)).rejects.toMatchObject({
      code: "refresh_replay",
    });
    expect(repository.sessions[0].revokedAt).not.toBeNull();
    await expect(service.refresh(rotated.refreshToken)).rejects.toBeInstanceOf(SessionError);
  });

  it("supports device logout and all-device logout", async () => {
    const { repository, service } = setup();
    const first = await service.createSession({ realm: "retailer", subjectId: "retailer-1" });
    const second = await service.createSession({ realm: "retailer", subjectId: "retailer-1" });

    await service.revokeSession(first.session.id, "retailer", "retailer-1");
    expect(repository.sessions[0].revokedAt).not.toBeNull();
    expect(repository.sessions[1].revokedAt).toBeNull();

    await service.revokeAll("retailer", "retailer-1");
    expect(repository.sessions[1].revokedAt).not.toBeNull();
    await expect(service.refresh(second.refreshToken)).rejects.toMatchObject({
      code: "session_revoked",
    });
  });

  it("rejects access immediately after the device session is revoked", async () => {
    const { service } = setup();
    const issued = await service.createSession({ realm: "staff", subjectId: "staff-1" });
    await service.revokeSession(issued.session.id, "staff", "staff-1");

    await expect(
      service.authenticateAccessToken(issued.accessToken, "staff")
    ).rejects.toMatchObject({ code: "session_revoked" });
  });

  it("revokes refresh when the subject becomes suspended", async () => {
    const { repository, service, suspend } = setup();
    const session = await service.createSession({ realm: "staff", subjectId: "staff-1" });
    suspend();

    await expect(service.refresh(session.refreshToken)).rejects.toMatchObject({
      code: "subject_inactive",
    });
    expect(repository.sessions[0].revokedAt).not.toBeNull();
  });

  it("keeps retailer and staff realms distinct", async () => {
    const { service } = setup();
    const session = await service.createSession({ realm: "retailer", subjectId: "same-id" });
    const claims = service.verifyAccessToken(session.accessToken);
    expect(claims.realm).toBe("retailer");
    expect(claims.permissions).toEqual([]);
  });

  it("expires step-up authority after ten minutes", async () => {
    const { service, advance, now } = setup();
    const session = await service.createSession({ realm: "staff", subjectId: "staff-1" });
    const elevatedToken = await service.elevateSession(
      session.session.id,
      "staff",
      "staff-1"
    );
    const claims = service.verifyAccessToken(elevatedToken.accessToken);

    expect(hasRecentStepUp(claims, now())).toBe(true);
    advance(10 * 60_000 + 1);
    expect(hasRecentStepUp(claims, now())).toBe(false);
  });
});
