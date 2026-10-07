import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/admin";
import { validateParams } from "../../middleware/validate";
import { getPostAnalytics, getUserAnalytics, getGeographyAnalytics } from "./analytics.service";
import { getTopicPerformance, getReadDepthAnalytics, getWeeklyReport } from "./topicAnalytics.service";
import { getCreatorGrowthScore, getOpportunityReadiness } from "./growthScore.service";
import { getContentIntelligence } from "./contentIntelligence.service";
import { getUserTrustScore } from "../trust/trust.service";
import { db } from "@workspace/db";
import {
  usersTable,
  writingStreaksTable,
  userAchievementsTable,
  postsTable,
  followsTable,
  portfolioItemsTable,
  boostRequestsTable,
  incomeLogsTable,
  postViewsTable,
  profileViewsTable,
} from "@workspace/db/schema";
import { eq, and, gte, count, sql, inArray, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireCreatorIncomeEnabled } from "../../middleware/creatorIncome";

export const analyticsRouter = Router();

analyticsRouter.get("/creator/:username/stats", async (req, res) => {
  const { username } = req.params;
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username));
  if (!user) return res.status(404).json({ error: "User not found" });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [trustScore, streakRow, achRow, postRow, portRow, weeklyFollRow] = await Promise.all([
    getUserTrustScore(user.id),
    db.select({ currentStreak: writingStreaksTable.currentStreak, longestStreak: writingStreaksTable.longestStreak })
      .from(writingStreaksTable).where(eq(writingStreaksTable.userId, user.id)).limit(1),
    db.select({ n: sql<number>`count(*)::int` })
      .from(userAchievementsTable).where(eq(userAchievementsTable.userId, user.id)),
    db.select({ n: sql<number>`count(*)::int` })
      .from(postsTable).where(and(eq(postsTable.authorId, user.id), eq(postsTable.isPublished, true))),
    db.select({ n: sql<number>`count(*)::int` })
      .from(portfolioItemsTable).where(eq(portfolioItemsTable.userId, user.id)),
    db.select({ n: count() })
      .from(followsTable)
      .where(and(eq(followsTable.followingId, user.id), gte(followsTable.createdAt, sevenDaysAgo))),
  ]);

  return res.json({
    creatorLevel: trustScore?.creatorLevel ?? "new_voice",
    trustTier: trustScore?.tier ?? "neutral",
    uti: Math.round(trustScore?.uti ?? 0),
    writingStreak: streakRow[0]?.currentStreak ?? 0,
    longestStreak: streakRow[0]?.longestStreak ?? 0,
    achievementCount: Number(achRow[0]?.n ?? 0),
    postCount: Number(postRow[0]?.n ?? 0),
    portfolioCount: Number(portRow[0]?.n ?? 0),
    weeklyFollowerGrowth: Number(weeklyFollRow[0]?.n ?? 0),
  });
});

analyticsRouter.get("/user", requireAuth, async (req: any, res) => {
  const analytics = await getUserAnalytics(req.currentUser.id);
  return res.json(analytics);
});

analyticsRouter.get("/portfolio-views", requireAuth, async (req: any, res) => {
  const userId = req.currentUser.id as number;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [portfolioViewsRow] = await db
    .select({ count: sql<number>`count(distinct ${profileViewsTable.viewerUserId})::int` })
    .from(profileViewsTable)
    .where(and(
      eq(profileViewsTable.profileUserId, userId),
      gte(profileViewsTable.viewedAt, thirtyDaysAgo),
      sql`${profileViewsTable.viewerUserId} IS NOT NULL`,
      sql`${profileViewsTable.viewerUserId} IS DISTINCT FROM ${userId}`,
    ));

  const [recruiterViewsRow] = await db
    .select({ count: sql<number>`count(distinct ${profileViewsTable.viewerUserId})::int` })
    .from(profileViewsTable)
    .where(and(
      eq(profileViewsTable.profileUserId, userId),
      gte(profileViewsTable.viewedAt, thirtyDaysAgo),
      sql`${profileViewsTable.viewerUserId} IS NOT NULL`,
    ));

  return res.json({
    portfolioViews30d: Number(portfolioViewsRow?.count ?? 0),
    recruiterViews30d: Number(recruiterViewsRow?.count ?? 0),
  });
});

analyticsRouter.get("/dashboard", requireAuth, async (req: any, res) => {
  try {
    const analytics = await getUserAnalytics(req.currentUser.id);
    return res.json({
      totalViews: analytics.totals.views,
      totalLikes: analytics.totals.likes,
      totalComments: analytics.totals.comments,
      totalPosts: analytics.totals.posts,
      followers: analytics.totals.followers,
      engagementRate: analytics.engagementRate,
      postReach: analytics.postReach,
      followerGrowth: analytics.followerGrowth,
      dailyFollowerGrowth: analytics.dailyFollowerGrowth,
      topPosts: analytics.topPosts,
      reachMultiplier: analytics.reachMultiplier,
    });
  } catch (err) {
    // Analytics is an enhancement: an empty creator should still be able to
    // open the dashboard while an optional analytics table/service is offline.
    logger.warn({ err, userId: req.currentUser.id }, "dashboard_analytics_unavailable");
    return res.json({
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalPosts: 0,
      followers: 0,
      engagementRate: 0,
      postReach: 0,
      followerGrowth: { last30Days: 0, percentage: 0 },
      dailyFollowerGrowth: [],
      topPosts: [],
      reachMultiplier: 1,
      degraded: true,
    });
  }
});

analyticsRouter.get("/geography", requireAuth, async (req: any, res) => {
  const data = await getGeographyAnalytics(req.currentUser.id);
  return res.json(data);
});

analyticsRouter.get("/post/:id", requireAuth, validateParams(z.object({ id: z.coerce.number().int().positive() })), async (req: any, res) => {
  try {
    const analytics = await getPostAnalytics(Number(req.params.id), req.currentUser.id);
    if (!analytics) return res.status(404).json({ error: "Post not found" });
    return res.json(analytics);
  } catch (error: any) {
    if (error.message === "Forbidden") return res.status(403).json({ error: "Forbidden" });
    throw error;
  }
});

analyticsRouter.get("/topics", requireAuth, async (req: any, res) => {
  const data = await getTopicPerformance(req.currentUser.id);
  return res.json(data);
});

analyticsRouter.get("/read-depth", requireAuth, async (req: any, res) => {
  const data = await getReadDepthAnalytics(req.currentUser.id);
  return res.json(data);
});

analyticsRouter.get("/weekly-report", requireAuth, async (req: any, res) => {
  const data = await getWeeklyReport(req.currentUser.id);
  return res.json(data);
});

analyticsRouter.get("/growth-score", requireCreatorIncomeEnabled, requireAuth, async (req: any, res) => {
  try {
    const data = await getCreatorGrowthScore(req.currentUser.id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to calculate growth score" });
  }
});

analyticsRouter.get("/opportunity-readiness", requireCreatorIncomeEnabled, requireAuth, async (req: any, res) => {
  try {
    const data = await getOpportunityReadiness(req.currentUser.id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to calculate opportunity readiness" });
  }
});

analyticsRouter.get("/content-intelligence", requireAuth, async (req: any, res) => {
  try {
    const data = await getContentIntelligence(req.currentUser.id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to compute content intelligence" });
  }
});

// ── Creator Spending Analytics ────────────────────────────────────────────────
analyticsRouter.get("/creator/spending", requireCreatorIncomeEnabled, requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id as number;
    const range = (req.query.range as string) ?? "30d";

    let since: Date | null = null;
    const now = new Date();
    if (range === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === "7d") {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "90d") {
      since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    }

    const boostWhere = since
      ? and(eq(boostRequestsTable.userId, userId), gte(boostRequestsTable.createdAt, since))
      : eq(boostRequestsTable.userId, userId);

    const campaigns = await db
      .select({
        id: boostRequestsTable.id,
        postId: boostRequestsTable.postId,
        plan: boostRequestsTable.plan,
        status: boostRequestsTable.status,
        paidAmountCents: boostRequestsTable.paidAmountCents,
        grantedByAdminId: boostRequestsTable.grantedByAdminId,
        boostStartsAt: boostRequestsTable.boostStartsAt,
        boostEndsAt: boostRequestsTable.boostEndsAt,
        createdAt: boostRequestsTable.createdAt,
        postTitle: postsTable.title,
      })
      .from(boostRequestsTable)
      .leftJoin(postsTable, eq(boostRequestsTable.postId, postsTable.id))
      .where(boostWhere)
      .orderBy(desc(boostRequestsTable.createdAt));

    const paidStatuses = new Set(["approved", "active", "completed"]);
    const totalSpendCents = campaigns
      .filter((c) => paidStatuses.has(c.status))
      .reduce((sum, c) => sum + (c.paidAmountCents ?? 0), 0);

    const activeCampaigns = campaigns.filter(
      (c) => c.status === "active" || c.status === "approved"
    ).length;

    // Spending trend (group by date)
    const trendMap = new Map<string, number>();
    for (const c of campaigns) {
      if (!c.paidAmountCents || !paidStatuses.has(c.status)) continue;
      const date = c.createdAt.toISOString().slice(0, 10);
      trendMap.set(date, (trendMap.get(date) ?? 0) + c.paidAmountCents);
    }
    const spendingTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amountCents]) => ({ date, amountCents }));

    // Spend by plan type
    const typeMap = new Map<string, number>();
    for (const c of campaigns) {
      if (!c.paidAmountCents || !paidStatuses.has(c.status)) continue;
      typeMap.set(c.plan, (typeMap.get(c.plan) ?? 0) + c.paidAmountCents);
    }
    const spendByType = Array.from(typeMap.entries()).map(([type, amountCents]) => ({
      type,
      amountCents,
    }));

    // Post impressions for boosted posts
    const boostedPostIds = [...new Set(campaigns.map((c) => c.postId))].filter(
      (id): id is number => id != null
    );
    let totalImpressions = 0;
    if (boostedPostIds.length > 0) {
      const viewWhere = since
        ? and(inArray(postViewsTable.postId, boostedPostIds), gte(postViewsTable.createdAt, since))
        : inArray(postViewsTable.postId, boostedPostIds);
      const [viewRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(postViewsTable)
        .where(viewWhere);
      totalImpressions = Number(viewRow?.n ?? 0);
    }

    // Income / transactions
    const incomeWhere = since
      ? and(eq(incomeLogsTable.userId, userId), gte(incomeLogsTable.createdAt, since))
      : eq(incomeLogsTable.userId, userId);

    const transactions = await db
      .select()
      .from(incomeLogsTable)
      .where(incomeWhere)
      .orderBy(desc(incomeLogsTable.date))
      .limit(50);

    // Spend by currency (boosts always USD; income logs by their currency)
    const currencyMap = new Map<string, number>();
    if (totalSpendCents > 0) {
      currencyMap.set("USD", (currencyMap.get("USD") ?? 0) + totalSpendCents);
    }
    for (const t of transactions) {
      const amtCents = Math.round(t.amount * 100);
      currencyMap.set(t.currency, (currencyMap.get(t.currency) ?? 0) + amtCents);
    }
    const spendByCurrency = Array.from(currencyMap.entries()).map(
      ([currency, amountCents]) => ({ currency, amountCents })
    );

    const avgEngagementRate =
      totalImpressions > 0
        ? Math.round((activeCampaigns / totalImpressions) * 100 * 100) / 100
        : 0;

    return res.json({
      overview: { totalSpendCents, activeCampaigns, totalImpressions, avgEngagementRate },
      campaigns: campaigns.map((c) => ({
        id: c.id,
        postTitle: c.postTitle ?? "Untitled Post",
        plan: c.plan,
        status: c.status,
        paidAmountCents: c.paidAmountCents ?? 0,
        grantedByAdminId: c.grantedByAdminId ?? null,
        boostStartsAt: c.boostStartsAt?.toISOString() ?? null,
        boostEndsAt: c.boostEndsAt?.toISOString() ?? null,
        impressions: 0,
      })),
      spendingTrend,
      spendByType,
      spendByCurrency,
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        source: t.source,
        description: t.description ?? null,
        date: t.date.toISOString(),
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to load analytics" });
  }
});
