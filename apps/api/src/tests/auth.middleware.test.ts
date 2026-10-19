import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const authMocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getSessionAuthVersion: vi.fn(),
  isSessionActive: vi.fn(),
  isTokenBlacklisted: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
  user: { id: 1, role: "user", isBanned: false, bannedUntil: null as Date | null, banReason: null as string | null, authVersion: 0 },
}));

vi.mock("../lib/auth", () => authMocks);
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([dbMocks.user])),
      })),
    })),
  },
}));
vi.mock("@workspace/db/schema", () => ({ usersTable: { id: "id", authVersion: "authVersion" } }));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe("requireAuth middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests with no Authorization header", async () => {
    const { requireAuth } = await import("../middleware/admin");
    const req = { headers: {} } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with invalid Bearer token", async () => {
    const { requireAuth } = await import("../middleware/admin");
    const req = {
      headers: { authorization: "Bearer invalid_token_here" },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireAdmin middleware", () => {
  beforeEach(() => {
    authMocks.getSessionUserId.mockReturnValue(1);
    authMocks.getSessionAuthVersion.mockReturnValue(0);
    authMocks.isSessionActive.mockResolvedValue(true);
    authMocks.isTokenBlacklisted.mockResolvedValue(false);
    dbMocks.user.role = "user";
    dbMocks.user.isBanned = false;
    dbMocks.user.bannedUntil = null;
    dbMocks.user.banReason = null;
    dbMocks.user.authVersion = 0;
  });

  describe("requireSuperAdmin middleware", () => {
    beforeEach(() => {
      authMocks.getSessionUserId.mockReturnValue(1);
      authMocks.getSessionAuthVersion.mockReturnValue(0);
      authMocks.isSessionActive.mockResolvedValue(true);
      authMocks.isTokenBlacklisted.mockResolvedValue(false);
      dbMocks.user.role = "user";
      dbMocks.user.isBanned = false;
      dbMocks.user.bannedUntil = null;
      dbMocks.user.banReason = null;
      dbMocks.user.authVersion = 0;
    });

    it("allows only super_admin", async () => {
      dbMocks.user.role = "super_admin";
      const { requireSuperAdmin } = await import("../middleware/admin");
      const req = { headers: { authorization: "Bearer token" } } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await requireSuperAdmin(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it.each(["admin", "moderator", "user"])("rejects %s from super-admin routes", async (role) => {
      dbMocks.user.role = role;
      const { requireSuperAdmin } = await import("../middleware/admin");
      const req = { headers: { authorization: "Bearer token" } } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await requireSuperAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  it("rejects unauthenticated requests with 401 (requireAdmin calls resolveUser first)", async () => {
    const { requireAdmin } = await import("../middleware/admin");
    const req = {
      headers: {},
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["moderator", "admin", "super_admin"])("allows %s", async (role) => {
    dbMocks.user.role = role;
    const { requireAdmin } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer valid-token" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks a temporarily restricted user with the expiry and moderation reason", async () => {
    const until = new Date(Date.now() + 86_400_000);
    dbMocks.user.isBanned = true;
    dbMocks.user.bannedUntil = until;
    dbMocks.user.banReason = "Repeated harassment";
    const { requireAuth } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer valid" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Account temporarily restricted",
      code: "TEMPORARY_RESTRICTION",
      until: until.toISOString(),
      reason: "Repeated harassment",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects authenticated users without an admin role with 403", async () => {
    const { requireAdmin } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer valid-token" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects tokens from an older auth version", async () => {
    dbMocks.user.authVersion = 1;
    const { requireAdmin } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer valid-token" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects access tokens after their device session is revoked", async () => {
    authMocks.isSessionActive.mockResolvedValue(false);
    const { requireAuth } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer token" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Session revoked or expired" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("manage_settings permission", () => {
  it.each(["admin", "super_admin"])("%s can manage feature flags", async (role) => {
    const { hasPermission } = await import("../middleware/admin");
    expect(hasPermission({ role }, "manage_settings")).toBe(true);
  });

  it("does not allow moderators to manage feature flags", async () => {
    const { hasPermission } = await import("../middleware/admin");
    expect(hasPermission({ role: "moderator" }, "manage_settings")).toBe(false);
  });
});

describe("validateBearerTokenState middleware", () => {
  beforeEach(() => {
    authMocks.getSessionUserId.mockReturnValue(1);
    authMocks.getSessionAuthVersion.mockReturnValue(0);
    authMocks.isSessionActive.mockResolvedValue(true);
    authMocks.isTokenBlacklisted.mockResolvedValue(false);
    dbMocks.user.authVersion = 0;
  });

  it("strips stale tokens before controllers that read Authorization directly", async () => {
    dbMocks.user.authVersion = 1;
    const { validateBearerTokenState } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer stale-token" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await validateBearerTokenState(req, res, next);
    expect(req.headers.authorization).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("strips tokens revoked in the shared store", async () => {
    authMocks.isTokenBlacklisted.mockResolvedValue(true);
    const { validateBearerTokenState } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer revoked-token" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await validateBearerTokenState(req, res, next);
    expect(req.headers.authorization).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("strips access tokens belonging to revoked device sessions before direct-token handlers", async () => {
    authMocks.isSessionActive.mockResolvedValue(false);
    const { validateBearerTokenState } = await import("../middleware/admin");
    const req = { headers: { authorization: "Bearer token" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await validateBearerTokenState(req, res, next);
    expect(req.headers.authorization).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});
