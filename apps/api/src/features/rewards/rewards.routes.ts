import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  commentsTable,
  coinLedgerTable,
  inviteCodesTable,
  likesTable,
  postsTable,
  userTrustScoresTable,
  usersTable,
} from "@workspace/db/schema";
import { and, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { isFeatureEnabled } from "../../lib/featureFlags";
import { getOrCreateReferralCode } from "./rewards.service";
import { coinCreditSchema } from "./rewards.validation";

interface AuthedRequest extends Request {
  currentUser: { id: number; role: string };
}

export const rewardsRouter = Router();

async function getActivityCounts(userIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (userIds.length === 0) return result;

  const [posts, comments, likes] = await Promise.all([
    db.select({ userId: postsTable.authorId, total: count() })
      .from(postsTable)
      .where(and(inArray(postsTable.authorId, userIds), eq(postsTable.isDeleted, false)))
      .groupBy(postsTable.authorId),
    db.select({ userId: commentsTable.authorId, total: count() })
      .from(commentsTable)
      .where(inArray(commentsTable.authorId, userIds))
      .groupBy(commentsTable.authorId),
    db.select({ userId: likesTable.userId, total: count() })
      .from(likesTable)
      .where(inArray(likesTable.userId, userIds))
      .groupBy(likesTable.userId),
  ]);

  for (const item of [...posts, ...comments, ...likes]) {
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
    trustScore: number | null;
    activityCount: number;
  }> = [];

  if (enabled) {
    const invite = await getOrCreateReferralCode(userId);
    referral = { code: invite.code, shareUrl: shareUrl(req, invite.code) };

    const referredUsers = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      joinedAt: usersTable.createdAt,
      trustScore: userTrustScoresTable.uti,
    })
      .from(usersTable)
      .leftJoin(userTrustScoresTable, eq(userTrustScoresTable.userId, usersTable.id))
      .where(and(eq(usersTable.referredBy, userId), eq(usersTable.isDeleted, false)))
      .orderBy(desc(usersTable.createdAt));
    const activityCounts = await getActivityCounts(referredUsers.map((user) => user.id));
    referrals = referredUsers.map((user) => ({
      ...user,
      trustScore: user.trustScore === null ? null : Number(user.trustScore),
      activityCount: activityCounts.get(user.id) ?? 0,
    }));
  }

  let totalCoins = 0;
  let entries: Array<{
    id: number;
    amount: number;
    reason: string;
    basis: string;
    createdAt: Date;
    adminDisplayName: string;
  }> = [];
  if (coinsEnabled) {
    const [balance] = await db.select({ total: sql<string>`COALESCE(SUM(${coinLedgerTable.amount}), 0)::text` })
      .from(coinLedgerTable)
      .where(eq(coinLedgerTable.userId, userId));
    totalCoins = Number(balance?.total ?? 0);
    const rows = await db.select({
      id: coinLedgerTable.id,
      amount: coinLedgerTable.amount,
      reason: coinLedgerTable.reason,
      basis: coinLedgerTable.basis,
      createdAt: coinLedgerTable.createdAt,
      adminDisplayName: usersTable.displayName,
      adminUsername: usersTable.username,
    })
      .from(coinLedgerTable)
      .leftJoin(usersTable, eq(coinLedgerTable.adminId, usersTable.id))
      .where(eq(coinLedgerTable.userId, userId))
      .orderBy(desc(coinLedgerTable.createdAt), desc(coinLedgerTable.id))
      .limit(100);
    entries = rows.map(({ adminUsername, ...entry }) => ({
      ...entry,
      adminDisplayName: entry.adminDisplayName || adminUsername || "QuillHive admin",
    }));
  }

  return res.json({ enabled, coinsEnabled, referral, referrals, totalCoins, entries });
});
