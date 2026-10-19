import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, type User } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSessionAuthVersion, getSessionUserId, isSessionActive, isTokenBlacklisted } from "./auth";
import { getAccountBanStatus, temporaryRestrictionResponse } from "./accountRestriction";

export interface AuthenticatedRequest extends Request {
  currentUser: User;
}

export function getCurrentUser(req: Request): User | null {
  return (req as Partial<AuthenticatedRequest>).currentUser ?? null;
}

export function getViewerId(req: Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

export async function loadCurrentUser(req: Request): Promise<User | null> {
  const cached = (req as Partial<AuthenticatedRequest>).currentUser;
  if (cached) return cached;
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const userId = getSessionUserId(token);
  if (!userId) return null;
  if (await isTokenBlacklisted(token)) return null;
  if (!(await isSessionActive(token, userId))) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || getSessionAuthVersion(token) !== user.authVersion) return null;
  (req as Partial<AuthenticatedRequest>).currentUser = user;
  return user;
}

export function requireAuthTyped(
  handler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown | Promise<unknown>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadCurrentUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const banStatus = getAccountBanStatus(user.isBanned, user.bannedUntil, user.banReason);
    if (banStatus.kind === "temporary") return res.status(403).json(temporaryRestrictionResponse(banStatus.until, user.banReason));
    if (banStatus.kind === "permanent") return res.status(403).json({ error: "Account banned", reason: user.banReason });
    if (banStatus.kind === "expired") {
      await db.update(usersTable).set({
        isBanned: false,
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
        updatedAt: new Date(),
      }).where(eq(usersTable.id, user.id));
      return res.status(401).json({ error: "Session expired; please sign in again." });
    }
    try {
      await handler(req as AuthenticatedRequest, res, next);
    } catch (err) {
      next(err);
    }
  };
}
