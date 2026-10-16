import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { postsTable } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getViewerId } from "../../lib/auth-types";
import { findSimilarPosts } from "./originality.service";
import { aiTextScore } from "./aiText.service";
import { postVisibilityCondition } from "../posts/postVisibility";

export const safetyRouter: Router = Router();

const checkSchema = z.object({
  content: z.string().min(40).max(100_000),
  excludePostId: z.number().int().positive().optional(),
});

/** Pre-publish check: returns AI score + similar posts. Author-side advisory. */
safetyRouter.post("/check", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [aiScore, similar] = await Promise.all([
    Promise.resolve(aiTextScore(parsed.data.content)),
    findSimilarPosts(parsed.data.content, parsed.data.excludePostId ?? null, 0.7, 5),
  ]);

  let similarPosts: Array<{ id: number; title: string | null; authorId: number; similarity: number }> = [];
  if (similar.length > 0) {
    const rows = await db
      .select({ id: postsTable.id, title: postsTable.title, authorId: postsTable.authorId })
      .from(postsTable)
      .where(and(
        inArray(postsTable.id, similar.map((match) => match.postId)),
        eq(postsTable.isDeleted, false),
        eq(postsTable.isPublished, true),
        postVisibilityCondition(viewerId),
      ));
    for (const s of similar) {
      const r = rows.find((x) => x.id === s.postId);
      if (r) similarPosts.push({ ...r, similarity: s.similarity });
    }
  }
  const visibleTopSimilarity = similarPosts[0]?.similarity ?? 0;

  return res.json({
    aiTextScore: aiScore,
    aiTextLikely: aiScore >= 0.55,
    similarPosts,
    duplicateLikely: visibleTopSimilarity >= 0.85,
    originalityDisclaimer: "Text overlap is an advisory signal and is not proof of plagiarism or authorship.",
  });
});
