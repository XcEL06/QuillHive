import { describe, expect, it } from "vitest";
import {
  buildFeedCacheKey,
  calculateMeaningfulEngagementScore,
  calculateRankingScore,
  getFeedCandidateWindow,
  selectRankedPage,
} from "../features/posts/ranking.service";

const post = { content: "A sufficiently substantial post for ranking." };

describe("calculateRankingScore", () => {
  it("gives high-trust authors a permanent advantage", () => {
    const normal = calculateRankingScore({ author: {}, post, engagementScore: 20 });
    const official = calculateRankingScore({ author: { isOfficialAccount: true }, post, engagementScore: 20 });

    expect(official).toBeGreaterThanOrEqual(normal * 4);
  });

  it("applies active boost reach and placement, while an absent boost has no effect", () => {
    const baseline = calculateRankingScore({ author: {}, post, engagementScore: 20 });
    const boosted = calculateRankingScore({
      author: {},
      post,
      engagementScore: 20,
      activeBoost: { reachMultiplier: 3.5, placementPriority: 30 },
    });
    const expired = calculateRankingScore({ author: {}, post, engagementScore: 20, activeBoost: null });

    expect(boosted).toBeGreaterThan(baseline);
    expect(expired).toBe(baseline);
  });

  it("uses saves and distinct substantive interactions with diminishing returns", () => {
    const baseline = calculateMeaningfulEngagementScore({
      likes: 0,
      distinctCommentAuthors: 0,
      substantiveCommentAuthors: 0,
      shares: 0,
      reposts: 0,
      saves: 0,
    });
    const meaningful = calculateMeaningfulEngagementScore({
      likes: 5,
      distinctCommentAuthors: 2,
      substantiveCommentAuthors: 1,
      shares: 1,
      reposts: 1,
      saves: 2,
    });
    expect(meaningful).toBeGreaterThan(baseline);
    expect(calculateRankingScore({ author: {}, post, engagementScore: meaningful * 100 }))
      .toBeLessThan(calculateRankingScore({ author: {}, post, engagementScore: meaningful }) * 3);
  });

  it("separates cache keys by feed mode, viewer, and active visibility filters", () => {
    const base = {
      viewerId: 7,
      type: "algorithmic",
      page: 1,
      limit: 20,
      mutedIds: [8],
      blockedIds: [9],
      since: null,
    };
    const key = buildFeedCacheKey(base);
    expect(buildFeedCacheKey({ ...base, type: "chronological" })).not.toBe(key);
    expect(buildFeedCacheKey({ ...base, viewerId: 11 })).not.toBe(key);
    expect(buildFeedCacheKey({ ...base, blockedIds: [12] })).not.toBe(key);
    expect(buildFeedCacheKey({ ...base, mutedIds: [14] })).not.toBe(key);
    expect(buildFeedCacheKey({ ...base, since: "2026-10-15T00:00:00.000Z" })).not.toBe(key);
  });

  it("preserves chronological SQL pagination and ranked pagination windows", () => {
    expect(getFeedCandidateWindow("chronological", 2, 20)).toEqual({ limit: 20, offset: 20 });
    expect(getFeedCandidateWindow("algorithmic", 2, 20)).toEqual({ limit: 200, offset: 0 });
    expect(getFeedCandidateWindow("algorithmic", 11, 20)).toEqual({ limit: 220, offset: 0 });
    expect(getFeedCandidateWindow("algorithmic", 101, 20)).toEqual({ limit: 2_000, offset: 0 });
    const firstPage = selectRankedPage([1, 2, 3, 4], 1, 2);
    const secondPage = selectRankedPage([1, 2, 3, 4], 2, 2);
    expect(firstPage).toEqual([1, 2]);
    expect(secondPage).toEqual([3, 4]);
    expect(selectRankedPage([1, 2, 3, 4], 3, 2)).toEqual([]);
    expect(selectRankedPage([1, 2, 3, 4], 0, 2)).toEqual([1, 2]);
    expect(calculateRankingScore({ author: {}, post: { content: "Short." } }))
      .toBe(calculateRankingScore({ author: {}, post: { content: "A long article with lots of words." } }));
  });
});