import { db } from "@workspace/db";
import { postsTable, usersTable, boostRequestsTable, jobsTable } from "@workspace/db/schema";
import { and, eq, lte, isNotNull, lt, isNull, or, inArray, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { runScheduledJob } from "./scheduledJobRunner";
import { addJob } from "../../lib/queue/queue";
import { expireHighlights } from "../highlights/highlights.routes";
import { SPARK_LIFETIME_MS } from "../posts/postExpiry";
import { getWeeklyDigestIntervalMs } from "../email/emailSendGuard";
import { DEFAULT_OPPORTUNITY_LIFETIME_MS } from "../creator-economy/opportunityWorkflow";

export async function publishDuePosts(): Promise<void> {
  try {
    const now = new Date();
    const duePosts = await db
      .select({ id: postsTable.id, type: postsTable.type })
      .from(postsTable)
      .where(and(eq(postsTable.isPublished, false), eq(postsTable.isDeleted, false), isNotNull(postsTable.scheduledAt), lte(postsTable.scheduledAt, now)));

    if (duePosts.length === 0) return;

    for (const post of duePosts) {
      const queued = await addJob("publish_scheduled_post", { postId: post.id });
      if (!queued) {
        const updates = {
          isPublished: true,
          scheduledAt: null,
          updatedAt: new Date(),
          ...(post.type === "spark" ? { expiresAt: new Date(Date.now() + SPARK_LIFETIME_MS) } : {}),
        };
        await db.update(postsTable).set(updates).where(eq(postsTable.id, post.id));
        logger.info({ postId: post.id }, "Scheduled post published directly (no queue)");
      }
    }
    if (duePosts.length > 0) logger.info({ count: duePosts.length }, "Triggered scheduled post publication");
  } catch (err) {
    logger.warn({ err }, "publishDuePosts attempt failed");
    throw err;
  }
}

export async function expireBoostCampaigns(): Promise<void> {
  try {
    const now = new Date();
    const expired = await db
      .select({
        id: boostRequestsTable.id,
        userId: boostRequestsTable.userId,
        postId: boostRequestsTable.postId,
        plan: boostRequestsTable.plan,
      })
      .from(boostRequestsTable)
      .where(and(
        eq(boostRequestsTable.status, "approved"),
        lt(boostRequestsTable.boostEndsAt, now),
      ))
      .limit(100);

    if (expired.length === 0) return;

    const { inArray } = await import("drizzle-orm");
    await db.update(boostRequestsTable)
      .set({ status: "expired" } as Record<string, unknown>)
      .where(inArray(boostRequestsTable.id, expired.map(r => r.id)));

    logger.info({ count: expired.length }, "Boost campaigns expired");

    // Notify each member and prompt them to boost again
    const { notify } = await import("../notifications/notification.service");
    for (const campaign of expired) {
      try {
        const [post] = await db
          .select({ title: postsTable.title })
          .from(postsTable)
          .where(eq(postsTable.id, campaign.postId ?? 0));

        await notify({
          userId: campaign.userId,
          type: "system",
          title: "Your boost campaign has ended",
          message: `Your campaign for "${post?.title ?? "your post"}" has expired. Boost again to keep the momentum going.`,
          url: `/promotions?highlight=${campaign.id}`,
          postId: campaign.postId ?? null,
        });
      } catch (notifyErr) {
        logger.error({ err: notifyErr, campaignId: campaign.id }, "Failed to send boost-expired notification");
      }
    }
  } catch (err) {
    logger.warn({ err }, "expireBoostCampaigns attempt failed");
    throw err;
  }
}

export async function expireOpportunities(): Promise<void> {
  try {
    const now = new Date();
    const legacyExpiryCutoff = new Date(now.getTime() - DEFAULT_OPPORTUNITY_LIFETIME_MS);
    const expired = await db.update(jobsTable)
      .set({ isActive: false })
      .where(and(
        eq(jobsTable.isActive, true),
        or(
          and(isNotNull(jobsTable.expiresAt), lte(jobsTable.expiresAt, now)),
          and(isNull(jobsTable.expiresAt), lte(jobsTable.createdAt, legacyExpiryCutoff)),
        ),
      ))
      .returning({ id: jobsTable.id });
    if (expired.length > 0) {
      logger.info({ count: expired.length }, "Expired opportunities closed");
    }
  } catch (err) {
    logger.warn({ err }, "expireOpportunities attempt failed");
    throw err;
  }
}

export async function expireOldSparks(): Promise<void> {
  try {
    const { postsTable } = await import("@workspace/db/schema");
    const { and, eq, lt } = await import("drizzle-orm");
    const now = new Date();
    const result = await db
      .update(postsTable)
      .set({ isDeleted: true, deletedAt: now })
      .where(and(
        eq(postsTable.type, "spark"),
        eq(postsTable.isDeleted, false),
        lt(postsTable.expiresAt, now),
      ));
    logger.info({ count: result.rowCount ?? 0 }, "Expired sparks soft-deleted");
  } catch (err) {
    logger.warn({ err }, "expireOldSparks attempt failed");
    throw err;
  }
}

export async function sendBirthdayNotifications(now = new Date()): Promise<void> {
  try {
    const monthDays = [-1, 0, 1].map((offset) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(5, 10);
    });
    const celebrants = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        username: usersTable.username,
        dateOfBirth: usersTable.dateOfBirth,
        timezone: usersTable.lastKnownTimezone,
      })
      .from(usersTable)
      .where(and(
        eq(usersTable.isDeleted, false),
        eq(usersTable.isBanned, false),
        isNotNull(usersTable.dateOfBirth),
        inArray(sql<string>`to_char(${usersTable.dateOfBirth}, 'MM-DD')`, monthDays),
      ));

    const dateParts = (date: Date, timezone: string) => {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      return Object.fromEntries(parts.map((part) => [part.type, part.value]));
    };

    for (const celebrant of celebrants) {
      if (!celebrant.dateOfBirth) continue;
      let localDate: Record<string, string>;
      try {
        localDate = dateParts(now, celebrant.timezone || "UTC");
      } catch (err) {
        logger.warn({ err, userId: celebrant.id, timezone: celebrant.timezone }, "Invalid timezone for birthday notification; using UTC");
        localDate = dateParts(now, "UTC");
      }
      if (`${localDate.month}-${localDate.day}` !== celebrant.dateOfBirth.slice(5, 10)) continue;

      const name = celebrant.displayName || celebrant.username;
      const year = localDate.year;
      await notifyBirthday(celebrant.id, name, year);
    }
    logger.info({ count: celebrants.length }, "Birthday notifications processed");
  } catch (err) {
    logger.warn({ err }, "sendBirthdayNotifications attempt failed");
    throw err;
  }
}

async function notifyBirthday(userId: number, name: string, year: string): Promise<void> {
  const { notifyStrict } = await import("../notifications/notification.service");
  await notifyStrict({
    userId,
    actorId: 0,
    type: "birthday",
    title: `Happy birthday, ${name}!`,
    message: `Happy birthday, ${name}!`,
    url: "/notifications",
    digestGroup: `birthday:${year}`,
  });
}

export async function sendWeeklyDigests(): Promise<void> {
  try {
    const cooldownMs = (await import("../email/emailSendGuard")).getWeeklyDigestIntervalMs();
    const cutoff = new Date(Date.now() - cooldownMs);
    const users = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.emailDigestEnabled, true),
        eq(usersTable.isDeleted, false),
        eq(usersTable.isBanned, false),
        or(isNull(usersTable.lastWeeklyDigestAt), lt(usersTable.lastWeeklyDigestAt, cutoff)),
      ));

    for (const user of users) {
      await addJob("send_digest_email", { userId: user.id });
    }
    logger.info({ count: users.length }, "Weekly digest jobs queued");
  } catch (err) {
    logger.warn({ err }, "sendWeeklyDigests attempt failed");
    throw err;
  }
}

let schedulingTimer: ReturnType<typeof setInterval> | null = null;
let digestTimer: ReturnType<typeof setInterval> | null = null;
let highlightTimer: ReturnType<typeof setInterval> | null = null;
let draftReminderTimer: ReturnType<typeof setInterval> | null = null;
let lastDraftReminder = 0;
let lastStreakNudge = 0;
let lastAffinityUpdate = 0;
let lastWeeklyDigest = 0;
let lastDormantNudge = 0;
let lastChallengeReminder = 0;
let lastProfileViewNotif = 0;
let lastSparkExpiry = 0;
let lastBirthdayRunHour = -1;

async function sendDraftReminders(): Promise<void> {
  try {
    const { notificationsTable: notifs } = await import("@workspace/db/schema");
    const { and: _and, eq: _eq, lt: _lt, gt: _gt, isNull: _isNull } = await import("drizzle-orm");
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const cutoff14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const staleDrafts = await db
      .select({ id: postsTable.id, title: postsTable.title, authorId: postsTable.authorId, updatedAt: postsTable.updatedAt })
      .from(postsTable)
      .where(_and(
        _eq(postsTable.isPublished, false),
        _eq(postsTable.isDeleted, false),
        _isNull(postsTable.scheduledAt),
        _lt(postsTable.updatedAt, cutoff48h),
        _gt(postsTable.updatedAt, cutoff14d),
      ))
      .limit(100);

    for (const draft of staleDrafts) {
      if (!draft.authorId) continue;
      const existing = await db
        .select({ id: notifs.id })
        .from(notifs)
        .where(_and(_eq(notifs.userId, draft.authorId), _eq(notifs.type, "draft_reminder"), _eq(notifs.postId, draft.id)))
        .limit(1);
      if (existing.length > 0) continue;
      const label = draft.title ? `"${draft.title.slice(0, 50)}"` : "A draft in progress";
      await db.insert(notifs).values({
        userId: draft.authorId,
        actorId: draft.authorId,
        type: "draft_reminder",
        postId: draft.id,
        message: `✍️ ${label} is waiting for you. Pick up where you left off when you're ready to share it.`,
        category: "growth",
      });
    }
    logger.info({ count: staleDrafts.length }, "Draft reminders processed");
  } catch (err) {
    logger.warn({ err }, "sendDraftReminders attempt failed");
    throw err;
  }
}

async function sendStreakMilestoneNudges(): Promise<void> {
  try {
    const { notificationsTable: notifs, writingStreaksTable: streaks } = await import("@workspace/db/schema");
    const { and: _and, eq: _eq, inArray: _inArray } = await import("drizzle-orm");

    const MILESTONES = [3, 7, 14, 30, 60, 100, 365];
    const milestoneTodayStreaks = await db
      .select({ userId: streaks.userId, currentStreak: streaks.currentStreak })
      .from(streaks)
      .limit(500);

    for (const row of milestoneTodayStreaks) {
      const streak = Number(row.currentStreak ?? 0);
      if (!MILESTONES.includes(streak)) continue;
      const existing = await db
        .select({ id: notifs.id })
        .from(notifs)
        .where(_and(
          _eq(notifs.userId, row.userId),
          _eq(notifs.type, "streak_milestone"),
          _eq(notifs.message, `🔥 ${streak}-day streak!`),
        ))
        .limit(1);
      if (existing.length > 0) continue;
      const emoji = streak >= 100 ? '🏆' : streak >= 30 ? '💎' : streak >= 14 ? '🌟' : streak >= 7 ? '🔥' : '⚡';
      const msg = `${emoji} ${streak}-day streak! You're on fire - keep the momentum going.`;
      await db.insert(notifs).values({
        userId: row.userId,
        actorId: row.userId,
        type: "streak_milestone",
        message: msg,
        category: "growth",
      });
    }
    logger.info("Streak milestone nudges processed");
  } catch (err) {
    logger.warn({ err }, "sendStreakMilestoneNudges attempt failed");
    throw err;
  }
}

async function updateUserTopicAffinity(): Promise<void> {
  const { db: _db } = await import("@workspace/db");
  const { userTopicAffinityTable, readingProgressTable } = await import("@workspace/db/schema");
  const { gte, sql: _sql } = await import("drizzle-orm");

  const LOOKBACK_DAYS = 30;
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const activeUserRows = await _db
    .selectDistinct({ userId: readingProgressTable.userId })
    .from(readingProgressTable)
    .where(gte(readingProgressTable.lastReadAt, cutoff));

  const activeUserIds = activeUserRows.map(r => r.userId).filter(Boolean) as number[];
  if (activeUserIds.length === 0) return;

  const BATCH_SIZE = 100;
  for (let i = 0; i < activeUserIds.length; i += BATCH_SIZE) {
    const batch = activeUserIds.slice(i, i + BATCH_SIZE);

    const affinityData = await _db.execute(_sql`
      WITH user_topic_reads AS (
        SELECT
          rp.user_id,
          pt.topic_id,
          COUNT(*) as view_count,
          SUM(rp.percent) / 100.0 as read_depth_total
        FROM reading_progress rp
        JOIN posts p ON p.id = rp.post_id
        JOIN post_topics pt ON pt.post_id = p.id
        WHERE rp.user_id = ANY(${batch})
          AND rp.last_read_at >= ${cutoff}
        GROUP BY rp.user_id, pt.topic_id
      ),
      user_topic_likes AS (
        SELECT
          a.user_id,
          pt.topic_id,
          COUNT(*) as like_count
        FROM appreciations a
        JOIN post_topics pt ON pt.post_id = a.post_id
        WHERE a.user_id = ANY(${batch})
          AND a.created_at >= ${cutoff}
        GROUP BY a.user_id, pt.topic_id
      ),
      user_topic_comments AS (
        SELECT
          c.author_id as user_id,
          pt.topic_id,
          COUNT(*) as comment_count
        FROM comments c
        JOIN post_topics pt ON pt.post_id = c.post_id
        WHERE c.author_id = ANY(${batch})
          AND c.created_at >= ${cutoff}
        GROUP BY c.author_id, pt.topic_id
      )
      SELECT
        COALESCE(r.user_id, l.user_id, cm.user_id) as user_id,
        COALESCE(r.topic_id, l.topic_id, cm.topic_id) as topic_id,
        COALESCE(r.view_count, 0) as view_count,
        COALESCE(r.read_depth_total, 0) as read_depth_total,
        COALESCE(l.like_count, 0) as like_count,
        COALESCE(cm.comment_count, 0) as comment_count,
        (
          COALESCE(r.read_depth_total, 0) / GREATEST(COALESCE(r.view_count, 1), 1) * 0.5 +
          COALESCE(l.like_count, 0) * 0.3 +
          COALESCE(cm.comment_count, 0) * 0.2
        ) as affinity_score
      FROM user_topic_reads r
      FULL OUTER JOIN user_topic_likes l
        ON r.user_id = l.user_id AND r.topic_id = l.topic_id
      FULL OUTER JOIN user_topic_comments cm
        ON COALESCE(r.user_id, l.user_id) = cm.user_id
        AND COALESCE(r.topic_id, l.topic_id) = cm.topic_id
      WHERE COALESCE(r.user_id, l.user_id, cm.user_id) IS NOT NULL
    `);

    interface AffinityRow {
      user_id: number;
      topic_id: number;
      view_count: number;
      read_depth_total: number;
      like_count: number;
      comment_count: number;
      affinity_score: number;
    }
    const rows = affinityData.rows as unknown as AffinityRow[];

    for (const row of rows) {
      if (!row.user_id || !row.topic_id) continue;
      await _db.insert(userTopicAffinityTable)
        .values({
          userId: Number(row.user_id),
          topicId: Number(row.topic_id),
          affinityScore: Number(row.affinity_score),
          viewCount: Number(row.view_count),
          readDepthTotal: Number(row.read_depth_total),
          likeCount: Number(row.like_count),
          commentCount: Number(row.comment_count),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userTopicAffinityTable.userId, userTopicAffinityTable.topicId],
          set: {
            affinityScore: _sql`excluded.affinity_score`,
            viewCount: _sql`excluded.view_count`,
            readDepthTotal: _sql`excluded.read_depth_total`,
            likeCount: _sql`excluded.like_count`,
            commentCount: _sql`excluded.comment_count`,
            updatedAt: _sql`excluded.updated_at`,
          },
        });
    }
  }

  logger.info({ activeUsers: activeUserIds.length }, "userTopicAffinity backfill complete");
}

async function sendWeeklyCreatorDigests(): Promise<void> {
  const { db: _db } = await import("@workspace/db");
  const { usersTable } = await import("@workspace/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getPublicAppUrl, getEmailUnsubscribeUrl, sendEmail } = await import("../email/email.service");
  const { weeklyCreatorDigestEmailHtml } = await import("../email/email.templates");
  const { getWeeklyDigestIntervalMs, sendEmailOncePerPeriod } = await import("../email/emailSendGuard");
  const { getWeeklyReport } = await import("../analytics/topicAnalytics.service");

  const creators = await _db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      username: usersTable.username,
      emailDigestEnabled: usersTable.emailDigestEnabled,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.emailVerified, true),
        eq(usersTable.emailDigestEnabled, true),
        eq(usersTable.isDeleted, false),
      )
    )
    .limit(500);

  const appUrl = getPublicAppUrl();
  const cooldownMs = getWeeklyDigestIntervalMs();
  const cutoff = new Date(Date.now() - cooldownMs);
  let sent = 0;

  for (const creator of creators) {
    try {
      if (!creator.emailDigestEnabled) continue;
      const [eligible] = await _db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(
          eq(usersTable.id, creator.id),
          or(isNull(usersTable.lastWeeklyDigestAt), lt(usersTable.lastWeeklyDigestAt, cutoff)),
        ));
      if (!eligible) continue;

      const report = await getWeeklyReport(creator.id);
      if (report.totalViews === 0 && report.newFollowers === 0) continue;

      const unsubscribeUrl = getEmailUnsubscribeUrl(creator.id);
      const text = [
        `Hi ${creator.displayName},`,
        "",
        "Here is your QuillHive creator recap for the week:",
        "",
        "THIS WEEK'S HIGHLIGHTS",
        `Post views: ${report.totalViews.toLocaleString()}`,
        `New followers: ${report.newFollowers.toLocaleString()}`,
        `Posts published: ${report.postsPublished.toLocaleString()}`,
        ...(report.topPost ? [
          "",
          "YOUR STANDOUT POST",
          `"${report.topPost.title || "Untitled"}" — ${report.topPost.views || 0} views`,
        ] : []),
        "",
        `View your creator dashboard: ${appUrl}/dashboard`,
        `Manage email settings: ${appUrl}/settings`,
        `Unsubscribe: ${unsubscribeUrl}`,
        "",
        "Keep sharing your voice; your hive is growing.",
        "The QuillHive team",
      ].join("\n");

      const didSend = await sendEmailOncePerPeriod(creator.id, "weeklyDigest", cooldownMs, async () => {
        const result = await sendEmail({
          to: creator.email,
          subject: "Your weekly QuillHive creator recap",
          text,
          html: weeklyCreatorDigestEmailHtml({
            displayName: creator.displayName,
            totalViews: report.totalViews,
            newFollowers: report.newFollowers,
            postsPublished: report.postsPublished,
            topPost: report.topPost,
            appUrl,
            unsubscribeUrl,
          }),
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (!result.ok) throw new Error(result.error || "Weekly creator digest delivery failed.");
      });
      if (didSend) sent += 1;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      logger.error({ err, userId: creator.id, name: "sendWeeklyCreatorDigests" }, "Weekly creator digest failed for user");
    }
  }

  logger.info({ selected: creators.length, sent }, "weekly creator digest complete");
}

async function sendNurtureEmails(): Promise<void> {
  const { db: _db } = await import("@workspace/db");
  const { usersTable, postsTable } = await import("@workspace/db/schema");
  const { sql: _sql, eq, and, count } = await import("drizzle-orm");
  const { sendEmail } = await import("../email/email.service");
  const { day3NurtureHtml, day7NurtureHtml } = await import("../email/email.templates");
  const { getEmailUnsubscribeUrl } = await import("../email/email.service");
  const { sendEmailOncePerPeriod } = await import("../email/emailSendGuard");

  const appUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
  let sent = 0;

  // Day 3 nurture - created 3 days ago (±30 min window)
  const day3Users = await _db.execute(_sql`
    SELECT id, email, display_name as "displayName", username
    FROM users
    WHERE email_verified = true
      AND email_digest_enabled = true
      AND is_deleted = false
      AND day3_nurture_sent_at IS NULL
      AND created_at BETWEEN NOW() - INTERVAL '3 days 30 minutes' AND NOW() - INTERVAL '2 days 23 hours 30 minutes'
    LIMIT 200
  `);

  for (const u of day3Users.rows as Array<{ id: number; email: string; displayName: string; username: string }>) {
    try {
      const unsubscribeUrl = getEmailUnsubscribeUrl(u.id);
      const didSend = await sendEmailOncePerPeriod(u.id, "day3Nurture", null, async () => {
        const result = await sendEmail({
          to: u.email,
          subject: "Your first week on QuillHive: a day 3 check-in",
          html: day3NurtureHtml({ displayName: u.displayName, username: u.username, appUrl, unsubscribeUrl }),
          text: `Hi ${u.displayName},\n\nIt's been 3 days since you joined QuillHive. Sharing your first post is a great way to start building connections.\n\nWrite a post: ${appUrl}/write\nManage email settings: ${appUrl}/settings\nUnsubscribe: ${unsubscribeUrl}\n\nKeep sharing your voice,\nThe QuillHive team`,
        });
        if (!result.ok) throw new Error(result.error || "Day 3 nurture email delivery failed.");
      });
      if (didSend) sent += 1;
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      logger.error({ err, userId: u.id, name: "sendNurtureEmails" }, "Day 3 nurture email failed for user");
    }
  }

  // Day 7 nurture - created 7 days ago (±30 min window)
  const day7Users = await _db.execute(_sql`
    SELECT u.id, u.email, u.display_name as "displayName", u.username,
           (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.is_published = true) as post_count,
           (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) as follower_count
    FROM users u
    WHERE u.email_verified = true
      AND u.email_digest_enabled = true
      AND u.is_deleted = false
      AND u.day7_nurture_sent_at IS NULL
      AND u.created_at BETWEEN NOW() - INTERVAL '7 days 30 minutes' AND NOW() - INTERVAL '6 days 23 hours 30 minutes'
    LIMIT 200
  `);

  for (const u of day7Users.rows as Array<{ id: number; email: string; displayName: string; username: string; post_count: string; follower_count: string }>) {
    try {
      const unsubscribeUrl = getEmailUnsubscribeUrl(u.id);
      const didSend = await sendEmailOncePerPeriod(u.id, "day7Nurture", null, async () => {
        const result = await sendEmail({
          to: u.email,
          subject: "Your first week on QuillHive: your progress",
          html: day7NurtureHtml({
            displayName: u.displayName,
            postCount: parseInt(u.post_count, 10) || 0,
            followerCount: parseInt(u.follower_count, 10) || 0,
            appUrl,
            unsubscribeUrl,
          }),
          text: `Your first week on QuillHive\n\nYou've published ${u.post_count} posts and earned ${u.follower_count} followers. Keep building your momentum: ${appUrl}/dashboard\n\nManage email settings: ${appUrl}/settings\nUnsubscribe: ${unsubscribeUrl}\n\nKeep sharing your voice,\nThe QuillHive team`,
        });
        if (!result.ok) throw new Error(result.error || "Day 7 nurture email delivery failed.");
      });
      if (didSend) sent += 1;
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      logger.error({ err, userId: u.id, name: "sendNurtureEmails" }, "Day 7 nurture email failed for user");
    }
  }

  logger.info({ day3: day3Users.rows.length, day7: day7Users.rows.length, sent }, "nurture email job complete");
}

async function notifyDormantUsers(): Promise<void> {
  const { db: _db } = await import("@workspace/db");
  const { notificationsTable } = await import("@workspace/db/schema");
  const { sql: _sql } = await import("drizzle-orm");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const dormantUsers = await _db.execute(_sql`
    SELECT DISTINCT u.id, u.email, u.display_name, u.username
    FROM users u
    WHERE u.is_deleted = false
      AND u.email_verified = true
      AND EXISTS (
        SELECT 1 FROM posts p
        WHERE p.author_id = u.id
          AND p.is_published = true
          AND p.created_at < ${sevenDaysAgo}
          AND p.created_at > ${thirtyDaysAgo}
      )
      AND NOT EXISTS (
        SELECT 1 FROM posts p2
        WHERE p2.author_id = u.id
          AND p2.is_published = true
          AND p2.created_at > ${sevenDaysAgo}
      )
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = u.id
          AND n.type = 'dormant_nudge'
          AND n.created_at > ${fourteenDaysAgo}
      )
    LIMIT 50
  `);

  interface DormantUser { id: number; email: string; display_name: string; username: string }
  const users = dormantUsers.rows as unknown as DormantUser[];

  for (const user of users) {
    await _db.insert(notificationsTable).values({
      userId: user.id,
      actorId: user.id,
      type: "dormant_nudge",
      message: `✍️ Your audience misses you, ${user.display_name}! Share what you've been creating lately.`,
      category: "growth",
    });
  }

  if (users.length > 0) {
    logger.info({ count: users.length }, "dormant nudges sent");
  }
}

async function sendOpportunityNotifications(): Promise<void> {
  try {
    const { db: _db } = await import("@workspace/db");
    const { notificationsTable } = await import("@workspace/db/schema");
    const { sql: _sql } = await import("drizzle-orm");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const creators = await _db.execute<{ id: number; followers_gained: number; post_count: number }>(_sql`
      SELECT id, followers_gained, post_count FROM (
        SELECT
          u.id,
          (SELECT COUNT(*)::int FROM follows f WHERE f.following_id = u.id AND f.created_at > ${sevenDaysAgo}) AS followers_gained,
          (SELECT COUNT(*)::int FROM posts p WHERE p.author_id = u.id AND p.is_published = true AND p.created_at > ${sevenDaysAgo}) AS post_count
        FROM users u
        WHERE u.is_deleted = false AND u.is_banned = false AND u.email_verified = true
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.user_id = u.id AND n.type = 'opportunity_insight' AND n.created_at > ${threeDaysAgo}
          )
      ) sub
      WHERE sub.followers_gained >= 3 OR sub.post_count >= 2
      LIMIT 30
    `);

    for (const creator of creators.rows) {
      const messages: string[] = [];
      if ((creator.followers_gained ?? 0) >= 3) {
        messages.push(`⚡ You gained ${creator.followers_gained} new followers this week - your growth is accelerating!`);
      }
      if ((creator.post_count ?? 0) >= 2) {
        messages.push(`📈 Great posting streak! Your content consistency is building long-term audience trust.`);
      }
      const message = messages[0];
      if (!message) continue;

      await _db.insert(notificationsTable).values({
        userId: creator.id,
        actorId: creator.id,
        type: "opportunity_insight",
        message,
        category: "growth",
      }).catch((err) => {
        logger.error({ err, userId: creator.id, name: "sendOpportunityNotifications" }, "Opportunity notification failed for user");
      });
    }

    if (creators.rows.length > 0) {
      logger.info({ count: creators.rows.length }, "opportunity notifications sent");
    }
  } catch (err) {
    logger.warn({ err }, "sendOpportunityNotifications attempt failed");
    throw err;
  }
}

async function sendProfileViewNotifications(): Promise<void> {
  try {
    const { profileViewsTable } = await import("@workspace/db/schema");
    const { gte, sql: _sql } = await import("drizzle-orm");
    const { notify } = await import("../notifications/notification.service");

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const viewsByUser = await db
      .select({
        profileUserId: profileViewsTable.profileUserId,
        thisWeek: _sql<number>`count(case when viewed_at >= ${weekAgo.toISOString()} then 1 end)::int`,
        lastWeek: _sql<number>`count(case when viewed_at >= ${twoWeeksAgo.toISOString()} and viewed_at < ${weekAgo.toISOString()} then 1 end)::int`,
      })
      .from(profileViewsTable)
      .where(gte(profileViewsTable.viewedAt, twoWeeksAgo))
      .groupBy(profileViewsTable.profileUserId)
      .having(_sql`count(case when viewed_at >= ${weekAgo.toISOString()} then 1 end) > 0`);

    for (const row of viewsByUser) {
      const thisWeek = Number(row.thisWeek);
      if (thisWeek === 0) continue;
      const lastWeek = Number(row.lastWeek);
      const trend = lastWeek > 0
        ? thisWeek > lastWeek
          ? ` - up ${Math.round(((thisWeek - lastWeek) / lastWeek) * 100)}% from last week`
          : lastWeek > thisWeek
            ? ` - down ${Math.round(((lastWeek - thisWeek) / lastWeek) * 100)}% from last week`
            : " - same as last week"
        : "";
      await notify({
        userId: row.profileUserId,
        type: "system",
        title: `Your profile was viewed ${thisWeek} time${thisWeek === 1 ? "" : "s"} this week`,
        message: `${thisWeek} creator${thisWeek === 1 ? "" : "s"} checked out your profile this week${trend}. A complete profile gets 3× more interest.`,
        url: `/profile`,
      }).catch((err) => {
        logger.error({ err, userId: row.profileUserId, name: "sendProfileViewNotifications" }, "Profile view notification failed for user");
      });
    }
    logger.info({ count: viewsByUser.length }, "Profile view notifications sent");
  } catch (err) {
    logger.warn({ err }, "sendProfileViewNotifications attempt failed");
    throw err;
  }
}

async function sendChallengeDeadlineReminders(): Promise<void> {
  try {
    const { challengesTable, challengeSubmissionsTable, usersTable: _usersTable } =
      await import("@workspace/db/schema");
    const { and: _and, eq: _eq, gt: _gt, lt: _lt } = await import("drizzle-orm");
    const { notify } = await import("../notifications/notification.service");

    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const in25h = new Date(Date.now() + 25 * 60 * 60 * 1000);

    // Challenges closing in next 24-25h window
    const closingChallenges = await db
      .select({ id: challengesTable.id, title: challengesTable.title })
      .from(challengesTable)
      .where(_and(
        _eq(challengesTable.isActive, true),
        _gt(challengesTable.endsAt, in24h),
        _lt(challengesTable.endsAt, in25h)
      ));

    for (const challenge of closingChallenges) {
      const submitted = await db
        .select({ userId: challengeSubmissionsTable.userId })
        .from(challengeSubmissionsTable)
        .where(_eq(challengeSubmissionsTable.challengeId, challenge.id));
      const submittedIds = new Set(submitted.map(s => s.userId));

      const eligibleUsers = await db
        .select({ id: _usersTable.id })
        .from(_usersTable)
        .where(_and(_eq(_usersTable.isDeleted, false), _eq(_usersTable.isBanned, false)))
        .limit(500);

      for (const u of eligibleUsers) {
        if (submittedIds.has(u.id)) continue;
        await notify({
          userId: u.id,
          type: "system",
          title: `⏰ Last 24 hours - "${challenge.title}"`,
          message: `The ${challenge.title} challenge closes tomorrow. Submit your entry before it ends.`,
          url: `/challenges/${challenge.id}`,
        });
      }
      logger.info({ challengeId: challenge.id, title: challenge.title }, "Challenge deadline reminders sent");
    }
  } catch (err) {
    logger.warn({ err }, "sendChallengeDeadlineReminders attempt failed");
    throw err;
  }
}

export async function runScheduledModerationRules(): Promise<void> {
  try {
    const flaggedUsers = await db.execute<{ id: number; report_count: number }>(
      `SELECT u.id,
        (SELECT COUNT(*)::int FROM notifications n WHERE n.user_id = u.id AND n.type = 'content_report' AND n.created_at > NOW() - INTERVAL '30 days') AS report_count
       FROM users u
       WHERE u.is_deleted = false AND u.is_banned = false
         AND (SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id AND n.type = 'content_report' AND n.created_at > NOW() - INTERVAL '30 days') >= 3
       LIMIT 100`
    );
    for (const row of (flaggedUsers.rows as Array<{ id: number; report_count: number }>)) {
      const currentScore = row.report_count;
      if (currentScore >= 10) {
        await db
          .update(usersTable)
          .set({ visibilityPenalty: 0.8, updatedAt: new Date() })
          .where(and(eq(usersTable.id, row.id), eq(usersTable.isBanned, false)));
      } else if (currentScore >= 5) {
        await db
          .update(usersTable)
          .set({ visibilityPenalty: 0.5, updatedAt: new Date() })
          .where(and(eq(usersTable.id, row.id), eq(usersTable.isBanned, false)));
      } else if (currentScore >= 3) {
        await db
          .update(usersTable)
          .set({ visibilityPenalty: 0.25, updatedAt: new Date() })
          .where(and(eq(usersTable.id, row.id), eq(usersTable.isBanned, false)));
      }
    }
    if (flaggedUsers.rows.length > 0) {
      logger.info({ count: flaggedUsers.rows.length }, "moderation rules applied");
    }
  } catch (err) {
    logger.warn({ err }, "runScheduledModerationRules attempt failed");
    throw err;
  }
}

function scheduleJob(jobName: string, job: () => Promise<unknown>): void {
  void runScheduledJob(jobName, job).catch(() => {});
}

export function startScheduling(): void {
  if (schedulingTimer) return;
  const weeklyDigestIntervalMs = getWeeklyDigestIntervalMs();
  if (process.env.NODE_ENV === "production" && process.env.API_URL) {
    setInterval(() => {
      fetch(`${process.env.API_URL}/api/healthz`).catch(() => {});
    }, 4 * 60 * 1000);
  }
  schedulingTimer = setInterval(() => {
    scheduleJob("publishDuePosts", publishDuePosts);
    scheduleJob("expireBoostCampaigns", expireBoostCampaigns);
    scheduleJob("expireOpportunities", expireOpportunities);
    const now = Date.now();
    if (now - lastSparkExpiry > 60 * 60 * 1000) {
      lastSparkExpiry = now;
    }
    if (now - lastDraftReminder > 12 * 60 * 60 * 1000) {
      lastDraftReminder = now;
      scheduleJob("sendDraftReminders", sendDraftReminders);
    }
    if (now - lastStreakNudge > 24 * 60 * 60 * 1000) {
      lastStreakNudge = now;
      scheduleJob("sendStreakMilestoneNudges", sendStreakMilestoneNudges);
    }
    if (now - lastAffinityUpdate > 24 * 60 * 60 * 1000) {
      lastAffinityUpdate = now;
      scheduleJob("updateUserTopicAffinity", updateUserTopicAffinity);
    }
    if (now - lastWeeklyDigest > weeklyDigestIntervalMs) {
      lastWeeklyDigest = now;
      scheduleJob("sendWeeklyCreatorDigests", sendWeeklyCreatorDigests);
    }
    if (now - lastDormantNudge > 24 * 60 * 60 * 1000) {
      lastDormantNudge = now;
      scheduleJob("notifyDormantUsers", notifyDormantUsers);
      scheduleJob("sendNurtureEmails", sendNurtureEmails);
      scheduleJob("sendOpportunityNotifications", sendOpportunityNotifications);
      scheduleJob("runScheduledModerationRules", runScheduledModerationRules);
    }
    // Challenge deadline reminders - checked hourly (24-25h window prevents duplicates)
    if (now - lastChallengeReminder > 60 * 60 * 1000) {
      lastChallengeReminder = now;
      scheduleJob("sendChallengeDeadlineReminders", sendChallengeDeadlineReminders);
    }
    // Profile view notifications - weekly (7-day guard)
    if (now - lastProfileViewNotif > 7 * 24 * 60 * 60 * 1000) {
      lastProfileViewNotif = now;
      scheduleJob("sendProfileViewNotifications", sendProfileViewNotifications);
    }
    const birthdayRunHour = Math.floor(now / (60 * 60 * 1000));
    if (birthdayRunHour !== lastBirthdayRunHour) {
      lastBirthdayRunHour = birthdayRunHour;
      scheduleJob("sendBirthdayNotifications", sendBirthdayNotifications);
    }
  }, 60_000);
  scheduleJob("publishDuePosts", publishDuePosts);
  scheduleJob("expireOpportunities", expireOpportunities);

  const WEEK_MS = weeklyDigestIntervalMs;
  digestTimer = setInterval(() => { scheduleJob("sendWeeklyDigests", sendWeeklyDigests); }, WEEK_MS);

  // Highlight cleanup every 5 minutes
  highlightTimer = setInterval(() => { scheduleJob("expireHighlights", async () => { await expireHighlights(); }); }, 5 * 60_000);
  scheduleJob("expireHighlights", async () => { await expireHighlights(); });

  logger.info("Scheduling service started (60s poll, 5m highlights, weekly digest, draft reminders, streak nudges)");
}

export function stopScheduling(): void {
  if (schedulingTimer) { clearInterval(schedulingTimer); schedulingTimer = null; }
  if (digestTimer) { clearInterval(digestTimer); digestTimer = null; }
  if (highlightTimer) { clearInterval(highlightTimer); highlightTimer = null; }
  if (draftReminderTimer) { clearInterval(draftReminderTimer); draftReminderTimer = null; }
}
