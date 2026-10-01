import { db } from "@workspace/db";
import {
  postsTable,
  commentsTable,
  likesTable,
  savedPostsTable,
  postSharesTable,
  appreciationsTable,
  userTrustScoresTable,
  behaviorEventsTable,
  notificationsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";

/**
 * Trust Score (UTI) is earned evidence, not a measure of account age.
 * A user with no posts or activity has no track record, so every component
 * starts at zero. Creator Level is the human-facing interpretation of UTI.
 */
const DEFAULT_SCORES = {
  cvs: 0,
  bcs: 0,
  cts: 0,
  avgCis: 0,
  uti: 0,
  tier: "restricted",
  creatorLevel: "new_voice",
  visibilityMultiplier: 0.3,
};

function clamp(value: unknown, min = 0, max = 100, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function safeRatio(numerator: unknown, denominator: unknown, fallback = 0): number {
  const top = Math.max(0, Number(numerator) || 0);
  const bottom = Math.max(1, Number(denominator) || 0);
  const value = top / bottom;
  return Number.isFinite(value) && !Number.isNaN(value) ? value : fallback;
}

function safeCount(value: unknown): number {
  return Math.max(0, Number(value) || 0);
}

function legacyTierFromLevel(level: string): string {
  if (level === "luminary" || level === "featured") return "trusted";
  if (level === "established") return "normal";
  if (level === "rising") return "limited";
  return "restricted";
}

function visibilityForTier(uti: number, tier: string): number {
  if (tier === "trusted") return Math.min(1.2, Math.max(1.05, uti / 100 + 0.2));
  if (tier === "restricted") return 0.3;
  if (tier === "limited") return Math.max(0.55, uti / 100);
  return Math.max(0.85, Math.min(1, uti / 100));
}

async function postIdsForUser(userId: number): Promise<number[]> {
  const posts = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, userId), eq(postsTable.isPublished, true)));
  return posts.map(p => p.id);
}

function postIdsSql(postIds: number[]) {
  return sql`ANY(ARRAY[${sql.join(postIds.map(id => sql`${id}`), sql`, `)}])`;
}

export async function calculateCVS(userId: number): Promise<number> {
  try {
    const postIds = await postIdsForUser(userId);
    if (postIds.length === 0) return 0;

    const [savedCount] = await db.select({ c: count() }).from(savedPostsTable).where(sql`${savedPostsTable.postId} = ${postIdsSql(postIds)}`);
    const [likeCount] = await db.select({ c: count() }).from(likesTable).where(sql`${likesTable.postId} = ${postIdsSql(postIds)}`);
    const [commentCount] = await db.select({ c: count() }).from(commentsTable).where(sql`${commentsTable.postId} = ${postIdsSql(postIds)}`);
    const [deepCommentCount] = await db
      .select({ c: count() })
      .from(commentsTable)
      .where(and(sql`${commentsTable.postId} = ${postIdsSql(postIds)}`, sql`LENGTH(${commentsTable.content}) > 50`));

    const likes = safeCount(likeCount?.c);
    const comments = safeCount(commentCount?.c);
    const saves = safeCount(savedCount?.c);
    const deepComments = safeCount(deepCommentCount?.c);
    const impressions = Math.max(1, likes + comments + saves);

    const saveRate = Math.min(1, safeRatio(saves, impressions));
    const depthRate = comments > 0 ? Math.min(1, safeRatio(deepComments, comments)) : 0;
    const retention = impressions > 1 ? 0.5 : 0;
    const discussionRate = Math.min(1, safeRatio(comments, impressions));

    return clamp((retention * 0.35 + saveRate * 0.25 + depthRate * 0.2 + discussionRate * 0.2) * 100);
  } catch {
    return 0;
  }
}

export async function calculateBCS(userId: number): Promise<number> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentPostsRow] = await db
      .select({ c: count() })
      .from(postsTable)
      .where(and(eq(postsTable.authorId, userId), gte(postsTable.createdAt, oneHourAgo)));

    const postsLastHour = safeCount(recentPostsRow?.c);
    const frequencyPenalty = postsLastHour > 5 ? Math.pow(postsLastHour - 5, 2) * 2 : 0;

    const dayPosts = await db
      .select({ title: postsTable.title, content: postsTable.content })
      .from(postsTable)
      .where(and(eq(postsTable.authorId, userId), gte(postsTable.createdAt, oneDayAgo)));

    const [allPosts] = await db.select({ c: count() }).from(postsTable).where(eq(postsTable.authorId, userId));
    if (safeCount(allPosts?.c) === 0) return 0;

    const texts = dayPosts.map(p => (p.title || p.content || "").toLowerCase().replace(/\s+/g, " ").trim()).filter(Boolean);
    let duplicateCount = 0;
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const shorter = Math.min(texts[i].length, texts[j].length);
        const longer = Math.max(texts[i].length, texts[j].length);
        if (shorter === 0 || longer === 0) continue;
        const prefixMatch = texts[i].slice(0, shorter) === texts[j].slice(0, shorter);
        if (prefixMatch && shorter / Math.max(1, longer) > 0.8) duplicateCount++;
      }
    }

    const repeatPenalty = safeRatio(duplicateCount, Math.max(1, texts.length)) * 100;
    return clamp(100 - (frequencyPenalty + repeatPenalty));
  } catch {
    return 0;
  }
}

export async function calculateCTS(userId: number): Promise<number> {
  try {
    const [appreciationsRow] = await db
      .select({ c: count() })
      .from(appreciationsTable)
      .where(sql`EXISTS (SELECT 1 FROM ${postsTable} WHERE ${postsTable.id} = ${appreciationsTable.postId} AND ${postsTable.authorId} = ${userId})`);

    const [totalReactionsRow] = await db
      .select({ c: count() })
      .from(likesTable)
      .where(sql`EXISTS (SELECT 1 FROM ${postsTable} WHERE ${postsTable.id} = ${likesTable.postId} AND ${postsTable.authorId} = ${userId})`);

    const appreciationRate = safeCount(totalReactionsRow?.c) > 0 ? clamp(safeRatio(appreciationsRow?.c, totalReactionsRow?.c), 0, 1) : 0;

    const posts = await db.select({ type: postsTable.type }).from(postsTable).where(eq(postsTable.authorId, userId));
    const uniqueCategories = new Set(posts.map(p => p.type).filter(Boolean));
    const categoryDiversity = posts.length > 0 ? Math.min(1, safeRatio(uniqueCategories.size, posts.length) * 2) : 0;
    const peerSignal = 0;

    return clamp((appreciationRate * 0.4 + categoryDiversity * 0.3 + peerSignal * 0.3) * 100);
  } catch {
    return 0;
  }
}

export async function calculateCIS(postId: number): Promise<number> {
  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    if (!post) return 0;

    const [commentCountRow] = await db.select({ c: count() }).from(commentsTable).where(eq(commentsTable.postId, postId));
    const [deepCommentRow] = await db.select({ c: count() }).from(commentsTable).where(and(eq(commentsTable.postId, postId), sql`LENGTH(${commentsTable.content}) > 50`));
    const [likeCountRow] = await db.select({ c: count() }).from(likesTable).where(eq(likesTable.postId, postId));
    const [shareCountRow] = await db.select({ c: count() }).from(postSharesTable).where(eq(postSharesTable.postId, postId));

    const comments = safeCount(commentCountRow?.c);
    const deepComments = safeCount(deepCommentRow?.c);
    const likes = safeCount(likeCountRow?.c);
    const shares = safeCount(shareCountRow?.c);
    const impressions = Math.max(1, likes + comments + shares);
    const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60));

    const engagementDepth = Math.min(1, safeRatio(comments * 2 + deepComments, impressions));
    const longevity = ageHours > 24 ? Math.min(1, safeRatio(likes + comments, impressions) * 0.8) : Math.min(1, safeRatio(likes + comments, impressions));
    const spread = Math.min(1, safeRatio(shares, impressions));
    const discussion = Math.min(1, safeRatio(comments, impressions));

    return clamp((engagementDepth * 0.25 + longevity * 0.2 + spread * 0.25 + discussion * 0.3) * 100);
  } catch {
    return 0;
  }
}

export async function calculateUTI(userId: number): Promise<{ uti: number; cvs: number; bcs: number; cts: number; avgCis: number; tier: string; creatorLevel: string; visibilityMultiplier: number }> {
  try {
    const [[cvs, bcs, cts], [account]] = await Promise.all([
      Promise.all([calculateCVS(userId), calculateBCS(userId), calculateCTS(userId)]),
      db.select({ role: usersTable.role, isOfficialAccount: usersTable.isOfficialAccount })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1),
    ]);
    const userPosts = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(and(eq(postsTable.authorId, userId), eq(postsTable.isPublished, true)))
      .limit(20);

    let avgCis = 0;
    if (userPosts.length > 0) {
      const cisScores = await Promise.all(userPosts.map(p => calculateCIS(p.id)));
      avgCis = clamp(safeRatio(cisScores.reduce((sum, score) => sum + clamp(score), 0), cisScores.length));
    }

    const isPlatformTrusted = account?.role === "super_admin" || account?.isOfficialAccount === true;
    const uti = isPlatformTrusted
      ? 100
      : clamp(cvs * 0.35 + bcs * 0.25 + cts * 0.2 + avgCis * 0.2);
    const creatorLevel = getCreatorLevel(uti);
    const tier = legacyTierFromLevel(creatorLevel);
    const visibilityMultiplier = visibilityForTier(uti, tier);

    return { uti, cvs: clamp(cvs), bcs: clamp(bcs), cts: clamp(cts), avgCis, tier, creatorLevel, visibilityMultiplier };
  } catch {
    return { ...DEFAULT_SCORES };
  }
}

export async function updateUserTrustScore(userId: number) {
  const scores = await calculateUTI(userId);
  const newLevel = getCreatorLevel(scores.uti);
  const existing = await db.select().from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, userId)).limit(1);

  let prevLevel: string | null = null;
  if (existing.length > 0) {
    prevLevel = existing[0].creatorLevel ?? null;
    const levelChanged = prevLevel !== newLevel;
    const [updated] = await db
      .update(userTrustScoresTable)
      .set({
        ...scores,
        creatorLevel: newLevel,
        ...(levelChanged ? { levelUpdatedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userTrustScoresTable.userId, userId))
      .returning();

    if (levelChanged && prevLevel && prevLevel !== "new_voice") {
      (async () => {
        try {
          const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId));
          const levelLabels: Record<string, string> = {
            rising: "Rising Voice",
            established: "Established Voice",
            featured: "Featured Voice",
            luminary: "Luminary",
          };
          const label = levelLabels[newLevel];
          if (label) {
            await db.insert(notificationsTable).values({
              userId,
              actorId: userId,
              type: "level_up",
              message: `You've reached ${label}! Your voice is finding its place in the hive.`,
              isRead: false,
            });
          }
        } catch { /* non-fatal */ }
      })();
    }

    // Proximity nudge - fire after level-up check so it doesn't fire on the same update
    void sendLevelProximityNudge(userId, newLevel, scores.uti);

    return updated;
  }

  const [created] = await db.insert(userTrustScoresTable).values({ userId, ...scores, creatorLevel: newLevel }).returning();
  return created;
}

export async function updateUserTrustScoreSafe(userId: number | null | undefined) {
  if (!userId || userId <= 0) return null;
  try {
    return await updateUserTrustScore(userId);
  } catch {
    return null;
  }
}

export async function recordBehaviorEvent(userId: number, eventType: string, severity = 1, details?: string) {
  try {
    await db.insert(behaviorEventsTable).values({
      userId,
      eventType,
      severity: Math.max(1, Math.min(10, Math.round(severity))),
      details: details ? details.slice(0, 1000) : null,
    });
    return updateUserTrustScoreSafe(userId);
  } catch {
    return null;
  }
}

export async function getUserTrustScore(userId: number) {
  const [[score], [account]] = await Promise.all([
    db.select().from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, userId)),
    db.select({ role: usersTable.role, isOfficialAccount: usersTable.isOfficialAccount })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1),
  ]);

  if (account?.role === "super_admin" || account?.isOfficialAccount === true) {
    const platformTrust = {
      uti: 100,
      tier: "trusted",
      creatorLevel: "luminary",
      visibilityMultiplier: 1.2,
    };
    return score ? { ...score, ...platformTrust } : { userId, ...DEFAULT_SCORES, ...platformTrust };
  }

  return score ?? null;
}

// UTI is the Trust Score shown as /100. Creator Level is its canonical label.
const LEVEL_THRESHOLDS: Array<{ level: string; min: number }> = [
  { level: "luminary",    min: 85 },
  { level: "featured",    min: 70 },
  { level: "established", min: 55 },
  { level: "rising",      min: 30 },
  { level: "new_voice",   min: 0  },
];

const LEVEL_NAMES: Record<string, string> = {
  new_voice:   "New Voice",
  rising:      "Rising Creator",
  established: "Established Creator",
  featured:    "Featured Creator",
  luminary:    "Luminary",
};

function getNextLevelEntry(currentLevel: string): { level: string; min: number } | null {
  const sorted = [...LEVEL_THRESHOLDS].sort((a, b) => a.min - b.min);
  const idx = sorted.findIndex(t => t.level === currentLevel);
  if (idx === -1 || idx === sorted.length - 1) return null;
  return sorted[idx + 1] ?? null;
}

export function getCreatorLevel(uti: number): string {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (uti >= min) return level;
  }
  return "new_voice";
}

async function sendLevelProximityNudge(userId: number, currentLevel: string, currentUti: number): Promise<void> {
  try {
    const next = getNextLevelEntry(currentLevel);
    if (!next) return;

    const currentMin = LEVEL_THRESHOLDS.find(t => t.level === currentLevel)?.min ?? 0;
    const pointsNeeded = next.min - currentUti;
    const totalGap = next.min - currentMin;
    if (totalGap <= 0 || pointsNeeded <= 0) return;

    const percentLeft = (pointsNeeded / totalGap) * 100;
    if (percentLeft > 15) return;

    const { getRedis } = await import("../../lib/redis");
    const redis = getRedis();
    const throttleKey = `level-nudge:${userId}:${next.level}`;
    const alreadySent = redis ? await redis.get(throttleKey) : null;
    if (alreadySent) return;

    const { notify } = await import("../notifications/notification.service");
    await notify({
      userId,
      type: "milestone",
      title: `You're close to ${LEVEL_NAMES[next.level] ?? next.level}`,
      message: `Just ${Math.ceil(pointsNeeded)} more trust points to reach ${LEVEL_NAMES[next.level] ?? next.level}. Keep sharing and connecting to get there.`,
      url: `/dashboard`,
    });
    if (redis) await redis.set(throttleKey, "1", { ex: 48 * 3600 });
  } catch { /* non-fatal */ }
}
