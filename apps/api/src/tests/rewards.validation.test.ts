import { describe, expect, it } from "vitest";
import { coinCreditSchema } from "../features/rewards/rewards.validation";

describe("Coin credit validation", () => {
  const validCredit = {
    userId: 17,
    amount: 250,
    reason: "Referral milestone",
    basis: "Three active referred members",
  };

  it("accepts positive integer grants and trims audit text", () => {
    expect(coinCreditSchema.parse({
      ...validCredit,
      reason: "  Referral milestone  ",
    })).toEqual({ ...validCredit, reason: "Referral milestone" });
  });

  it.each([
    { amount: 0 },
    { amount: -1 },
    { amount: 1.5 },
    { amount: 2_147_483_648 },
    { userId: 0 },
    { reason: "  " },
    { basis: "ok" },
  ])("rejects invalid credit input: %o", (override) => {
    expect(coinCreditSchema.safeParse({ ...validCredit, ...override }).success).toBe(false);
  });
});
