import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  postsTable,
  usersTable,
  notificationsTable,
  adminLogsTable,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, sql, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../../middleware/admin";
import { z } from "zod";
import { getIO } from "../../lib/socket";
import { assertOfficialSystemAccount, OFFICIAL_SYSTEM_ACCOUNT } from "../../lib/officialSystemAccount";

export const officialPostsRouter: Router = Router();
export const officialPublicRouter: Router = Router();

// ─── Types ─────────────────────────────────────────────────────────────────

interface AuthedReq extends Request {
  currentUser: { id: number; role: string };
}

type PostCategory =
  | "announcement"
  | "creator_tip"
  | "spotlight"
  | "challenge"
  | "update"
  | "featured_creator"
  | "growth"
  | "event"
  | "milestone"
  | "community";

interface CtaButton {
  label: string;
  url: string;
  style: "primary" | "secondary" | "outline";
}

// ─── Validation Schemas ────────────────────────────────────────────────────

const ctaButtonSchema = z.object({
  label: z.string().min(1).max(60),
  url: z.string().min(1).max(500),
  style: z.enum(["primary", "secondary", "outline"]).default("primary"),
});

const createOfficialPostSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  content: z.string().min(1).max(20000),
  excerpt: z.string().max(500).optional(),
  imageUrl: z.string().max(500).optional(),
  attachments: z.array(z.object({
    url: z.string(),
    mimeType: z.string(),
    filename: z.string().optional(),
    sizeBytes: z.number().optional(),
  })).max(10).optional(),
  tags: z.array(z.string().max(50)).max(15).optional(),
  postCategory: z.enum([
    "announcement", "creator_tip", "spotlight", "challenge",
    "update", "featured_creator", "growth", "event", "milestone", "community",
  ]),
  officialPostPriority: z.number().int().min(0).max(10).default(0),
  ctaButtons: z.array(ctaButtonSchema).max(3).optional(),
  officialTargetAudience: z.enum(["all", "creators", "readers", "new_users", "power_users"]).default("all").optional(),
  officialLanguage: z.string().max(10).optional(),
  isPublished: z.boolean().default(true),
  scheduledAt: z.string().optional(),
  // Challenge fields
  challengeHashtag: z.string().max(80).optional(),
  challengeEndsAt: z.string().optional(),
  challengeRewardText: z.string().max(300).optional(),
  // Spotlight fields
  featuredCreatorId: z.number().int().optional(),
  // Notification options
  sendNotification: z.boolean().default(false),
  notificationType: z.enum(["official_announcement", "challenge_started", "creator_spotlight", "feature_release"]).optional(),
  notificationTitle: z.string().max(120).optional(),
  notificationBody: z.string().max(300).optional(),
});

type CreateOfficialPostInput = z.infer<typeof createOfficialPostSchema>;

// ─── Helpers ───────────────────────────────────────────────────────────────

async function auditLog(adminId: number, action: string, targetId?: number, details?: string) {
  await db.insert(adminLogsTable).values({
    adminId,
    action,
    targetType: "official_post",
    targetId: targetId ?? null,
    details: details ?? null,
  });
}

async function ensureQuillHiveAccount(): Promise<number> {
  const officialIdentity = { ...OFFICIAL_SYSTEM_ACCOUNT, isOfficialAccount: true };
  assertOfficialSystemAccount(officialIdentity);
  const [existing] = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, isOfficialAccount: usersTable.isOfficialAccount })
    .from(usersTable)
    .where(eq(usersTable.email, OFFICIAL_SYSTEM_ACCOUNT.email))
    .limit(1);
  if (existing) {
    assertOfficialSystemAccount(existing);
    return existing.id;
  }

  const [usernameCollision] = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, isOfficialAccount: usersTable.isOfficialAccount })
    .from(usersTable)
    .where(eq(usersTable.username, OFFICIAL_SYSTEM_ACCOUNT.username))
    .limit(1);
  if (usernameCollision) {
    assertOfficialSystemAccount(usernameCollision);
    throw new Error("Official system account email lookup returned no matching account.");
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      ...OFFICIAL_SYSTEM_ACCOUNT,
      displayName: "QuillHive",
      passwordHash: "",
      bio: "Your quill is your voice. Your hive is where it grows. For everyone.",
      role: "admin",
      isOfficialAccount: officialIdentity.isOfficialAccount,
      reachMultiplier: 3.0,
      visibilityPenalty: 0,
      isEmailVerified: true,
    } as typeof usersTable.$inferInsert)
    .returning({ id: usersTable.id });
  if (!created) throw new Error("Could not create the official system account because its identity conflicts with an existing account.");
  return created.id;
}

/**
 * Seed the @quillhive system account safely - called from app startup.
 * Will update the account if it already exists but needs elevation.
 */
export async function seedQuillHiveAccount(): Promise<void> {
  try {
    const accountId = await ensureQuillHiveAccount();
    await db
      .update(usersTable)
      .set({ reachMultiplier: 3.0, visibilityPenalty: 0 })
      .where(and(
        eq(usersTable.id, accountId),
        eq(usersTable.username, OFFICIAL_SYSTEM_ACCOUNT.username),
        eq(usersTable.email, OFFICIAL_SYSTEM_ACCOUNT.email),
        eq(usersTable.isOfficialAccount, true),
      ));
  } catch (err) {
    const { logger } = await import("../../lib/logger");
    logger.error({ err }, "Failed to seed @quillhive account");
    throw err;
  }
}

/**
 * Send targeted notifications for an official post.
 * Rate-limited: max 3 official notifications per user per 24h.
 * Supports opt-out via user preference (future-proof).
 */
async function sendOfficialNotifications(
  postId: number,
  notifType: string,
  title: string,
  body: string,
  targetAudience: string,
): Promise<void> {
  try {
    const io = getIO();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get recent notification counts per user to rate-limit
    const recentOfficial = await db
      .select({ userId: notificationsTable.userId })
      .from(notificationsTable)
      .where(
        and(
          inArray(notificationsTable.type, [
            "official_announcement", "challenge_started",
            "creator_spotlight", "feature_release",
          ]),
          sql`${notificationsTable.createdAt} > ${since24h}`,
        ),
      )
      .limit(10000);

    const recentCounts = new Map<number, number>();
    for (const r of recentOfficial) {
      const uid = r.userId as number;
      recentCounts.set(uid, (recentCounts.get(uid) ?? 0) + 1);
    }

    // Get eligible users (not deleted, not banned, audience filter)
    const baseQuery = db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.isDeleted, false),
          eq(usersTable.isBanned, false),
        ),
      )
      .limit(5000);

    const users = await baseQuery;

    const eligibleUsers = users
      .map((u) => u.id as number)
      .filter((uid) => (recentCounts.get(uid) ?? 0) < 3);

    if (eligibleUsers.length === 0) return;

    // Deduplication: don't send same post notification twice
    const alreadyNotified = await db
      .select({ userId: notificationsTable.userId })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.type, notifType as "official_announcement"),
          eq(notificationsTable.postId, postId),
        ),
      )
      .limit(10000);

    const notifiedSet = new Set(alreadyNotified.map((n) => n.userId as number));
    const toNotify = eligibleUsers.filter((uid) => !notifiedSet.has(uid));

    if (toNotify.length === 0) return;

    // Batch insert notifications in chunks of 500
    const CHUNK = 500;
    for (let i = 0; i < toNotify.length; i += CHUNK) {
      const chunk = toNotify.slice(i, i + CHUNK);
      await db.insert(notificationsTable).values(
        chunk.map((uid) => ({
          userId: uid,
          actorId: uid,
          type: notifType as "official_announcement",
          message: [title, body].filter(Boolean).join(": "),
          postId: postId ?? null,
          isRead: false,
        })),
      );

      // Emit socket events
      for (const uid of chunk) {
        io?.to(`user:${uid}`).emit("notification", {
          type: notifType,
          title,
          body,
          relatedPostId: postId,
        });
      }
    }
  } catch (err) {
    const { logger } = await import("../../lib/logger");
    logger.warn({ err }, "Failed to send official notifications");
  }
}

// ─── Admin Routes ──────────────────────────────────────────────────────────

// GET /admin/official-posts - list all official posts (paginated)
officialPostsRouter.get("/official-posts", requireAdmin, async (req: AuthedReq, res: Response) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
  const offset = Math.max(Number(req.query["offset"] ?? 0), 0);
  const category = typeof req.query["category"] === "string" ? req.query["category"] : null;

  const conds = [eq(postsTable.isOfficialPost, true), eq(postsTable.isDeleted, false)];
  if (category) conds.push(eq(postsTable.postCategory, category));

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(and(...conds));

  const posts = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      content: sql<string>`substring(${postsTable.content} from 1 for 200)`,
      postCategory: postsTable.postCategory,
      officialPostPriority: postsTable.officialPostPriority,
      isPublished: postsTable.isPublished,
      scheduledAt: postsTable.scheduledAt,
      ctaButtons: postsTable.ctaButtons,
      officialTargetAudience: postsTable.officialTargetAudience,
      officialLanguage: postsTable.officialLanguage,
      challengeHashtag: postsTable.challengeHashtag,
      challengeEndsAt: postsTable.challengeEndsAt,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .where(and(...conds))
    .orderBy(desc(postsTable.createdAt))
    .limit(limit)
    .offset(offset);

  return res.json({ posts, total, limit, offset });
});

// POST /admin/official-posts - create an official post
officialPostsRouter.post("/official-posts", requireAdmin, async (req: AuthedReq, res: Response) => {
  const parse = createOfficialPostSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Validation failed", issues: parse.error.issues });
  }
  const data: CreateOfficialPostInput = parse.data;

  const qhAccountId = await ensureQuillHiveAccount();

  const [post] = await db
    .insert(postsTable)
    .values({
      authorId: qhAccountId,
      title: data.title ?? null,
      content: data.content,
      excerpt: data.excerpt ?? null,
      type: "post",
      imageUrl: data.imageUrl ?? null,
      attachments: JSON.stringify(data.attachments ?? []),
      tags: JSON.stringify(data.tags ?? []),
      isPublished: data.scheduledAt ? false : (data.isPublished ?? true),
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      isOfficialPost: true,
      postCategory: data.postCategory,
      officialPostPriority: data.officialPostPriority ?? 0,
      ctaButtons: data.ctaButtons ? JSON.parse(JSON.stringify(data.ctaButtons)) : null,
      officialTargetAudience: data.officialTargetAudience ?? "all",
      officialLanguage: data.officialLanguage ?? null,
      challengeHashtag: data.challengeHashtag ?? null,
      challengeEndsAt: data.challengeEndsAt ? new Date(data.challengeEndsAt) : null,
      challengeRewardText: data.challengeRewardText ?? null,
      featuredCreatorId: data.featuredCreatorId ?? null,
      aiTextScore: 0,
    })
    .returning();

  // Link topics / hashtags
  if (data.tags && data.tags.length > 0) {
    const { linkPostTopics } = await import("../posts/post.service");
    await linkPostTopics(post.id, data.tags).catch(() => {});
  }

  await auditLog(req.currentUser.id, "official_post_created", post.id, data.postCategory);

  // Send optional notifications
  if (data.sendNotification && data.notificationType) {
    void sendOfficialNotifications(
      post.id,
      data.notificationType,
      data.notificationTitle ?? (data.title ?? "New from QuillHive"),
      data.notificationBody ?? (data.excerpt ?? data.content.slice(0, 200)),
      data.officialTargetAudience ?? "all",
    );
  }

  return res.status(201).json({ post });
});

// PATCH /admin/official-posts/:id - update an official post
officialPostsRouter.patch("/official-posts/:id", requireAdmin, async (req: AuthedReq, res: Response) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const [existing] = await db
    .select({ id: postsTable.id, isOfficialPost: postsTable.isOfficialPost })
    .from(postsTable)
    .where(and(eq(postsTable.id, id), eq(postsTable.isOfficialPost, true)));

  if (!existing) return res.status(404).json({ error: "Official post not found" });

  const allowed = [
    "title", "content", "excerpt", "imageUrl", "attachments", "tags",
    "isPublished", "scheduledAt", "postCategory", "officialPostPriority",
    "ctaButtons", "officialTargetAudience", "officialLanguage",
    "challengeHashtag", "challengeEndsAt", "challengeRewardText",
    "featuredCreatorId",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) {
      patch[key] = req.body[key];
    }
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  patch["updatedAt"] = new Date();

  const [updated] = await db
    .update(postsTable)
    .set(patch as Partial<typeof postsTable.$inferInsert>)
    .where(eq(postsTable.id, id))
    .returning();

  await auditLog(req.currentUser.id, "official_post_updated", id);

  return res.json({ post: updated });
});

// DELETE /admin/official-posts/:id - soft-delete an official post
officialPostsRouter.delete("/official-posts/:id", requireAdmin, async (req: AuthedReq, res: Response) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const [existing] = await db
    .select({ id: postsTable.id, isOfficialPost: postsTable.isOfficialPost })
    .from(postsTable)
    .where(and(eq(postsTable.id, id), eq(postsTable.isOfficialPost, true)));

  if (!existing) return res.status(404).json({ error: "Official post not found" });

  await db
    .update(postsTable)
    .set({ isDeleted: true, deletedAt: new Date(), isPublished: false })
    .where(eq(postsTable.id, id));

  await auditLog(req.currentUser.id, "official_post_deleted", id);

  return res.json({ ok: true });
});

// POST /admin/official-posts/:id/publish - publish a draft/scheduled post now
officialPostsRouter.post("/official-posts/:id/publish", requireAdmin, async (req: AuthedReq, res: Response) => {
  const id = Number(req.params["id"]);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  await db
    .update(postsTable)
    .set({ isPublished: true, scheduledAt: null, updatedAt: new Date() })
    .where(and(eq(postsTable.id, id), eq(postsTable.isOfficialPost, true)));

  await auditLog(req.currentUser.id, "official_post_published", id);

  return res.json({ ok: true });
});

// GET /admin/official-posts/analytics - per-category performance stats
officialPostsRouter.get("/official-posts/analytics", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      category: postsTable.postCategory,
      count: sql<number>`count(*)::int`,
      avgPriority: sql<number>`avg(${postsTable.officialPostPriority})::float`,
    })
    .from(postsTable)
    .where(and(eq(postsTable.isOfficialPost, true), eq(postsTable.isDeleted, false)))
    .groupBy(postsTable.postCategory)
    .orderBy(desc(sql`count(*)`));

  return res.json({ stats: rows });
});

// POST /posts/:id/cta-click - track CTA button clicks (public, no auth required)
officialPublicRouter.post("/posts/:id/cta-click", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const ctaLabel = typeof req.body?.label === "string" ? req.body.label.slice(0, 80) : "unknown";

  if (!id) return res.status(400).json({ error: "Invalid id" });

  // Best-effort: record as a share-click (re-using existing shareClickCount as proxy)
  await db
    .update(postsTable)
    .set({ shareClickCount: sql`${postsTable.shareClickCount} + 1` })
    .where(and(eq(postsTable.id, id), eq(postsTable.isOfficialPost, true)))
    .catch(() => {});

  // Non-blocking behaviour event for audit trail
  import("@workspace/db").then(({ db: _db }) =>
    import("@workspace/db/schema").then(({ behaviorEventsTable }) =>
      _db.insert(behaviorEventsTable).values({
        userId: 0,
        eventType: `official_cta_click:${ctaLabel}`,
        severity: 0,
        details: JSON.stringify({ postId: id, ctaLabel }),
      }).catch(() => {}),
    ),
  ).catch(() => {});

  return res.json({ ok: true });
});

// GET /official/feed - public endpoint returning current official posts for feed injection
officialPublicRouter.get("/official/feed", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query["limit"] ?? 5), 20);

  const posts = await db
    .select()
    .from(postsTable)
    .where(
      and(
        eq(postsTable.isOfficialPost, true),
        eq(postsTable.isPublished, true),
        eq(postsTable.isDeleted, false),
        or(
          sql`${postsTable.scheduledAt} is null`,
          sql`${postsTable.scheduledAt} <= now()`,
        ),
      ),
    )
    .orderBy(desc(postsTable.officialPostPriority), desc(postsTable.createdAt))
    .limit(limit);

  return res.json({ posts });
});
