import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, postsTable, reportsTable, moderationStrikesTable, adminLogsTable, systemSettingsTable,
  userTrustScoresTable, topicsTable, moderationRulesTable, adminNotesTable,
  behaviorEventsTable, reputationEventsTable, blockedEmailAttemptsTable, translationCacheTable,
  boostRequestsTable, challengesTable,
  inviteCodesTable,
} from "@workspace/db/schema";
import { eq, desc, asc, and, count, ne, lt, sql, inArray, or, gt, gte, isNotNull } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin, requirePermission } from "../middleware/admin";
import { getAllFeatureFlags, FEATURE_FLAG_KEYS, reloadFeatureFlags, type FeatureFlagKey } from "../lib/featureFlags";
import { sendEmail } from "../features/email/email.service";
import { notify, notifyOfficialNotice } from "../features/notifications/notification.service";
import { BOOST_PLANS, type PlanKey } from "../features/boost/boost.routes";
import { deleteCachePattern } from "../lib/cache";
import { memDeletePattern } from "../lib/memCache";
import * as MessagingService from "../features/messaging/messaging.service";

const router = Router();
router.use(requireAdmin);

const DEFAULT_SETTINGS: Record<string, string> = {
  messaging_enabled: "true",
  post_creation_enabled: "true",
  feed_type: "normal",
};

async function auditLog(adminId: number, action: string, targetType: string, targetId?: number, details?: string) {
  await db.insert(adminLogsTable).values({ adminId, action, targetType, targetId: targetId ?? null, details: details ?? null });
}

const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(adminId: number, action: string, max = 20): boolean {
  const key = `${adminId}:${action}`;
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

router.get("/stats", async (req, res) => {
  const [userCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isDeleted, false));
  const [postCount] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.isDeleted, false));
  const [reportCount] = await db.select({ count: count() }).from(reportsTable).where(eq(reportsTable.status, "pending"));
  const [bannedCount] = await db.select({ count: count() }).from(usersTable).where(and(eq(usersTable.isBanned, true), eq(usersTable.isDeleted, false)));
  const [pendingBoostCount] = await db.select({ count: count() }).from(boostRequestsTable).where(eq(boostRequestsTable.status, "pending"));
  const [activeBoostCount] = await db.select({ count: count() }).from(boostRequestsTable).where(and(eq(boostRequestsTable.status, "approved"), gt(boostRequestsTable.boostEndsAt, new Date())));
  const [challengeCount] = await db.select({ count: count() }).from(challengesTable).where(and(eq(challengesTable.isActive, true), gte(challengesTable.endsAt, new Date())));
  const [officialAccountCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isOfficialAccount, true));
  const [boostRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(paid_amount_cents), 0)` }).from(boostRequestsTable).where(eq(boostRequestsTable.status, "approved"));
  return res.json({
    totalUsers: userCount?.count ?? 0,
    totalPosts: postCount?.count ?? 0,
    pendingReports: reportCount?.count ?? 0,
    bannedUsers: bannedCount?.count ?? 0,
    pendingBoosts: pendingBoostCount?.count ?? 0,
    activeBoosts: activeBoostCount?.count ?? 0,
    activeChallenges: challengeCount?.count ?? 0,
    officialAccounts: officialAccountCount?.count ?? 0,
    totalBoostRevenueCents: boostRevenue?.total ?? 0,
  });
});

router.get("/users", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, displayName: usersTable.displayName, role: usersTable.role, isBanned: usersTable.isBanned, bannedAt: usersTable.bannedAt, avatarUrl: usersTable.avatarUrl, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.isDeleted, false))
    .orderBy(desc(usersTable.createdAt))
    .limit(limit).offset((page - 1) * limit);
  const [total] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isDeleted, false));
  return res.json({ users, total: total?.count ?? 0, page, limit });
});

router.get("/referrals", async (_req, res) => {
  const { isFeatureEnabled } = await import("../lib/featureFlags");
  const rewardsEnabled = await isFeatureEnabled("referral_rewards_enabled");
  const referrers = await db.execute(sql`
    SELECT u.id, u.username, u.display_name AS "displayName",
           COUNT(r.id)::int AS "referredUserCount",
           COUNT(DISTINCT i.id)::int AS "inviteCodeCount"
    FROM users u
    LEFT JOIN users r ON r.referred_by = u.id AND r.is_deleted = false
    LEFT JOIN invite_codes i ON i.created_by = u.id
    WHERE u.is_deleted = false
    GROUP BY u.id, u.username, u.display_name
    HAVING COUNT(r.id) > 0
    ORDER BY COUNT(r.id) DESC, u.created_at ASC
    LIMIT 100
  `);
  const inviteCodes = await db
    .select({ createdBy: inviteCodesTable.createdBy, code: inviteCodesTable.code, usedBy: inviteCodesTable.usedBy, createdAt: inviteCodesTable.createdAt })
    .from(inviteCodesTable)
    .orderBy(desc(inviteCodesTable.createdAt))
    .limit(200);
  const sources = await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(referral_source), ''), 'unknown') AS source,
           COUNT(*)::int AS count
    FROM users
    WHERE is_deleted = false AND referral_source IS NOT NULL
    GROUP BY COALESCE(NULLIF(TRIM(referral_source), ''), 'unknown')
    ORDER BY COUNT(*) DESC
  `);
  return res.json({ rewardsEnabled, referrers: referrers.rows, inviteCodes, referralSources: sources.rows });
});

router.get("/suspicious-clusters", requireAdmin, async (_req, res) => {
  const candidates = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      createdAt: usersTable.createdAt,
      referredBy: usersTable.referredBy,
      isBanned: usersTable.isBanned,
      signupIpHash: usersTable.signupIpHash,
    })
    .from(usersTable)
    .where(and(eq(usersTable.isDeleted, false), isNotNull(usersTable.signupIpHash)))
    .orderBy(asc(usersTable.signupIpHash), asc(usersTable.createdAt));

  const byHash = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    if (!candidate.signupIpHash) continue;
    const group = byHash.get(candidate.signupIpHash) ?? [];
    group.push(candidate);
    byHash.set(candidate.signupIpHash, group);
  }

  const clusters: Array<{
    id: string;
    accountCount: number;
    firstCreatedAt: Date;
    accounts: Array<{
      id: number;
      username: string;
      displayName: string;
      createdAt: Date;
      usedReferralCode: boolean;
      isBanned: boolean;
    }>;
  }> = [];
  let clusterIndex = 0;

  for (const accounts of byHash.values()) {
    for (let start = 0; start < accounts.length;) {
      const firstCreatedAt = accounts[start].createdAt;
      const windowEnd = firstCreatedAt.getTime() + 24 * 60 * 60 * 1000;
      const matching = accounts.filter((account) => account.createdAt.getTime() <= windowEnd);
      if (matching.length >= 3) {
        clusters.push({
          id: `cluster-${clusterIndex++}`,
          accountCount: matching.length,
          firstCreatedAt,
          accounts: matching.map(({ id, username, displayName, createdAt, referredBy, isBanned }) => ({
            id,
            username,
            displayName,
            createdAt,
            usedReferralCode: referredBy !== null,
            isBanned,
          })),
        });
        start += matching.length;
      } else {
        break;
      }
    }
  }

  return res.json({ clusters });
});

router.post("/users/:id/notice", async (req: any, res) => {
  const id = parseInt(req.params.id);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "message is required" });
  if (message.length > 5000) return res.status(400).json({ error: "message must be 5000 characters or fewer" });
  if (!checkRateLimit(req.currentUser.id, "official_notice")) {
    return res.status(429).json({ error: "Too many notices. Try again in a minute." });
  }

  const [target] = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)));
  if (!target) return res.status(404).json({ error: "User not found" });

  await notifyOfficialNotice({
    userId: id,
    actorId: req.currentUser.id,
    title: "A message from the QuillHive team",
    message,
    url: "/notifications",
  });
  const email = await sendEmail({
    to: target.email,
    subject: "A message from the QuillHive team",
    text: message,
  });
  await auditLog(req.currentUser.id, "official_notice_sent", "user", id, message);

  return res.status(201).json({ success: true, emailQueued: email.ok });
});

router.get("/support/status", requireSuperAdmin, async (_req, res) => {
  const superAdmins = await db
    .select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
    .from(usersTable)
    .where(and(eq(usersTable.role, "super_admin"), eq(usersTable.isDeleted, false)));
  return res.json({
    superAdminCount: superAdmins.length,
    superAdmins,
    ownerEmailConfigured: Boolean(process.env.OWNER_EMAIL),
  });
});

router.post("/communications/direct", requireSuperAdmin, async (req: any, res) => {
  const targetUserId = Number(req.body?.userId);
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) return res.status(400).json({ error: "userId must be a positive integer" });
  if (!content || content.length > 5_000) return res.status(400).json({ error: "content is required and must be 5000 characters or fewer" });
  if (!checkRateLimit(req.currentUser.id, "admin_direct_message")) return res.status(429).json({ error: "Too many messages. Try again in a minute." });

  try {
    const message = await MessagingService.sendAdminMessage(req.currentUser.id, targetUserId, content);
    await notify({ userId: targetUserId, actorId: req.currentUser.id, type: "admin_action", title: "Message from QuillHive", message: content.slice(0, 160), url: "/messages" });
    await auditLog(req.currentUser.id, "admin_direct_message_sent", "user", targetUserId, content);
    return res.status(201).json({ success: true, message });
  } catch (error: any) {
    if (error?.message === "User not found") return res.status(404).json({ error: error.message });
    throw error;
  }
});

router.post("/communications/broadcast", requireSuperAdmin, async (req: any, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!title || title.length > 180) return res.status(400).json({ error: "title is required and must be 180 characters or fewer" });
  if (!message || message.length > 5_000) return res.status(400).json({ error: "message is required and must be 5000 characters or fewer" });
  if (!checkRateLimit(req.currentUser.id, "admin_broadcast", 5)) return res.status(429).json({ error: "Too many broadcasts. Try again later." });

  const recipients = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isDeleted, false));
  await Promise.all(recipients.map((recipient) => notify({ userId: recipient.id, actorId: req.currentUser.id, type: "admin_action", title, message, url: "/notifications" })));
  await auditLog(req.currentUser.id, "admin_notification_broadcast", "users", undefined, `${title}: ${message}`);
  return res.status(201).json({ success: true, recipientCount: recipients.length });
});

router.patch("/users/:id/role", requireSuperAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { role } = req.body;
  const validRoles = ["user", "moderator", "admin"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role. super_admin cannot be assigned via API." });
  }
  if (req.currentUser.id === id) return res.status(400).json({ error: "Cannot change your own role" });
  if (!checkRateLimit(req.currentUser.id, "role_change")) return res.status(429).json({ error: "Too many role changes. Try again in a minute." });

  const [updated] = await db.update(usersTable).set({ role, updatedAt: new Date() }).where(eq(usersTable.id, id)).returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role });
  if (!updated) return res.status(404).json({ error: "User not found" });
  await auditLog(req.currentUser.id, "role_changed", "user", id, `role set to ${role}`);
  return res.json(updated);
});

router.post("/users/:id/ban", async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (req.currentUser.id === id) return res.status(400).json({ error: "Cannot ban yourself" });
  if (!checkRateLimit(req.currentUser.id, "ban")) return res.status(429).json({ error: "Too many ban actions. Try again in a minute." });

  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)));
  if (!target) return res.status(404).json({ error: "User not found" });

  const newBanned = !target.isBanned;
  const [updated] = await db.update(usersTable).set({ isBanned: newBanned, bannedAt: newBanned ? new Date() : null, updatedAt: new Date() }).where(eq(usersTable.id, id)).returning({ id: usersTable.id, username: usersTable.username, isBanned: usersTable.isBanned });
  await auditLog(req.currentUser.id, newBanned ? "user_banned" : "user_unbanned", "user", id);
  return res.json({ ...updated, action: newBanned ? "banned" : "unbanned" });
});

router.delete("/users/:id", async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (req.currentUser.id === id) return res.status(400).json({ error: "Cannot delete yourself" });
  const [target] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)));
  if (!target) return res.status(404).json({ error: "User not found" });

  await db.update(usersTable).set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() }).where(eq(usersTable.id, id));
  await db.update(postsTable).set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() }).where(eq(postsTable.authorId, id));
  await auditLog(req.currentUser.id, "user_deleted", "user", id, target.username);
  return res.json({ success: true });
});

router.get("/posts", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const posts = await db
    .select({ id: postsTable.id, title: postsTable.title, type: postsTable.type, isPublished: postsTable.isPublished, authorId: postsTable.authorId, createdAt: postsTable.createdAt, authorUsername: usersTable.username, authorDisplayName: usersTable.displayName })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.isDeleted, false))
    .orderBy(desc(postsTable.createdAt))
    .limit(limit).offset((page - 1) * limit);
  const [total] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.isDeleted, false));
  return res.json({ posts, total: total?.count ?? 0, page, limit });
});

router.post("/posts/:id/grant-boost", requirePermission("manage_boosts"), async (req: any, res) => {
  const postId = parseInt(req.params.id, 10);
  const plan = req.body?.plan as PlanKey | undefined;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid post id" });
  if (!plan || !(plan in BOOST_PLANS)) return res.status(400).json({ error: "plan must be starter, growth, or spotlight" });
  if (reason.length > 1_000) return res.status(400).json({ error: "reason must be 1000 characters or fewer" });

  const [post] = await db
    .select({ id: postsTable.id, title: postsTable.title, authorId: postsTable.authorId, authorDisplayName: usersTable.displayName })
    .from(postsTable)
    .leftJoin(usersTable, eq(usersTable.id, postsTable.authorId))
    .where(and(eq(postsTable.id, postId), eq(postsTable.isDeleted, false)));
  if (!post) return res.status(404).json({ error: "Post not found" });

  const planInfo = BOOST_PLANS[plan];
  const now = new Date();
  const boostEndsAt = new Date(now.getTime() + planInfo.durationHours * 3_600_000);
  const [boost] = await db.insert(boostRequestsTable).values({
    userId: post.authorId,
    postId: post.id,
    plan,
    durationHours: planInfo.durationHours,
    reachMultiplier: planInfo.reachMultiplier,
    placementPriority: planInfo.placementPriority,
    status: "approved",
    paidAmountCents: 0,
    flwTxRef: null,
    grantedByAdminId: req.currentUser.id,
    reviewedBy: req.currentUser.id,
    reviewedAt: now,
    boostStartsAt: now,
    boostEndsAt,
    adminNote: reason || "Editorial boost",
  }).returning();

  await Promise.all([
    deleteCachePattern("feed:*") ,
    deleteCachePattern("trending:*") ,
  ]);
  memDeletePattern("trending:");
  await notify({
    userId: post.authorId,
    actorId: req.currentUser.id,
    type: "milestone",
    title: "QuillHive boosted your post 🚀",
    message: `Your post '${post.title ?? "Untitled"}' was selected for a free boost by the QuillHive team. Enjoy the extra reach!`,
    url: "/promotions",
    postId: post.id,
  });
  await auditLog(req.currentUser.id, "post_boost_granted", "post", post.id, `${plan}: ${reason || "Editorial boost"}`);

  return res.status(201).json({ ok: true, boost, boostEndsAt });
});

router.delete("/posts/:id", async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (!checkRateLimit(req.currentUser.id, "delete_post")) return res.status(429).json({ error: "Too many delete actions. Try again in a minute." });
  const [post] = await db.select().from(postsTable).where(and(eq(postsTable.id, id), eq(postsTable.isDeleted, false)));
  if (!post) return res.status(404).json({ error: "Post not found" });
  await db.update(postsTable).set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() }).where(eq(postsTable.id, id));
  await auditLog(req.currentUser.id, "post_deleted", "post", id, post.title ?? undefined);
  return res.json({ success: true });
});

router.patch("/posts/:id/unpublish", async (req: any, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(postsTable).set({ isPublished: false, updatedAt: new Date() }).where(and(eq(postsTable.id, id), eq(postsTable.isDeleted, false))).returning({ id: postsTable.id, isPublished: postsTable.isPublished });
  if (!updated) return res.status(404).json({ error: "Post not found" });
  await auditLog(req.currentUser.id, "post_unpublished", "post", id);
  return res.json(updated);
});

router.get("/reports", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const status = req.query.status as string | undefined;
  let query = db.select().from(reportsTable).$dynamic();
  if (status) query = query.where(eq(reportsTable.status, status));

  // Sort by priority (urgent → low) then by recency
  const priorityOrder = sql`CASE ${reportsTable.priority}
    WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`;
  const reports = await query
    .orderBy(priorityOrder, desc(reportsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  // Enrich with reporter + target preview (best-effort)
  const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
  const reporters = reporterIds.length
    ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
        .from(usersTable).where(inArray(usersTable.id, reporterIds))
    : [];
  const reporterMap = new Map(reporters.map((u) => [u.id, u]));

  const postIds = reports.filter((r) => r.targetType === "post").map((r) => r.targetId);
  const postPreviews = postIds.length
    ? await db.select({ id: postsTable.id, title: postsTable.title, excerpt: postsTable.excerpt, authorId: postsTable.authorId, isPublished: postsTable.isPublished })
        .from(postsTable).where(inArray(postsTable.id, postIds))
    : [];
  const postMap = new Map(postPreviews.map((p) => [p.id, p]));

  const userIds = reports.filter((r) => r.targetType === "user").map((r) => r.targetId);
  const userPreviews = userIds.length
    ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, isBanned: usersTable.isBanned })
        .from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(userPreviews.map((u) => [u.id, u]));

  const enriched = reports.map((r) => ({
    ...r,
    reporter: reporterMap.get(r.reporterId) ?? null,
    target: r.targetType === "post" ? postMap.get(r.targetId) ?? null
          : r.targetType === "user" ? userMap.get(r.targetId) ?? null
          : null,
  }));

  const [total] = await db.select({ count: count() }).from(reportsTable);
  return res.json({ reports: enriched, total: total?.count ?? 0, page, limit });
});

router.post("/reports", async (req: any, res) => {
  const { targetType, targetId, reason } = req.body;
  if (!targetType || !targetId || !reason) return res.status(400).json({ error: "targetType, targetId, and reason are required" });
  const [report] = await db.insert(reportsTable).values({ reporterId: req.currentUser.id, targetType, targetId, reason, status: "pending" }).returning();
  return res.status(201).json(report);
});

router.patch("/reports/:id/resolve", async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { strikeUserId, strikeReason, severity } = req.body ?? {};
  const [updated] = await db.update(reportsTable).set({ status: "resolved", resolvedBy: req.currentUser.id, resolvedAt: new Date() }).where(eq(reportsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Report not found" });
  let strike: typeof moderationStrikesTable.$inferSelect | null = null;
  if (strikeUserId && strikeReason) {
    [strike] = await db.insert(moderationStrikesTable).values({
      userId: Number(strikeUserId),
      reportId: id,
      reason: String(strikeReason).slice(0, 1000),
      severity: Math.max(1, Math.min(10, Number(severity) || 1)),
      issuedBy: req.currentUser.id,
    }).returning();
    await auditLog(req.currentUser.id, "moderation_strike_created", "user", Number(strikeUserId), strikeReason);
  }
  await auditLog(req.currentUser.id, "report_resolved", "report", id);
  return res.json({ report: updated, strike });
});

router.patch("/reports/:id/dismiss", async (req: any, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(reportsTable).set({ status: "dismissed", resolvedBy: req.currentUser.id, resolvedAt: new Date() }).where(eq(reportsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Report not found" });
  await auditLog(req.currentUser.id, "report_dismissed", "report", id);
  return res.json(updated);
});

router.post("/users/:id/strikes", async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { reason, severity, expiresAt } = req.body ?? {};
  if (!reason) return res.status(400).json({ error: "reason is required" });
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)));
  if (!target) return res.status(404).json({ error: "User not found" });
  const [strike] = await db.insert(moderationStrikesTable).values({
    userId: id,
    reason: String(reason).slice(0, 1000),
    severity: Math.max(1, Math.min(10, Number(severity) || 1)),
    issuedBy: req.currentUser.id,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();
  await auditLog(req.currentUser.id, "moderation_strike_created", "user", id, reason);
  return res.status(201).json(strike);
});

router.get("/users/:id/strikes", async (req, res) => {
  const id = parseInt(req.params.id);
  const strikes = await db.select().from(moderationStrikesTable).where(eq(moderationStrikesTable.userId, id)).orderBy(desc(moderationStrikesTable.createdAt));
  return res.json({ strikes });
});

router.get("/logs", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const logs = await db
    .select({ id: adminLogsTable.id, action: adminLogsTable.action, targetType: adminLogsTable.targetType, targetId: adminLogsTable.targetId, details: adminLogsTable.details, createdAt: adminLogsTable.createdAt, adminDisplayName: usersTable.displayName, adminUsername: usersTable.username })
    .from(adminLogsTable)
    .leftJoin(usersTable, eq(adminLogsTable.adminId, usersTable.id))
    .orderBy(desc(adminLogsTable.createdAt))
    .limit(limit).offset((page - 1) * limit);
  const [total] = await db.select({ count: count() }).from(adminLogsTable);
  return res.json({ logs, total: total?.count ?? 0, page, limit });
});

router.get("/insights", async (req, res) => {
  const [{ suspiciousCount }] = await db
    .select({ suspiciousCount: count() })
    .from(userTrustScoresTable)
    .where(lt(userTrustScoresTable.uti, 30));

  const suspiciousUsers = await db
    .select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, uti: userTrustScoresTable.uti, tier: userTrustScoresTable.tier })
    .from(userTrustScoresTable)
    .leftJoin(usersTable, eq(userTrustScoresTable.userId, usersTable.id))
    .where(lt(userTrustScoresTable.uti, 30))
    .orderBy(userTrustScoresTable.uti)
    .limit(10);

  const mostReportedPosts = await db
    .select({ postId: reportsTable.targetId, reportCount: count() })
    .from(reportsTable)
    .where(and(eq(reportsTable.targetType, "post"), eq(reportsTable.status, "pending")))
    .groupBy(reportsTable.targetId)
    .orderBy(desc(count()))
    .limit(5);

  const trendingTopics = await db
    .select({ name: topicsTable.name, slug: topicsTable.slug, postCount: topicsTable.postCount })
    .from(topicsTable)
    .orderBy(desc(topicsTable.postCount))
    .limit(10);

  const [{ trustAnomalies }] = await db
    .select({ trustAnomalies: count() })
    .from(userTrustScoresTable)
    .where(lt(userTrustScoresTable.uti, 20));

  return res.json({
    suspiciousUsers,
    suspiciousCount: suspiciousCount ?? 0,
    mostReportedPosts,
    trendingTopics,
    trustAnomalies: trustAnomalies ?? 0,
  });
});

router.patch("/users/:id/reach", async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { reachMultiplier, visibilityPenalty } = req.body;
  if (reachMultiplier !== undefined && (reachMultiplier < 0 || reachMultiplier > 1)) {
    return res.status(400).json({ error: "reachMultiplier must be between 0 and 1" });
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (reachMultiplier !== undefined) updates.reachMultiplier = reachMultiplier;
  if (visibilityPenalty !== undefined) updates.visibilityPenalty = Math.max(0, Math.min(1, Number(visibilityPenalty)));
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({ id: usersTable.id, username: usersTable.username, reachMultiplier: usersTable.reachMultiplier, visibilityPenalty: usersTable.visibilityPenalty });
  if (!updated) return res.status(404).json({ error: "User not found" });
  await auditLog(req.currentUser.id, "reach_restricted", "user", id, JSON.stringify({ reachMultiplier, visibilityPenalty }));
  return res.json(updated);
});

router.get("/settings", async (req, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) settings[row.key] = row.value;
  return res.json(settings);
});

router.patch("/settings", requireSuperAdmin, async (req: any, res) => {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    await db.insert(systemSettingsTable).values({ key, value }).onConflictDoUpdate({ target: systemSettingsTable.key, set: { value, updatedAt: new Date() } });
    await auditLog(req.currentUser.id, "setting_changed", "setting", undefined, `${key}=${value}`);
  }
  const rows = await db.select().from(systemSettingsTable);
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) settings[row.key] = row.value;
  return res.json(settings);
});

// ============================================================================
// EXTENDED ADMIN ROUTES - moderation queue, warnings, user details, post flag
// ============================================================================

router.get("/reports/grouped", async (_req, res) => {
  const pending = await db
    .select({
      id: reportsTable.id,
      reason: reportsTable.reason,
      status: reportsTable.status,
      targetType: reportsTable.targetType,
      targetId: reportsTable.targetId,
      category: reportsTable.category,
      priority: reportsTable.priority,
      createdAt: reportsTable.createdAt,
      reporterId: reportsTable.reporterId,
      reporterUsername: usersTable.username,
      reporterDisplayName: usersTable.displayName,
    })
    .from(reportsTable)
    .leftJoin(usersTable, eq(reportsTable.reporterId, usersTable.id))
    .where(eq(reportsTable.status, "pending"))
    .orderBy(desc(reportsTable.createdAt))
    .limit(150);

  const high: typeof pending = [];
  const medium: typeof pending = [];
  const low: typeof pending = [];
  for (const r of pending) {
    const isHigh = r.priority === "high" || r.priority === "urgent" || (typeof r.reason === "string" && r.reason.startsWith("[AI:HIGH]"));
    if (isHigh && high.length < 50) high.push(r);
    else if (r.priority === "normal" && medium.length < 50) medium.push(r);
    else if (low.length < 50) low.push(r);
  }
  return res.json({ high, medium, low });
});

router.post("/users/:id/warn", requirePermission("warn_user"), async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { reason, reportId } = req.body ?? {};
  if (!reason || typeof reason !== "string") return res.status(400).json({ error: "reason is required" });
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)));
  if (!target) return res.status(404).json({ error: "User not found" });
  const [strike] = await db.insert(moderationStrikesTable).values({
    userId: id,
    reportId: reportId ? Number(reportId) : null,
    reason: reason.slice(0, 1000),
    severity: 1,
    issuedBy: req.currentUser.id,
  }).returning();
  await auditLog(req.currentUser.id, "user_warned", "user", id, reason);
  try {
    const { notify } = await import("../features/notifications/notification.service");
    await notify({
      userId: id,
      actorId: req.currentUser.id,
      type: "admin_action",
      message: `You received a warning: ${reason.slice(0, 160)}`,
      digestGroup: `strike:${strike.id}`,
    });
  } catch { /* notification failures must not block warn */ }
  try {
    const { dispatchWebhook } = await import("../features/distribution/webhooks.service");
    void dispatchWebhook({
      userId: id,
      event: "warning.issued",
      data: { strikeId: strike.id, severity: 1, reason: reason.slice(0, 200), reportId: reportId ? Number(reportId) : null },
    });
  } catch { /* best-effort */ }
  return res.status(201).json({ success: true, strike });
});

router.get("/users/:id/detail", requirePermission("view_users"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash, ...userSafe } = user as any;

  const [trustScore] = await db.select().from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, id));
  const reports = await db.select().from(reportsTable)
    .where(or(eq(reportsTable.reporterId, id), and(eq(reportsTable.targetType, "user"), eq(reportsTable.targetId, id))))
    .orderBy(desc(reportsTable.createdAt))
    .limit(50);
  const strikes = await db.select().from(moderationStrikesTable)
    .where(eq(moderationStrikesTable.userId, id))
    .orderBy(desc(moderationStrikesTable.createdAt));
  const recentPosts = await db
    .select({ id: postsTable.id, title: postsTable.title, type: postsTable.type, isPublished: postsTable.isPublished, createdAt: postsTable.createdAt })
    .from(postsTable)
    .where(and(eq(postsTable.authorId, id), eq(postsTable.isDeleted, false)))
    .orderBy(desc(postsTable.createdAt))
    .limit(10);

  return res.json({
    user: userSafe,
    trustScore: trustScore ?? null,
    reports,
    strikes,
    recentPosts,
    loginActivity: [],
  });
});

router.post("/posts/:id/flag", requirePermission("delete_post"), async (req: any, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(postsTable)
    .set({ contentWarning: "flagged_for_review", updatedAt: new Date() })
    .where(and(eq(postsTable.id, id), eq(postsTable.isDeleted, false)))
    .returning({ id: postsTable.id, contentWarning: postsTable.contentWarning });
  if (!updated) return res.status(404).json({ error: "Post not found" });
  await auditLog(req.currentUser.id, "post_flagged", "post", id);
  return res.json({ success: true });
});

// ============================================================================
// FEATURE FLAGS
// ============================================================================

router.get("/settings/features", async (_req, res) => {
  const flags = await getAllFeatureFlags();
  return res.json(flags);
});

router.patch("/settings/features", requireSuperAdmin, async (req: any, res) => {
  const updates = req.body as Partial<Record<FeatureFlagKey, boolean>>;
  const valid = FEATURE_FLAG_KEYS as readonly string[];
  for (const [key, value] of Object.entries(updates)) {
    if (!valid.includes(key)) continue;
    const strVal = value ? "true" : "false";
    await db.insert(systemSettingsTable).values({ key, value: strVal })
      .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: strVal, updatedAt: new Date() } });
    await auditLog(req.currentUser.id, "feature_flag_changed", "setting", undefined, `${key}=${strVal}`);
  }
  await reloadFeatureFlags();
  const flags = await getAllFeatureFlags();
  return res.json(flags);
});

// ============================================================================
// MODERATION RULES
// ============================================================================

router.get("/rules", async (_req, res) => {
  const rules = await db.select().from(moderationRulesTable).orderBy(desc(moderationRulesTable.createdAt));
  return res.json({ rules });
});

router.post("/rules", requireSuperAdmin, async (req: any, res) => {
  const { name, triggerType, thresholdValue, windowMinutes, action } = req.body ?? {};
  if (!name || !triggerType || thresholdValue === undefined || !action) {
    return res.status(400).json({ error: "name, triggerType, thresholdValue, and action are required" });
  }
  const validTriggers = ["post_rate", "trust_threshold", "report_count"];
  const validActions = ["flag_for_review", "reduce_reach", "notify_admin"];
  if (!validTriggers.includes(triggerType)) return res.status(400).json({ error: "Invalid triggerType" });
  if (!validActions.includes(action)) return res.status(400).json({ error: "Invalid action" });
  const [rule] = await db.insert(moderationRulesTable).values({
    name: String(name).slice(0, 200),
    triggerType,
    thresholdValue: Number(thresholdValue),
    windowMinutes: Number(windowMinutes) || 60,
    action,
    isActive: true,
    createdBy: req.currentUser.id,
  }).returning();
  await auditLog(req.currentUser.id, "rule_created", "rule", rule.id, name);
  return res.status(201).json(rule);
});

router.patch("/rules/:id", requireSuperAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { name, thresholdValue, windowMinutes, action, isActive } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name).slice(0, 200);
  if (thresholdValue !== undefined) updates.thresholdValue = Number(thresholdValue);
  if (windowMinutes !== undefined) updates.windowMinutes = Number(windowMinutes);
  if (action !== undefined) updates.action = action;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  const [rule] = await db.update(moderationRulesTable).set(updates).where(eq(moderationRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  await auditLog(req.currentUser.id, "rule_updated", "rule", id);
  return res.json(rule);
});

router.delete("/rules/:id", requireSuperAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const [rule] = await db.update(moderationRulesTable).set({ isActive: false }).where(eq(moderationRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  await auditLog(req.currentUser.id, "rule_deactivated", "rule", id);
  return res.json({ success: true });
});

// ============================================================================
// ADMIN INTERNAL NOTES
// ============================================================================

router.get("/notes/:targetType/:targetId", async (req, res) => {
  const targetType = String(req.params.targetType);
  const targetId = parseInt(req.params.targetId);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid targetId" });
  const notes = await db
    .select({
      id: adminNotesTable.id,
      adminId: adminNotesTable.adminId,
      targetType: adminNotesTable.targetType,
      targetId: adminNotesTable.targetId,
      note: adminNotesTable.note,
      createdAt: adminNotesTable.createdAt,
      adminUsername: usersTable.username,
      adminDisplayName: usersTable.displayName,
    })
    .from(adminNotesTable)
    .leftJoin(usersTable, eq(adminNotesTable.adminId, usersTable.id))
    .where(and(eq(adminNotesTable.targetType, targetType), eq(adminNotesTable.targetId, targetId)))
    .orderBy(desc(adminNotesTable.createdAt))
    .limit(100);
  return res.json({ notes });
});

router.post("/notes", async (req: any, res) => {
  const { targetType, targetId, note } = req.body ?? {};
  if (!targetType || !targetId || !note) return res.status(400).json({ error: "targetType, targetId, and note are required" });
  const [created] = await db.insert(adminNotesTable).values({
    adminId: req.currentUser.id,
    targetType: String(targetType),
    targetId: Number(targetId),
    note: String(note).slice(0, 4000),
  }).returning();
  await auditLog(req.currentUser.id, "note_added", String(targetType), Number(targetId), String(note).slice(0, 200));
  return res.status(201).json(created);
});

router.delete("/notes/:id", async (req: any, res) => {
  const id = parseInt(req.params.id);
  const [note] = await db.select().from(adminNotesTable).where(eq(adminNotesTable.id, id));
  if (!note) return res.status(404).json({ error: "Note not found" });
  if (note.adminId !== req.currentUser.id && req.currentUser.role !== "super_admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  await db.delete(adminNotesTable).where(eq(adminNotesTable.id, id));
  await auditLog(req.currentUser.id, "note_deleted", note.targetType, note.targetId);
  return res.json({ success: true });
});

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

router.get("/health", async (_req, res) => {
  let database: "ok" | "error" = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    database = "error";
  }
  let redis: "ok" | "error" | "not_configured" = "not_configured";
  try {
    const { getRedis } = await import("../lib/redis");
    const client = getRedis();
    if (client) {
      await (client as any).ping();
      redis = "ok";
    }
  } catch {
    redis = "error";
  }
  let queue: { active: number; waiting: number; failed: number } | null = null;
  try {
    const { getQueue } = await import("../lib/queue/queue");
    const q = getQueue();
    if (q) {
      const counts = await q.getJobCounts("active", "waiting", "failed");
      queue = { active: counts.active ?? 0, waiting: counts.waiting ?? 0, failed: counts.failed ?? 0 };
    }
  } catch {
    queue = null;
  }
  return res.json({
    database,
    redis,
    queue,
    uptime: Math.round(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

// ── Read-only insight panels ──────────────────────────────────────────────
// All four endpoints support pagination via ?limit=&offset= (limit clamped 1-100).

function parsePaging(req: { query: Record<string, unknown> }) {
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
  return { limit, offset };
}

router.get("/behavior-events", async (req, res) => {
  const { limit, offset } = parsePaging(req);
  const [{ count: total } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(behaviorEventsTable);
  const rows = await db
    .select({
      id: behaviorEventsTable.id,
      userId: behaviorEventsTable.userId,
      eventType: behaviorEventsTable.eventType,
      severity: behaviorEventsTable.severity,
      details: behaviorEventsTable.details,
      createdAt: behaviorEventsTable.createdAt,
      username: usersTable.username,
      displayName: usersTable.displayName,
    })
    .from(behaviorEventsTable)
    .leftJoin(usersTable, eq(usersTable.id, behaviorEventsTable.userId))
    .orderBy(desc(behaviorEventsTable.createdAt))
    .limit(limit)
    .offset(offset);
  return res.json({ rows, total, limit, offset });
});

router.get("/reputation-events", async (req, res) => {
  const { limit, offset } = parsePaging(req);
  const [{ count: total } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reputationEventsTable);
  const rows = await db
    .select({
      id: reputationEventsTable.id,
      userId: reputationEventsTable.userId,
      type: reputationEventsTable.type,
      scoreChange: reputationEventsTable.scoreChange,
      reason: reputationEventsTable.reason,
      createdAt: reputationEventsTable.createdAt,
      username: usersTable.username,
      displayName: usersTable.displayName,
    })
    .from(reputationEventsTable)
    .leftJoin(usersTable, eq(usersTable.id, reputationEventsTable.userId))
    .orderBy(desc(reputationEventsTable.createdAt))
    .limit(limit)
    .offset(offset);
  return res.json({ rows, total, limit, offset });
});

router.get("/blocked-emails", async (req, res) => {
  const { limit, offset } = parsePaging(req);
  const [{ count: total } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(blockedEmailAttemptsTable);
  const rows = await db
    .select()
    .from(blockedEmailAttemptsTable)
    .orderBy(desc(blockedEmailAttemptsTable.createdAt))
    .limit(limit)
    .offset(offset);
  return res.json({ rows, total, limit, offset });
});

router.get("/country-stats", requireSuperAdmin, async (_req, res) => {
  const rows = await db
    .select({
      country: sql<string>`coalesce(nullif(trim(${usersTable.lastKnownCountry}), ''), 'Unknown')`,
      count: sql<number>`count(*)::int`,
    })
    .from(usersTable)
    .where(eq(usersTable.isDeleted, false))
    .groupBy(sql`coalesce(nullif(trim(${usersTable.lastKnownCountry}), ''), 'Unknown')`)
    .orderBy(desc(sql`count(*)`))
    .limit(100);

  const total = rows.reduce((s, r) => s + r.count, 0);
  const stats = rows.map(r => ({
    country: r.country,
    count: r.count,
    pct: total > 0 ? Number(((r.count / total) * 100).toFixed(1)) : 0,
  }));
  return res.json({ stats, total });
});

router.get("/translation-cache", async (req, res) => {
  const { limit, offset } = parsePaging(req);
  const [{ count: total } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(translationCacheTable);
  const rows = await db
    .select({
      id: translationCacheTable.id,
      originalHash: translationCacheTable.originalHash,
      sourceLang: translationCacheTable.sourceLang,
      targetLang: translationCacheTable.targetLang,
      hitCount: translationCacheTable.hitCount,
      createdAt: translationCacheTable.createdAt,
      updatedAt: translationCacheTable.updatedAt,
      preview: sql<string>`substring(${translationCacheTable.translatedText} from 1 for 120)`,
    })
    .from(translationCacheTable)
    .orderBy(desc(translationCacheTable.hitCount))
    .limit(limit)
    .offset(offset);
  return res.json({ rows, total, limit, offset });
});

router.delete("/translation-cache", requireSuperAdmin, async (req: any, res) => {
  const id = req.query.id ? Number(req.query.id) : null;
  if (id) {
    await db.delete(translationCacheTable).where(eq(translationCacheTable.id, id));
    await auditLog(req.user.id, "translation_cache_invalidate", "translation_cache", id);
    return res.json({ ok: true, deleted: 1 });
  }
  // Full flush
  const before = await db.select({ count: sql<number>`count(*)::int` }).from(translationCacheTable);
  await db.delete(translationCacheTable);
  await auditLog(req.user.id, "translation_cache_flush_all", "translation_cache");
  return res.json({ ok: true, deleted: before[0]?.count ?? 0 });
});

router.post("/users/:id/official", async (req: any, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user id" });
  const { isOfficialAccount } = req.body;
  if (typeof isOfficialAccount !== "boolean") return res.status(400).json({ error: "isOfficialAccount must be boolean" });
  await db.update(usersTable).set({ isOfficialAccount } as any).where(eq(usersTable.id, userId));
  await auditLog(req.user.id, isOfficialAccount ? "grant_official" : "revoke_official", "user", userId);
  return res.json({ ok: true });
});

// ============================================================================
// SCHEDULED POSTS
// ============================================================================

router.get("/scheduled-posts", requireAdmin, async (_req, res) => {
  try {
    const { postsTable, usersTable: ut } = await import("@workspace/db/schema");
    const { and, eq, isNotNull, asc } = await import("drizzle-orm");
    const { db } = await import("@workspace/db");

    const scheduled = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        type: postsTable.type,
        scheduledAt: postsTable.scheduledAt,
        createdAt: postsTable.createdAt,
        authorDisplayName: ut.displayName,
        authorUsername: ut.username,
      })
      .from(postsTable)
      .leftJoin(ut, eq(postsTable.authorId, ut.id))
      .where(and(
        eq(postsTable.isPublished, false),
        eq(postsTable.isDeleted, false),
        isNotNull(postsTable.scheduledAt)
      ))
      .orderBy(asc(postsTable.scheduledAt))
      .limit(50);

    return res.json({ scheduled });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch scheduled posts" });
  }
});

router.patch("/scheduled-posts/:id/publish", requireSuperAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const { postsTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@workspace/db");

    await db.update(postsTable)
      .set({ isPublished: true, scheduledAt: null, updatedAt: new Date() })
      .where(eq(postsTable.id, id));

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to publish post" });
  }
});

export default router;
