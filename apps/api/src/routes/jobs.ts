import { Router } from "express";
import { db } from "@workspace/db";
import {
  jobsTable, usersTable, topicFollowsTable, topicsTable,
  creatorProfilesTable, userTrustScoresTable, postsTable,
  opportunityApplicationsTable, conversationsTable, conversationParticipantsTable, messagesTable,
} from "@workspace/db/schema";
import { eq, desc, and, or, isNull, gt, sql, inArray, gte } from "drizzle-orm";
import { z } from "zod";
import { getSessionUserId } from "../lib/auth";
import { getUserWithCounts } from "../features/profiles/profile.service";
import { notify } from "../features/notifications/notification.service";

const SCAM_PATTERNS = [
  /registration\s*fee/i,
  /pay\s*(a\s*)?(small\s*)?(deposit|fee)\s*to\s*(apply|start|begin)/i,
  /processing\s*fee/i,
  /training\s*fee/i,
  /send.*(money|payment|deposit).*before/i,
  /application\s*fee/i,
  /activation\s*fee/i,
];

function normalizeSkills(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((skill): skill is string => typeof skill === "string" && skill.trim().length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeSkills(parsed) : [];
  } catch {
    return value.trim() ? [value.trim()] : [];
  }
}

// ── Match scoring ──────────────────────────────────────────────────────────────
const IDENTITY_KEYWORDS: Record<string, string[]> = {
  writer:       ["writing", "content", "copy", "blog", "article", "fiction", "editorial", "poet", "author", "script"],
  artist:       ["design", "illustration", "art", "visual", "graphic", "creative", "motion", "animation"],
  builder:      ["developer", "engineer", "technical", "code", "software", "web", "app"],
  professional: ["consulting", "business", "marketing", "strategy", "brand", "pr", "comms"],
  student:      ["research", "academic", "education", "intern", "entry-level"],
  community:    ["community", "social", "engagement", "moderator", "growth"],
};

function scoreJobForCreator(
  job: { skills: string; category: string | null; title: string; description: string },
  userSkills: string[],
  userTopicNames: string[],
  identityType: string | null,
  trustUti: number,
  trustTier: string,
  recentPosts: number,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const jobSkillsArr = normalizeSkills(job.skills);
  const jobText = `${job.title} ${job.description} ${job.category ?? ""} ${jobSkillsArr.join(" ")}`.toLowerCase();

  // 1. Skill overlap (max 40 pts)
  const matchedSkills = userSkills
    .map(s => s.toLowerCase())
    .filter(s => jobSkillsArr.some(js => js.toLowerCase().includes(s) || s.includes(js.toLowerCase())) || jobText.includes(s));
  if (matchedSkills.length > 0) {
    score += Math.min(40, matchedSkills.length * 14);
    reasons.push(`Skills match: ${matchedSkills.slice(0, 2).join(", ")}`);
  }

  // 2. Topic/interest overlap (max 25 pts)
  const matchedTopics = userTopicNames.map(t => t.toLowerCase()).filter(t => jobText.includes(t));
  if (matchedTopics.length > 0) {
    score += Math.min(25, matchedTopics.length * 12);
    reasons.push(`Matches your ${matchedTopics[0]} interest`);
  }

  // 3. Identity alignment (max 20 pts)
  const aligned = (IDENTITY_KEYWORDS[identityType ?? ""] ?? []).filter(kw => jobText.includes(kw));
  if (aligned.length > 0) {
    score += 20;
    reasons.push("Matches your creator type");
  }

  // 4. Trust quality signal (max 10 pts)
  const trustBonus = trustTier === "trusted" ? 10 : trustUti > 70 ? 7 : trustUti > 50 ? 4 : 0;
  if (trustBonus > 0) {
    score += trustBonus;
    if (trustTier === "trusted") reasons.push("Your trust score qualifies you");
  }

  // 5. Activity bonus (max 5 pts)
  if (recentPosts > 0) {
    score += Math.min(5, recentPosts);
    reasons.push("Active creator");
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}

function scoreCreatorForJob(
  jobSkillsArr: string[],
  jobText: string,
  creatorSkills: string[],
  topicNames: string[],
  identityType: string | null,
  trustUti: number,
  trustTier: string,
  recentPosts: number,
): { score: number; reasons: string[] } {
  return scoreJobForCreator(
    { skills: JSON.stringify(jobSkillsArr), category: null, title: jobText.slice(0, 80), description: jobText },
    creatorSkills, topicNames, identityType, trustUti, trustTier, recentPosts,
  );
}

const router = Router();

function getViewerId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

async function enrichJob(job: any, viewerId: number | null) {
  const author = await getUserWithCounts(job.authorId, viewerId);
  const [trust] = await db
    .select({ tier: userTrustScoresTable.tier, uti: userTrustScoresTable.uti })
    .from(userTrustScoresTable)
    .where(eq(userTrustScoresTable.userId, job.authorId))
    .limit(1);
  const joinedAt = author?.createdAt ? new Date(author.createdAt).getTime() : 0;
  const isNewAccount = joinedAt > 0 && Date.now() - joinedAt < 14 * 24 * 60 * 60 * 1000 && (trust?.uti ?? 50) <= 50;
  return {
    ...job,
    skills: normalizeSkills(job.skills),
    author: author ? { ...author, trustTier: isNewAccount ? "new" : (trust?.tier ?? "new"), trustScore: trust?.uti ?? 50 } : author,
  };
}

router.get("/", async (req, res) => {
  const viewerId = getViewerId(req);
  const type = req.query.type as string | undefined;
  const category = req.query.category as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const now = new Date();

  const conds = [
    eq(jobsTable.isActive, true),
    eq(jobsTable.isApproved, true),
    eq(jobsTable.moderationStatus, "published"),
    or(isNull(jobsTable.expiresAt), gt(jobsTable.expiresAt, now)),
  ];
  if (type) conds.push(eq(jobsTable.type, type));
  if (category) conds.push(eq(jobsTable.category, category));

  const jobs = await db
    .select()
    .from(jobsTable)
    .where(and(...conds))
    .orderBy(
      // Featured (and not expired) first
      sql`(case when ${jobsTable.isFeatured} = true and (${jobsTable.featuredUntil} is null or ${jobsTable.featuredUntil} > now()) then 0 else 1 end)`,
      desc(jobsTable.createdAt),
    )
    .limit(limit)
    .offset((page - 1) * limit);

  const enriched = await Promise.all(jobs.map((j) => enrichJob(j, viewerId)));
  return res.json({ jobs: enriched, total: enriched.length, page });
});

router.post("/", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const {
    title, description, type, skills, compensation, remote, location,
    isPaid, budget, companyName, applyUrl, applyEmail, category,
  } = req.body;
  if (!title || !description || !type) {
    return res.status(400).json({ error: "Title, description, and type are required" });
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  const isSuspicious = SCAM_PATTERNS.some((pattern) => pattern.test(`${title} ${description}`));

  const [job] = await db.insert(jobsTable).values({
    authorId: viewerId,
    title,
    description,
    type,
    skills: JSON.stringify(normalizeSkills(skills)),
    compensation: compensation || null,
    remote: remote ?? true,
    location: location || null,
    isPaid: isPaid ?? false,
    budget: budget ?? null,
    companyName: companyName || null,
    applyUrl: applyUrl || null,
    applyEmail: applyEmail || null,
    category: category || null,
    expiresAt,
    isApproved: !isSuspicious,
    moderationStatus: isSuspicious ? "under_review" : "published",
  }).returning();

  if (isSuspicious) {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "super_admin"]));
    await Promise.all(admins.map((admin) => notify({
      userId: admin.id,
      actorId: 0,
      type: "admin_alert",
      title: "Job listing needs review",
      message: `Potential upfront-fee language was detected in job listing "${String(title).slice(0, 120)}" (job #${job.id}).`,
      url: "/admin?tab=content",
    })));
  }

  const enriched = await enrichJob(job, viewerId);
  try {
    const { dispatchWebhook } = await import("../features/distribution/webhooks.service");
    void dispatchWebhook({
      userId: viewerId,
      event: "job.created",
      data: { jobId: job.id, title: job.title, type: job.type, isPaid: job.isPaid },
    });
  } catch { /* webhook is best-effort */ }
  return res.status(201).json({
    ...enriched,
    message: isSuspicious ? "Your listing is being reviewed" : undefined,
  });
});

const applyOpportunitySchema = z.object({
  mode: z.enum(["apply", "apply_and_message"]),
  message: z.string().max(5_000).optional(),
  proposedBudget: z.number().positive().optional(),
  proposedCurrency: z.string().length(3).default("USD"),
});

router.post("/:id/apply", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid opportunity id" });

  const parsed = applyOpportunitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid application" });
  const data = parsed.data;
  const [job] = await db.select().from(jobsTable).where(and(eq(jobsTable.id, id), eq(jobsTable.isActive, true)));
  if (!job) return res.status(404).json({ error: "Opportunity not found" });
  if (job.authorId === viewerId) return res.status(400).json({ error: "You cannot apply to your own opportunity" });

  const [existing] = await db.select({ id: opportunityApplicationsTable.id })
    .from(opportunityApplicationsTable)
    .where(and(eq(opportunityApplicationsTable.jobId, id), eq(opportunityApplicationsTable.applicantId, viewerId)));
  if (existing) return res.status(409).json({ error: "You have already applied to this opportunity" });

  let conversationId: number | null = null;
  const result = await db.transaction(async (tx) => {
    if (data.mode === "apply_and_message") {
      const [conversation] = await tx.insert(conversationsTable).values({ isGroup: false, opportunityId: id }).returning();
      conversationId = conversation.id;
      await tx.insert(conversationParticipantsTable).values([
        { conversationId: conversation.id, userId: viewerId, unreadCount: 0 },
        { conversationId: conversation.id, userId: job.authorId, unreadCount: 1 },
      ]);
      await tx.insert(messagesTable).values({
        conversationId: conversation.id,
        senderId: viewerId,
        content: data.message?.trim() || `I would like to apply for ${job.title}.`,
        deliveredAt: new Date(),
      });
    }
    const [application] = await tx.insert(opportunityApplicationsTable).values({
      jobId: id,
      applicantId: viewerId,
      message: data.message?.trim() || null,
      proposedBudget: data.proposedBudget ?? null,
      proposedCurrency: data.proposedCurrency.toUpperCase(),
      conversationId,
    }).returning();
    return application;
  });

  await notify({ userId: job.authorId, actorId: viewerId, type: "system", title: "New opportunity application", message: `Someone applied to "${job.title.slice(0, 100)}".`, url: conversationId ? `/messages?conv=${conversationId}` : "/workspace?tab=work" });
  return res.status(201).json({ application: result, conversationId });
});

router.get("/applications", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const applications = await db.select({
    id: opportunityApplicationsTable.id,
    jobId: opportunityApplicationsTable.jobId,
    applicantId: opportunityApplicationsTable.applicantId,
    message: opportunityApplicationsTable.message,
    proposedBudget: opportunityApplicationsTable.proposedBudget,
    proposedCurrency: opportunityApplicationsTable.proposedCurrency,
    status: opportunityApplicationsTable.status,
    conversationId: opportunityApplicationsTable.conversationId,
    createdAt: opportunityApplicationsTable.createdAt,
    jobTitle: jobsTable.title,
    jobAuthorId: jobsTable.authorId,
  }).from(opportunityApplicationsTable)
    .innerJoin(jobsTable, eq(jobsTable.id, opportunityApplicationsTable.jobId))
    .where(or(eq(opportunityApplicationsTable.applicantId, viewerId), eq(jobsTable.authorId, viewerId)))
    .orderBy(desc(opportunityApplicationsTable.createdAt));
  return res.json({ applications });
});

// ── GET /my-matches - top matched opportunities for the logged-in creator ──────
router.get("/my-matches", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  // 1. Pull creator context in parallel
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const [userRow, cpRow, trustRow, topicFollowRows, recentPostRows] = await Promise.all([
    db.select({ identityType: usersTable.identityType, hireMeEnabled: usersTable.hireMeEnabled })
      .from(usersTable).where(eq(usersTable.id, viewerId)).limit(1),
    db.select({ skills: creatorProfilesTable.skills })
      .from(creatorProfilesTable).where(eq(creatorProfilesTable.userId, viewerId)).limit(1),
    db.select({ uti: userTrustScoresTable.uti, tier: userTrustScoresTable.tier })
      .from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, viewerId)).limit(1),
    db.select({ topicId: topicFollowsTable.topicId })
      .from(topicFollowsTable).where(eq(topicFollowsTable.userId, viewerId)),
    db.select({ id: postsTable.id })
      .from(postsTable)
      .where(and(eq(postsTable.authorId, viewerId), gte(postsTable.createdAt, thirtyDaysAgo)))
      .limit(10),
  ]);

  // 2. Resolve topic names
  const topicIds = topicFollowRows.map(r => r.topicId);
  const topicNames: string[] = [];
  if (topicIds.length > 0) {
    const topicRows = await db.select({ name: topicsTable.name })
      .from(topicsTable).where(inArray(topicsTable.id, topicIds));
    topicNames.push(...topicRows.map(r => r.name));
  }

  const userSkills: string[] = JSON.parse(cpRow[0]?.skills ?? "[]");
  const identityType = userRow[0]?.identityType ?? null;
  const trustUti = trustRow[0]?.uti ?? 0;
  const trustTier = trustRow[0]?.tier ?? "new";
  const recentPosts = Math.min(recentPostRows.length, 5);

  // 3. Pull active jobs
  const now = new Date();
  const jobs = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.isActive, true), eq(jobsTable.isApproved, true),
      eq(jobsTable.moderationStatus, "published"),
      or(isNull(jobsTable.expiresAt), gt(jobsTable.expiresAt, now))))
    .orderBy(desc(jobsTable.createdAt))
    .limit(50);

  // 4. Score and rank
  const scored = jobs
    .map(job => {
      const { score, reasons } = scoreJobForCreator(
        job, userSkills, topicNames, identityType, trustUti, trustTier, recentPosts,
      );
      return { job, score, reasons };
    })
    .filter(r => r.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const enriched = await Promise.all(scored.map(async r => {
    const enrichedJob = await enrichJob(r.job, viewerId);
    return { ...enrichedJob, matchScore: r.score, matchReasons: r.reasons };
  }));

  return res.json({ matches: enriched });
});

// ── GET /:id/creator-matches - top creators matching a specific job ────────────
router.get("/:id/creator-matches", async (req, res) => {
  const viewerId = getViewerId(req);
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) return res.status(404).json({ error: "Not found" });

  const jobSkillsArr: string[] = JSON.parse(job.skills || "[]");
  const jobText = `${job.title} ${job.description} ${job.category ?? ""} ${jobSkillsArr.join(" ")}`.toLowerCase();

  // Pull all hireable creators
  const hireableUsers = await db.select({
    id: usersTable.id,
    identityType: usersTable.identityType,
  }).from(usersTable).where(eq(usersTable.hireMeEnabled, true)).limit(100);

  const now30 = new Date(Date.now() - 30 * 24 * 60 * 60_000);

  const scored = await Promise.all(hireableUsers.map(async u => {
    const [cpRow, trustRow, topicFollowRows, recentPostRows] = await Promise.all([
      db.select({ skills: creatorProfilesTable.skills })
        .from(creatorProfilesTable).where(eq(creatorProfilesTable.userId, u.id)).limit(1),
      db.select({ uti: userTrustScoresTable.uti, tier: userTrustScoresTable.tier })
        .from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, u.id)).limit(1),
      db.select({ topicId: topicFollowsTable.topicId })
        .from(topicFollowsTable).where(eq(topicFollowsTable.userId, u.id)),
      db.select({ id: postsTable.id })
        .from(postsTable)
        .where(and(eq(postsTable.authorId, u.id), gte(postsTable.createdAt, now30))).limit(5),
    ]);

    const topicIds = topicFollowRows.map(r => r.topicId);
    const topicNames: string[] = [];
    if (topicIds.length > 0) {
      const rows = await db.select({ name: topicsTable.name })
        .from(topicsTable).where(inArray(topicsTable.id, topicIds));
      topicNames.push(...rows.map(r => r.name));
    }

    const creatorSkills: string[] = JSON.parse(cpRow[0]?.skills ?? "[]");
    const { score, reasons } = scoreCreatorForJob(
      jobSkillsArr, jobText, creatorSkills, topicNames,
      u.identityType, trustRow[0]?.uti ?? 0, trustRow[0]?.tier ?? "new",
      Math.min(recentPostRows.length, 5),
    );
    return { userId: u.id, score, reasons };
  }));

  const top = scored.filter(r => r.score >= 10).sort((a, b) => b.score - a.score).slice(0, 8);
  const enriched = await Promise.all(top.map(async r => {
    const user = await getUserWithCounts(r.userId, viewerId);
    return { ...user, matchScore: r.score, matchReasons: r.reasons };
  }));

  return res.json({ creators: enriched.filter(Boolean) });
});

router.get("/creators", async (req, res) => {
  const viewerId = getViewerId(req);
  const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
  const page = parseInt(req.query.page as string) || 1;

  const creators = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      bio: usersTable.bio,
    })
    .from(usersTable)
    .where(eq(usersTable.hireMeEnabled, true))
    .limit(limit)
    .offset((page - 1) * limit);

  const enriched = await Promise.all(creators.map(c => getUserWithCounts(c.id, viewerId)));
  return res.json({ creators: enriched.filter(Boolean), total: enriched.length, page });
});

router.get("/:id", async (req, res) => {
  const viewerId = getViewerId(req);
  const id = parseInt(req.params.id);

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) return res.status(404).json({ error: "Job not found" });

  // Fire-and-forget view increment (non-blocking, never crashes the request)
  void db
    .update(jobsTable)
    .set({ viewCount: sql`${jobsTable.viewCount} + 1` })
    .where(eq(jobsTable.id, id))
    .catch(() => undefined);

  const enriched = await enrichJob(job, viewerId);
  return res.json(enriched);
});

router.post("/:id/click", async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db
    .update(jobsTable)
    .set({ clickCount: sql`${jobsTable.clickCount} + 1` })
    .where(eq(jobsTable.id, id));
  return res.json({ ok: true });
});

export default router;
