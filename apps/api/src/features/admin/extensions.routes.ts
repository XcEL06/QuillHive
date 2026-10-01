import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  jobsTable, postsTable, groupsTable, featuredSlotsTable, adminLogsTable,
} from "@workspace/db/schema";
import { eq, and, gt, isNull, or, desc } from "drizzle-orm";
import { requireAdmin, requirePermission, requireSuperAdmin } from "../../middleware/admin";

interface AuthedReq extends Request { currentUser: { id: number } }

async function audit(adminId: number, action: string, targetType: string, targetId?: number, details?: string) {
  await db.insert(adminLogsTable).values({
    adminId, action, targetType, targetId: targetId ?? null, details: details ?? null,
  });
}

// ─── Admin: jobs/posts/groups/featured slots ─────────────────────────────────
export const adminExtensionsRouter: IRouter = Router();
adminExtensionsRouter.use(requireAdmin);

// Admin lists (include pending/inactive items so moderators can act on them)
adminExtensionsRouter.get("/jobs", async (_req: Request, res: Response) => {
  const rows = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt)).limit(200);
  res.json({ jobs: rows });
});

adminExtensionsRouter.get("/groups", async (_req: Request, res: Response) => {
  const rows = await db.select().from(groupsTable).orderBy(desc(groupsTable.createdAt)).limit(200);
  res.json({ groups: rows });
});

// Jobs
adminExtensionsRouter.patch("/jobs/:id/approve", requirePermission("manage_jobs"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  await db.update(jobsTable).set({ isApproved: true, isActive: true, moderationStatus: "published" }).where(eq(jobsTable.id, id));
  await audit(adminId, "job_approve", "job", id);
  res.json({ ok: true });
});

adminExtensionsRouter.patch("/jobs/:id/feature", requirePermission("manage_jobs"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  const featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await db.update(jobsTable).set({ isFeatured: true, featuredUntil }).where(eq(jobsTable.id, id));
  await audit(adminId, "job_feature", "job", id);
  res.json({ ok: true, featuredUntil });
});

adminExtensionsRouter.patch("/jobs/:id/reject", requirePermission("manage_jobs"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  await db.update(jobsTable).set({ isActive: false, moderationStatus: "rejected" }).where(eq(jobsTable.id, id));
  await audit(adminId, "job_reject", "job", id);
  res.json({ ok: true });
});

// Posts - sponsor / unsponsor
adminExtensionsRouter.patch("/posts/:id/sponsor", requirePermission("manage_content"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  const sponsorName = String(req.body?.sponsorName ?? "").slice(0, 120);
  const sponsorLogoUrl = req.body?.sponsorLogoUrl ? String(req.body.sponsorLogoUrl).slice(0, 500) : null;
  const sponsorUrl = req.body?.sponsorUrl ? String(req.body.sponsorUrl).slice(0, 500) : null;
  if (!sponsorName) {
    res.status(400).json({ error: "sponsorName is required" });
    return;
  }
  await db
    .update(postsTable)
    .set({ isSponsored: true, sponsorName, sponsorLogoUrl, sponsorUrl })
    .where(eq(postsTable.id, id));
  await audit(adminId, "post_sponsored", "post", id, sponsorName);
  res.json({ ok: true });
});

adminExtensionsRouter.patch("/posts/:id/unsponsor", requirePermission("manage_content"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  await db
    .update(postsTable)
    .set({ isSponsored: false, sponsorName: null, sponsorLogoUrl: null, sponsorUrl: null })
    .where(eq(postsTable.id, id));
  await audit(adminId, "post_unsponsored", "post", id);
  res.json({ ok: true });
});

// Groups
adminExtensionsRouter.patch("/groups/:id/verify", requirePermission("manage_groups"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  await db.update(groupsTable).set({ isVerified: true }).where(eq(groupsTable.id, id));
  await audit(adminId, "group_verify", "group", id);
  res.json({ ok: true });
});

adminExtensionsRouter.patch("/groups/:id/promote", requirePermission("manage_groups"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  const promotedUntil = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await db.update(groupsTable).set({ isPromoted: true, promotedUntil }).where(eq(groupsTable.id, id));
  await audit(adminId, "group_promote", "group", id);
  try {
    const [grp] = await db.select({ ownerId: groupsTable.creatorId, name: groupsTable.name }).from(groupsTable).where(eq(groupsTable.id, id));
    if (grp?.ownerId) {
      const { dispatchWebhook } = await import("../distribution/webhooks.service");
      void dispatchWebhook({
        userId: grp.ownerId,
        event: "group.promoted",
        data: { groupId: id, groupName: grp.name, promotedUntil: promotedUntil.toISOString() },
      });
    }
  } catch { /* best-effort */ }
  res.json({ ok: true, promotedUntil });
});

adminExtensionsRouter.patch("/groups/:id/unpromote", requirePermission("manage_groups"), async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  await db.update(groupsTable).set({ isPromoted: false, promotedUntil: null }).where(eq(groupsTable.id, id));
  await audit(adminId, "group_unpromote", "group", id);
  res.json({ ok: true });
});

// Featured slots
adminExtensionsRouter.get("/featured-slots", async (_req: Request, res: Response) => {
  const rows = await db.select().from(featuredSlotsTable).orderBy(desc(featuredSlotsTable.createdAt));
  res.json({ slots: rows });
});

adminExtensionsRouter.post("/featured-slots", requireSuperAdmin, async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const { slotKey, targetType, targetId, title, description, imageUrl, linkUrl, endsAt } = req.body || {};
  if (!slotKey || !targetType || !targetId) {
    res.status(400).json({ error: "slotKey, targetType, and targetId are required" });
    return;
  }
  const endsAtDate = endsAt ? new Date(endsAt) : null;
  const existing = await db.select().from(featuredSlotsTable).where(eq(featuredSlotsTable.slotKey, slotKey));
  let row;
  if (existing[0]) {
    [row] = await db
      .update(featuredSlotsTable)
      .set({
        targetType, targetId: Number(targetId),
        title: title ?? null, description: description ?? null,
        imageUrl: imageUrl ?? null, linkUrl: linkUrl ?? null,
        endsAt: endsAtDate, isActive: true, assignedBy: adminId,
      })
      .where(eq(featuredSlotsTable.id, existing[0].id))
      .returning();
  } else {
    [row] = await db
      .insert(featuredSlotsTable)
      .values({
        slotKey, targetType, targetId: Number(targetId),
        title: title ?? null, description: description ?? null,
        imageUrl: imageUrl ?? null, linkUrl: linkUrl ?? null,
        endsAt: endsAtDate, assignedBy: adminId,
      })
      .returning();
  }
  await audit(adminId, "featured_slot_upsert", "featured_slot", row.id, slotKey);

  // Notify creator when their post is featured
  if (targetType === "post" && targetId) {
    try {
      const { usersTable: _usersTable } = await import("@workspace/db/schema");
      const [post] = await db
        .select({ authorId: postsTable.authorId, title: postsTable.title })
        .from(postsTable)
        .where(eq(postsTable.id, Number(targetId)));
      if (post?.authorId) {
        const { notify } = await import("../../features/notifications/notification.service");
        await notify({
          userId: post.authorId,
          actorId: adminId,
          type: "milestone",
          title: "🌟 Your post was featured by QuillHive",
          message: `"${(post.title ?? "Your post").slice(0, 60)}" was selected as a QuillHive Featured piece. It will appear prominently on the Discover page.`,
          url: `/post/${Number(targetId)}`,
          postId: Number(targetId),
        });
        await audit(adminId, "feature_post", "post", Number(targetId), "Editorial feature");
      }
    } catch { /* best-effort */ }
  }

  res.json({ slot: row });
});

adminExtensionsRouter.delete("/featured-slots/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  const adminId = (req as AuthedReq).currentUser.id;
  const id = Number(req.params["id"]);
  await db.update(featuredSlotsTable).set({ isActive: false }).where(eq(featuredSlotsTable.id, id));
  await audit(adminId, "featured_slot_delete", "featured_slot", id);
  res.json({ ok: true });
});

// ─── Public /featured endpoint ───────────────────────────────────────────────
export const publicFeaturedRouter: IRouter = Router();

publicFeaturedRouter.get("/featured", async (_req: Request, res: Response) => {
  const now = new Date();
  const slots = await db
    .select()
    .from(featuredSlotsTable)
    .where(
      and(
        eq(featuredSlotsTable.isActive, true),
        or(isNull(featuredSlotsTable.endsAt), gt(featuredSlotsTable.endsAt, now)),
      ),
    );
  res.json({ slots });
});
