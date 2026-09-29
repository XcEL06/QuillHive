import { db } from "@workspace/db";
import {
  postsTable,
  likesTable,
  commentsTable,
  followsTable,
  notificationsTable,
  topicsTable,
  postTopicsTable,
  safetyPreferencesTable,
  mutedUsersTable,
  usersTable,
  boostRequestsTable,
  userTrustScoresTable,
  postTrustScoresTable,
  topicFollowsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, sql, notInArray, gt, gte, lte, isNull, or, ne } from "drizzle-orm";
import { getUserWithCounts, enrichPost } from "../profiles/profile.service";
import { emitToUser } from "../../lib/socket";
import { sanitizeRichText, sanitizePlain } from "../../lib/sanitize";
import { notify } from "../notifications/notification.service";
import { calculateRankingScore } from "./ranking.service";
import { logger } from "../../lib/logger";
import { SPARK_LIFETIME_MS, visiblePostExpiryCondition } from "./postExpiry";

async function getBlockedUserIds(viewerId: number | null): Promise<number[]> {
  if (!viewerId) return [];
  const [pref] = await db.select().from(safetyPreferencesTable).where(eq(safetyPreferencesTable.userId, viewerId));
  if (!pref?.blockedUserIds) return [];
  try {
    const ids = JSON.parse(pref.blockedUserIds);
    return Array.isArray(ids) ? ids.filter((n: any) => Number.isInteger(n)) : [];
  } catch { return []; }
}

export async function getMutedUserIds(viewerId: number | null): Promise<number[]> {
  if (!viewerId) return [];
  const rows = await db
    .select({ mutedId: mutedUsersTable.mutedId })
    .from(mutedUsersTable)
    .where(eq(mutedUsersTable.muterId, viewerId));
  return rows.map((row) => row.mutedId);
}

export { enrichPost };

// Keep feed reads compatible with deployments that have the baseline posts
// schema while optional post metadata migrations are rolled out separately.
export const stablePostSelection = {
  id: postsTable.id,
  authorId: postsTable.authorId,
  title: postsTable.title,
  titleA: postsTable.titleA,
  titleB: postsTable.titleB,
  titleAClicks: postsTable.titleAClicks,
  titleBClicks: postsTable.titleBClicks,
  abSelectedTitle: postsTable.abSelectedTitle,
  abLockedAt: postsTable.abLockedAt,
  content: postsTable.content,
  excerpt: postsTable.excerpt,
  type: postsTable.type,
  imageUrl: postsTable.imageUrl,
  attachments: postsTable.attachments,
  tags: postsTable.tags,
  isPublished: postsTable.isPublished,
  scheduledAt: postsTable.scheduledAt,
  expiresAt: postsTable.expiresAt,
  isHighlight: postsTable.isHighlight,
  contentWarning: postsTable.contentWarning,
  contentTags: postsTable.contentTags,
  aiTextScore: postsTable.aiTextScore,
  fingerprint: postsTable.fingerprint,
  seriesId: postsTable.seriesId,
  seriesOrder: postsTable.seriesOrder,
  groupId: postsTable.groupId,
  isDeleted: postsTable.isDeleted,
  deletedAt: postsTable.deletedAt,
  createdAt: postsTable.createdAt,
  updatedAt: postsTable.updatedAt,
};

async function optionalQuery<T>(query: PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (err) {
    logger.warn({ err }, "Optional feed ranking query unavailable");
    return fallback;
  }
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

export function extractHashtags(content: string): string[] {
  const matches = content.match(/(^|\s)#([a-zA-Z0-9_-]{1,40})/g) ?? [];
  return [...new Set(matches.map(match => normalizeTag(match.replace(/^\s*#?/, ""))).filter(Boolean))];
}

function mergeTags(explicitTags: string[] | undefined, content: string): string[] {
  const explicit = (explicitTags ?? []).map(normalizeTag).filter(Boolean);
  return [...new Set([...explicit, ...extractHashtags(content)])].slice(0, 12);
}

export async function linkPostTopics(postId: number, tags: string[]) {
  for (const tag of tags) {
    const slug = normalizeTag(tag);
    if (!slug) continue;
    const name = slug.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    await db.insert(topicsTable).values({ name, slug, description: `Posts tagged #${slug}`, iconName: "hash" }).onConflictDoNothing();
    const [topic] = await db.select().from(topicsTable).where(eq(topicsTable.slug, slug)).limit(1);
    if (!topic) continue;
    await db.insert(postTopicsTable).values({ postId, topicId: topic.id }).onConflictDoNothing();
  }

  await Promise.all(tags.map(async tag => {
    const slug = normalizeTag(tag);
    if (!slug) return;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postTopicsTable)
      .where(sql`${postTopicsTable.topicId} = (SELECT id FROM ${topicsTable} WHERE slug = ${slug})`);
    await db.update(topicsTable).set({ postCount: count ?? 0 }).where(eq(topicsTable.slug, slug));
  }));
}

function getFeedReason(post: typeof postsTable.$inferSelect, followingIds: number[]): string {
  if (followingIds.includes(post.authorId)) return "following_creator";
  const ageMs = Date.now() - new Date(post.createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = ageHours / 24;

  try {
    const tags = JSON.parse(post.tags || "[]") as string[];
    if (tags.length > 0) {
      if (ageHours < 12) return `trending_in_topic_${tags[0]}`;
      if (ageHours < 48) return `popular_in_topic_${tags[0]}`;
    }
  } catch {}

  if (ageHours < 3) return "high_engagement";
  if (ageHours < 12) return "rising_fast";
  if (ageDays < 3) return "popular_this_week";
  if (ageDays < 7) return "readers_loved_this";
  return "similar_interests";
}

function getFeedReasonDetails(post: typeof postsTable.$inferSelect, followingIds: number[]): string | undefined {
  const raw = getFeedReason(post, followingIds);
  if (raw.startsWith("trending_in_topic_")) {
    const topic = raw.replace("trending_in_topic_", "");
    return `This post is gaining momentum in #${topic}`;
  }
  if (raw.startsWith("popular_in_topic_")) {
    const topic = raw.replace("popular_in_topic_", "");
    return `Popular among readers interested in #${topic}`;
  }
  return undefined;
}

function normalizeFeedReason(raw: string): string {
  if (raw.startsWith("trending_in_topic_")) return `trending_in_topic`;
  if (raw.startsWith("popular_in_topic_")) return `popular_in_topic`;
  return raw;
}

export async function listPosts(
  viewerId: number | null,
  options: { type?: string; feed?: string; page: number; limit: number }
) {
  const { type, feed, page, limit } = options;

  let followingIds: number[] = [];
  if (viewerId) {
    const following = await db
      .select({ userId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, viewerId));
    followingIds = following.map(f => f.userId);
  }

  const blockedIds = await getBlockedUserIds(viewerId);
  const mutedIds = await getMutedUserIds(viewerId);
  const hiddenAuthorIds = [...new Set([...blockedIds, ...mutedIds])];

  const conds = [
    eq(postsTable.isPublished, true),
    visiblePostExpiryCondition(),
  ];
  if (feed === "following" && viewerId) {
    const followingFiltered = followingIds.filter(id => !hiddenAuthorIds.includes(id));
    if (followingFiltered.length === 0) return { posts: [], total: 0, page, limit };
    conds.push(inArray(postsTable.authorId, followingFiltered));
  }
  if (type) conds.push(eq(postsTable.type, type));
  if (hiddenAuthorIds.length > 0) conds.push(notInArray(postsTable.authorId, hiddenAuthorIds));

  // Pull a wider candidate set for multi-signal re-ranking.
  const candidates = await db.select(stablePostSelection).from(postsTable).where(and(
    ...conds,
    eq(postsTable.isDeleted, false),
  ))
    .orderBy(desc(postsTable.createdAt)).limit(limit * 6).offset((page - 1) * limit);

  let ranked = candidates;
  if (candidates.length > 0) {
    const candidateIds = candidates.map((p) => p.id);
    const authorIds = [...new Set(candidates.map((p) => p.authorId))];
    const now = new Date();

    type FeedAuthorRow = {
      id: number;
      reachMultiplier: number | null;
      visibilityPenalty: number | null;
      isOfficialAccount: boolean | null;
      role: string | null;
    };
    type FeedAuthorTrustRow = {
      userId: number;
      uti: number | null;
      visibilityMultiplier: number | null;
      tier: string | null;
      creatorLevel: string | null;
    };
    type FeedPostTrustRow = {
      postId: number;
      retentionScore: number | null;
      saveRate: number | null;
      deepEngagementRate: number | null;
      cisScore: number | null;
    };
    type FeedBoostRow = {
      postId: number;
      reachMultiplier: number | null;
      placementPriority: number | null;
    };
    type FeedTopicRow = { topicId: number };

    const [authorRows, authorTrustRows, postTrustRows, activeBoosts, viewerTopics] = await Promise.all([
      optionalQuery(
        db.select({ id: usersTable.id, reachMultiplier: usersTable.reachMultiplier, visibilityPenalty: usersTable.visibilityPenalty, isOfficialAccount: usersTable.isOfficialAccount, role: usersTable.role })
          .from(usersTable).where(inArray(usersTable.id, authorIds)),
        [] as FeedAuthorRow[],
      ),
      optionalQuery(
        db.select({ userId: userTrustScoresTable.userId, uti: userTrustScoresTable.uti, visibilityMultiplier: userTrustScoresTable.visibilityMultiplier, tier: userTrustScoresTable.tier, creatorLevel: userTrustScoresTable.creatorLevel })
          .from(userTrustScoresTable).where(inArray(userTrustScoresTable.userId, authorIds)),
        [] as FeedAuthorTrustRow[],
      ),
      optionalQuery(
        db.select({ postId: postTrustScoresTable.postId, retentionScore: postTrustScoresTable.retentionScore, saveRate: postTrustScoresTable.saveRate, deepEngagementRate: postTrustScoresTable.deepEngagementRate, cisScore: postTrustScoresTable.cisScore })
          .from(postTrustScoresTable).where(inArray(postTrustScoresTable.postId, candidateIds)),
        [] as FeedPostTrustRow[],
      ),
      optionalQuery(
        db.select({ postId: boostRequestsTable.postId, reachMultiplier: boostRequestsTable.reachMultiplier, placementPriority: boostRequestsTable.placementPriority })
          .from(boostRequestsTable).where(and(
            inArray(boostRequestsTable.postId, candidateIds),
            eq(boostRequestsTable.status, "approved"),
            or(isNull(boostRequestsTable.boostStartsAt), lte(boostRequestsTable.boostStartsAt, now)),
            gt(boostRequestsTable.boostEndsAt, now),
          )),
        [] as FeedBoostRow[],
      ),
      viewerId
        ? optionalQuery(
            db.select({ topicId: topicFollowsTable.topicId }).from(topicFollowsTable).where(eq(topicFollowsTable.userId, viewerId)),
            [] as FeedTopicRow[],
          )
        : Promise.resolve([] as FeedTopicRow[]),
    ]);

    let postTopicLinks: Array<{ postId: number; topicId: number }> = [];
    try {
      postTopicLinks = candidateIds.length > 0
        ? await db.select({ postId: postTopicsTable.postId, topicId: postTopicsTable.topicId })
            .from(postTopicsTable).where(inArray(postTopicsTable.postId, candidateIds))
        : [];
    } catch (err) {
      logger.warn({ err }, "Optional post topic signals unavailable; continuing without topic affinity");
    }

    const boostByPost = new Map(activeBoosts.map((b) => [b.postId, {
      reachMultiplier: Math.max(1, Number(b.reachMultiplier ?? 1)),
      placementPriority: Number(b.placementPriority ?? 0),
    }]));
    const authorById = new Map(authorRows.map((a) => [a.id as number, a]));
    const reachByAuthor = new Map<number, number>(authorRows.map((a) => [a.id as number, Number(a.reachMultiplier ?? 1)]));
    const penaltyByAuthor = new Map<number, number>(authorRows.map((a) => [a.id as number, Number(a.visibilityPenalty ?? 0)]));
    const trustByAuthor = new Map<number, { uti: number; visibilityMultiplier: number; tier: string | null; creatorLevel: string | null }>(
      authorTrustRows.map((t) => [t.userId as number, { uti: Number(t.uti ?? 50), visibilityMultiplier: Number(t.visibilityMultiplier ?? 1), tier: t.tier, creatorLevel: t.creatorLevel }])
    );
    type PostTrustEntry = { postId: number; retentionScore: number | null; saveRate: number | null; deepEngagementRate: number | null; cisScore: number | null };
    const trustByPost = new Map<number, PostTrustEntry>(
      postTrustRows.map((t) => [t.postId as number, {
        postId: t.postId as number,
        retentionScore: t.retentionScore as number | null,
        saveRate: t.saveRate as number | null,
        deepEngagementRate: t.deepEngagementRate as number | null,
        cisScore: t.cisScore as number | null,
      }])
    );
    const viewerTopicSet = new Set(viewerTopics.map((t) => t.topicId));
    const topicsByPost = new Map<number, Set<number>>();
    for (const link of postTopicLinks) {
      const s = topicsByPost.get(link.postId) ?? new Set<number>();
      s.add(link.topicId);
      topicsByPost.set(link.postId, s);
    }

    const score = (p: typeof postsTable.$inferSelect): number => {
      const ageHours = (now.getTime() - new Date(p.createdAt).getTime()) / 3_600_000;
      const at = trustByAuthor.get(p.authorId);
      const author = authorById.get(p.authorId);
      const reachMult = Number(reachByAuthor.get(p.authorId) ?? 1);
      // Post quality signals from trust engine
      const pt = trustByPost.get(p.id);
      const retentionBoost = 1 + Math.min(Number(pt?.retentionScore ?? 0) / 100, 1) * 0.3;
      const saveBoost = 1 + Math.min(Number(pt?.saveRate ?? 0), 1) * 0.25;
      const deepEngagementBoost = 1 + Math.min(Number(pt?.deepEngagementRate ?? 0), 1) * 0.2;
      const cisBoost = 1 + Math.min(Number(pt?.cisScore ?? 0) / 100, 1) * 0.15;
      // Topic affinity: how many of viewer's followed topics match this post's topics
      const postTopics = topicsByPost.get(p.id) ?? new Set<number>();
      const topicOverlap = postTopics.size > 0
        ? [...postTopics].filter((tid) => viewerTopicSet.has(tid)).length / postTopics.size
        : 0;
      const topicAffinityBoost = 1 + topicOverlap * 0.5;
      // Following creator bonus
      const followingBonus = followingIds.includes(p.authorId) ? 1.3 : 1.0;
      // Diversity: penalise posts from same author to avoid flooding
      // Official post soft boost (20-30% range based on priority)
      const officialBoost = (p as { isOfficialPost?: boolean | null }).isOfficialPost
        ? 1.2 + Math.min(((p as { officialPostPriority?: number | null }).officialPostPriority ?? 0) / 10, 0.1)
        : 1.0;
      const activeBoost = boostByPost.get(p.id);
      return calculateRankingScore({
        ageHours,
        engagementScore: 0,
        relevanceScore: followingBonus * topicAffinityBoost,
        authorTrustScore: at?.uti,
        visibilityMultiplier: at?.visibilityMultiplier,
        authorReachMultiplier: reachMult,
        author: {
          isOfficialAccount: author?.isOfficialAccount,
          role: author?.role,
          tier: at?.tier,
          creatorLevel: at?.creatorLevel,
        },
        post: p,
        isOfficialPost: (p as { isOfficialPost?: boolean | null }).isOfficialPost,
        postQualityMultiplier: retentionBoost * saveBoost * deepEngagementBoost * cisBoost * officialBoost,
        activeBoost,
      });
    };

    // Sort by composite score
    const scored = candidates.map((p) => ({ p, s: score(p as typeof postsTable.$inferSelect) }));
    scored.sort((a, b) => b.s - a.s);

    // Diversity pass:
    //   - Same-author: max 2 posts in the main slice
    //   - Official posts: max 1 per 15 items (no spam)
    //   - Boosted posts: hard cap at 15% of the requested feed limit
    const BOOST_CAP = Math.max(1, Math.floor(limit * 0.15));
    const authorCountInSlice = new Map<number, number>();
    const diversified: typeof candidates = [];
    const overflow: typeof candidates = [];
    let officialCountInSlice = 0;
    let boostedCountInSlice = 0;
    let totalInSlice = 0;
    for (const { p } of scored) {
      const isOfficial = !!(p as { isOfficialPost?: boolean | null }).isOfficialPost;
      const isBoosted = boostByPost.has(p.id);
      const n = authorCountInSlice.get(p.authorId) ?? 0;
      // Boosted posts: max 15% of feed
      if (isBoosted && boostedCountInSlice >= BOOST_CAP) {
        overflow.push(p);
        continue;
      }
      // Official posts: max 1 per 15 items in the main slice
      if (isOfficial) {
        const allowedOfficialSlots = Math.floor((totalInSlice + 1) / 15);
        if (officialCountInSlice >= allowedOfficialSlots + 1) {
          overflow.push(p);
          continue;
        }
        diversified.push(p);
        officialCountInSlice++;
        if (isBoosted) boostedCountInSlice++;
        totalInSlice++;
        authorCountInSlice.set(p.authorId, n + 1);
      } else if (n < 2) {
        diversified.push(p);
        if (isBoosted) boostedCountInSlice++;
        authorCountInSlice.set(p.authorId, n + 1);
        totalInSlice++;
      } else {
        overflow.push(p);
      }
    }
    ranked = [...diversified, ...overflow];
  }
  const sliced = ranked.slice(0, limit);

  const enriched = await Promise.all(sliced.map(async p => {
    const rawReason = getFeedReason(p as typeof postsTable.$inferSelect, followingIds);
    const reasonDetails = getFeedReasonDetails(p as typeof postsTable.$inferSelect, followingIds);
    return {
      ...(await enrichPost(p as typeof postsTable.$inferSelect, viewerId)),
      reason: normalizeFeedReason(rawReason),
      ...(reasonDetails ? { reasonDetails } : {}),
    };
  }));
  return { posts: enriched, total: enriched.length, page, limit };
}

export interface PostAttachment {
  url: string;
  mimeType: string;
  filename?: string;
  sizeBytes?: number;
}

function sanitizeAttachments(input: unknown): PostAttachment[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      url: typeof a.url === "string" ? a.url.slice(0, 500) : "",
      mimeType: typeof a.mimeType === "string" ? a.mimeType.slice(0, 180) : "application/octet-stream",
      filename: typeof a.filename === "string" ? a.filename.slice(0, 200) : undefined,
      sizeBytes: typeof a.sizeBytes === "number" ? a.sizeBytes : undefined,
    }))
    .filter((a) => a.url.length > 0)
    .slice(0, 20);
}

export async function createPost(
  authorId: number,
  data: {
    title?: string;
    titleA?: string;
    titleB?: string;
    content: string;
    excerpt?: string;
    type: string;
    imageUrl?: string;
    attachments?: PostAttachment[];
    tags?: string[];
    isPublished?: boolean;
    groupId?: number;
    seriesId?: number;
    quotedPostId?: number;
    scheduledAt?: string;
    contentWarning?: string | null;
    contentTags?: string[];
    isOfficialPost?: boolean;
  }
) {
  const isSpark = data.type === "spark";
  const isPublished = data.isPublished ?? true;
  const rawContent = isSpark
    ? sanitizePlain(data.content).slice(0, 280)
    : data.content;
  const cleanContent = isSpark ? rawContent : sanitizeRichText(rawContent);
  const tags = mergeTags(data.tags, cleanContent);
  const cwTags = Array.isArray(data.contentTags)
    ? data.contentTags.filter((t) => typeof t === "string").slice(0, 12)
    : [];
  const { aiTextScore } = await import("../safety/aiText.service");
  const score = data.isOfficialPost ? 0 : aiTextScore(cleanContent);

  let quotedPost: { id: number; authorId: number } | undefined;
  if (data.quotedPostId) {
    const [quotedPostRow] = await db
      .select({ id: postsTable.id, authorId: postsTable.authorId })
      .from(postsTable)
      .where(and(eq(postsTable.id, data.quotedPostId), eq(postsTable.isDeleted, false)))
      .limit(1);
    quotedPost = quotedPostRow;
    if (!quotedPost) throw new Error("Quoted post not found");
  }

  // Originality check (only for published long-form posts, never for official posts).
  // Throws a typed error caught by the controller and surfaced as 409.
  if (!data.isOfficialPost && (data.isPublished ?? true) && !isSpark && cleanContent.length >= 200) {
    const { findSimilarPosts } = await import("../safety/originality.service");
    const matches = await findSimilarPosts(cleanContent, null, 0.85, 5);
    if (matches.length > 0) {
      const err = new Error(
        "This post is very similar to existing content. Try rewriting for originality."
      ) as Error & {
        code: string;
        status: number;
        similarPostIds: number[];
        topSimilarity: number;
      };
      err.code = "DUPLICATE_CONTENT";
      err.status = 409;
      err.similarPostIds = matches.map((m) => m.postId);
      err.topSimilarity = matches[0]?.similarity ?? 0;
      throw err;
    }
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      authorId,
      title: data.title ? sanitizePlain(data.title).slice(0, 180) : null,
      titleA: data.titleA ? sanitizePlain(data.titleA).slice(0, 180) : null,
      titleB: data.titleB ? sanitizePlain(data.titleB).slice(0, 180) : null,
      content: cleanContent,
      excerpt: data.excerpt ? sanitizePlain(data.excerpt).slice(0, 500) : null,
      type: data.type,
      imageUrl: data.imageUrl || null,
      attachments: JSON.stringify(sanitizeAttachments(data.attachments)),
      tags: JSON.stringify(tags),
      isPublished,
      groupId: data.groupId || null,
      seriesId: data.seriesId || null,
      quotedPostId: quotedPost?.id ?? null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      // Sparks expire after one day; legacy Sparks are bounded by createdAt in feed filters.
      isHighlight: isSpark,
      expiresAt: isSpark && isPublished ? new Date(Date.now() + SPARK_LIFETIME_MS) : null,
      contentWarning: data.contentWarning ? sanitizePlain(data.contentWarning).slice(0, 80) : null,
      contentTags: JSON.stringify(cwTags),
      aiTextScore: score,
    })
    .returning();
  await linkPostTopics(post.id, tags);
  // Index fingerprint best-effort
  if (post.isPublished) {
    const { indexPostFingerprint } = await import("../safety/originality.service");
    indexPostFingerprint(post.id, cleanContent).catch(() => {});
    const { checkPostMilestones } = await import("../achievements/achievement.service");
    void checkPostMilestones(authorId);
    const { recordWrite } = await import("../discovery/writingStreaks.service");
    void recordWrite(authorId, post.id);
  }
  // Non-blocking rule engine evaluation
  import("../safety/ruleEngine.service")
    .then((m) => m.evaluateRules(authorId, "post_rate"))
    .catch(() => {});
  // Process @mentions: insert into mentions table + notify
  import("../mentions/mentions.routes")
    .then((m) => m.processMentions(post.id, cleanContent, authorId))
    .catch(() => {});

  if (quotedPost && quotedPost.authorId !== authorId) {
    const actor = await getUserWithCounts(authorId, null);
    void notify({
      userId: quotedPost.authorId,
      actorId: authorId,
      type: "quote",
      title: `${actor?.displayName || actor?.username || "Someone"} quoted your post`,
      message: `${actor?.displayName || actor?.username || "Someone"} quoted your post`,
      postId: post.id,
      url: `/post/${post.id}`,
    });
  }

  // Fire-and-forget: extract hashtags from title + content and upsert into topicsTable
  (async () => {
    try {
      const { sql: _sql } = await import("drizzle-orm");
      const titleText = data.title ?? "";
      const combined = `${titleText} ${cleanContent}`;
      const hashtagRegex = /#([a-zA-Z0-9_]{2,50})/g;
      const found = new Set<string>();
      for (const m of combined.matchAll(hashtagRegex)) {
        found.add(m[1].toLowerCase());
      }
      for (const tag of found) {
        const slug = tag.replace(/[^a-z0-9_]/g, "");
        if (slug.length < 2) continue;
        await db
          .insert(topicsTable)
          .values({ name: `#${slug}`, slug, postCount: 1 })
          .onConflictDoUpdate({ target: topicsTable.slug, set: { postCount: _sql`${topicsTable.postCount} + 1` } });
      }
    } catch { /* never block post creation */ }
  })();

  return enrichPost(post, authorId);
}

export async function getPostById(id: number, viewerId: number | null) {
  const [post] = await db.select().from(postsTable).where(and(
    eq(postsTable.id, id),
    visiblePostExpiryCondition(),
  ));
  if (!post) return null;
  return enrichPost(post, viewerId);
}

export async function updatePost(id: number, authorId: number, data: Record<string, unknown>) {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) return null;
  if (post.authorId !== authorId) throw new Error("Forbidden");

  // Snapshot the previous version BEFORE applying changes (best-effort).
  try {
    const { postVersionsTable } = await import("@workspace/db/schema");
    await db.insert(postVersionsTable).values({
      postId: post.id,
      editorId: authorId,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      changeReason: typeof data.changeReason === "string" ? data.changeReason : null,
    });
  } catch {
    /* non-fatal: versioning shouldn't block edits */
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title ? sanitizePlain(String(data.title)).slice(0, 180) : null;
  if (data.content !== undefined) updates.content = sanitizeRichText(String(data.content));
  if (data.excerpt !== undefined) updates.excerpt = data.excerpt ? sanitizePlain(String(data.excerpt)).slice(0, 500) : null;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
  if (data.attachments !== undefined) updates.attachments = JSON.stringify(sanitizeAttachments(data.attachments));
  if (data.tags !== undefined || data.content !== undefined) {
    const nextContent = typeof data.content === "string" ? data.content : post.content;
    const nextTags = mergeTags(Array.isArray(data.tags) ? data.tags as string[] : JSON.parse(post.tags || "[]"), nextContent);
    updates.tags = JSON.stringify(nextTags);
  }
  if (data.contentWarning !== undefined) {
    updates.contentWarning = data.contentWarning ? sanitizePlain(String(data.contentWarning)).slice(0, 80) : null;
  }
  if (data.contentTags !== undefined && Array.isArray(data.contentTags)) {
    updates.contentTags = JSON.stringify((data.contentTags as unknown[]).filter((t) => typeof t === "string").slice(0, 12));
  }
  if (data.content !== undefined) {
    const { aiTextScore } = await import("../safety/aiText.service");
    updates.aiTextScore = aiTextScore(String(updates.content ?? post.content));
  }
  if (data.isPublished !== undefined) updates.isPublished = data.isPublished;

  const [updated] = await db.update(postsTable).set(updates).where(eq(postsTable.id, id)).returning();
  if (updates.tags) {
    await db.delete(postTopicsTable).where(eq(postTopicsTable.postId, id));
    await linkPostTopics(id, JSON.parse(String(updates.tags)));
  }
  return enrichPost(updated, authorId);
}

export async function deletePost(id: number, authorId: number) {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) return false;
  if (post.authorId !== authorId) throw new Error("Forbidden");
  await db.delete(postsTable).where(eq(postsTable.id, id));
  return true;
}

export async function toggleLike(postId: number, userId: number) {
  const existing = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.postId, postId), eq(likesTable.userId, userId)));

  let liked: boolean;
  if (existing.length > 0) {
    await db.delete(likesTable).where(and(eq(likesTable.postId, postId), eq(likesTable.userId, userId)));
    liked = false;
  } else {
    const [newLike] = await db.insert(likesTable).values({ postId, userId })
      .onConflictDoNothing()
      .returning({ id: likesTable.id });
    liked = true;

    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    if (post && newLike) {
      const { checkLikeMilestones } = await import("../achievements/achievement.service");
      void checkLikeMilestones(postId, post.authorId);
    }
    if (post && newLike && post.authorId !== userId) {
      const liker = await getUserWithCounts(userId, null);
      const [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: post.authorId,
          type: "like",
          actorId: userId,
          postId,
          message: `${liker?.displayName} liked your post`,
          isRead: false,
        })
        .returning();
      emitToUser(post.authorId, "notification:new", { ...notif, actor: liker });
    }

    // ── Trending notification ─────────────────────────────────────────────
    if (post && newLike && post.authorId !== userId) {
      const TRENDING_THRESHOLDS = [50, 100, 250, 500];
      const window24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [recentLikesResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(likesTable)
        .where(and(eq(likesTable.postId, postId), gte(likesTable.createdAt, window24h)));

      const recentCount = recentLikesResult?.count ?? 0;
      const crossedThreshold = TRENDING_THRESHOLDS.find(t => recentCount === t);

      if (crossedThreshold) {
        // Only fire once per threshold - check for existing trending_notif on this post in the last 24h
        const existingTrending = await db
          .select({ id: notificationsTable.id })
          .from(notificationsTable)
          .where(
            and(
              eq(notificationsTable.userId, post.authorId),
              eq(notificationsTable.type, "trending_notif"),
              eq(notificationsTable.postId, postId),
              gte(notificationsTable.createdAt, window24h),
              sql`${notificationsTable.message} like ${`%${crossedThreshold} likes%`}`
            )
          )
          .limit(1);

        if (existingTrending.length === 0) {
          const [trendNotif] = await db
            .insert(notificationsTable)
            .values({
              userId: post.authorId,
              actorId: post.authorId,
              type: "trending_notif",
              postId,
              message: `🔥 Your post is trending - ${crossedThreshold} likes in the last 24 hours!`,
              isRead: false,
            })
            .returning();
          emitToUser(post.authorId, "notification:new", trendNotif);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────
  }

  const [likesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likesTable)
    .where(eq(likesTable.postId, postId));

  return { liked, likesCount: likesResult?.count ?? 0 };
}

export async function getComments(postId: number, viewerId: number | null) {
  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.postId, postId))
    .orderBy(desc(commentsTable.createdAt));

  const enriched = await Promise.all(
    comments.map(async c => {
      const author = await getUserWithCounts(c.authorId, viewerId);
      return { ...c, author };
    })
  );

  // Sort by author trust score (trusted contributors first), then chronological
  return enriched.sort((a, b) => {
    const tierOrder: Record<string, number> = { trusted: 3, normal: 2, restricted: 1, unknown: 0 };
    const aTier = tierOrder[(a.author as any)?.trustTier ?? "normal"] ?? 2;
    const bTier = tierOrder[(b.author as any)?.trustTier ?? "normal"] ?? 2;
    if (bTier !== aTier) return bTier - aTier;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function createComment(postId: number, authorId: number, content: string) {
  const [comment] = await db
    .insert(commentsTable)
    .values({ postId, authorId, content })
    .returning();

  const author = await getUserWithCounts(authorId, null);

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (post && post.authorId !== authorId) {
    const [notif] = await db
      .insert(notificationsTable)
      .values({
        userId: post.authorId,
        type: "comment",
        actorId: authorId,
        postId,
        message: `${author?.displayName} commented on your post`,
        isRead: false,
      })
      .returning();
    emitToUser(post.authorId, "notification:new", { ...notif, actor: author });
  }

  return { ...comment, author };
}
