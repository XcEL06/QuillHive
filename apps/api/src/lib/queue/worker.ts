import { Worker, type Job } from "bullmq";
import { logger } from "../logger";
import { emitToUser } from "../socket";
import { createBullMQConnection, type JobName, type JobPayloads } from "./queue";
import { SPARK_LIFETIME_MS } from "../../features/posts/postExpiry";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  const name = job.name as JobName;

  switch (name) {
    case "send_notification": {
      const { userId, type, actorId, postId, message, notifId } =
        job.data as JobPayloads["send_notification"];
      try {
        emitToUser(userId, "notification:new", {
          id: notifId,
          type,
          actorId,
          postId,
          message,
          createdAt: new Date().toISOString(),
        });
        logger.info({ userId, type }, "Notification emitted via queue");
      } catch (err) {
        logger.error({ err, userId }, "Failed to emit notification");
        throw err;
      }
      break;
    }

    case "update_trust_score": {
      const { userId } = job.data as JobPayloads["update_trust_score"];
      try {
        const { updateUserTrustScoreSafe } = await import(
          "../../features/trust/trust.service"
        );
        await updateUserTrustScoreSafe(userId);
        logger.info({ userId }, "Trust score updated via queue");
      } catch (err) {
        logger.error({ err, userId }, "Failed to update trust score");
        throw err;
      }
      break;
    }

    case "ai_generate": {
      const { userId, prompt, requestId } =
        job.data as JobPayloads["ai_generate"];
      logger.info({ userId, requestId }, "AI generate job processed");
      break;
    }

    case "process_image": {
      const { userId, imageUrl, type } =
        job.data as JobPayloads["process_image"];
      logger.info({ userId, imageUrl, type }, "Image processing job received");
      break;
    }

    case "publish_scheduled_post": {
      const { postId } = job.data as JobPayloads["publish_scheduled_post"];
      try {
        const { db } = await import("@workspace/db");
        const { postsTable } = await import("@workspace/db/schema");
        const { eq } = await import("drizzle-orm");
        const [post] = await db.select({ type: postsTable.type }).from(postsTable).where(eq(postsTable.id, postId));
        await db.update(postsTable).set({
          isPublished: true,
          scheduledAt: null,
          updatedAt: new Date(),
          ...(post?.type === "spark" ? { expiresAt: new Date(Date.now() + SPARK_LIFETIME_MS) } : {}),
        }).where(eq(postsTable.id, postId));
        logger.info({ postId }, "Scheduled post published");
      } catch (err) {
        logger.error({ err, postId }, "Failed to publish scheduled post");
        throw err;
      }
      break;
    }

    case "send_digest_email": {
      const { userId } = job.data as JobPayloads["send_digest_email"];
      try {
        const { db } = await import("@workspace/db");
        const {
          usersTable, postsTable, followsTable, postViewsTable,
          userTrustScoresTable, writingStreaksTable, notificationsTable,
        } = await import("@workspace/db/schema");
        const { eq, and, gte, gt, sql, desc, count } = await import("drizzle-orm");
        const { getEmailUnsubscribeUrl } = await import("../../features/email/email.service");

        const [user] = await db
          .select({
            id: usersTable.id,
            email: usersTable.email,
            displayName: usersTable.displayName,
            username: usersTable.username,
            emailDigestEnabled: usersTable.emailDigestEnabled,
            isDeleted: usersTable.isDeleted,
            isBanned: usersTable.isBanned,
          })
          .from(usersTable)
          .where(eq(usersTable.id, userId));

        if (!user || !user.emailDigestEnabled || user.isDeleted || user.isBanned) break;

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

        const [
          newFollowers,
          weekViews,
          prevWeekViews,
          topPost,
          streakRow,
          trustRow,
          unreadCount,
        ] = await Promise.all([
          db.select({ n: count() })
            .from(followsTable)
            .where(and(eq(followsTable.followingId, userId), gte(followsTable.createdAt, weekAgo)))
            .then(r => Number(r[0]?.n ?? 0)),

          db.select({ total: sql<number>`COUNT(*)::int` })
            .from(postViewsTable)
            .where(and(
              sql`post_id IN (SELECT id FROM posts WHERE author_id = ${userId})`,
              gte(postViewsTable.createdAt, weekAgo)
            ))
            .then(r => Number(r[0]?.total ?? 0)),

          db.select({ total: sql<number>`COUNT(*)::int` })
            .from(postViewsTable)
            .where(and(
              sql`post_id IN (SELECT id FROM posts WHERE author_id = ${userId})`,
              gte(postViewsTable.createdAt, twoWeeksAgo),
              sql`created_at < ${weekAgo.toISOString()}`
            ))
            .then(r => Number(r[0]?.total ?? 0)),

          db.select({ id: postsTable.id, title: postsTable.title })
            .from(postsTable)
            .where(and(
              eq(postsTable.authorId, userId),
              eq(postsTable.isPublished, true),
              eq(postsTable.isDeleted, false),
              gte(postsTable.createdAt, weekAgo)
            ))
            .orderBy(desc(postsTable.createdAt))
            .limit(1)
            .then(r => r[0] ?? null),

          db.select({ currentStreak: writingStreaksTable.currentStreak })
            .from(writingStreaksTable)
            .where(eq(writingStreaksTable.userId, userId))
            .then(r => r[0] ?? null),

          db.select({ uti: userTrustScoresTable.uti, creatorLevel: userTrustScoresTable.creatorLevel })
            .from(userTrustScoresTable)
            .where(eq(userTrustScoresTable.userId, userId))
            .then(r => r[0] ?? null),

          db.select({ n: count() })
            .from(notificationsTable)
            .where(and(
              eq(notificationsTable.userId, userId),
              eq(notificationsTable.isRead, false),
              gte(notificationsTable.createdAt, weekAgo)
            ))
            .then(r => Number(r[0]?.n ?? 0)),
        ]);

        if (weekViews === 0 && newFollowers === 0 && unreadCount === 0) {
          logger.info({ userId }, "Weekly report skipped - no activity");
          break;
        }

        const viewsChange = prevWeekViews > 0
          ? Math.round(((weekViews - prevWeekViews) / prevWeekViews) * 100)
          : weekViews > 0 ? 100 : 0;
        const viewsTrend = viewsChange > 0 ? `↑ ${viewsChange}% vs last week`
          : viewsChange < 0 ? `↓ ${Math.abs(viewsChange)}% vs last week`
          : "Same as last week";

        const currentStreak = streakRow?.currentStreak ?? 0;
        const creatorLevel = trustRow?.creatorLevel ?? "new_voice";
        const trustScore = Math.round(Number(trustRow?.uti ?? 0));

        let cta = "Keep sharing and building your place in the hive.";
        if (currentStreak === 0) {
          cta = "Share something this week - even one post can start a new streak.";
        } else if (currentStreak >= 7) {
          cta = `You're on a ${currentStreak}-day streak - you're building something real. Don't stop now.`;
        } else if (newFollowers >= 5) {
          cta = `${newFollowers} new people followed you this week. Give them something great to discover.`;
        } else if (weekViews > 0 && topPost) {
          cta = `Your post "${(topPost.title ?? "").slice(0, 40)}" is resonating. Build on that momentum.`;
        }

        const appUrl = process.env.APP_URL ?? "https://quillhive.app";
        const name = user.displayName ?? user.username;
        const unsubscribeUrl = getEmailUnsubscribeUrl(user.id);

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your QuillHive Week - ${name}</title>
<style>
  body{margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .wrapper{max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:#0a0a0a;padding:32px 40px}
  .header h1{color:#fff;font-size:22px;font-weight:700;margin:0 0 4px;letter-spacing:-.02em}
  .header p{color:#737373;font-size:14px;margin:0}
  .body{padding:32px 40px}
  .greeting{font-size:16px;color:#111;margin-bottom:24px;line-height:1.5}
  .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
  .stat-card{background:#f8f8f8;border-radius:12px;padding:16px 20px}
  .stat-number{font-size:28px;font-weight:800;color:#111;letter-spacing:-.03em;line-height:1}
  .stat-label{font-size:12px;color:#737373;margin-top:4px;text-transform:uppercase;letter-spacing:.04em}
  .stat-trend{font-size:11px;color:#8b5cf6;margin-top:2px}
  .section{margin-bottom:24px}
  .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#737373;margin-bottom:12px}
  .top-post{background:#faf8ff;border:1px solid #ede9fe;border-radius:12px;padding:16px 20px}
  .top-post-title{font-size:15px;font-weight:600;color:#111;margin:0 0 4px}
  .streak-bar{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px}
  .cta-section{background:#0a0a0a;border-radius:12px;padding:24px;text-align:center;margin:24px 0}
  .cta-text{color:#d4d4d4;font-size:14px;margin:0 0 16px;line-height:1.6}
  .cta-btn{display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-size:14px;font-weight:700}
  .footer{padding:24px 40px;border-top:1px solid #f0f0f0}
  .footer p{font-size:12px;color:#aaa;margin:0;text-align:center}
  .footer a{color:#8b5cf6;text-decoration:none}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>QuillHive</h1><p>Your weekly community recap</p></div>
  <div class="body">
    <p class="greeting">Hey ${name} - here's what grew around your voice this week.</p>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${weekViews.toLocaleString()}</div>
        <div class="stat-label">Post views</div>
        <div class="stat-trend">${viewsTrend}</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${newFollowers}</div>
        <div class="stat-label">New followers</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${unreadCount}</div>
        <div class="stat-label">New notifications</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${trustScore}</div>
        <div class="stat-label">Community standing</div>
        <div class="stat-trend">${creatorLevel.replace(/_/g, ' ')}</div>
      </div>
    </div>
    ${topPost ? `
    <div class="section">
      <div class="section-title">Top post this week</div>
      <div class="top-post">
        <div class="top-post-title">${(topPost.title ?? "Untitled").slice(0, 80)}</div>
        <div style="font-size:13px;color:#737373">Your best-performing post - <a href="${appUrl}/post/${topPost.id}" style="color:#8b5cf6">read it →</a></div>
      </div>
    </div>` : ""}
    ${currentStreak > 0 ? `
    <div class="section">
      <div class="streak-bar" style="display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">🔥</span>
        <span style="font-size:14px;color:#9a3412;font-weight:600">${currentStreak}-day writing streak - keep it going</span>
      </div>
    </div>` : ""}
    <div class="cta-section">
      <p class="cta-text">${cta}</p>
      <a href="${appUrl}" class="cta-btn">Open QuillHive →</a>
    </div>
  </div>
  <div class="footer">
    <p>You're receiving this because you have weekly reports enabled.<br />
    <a href="${unsubscribeUrl}">Unsubscribe from weekly reports</a> · <a href="${appUrl}/settings">Manage email preferences</a> · <a href="${appUrl}/profile/${user.username}">Your profile</a></p>
  </div>
</div>
</body>
</html>`;

        const { sendEmail } = await import("../../features/email/email.service");
        await sendEmail({
          to: user.email,
          subject: `Your QuillHive recap: ${weekViews} views${newFollowers > 0 ? `, ${newFollowers} new followers` : ""}`,
          html,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        logger.info({ userId, weekViews, newFollowers }, "Weekly report sent");
      } catch (err) {
        logger.error({ err, userId }, "Failed to send weekly report");
        throw err;
      }
      break;
    }

    case "admin_notification_broadcast": {
      const { actorId, title, message } =
        job.data as JobPayloads["admin_notification_broadcast"];
      try {
        const { db } = await import("@workspace/db");
        const { usersTable } = await import("@workspace/db/schema");
        const { gt, eq, and, asc } = await import("drizzle-orm");
        const { notifyOfficialNotice } = await import(
          "../../features/notifications/notification.service"
        );
        const progress = typeof job.progress === "object" && job.progress !== null
          ? job.progress as { sent?: number; lastUserId?: number }
          : {};
        let lastUserId = Number(progress.lastUserId ?? 0);
        let sent = Number(progress.sent ?? 0);
        const batchSize = 100;

        while (true) {
          const recipients = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(and(gt(usersTable.id, lastUserId), eq(usersTable.isDeleted, false)))
            .orderBy(asc(usersTable.id))
            .limit(batchSize);
          if (!recipients.length) break;

          for (const recipient of recipients) {
            await notifyOfficialNotice({
              userId: recipient.id,
              actorId,
              title,
              message,
              url: "/notifications",
            });
          }

          sent += recipients.length;
          lastUserId = recipients[recipients.length - 1].id;
          await job.updateProgress({ sent, lastUserId });
        }

        logger.info({ jobId: job.id, sent }, "Official notification broadcast delivered");
      } catch (err) {
        logger.error({ err, jobId: job.id }, "Official notification broadcast failed");
        throw err;
      }
      break;
    }

    case "lock_ab_winner": {
      const { postId } = job.data as JobPayloads["lock_ab_winner"];
      try {
        const { db } = await import("@workspace/db");
        const { postsTable } = await import("@workspace/db/schema");
        const { eq } = await import("drizzle-orm");
        const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
        if (post && post.titleA && post.titleB && !post.abSelectedTitle) {
          const winner = (post.titleAClicks ?? 0) >= (post.titleBClicks ?? 0) ? "A" : "B";
          await db.update(postsTable).set({ abSelectedTitle: winner, abLockedAt: new Date(), updatedAt: new Date() }).where(eq(postsTable.id, postId));
          logger.info({ postId, winner }, "A/B test winner locked");
        }
      } catch (err) {
        logger.error({ err, postId }, "Failed to lock A/B winner");
        throw err;
      }
      break;
    }

    case "send_topic_notification": {
      const { topicId, postId, authorId } = job.data as JobPayloads["send_topic_notification"];
      try {
        const { db } = await import("@workspace/db");
        const { topicFollowsTable, usersTable, notificationsTable } = await import("@workspace/db/schema");
        const { eq, and, ne } = await import("drizzle-orm");
        const followers = await db
          .select({ userId: topicFollowsTable.userId })
          .from(topicFollowsTable)
          .innerJoin(usersTable, eq(topicFollowsTable.userId, usersTable.id))
          .where(and(eq(topicFollowsTable.topicId, topicId), ne(topicFollowsTable.userId, authorId)));

        if (followers.length > 0 && notificationsTable) {
          const notifValues = followers.slice(0, 200).map(f => ({
            userId: f.userId,
            type: "topic_post",
            actorId: authorId,
            postId,
            message: "A new post was published in a topic you follow",
          }));
          await db.insert(notificationsTable).values(notifValues);
          for (const f of notifValues) {
            emitToUser(f.userId, "notification:new", { type: f.type, actorId: f.actorId, postId: f.postId, message: f.message, createdAt: new Date().toISOString() });
          }
        }
        logger.info({ topicId, postId, count: followers.length }, "Topic notifications sent");
      } catch (err) {
        logger.error({ err, topicId, postId }, "Failed to send topic notifications");
      }
      break;
    }

    case "expire_boosts": {
      try {
        const { db } = await import("@workspace/db");
        const { boostRequestsTable } = await import("@workspace/db/schema");
        const { eq, and, lte } = await import("drizzle-orm");
        const now = new Date();
        const expired = await db
          .select({ id: boostRequestsTable.id, userId: boostRequestsTable.userId, postId: boostRequestsTable.postId })
          .from(boostRequestsTable)
          .where(and(
            eq(boostRequestsTable.status, "approved"),
            lte(boostRequestsTable.boostEndsAt, now),
          ));
        if (expired.length > 0) {
          const ids = expired.map(r => r.id);
          const { inArray } = await import("drizzle-orm");
          await db.update(boostRequestsTable)
            .set({ status: "expired" } as Record<string, unknown>)
            .where(inArray(boostRequestsTable.id, ids));
          logger.info({ count: expired.length }, "Expired boost campaigns marked");

          // Notify each affected user
          const { notify } = await import("../../features/notifications/notification.service");
          const { postsTable } = await import("@workspace/db/schema");
          const { eq } = await import("drizzle-orm");
          for (const campaign of expired) {
            const [post] = await db
              .select({ title: postsTable.title })
              .from(postsTable)
              .where(eq(postsTable.id, campaign.postId));

            void notify({
              userId: campaign.userId,
              type: "system",
              title: "Your boost campaign has ended",
              message: `Your campaign for "${(post?.title ?? "your post").slice(0, 50)}" has expired. Boost again to keep the momentum going.`,
              url: `/promotions?highlight=${campaign.id}`,
            }).catch(() => {});
          }
        }
      } catch (err) {
        logger.error({ err }, "Failed to expire boosts");
        throw err;
      }
      break;
    }

    case "streak_break_check": {
      try {
        const { db } = await import("@workspace/db");
        const { writingStreaksTable } = await import("@workspace/db/schema");
        const { gt, eq, and } = await import("drizzle-orm");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const cutoff = yesterday.toISOString().slice(0, 10);
        const atRisk = await db
          .select({ userId: writingStreaksTable.userId, currentStreak: writingStreaksTable.currentStreak, lastWriteDate: writingStreaksTable.lastWriteDate })
          .from(writingStreaksTable)
          .where(and(
            gt(writingStreaksTable.currentStreak, 2),
            eq(writingStreaksTable.lastWriteDate, cutoff),
          ))
          .limit(200);
        if (atRisk.length > 0) {
          const { notify } = await import("../../features/notifications/notification.service");
          for (const s of atRisk) {
            void notify({
              userId: s.userId,
              type: "system",
              title: `🔥 Keep your ${s.currentStreak}-day streak alive!`,
              message: "Write something today - even a short spark counts. Don't let your streak break.",
              url: "/write",
            }).catch(() => {});
          }
          logger.info({ count: atRisk.length }, "Streak break warnings sent");
        }
      } catch (err) {
        logger.error({ err }, "Failed to run streak break check");
      }
      break;
    }

    default: {
      logger.warn({ name }, "Unknown job type");
    }
  }
}

export function startWorker(): void {
  const redisUrl = process.env.BULLMQ_REDIS_URL;
  if (!redisUrl) {
    logger.warn("BULLMQ_REDIS_URL not set - job worker disabled");
    return;
  }

  if (!redisUrl.startsWith("redis://") && !redisUrl.startsWith("rediss://")) {
    logger.warn("BULLMQ_REDIS_URL must be a raw redis:// TCP URL (not HTTP/HTTPS REST). Job worker disabled.");
    return;
  }

  try {
    const connection = createBullMQConnection();

    worker = new Worker("quillhive-jobs", processJob, {
      connection,
      concurrency: 5,
    });

    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, name: job.name }, "Job completed");
    });

    worker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, name: job?.name, err }, "Job failed");
    });

    worker.on("error", (err) => {
      logger.error({ err }, "Worker error");
    });

    logger.info("Job worker started");

    // Register repeatable jobs - these run on a fixed schedule regardless of
    // whether they were already enqueued. The unique jobId prevents duplicates.
    void (async () => {
      try {
        const { Queue } = await import("bullmq");
        const mainQueue = new Queue("quillhive-jobs", { connection });

        await mainQueue.add(
          "expire_boosts",
          {},
          {
            repeat: { every: 60 * 60 * 1000 }, // hourly
            jobId: "expire_boosts_repeatable",
          } as Record<string, unknown>,
        );

        await mainQueue.add(
          "streak_break_check",
          {},
          {
            repeat: { cron: "1 0 * * *" }, // daily at 00:01 UTC
            jobId: "streak_break_repeatable",
          } as Record<string, unknown>,
        );

        logger.info("Repeatable jobs registered (expire_boosts hourly, streak_break_check daily)");
        await mainQueue.close();
      } catch (repeatErr) {
        logger.warn({ err: repeatErr }, "Could not register repeatable jobs - BullMQ may not be connected");
      }
    })();
  } catch (err) {
    logger.error({ err }, "Failed to start job worker");
  }
}

export function stopWorker(): Promise<void> {
  if (!worker) return Promise.resolve();
  return worker.close();
}
