import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSessionAuthVersion, getSessionUserId, isSessionActive, isTokenBlacklisted } from "../lib/auth";
import { getAccountBanStatus, temporaryRestrictionResponse } from "../lib/accountRestriction";

export const ADMIN_ROLES = ["moderator", "admin", "super_admin"] as const;
const SUPER_ADMIN_ROLES = ["super_admin"];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  moderator: [
    "view_reports", "resolve_reports", "dismiss_reports",
    "view_users", "view_posts", "warn_user", "shadowban_user",
    "view_logs",
  ],
  admin: [
    "view_reports", "resolve_reports", "dismiss_reports",
    "view_users", "manage_users", "ban_user", "delete_user", "view_posts",
    "delete_post", "unpublish_post", "warn_user", "shadowban_user",
    "view_analytics", "view_logs", "manage_settings",
    "manage_boosts", "manage_spotlight", "manage_featured",
    "manage_support", "manage_opportunities", "manage_jobs",
    "manage_groups", "manage_communities", "manage_challenges",
    "view_payment_history", "manage_reports", "manage_moderation",
    "manage_content", "manage_legal", "view_security_alerts",
    "manage_notifications", "manage_rules", "manage_blocked_emails",
  ],
  super_admin: ["*"],
};

export function hasPermission(user: { role: string }, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[user.role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ok = await resolveUser(req, res);
    if (!ok) return;
    const user = (req as any).currentUser;
    if (!hasPermission(user, permission)) {
      res.status(403).json({ error: `Missing permission: ${permission}` });
      return;
    }
    next();
  };
}

async function resolveUser(req: Request, res: Response): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const token = auth.slice(7);
  const userId = getSessionUserId(token);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (await isTokenBlacklisted(token)) {
    res.status(401).json({ error: "Token revoked" });
    return false;
  }
  if (!(await isSessionActive(token, userId))) {
    res.status(401).json({ error: "Session revoked or expired" });
    return false;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.isDeleted) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const banStatus = getAccountBanStatus(user.isBanned, user.bannedUntil, user.banReason);
  if (banStatus.kind === "expired") {
    await db.update(usersTable).set({
      isBanned: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id));
    user.isBanned = false;
    user.bannedAt = null;
    user.bannedUntil = null;
    user.banReason = null;
  } else if (banStatus.kind === "temporary") {
    res.status(403).json(temporaryRestrictionResponse(banStatus.until, user.banReason));
    return false;
  } else if (banStatus.kind === "permanent") {
    res.status(403).json({ error: "Account banned", reason: user.banReason });
    return false;
  }
  if (getSessionAuthVersion(token) !== user.authVersion) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  (req as any).currentUser = user;
  return true;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await resolveUser(req, res);
  if (ok) next();
}

export async function validateBearerTokenState(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = auth.slice(7);
  const userId = getSessionUserId(token);
  if (!userId) {
    next();
    return;
  }

  try {
    if (await isTokenBlacklisted(token)) {
      delete req.headers.authorization;
      next();
      return;
    }
    if (!(await isSessionActive(token, userId))) {
      delete req.headers.authorization;
      next();
      return;
    }
    const [user] = await db.select({ authVersion: usersTable.authVersion, isDeleted: usersTable.isDeleted }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.isDeleted || getSessionAuthVersion(token) !== user.authVersion) delete req.headers.authorization;
    next();
  } catch {
    res.status(503).json({ error: "Authentication state is temporarily unavailable" });
  }
}

/**
 * Optional auth - attaches userId if a valid Bearer token is present,
 * but never rejects the request for missing/invalid credentials.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const userId = getSessionUserId(token);
    if (userId && !(await isTokenBlacklisted(token)) && (await isSessionActive(token, userId))) {
      const [user] = await db.select({ authVersion: usersTable.authVersion, isDeleted: usersTable.isDeleted }).from(usersTable).where(eq(usersTable.id, userId));
      if (!user || user.isDeleted || getSessionAuthVersion(token) !== user.authVersion) {
        next();
        return;
      }
      (req as any).userId = userId;
    }
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await resolveUser(req, res);
  if (!ok) return;
  const user = (req as any).currentUser;
  if (!ADMIN_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await resolveUser(req, res);
  if (!ok) return;
  const user = (req as any).currentUser;
  if (!SUPER_ADMIN_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}
