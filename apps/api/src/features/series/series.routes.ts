import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { seriesTable, postsTable } from "@workspace/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";

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
  const { db: _db } = await import("@workspace/db");
  const { usersTable } = await import("@workspace/db/schema");
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, req.params.username));
  if (!user) return res.status(404).json({ error: "User not found" });
  const rows = await db.select().from(seriesTable).where(eq(seriesTable.userId, user.id)).orderBy(desc(seriesTable.createdAt));
  return res.json(rows);
});

seriesRouter.get("/:id", validateParams(idParams), async (req, res) => {
  const [series] = await db.select().from(seriesTable).where(eq(seriesTable.id, Number(req.params.id)));
  if (!series) return res.status(404).json({ error: "Series not found" });
  const posts = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.seriesId, series.id), eq(postsTable.isDeleted, false), eq(postsTable.isPublished, true)))
    .orderBy(asc(postsTable.seriesOrder));
  return res.json({ ...series, posts });
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
