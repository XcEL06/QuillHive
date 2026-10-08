import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sessionsTable, loginEventsTable } from "@workspace/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getViewerId } from "../../lib/auth-types";

function maskIpHash(hash: string | null): string | null {
  if (!hash) return null;
  return `${hash.slice(0, 8)}…`;
}

export async function listMySessions(req: Request, res: Response) {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sessions = await db
    .select({
      id: sessionsTable.id,
      userAgent: sessionsTable.userAgent,
      ipHash: sessionsTable.ipHash,
      createdAt: sessionsTable.createdAt,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(10);

  return res.json(
    sessions.map((s) => ({
      ...s,
      ipHash: maskIpHash(s.ipHash),
    })),
  );
}

export async function listMyLoginActivity(req: Request, res: Response) {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

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
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const deleted = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .returning({ id: sessionsTable.id });

  return res.json({ revoked: deleted.length });
}

export async function revokeMySession(req: Request, res: Response) {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sessionId = Number(req.params.id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  const deleted = await db
    .delete(sessionsTable)
    .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.userId, userId)))
    .returning({ id: sessionsTable.id });

  if (deleted.length === 0) return res.status(404).json({ error: "Session not found" });
  return res.json({ revoked: true });
}
