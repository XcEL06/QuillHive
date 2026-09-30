import { Router } from "express";
import { db } from "@workspace/db";
import {
  topicsTable,
  topicFollowsTable,
  postTopicsTable,
  postsTable,
  boostRequestsTable,
  DEFAULT_TOPICS,
} from "@workspace/db/schema";
import { eq, desc, and, sql, gt, isNull, lte, or, inArray } from "drizzle-orm";
import { getSessionUserId } from "../../lib/auth";
import { enrichPost } from "../posts/post.service";
import { calculateRankingScore } from "../posts/ranking.service";
import { visiblePostExpiryCondition } from "../posts/postExpiry";
import { postVisibilityCondition } from "../posts/postVisibility";
import { usersTable, userTrustScoresTable } from "@workspace/db/schema";

export const topicsRouter = Router();
export const topicFeedRouter = Router();

function getViewerId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

topicsRouter.get("/", async (req, res) => {
  const viewerId = getViewerId(req);
  const topics = await db.select().from(topicsTable).orderBy(desc(topicsTable.followerCount));

  if (!viewerId) return res.json(topics.map(t => ({ ...t, isFollowing: false })));

  const follows = await db
    .select({ topicId: topicFollowsTable.topicId })
    .from(topicFollowsTable)
    .where(eq(topicFollowsTable.userId, viewerId));

  const followedSet = new Set(follows.map(f => f.topicId));
  return res.json(topics.map(t => ({ ...t, isFollowing: followedSet.has(t.id) })));
});

topicsRouter.get("/trending", async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 15;
  const topics = await db
    .select()
    .from(topicsTable)
    .orderBy(desc(topicsTable.postCount), desc(topicsTable.followerCount))
    .limit(limit);
  return res.json(topics);
});

topicsRouter.get("/following", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const follows = await db
    .select({ topicId: topicFollowsTable.topicId })
    .from(topicFollowsTable)
    .where(eq(topicFollowsTable.userId, viewerId));

  if (follows.length === 0) return res.json([]);

  const topicIds = follows.map(f => f.topicId);
  const topics = await db
    .select()
    .from(topicsTable)
    .where(sql`${topicsTable.id} = ANY(ARRAY[${sql.join(topicIds.map(id => sql`${id}`), sql`, `)}])`);

  return res.json(topics);
});

topicsRouter.get("/:slug", async (req, res) => {
  const viewerId = getViewerId(req);
  const [topic] = await db.select().from(topicsTable).where(eq(topicsTable.slug, req.params.slug));
  if (!topic) return res.status(404).json({ error: "Topic not found" });

  let isFollowing = false;
  if (viewerId) {
    const [follow] = await db
      .select()
      .from(topicFollowsTable)
      .where(and(eq(topicFollowsTable.userId, viewerId), eq(topicFollowsTable.topicId, topic.id)));
    isFollowing = !!follow;
  }

  const postLinks = await db
    .select({ postId: postTopicsTable.postId })
    .from(postTopicsTable)
    .where(eq(postTopicsTable.topicId, topic.id))
    .orderBy(desc(postTopicsTable.createdAt))
    .limit(20);

  const postIds = postLinks.map(p => p.postId);
  let posts: any[] = [];
  if (postIds.length > 0) {
    const rawPosts = await db
      .select()
      .from(postsTable)
      .where(and(
        sql`${postsTable.id} = ANY(ARRAY[${sql.join(postIds.map(id => sql`${id}`), sql`, `)}])`,
        eq(postsTable.isPublished, true),
        eq(postsTable.isDeleted, false),
        visiblePostExpiryCondition(),
        postVisibilityCondition(viewerId),
      ));
    const authorIds = [...new Set(rawPosts.map(p => p.authorId))];
    const [authors, trustScores, activeBoosts] = await Promise.all([
      db.select({ id: usersTable.id, isOfficialAccount: usersTable.isOfficialAccount, role: usersTable.role })
        .from(usersTable).where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(authorIds.map(id => sql`${id}`), sql`, `)}])`),
      db.select({ userId: userTrustScoresTable.userId, tier: userTrustScoresTable.tier, creatorLevel: userTrustScoresTable.creatorLevel })
        .from(userTrustScoresTable).where(sql`${userTrustScoresTable.userId} = ANY(ARRAY[${sql.join(authorIds.map(id => sql`${id}`), sql`, `)}])`),
      db.select({ postId: boostRequestsTable.postId, reachMultiplier: boostRequestsTable.reachMultiplier, placementPriority: boostRequestsTable.placementPriority })
        .from(boostRequestsTable).where(and(inArray(boostRequestsTable.postId, postIds), eq(boostRequestsTable.status, "approved"), or(isNull(boostRequestsTable.boostStartsAt), lte(boostRequestsTable.boostStartsAt, new Date())), gt(boostRequestsTable.boostEndsAt, new Date()))),
    ]);
    const authorMap = new Map(authors.map(a => [a.id, a]));
    const trustMap = new Map(trustScores.map(t => [t.userId, t]));
    const boostMap = new Map(activeBoosts.map(b => [b.postId, b]));
    const now = Date.now();
    rawPosts.sort((a, b) => {
      const rank = (post: typeof a) => {
        const author = authorMap.get(post.authorId);
        const trust = trustMap.get(post.authorId);
        const ageHours = (now - new Date(post.createdAt).getTime()) / 3_600_000;
        const boost = boostMap.get(post.id);
        return calculateRankingScore({
          ageHours,
          author: {
          isOfficialAccount: author?.isOfficialAccount,
          role: author?.role,
          tier: trust?.tier,
          creatorLevel: trust?.creatorLevel,
          },
          post,
          isOfficialPost: post.isOfficialPost,
          activeBoost: boost,
        });
      };
      return rank(b) - rank(a);
    });
    posts = await Promise.all(rawPosts.map(p => enrichPost(p, viewerId)));
  }

  return res.json({ ...topic, isFollowing, posts });
});

topicsRouter.post("/:id/follow", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const topicId = parseInt(req.params.id);
  if (isNaN(topicId)) return res.status(400).json({ error: "Invalid topic id" });

  const [existing] = await db
    .select()
    .from(topicFollowsTable)
    .where(and(eq(topicFollowsTable.userId, viewerId), eq(topicFollowsTable.topicId, topicId)));

  if (existing) return res.json({ message: "Already following" });

  await db.insert(topicFollowsTable).values({ userId: viewerId, topicId });
  await db
    .update(topicsTable)
    .set({ followerCount: sql`${topicsTable.followerCount} + 1` })
    .where(eq(topicsTable.id, topicId));

  return res.json({ success: true });
});

topicsRouter.delete("/:id/follow", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const topicId = parseInt(req.params.id);
  if (isNaN(topicId)) return res.status(400).json({ error: "Invalid topic id" });

  await db
    .delete(topicFollowsTable)
    .where(and(eq(topicFollowsTable.userId, viewerId), eq(topicFollowsTable.topicId, topicId)));

  await db
    .update(topicsTable)
    .set({ followerCount: sql`GREATEST(0, ${topicsTable.followerCount} - 1)` })
    .where(eq(topicsTable.id, topicId));

  return res.json({ success: true });
});

topicFeedRouter.get("/feed/topic/:slug", async (req, res) => {
  const viewerId = getViewerId(req);
  const [topic] = await db.select().from(topicsTable).where(eq(topicsTable.slug, req.params.slug));
  if (!topic) return res.status(404).json({ error: "Topic not found" });

  const postLinks = await db
    .select({ postId: postTopicsTable.postId })
    .from(postTopicsTable)
    .where(eq(postTopicsTable.topicId, topic.id))
    .orderBy(desc(postTopicsTable.createdAt))
    .limit(30);

  const postIds = postLinks.map(p => p.postId);
  if (postIds.length === 0) return res.json({ topic, posts: [], total: 0 });

  const rawPosts = await db
    .select()
    .from(postsTable)
    .where(and(
      sql`${postsTable.id} = ANY(ARRAY[${sql.join(postIds.map(id => sql`${id}`), sql`, `)}])`,
      eq(postsTable.isPublished, true),
      eq(postsTable.isDeleted, false),
      visiblePostExpiryCondition(),
      postVisibilityCondition(viewerId),
    ));

  const authorIds = [...new Set(rawPosts.map(p => p.authorId))];
  const postIdsForRanking = rawPosts.map(p => p.id);
  const [authors, trustScores, activeBoosts] = await Promise.all([
    db.select({ id: usersTable.id, isOfficialAccount: usersTable.isOfficialAccount, role: usersTable.role })
      .from(usersTable).where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(authorIds.map(id => sql`${id}`), sql`, `)}])`),
    db.select({ userId: userTrustScoresTable.userId, tier: userTrustScoresTable.tier, creatorLevel: userTrustScoresTable.creatorLevel })
      .from(userTrustScoresTable).where(sql`${userTrustScoresTable.userId} = ANY(ARRAY[${sql.join(authorIds.map(id => sql`${id}`), sql`, `)}])`),
    db.select({ postId: boostRequestsTable.postId, reachMultiplier: boostRequestsTable.reachMultiplier, placementPriority: boostRequestsTable.placementPriority })
      .from(boostRequestsTable).where(and(inArray(boostRequestsTable.postId, postIdsForRanking), eq(boostRequestsTable.status, "approved"), or(isNull(boostRequestsTable.boostStartsAt), lte(boostRequestsTable.boostStartsAt, new Date())), gt(boostRequestsTable.boostEndsAt, new Date()))),
  ]);
  const authorMap = new Map(authors.map(a => [a.id, a]));
  const trustMap = new Map(trustScores.map(t => [t.userId, t]));
  const boostMap = new Map(activeBoosts.map(b => [b.postId, b]));
  const now = Date.now();
  rawPosts.sort((a, b) => {
    const rank = (post: typeof a) => {
      const author = authorMap.get(post.authorId);
      const trust = trustMap.get(post.authorId);
      const ageHours = (now - new Date(post.createdAt).getTime()) / 3_600_000;
      const boost = boostMap.get(post.id);
      return calculateRankingScore({
        ageHours,
        author: {
        isOfficialAccount: author?.isOfficialAccount,
        role: author?.role,
        tier: trust?.tier,
        creatorLevel: trust?.creatorLevel,
        },
        post,
        isOfficialPost: post.isOfficialPost,
        activeBoost: boost,
      });
    };
    return rank(b) - rank(a);
  });
  const posts = await Promise.all(rawPosts.map(p => enrichPost(p, viewerId)));
  return res.json({ topic, posts, total: posts.length });
});

export async function seedTopics() {
  const existing = await db.select({ id: topicsTable.id }).from(topicsTable).limit(1);
  if (existing.length > 0) return;

  for (const topic of DEFAULT_TOPICS) {
    await db.insert(topicsTable).values(topic).onConflictDoNothing();
  }
  console.log("[Topics] Seeded 20 default topics");
}
