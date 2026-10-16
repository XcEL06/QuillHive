import { Router } from "express";
import { db } from "@workspace/db";
import {
  jobsTable, usersTable, topicFollowsTable, topicsTable,
  creatorProfilesTable, creatorAvailabilityTable, userTrustScoresTable, postsTable,
  opportunityApplicationsTable, conversationsTable, conversationParticipantsTable, messagesTable, collaborationRoomsTable,
} from "@workspace/db/schema";
import { eq, desc, and, or, isNull, gt, sql, inArray, gte } from "drizzle-orm";
import { z } from "zod";
import { getSessionUserId } from "../lib/auth";
import { getUserWithCounts } from "../features/profiles/profile.service";
import { notify } from "../features/notifications/notification.service";
import {
  DEFAULT_OPPORTUNITY_LIFETIME_MS,
  decideOpportunityApplication,
  getOpportunityExpiry,
  isOpportunityExpired,
  resolveCompletionAction,
} from "../features/creator-economy/opportunityWorkflow";

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
  const effectiveExpiry = getOpportunityExpiry(job.expiresAt, new Date(job.createdAt));
  return {
    ...job,
    expiresAt: effectiveExpiry,
    isActive: Boolean(job.isActive) && !isOpportunityExpired(job.expiresAt, new Date(job.createdAt)),
    skills: normalizeSkills(job.skills),
    author: author ? {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      createdAt: author.createdAt,
      headline: author.headline,
      trustTier: isNewAccount ? "new" : (trust?.tier ?? "new"),
      trustScore: trust?.uti ?? 50,
    } : null,
  };
}

router.get("/", async (req, res) => {
  const viewerId = getViewerId(req);
  const type = req.query.type as string | undefined;
  const category = req.query.category as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const now = new Date();

  const publicListing = and(
    eq(jobsTable.isActive, true),
    eq(jobsTable.isApproved, true),
    eq(jobsTable.moderationStatus, "published"),
    or(
      gt(jobsTable.expiresAt, now),
      and(isNull(jobsTable.expiresAt), gt(jobsTable.createdAt, new Date(now.getTime() - DEFAULT_OPPORTUNITY_LIFETIME_MS))),
    ),
  );
  const conds = viewerId
    ? [or(publicListing, eq(jobsTable.authorId, viewerId))!]
    : [publicListing!];
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

const jobInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(50_000),
  type: z.string().trim().min(1).max(50),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  compensation: z.string().max(200).nullable().optional(),
  feeDetails: z.string().trim().max(2_000).nullable().optional(),
  expiresAt: z.string().datetime().optional(),
  remote: z.boolean().optional(),
  location: z.string().max(200).nullable().optional(),
  isPaid: z.boolean().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  companyName: z.string().max(200).nullable().optional(),
  applyUrl: z.string().url().nullable().optional(),
  applyEmail: z.string().email().nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

const createJobSchema = jobInputSchema.extend({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(50_000),
  type: z.string().trim().min(1).max(50),
});

router.post("/", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid opportunity" });
  const data = parsed.data;
  const { title, description, type, skills, compensation, remote, location,
    feeDetails, expiresAt: requestedExpiry, isPaid, budget, companyName, applyUrl, applyEmail, category, isActive } = data;

  const expiresAt = requestedExpiry
    ? new Date(requestedExpiry)
    : new Date(Date.now() + DEFAULT_OPPORTUNITY_LIFETIME_MS);
  if (expiresAt <= new Date()) return res.status(400).json({ error: "The opportunity end date must be in the future" });
  const isSuspicious = SCAM_PATTERNS.some((pattern) => pattern.test(`${title} ${description}`));

  const [job] = await db.insert(jobsTable).values({
    authorId: viewerId,
    title,
    description,
    type,
    skills: JSON.stringify(normalizeSkills(skills)),
    compensation: compensation || null,
    feeDetails: feeDetails || null,
    remote: remote ?? true,
    location: location || null,
    isPaid: isPaid ?? false,
    budget: budget ?? null,
    companyName: companyName || null,
    applyUrl: applyUrl || null,
    applyEmail: applyEmail || null,
    category: category || null,
    isActive: isActive ?? true,
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

const updateJobSchema = jobInputSchema.partial().refine(data => Object.keys(data).length > 0, "At least one field is required");

router.patch("/:id", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid opportunity id" });

  const parsed = updateJobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid opportunity" });

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) return res.status(404).json({ error: "Opportunity not found" });
  if (job.authorId !== viewerId) return res.status(403).json({ error: "Forbidden" });

  const data = parsed.data;
  const nextExpiry = data.expiresAt ? new Date(data.expiresAt) : job.expiresAt;
  if (data.expiresAt && (!nextExpiry || nextExpiry <= new Date())) {
    return res.status(400).json({ error: "The opportunity end date must be in the future" });
  }
  if (data.isActive === true && (!nextExpiry || nextExpiry <= new Date())) {
    return res.status(400).json({ error: "Choose a future end date before reopening this opportunity" });
  }
  const { skills, expiresAt: requestedExpiry, ...jobFields } = data;
  const update: Partial<typeof jobsTable.$inferInsert> = {
    ...jobFields,
    ...(requestedExpiry ? { expiresAt: new Date(requestedExpiry) } : {}),
    ...(skills ? { skills: JSON.stringify(skills) } : {}),
  };
  const nextTitle = data.title ?? job.title;
  const nextDescription = data.description ?? job.description;
  const isSuspicious = SCAM_PATTERNS.some(pattern => pattern.test(`${nextTitle} ${nextDescription}`));
  if (isSuspicious) {
    update.isApproved = false;
    update.moderationStatus = "under_review";
  }

  const [updated] = await db.update(jobsTable).set(update).where(eq(jobsTable.id, id)).returning();
  return res.json(await enrichJob(updated, viewerId));
});

router.delete("/:id", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid opportunity id" });

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) return res.status(404).json({ error: "Opportunity not found" });
  if (job.authorId !== viewerId) return res.status(403).json({ error: "Forbidden" });

  await db.transaction(async (tx) => {
    await tx.update(conversationsTable)
      .set({ opportunityId: null })
      .where(eq(conversationsTable.opportunityId, id));
    await tx.delete(opportunityApplicationsTable).where(eq(opportunityApplicationsTable.jobId, id));
    await tx.delete(jobsTable).where(eq(jobsTable.id, id));
  });

  return res.json({ ok: true, deleted: true });
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
  const now = new Date();
  const [job] = await db.select().from(jobsTable).where(and(
    eq(jobsTable.id, id),
    eq(jobsTable.isActive, true),
    eq(jobsTable.isApproved, true),
    eq(jobsTable.moderationStatus, "published"),
    or(
      gt(jobsTable.expiresAt, now),
      and(isNull(jobsTable.expiresAt), gt(jobsTable.createdAt, new Date(now.getTime() - DEFAULT_OPPORTUNITY_LIFETIME_MS))),
    ),
  ));
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

  await notify({ userId: job.authorId, actorId: viewerId, type: "system", title: "New opportunity application", message: `Someone applied to "${job.title.slice(0, 100)}".`, url: `/opportunities/${job.id}` });
  return res.status(201).json({ application: result, conversationId });
});

router.get("/applications", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const requestedJobId = req.query.jobId === undefined ? undefined : Number(req.query.jobId);
  if (requestedJobId !== undefined && (!Number.isInteger(requestedJobId) || requestedJobId <= 0)) {
    return res.status(400).json({ error: "Invalid opportunity id" });
  }
  const conditions = [or(eq(opportunityApplicationsTable.applicantId, viewerId), eq(jobsTable.authorId, viewerId))!];
  if (requestedJobId !== undefined) conditions.push(eq(opportunityApplicationsTable.jobId, requestedJobId));

  const applications = await db.select({
    id: opportunityApplicationsTable.id,
    jobId: opportunityApplicationsTable.jobId,
    applicantId: opportunityApplicationsTable.applicantId,
    message: opportunityApplicationsTable.message,
    proposedBudget: opportunityApplicationsTable.proposedBudget,
    proposedCurrency: opportunityApplicationsTable.proposedCurrency,
    status: opportunityApplicationsTable.status,
    conversationId: opportunityApplicationsTable.conversationId,
    completionRequestedById: opportunityApplicationsTable.completionRequestedById,
    completedAt: opportunityApplicationsTable.completedAt,
    createdAt: opportunityApplicationsTable.createdAt,
    jobTitle: jobsTable.title,
    jobAuthorId: jobsTable.authorId,
    applicant: {
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    },
  }).from(opportunityApplicationsTable)
    .innerJoin(jobsTable, eq(jobsTable.id, opportunityApplicationsTable.jobId))
    .innerJoin(usersTable, eq(usersTable.id, opportunityApplicationsTable.applicantId))
    .where(and(...conditions))
    .orderBy(desc(opportunityApplicationsTable.createdAt));
  return res.json({ applications: applications.map(application => ({
    ...application,
    isMine: application.applicantId === viewerId,
    isOwner: application.jobAuthorId === viewerId,
  })) });
});

router.patch("/applications/:applicationId", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const applicationId = Number(req.params.applicationId);
  if (!Number.isInteger(applicationId) || applicationId <= 0) return res.status(400).json({ error: "Invalid application id" });
  const action = req.body?.action;
  if (!["accepted", "rejected", "cancelled"].includes(action)) {
    return res.status(400).json({ error: "Action must be accepted, rejected, or cancelled" });
  }

  const result = await db.transaction(async tx => {
    const [application] = await tx.select().from(opportunityApplicationsTable)
      .where(eq(opportunityApplicationsTable.id, applicationId))
      .for("update");
    if (!application) return { kind: "missing" as const };
    const [job] = await tx.select().from(jobsTable).where(eq(jobsTable.id, application.jobId));
    if (!job) return { kind: "missing" as const };

    const isOwner = job.authorId === viewerId;
    const isApplicant = application.applicantId === viewerId;
    const decision = decideOpportunityApplication({
      status: application.status,
      action,
      isOwner,
      isApplicant,
    });
    if (decision === "forbidden") return { kind: "forbidden" as const };
    if (decision === "conflict") return { kind: "conflict" as const };
    if (action === "cancelled") {
      if (decision === "idempotent") return { kind: "updated" as const, application, room: null };

      const [updated] = await tx.update(opportunityApplicationsTable).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(and(
        eq(opportunityApplicationsTable.id, applicationId),
        eq(opportunityApplicationsTable.status, application.status),
      )).returning();
      if (!updated) return { kind: "conflict" as const };
      const [room] = await tx.update(collaborationRoomsTable).set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(collaborationRoomsTable.opportunityApplicationId, applicationId))
        .returning({ id: collaborationRoomsTable.id });
      return { kind: "updated" as const, application: updated, room: room ?? null };
    }

    if (decision === "idempotent") {
      const [room] = await tx.select().from(collaborationRoomsTable)
        .where(eq(collaborationRoomsTable.opportunityApplicationId, applicationId));
      if (room && room.status !== "cancelled") return { kind: "updated" as const, application, room };
      return { kind: "conflict" as const };
    }
    if (application.status !== "pending") return { kind: "conflict" as const };
    if (action === "accepted" && (!job.isActive || !job.isApproved || job.moderationStatus !== "published" ||
      isOpportunityExpired(job.expiresAt, job.createdAt))) {
      return { kind: "opportunity_closed" as const };
    }

    const [updated] = await tx.update(opportunityApplicationsTable).set({
      status: action,
      updatedAt: new Date(),
    }).where(and(
      eq(opportunityApplicationsTable.id, applicationId),
      eq(opportunityApplicationsTable.status, "pending"),
    )).returning();
    if (!updated) return { kind: "conflict" as const };
    if (action === "rejected") return { kind: "updated" as const, application: updated, room: null };

    const brief = [
      `Opportunity: ${job.title}`,
      job.description,
      job.feeDetails?.trim() ? `Fee and payment terms: ${job.feeDetails.trim()}` : "",
      application.proposedBudget !== null
        ? `Applicant's proposed fee: ${application.proposedCurrency} ${application.proposedBudget}`
        : "",
      application.message?.trim() ? `Applicant note: ${application.message.trim()}` : "",
    ].filter(Boolean).join("\n\n");
    await tx.insert(collaborationRoomsTable).values({
      requestId: null,
      opportunityApplicationId: applicationId,
      createdById: viewerId,
      title: job.title,
      brief,
    }).onConflictDoNothing({
      target: collaborationRoomsTable.opportunityApplicationId,
    });
    const [room] = await tx.select().from(collaborationRoomsTable)
      .where(eq(collaborationRoomsTable.opportunityApplicationId, applicationId));
    if (!room) throw new Error("Accepted application workspace could not be created");
    return { kind: "updated" as const, application: updated, room };
  });

  if (result.kind === "missing") return res.status(404).json({ error: "Application not found" });
  if (result.kind === "forbidden") return res.status(403).json({ error: "Only the opportunity owner can accept or reject applications; either participant can cancel" });
  if (result.kind === "conflict") return res.status(409).json({ error: "This application can no longer be changed" });
  if (result.kind === "opportunity_closed") return res.status(409).json({ error: "This opportunity is no longer available" });
  return res.json({ application: result.application, room: result.room });
});

router.post("/applications/:applicationId/completion", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const applicationId = Number(req.params.applicationId);
  if (!Number.isInteger(applicationId) || applicationId <= 0) return res.status(400).json({ error: "Invalid application id" });
  if (!["request", "confirm"].includes(req.body?.action)) return res.status(400).json({ error: "Action must be request or confirm" });

  const result = await db.transaction(async tx => {
    const [application] = await tx.select().from(opportunityApplicationsTable)
      .where(eq(opportunityApplicationsTable.id, applicationId))
      .for("update");
    if (!application) return { kind: "missing" as const };
    const [job] = await tx.select({ authorId: jobsTable.authorId }).from(jobsTable)
      .where(eq(jobsTable.id, application.jobId));
    if (!job) return { kind: "missing" as const };
    if (viewerId !== job.authorId && viewerId !== application.applicantId) return { kind: "forbidden" as const };
    const completionDecision = resolveCompletionAction({
      status: application.status,
      requestedById: application.completionRequestedById,
      actorId: viewerId,
      action: req.body.action,
    });
    if (completionDecision === "completed") return { kind: "completed" as const, application };
    if (completionDecision === "conflict") return { kind: "conflict" as const };

    if (req.body.action === "request") {
      if (completionDecision === "confirmation_required") return { kind: "confirmation_required" as const };
      if (completionDecision === "already_requested") return { kind: "already_requested" as const };
      const [updated] = await tx.update(opportunityApplicationsTable).set({
        completionRequestedById: viewerId,
        updatedAt: new Date(),
      }).where(and(
        eq(opportunityApplicationsTable.id, applicationId),
        eq(opportunityApplicationsTable.status, "accepted"),
      )).returning();
      return updated ? { kind: "requested" as const, application: updated } : { kind: "conflict" as const };
    }

    if (completionDecision !== "complete") return { kind: "confirmation_required" as const };
    const completedAt = new Date();
    const [updated] = await tx.update(opportunityApplicationsTable).set({
      status: "completed",
      completedAt,
      updatedAt: completedAt,
    }).where(and(
      eq(opportunityApplicationsTable.id, applicationId),
      eq(opportunityApplicationsTable.status, "accepted"),
    )).returning();
    if (!updated) return { kind: "conflict" as const };
    await tx.update(collaborationRoomsTable).set({ status: "completed", updatedAt: completedAt })
      .where(eq(collaborationRoomsTable.opportunityApplicationId, applicationId));
    return { kind: "completed" as const, application: updated };
  });

  if (result.kind === "missing") return res.status(404).json({ error: "Application not found" });
  if (result.kind === "forbidden") return res.status(403).json({ error: "Forbidden" });
  if (result.kind === "conflict") return res.status(409).json({ error: "Only accepted applications can be marked complete" });
  if (result.kind === "confirmation_required") return res.status(409).json({ error: "The other participant must request completion before you confirm it" });
  if (result.kind === "already_requested") return res.status(409).json({ error: "Completion is awaiting confirmation from the other participant" });
  return res.json({ application: result.application, completed: result.kind === "completed" });
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
      or(
        gt(jobsTable.expiresAt, now),
        and(isNull(jobsTable.expiresAt), gt(jobsTable.createdAt, new Date(now.getTime() - DEFAULT_OPPORTUNITY_LIFETIME_MS))),
      )))
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
  }).from(creatorAvailabilityTable)
    .innerJoin(usersTable, and(
      eq(usersTable.id, creatorAvailabilityTable.userId),
      eq(usersTable.isDeleted, false),
      eq(usersTable.isBanned, false),
      eq(usersTable.showInSearch, true),
      eq(usersTable.profileVisibility, "public"),
    ))
    .where(or(eq(creatorAvailabilityTable.status, "available"), eq(creatorAvailabilityTable.status, "open_to_opportunities")))
    .limit(100);

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
    .from(creatorAvailabilityTable)
    .innerJoin(usersTable, and(
      eq(usersTable.id, creatorAvailabilityTable.userId),
      eq(usersTable.isDeleted, false),
      eq(usersTable.isBanned, false),
      eq(usersTable.showInSearch, true),
      eq(usersTable.profileVisibility, "public"),
    ))
    .where(or(eq(creatorAvailabilityTable.status, "available"), eq(creatorAvailabilityTable.status, "open_to_opportunities")))
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

  if (job.authorId !== viewerId) {
    // Fire-and-forget view increment (non-blocking, never crashes the request)
    void db
      .update(jobsTable)
      .set({ viewCount: sql`${jobsTable.viewCount} + 1` })
      .where(eq(jobsTable.id, id))
      .catch(() => undefined);
  }

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
