import { describe, expect, it } from "vitest";
import { detectSpamReviewSignals } from "../features/admin/spamReview.service";

describe("spam review heuristics", () => {
  it("flags the intended burst, duplicates, link-heavy, new-account scam, and mass-follow cases", () => {
    const now = new Date("2026-10-06T12:00:00.000Z");
    const users = [
      { id: 1, username: "burst", displayName: "Burst", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: 2, username: "copy", displayName: "Copy", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: 3, username: "links", displayName: "Links", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: 4, username: "newscam", displayName: "New Scam", createdAt: new Date("2026-10-05T12:00:00.000Z") },
      { id: 5, username: "follower", displayName: "Follower", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: 6, username: "ordinary", displayName: "Ordinary", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    ];
    const posts = [
      ...Array.from({ length: 5 }, (_, index) => ({
        id: 100 + index,
        authorId: 1,
        content: [
          "Artists discuss watercolor landscapes under winter morning skies",
          "Engineers compare database indexing strategies for analytics queries",
          "Gardeners cultivate tomatoes using compost and careful irrigation",
          "Astronomers photograph distant nebulae through mountain observatories",
          "Musicians rehearse chamber arrangements before the evening performance",
        ][index],
        createdAt: new Date(now.getTime() - (5 - index) * 60_000),
      })),
      { id: 200, authorId: 2, content: "A thoughtful guide for growing your creative practice with patience", createdAt: new Date(now.getTime() - 20_000) },
      { id: 201, authorId: 2, content: "A thoughtful guide for growing your creative practice with patience!", createdAt: new Date(now.getTime() - 10_000) },
      { id: 300, authorId: 3, content: "Check these offers https://shop-one.example/deal https://shop-two.example/deal", createdAt: new Date(now.getTime() - 30_000) },
      { id: 400, authorId: 4, content: "Send money through https://pay.example/claim to unlock this offer", createdAt: new Date(now.getTime() - 40_000) },
      { id: 500, authorId: 6, content: "A detailed update with useful context and one source https://news.example/article for the community to read", createdAt: new Date(now.getTime() - 60_000) },
      { id: 501, authorId: 6, content: "My second thoughtful update shares a different perspective and more useful context", createdAt: new Date(now.getTime() - 30_000) },
    ];
    const follows = Array.from({ length: 25 }, (_, index) => ({
      followerId: 5,
      createdAt: new Date(now.getTime() - (25 - index) * 10_000),
    }));

    const signals = detectSpamReviewSignals(users, posts, follows, now);
    const byUser = new Map<number, string[]>();
    for (const signal of signals) byUser.set(signal.userId, [...(byUser.get(signal.userId) ?? []), signal.ruleKey]);

    expect(byUser.get(1)).toEqual(["burst_posting"]);
    expect(byUser.get(2)).toEqual(["duplicate_content"]);
    expect(byUser.get(3)).toEqual(["link_heavy"]);
    expect(byUser.get(4)).toEqual(["new_account_link_or_payment"]);
    expect(byUser.get(5)).toEqual(["rapid_mass_following"]);
    expect(byUser.has(6)).toBe(false);
  });
});
