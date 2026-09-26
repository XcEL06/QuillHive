import { createHash } from "crypto";
import type { Request } from "express";
import { db } from "@workspace/db";
import { commentsTable, followsTable, likesTable, postViewsTable, postsTable, readingProgressTable, usersTable } from "@workspace/db/schema";
import { and, count, eq, gte, inArray, sql, desc } from "drizzle-orm";
import { emitToPost } from "../../lib/socket";

function hashIp(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

function numberValue(value: unknown): number {
  return Number(value ?? 0);
}

function engagementRate(interactions: number, reach: number): number {
  if (reach <= 0) return 0;
  return Math.round((interactions / reach) * 10_000) / 100;
}

export async function recordPostView(postId: number, viewerId: number | null, req: Request) {
  const [post] = await db
    .select({ authorId: postsTable.authorId })
    .from(postsTable)
    .where(eq(postsTable.id, postId));
  if (!post || (viewerId !== null && post.authorId === viewerId)) return;

  const cfCountry = req.headers["cf-ipcountry"] as string | undefined;
  const country = cfCountry && cfCountry !== "XX" ? cfCountry : null;
  const ipHash = hashIp(getIp(req));
  const viewerFilter = viewerId === null
    ? eq(postViewsTable.ipHash, ipHash)
    : eq(postViewsTable.viewerId, viewerId);
  const [existingView] = await db
    .select({ id: postViewsTable.id })
    .from(postViewsTable)
    .where(and(eq(postViewsTable.postId, postId), viewerFilter))
    .limit(1);
  if (existingView) return;

  await db.insert(postViewsTable).values({
    postId,
    viewerId,
    ipHash,
    userAgent: req.headers["user-agent"]?.slice(0, 500) ?? null,
    country: country ?? null,
  });
  try {
    const [row] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(postViewsTable)
      .where(and(
        eq(postViewsTable.postId, postId),
        sql`${postViewsTable.viewerId} IS DISTINCT FROM ${post.authorId}`,
      ));
    const totalViews = numberValue(row?.total);
    emitToPost(postId, "post:view", { postId, totalViews });

    // Non-blocking milestone + trending notifications
    void (async () => {
      try {
        const [post] = await db
          .select({ authorId: postsTable.authorId, createdAt: postsTable.createdAt, tags: postsTable.tags })
          .from(postsTable)
          .where(eq(postsTable.id, postId));
        if (!post?.authorId) return;

        const { notificationsTable } = await import("@workspace/db/schema");
        const { getIO } = await import("../../lib/socket");

        // Milestone notification
        const milestones = [10, 50, 100, 500, 1000, 5000];
        if (milestones.includes(totalViews)) {
          const existing = await db
            .select({ id: notificationsTable.id })
            .from(notificationsTable)
            .where(
              and(
                eq(notificationsTable.userId, post.authorId),
                eq(notificationsTable.type, "milestone"),
                sql`${notificationsTable.message} LIKE ${"%" + totalViews + " views%"}`,
                sql`${notificationsTable.postId} = ${postId}`,
              ),
            )
            .limit(1);
          if (existing.length === 0) {
            const emoji = totalViews >= 1000 ? "🔥" : totalViews >= 100 ? "🎉" : "👀";
            const msg = `${emoji} Your post reached ${totalViews.toLocaleString()} views!`;
            await db.insert(notificationsTable).values({
              userId: post.authorId,
              actorId: post.authorId,
              type: "milestone",
              message: msg,
              postId,
              category: "growth",
            });
            const io = getIO();
            if (io) {
              io.to(`user:${post.authorId}`).emit("notification:new", { type: "milestone", message: msg });
            }
          }
        }

        // Trending notification (100 views in first 24h)
        if (totalViews === 100) {
          const postAge = Date.now() - new Date(post.createdAt).getTime();
          if (postAge < 24 * 60 * 60 * 1000) {
            const existingTrending = await db
              .select({ id: notificationsTable.id })
              .from(notificationsTable)
              .where(
                and(
                  eq(notificationsTable.userId, post.authorId),
                  eq(notificationsTable.type, "trending"),
                  sql`${notificationsTable.postId} = ${postId}`,
                ),
              )
              .limit(1);
            if (existingTrending.length === 0) {
              const tags = (() => { try { return JSON.parse(post.tags || "[]") as string[]; } catch { return [] as string[]; } })();
              const topicLabel = tags[0] ? ` in #${tags[0]}` : "";
              const msg = `📈 Your post is trending${topicLabel}! It reached 100 views in under 24 hours.`;
              await db.insert(notificationsTable).values({
                userId: post.authorId,
                actorId: post.authorId,
                type: "trending",
                message: msg,
                postId,
                category: "growth",
              });
              const io2 = getIO();
              if (io2) {
                io2.to(`user:${post.authorId}`).emit("notification:new", { type: "trending", message: `📈 Your post is trending${topicLabel}!` });
              }
            }
          }
        }
      } catch { /* never block */ }
    })();
  } catch {
    // best-effort live counter
  }
}

export async function getGeographyAnalytics(userId: number): Promise<Array<{ country: string; views: number; percentage: number }>> {
  const posts = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, userId), eq(postsTable.isDeleted, false)));

  if (posts.length === 0) return [];

  const postIds = posts.map(p => p.id);
  const rows = await db
    .select({
      country: sql<string>`COALESCE(${postViewsTable.country}, 'Unknown')`,
      views: sql<number>`COUNT(*)::int`,
    })
    .from(postViewsTable)
    .where(and(
      inArray(postViewsTable.postId, postIds),
      sql`${postViewsTable.viewerId} IS DISTINCT FROM ${userId}`,
    ))
    .groupBy(sql`COALESCE(${postViewsTable.country}, 'Unknown')`)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(20);

  const total = rows.reduce((acc, r) => acc + r.views, 0);
  return rows.map(r => ({
    country: r.country,
    views: r.views,
    percentage: total > 0 ? Math.round((r.views / total) * 10000) / 100 : 0,
  }));
}

export async function getDailyFollowerGrowth(userId: number, days = 30): Promise<Array<{ date: string; count: number }>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${followsTable.createdAt})::date::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(followsTable)
    .where(and(eq(followsTable.followingId, userId), gte(followsTable.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${followsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${followsTable.createdAt})`);

  // Fill in missing days with 0
  const resultMap = new Map<string, number>(rows.map(r => [r.date as string, Number(r.count)]));
  const result: Array<{ date: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: Number(resultMap.get(key) ?? 0) });
  }
  return result;
}

export async function getUserAnalytics(userId: number) {
  const [userRow] = await db
    .select({ reachMultiplier: usersTable.reachMultiplier, visibilityPenalty: usersTable.visibilityPenalty })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const posts = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, userId), eq(postsTable.isDeleted, false)));
  const postIds = posts.map(post => post.id);
  const [followers] = await db.select({ count: count() }).from(followsTable).where(eq(followsTable.followingId, userId));
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [newFollowers30d] = await db.select({ count: count() }).from(followsTable).where(and(eq(followsTable.followingId, userId), gte(followsTable.createdAt, since30)));
  const dailyGrowth = await getDailyFollowerGrowth(userId, 30);

  if (postIds.length === 0) {
    const followerCount = numberValue(followers?.count);
    const growth = numberValue(newFollowers30d?.count);
    return {
      totals: { posts: 0, views: 0, likes: 0, comments: 0, followers: followerCount },
      followerGrowth: { last30Days: growth, percentage: followerCount > growth ? Math.round((growth / (followerCount - growth)) * 10_000) / 100 : growth > 0 ? 100 : 0 },
      dailyFollowerGrowth: dailyGrowth,
      engagementRate: 0,
      postReach: 0,
      topPosts: [],
      reachMultiplier: userRow?.reachMultiplier ?? 1.0,
    };
  }
  const [views] = await db
    .select({
      count: sql<number>`count(*)::int`,
      reach: sql<number>`count(distinct coalesce(${postViewsTable.viewerId}::text, ${postViewsTable.ipHash}))::int`,
    })
    .from(postViewsTable)
    .where(and(
      inArray(postViewsTable.postId, postIds),
      sql`${postViewsTable.viewerId} IS DISTINCT FROM ${userId}`,
    ));
  const [likes] = await db.select({ count: count() }).from(likesTable).where(inArray(likesTable.postId, postIds));
  const [comments] = await db.select({ count: count() }).from(commentsTable).where(inArray(commentsTable.postId, postIds));
  const topPosts = await Promise.all(
    postIds.slice(0, 10).map(async postId => {
      const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
      const [postViews] = await db.select({ count: count() }).from(postViewsTable).where(and(
        eq(postViewsTable.postId, postId),
        sql`${postViewsTable.viewerId} IS DISTINCT FROM ${userId}`,
      ));
      const [postLikes] = await db.select({ count: count() }).from(likesTable).where(eq(likesTable.postId, postId));
      const [postComments] = await db.select({ count: count() }).from(commentsTable).where(eq(commentsTable.postId, postId));
      return {
        id: postId,
        title: post?.title ?? "Untitled",
        views: numberValue(postViews?.count),
        likes: numberValue(postLikes?.count),
        comments: numberValue(postComments?.count),
      };
    }),
  );
  const totalViews = numberValue(views?.count);
  const totalReach = numberValue(views?.reach);
  const totalLikes = numberValue(likes?.count);
  const totalComments = numberValue(comments?.count);
  const followerCount = numberValue(followers?.count);
  const growth = numberValue(newFollowers30d?.count);
  return {
    totals: { posts: postIds.length, views: totalViews, likes: totalLikes, comments: totalComments, followers: followerCount },
    followerGrowth: { last30Days: growth, percentage: followerCount > growth ? Math.round((growth / (followerCount - growth)) * 10_000) / 100 : growth > 0 ? 100 : 0 },
    dailyFollowerGrowth: dailyGrowth,
    engagementRate: engagementRate(totalLikes + totalComments, Math.max(totalReach, totalViews)),
    postReach: totalReach,
    topPosts: topPosts.sort((a, b) => b.views + b.likes + b.comments - (a.views + a.likes + a.comments)),
    reachMultiplier: userRow?.reachMultiplier ?? 1.0,
  };
}

export async function getPostAnalytics(postId: number, viewerId: number) {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post || post.isDeleted) return null;
  const [viewer] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, viewerId));
  const isAdmin = viewer?.role === "admin" || viewer?.role === "super_admin";
  if (post.authorId !== viewerId && !isAdmin) throw new Error("Forbidden");
  const [views] = await db
    .select({
      count: sql<number>`count(*)::int`,
      reach: sql<number>`count(distinct coalesce(${postViewsTable.viewerId}::text, ${postViewsTable.ipHash}))::int`,
    })
    .from(postViewsTable)
    .where(and(
      eq(postViewsTable.postId, postId),
      sql`${postViewsTable.viewerId} IS DISTINCT FROM ${post.authorId}`,
    ));
  const [likes] = await db.select({ count: count() }).from(likesTable).where(eq(likesTable.postId, postId));
  const [comments] = await db.select({ count: count() }).from(commentsTable).where(eq(commentsTable.postId, postId));
  const [reading] = await db
    .select({
      readerCount: sql<number>`count(*)::int`,
      avgReadTimeMs: sql<number>`COALESCE(AVG(${readingProgressTable.readTimeMs}), 0)::float`,
    })
    .from(readingProgressTable)
    .where(eq(readingProgressTable.postId, postId));
  const totalViews = numberValue(views?.count);
  const totalReach = numberValue(views?.reach);
  const totalLikes = numberValue(likes?.count);
  const totalComments = numberValue(comments?.count);
  return {
    postId,
    views: totalViews,
    reach: totalReach,
    likes: totalLikes,
    comments: totalComments,
    readerCount: numberValue(reading?.readerCount),
    avgReadTimeMs: Math.round(numberValue(reading?.avgReadTimeMs)),
    engagementRate: engagementRate(totalLikes + totalComments, Math.max(totalReach, totalViews)),
  };
}