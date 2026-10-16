import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { moderationStrikesTable } from "@workspace/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";

interface AuthedRequest extends Request {
  currentUser: { id: number };
}

export const strikesRouter = Router();

strikesRouter.get("/me", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const rows = await db
    .select()
    .from(moderationStrikesTable)
    .where(eq(moderationStrikesTable.userId, userId))
    .orderBy(desc(moderationStrikesTable.createdAt));
  return res.json({ strikes: rows });
});

strikesRouter.get("/me/unacknowledged", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const rows = await db
    .select()
    .from(moderationStrikesTable)
    .where(and(eq(moderationStrikesTable.userId, userId), isNull(moderationStrikesTable.acknowledgedAt)))
    .orderBy(desc(moderationStrikesTable.createdAt));
  return res.json({ strikes: rows, count: rows.length });
});

strikesRouter.post("/:id/acknowledge", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [strike] = await db
    .select()
    .from(moderationStrikesTable)
    .where(eq(moderationStrikesTable.id, id));
  if (!strike) return res.status(404).json({ error: "Strike not found" });
  if (strike.userId !== userId) return res.status(403).json({ error: "Forbidden" });
  const [updated] = await db
    .update(moderationStrikesTable)
    .set({ acknowledgedAt: new Date() })
    .where(eq(moderationStrikesTable.id, id))
    .returning();
  return res.json({ ok: true, strike: updated });
});

strikesRouter.post("/:id/appeal", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const id = Number(req.params.id);
  const appealText = typeof req.body?.appealText === "string" ? req.body.appealText.trim() : "";
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  if (appealText.length < 10 || appealText.length > 2000) return res.status(400).json({ error: "Appeal must be between 10 and 2000 characters." });
  const [updated] = await db.update(moderationStrikesTable)
    .set({ appealText, appealStatus: "pending", appealedAt: new Date() })
    .where(and(
      eq(moderationStrikesTable.id, id),
      eq(moderationStrikesTable.userId, userId),
      eq(moderationStrikesTable.appealStatus, "none"),
    ))
    .returning({ id: moderationStrikesTable.id, appealStatus: moderationStrikesTable.appealStatus, appealedAt: moderationStrikesTable.appealedAt });
  if (!updated) {
    const [strike] = await db.select({ id: moderationStrikesTable.id }).from(moderationStrikesTable)
      .where(and(eq(moderationStrikesTable.id, id), eq(moderationStrikesTable.userId, userId)));
    return strike
      ? res.status(409).json({ error: "An appeal has already been submitted for this strike." })
      : res.status(404).json({ error: "Strike not found" });
  }
  return res.json(updated);
});
