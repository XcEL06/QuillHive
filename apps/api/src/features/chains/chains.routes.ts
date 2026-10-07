import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { chainsTable, chainEntriesTable, postsTable, usersTable } from "@workspace/db/schema";
import { and, eq, desc, sql, ne } from "drizzle-orm";
import { requireAuth } from "../../middleware/admin";
import { getViewerId } from "../../lib/auth-types";

export const chainsRouter = Router();

const createChainSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  prompt: z.string().max(300).optional(),
  maxEntries: z.number().int().min(2).max(50).optional(),
  isPublic: z.boolean().optional(),
  category: z.string().max(50).optional(),
});

const addEntrySchema = z.object({
  postId: z.number().int().positive(),
});

async function getChainWithEntries(chainId: number, viewerId: number | null) {
  const [chain] = await db
    .select({
      id: chainsTable.id,
      title: chainsTable.title,
      description: chainsTable.description,
      prompt: chainsTable.prompt,
      category: chainsTable.category,
      maxEntries: chainsTable.maxEntries,
      isComplete: chainsTable.isComplete,
      isPublic: chainsTable.isPublic,
      totalViews: chainsTable.totalViews,
      createdAt: chainsTable.createdAt,
      creatorId: chainsTable.creatorId,
      creatorName: usersTable.displayName,
      creatorUsername: usersTable.username,
      creatorAvatar: usersTable.avatarUrl,
    })
    .from(chainsTable)
    .leftJoin(usersTable, eq(chainsTable.creatorId, usersTable.id))
    .where(eq(chainsTable.id, chainId));

  if (!chain) return null;

  const entries = await db
    .select({
      id: chainEntriesTable.id,
      chainId: chainEntriesTable.chainId,
      postId: chainEntriesTable.postId,
      authorId: chainEntriesTable.authorId,
      position: chainEntriesTable.position,
      addedAt: chainEntriesTable.addedAt,
      postTitle: postsTable.title,
      postExcerpt: postsTable.excerpt,
      postCoverImage: postsTable.imageUrl,
      authorName: usersTable.displayName,
      authorUsername: usersTable.username,
      authorAvatar: usersTable.avatarUrl,
    })
    .from(chainEntriesTable)
    .leftJoin(postsTable, eq(chainEntriesTable.postId, postsTable.id))
    .leftJoin(usersTable, eq(chainEntriesTable.authorId, usersTable.id))
    .where(eq(chainEntriesTable.chainId, chainId))
    .orderBy(chainEntriesTable.position);

  const myEntryIds = viewerId
    ? entries.filter((e) => e.authorId === viewerId).map((e) => e.postId)
    : [];

  return { ...chain, entries, hasJoined: myEntryIds.length > 0, entryCount: entries.length };
}

// E5: GET /api/chains - discover chains
chainsRouter.get("/chains", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const category = req.query.category as string | undefined;
  const tab = z.enum(["recent", "active", "complete"]).catch("recent").parse(req.query.tab);

  const conditions = [eq(chainsTable.isPublic, true)];
  if (category) conditions.push(eq(chainsTable.category, category));
  if (tab === "active") conditions.push(eq(chainsTable.isComplete, false));
  if (tab === "complete") conditions.push(eq(chainsTable.isComplete, true));

  const chains = await db
    .select({
      id: chainsTable.id,
      title: chainsTable.title,
      description: chainsTable.description,
      prompt: chainsTable.prompt,
      category: chainsTable.category,
      maxEntries: chainsTable.maxEntries,
      isComplete: chainsTable.isComplete,
      totalViews: chainsTable.totalViews,
      createdAt: chainsTable.createdAt,
      creatorId: chainsTable.creatorId,
      entryCount: sql<number>`(select count(*)::int from chain_entries where chain_id = ${chainsTable.id})`,
      creatorName: usersTable.displayName,
      creatorUsername: usersTable.username,
      creatorAvatar: usersTable.avatarUrl,
    })
    .from(chainsTable)
    .leftJoin(usersTable, eq(chainsTable.creatorId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(chainsTable.createdAt))
    .limit(limit);

  res.json({ chains });
});

// E6: GET /api/chains/mine - my chains (created + participated)
chainsRouter.get("/chains/mine", requireAuth, async (req, res) => {
  const viewerId = getViewerId(req)!;

  const created = await db
    .select({
      id: chainsTable.id,
      title: chainsTable.title,
      description: chainsTable.description,
      category: chainsTable.category,
      isComplete: chainsTable.isComplete,
      totalViews: chainsTable.totalViews,
      createdAt: chainsTable.createdAt,
      entryCount: sql<number>`(select count(*)::int from chain_entries where chain_id = ${chainsTable.id})`,
    })
    .from(chainsTable)
    .where(eq(chainsTable.creatorId, viewerId))
    .orderBy(desc(chainsTable.createdAt));

  const participated = await db
    .select({
      id: chainsTable.id,
      title: chainsTable.title,
      description: chainsTable.description,
      category: chainsTable.category,
      isComplete: chainsTable.isComplete,
      totalViews: chainsTable.totalViews,
      createdAt: chainsTable.createdAt,
      entryCount: sql<number>`(select count(*)::int from chain_entries where chain_id = ${chainsTable.id})`,
    })
    .from(chainsTable)
    .innerJoin(
      chainEntriesTable,
      and(eq(chainEntriesTable.chainId, chainsTable.id), eq(chainEntriesTable.authorId, viewerId)),
    )
    .where(ne(chainsTable.creatorId, viewerId))
    .orderBy(desc(chainsTable.createdAt));

  res.json({ created, participated });
});

// E3: GET /api/chains/:id - view chain + entries
chainsRouter.get("/chains/:id", async (req, res) => {
  const chainId = parseInt(req.params.id, 10);
  if (isNaN(chainId)) return res.status(400).json({ error: "Invalid chain ID" });

  const viewerId = getViewerId(req);
  const chain = await getChainWithEntries(chainId, viewerId);
  if (!chain) return res.status(404).json({ error: "Chain not found" });
  if (!chain.isPublic && chain.creatorId !== viewerId) return res.status(403).json({ error: "Private chain" });

  await db
    .update(chainsTable)
    .set({ totalViews: sql`${chainsTable.totalViews} + 1` })
    .where(eq(chainsTable.id, chainId));

  res.json(chain);
});

// E4: GET /api/chains/:id/analytics - chain analytics
chainsRouter.get("/chains/:id/analytics", requireAuth, async (req, res) => {
  const chainId = parseInt(req.params.id, 10);
  if (isNaN(chainId)) return res.status(400).json({ error: "Invalid chain ID" });
  const viewerId = getViewerId(req)!;

  const [chain] = await db.select().from(chainsTable).where(eq(chainsTable.id, chainId));
  if (!chain) return res.status(404).json({ error: "Chain not found" });
  if (chain.creatorId !== viewerId) return res.status(403).json({ error: "Only the chain creator can view analytics" });

  const entries = await db
    .select({
      authorId: chainEntriesTable.authorId,
      addedAt: chainEntriesTable.addedAt,
      authorName: usersTable.displayName,
      authorUsername: usersTable.username,
      authorAvatar: usersTable.avatarUrl,
    })
    .from(chainEntriesTable)
    .leftJoin(usersTable, eq(chainEntriesTable.authorId, usersTable.id))
    .where(eq(chainEntriesTable.chainId, chainId));

  const uniqueContributors = new Map();
  entries.forEach((e) => {
    if (!uniqueContributors.has(e.authorId)) {
      uniqueContributors.set(e.authorId, {
        id: e.authorId,
        name: e.authorName,
        username: e.authorUsername,
        avatar: e.authorAvatar,
        count: 0,
      });
    }
    uniqueContributors.get(e.authorId).count++;
  });

  // Build daily timeline buckets
  const dailyMap = new Map<string, number>();
  entries.forEach((e) => {
    const day = new Date(e.addedAt).toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  });
  const dailyTimeline = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  // Cumulative growth curve
  let cumulative = 0;
  const growthCurve = dailyTimeline.map(({ date, count }) => {
    cumulative += count;
    return { date, total: cumulative };
  });

  // Funnel: how far the chain has progressed
  const funnelStages = chain.maxEntries
    ? Array.from({ length: Math.min(chain.maxEntries, 10) }, (_, i) => ({
        link: i + 1,
        filled: i < entries.length,
      }))
    : [];

  res.json({
    chainId,
    chainTitle: chain.title,
    chainCategory: chain.category,
    chainCreatedAt: chain.createdAt,
    totalViews: chain.totalViews ?? 0,
    totalEntries: entries.length,
    maxEntries: chain.maxEntries,
    completionRate: chain.maxEntries ? Math.round((entries.length / chain.maxEntries) * 100) : null,
    isComplete: chain.isComplete,
    contributors: Array.from(uniqueContributors.values()),
    dailyTimeline,
    growthCurve,
    funnelStages,
    timeline: entries.map((e) => ({ authorId: e.authorId, addedAt: e.addedAt })),
  });
});

// E1: POST /api/chains - create chain
chainsRouter.post("/chains", requireAuth, async (req, res) => {
  const viewerId = getViewerId(req)!;
  const body = createChainSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input", details: body.error });

  const { title, description, prompt, maxEntries, isPublic, category } = body.data;

  const [chain] = await db
    .insert(chainsTable)
    .values({
      title,
      description,
      prompt,
      maxEntries: maxEntries ?? 10,
      isPublic: isPublic ?? true,
      category,
      creatorId: viewerId,
    })
    .returning();

  res.status(201).json(chain);
});

// E2: POST /api/chains/:id/entries - add a post to the chain
chainsRouter.post("/chains/:id/entries", requireAuth, async (req, res) => {
  const chainId = parseInt(req.params.id, 10);
  if (isNaN(chainId)) return res.status(400).json({ error: "Invalid chain ID" });

  const viewerId = getViewerId(req)!;
  const body = addEntrySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });

  const [chain] = await db.select().from(chainsTable).where(eq(chainsTable.id, chainId));
  if (!chain) return res.status(404).json({ error: "Chain not found" });
  if (chain.isComplete) return res.status(409).json({ error: "Chain is already complete" });

  const existingEntries = await db
    .select({ id: chainEntriesTable.id, authorId: chainEntriesTable.authorId, postId: chainEntriesTable.postId })
    .from(chainEntriesTable)
    .where(eq(chainEntriesTable.chainId, chainId));

  if (existingEntries.some((e) => e.postId === body.data.postId)) {
    return res.status(409).json({ error: "This post is already in the chain" });
  }
  if (existingEntries.some((e) => e.authorId === viewerId)) {
    return res.status(409).json({ error: "You have already added a link to this chain" });
  }

  const [post] = await db.select({ id: postsTable.id, authorId: postsTable.authorId }).from(postsTable).where(eq(postsTable.id, body.data.postId));
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.authorId !== viewerId) return res.status(403).json({ error: "You can only add your own posts to a chain" });

  const position = existingEntries.length + 1;
  const [entry] = await db
    .insert(chainEntriesTable)
    .values({ chainId, postId: body.data.postId, authorId: viewerId, position })
    .returning();

  const isNowComplete = chain.maxEntries !== null && position >= chain.maxEntries;
  if (isNowComplete) {
    await db.update(chainsTable).set({ isComplete: true, updatedAt: new Date() }).where(eq(chainsTable.id, chainId));
  }

  res.status(201).json({ ...entry, isChainComplete: isNowComplete });
});

// INVITE: POST /api/chains/:id/invites - invite a user by username
chainsRouter.post("/chains/:id/invites", requireAuth, async (req, res) => {
  const chainId = parseInt(req.params.id, 10);
  if (isNaN(chainId)) return res.status(400).json({ error: "Invalid chain ID" });
  const viewerId = getViewerId(req)!;

  const { username } = req.body as { username?: string };
  if (!username?.trim()) return res.status(400).json({ error: "Username required" });

  const [chain] = await db.select({ id: chainsTable.id, title: chainsTable.title, creatorId: chainsTable.creatorId, isComplete: chainsTable.isComplete })
    .from(chainsTable).where(eq(chainsTable.id, chainId));
  if (!chain) return res.status(404).json({ error: "Chain not found" });
  if (chain.isComplete) return res.status(409).json({ error: "Chain is already complete" });

  const [target] = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable).where(eq(usersTable.username, username.trim().replace(/^@/, "")));
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === viewerId) return res.status(400).json({ error: "You cannot invite yourself" });

  const { notify } = await import("../notifications/notification.service");
  const [actor] = await db.select({ displayName: usersTable.displayName, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, viewerId));

  await notify({
    userId: target.id,
    actorId: viewerId,
    type: "system",
    title: "Chain invite",
    message: `${actor.displayName ?? actor.username} invited you to add a link to the chain: "${chain.title}"`,
    url: `/chains/${chainId}`,
  });

  res.json({ success: true, invitedUser: target.displayName });
});

// DELETE /api/chains/:id - delete chain (creator only)
chainsRouter.delete("/chains/:id", requireAuth, async (req, res) => {
  const chainId = parseInt(req.params.id, 10);
  if (isNaN(chainId)) return res.status(400).json({ error: "Invalid chain ID" });
  const viewerId = getViewerId(req)!;

  const [chain] = await db.select({ creatorId: chainsTable.creatorId }).from(chainsTable).where(eq(chainsTable.id, chainId));
  if (!chain) return res.status(404).json({ error: "Chain not found" });
  if (chain.creatorId !== viewerId) return res.status(403).json({ error: "Only the creator can delete a chain" });

  await db.delete(chainsTable).where(eq(chainsTable.id, chainId));
  res.json({ success: true });
});
