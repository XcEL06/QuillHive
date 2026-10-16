import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { seriesTable, postsTable, seriesFollowsTable, usersTable, readingProgressTable } from "@workspace/db/schema";
import { eq, and, desc, asc, count, gte, lt } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { getViewerId } from "../../lib/auth-types";
import { postVisibilityCondition } from "../posts/postVisibility";
import { canViewProfile } from "../profiles/profileAccess.service";

export const seriesRouter = Router();

const createSeriesSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  coverImage: z.string().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
});

const updateSeriesSchema = createSeriesSchema.partial();

const idParams = z.object({ id: z.coerce.number().int().positive() });

seriesRouter.get("/", requireAuth, async (req: any, res) => {
  const rows = await db
    .select()
    .from(seriesTable)
    .where(eq(seriesTable.userId, req.currentUser.id))
    .orderBy(desc(seriesTable.createdAt));
  return res.json(rows);
});

seriesRouter.get("/user/:username", async (req, res) => {
  const viewerId = getViewerId(req);
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.username, req.params.username), eq(usersTable.isDeleted, false)));
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!(await canViewProfile(user, viewerId))) return res.status(404).json({ error: "User not found" });
  const allRows = await db.select().from(seriesTable).where(eq(seriesTable.userId, user.id)).orderBy(desc(seriesTable.createdAt));
  const rows = await Promise.all(allRows.map(async (series) => {
    const [visible] = await db.select({ id: postsTable.id }).from(postsTable)
      .where(and(eq(postsTable.seriesId, series.id), eq(postsTable.isPublished, true), eq(postsTable.isDeleted, false), postVisibilityCondition(viewerId)))
      .limit(1);
    return visible || viewerId === user.id ? series : null;
  }));
  return res.json(rows.filter(Boolean));
});

seriesRouter.get("/:id", validateParams(idParams), async (req, res) => {
  const viewerId = getViewerId(req);
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, Number(req.params.id)));
  if (!series) return res.status(404).json({ error: "Series not found" });
  const posts = await db
    .select({ id: postsTable.id, title: postsTable.title, excerpt: postsTable.excerpt, seriesOrder: postsTable.seriesOrder })
    .from(postsTable)
    .where(and(eq(postsTable.seriesId, series.id), eq(postsTable.isDeleted, false), eq(postsTable.isPublished, true), postVisibilityCondition(viewerId)))
    .orderBy(asc(postsTable.seriesOrder), asc(postsTable.id));
  if (!posts.length && viewerId !== series.userId) return res.status(404).json({ error: "Series not found" });
  const [follow] = viewerId
    ? await db.select({ id: seriesFollowsTable.id }).from(seriesFollowsTable)
      .where(and(eq(seriesFollowsTable.seriesId, series.id), eq(seriesFollowsTable.followerId, viewerId))).limit(1)
    : [];
  const [followers] = await db.select({ total: count() }).from(seriesFollowsTable).where(eq(seriesFollowsTable.seriesId, series.id));
  const [resumePost] = viewerId && posts.length
    ? await db.select({
      id: postsTable.id,
      title: postsTable.title,
      percent: readingProgressTable.percent,
    }).from(readingProgressTable)
      .innerJoin(postsTable, eq(readingProgressTable.postId, postsTable.id))
      .where(and(
        eq(readingProgressTable.userId, viewerId),
        eq(postsTable.seriesId, series.id),
        gte(readingProgressTable.percent, 1),
        lt(readingProgressTable.percent, 95),
        eq(postsTable.isPublished, true),
        eq(postsTable.isDeleted, false),
        postVisibilityCondition(viewerId),
      ))
      .orderBy(desc(readingProgressTable.lastReadAt))
      .limit(1)
    : [];
  return res.json({ ...series, posts, resumePost: resumePost ?? null, isFollowing: Boolean(follow), followerCount: followers?.total ?? 0 });
});

seriesRouter.post("/:id/follow", requireAuth, validateParams(idParams), async (req: any, res) => {
  const seriesId = Number(req.params.id);
  const viewerId = req.currentUser.id;
  const [series] = await db.select({ id: seriesTable.id, userId: seriesTable.userId }).from(seriesTable).where(eq(seriesTable.id, seriesId));
  if (!series) return res.status(404).json({ error: "Series not found" });
  if (series.userId === viewerId) return res.status(400).json({ error: "You already own this series." });
  const [visiblePost] = await db.select({ id: postsTable.id }).from(postsTable)
    .where(and(eq(postsTable.seriesId, seriesId), eq(postsTable.isPublished, true), eq(postsTable.isDeleted, false), postVisibilityCondition(viewerId)))
    .limit(1);
  if (!visiblePost) return res.status(404).json({ error: "Series not found" });
  await db.insert(seriesFollowsTable).values({ seriesId, followerId: viewerId }).onConflictDoNothing();
  return res.json({ following: true });
});

seriesRouter.delete("/:id/follow", requireAuth, validateParams(idParams), async (req: any, res) => {
  await db.delete(seriesFollowsTable).where(and(
    eq(seriesFollowsTable.seriesId, Number(req.params.id)),
    eq(seriesFollowsTable.followerId, req.currentUser.id),
  ));
  return res.json({ following: false });
});

seriesRouter.post("/", requireAuth, validateBody(createSeriesSchema), async (req: any, res) => {
  const baseSlug = req.body.slug ?? (req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "series");
  let slug = baseSlug.slice(0, 100);
  for (let suffix = 2; ; suffix++) {
    const [existing] = await db.select({ id: seriesTable.id }).from(seriesTable)
      .where(and(eq(seriesTable.userId, req.currentUser.id), eq(seriesTable.slug, slug)));
    if (!existing) break;
    const ending = `-${suffix}`;
    slug = `${baseSlug.slice(0, 100 - ending.length)}${ending}`;
  }
  const [series] = await db
    .insert(seriesTable)
    .values({ userId: req.currentUser.id, ...req.body, slug })
    .returning();
  return res.status(201).json(series);
});

seriesRouter.patch("/:id", requireAuth, validateParams(idParams), validateBody(updateSeriesSchema), async (req: any, res) => {
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, Number(req.params.id)));
  if (!series) return res.status(404).json({ error: "Not found" });
  if (series.userId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
  const [updated] = await db.update(seriesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(seriesTable.id, series.id)).returning();
  return res.json(updated);
});

seriesRouter.delete("/:id", requireAuth, validateParams(idParams), async (req: any, res) => {
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, Number(req.params.id)));
  if (!series) return res.status(404).json({ error: "Not found" });
  if (series.userId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
  await db.update(postsTable).set({ seriesId: null, seriesOrder: null }).where(eq(postsTable.seriesId, series.id));
  await db.delete(seriesTable).where(eq(seriesTable.id, series.id));
  return res.json({ ok: true });
});

seriesRouter.post("/:id/posts/:postId", requireAuth, validateParams(z.object({ id: z.coerce.number().int().positive(), postId: z.coerce.number().int().positive() })), validateBody(z.object({ order: z.number().int().min(0).optional() })), async (req: any, res) => {
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, Number(req.params.id)));
  if (!series) return res.status(404).json({ error: "Series not found" });
  if (series.userId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
  const [post] = await db.select().from(postsTable).where(and(eq(postsTable.id, Number(req.params.postId)), eq(postsTable.authorId, req.currentUser.id)));
  if (!post) return res.status(404).json({ error: "Post not found" });
  const order = req.body.order ?? 0;
  await db.update(postsTable).set({ seriesId: series.id, seriesOrder: order }).where(eq(postsTable.id, post.id));
  await db.update(seriesTable).set({ postCount: series.postCount + 1, updatedAt: new Date() }).where(eq(seriesTable.id, series.id));
  return res.json({ ok: true });
});

seriesRouter.delete("/:id/posts/:postId", requireAuth, validateParams(z.object({ id: z.coerce.number().int().positive(), postId: z.coerce.number().int().positive() })), async (req: any, res) => {
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, Number(req.params.id)));
  if (!series) return res.status(404).json({ error: "Series not found" });
  if (series.userId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
  await db.update(postsTable).set({ seriesId: null, seriesOrder: null }).where(and(eq(postsTable.id, Number(req.params.postId)), eq(postsTable.seriesId, series.id)));
  const newCount = Math.max(0, series.postCount - 1);
  await db.update(seriesTable).set({ postCount: newCount, updatedAt: new Date() }).where(eq(seriesTable.id, series.id));
  return res.json({ ok: true });
});
