import crypto from "crypto";
import { db } from "@workspace/db";
import { inviteCodesTable } from "@workspace/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface CoinBalanceFactors {
  trustScore: number | null;
  referralCount: number;
  activityCount: number;
}

export interface CoinBalanceBreakdown {
  trustCoins: number;
  referralCoins: number;
  activityCoins: number;
  totalCoins: number;
}

export function calculateCoinBalance(factors: CoinBalanceFactors): CoinBalanceBreakdown {
  const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0;
  const trustCoins = Math.round(Math.min(100, Math.max(0, finiteOrZero(factors.trustScore ?? 0))));
  const referralCoins = Math.min(500, Math.max(0, Math.floor(finiteOrZero(factors.referralCount))) * 10);
  const activityCoins = Math.min(200, Math.floor(Math.max(0, finiteOrZero(factors.activityCount)) / 5));
  return {
    trustCoins,
    referralCoins,
    activityCoins,
    totalCoins: trustCoins + referralCoins + activityCoins,
  };
}

export async function getOrCreateReferralCode(userId: number) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(742013, ${userId})`);

    const [existing] = await tx.select()
      .from(inviteCodesTable)
      .where(and(
        eq(inviteCodesTable.createdBy, userId),
        isNull(inviteCodesTable.expiresAt),
        eq(inviteCodesTable.isActive, true),
      ))
      .orderBy(inviteCodesTable.createdAt, inviteCodesTable.id)
      .limit(1);

    const invite = existing ?? (await tx.insert(inviteCodesTable)
      .values({
        code: crypto.randomBytes(8).toString("hex").toUpperCase(),
        createdBy: userId,
        expiresAt: null,
      })
      .returning())[0];

    if (!invite) throw new Error("Unable to create a referral code");

    await tx.update(inviteCodesTable)
      .set({ isActive: false })
      .where(and(
        eq(inviteCodesTable.createdBy, userId),
        isNull(inviteCodesTable.expiresAt),
        eq(inviteCodesTable.isActive, true),
        ne(inviteCodesTable.id, invite.id),
      ));

    return invite;
  });
}
