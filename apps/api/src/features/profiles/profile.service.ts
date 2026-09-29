import { db } from "@workspace/db";
import {
  usersTable,
  followsTable,
  postsTable,
  likesTable,
  commentsTable,
  creatorProfilesTable,
  postSharesTable,
  repostsTable,
  savedPostsTable,
} from "@workspace/db/schema";
import { eq, and, lte, isNull, or, sql } from "drizzle-orm";
import { getCache, setCache, deleteCache } from "../../lib/cache";
import { visiblePostExpiryCondition } from "../posts/postExpiry";

export async function getUserWithCounts(userId: number, viewerId: number | null) {
  const cacheKey = `user:${userId}:viewer:${viewerId ?? "anon"}`;
  const cached = await getCache<object>(cacheKey);
  if (cached) return cached as Awaited<ReturnType<typeof _getUserWithCounts>>;
  const result = await _getUserWithCounts(userId, viewerId);
  if (result) await setCache(cacheKey, result, 300);
  return result;
}

export async function invalidateUserCache(userId: number) {
  const redis = (await import("../../lib/redis")).getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(`user:${userId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    /* ignore */
  }
}

function toPublicPostAuthor(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    isOfficialAccount: user.isOfficialAccount,
    role: user.role,
    hireMeEnabled: user.hireMeEnabled,
  };
}

async function _getUserWithCounts(userId: number, viewerId: number | null) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  const [followersResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, userId));
  const [followingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followerId, userId));
  const [postsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, userId), eq(postsTable.isPublished, true), visiblePostExpiryCondition()));

  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    const follow = await db
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, userId)));
    isFollowing = follow.length > 0;
  }

  const safeUser = { ...user };
  for (const field of [
    "passwordHash",
    "twoFactorSecret",
    "passwordResetTokenHash",
    "passwordResetExpires",
    "signupIpHash",
    "signupUserAgent",
    "lastKnownIPHash",
    "lastKnownCountry",
    "lastKnownTimezone",
  ] as const) {
    delete (safeUser as Partial<typeof user>)[field];
  }
  return {
    ...safeUser,
    followersCount: followersResult?.count ?? 0,
    followingCount: followingResult?.count ?? 0,
    postsCount: postsResult?.count ?? 0,
    isFollowing,
  };
}

export async function enrichPost(post: any, viewerId: number | null) {
  const [likesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likesTable)
    .where(eq(likesTable.postId, post.id));
  const [commentsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(commentsTable)
    .where(eq(commentsTable.postId, post.id));
  const [sharesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postSharesTable)
    .where(eq(postSharesTable.postId, post.id));
  const [repostsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(repostsTable)
    .where(eq(repostsTable.postId, post.id));

  let isLiked = false;
  let isReposted = false;
  let isSaved = false;
  if (viewerId) {
    const [like] = await db
      .select()
      .from(likesTable)
      .where(and(eq(likesTable.postId, post.id), eq(likesTable.userId, viewerId)));
    isLiked = !!like;

    const [repost] = await db
      .select()
      .from(repostsTable)
      .where(and(eq(repostsTable.postId, post.id), eq(repostsTable.userId, viewerId)));
    isReposted = !!repost;

    const [saved] = await db
      .select()
      .from(savedPostsTable)
      .where(and(eq(savedPostsTable.postId, post.id), eq(savedPostsTable.userId, viewerId)));
    isSaved = !!saved;
  }

  const authorWithCounts = toPublicPostAuthor(await getUserWithCounts(post.authorId, viewerId));

  let quotedPost: Record<string, unknown> | null = null;
  if (post.quotedPostId) {
    const [quoted] = await db
      .select({
        id: postsTable.id,
        authorId: postsTable.authorId,
        content: postsTable.content,
        excerpt: postsTable.excerpt,
        title: postsTable.title,
        imageUrl: postsTable.imageUrl,
      })
      .from(postsTable)
      .where(eq(postsTable.id, post.quotedPostId))
      .limit(1);
    if (quoted) {
      quotedPost = {
        ...quoted,
        author: toPublicPostAuthor(await getUserWithCounts(quoted.authorId, viewerId)),
      };
    }
  }

  // Edit history count (best-effort)
  let editedCount = 0;
  try {
    const { postVersionsTable } = await import("@workspace/db/schema");
    const [vRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postVersionsTable)
      .where(eq(postVersionsTable.postId, post.id));
    editedCount = vRow?.count ?? 0;
  } catch {
    /* non-fatal */
  }

  // Trust score (best-effort)
  type TrustTier = "high" | "medium" | "low";
  let trustScore: { cis: number; retention: number; tier: TrustTier } | null = null;
  try {
    const { postTrustScoresTable } = await import("@workspace/db/schema");
    const [tRow] = await db
      .select({
        cis: postTrustScoresTable.cisScore,
        retention: postTrustScoresTable.retentionScore,
      })
      .from(postTrustScoresTable)
      .where(eq(postTrustScoresTable.postId, post.id));
    if (tRow) {
      const cis = Number(tRow.cis ?? 0);
      const tier: TrustTier = cis >= 0.7 ? "high" : cis >= 0.4 ? "medium" : "low";
      trustScore = { cis, retention: Number(tRow.retention ?? 0), tier };
    }
  } catch {
    /* non-fatal */
  }

  // Boost status (best-effort)
  let isBoosted = false;
  let boostPlan: string | null = null;
  let boostEndsAt: Date | null = null;
  let boostReachMultiplier = 1;
  let boostPlacementPriority = 0;
  try {
    const { boostRequestsTable } = await import("@workspace/db/schema");
    const now = new Date();
    const [boost] = await db
      .select({
        id: boostRequestsTable.id,
        plan: boostRequestsTable.plan,
        boostEndsAt: boostRequestsTable.boostEndsAt,
        reachMultiplier: boostRequestsTable.reachMultiplier,
        placementPriority: boostRequestsTable.placementPriority,
      })
      .from(boostRequestsTable)
      .where(
        and(
          eq(boostRequestsTable.postId, post.id),
          eq(boostRequestsTable.status, "approved"),
          or(isNull(boostRequestsTable.boostStartsAt), lte(boostRequestsTable.boostStartsAt, now)),
          sql`${boostRequestsTable.boostEndsAt} > ${now}`,
        ),
      )
      .limit(1);
    isBoosted = !!boost;
    boostPlan = boost?.plan ?? null;
    boostEndsAt = boost?.boostEndsAt ?? null;
    boostReachMultiplier = Number(boost?.reachMultiplier ?? 1);
    boostPlacementPriority = Number(boost?.placementPriority ?? 0);
  } catch { /* non-fatal */ }

  // Trending status: 50+ views in last 24h (best-effort)
  let isTrending = false;
  try {
    const { postViewsTable } = await import("@workspace/db/schema");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [trendRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postViewsTable)
      .where(
        and(
          eq(postViewsTable.postId, post.id),
          sql`${postViewsTable.createdAt} > ${since}`,
          sql`${postViewsTable.viewerId} IS DISTINCT FROM ${post.authorId}`,
        ),
      );
    isTrending = (trendRow?.count ?? 0) >= 50;
  } catch { /* non-fatal */ }

  let authorCreatorLevel: string | null = null;
  try {
    const { userTrustScoresTable } = await import("@workspace/db/schema");
    const [trustRow] = await db
      .select({ creatorLevel: userTrustScoresTable.creatorLevel })
      .from(userTrustScoresTable)
      .where(eq(userTrustScoresTable.userId, post.authorId));
    authorCreatorLevel = trustRow?.creatorLevel ?? null;
  } catch { /* non-fatal */ }

  // Parse CTA buttons (stored as JSONB)
  let ctaButtons: Array<{ label: string; url: string; style: string }> | null = null;
  try {
    const raw = (post as { ctaButtons?: unknown }).ctaButtons;
    if (Array.isArray(raw)) ctaButtons = raw as unknown as typeof ctaButtons;
    else if (typeof raw === "string" && raw.length > 0) ctaButtons = JSON.parse(raw);
  } catch { /* non-fatal */ }

  return {
    ...post,
    tags: JSON.parse(post.tags || "[]"),
    author: authorWithCounts,
    quotedPost,
    authorIsOfficial: (authorWithCounts as any)?.isOfficialAccount ?? false,
    authorIsSuperUser: (authorWithCounts as any)?.role === "super_admin",
    authorCreatorLevel,
    authorHireEnabled: (authorWithCounts as any)?.hireMeEnabled ?? false,
    likesCount: likesResult?.count ?? 0,
    commentsCount: commentsResult?.count ?? 0,
    sharesCount: sharesResult?.count ?? 0,
    repostsCount: repostsResult?.count ?? 0,
    isLiked,
    isReposted,
    isSaved,
    isEdited:
      post.updatedAt instanceof Date && post.createdAt instanceof Date
        ? post.updatedAt.getTime() - post.createdAt.getTime() > 60_000
        : false,
    editedCount,
    trustScore,
    isBoosted,
    boostPlan,
    boostEndsAt,
    boostReachMultiplier,
    boostPlacementPriority,
    isTrending,
    isOfficialPost: (post as { isOfficialPost?: boolean | null }).isOfficialPost ?? false,
    postCategory: (post as { postCategory?: string | null }).postCategory ?? null,
    officialPostPriority: (post as { officialPostPriority?: number | null }).officialPostPriority ?? 0,
    ctaButtons,
    challengeHashtag: (post as { challengeHashtag?: string | null }).challengeHashtag ?? null,
    challengeEndsAt: (post as { challengeEndsAt?: Date | null }).challengeEndsAt ?? null,
    challengeRewardText: (post as { challengeRewardText?: string | null }).challengeRewardText ?? null,
    featuredCreatorId: (post as { featuredCreatorId?: number | null }).featuredCreatorId ?? null,
  };
}

export async function getCreatorProfile(userId: number) {
  const [profile] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.userId, userId));

  if (!profile) return null;

  return {
    ...profile,
    skills: JSON.parse(profile.skills || "[]") as string[],
    links: JSON.parse(profile.links || "[]") as { label: string; url: string }[],
  };
}

export async function upsertCreatorProfile(
  userId: number,
  data: { skills?: string[]; links?: { label: string; url: string }[]; isAvailableForHire?: boolean; availableFor?: string[] }
) {
  const existing = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.userId, userId));

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.skills !== undefined) updates.skills = JSON.stringify(data.skills);
  if (data.links !== undefined) updates.links = JSON.stringify(data.links);
  if (data.isAvailableForHire !== undefined) updates.isAvailableForHire = data.isAvailableForHire;
  if (data.availableFor !== undefined) updates.availableFor = JSON.stringify(data.availableFor);

  const parseProfile = (row: any) => ({
    ...row,
    skills: JSON.parse(row.skills || "[]"),
    links: JSON.parse(row.links || "[]"),
    availableFor: JSON.parse(row.availableFor || "[]"),
  });

  if (existing.length > 0) {
    const [updated] = await db
      .update(creatorProfilesTable)
      .set(updates)
      .where(eq(creatorProfilesTable.userId, userId))
      .returning();
    return parseProfile(updated);
  } else {
    const [created] = await db
      .insert(creatorProfilesTable)
      .values({
        userId,
        skills: JSON.stringify(data.skills || []),
        links: JSON.stringify(data.links || []),
        isAvailableForHire: data.isAvailableForHire ?? false,
        availableFor: JSON.stringify(data.availableFor || []),
      })
      .returning();
    return parseProfile(created);
  }
}
