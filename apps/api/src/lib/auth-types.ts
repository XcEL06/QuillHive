import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, type User } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSessionAuthVersion, getSessionUserId, isTokenBlacklisted } from "./auth";

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
    if (user.isBanned) return res.status(403).json({ error: "Account banned" });
    try {
      await handler(req as AuthenticatedRequest, res, next);
    } catch (err) {
      next(err);
    }
  };
}
