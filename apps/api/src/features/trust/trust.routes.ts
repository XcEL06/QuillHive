import { Router } from "express";
import { db } from "@workspace/db";
import {
  behaviorEventsTable,
  moderationStrikesTable,
  postsTable,
  reportsTable,
  reputationEventsTable,
  spamReviewFlagsTable,
  userTrustScoresTable,
  usersTable,
} from "@workspace/db/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getSessionUserId } from "../../lib/auth";
import { requireAdmin, requirePermission } from "../../middleware/admin";
import { updateUserTrustScore, getUserTrustScore } from "./trust.service";
import { getUserReputationTimeline } from "./reputation.service";

export const trustRouter = Router();
export const adminTrustRouter = Router();
adminTrustRouter.use(requireAdmin);

function getViewerId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

trustRouter.get("/me", async (req, res) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  let score = await getUserTrustScore(userId);
  if (!score) {
    score = await updateUserTrustScore(userId);
  }
  return res.json(score);
});

trustRouter.get("/timeline", async (req, res) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const timeline = await getUserReputationTimeline(userId);
  return res.json(timeline);
});

trustRouter.get("/timeline/:userId", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const targetId = parseInt(req.params.userId);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  const timeline = await getUserReputationTimeline(targetId);
  return res.json(timeline);
});

trustRouter.get("/:userId", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });

  const score = await getUserTrustScore(targetId);
  if (!score) return res.json({ tier: "restricted", userId: targetId, uti: 0, cvs: 0, bcs: 0, cts: 0, avgCis: 0, creatorLevel: "new_voice", visibilityMultiplier: 0.3 });

  return res.json({ tier: score.tier, userId: targetId, uti: Math.round(score.uti), cvs: score.cvs, bcs: score.bcs, cts: score.cts, avgCis: score.avgCis, creatorLevel: score.creatorLevel ?? "new_voice", visibilityMultiplier: score.visibilityMultiplier });
});

trustRouter.post("/recalculate", async (req, res) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const score = await updateUserTrustScore(userId);
  return res.json(score);
});

adminTrustRouter.get("/users", requirePermission("view_users"), async (req, res) => {
  const scores = await db
    .select({
      id: userTrustScoresTable.id,
      userId: userTrustScoresTable.userId,
      cvs: userTrustScoresTable.cvs,
      bcs: userTrustScoresTable.bcs,
      cts: userTrustScoresTable.cts,
      avgCis: userTrustScoresTable.avgCis,
      uti: userTrustScoresTable.uti,
      visibilityMultiplier: userTrustScoresTable.visibilityMultiplier,
      tier: userTrustScoresTable.tier,
      creatorLevel: userTrustScoresTable.creatorLevel,
      levelUpdatedAt: userTrustScoresTable.levelUpdatedAt,
      updatedAt: userTrustScoresTable.updatedAt,
      role: usersTable.role,
      isOfficialAccount: usersTable.isOfficialAccount,
    })
    .from(userTrustScoresTable)
    .leftJoin(usersTable, eq(usersTable.id, userTrustScoresTable.userId))
    .orderBy(sql`CASE WHEN ${usersTable.role} = 'super_admin' OR ${usersTable.isOfficialAccount} THEN 100 ELSE ${userTrustScoresTable.uti} END DESC`)
    .limit(100);

  return res.json(scores.map((score) => {
    const platformTrusted = score.role === "super_admin" || score.isOfficialAccount;
    return platformTrusted
      ? { ...score, uti: 100, tier: "trusted", creatorLevel: "luminary", visibilityMultiplier: 1.2 }
      : score;
  }));
});

adminTrustRouter.get("/accounts", requirePermission("view_users"), async (req, res) => {
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isInteger(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 100;
  const [rows, [total]] = await Promise.all([
    db.select({
      id: userTrustScoresTable.id,
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      role: usersTable.role,
      isOfficialAccount: usersTable.isOfficialAccount,
      cvs: userTrustScoresTable.cvs,
      bcs: userTrustScoresTable.bcs,
      cts: userTrustScoresTable.cts,
      avgCis: userTrustScoresTable.avgCis,
      uti: userTrustScoresTable.uti,
      tier: userTrustScoresTable.tier,
      creatorLevel: userTrustScoresTable.creatorLevel,
      visibilityMultiplier: userTrustScoresTable.visibilityMultiplier,
    }).from(usersTable)
      .leftJoin(userTrustScoresTable, eq(userTrustScoresTable.userId, usersTable.id))
      .where(eq(usersTable.isDeleted, false))
      .orderBy(sql`CASE WHEN ${usersTable.role} = 'super_admin' OR ${usersTable.isOfficialAccount} THEN 100 ELSE COALESCE(${userTrustScoresTable.uti}, 0) END DESC`, desc(usersTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.isDeleted, false)),
  ]);

  return res.json({
    rows: rows.map((row) => {
      const platformTrusted = row.role === "super_admin" || row.isOfficialAccount;
      return {
        ...row,
        cvs: row.cvs ?? 0,
        bcs: row.bcs ?? 0,
        cts: row.cts ?? 0,
        avgCis: row.avgCis ?? 0,
        uti: platformTrusted ? 100 : row.uti ?? 0,
        tier: platformTrusted ? "trusted" : row.tier ?? "restricted",
        creatorLevel: platformTrusted ? "luminary" : row.creatorLevel ?? "new_voice",
        visibilityMultiplier: platformTrusted ? 1.2 : row.visibilityMultiplier ?? 0.3,
      };
    }),
    total: total?.count ?? 0,
    page,
    limit,
  });
});

adminTrustRouter.get("/moderation", requirePermission("view_reports"), async (_req, res) => {
  const [reports, strikes, bannedUsers, spamFlags, behaviorSignals, reputationSignals] = await Promise.all([
    db.select({
      id: reportsTable.id,
      targetType: reportsTable.targetType,
      targetId: reportsTable.targetId,
      reason: reportsTable.reason,
      category: reportsTable.category,
      priority: reportsTable.priority,
      createdAt: reportsTable.createdAt,
      reporterId: reportsTable.reporterId,
    }).from(reportsTable).where(eq(reportsTable.status, "pending"))
      .orderBy(desc(reportsTable.createdAt)).limit(50),
    db.select({
      id: moderationStrikesTable.id,
      userId: moderationStrikesTable.userId,
      reason: moderationStrikesTable.reason,
      severity: moderationStrikesTable.severity,
      expiresAt: moderationStrikesTable.expiresAt,
      createdAt: moderationStrikesTable.createdAt,
    }).from(moderationStrikesTable).orderBy(desc(moderationStrikesTable.createdAt)).limit(50),
    db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      bannedAt: usersTable.bannedAt,
    }).from(usersTable).where(and(eq(usersTable.isBanned, true), eq(usersTable.isDeleted, false)))
      .orderBy(desc(usersTable.bannedAt)).limit(50),
    db.select({
      id: spamReviewFlagsTable.id,
      userId: spamReviewFlagsTable.userId,
      ruleKey: spamReviewFlagsTable.ruleKey,
      reason: spamReviewFlagsTable.reason,
      status: spamReviewFlagsTable.status,
      createdAt: spamReviewFlagsTable.createdAt,
    }).from(spamReviewFlagsTable).where(eq(spamReviewFlagsTable.status, "pending"))
      .orderBy(desc(spamReviewFlagsTable.createdAt)).limit(50),
    db.select({
      id: behaviorEventsTable.id,
      userId: behaviorEventsTable.userId,
      eventType: behaviorEventsTable.eventType,
      severity: behaviorEventsTable.severity,
      createdAt: behaviorEventsTable.createdAt,
    }).from(behaviorEventsTable).orderBy(desc(behaviorEventsTable.createdAt)).limit(50),
    db.select({
      id: reputationEventsTable.id,
      userId: reputationEventsTable.userId,
      type: reputationEventsTable.type,
      scoreChange: reputationEventsTable.scoreChange,
      reason: reputationEventsTable.reason,
      createdAt: reputationEventsTable.createdAt,
    }).from(reputationEventsTable).orderBy(desc(reputationEventsTable.createdAt)).limit(50),
  ]);
  const userIds = [...new Set([
    ...reports.map((row) => row.reporterId),
    ...reports.filter((row) => row.targetType === "user").map((row) => row.targetId),
    ...strikes.map((row) => row.userId),
    ...spamFlags.map((row) => row.userId),
    ...behaviorSignals.map((row) => row.userId),
    ...reputationSignals.map((row) => row.userId),
  ])];
  const postIds = [...new Set(reports.filter((row) => row.targetType === "post").map((row) => row.targetId))];
  const [users, posts] = await Promise.all([
    userIds.length ? db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName }).from(usersTable).where(inArray(usersTable.id, userIds)) : [],
    postIds.length ? db.select({ id: postsTable.id, title: postsTable.title }).from(postsTable).where(inArray(postsTable.id, postIds)) : [],
  ]);
  const userById = new Map(users.map((user) => [user.id, user] as const));
  const postById = new Map(posts.map((post) => [post.id, post] as const));
  return res.json({
    reports: reports.map((report) => ({
      ...report,
      reporter: userById.get(report.reporterId) ?? null,
      target: report.targetType === "post"
        ? postById.get(report.targetId) ?? null
        : report.targetType === "user"
          ? userById.get(report.targetId) ?? null
          : null,
    })),
    strikes: strikes.map((strike) => ({ ...strike, user: userById.get(strike.userId) ?? null })),
    bannedUsers,
    spamFlags: spamFlags.map((flag) => ({ ...flag, user: userById.get(flag.userId) ?? null })),
    trustSignals: [
      ...behaviorSignals.map((signal) => ({
        id: `behavior-${signal.id}`,
        userId: signal.userId,
        user: userById.get(signal.userId) ?? null,
        label: signal.eventType.replace(/[_-]/g, " "),
        detail: `Behavior signal · severity ${signal.severity} of 10`,
        createdAt: signal.createdAt,
      })),
      ...reputationSignals.map((signal) => ({
        id: `reputation-${signal.id}`,
        userId: signal.userId,
        user: userById.get(signal.userId) ?? null,
        label: signal.type.replace(/[_-]/g, " "),
        detail: `${signal.scoreChange > 0 ? "+" : ""}${signal.scoreChange} trust points · ${signal.reason}`,
        createdAt: signal.createdAt,
      })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 50),
  });
});
