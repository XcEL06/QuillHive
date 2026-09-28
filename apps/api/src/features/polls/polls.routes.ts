import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { pollsTable, pollOptionsTable, pollVotesTable, postsTable, usersTable } from "@workspace/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { getViewerId } from "../../lib/auth-types";
import { notify } from "../notifications/notification.service";

export const pollsRouter: Router = Router();

const createPollSchema = z.object({
  postId: z.number().int().positive(),
  question: z.string().min(3).max(280),
  options: z.array(z.string().min(1).max(120)).min(2).max(8),
  allowMultiple: z.boolean().optional(),
  closesAt: z.string().datetime().optional(),
});

const voteSchema = z.object({
  optionIds: z.array(z.number().int().positive()).min(1).max(8),
});

async function loadPollWithResults(pollId: number, viewerId: number | null) {
  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId));
  if (!poll) return null;

  const options = await db
    .select()
    .from(pollOptionsTable)
    .where(eq(pollOptionsTable.pollId, pollId))
    .orderBy(pollOptionsTable.position);

  let myVotes: number[] = [];
  if (viewerId) {
    const votes = await db
      .select({ optionId: pollVotesTable.optionId })
      .from(pollVotesTable)
      .where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.userId, viewerId)));
    myVotes = votes.map((v) => v.optionId);
  }

  const totalVotes = options.reduce((sum, o) => sum + o.voteCount, 0);
  return {
    id: poll.id,
    postId: poll.postId,
    authorId: poll.authorId,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    closesAt: poll.closesAt,
    createdAt: poll.createdAt,
    totalVotes,
    myVotes,
    isClosed: poll.closesAt ? poll.closesAt.getTime() < Date.now() : false,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      position: o.position,
      voteCount: o.voteCount,
    })),
  };
}

/** Standalone poll creation - creates the backing post + poll in one shot */
const standalonePollSchema = z.object({
  question: z.string().min(3).max(280),
  options: z.array(z.string().min(1).max(120)).min(2).max(8),
  durationHours: z.coerce.number().int().min(1).max(336).optional(),
  multipleChoice: z.boolean().optional(),
  showResultsBeforeVoting: z.boolean().optional(),
  attachments: z.array(z.any()).max(20).optional(),
});

pollsRouter.post("/standalone", async (req, res) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = standalonePollSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid poll data", issues: parsed.error.issues });
  }

  const { question, options, durationHours, multipleChoice, attachments } = parsed.data;
  const closesAt = durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null;

  // Create the backing post (type='post', isPublished=true)
  const [post] = await db
    .insert(postsTable)
    .values({
      authorId: userId,
      title: question.slice(0, 180),
      content: question,
      attachments: JSON.stringify(attachments ?? []),
      isPublished: true,
    } as any)
    .returning();

  const [poll] = await db
    .insert(pollsTable)
    .values({
      postId: post.id,
      authorId: userId,
      question,
      allowMultiple: multipleChoice ?? false,
      closesAt,
    })
    .returning();

  await db.insert(pollOptionsTable).values(
    options.map((label, idx) => ({
      pollId: poll.id,
      label,
      position: idx,
    })),
  );

  const result = await loadPollWithResults(poll.id, userId);
  return res.status(201).json({ ...result, pollId: poll.id, postId: post.id });
});

pollsRouter.post("/", async (req, res) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = createPollSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid poll", issues: parsed.error.issues });
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, parsed.data.postId));
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.authorId !== userId) return res.status(403).json({ error: "Forbidden" });

  const [existing] = await db.select().from(pollsTable).where(eq(pollsTable.postId, parsed.data.postId));
  if (existing) return res.status(409).json({ error: "Poll already exists for this post" });

  const [poll] = await db
    .insert(pollsTable)
    .values({
      postId: parsed.data.postId,
      authorId: userId,
      question: parsed.data.question,
      allowMultiple: parsed.data.allowMultiple ?? false,
      closesAt: parsed.data.closesAt ? new Date(parsed.data.closesAt) : null,
    })
    .returning();

  await db.insert(pollOptionsTable).values(
    parsed.data.options.map((label, idx) => ({
      pollId: poll.id,
      label,
      position: idx,
    })),
  );

  const result = await loadPollWithResults(poll.id, userId);
  return res.status(201).json(result);
});

pollsRouter.get("/post/:postId", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }
  const viewerId = getViewerId(req);
  const [poll] = await db.select({ id: pollsTable.id }).from(pollsTable).where(eq(pollsTable.postId, postId));
  if (!poll) return res.status(404).json({ error: "No poll for this post" });
  const result = await loadPollWithResults(poll.id, viewerId);
  return res.json(result);
});

pollsRouter.get("/:id", async (req, res) => {
  const pollId = Number(req.params.id);
  if (!Number.isInteger(pollId) || pollId <= 0) {
    return res.status(400).json({ error: "Invalid poll id" });
  }
  const viewerId = getViewerId(req);
  const result = await loadPollWithResults(pollId, viewerId);
  if (!result) return res.status(404).json({ error: "Poll not found" });
  return res.json(result);
});

pollsRouter.post("/:id/vote", async (req, res) => {
  const userId = getViewerId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const pollId = Number(req.params.id);
  if (!Number.isInteger(pollId) || pollId <= 0) {
    return res.status(400).json({ error: "Invalid poll id" });
  }

  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid vote" });

  const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId));
  if (!poll) return res.status(404).json({ error: "Poll not found" });
  if (poll.closesAt && poll.closesAt.getTime() < Date.now()) {
    return res.status(403).json({ error: "Poll closed" });
  }
  if (!poll.allowMultiple && parsed.data.optionIds.length > 1) {
    return res.status(400).json({ error: "This poll allows only one option" });
  }

  const validOptions = await db
    .select({ id: pollOptionsTable.id })
    .from(pollOptionsTable)
    .where(eq(pollOptionsTable.pollId, pollId));
  const validIds = new Set(validOptions.map((o) => o.id));
  if (!parsed.data.optionIds.every((id) => validIds.has(id))) {
    return res.status(400).json({ error: "Unknown option id" });
  }

  // Replace prior votes (idempotent + handles change-of-mind)
  const previousVotes = await db
    .select({ optionId: pollVotesTable.optionId })
    .from(pollVotesTable)
    .where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.userId, userId)));

  if (previousVotes.length > 0) {
    await db
      .delete(pollVotesTable)
      .where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.userId, userId)));
    for (const pv of previousVotes) {
      await db
        .update(pollOptionsTable)
        .set({ voteCount: sql`${pollOptionsTable.voteCount} - 1` })
        .where(eq(pollOptionsTable.id, pv.optionId));
    }
  }

  for (const optionId of parsed.data.optionIds) {
    await db.insert(pollVotesTable).values({ pollId, optionId, userId }).onConflictDoNothing();
    await db
      .update(pollOptionsTable)
      .set({ voteCount: sql`${pollOptionsTable.voteCount} + 1` })
      .where(eq(pollOptionsTable.id, optionId));
  }

  // Notify the poll author (best-effort; no notification on vote-changes)
  if (previousVotes.length === 0) {
    await notify({
      userId: poll.authorId,
      actorId: userId,
      type: "poll_vote",
      message: "voted on your poll",
      postId: poll.postId,
      digestGroup: `poll:${pollId}`,
    });
  }

  const result = await loadPollWithResults(pollId, userId);
  return res.json(result);
});

/** Voters per option. Public: vote casts are public-by-design like Twitter polls. */
pollsRouter.get("/:id/voters", async (req, res) => {
  const pollId = Number(req.params.id);
  if (!Number.isInteger(pollId) || pollId <= 0) {
    return res.status(400).json({ error: "Invalid poll id" });
  }
  const optionId = req.query.optionId ? Number(req.query.optionId) : null;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  const whereClause = optionId
    ? and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.optionId, optionId))
    : eq(pollVotesTable.pollId, pollId);

  const rows = await db
    .select({
      voteId: pollVotesTable.id,
      optionId: pollVotesTable.optionId,
      createdAt: pollVotesTable.createdAt,
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(pollVotesTable)
    .leftJoin(usersTable, eq(usersTable.id, pollVotesTable.userId))
    .where(whereClause)
    .orderBy(desc(pollVotesTable.createdAt))
    .limit(limit);

  return res.json(
    rows.map((r) => ({
      voteId: r.voteId,
      optionId: r.optionId,
      votedAt: r.createdAt,
      user: { id: r.userId, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
    })),
  );
});
