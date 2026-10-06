import { Router } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  adminLogsTable,
  followsTable,
  moderationStrikesTable,
  postsTable,
  spamReviewFlagsTable,
  usersTable,
} from "@workspace/db/schema";
import { requirePermission } from "../../middleware/admin";
import { notify } from "../notifications/notification.service";
import { detectSpamReviewSignals } from "./spamReview.service";
import { logger } from "../../lib/logger";

export const spamReviewRouter = Router();

spamReviewRouter.get("/", requirePermission("manage_moderation"), async (_req, res) => {
  const now = new Date();
  const posts = await db.select({
    id: postsTable.id,
    authorId: postsTable.authorId,
    content: postsTable.content,
    createdAt: postsTable.createdAt,
  }).from(postsTable).where(and(eq(postsTable.isDeleted, false), gte(postsTable.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60_000))))
    .orderBy(desc(postsTable.createdAt)).limit(5_000);
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.isDeleted, false));
  const follows = await db.select({
    followerId: followsTable.followerId,
    createdAt: followsTable.createdAt,
  }).from(followsTable).where(gte(followsTable.createdAt, new Date(now.getTime() - 24 * 60 * 60_000))).limit(10_000);

  const detected = detectSpamReviewSignals(users, posts, follows, now);
  for (const signal of detected) {
    await db.insert(spamReviewFlagsTable).values({
      userId: signal.userId,
      ruleKey: signal.ruleKey,
      reason: signal.reason,
      evidence: signal.evidence,
    }).onConflictDoNothing({ target: [spamReviewFlagsTable.userId, spamReviewFlagsTable.ruleKey] });
  }

  const flags = await db.select({
    id: spamReviewFlagsTable.id,
    userId: spamReviewFlagsTable.userId,
    ruleKey: spamReviewFlagsTable.ruleKey,
    reason: spamReviewFlagsTable.reason,
    evidence: spamReviewFlagsTable.evidence,
    status: spamReviewFlagsTable.status,
    decision: spamReviewFlagsTable.decision,
    createdAt: spamReviewFlagsTable.createdAt,
    username: usersTable.username,
    displayName: usersTable.displayName,
    isBanned: usersTable.isBanned,
    accountCreatedAt: usersTable.createdAt,
  }).from(spamReviewFlagsTable)
    .innerJoin(usersTable, eq(usersTable.id, spamReviewFlagsTable.userId))
    .where(eq(spamReviewFlagsTable.status, "pending"))
    .orderBy(desc(spamReviewFlagsTable.createdAt)).limit(300);
  return res.json({ flags });
});

spamReviewRouter.post("/:id/decision", requirePermission("manage_moderation"), async (req: any, res) => {
  const id = Number(req.params.id);
  const decision = req.body?.decision;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid review flag id" });
  if (!["dismiss", "warn", "strike", "ban"].includes(decision)) return res.status(400).json({ error: "Invalid moderation decision" });
  if (["warn", "strike", "ban"].includes(decision) && !reason) return res.status(400).json({ error: "A reason is required for this action" });

  const [flag] = await db.select().from(spamReviewFlagsTable)
    .where(and(eq(spamReviewFlagsTable.id, id), eq(spamReviewFlagsTable.status, "pending")));
  if (!flag) return res.status(404).json({ error: "Pending review flag not found" });
  const [target] = await db.select({ id: usersTable.id, isDeleted: usersTable.isDeleted, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, flag.userId));
  if (!target || target.isDeleted) return res.status(404).json({ error: "User not found" });
  if (target.role === "super_admin") return res.status(403).json({ error: "Moderation actions cannot be applied to a super admin account" });

  const outcome = await db.transaction(async (tx) => {
    const [reviewed] = await tx.update(spamReviewFlagsTable).set({
      status: decision === "dismiss" ? "dismissed" : "actioned",
      decision,
      reviewedBy: req.currentUser.id,
      reviewedAt: new Date(),
    }).where(and(eq(spamReviewFlagsTable.id, id), eq(spamReviewFlagsTable.status, "pending"))).returning();
    if (!reviewed) return null;
    let strikeId: number | null = null;
    if (decision === "warn" || decision === "strike") {
      const [strike] = await tx.insert(moderationStrikesTable).values({
        userId: flag.userId,
        reason: reason.slice(0, 1_000),
        severity: decision === "warn" ? 1 : 2,
        issuedBy: req.currentUser.id,
      }).returning({ id: moderationStrikesTable.id });
      strikeId = strike.id;
    }
    if (decision === "ban") {
      await tx.update(usersTable).set({ isBanned: true, bannedAt: new Date(), updatedAt: new Date() }).where(eq(usersTable.id, flag.userId));
    }
    await tx.insert(adminLogsTable).values({
      adminId: req.currentUser.id,
      action: `spam_review_${decision}`,
      targetType: "user",
      targetId: flag.userId,
      details: `${flag.ruleKey}: ${reason || flag.reason}`.slice(0, 1_000),
    });
    return { reviewed, strikeId };
  });
  if (!outcome) return res.status(409).json({ error: "This flag has already been reviewed" });
  if (decision === "warn" && outcome.strikeId !== null) {
    try {
      await notify({
        userId: flag.userId,
        actorId: req.currentUser.id,
        type: "admin_action",
        message: `You received a warning: ${reason.slice(0, 160)}`,
        digestGroup: `strike:${outcome.strikeId}`,
      });
    } catch (err) {
      logger.warn({ err, userId: flag.userId }, "Could not notify user of spam-review warning");
    }
  }
  return res.json({ flag: outcome.reviewed });
});
