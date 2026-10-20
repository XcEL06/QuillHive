import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  commentsTable,
  postsTable,
  userTrustScoresTable,
  usersTable,
} from "@workspace/db/schema";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { isFeatureEnabled } from "../../lib/featureFlags";
import { calculateCoinBalance, getOrCreateReferralCode } from "./rewards.service";

interface AuthedRequest extends Request {
  currentUser: { id: number; role: string };
}

export const rewardsRouter = Router();

async function getActivityCounts(userIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (userIds.length === 0) return result;

  const [posts, comments] = await Promise.all([
    db.select({ userId: postsTable.authorId, total: count() })
      .from(postsTable)
      .where(and(inArray(postsTable.authorId, userIds), eq(postsTable.isDeleted, false)))
      .groupBy(postsTable.authorId),
    db.select({ userId: commentsTable.authorId, total: count() })
      .from(commentsTable)
      .where(inArray(commentsTable.authorId, userIds))
      .groupBy(commentsTable.authorId),
  ]);

  for (const item of [...posts, ...comments]) {
    result.set(item.userId, (result.get(item.userId) ?? 0) + Number(item.total));
  }
  return result;
}

function shareUrl(req: Request, code: string): string {
  const origin = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  return `${origin}/signup?invite=${encodeURIComponent(code)}`;
}

rewardsRouter.get("/mine", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const [enabled, coinsEnabled] = await Promise.all([
    isFeatureEnabled("referral_program_enabled"),
    isFeatureEnabled("quillhive_coins_enabled"),
  ]);

  let referral: { code: string; shareUrl: string } | null = null;
  let referrals: Array<{
    id: number;
    username: string;
    displayName: string;
    joinedAt: Date;
  }> = [];

  if (enabled) {
    const invite = await getOrCreateReferralCode(userId);
    referral = { code: invite.code, shareUrl: shareUrl(req, invite.code) };

    const referredUsers = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      joinedAt: usersTable.createdAt,
    })
      .from(usersTable)
      .where(and(eq(usersTable.referredBy, userId), eq(usersTable.isDeleted, false)))
      .orderBy(desc(usersTable.createdAt));
    referrals = referredUsers;
  }

  let coinBreakdown = { trustCoins: 0, referralCoins: 0, activityCoins: 0, totalCoins: 0 };
  if (coinsEnabled) {
    const [[trust], [referralCount], activityCounts] = await Promise.all([
      db.select({ trustScore: userTrustScoresTable.uti })
        .from(userTrustScoresTable)
        .where(eq(userTrustScoresTable.userId, userId))
        .limit(1),
      db.select({ total: count() })
        .from(usersTable)
        .where(and(eq(usersTable.referredBy, userId), eq(usersTable.isDeleted, false))),
      getActivityCounts([userId]),
    ]);
    coinBreakdown = calculateCoinBalance({
      trustScore: trust?.trustScore === null || trust?.trustScore === undefined ? null : Number(trust.trustScore),
      referralCount: Number(referralCount?.total ?? 0),
      activityCount: activityCounts.get(userId) ?? 0,
    });
  }

  return res.json({ enabled, coinsEnabled, referral, referrals, ...coinBreakdown });
});
