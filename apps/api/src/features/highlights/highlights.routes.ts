import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { postsTable, usersTable } from "@workspace/db/schema";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getViewerId } from "../../lib/auth-types";
import { logger } from "../../lib/logger";
import { activeHighlightExpiryCondition } from "../posts/postExpiry";

export const highlightsRouter: Router = Router();

const HIGHLIGHT_DURATION_MS = 24 * 60 * 60 * 1000;

const publishHighlightSchema = z.object({
  durationHours: z.number().int().min(1).max(72).optional(),
});

/** Public feed: active (non-expired) highlights, newest first. */
highlightsRouter.get("/", async (_req, res) => {
  const now = new Date();
  const rows = await db
    .select({
      id: postsTable.id,
      authorId: postsTable.authorId,
      title: postsTable.title,
      excerpt: postsTable.excerpt,
      content: postsTable.content,
      imageUrl: postsTable.imageUrl,
      type: postsTable.type,
      tags: postsTable.tags,
      expiresAt: postsTable.expiresAt,
      createdAt: postsTable.createdAt,
      authorUsername: usersTable.username,
      authorDisplayName: usersTable.displayName,
      authorAvatarUrl: usersTable.avatarUrl,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(usersTable.id, postsTable.authorId))
    .where(
      and(
        eq(postsTable.isHighlight, true),
        eq(postsTable.isDeleted, false),
        eq(postsTable.isPublished, true),
        activeHighlightExpiryCondition(now),
      ),
    )
    .orderBy(desc(postsTable.createdAt))
    .limit(50);

  return res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      content: r.content,
      imageUrl: r.imageUrl,
      type: r.type,
      tags: JSON.parse(r.tags || "[]") as string[],
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      author: {
        id: r.authorId,
        username: r.authorUsername,
        displayName: r.authorDisplayName,
        avatarUrl: r.authorAvatarUrl,
      },
    })),
  );
});

/** Mark an existing post as a 24-hour highlight. */
highlightsRouter.post("/posts/:id/highlight", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const postId = Number(req.params.id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const parsed = publishHighlightSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.authorId !== viewerId) return res.status(403).json({ error: "Forbidden" });

  const durationMs = (parsed.data.durationHours ?? 24) * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs);

  const [updated] = await db
    .update(postsTable)
    .set({ isHighlight: true, expiresAt, updatedAt: new Date() })
    .where(eq(postsTable.id, postId))
    .returning();

  return res.json({ ok: true, expiresAt: updated.expiresAt });
});

highlightsRouter.delete("/posts/:id/highlight", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const postId = Number(req.params.id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.authorId !== viewerId) return res.status(403).json({ error: "Forbidden" });

  await db
    .update(postsTable)
    .set({ isHighlight: false, expiresAt: null, updatedAt: new Date() })
    .where(eq(postsTable.id, postId));

  return res.json({ ok: true });
});

/** Cron-style cleanup: soft-delete highlights past their expiresAt. */
export async function expireHighlights(): Promise<void> {
  try {
    const now = new Date();
    const expired = await db
      .update(postsTable)
      .set({ isHighlight: false, isPublished: false, updatedAt: new Date() })
      .where(
        and(
          eq(postsTable.isHighlight, true),
          or(
            lt(postsTable.expiresAt as never, now),
            and(
              eq(postsTable.type, "spark"),
              isNull(postsTable.expiresAt),
              lt(postsTable.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
            ),
          ),
        ),
      )
      .returning({ id: postsTable.id, expiresAt: postsTable.expiresAt });

    const stillExpired = expired.filter((p) => p.expiresAt && p.expiresAt < now);
    if (stillExpired.length > 0) {
      logger.info({ count: stillExpired.length }, "Expired highlights cleaned up");
    }
  } catch (err) {
    logger.error({ err }, "Error in expireHighlights");
  }
}
