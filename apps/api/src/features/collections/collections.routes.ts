import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { collectionsTable, collectionPostsTable, postsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams } from "../../middleware/validate";

export const collectionsRouter = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() });
const postParams = z.object({ id: z.coerce.number().int().positive(), postId: z.coerce.number().int().positive() });

collectionsRouter.get("/", requireAuth, async (req: any, res) => {
  const rows = await db
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.userId, req.currentUser.id))
    .orderBy(desc(collectionsTable.updatedAt));
  return res.json(rows);
});

collectionsRouter.get("/public/:id", validateParams(idParams), async (req, res) => {
  const [collection] = await db.select().from(collectionsTable)
    .where(and(eq(collectionsTable.id, Number(req.params.id)), eq(collectionsTable.isPublic, true)));
  if (!collection) return res.status(404).json({ error: "Collection not found" });

  const postLinks = await db.select({ postId: collectionPostsTable.postId, addedAt: collectionPostsTable.createdAt })
    .from(collectionPostsTable)
    .where(eq(collectionPostsTable.collectionId, collection.id))
    .orderBy(desc(collectionPostsTable.createdAt));
  const postIds = postLinks.map(post => post.postId);
  let posts: any[] = [];
  if (postIds.length > 0) {
    const { sql } = await import("drizzle-orm");
    posts = await db.select().from(postsTable).where(sql`
      ${postsTable.id} = ANY(ARRAY[${sql.join(postIds.map(id => sql`${id}`), sql`, `)}])
      AND ${postsTable.isDeleted} = false
      AND ${postsTable.isPublished} = true
    `);
  }
  return res.json({ ...collection, posts });
});

collectionsRouter.get("/:id", requireAuth, validateParams(idParams), async (req: any, res) => {
  const [collection] = await db.select().from(collectionsTable).where(and(eq(collectionsTable.id, Number(req.params.id)), eq(collectionsTable.userId, req.currentUser.id)));
  if (!collection) return res.status(404).json({ error: "Collection not found" });

  const postLinks = await db
    .select({ postId: collectionPostsTable.postId, addedAt: collectionPostsTable.createdAt })
    .from(collectionPostsTable)
    .where(eq(collectionPostsTable.collectionId, collection.id))
    .orderBy(desc(collectionPostsTable.createdAt));

  const postIds = postLinks.map(p => p.postId);
  let posts: any[] = [];
  if (postIds.length > 0) {
    const { sql } = await import("drizzle-orm");
    const raw = await db
      .select()
      .from(postsTable)
      .where(sql`${postsTable.id} = ANY(ARRAY[${sql.join(postIds.map(id => sql`${id}`), sql`, `)}]) AND ${postsTable.isDeleted} = false`);
    posts = raw;
  }

  return res.json({ ...collection, posts });
});

collectionsRouter.post("/", requireAuth, validateBody(z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
})), async (req: any, res) => {
  const [collection] = await db.insert(collectionsTable).values({
    userId: req.currentUser.id,
    name: req.body.name,
    description: req.body.description,
    isPublic: req.body.isPublic ?? false,
  }).returning();
  return res.status(201).json(collection);
});

collectionsRouter.patch("/:id", requireAuth, validateParams(idParams), validateBody(z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
})), async (req: any, res) => {
  const [col] = await db.select().from(collectionsTable).where(and(eq(collectionsTable.id, Number(req.params.id)), eq(collectionsTable.userId, req.currentUser.id)));
  if (!col) return res.status(404).json({ error: "Not found" });
  const [updated] = await db.update(collectionsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(collectionsTable.id, col.id)).returning();
  return res.json(updated);
});

collectionsRouter.delete("/:id", requireAuth, validateParams(idParams), async (req: any, res) => {
  const [col] = await db.select().from(collectionsTable).where(and(eq(collectionsTable.id, Number(req.params.id)), eq(collectionsTable.userId, req.currentUser.id)));
  if (!col) return res.status(404).json({ error: "Not found" });
  await db.delete(collectionPostsTable).where(eq(collectionPostsTable.collectionId, col.id));
  await db.delete(collectionsTable).where(eq(collectionsTable.id, col.id));
  return res.json({ ok: true });
});

collectionsRouter.post("/:id/posts/:postId", requireAuth, validateParams(postParams), async (req: any, res) => {
  const [col] = await db.select().from(collectionsTable).where(and(eq(collectionsTable.id, Number(req.params.id)), eq(collectionsTable.userId, req.currentUser.id)));
  if (!col) return res.status(404).json({ error: "Collection not found" });
  try {
    await db.insert(collectionPostsTable).values({ collectionId: col.id, postId: Number(req.params.postId) });
    const newCount = col.postCount + 1;
    await db.update(collectionsTable).set({ postCount: newCount, updatedAt: new Date() }).where(eq(collectionsTable.id, col.id));
  } catch {
    return res.status(409).json({ error: "Post already in collection" });
  }
  return res.json({ ok: true });
});

collectionsRouter.delete("/:id/posts/:postId", requireAuth, validateParams(postParams), async (req: any, res) => {
  const [col] = await db.select().from(collectionsTable).where(and(eq(collectionsTable.id, Number(req.params.id)), eq(collectionsTable.userId, req.currentUser.id)));
  if (!col) return res.status(404).json({ error: "Collection not found" });
  await db.delete(collectionPostsTable).where(and(eq(collectionPostsTable.collectionId, col.id), eq(collectionPostsTable.postId, Number(req.params.postId))));
  const newCount = Math.max(0, col.postCount - 1);
  await db.update(collectionsTable).set({ postCount: newCount, updatedAt: new Date() }).where(eq(collectionsTable.id, col.id));
  return res.json({ ok: true });
});
