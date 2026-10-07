import { db } from "@workspace/db";
import { postsTable, usersTable, topicsTable, followsTable, boostRequestsTable, userTrustScoresTable } from "@workspace/db/schema";
import { and, desc, eq, gt, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getMutualBlockSet } from "../safety/blocks.service";
import { calculateRankingScore } from "../posts/ranking.service";

export interface SearchHit<T> {
  type: "post" | "user" | "topic";
  score: number;
  item: T;
}

interface SearchOptions {
  q: string;
  type?: "post" | "user" | "topic" | "all";
  limit?: number;
  viewerId?: number | null;
}

/**
 * Full-text-ish search via Postgres `to_tsvector` with a soft fallback to ILIKE.
 * Score = ts_rank for posts; falls back to position match for users/topics.
 */
export async function search(opts: SearchOptions) {
  const q = opts.q.trim();
  if (q.length < 2) return { posts: [], users: [], topics: [] };
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const wantAll = !opts.type || opts.type === "all";
  const blocked = opts.viewerId ? await getMutualBlockSet(opts.viewerId) : new Set<number>();

  const tsQuery = sql<string>`plainto_tsquery('english', ${q})`;

  const postsP = wantAll || opts.type === "post"
    ? db.execute(sql`
        SELECT id, title, excerpt, content, author_id as "authorId", created_at as "createdAt", image_url as "imageUrl",
          ts_rank(
            setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
            setweight(to_tsvector('english', coalesce(excerpt,'')), 'B') ||
            setweight(to_tsvector('english', coalesce(content,'')), 'C'),
            ${tsQuery}
          ) as score
        FROM posts
        WHERE is_published = true AND is_deleted = false
          AND (
            to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')) @@ ${tsQuery}
            OR title ILIKE ${"%" + q + "%"}
          )
        ORDER BY score DESC, created_at DESC
        LIMIT ${limit * 5}
      `)
    : Promise.resolve({ rows: [] as any[] });

  const followerCountSql = sql<number>`(SELECT COUNT(*)::int FROM ${followsTable} WHERE ${followsTable.followingId} = ${usersTable.id})`.as("follower_count");
  const usersP = wantAll || opts.type === "user"
    ? db
        .select({
          id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl, bio: usersTable.bio, followers: followerCountSql,
        })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.isBanned, false),
            eq(usersTable.showInSearch, true),
            or(ilike(usersTable.displayName, `%${q}%`), ilike(usersTable.username, `%${q}%`), ilike(usersTable.bio, `%${q}%`)),
          ),
        )
        .orderBy(desc(followerCountSql))
        .limit(limit)
    : Promise.resolve([] as any[]);

  const topicsP = wantAll || opts.type === "topic"
    ? db
        .select({ id: topicsTable.id, name: topicsTable.name, slug: topicsTable.slug, postCount: topicsTable.postCount })
        .from(topicsTable)
        .where(or(ilike(topicsTable.name, `%${q}%`), ilike(topicsTable.slug, `%${q}%`)))
        .orderBy(desc(topicsTable.postCount))
        .limit(limit)
    : Promise.resolve([] as any[]);

  const [postsRes, users, topics] = await Promise.all([postsP, usersP, topicsP]);
  const searchRows = ((postsRes as any).rows ?? []).filter((p: any) => !blocked.has(p.authorId));
  const authorIds: number[] = Array.from(new Set<number>(searchRows.map((p: any) => Number(p.authorId))));
  const postIds: number[] = searchRows.map((p: any) => Number(p.id));
  const now = new Date();
  const [authors, trustScores, activeBoosts] = postIds.length > 0
    ? await Promise.all([
        db.select({
          id: usersTable.id,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
          isOfficialAccount: usersTable.isOfficialAccount,
          role: usersTable.role,
          reachMultiplier: usersTable.reachMultiplier,
        })
          .from(usersTable).where(inArray(usersTable.id, authorIds)),
        db.select({ userId: userTrustScoresTable.userId, uti: userTrustScoresTable.uti, visibilityMultiplier: userTrustScoresTable.visibilityMultiplier, tier: userTrustScoresTable.tier, creatorLevel: userTrustScoresTable.creatorLevel })
          .from(userTrustScoresTable).where(inArray(userTrustScoresTable.userId, authorIds)),
        db.select({ postId: boostRequestsTable.postId, reachMultiplier: boostRequestsTable.reachMultiplier, placementPriority: boostRequestsTable.placementPriority })
          .from(boostRequestsTable).where(and(
            inArray(boostRequestsTable.postId, postIds),
            eq(boostRequestsTable.status, "approved"),
            or(isNull(boostRequestsTable.boostStartsAt), lte(boostRequestsTable.boostStartsAt, now)),
            or(isNull(boostRequestsTable.boostEndsAt), gt(boostRequestsTable.boostEndsAt, now)),
          )),
      ])
    : [[], [], []];
  const authorMap = new Map((authors as any[]).map((a) => [a.id, a]));
  const trustMap = new Map((trustScores as any[]).map((t) => [t.userId, t]));
  const boostMap = new Map((activeBoosts as any[]).map((b) => [b.postId, b]));
  const posts = searchRows
    .map((p: any) => {
      const author = authorMap.get(Number(p.authorId));
      const trust = trustMap.get(Number(p.authorId));
      return {
        ...p,
        author: author ? {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
        } : {
          id: Number(p.authorId),
          username: "unknown",
          displayName: "Unknown user",
          avatarUrl: null,
        },
        authorIsOfficial: author?.isOfficialAccount ?? false,
        authorIsSuperUser: author?.role === "super_admin",
        authorTrustTier: trust?.tier,
        authorCreatorLevel: trust?.creatorLevel ?? null,
        score: calculateRankingScore({
          relevanceScore: Number(p.score ?? 0),
          ageHours: (now.getTime() - new Date(p.createdAt).getTime()) / 3_600_000,
          authorTrustScore: trust?.uti,
          visibilityMultiplier: trust?.visibilityMultiplier,
          authorReachMultiplier: author?.reachMultiplier,
          author: { isOfficialAccount: author?.isOfficialAccount, role: author?.role, tier: trust?.tier, creatorLevel: trust?.creatorLevel },
          post: p,
          isOfficialPost: p.isOfficialPost,
          activeBoost: boostMap.get(Number(p.id)),
        }),
      };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);

  return { posts, users, topics };
}
