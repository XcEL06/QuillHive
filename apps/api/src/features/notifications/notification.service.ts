import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { emitToUser } from "../../lib/socket";
import { logger } from "../../lib/logger";
import { sendPushToUser } from "./push.service";

export type NotificationType =
  | "like"
  | "comment"
  | "comment_like"
  | "reply"
  | "follow"
  | "mention"
  | "quote"
  | "poll_vote"
  | "appreciation"
  | "share"
  | "highlight"
  | "system"
  | "admin_action"
  | "admin_alert"
  | "official_notice"
  | "group_invite"
  | "group_announcement"
  | "milestone"
  | "trending"
  | "referral_reward"
  | "achievement"
  | "streak_milestone"
  | "opportunity_nudge"
  | "library_save"
  | "library_feature"
  | "library_entry"
  | "commission_request"
  | "commission_response"
  | "skill_endorsement"
  | "collaboration_accepted"
  | "collaboration_declined"
  | "post_approved"
  | "post_rejected"
  | "digest";

type StandardNotificationType = Exclude<NotificationType, "official_notice">;

interface NotifyOpts {
  userId: number;
  /** actorId=0 (or omitted) means a system-generated notification - self-skip guard is bypassed */
  actorId?: number;
  type: NotificationType;
  message: string;
  title?: string;
  url?: string;
  postId?: number | null;
  groupId?: number | null;
  digestGroup?: string | null;
}

const NOTIFICATION_CATEGORY_MAP: Record<NotificationType, string> = {
  mention: "mention",
  quote: "social",
  reply: "social",
  comment: "social",
  comment_like: "social",
  like: "social",
  follow: "social",
  poll_vote: "social",
  appreciation: "social",
  share: "social",
  highlight: "social",
  admin_action: "admin",
  admin_alert: "admin",
  official_notice: "admin",
  system: "system",
  group_invite: "social",
  group_announcement: "social",
  milestone: "growth",
  trending: "growth",
  referral_reward: "growth",
  achievement: "growth",
  streak_milestone: "growth",
  opportunity_nudge: "growth",
  library_save: "social",
  library_feature: "achievement",
  library_entry: "social",
  commission_request: "opportunity",
  commission_response: "opportunity",
  skill_endorsement: "social",
  collaboration_accepted: "opportunity",
  collaboration_declined: "opportunity",
  post_approved: "system",
  post_rejected: "system",
  digest: "system",
};

const NOTIFICATION_TITLE_MAP: Partial<Record<NotificationType, string>> = {
  milestone: "A QuillHive milestone",
  trending: "Your voice is gaining momentum",
  referral_reward: "A new friend joined the hive",
  achievement: "Achievement unlocked",
  streak_milestone: "Your sharing streak",
  opportunity_nudge: "A new opportunity",
  digest: "Your QuillHive recap",
  group_announcement: "A new group announcement",
  system: "A QuillHive update",
  official_notice: "A message from the QuillHive team",
  admin_alert: "Job listing needs review",
};

/**
 * Create a notification and push it to the recipient over the socket.
 * Self-notifications (userId === actorId) are silently skipped.
 * All errors are caught - notifications must never break the parent action.
 */
// In-memory dedup window: collapse repeated like/follow notifications from same actor→recipient
const recentNotifKeys = new Map<string, number>();
const NOTIF_DEDUP_MS = 60 * 60_000; // 1 hour

function shouldDedup(opts: {
  type: NotificationType;
  actorId?: number;
  userId: number;
  postId?: number | null;
}): boolean {
  if (opts.type !== "follow") return false;
  const key = `${opts.type}:${opts.actorId ?? 0}:${opts.userId}:${opts.postId ?? "_"}`;
  const now = Date.now();
  const last = recentNotifKeys.get(key);
  if (last && now - last < NOTIF_DEDUP_MS) return true;
  recentNotifKeys.set(key, now);
  // Soft cap to keep map bounded
  if (recentNotifKeys.size > 5000) {
    const cutoff = now - NOTIF_DEDUP_MS;
    for (const [k, v] of recentNotifKeys) {
      if (v < cutoff) recentNotifKeys.delete(k);
    }
  }
  return false;
}

async function createNotification(opts: NotifyOpts & { type: NotificationType }): Promise<void> {
  const actorId = opts.actorId ?? 0;
  // Skip self-notifications (only when a real actor triggers it)
  const allowSelfNotification = opts.type === "admin_action"
    || opts.type === "admin_alert"
    || opts.type === "official_notice"
    || opts.type === "system";
  if (actorId !== 0 && opts.userId === actorId && !allowSelfNotification) return;
  if (shouldDedup(opts)) return;
  try {
    const category = NOTIFICATION_CATEGORY_MAP[opts.type] ?? "social";
    const [actor] = actorId
      ? await db
          .select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
          .from(usersTable)
          .where(eq(usersTable.id, actorId))
      : [null];

    let notif: typeof notificationsTable.$inferSelect | undefined;
    if (opts.type === "like" && opts.postId) {
      const [existing] = await db
        .select()
        .from(notificationsTable)
        .where(and(
          eq(notificationsTable.userId, opts.userId),
          eq(notificationsTable.type, "like"),
          eq(notificationsTable.postId, opts.postId),
          eq(notificationsTable.isRead, false),
          gte(notificationsTable.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(1);

      if (existing) {
        const groupCount = (existing.groupCount ?? 1) + 1;
        const actorName = actor?.displayName || actor?.username || "Someone";
        const title = `${actorName} and ${groupCount - 1} other${groupCount > 2 ? "s" : ""} liked your post`;
        [notif] = await db
          .update(notificationsTable)
          .set({ actorId, title, groupCount, createdAt: new Date() })
          .where(eq(notificationsTable.id, existing.id))
          .returning();
      }
    }

    if (!notif) {
      [notif] = await db
        .insert(notificationsTable)
        .values({
          userId: opts.userId,
          actorId,
          type: opts.type,
          message: opts.message,
          title: opts.title ?? null,
          postId: opts.postId ?? null,
          groupId: opts.groupId ?? null,
          category,
          digestGroup: opts.digestGroup ?? null,
          isRead: false,
        })
        .returning();
    }

    // Check per-type user preferences before delivering
    const [recipient] = await db
      .select({ notificationPrefs: usersTable.notificationPrefs })
      .from(usersTable)
      .where(eq(usersTable.id, opts.userId))
      .limit(1);
    const prefs = (recipient?.notificationPrefs ?? {}) as Record<string, { inApp: boolean; push: boolean; email: boolean }>;
    const typePref = prefs[opts.type];
    const inAppEnabled = typePref?.inApp ?? true;
    const pushEnabled = typePref?.push ?? false;

    if (inAppEnabled) {
      emitToUser(opts.userId, "notification:new", { ...notif, actor });
    }

    if (pushEnabled) {
      const actorName = actor?.displayName || actor?.username;
      void sendPushToUser(opts.userId, {
        title: notif.title ?? opts.title ?? NOTIFICATION_TITLE_MAP[opts.type] ?? "QuillHive",
        body: notif.title ?? (actorName ? `${actorName}: ${opts.message}` : opts.message),
        type: opts.type,
        url: opts.url ?? (opts.postId ? `/post/${opts.postId}` : "/notifications"),
      });
    }
  } catch (err) {
    logger.error({ err, opts }, "notify_failed");
  }
}

/**
 * Create a regular notification. Official notices must use notifyOfficialNotice
 * so they cannot be created by an arbitrary notification caller.
 */
export async function notify(opts: NotifyOpts): Promise<void> {
  if ((opts as { type: string }).type === "official_notice") {
    logger.error({ userId: opts.userId }, "blocked unofficial official_notice creation");
    return;
  }
  return createNotification(opts);
}

/**
 * The only notification creation capability for official notices. This helper
 * has one call site: the admin users/:id/notice endpoint.
 */
export async function notifyOfficialNotice(opts: Omit<NotifyOpts, "type">): Promise<void> {
  return createNotification({ ...opts, type: "official_notice" });
}
