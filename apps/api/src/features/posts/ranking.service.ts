import { createHash } from "node:crypto";

export const HIGH_TRUST_AUTHOR_MULTIPLIER = 4;
export const OFFICIAL_POST_MULTIPLIER = 4;
export const BOOST_PLACEMENT_WEIGHT = 10;

export interface FeedCacheKeyInput {
  viewerId: number | null;
  type: string;
  page: number;
  limit: number;
  mutedIds: number[];
  blockedIds: number[];
  since: string | null;
}

export function buildFeedCacheKey(input: FeedCacheKeyInput): string {
  const stableIds = (ids: number[]) => createHash("sha256")
    .update([...ids].sort((a, b) => a - b).join(","))
    .digest("hex")
    .slice(0, 24);
  return [
    "feed",
    input.viewerId ?? "anon",
    input.type,
    input.page,
    input.limit,
    `muted:${stableIds(input.mutedIds)}`,
    `blocked:${stableIds(input.blockedIds)}`,
    `since:${input.since ?? "all"}`,
  ].join(":");
}

export function selectRankedPage<T>(items: T[], page: number, limit: number): T[] {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const offset = (safePage - 1) * safeLimit;
  return items.slice(offset, offset + safeLimit);
}

export function getFeedCandidateWindow(type: string, page: number, limit: number): { limit: number; offset: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  return type === "chronological"
    ? { limit: safeLimit, offset: (safePage - 1) * safeLimit }
    : { limit: Math.min(2_000, Math.max(safeLimit * 10, 200, safePage * safeLimit)), offset: 0 };
}

export function calculateMeaningfulEngagementScore(input: {
  likes: number;
  distinctCommentAuthors: number;
  substantiveCommentAuthors: number;
  shares: number;
  reposts: number;
  saves: number;
}): number {
  const count = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
  return count(input.likes) * 1.5
    + count(input.distinctCommentAuthors) * 2
    + count(input.substantiveCommentAuthors) * 3
    + count(input.shares) * 2
    + count(input.reposts) * 2
    + count(input.saves) * 4;
}

const HIGH_TRUST_CREATOR_LEVELS = new Set(["established", "featured", "luminary"]);

export interface AuthorRankingSignals {
  isOfficialAccount?: boolean | null;
  role?: string | null;
  tier?: string | null;
  creatorLevel?: string | null;
}

export interface RankingScoreInput {
  ageHours?: number;
  engagementScore?: number;
  relevanceScore?: number;
  authorTrustScore?: number;
  visibilityMultiplier?: number;
  authorReachMultiplier?: number;
  author: AuthorRankingSignals;
  post: { content?: string | null; title?: string | null; excerpt?: string | null; imageUrl?: string | null };
  isOfficialPost?: boolean | null;
  postQualityMultiplier?: number;
  activeBoost?: { reachMultiplier?: number | null; placementPriority?: number | null } | null;
}

export function isHighTrustAuthor(author: AuthorRankingSignals): boolean {
  return Boolean(author.isOfficialAccount) ||
    author.role === "super_admin" ||
    author.tier === "trusted" ||
    HIGH_TRUST_CREATOR_LEVELS.has(author.creatorLevel ?? "");
}

/** Permanent preference with a basic quality floor for empty or near-empty posts. */
export function getHighTrustAuthorMultiplier(
  author: AuthorRankingSignals,
  post: { content?: string | null; title?: string | null; excerpt?: string | null; imageUrl?: string | null },
): number {
  if (!isHighTrustAuthor(author)) return 1;
  const hasBasicQuality = Boolean(
    (post.content?.trim().length ?? 0) >= 20 ||
    post.title?.trim() ||
    post.excerpt?.trim() ||
    post.imageUrl,
  );
  return hasBasicQuality ? HIGH_TRUST_AUTHOR_MULTIPLIER : 1;
}

/**
 * Canonical feed formula:
 * score = ((relevance * recency * engagementQuality * authorTrust * postQuality)
 *          * permanentAuthorBias * officialPostBias * activeBoostReach)
 *          + (activeBoostPlacement * 10)
 *
 * Boost fields are only passed here after the caller confirms the boost is active.
 * A high-trust author receives a permanent 4x bias when the post has basic quality.
 */
export function calculateRankingScore(input: RankingScoreInput): number {
  const ageHours = Math.max(0, Number(input.ageHours ?? 0));
  const recency = Math.max(0.05, Math.exp(-ageHours / 72));
  const engagementQuality = 1 + Math.log1p(Math.max(0, Number(input.engagementScore ?? 0))) / 4;
  const relevance = Math.max(0.01, Number(input.relevanceScore ?? 1));
  const authorTrust = Math.min(1.5, Math.max(0.5, 0.75 + Number(input.authorTrustScore ?? 50) / 200));
  const visibility = Math.min(1.5, Math.max(0.5, Number(input.visibilityMultiplier ?? 1)));
  const authorReach = Math.min(3, Math.max(0.1, Number(input.authorReachMultiplier ?? 1)));
  const permanentAuthorBias = getHighTrustAuthorMultiplier(input.author, input.post);
  const officialPostBias = input.isOfficialPost ? OFFICIAL_POST_MULTIPLIER : 1;
  const postQuality = Math.max(0.1, Number(input.postQualityMultiplier ?? 1));
  const boostReach = Math.max(1, Number(input.activeBoost?.reachMultiplier ?? 1));
  const placementBonus = Math.max(0, Number(input.activeBoost?.placementPriority ?? 0)) * BOOST_PLACEMENT_WEIGHT;

  const organicScore = relevance * recency * engagementQuality * authorTrust * visibility * authorReach * postQuality;
  return organicScore * permanentAuthorBias * officialPostBias * boostReach + placementBonus;
}