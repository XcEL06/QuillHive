import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sessionsTable, loginEventsTable } from "@workspace/db/schema";
import { and, eq, desc, gt, ne } from "drizzle-orm";
import { getSessionTokenHash } from "../../lib/auth";
import { loadCurrentUser } from "../../lib/auth-types";

function maskIpHash(hash: string | null): string | null {
  if (!hash) return null;
  return `${hash.slice(0, 8)}…`;
}

export async function listMySessions(req: Request, res: Response) {
  const user = await loadCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const userId = user.id;
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  const currentTokenHash = getSessionTokenHash(token);

  const sessions = await db
    .select({
      id: sessionsTable.id,
      tokenHash: sessionsTable.tokenHash,
      userAgent: sessionsTable.userAgent,
      ipHash: sessionsTable.ipHash,
      createdAt: sessionsTable.createdAt,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, userId), gt(sessionsTable.expiresAt, new Date())))
    .orderBy(desc(sessionsTable.createdAt));

  return res.json(
    sessions.map(({ tokenHash, ...session }) => ({
      ...session,
      ipHash: maskIpHash(session.ipHash),
      isCurrent: currentTokenHash !== null && tokenHash === currentTokenHash,
    })),
  );
}

export async function listMyLoginActivity(req: Request, res: Response) {
  const user = await loadCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const userId = user.id;

  const events = await db
    .select({
      id: loginEventsTable.id,
      ipHash: loginEventsTable.ipHash,
      userAgent: loginEventsTable.userAgent,
      country: loginEventsTable.country,
      timezone: loginEventsTable.timezone,
      integrityStatus: loginEventsTable.integrityStatus,
      riskScore: loginEventsTable.riskScore,
      createdAt: loginEventsTable.createdAt,
    })
    .from(loginEventsTable)
    .where(eq(loginEventsTable.userId, userId))
    .orderBy(desc(loginEventsTable.createdAt))
    .limit(5);

  return res.json(
    events.map((e) => ({
      ...e,
      ipHash: maskIpHash(e.ipHash),
    })),
  );
}

export async function revokeAllMySessions(req: Request, res: Response) {
  const user = await loadCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const deleted = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.userId, user.id))
    .returning({ id: sessionsTable.id });

  return res.json({ revoked: deleted.length });
}

export async function revokeOtherSessions(req: Request, res: Response) {
  const user = await loadCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  const currentTokenHash = getSessionTokenHash(token);
  if (!currentTokenHash) return res.status(401).json({ error: "Current session is invalid" });

  const revoked = await db.delete(sessionsTable)
    .where(and(eq(sessionsTable.userId, user.id), ne(sessionsTable.tokenHash, currentTokenHash)))
    .returning({ id: sessionsTable.id });
  return res.json({ revoked: revoked.length });
}

export async function revokeMySession(req: Request, res: Response) {
  const user = await loadCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const sessionId = Number(req.params.id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  const deleted = await db
    .delete(sessionsTable)
    .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.userId, user.id)))
    .returning({ id: sessionsTable.id });

  if (deleted.length === 0) return res.status(404).json({ error: "Session not found" });
  return res.json({ revoked: true });
}
