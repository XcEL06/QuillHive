import { describe, expect, it } from "vitest";
import { calculateCoinBalance } from "../features/rewards/rewards.service";

describe("automatic QuillHive Coin balance", () => {
  it("combines trust, referrals, and authored activity", () => {
    expect(calculateCoinBalance({ trustScore: 74.6, referralCount: 12, activityCount: 85 })).toEqual({
      trustCoins: 75,
      referralCoins: 120,
      activityCoins: 17,
      totalCoins: 212,
    });
  });

  it.each([
    { trustScore: 500, referralCount: 100, activityCount: 1000, expected: [100, 500, 200, 800] },
    { trustScore: -20, referralCount: -1, activityCount: -5, expected: [0, 0, 0, 0] },
    { trustScore: null, referralCount: 0, activityCount: 4, expected: [0, 0, 0, 0] },
    { trustScore: Number.NaN, referralCount: Number.POSITIVE_INFINITY, activityCount: Number.NaN, expected: [0, 0, 0, 0] },
  ])("bounds each component and total: %o", ({ trustScore, referralCount, activityCount, expected }) => {
    const balance = calculateCoinBalance({ trustScore, referralCount, activityCount });
    expect([balance.trustCoins, balance.referralCoins, balance.activityCoins, balance.totalCoins]).toEqual(expected);
  });
});
