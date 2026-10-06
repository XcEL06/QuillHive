import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { db } from "@workspace/db";
import { groupsTable, groupMembersTable, groupJoinRequestsTable, groupBansTable, groupPostDetailsTable, groupPinnedPostsTable, groupActivityLogsTable, postsTable, jobsTable, userTrustScoresTable, commentsTable, reportsTable, usersTable } from "@workspace/db/schema";
import { eq, and, sql, ilike, desc, inArray, gte } from "drizzle-orm";
import { getSessionUserId } from "../lib/auth";
import { loadCurrentUser } from "../lib/auth-types";
import { enrichPost } from "../features/profiles/profile.service";
import { postVisibilityCondition } from "../features/posts/postVisibility";
import { sanitizeRichText } from "../lib/sanitize";

const router = Router();
router.param("id", async (req: Request, res: Response, next: NextFunction, id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return next();
  try {
    const [group] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.publicId, id));
    if (!group) return res.status(404).json({ error: "Group not found" });
    req.params.id = String(group.id);
    return next();
  } catch (error) {
    return next(error);
  }
});

export function normalizeGroupCreateInput(input: Record<string, any> = {}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const requestedType = typeof input.type === "string" ? input.type.trim().toLowerCase() : "";
  const legacyPrivacy = typeof input.privacy === "string" ? input.privacy.trim().toLowerCase() : "";
  if (legacyPrivacy && !["open", "public", "private"].includes(legacyPrivacy)) throw new Error("Group privacy must be open, public, or private");
  const type = requestedType === "secret" ? "private" : requestedType || (legacyPrivacy === "private" ? "private" : "public");
  const explicitPrivacy = ["open", "public", "private"].includes(legacyPrivacy);
  const privacy = explicitPrivacy
    ? legacyPrivacy
    : requestedType === "secret"
      ? "private"
      : requestedType === "private"
        ? "public"
        : "open";

  if (!name) throw new Error("Name is required");
  if (name.length > 80) throw new Error("Group name must be 80 characters or fewer");
  if (!["public", "private", "secret"].includes(type)) throw new Error("Group type must be public, private, or secret");
  if (!["open", "public", "private"].includes(privacy)) throw new Error("Group privacy must be open, public, or private");

  const description = typeof input.description === "string" ? input.description.trim() || null : input.description ?? null;
  if (typeof description === "string" && description.length > 280) throw new Error("Description must be 280 characters or fewer");
  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : "general";
  const rules = Array.isArray(input.rules)
    ? input.rules
    : typeof input.rules === "string"
      ? input.rules.split("\n")
      : [];
  const normalizedRules = rules.map((rule: unknown) => String(rule).trim()).filter(Boolean);
  if (normalizedRules.length > 5 || normalizedRules.some((rule: string) => rule.length > 240)) {
    throw new Error("Groups can have up to 5 rules, each 240 characters or fewer");
  }
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag: unknown): tag is string => typeof tag === "string").map((tag: string) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 20)
    : [];
  const coverImage = input.coverImage || input.coverUrl || null;
  const iconImage = input.iconImage || input.avatarUrl || null;

  return {
    name,
    description,
    category,
    tags,
    iconImage,
    avatarUrl: iconImage,
    coverImage,
    coverUrl: coverImage,
    privacy,
    type,
    rules: normalizedRules,
    isAnnouncementOnly: Boolean(input.isAnnouncementOnly),
    features: { eventsEnabled: false },
  };
}

export function canCreateGroupPost({ status, role, isAnnouncementOnly, announcementPolicy = "admins", type, mutedUntil }: {
  status: string;
  role: string;
  isAnnouncementOnly: boolean;
  announcementPolicy?: string;
  type: string;
  mutedUntil?: Date | string | null;
}): boolean {
  const muteExpired = status === "muted" && mutedUntil != null && new Date(mutedUntil).getTime() <= Date.now();
  if (status !== "active" && !muteExpired) return false;
  if (type === "announcement") return announcementPolicy === "owner" ? role === "owner" : ["owner", "admin"].includes(role);
  if (isAnnouncementOnly) return false;
  if (type === "opportunity_reshare") return true;
  return ["discussion", "poll", "question"].includes(type);
}

function makeGroupSlug(name: string, ownerId: number): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "community";
  return `${base}-${ownerId}-${Date.now().toString(36)}`;
}

export function groupCreateErrorMessage(error: unknown): string {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && ["42703", "42P01", "42704", "42883", "42701"].includes(code)) {
      return "Group creation is temporarily unavailable because the database schema needs an update. Please try again later.";
    }
    current = (current as { cause?: unknown }).cause;
  }
  return "Could not create group. Please try again.";
}

export function canViewGroupPosts(privacy: string, isMember: boolean, isSuperAdmin: boolean): boolean {
  return privacy !== "private" || isMember || isSuperAdmin;
}

export function getGroupJoinAction(privacy: string): "join" | "request" | "invite" {
  if (privacy === "private") return "invite";
  if (privacy === "public") return "request";
  return "join";
}

function getViewerId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getSessionUserId(auth.slice(7));
}

async function getGroupRole(groupId: number, userId: number): Promise<string | null> {
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (group?.creatorId === userId) return "owner";
  const [member] = await db.select({ role: groupMembersTable.role, status: groupMembersTable.status })
    .from(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)));
  return member?.status === "active" ? member.role : null;
}

function canModerateGroup(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

async function enrichGroup(group: any, viewerId: number | null, isSuperAdmin = false) {
  const [membersResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(groupMembersTable).where(and(eq(groupMembersTable.groupId, group.id), inArray(groupMembersTable.status, ["active", "muted"])));

  const [postsResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(postsTable).where(and(eq(postsTable.groupId, group.id), eq(postsTable.isPublished, true), eq(postsTable.isDeleted, false), postVisibilityCondition(viewerId, isSuperAdmin)));

  let isMember = false;
  let memberRole: string | null = null;
  let hasPendingJoinRequest = false;
  if (viewerId) {
    const membership = await db.select({ role: groupMembersTable.role, status: groupMembersTable.status, mutedUntil: groupMembersTable.mutedUntil }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, viewerId)));
    isMember = ["active", "muted"].includes(membership[0]?.status ?? "");
    if (membership[0]?.status === "muted" && membership[0].mutedUntil && membership[0].mutedUntil <= new Date()) {
      await db.update(groupMembersTable).set({ status: "active", mutedUntil: null })
        .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, viewerId)));
      isMember = true;
    }
    memberRole = isMember ? membership[0]?.role ?? null : group.creatorId === viewerId ? "owner" : null;
    const [request] = await db.select({ id: groupJoinRequestsTable.id }).from(groupJoinRequestsTable)
      .where(and(eq(groupJoinRequestsTable.groupId, group.id), eq(groupJoinRequestsTable.userId, viewerId), eq(groupJoinRequestsTable.status, "pending")));
    hasPendingJoinRequest = Boolean(request);
  }

  return {
    ...group,
    ownerId: group.creatorId,
    memberCount: membersResult?.count ?? 0,
    postCount: postsResult?.count ?? 0,
    membersCount: membersResult?.count ?? 0,
    postsCount: postsResult?.count ?? 0,
    isMember,
    memberRole,
    hasPendingJoinRequest,
  };
}

router.get("/", async (req, res) => {
  const viewer = await loadCurrentUser(req);
  const viewerId = viewer?.id ?? null;
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;

  let query = db.select().from(groupsTable).where(search
    ? and(eq(groupsTable.isDeleted, false), eq(groupsTable.isArchived, false), ilike(groupsTable.name, `%${search}%`))
    : and(eq(groupsTable.isDeleted, false), eq(groupsTable.isArchived, false))).$dynamic();

  const groups = await query
    .orderBy(
      sql`(case when ${groupsTable.isPromoted} = true and (${groupsTable.promotedUntil} is null or ${groupsTable.promotedUntil} > now()) then 0 else 1 end)`,
      desc(groupsTable.createdAt),
    )
    .limit(limit)
    .offset((page - 1) * limit);
  const secretGroups = viewerId
    ? await db.select({ groupId: groupMembersTable.groupId }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.userId, viewerId), inArray(groupMembersTable.status, ["active", "muted"])))
    : [];
  const memberGroupIds = new Set(secretGroups.map((row) => row.groupId));
  const visibleGroups = groups.filter((group) => viewer?.role === "super_admin"
    || (group.privacy !== "private" && group.type !== "secret")
    || group.creatorId === viewerId
    || memberGroupIds.has(group.id));
  const enriched = await Promise.all(visibleGroups.map(g => enrichGroup(g, viewerId)));

  return res.json({ groups: enriched, total: enriched.length, page });
});

router.post("/", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });

  let normalized;
  try {
    normalized = normalizeGroupCreateInput(req.body ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid group payload";
    return res.status(400).json({ error: message });
  }

  try {
    const [group] = await db.transaction(async (tx) => {
      const [createdGroup] = await tx.insert(groupsTable).values({
        name: normalized.name,
        slug: makeGroupSlug(normalized.name, viewerId),
        description: normalized.description,
        category: normalized.category,
        tags: normalized.tags,
        iconImage: normalized.iconImage,
        coverImage: normalized.coverImage,
        avatarUrl: normalized.avatarUrl,
        coverUrl: normalized.coverUrl,
        creatorId: viewerId,
        privacy: normalized.privacy,
        type: normalized.type,
        rules: normalized.rules,
        isAnnouncementOnly: normalized.isAnnouncementOnly,
        features: normalized.features,
      }).returning();

      if (!createdGroup) {
        throw new Error("Failed to create group");
      }

      await tx.insert(groupMembersTable).values({
        groupId: createdGroup.id,
        userId: viewerId,
        role: "owner",
        trustScoreAtJoin: (await tx.select({ uti: userTrustScoresTable.uti }).from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, viewerId)))[0]?.uti ?? null,
      }).onConflictDoNothing();

      const [membership] = await tx.select({ id: groupMembersTable.id })
        .from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, createdGroup.id), eq(groupMembersTable.userId, viewerId)));

      if (!membership) {
        throw new Error("Creator membership was not recorded");
      }

      return [createdGroup] as const;
    });

    const enriched = await enrichGroup(group, viewerId);
    return res.status(201).json(enriched);
  } catch (error) {
    return res.status(500).json({ error: groupCreateErrorMessage(error) });
  }
});

const groupPostTypes = ["discussion", "poll", "question", "announcement"] as const;

router.post("/:id/posts", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) return res.status(400).json({ error: "Invalid group id" });

  const { content, title, type = "discussion", tags = [], poll, attachments = [] } = req.body ?? {};
  if (typeof content !== "string" || !content.trim() || content.length > 50_000) {
    return res.status(400).json({ error: "Post content is required and must be 50,000 characters or fewer." });
  }
  if (![...groupPostTypes, "opportunity_reshare"].includes(type)) {
    return res.status(400).json({ error: "Groups support discussions, polls, questions, and announcements. Use an opportunity's share action to bring it into the group." });
  }

  const [group] = await db.select({
    isAnnouncementOnly: groupsTable.isAnnouncementOnly,
    announcementPolicy: groupsTable.announcementPolicy,
    requireApprovalFirstThree: groupsTable.requireApprovalFirstThree,
    requireApprovalAll: groupsTable.requireApprovalAll,
    name: groupsTable.name,
  }).from(groupsTable).where(and(eq(groupsTable.id, groupId), eq(groupsTable.isDeleted, false)));
  if (!group) return res.status(404).json({ error: "Group not found" });
  const [membership] = await db.select({ role: groupMembersTable.role, status: groupMembersTable.status, mutedUntil: groupMembersTable.mutedUntil })
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, viewerId)));
  if (!membership) return res.status(403).json({ error: "Join this group before posting" });
  if (!canCreateGroupPost({ status: membership.status, role: membership.role, isAnnouncementOnly: group.isAnnouncementOnly, announcementPolicy: group.announcementPolicy, type, mutedUntil: membership.mutedUntil })) {
    return res.status(403).json({ error: "You do not have permission to create this post in the group." });
  }

  if (type === "announcement") {
    const [recentAnnouncement] = await db.select({ id: groupPostDetailsTable.id })
      .from(groupPostDetailsTable)
      .where(and(
        eq(groupPostDetailsTable.groupId, groupId),
        eq(groupPostDetailsTable.isAnnouncement, true),
        gte(groupPostDetailsTable.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ))
      .limit(1);
    if (recentAnnouncement) return res.status(429).json({ error: "This group can publish one announcement every 24 hours." });
  }
  if (membership.status === "muted" && membership.mutedUntil && membership.mutedUntil <= new Date()) {
    await db.update(groupMembersTable).set({ status: "active", mutedUntil: null })
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, viewerId)));
  }

  const [authorPostCount] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable)
    .where(and(eq(postsTable.groupId, groupId), eq(postsTable.authorId, viewerId), eq(postsTable.isDeleted, false)));
  const needsApproval = group.requireApprovalAll || (group.requireApprovalFirstThree && (authorPostCount?.count ?? 0) < 3);

  let pollData: { options: string[]; endsAt: string | null; allowMultiple: boolean; votes: Record<string, number[]> } | null = null;
  if (type === "poll") {
    const options = Array.isArray(poll?.options)
      ? poll.options.map((option: unknown) => typeof option === "string" ? option.trim().slice(0, 120) : "").filter(Boolean).slice(0, 6)
      : [];
    if (options.length < 2 || options.length > 5) return res.status(400).json({ error: "Polls need between two and five non-empty options." });
    const duration = ["1d", "3d", "1w", "never"].includes(poll.duration) ? poll.duration : "1d";
    const durationMs = duration === "1d" ? 24 * 60 * 60 * 1000 : duration === "3d" ? 3 * 24 * 60 * 60 * 1000 : duration === "1w" ? 7 * 24 * 60 * 60 * 1000 : null;
    const endsAt = durationMs ? new Date(Date.now() + durationMs).toISOString() : null;
    pollData = { options, endsAt, allowMultiple: Boolean(poll.allowMultiple), votes: {} };
  }

  if (type === "question" && (typeof title !== "string" || !title.trim())) {
    return res.status(400).json({ error: "Add a title to your question." });
  }
  const normalizedTags = Array.isArray(tags)
    ? tags.filter((tag: unknown): tag is string => typeof tag === "string").map((tag: string) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, type === "question" ? 3 : 12)
    : [];
  if (!Array.isArray(attachments) || attachments.length > 4 || attachments.some((attachment: any) => !attachment || typeof attachment.url !== "string" || !attachment.mimeType?.startsWith("image/"))) {
    return res.status(400).json({ error: "Group posts support up to four image attachments." });
  }
  const normalizedAttachments = attachments;
  const cleanContent = sanitizeRichText(content.trim());
  const [post] = await db.insert(postsTable).values({
    authorId: viewerId,
    title: typeof title === "string" ? title.trim().slice(0, 180) || null : null,
    content: cleanContent,
    excerpt: cleanContent.replace(/<[^>]*>/g, " ").slice(0, 500),
    type: "post",
    visibility: "public",
    tags: JSON.stringify(normalizedTags),
    attachments: JSON.stringify(normalizedAttachments),
    imageUrl: normalizedAttachments[0]?.url ?? null,
    groupId,
    isPublished: !needsApproval,
  }).returning();
  const [details] = await db.insert(groupPostDetailsTable).values({
    postId: post.id,
    groupId,
    type,
    poll: pollData,
    question: type === "question" ? { isAnswered: false, bestAnswerId: null } : null,
    isAnnouncement: type === "announcement",
    isPinned: type === "announcement",
    approvalStatus: needsApproval ? "pending" : "approved",
  }).returning();
  if (type === "announcement" && !needsApproval) {
    if (!needsApproval) await db.insert(groupPinnedPostsTable).values({ groupId, postId: post.id, pinnedBy: viewerId });
  }
  await db.insert(groupActivityLogsTable).values({
    groupId,
    actorId: viewerId,
    action: needsApproval ? "post_pending" : type === "announcement" ? "announcement_posted" : "post_created",
    details: { postId: post.id, type },
  });
  import("../features/mentions/mentions.routes")
    .then(module => module.processMentions(post.id, cleanContent, viewerId))
    .catch(() => {});
  if (type === "announcement") {
    const recipients = await db.select({ userId: groupMembersTable.userId })
      .from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), inArray(groupMembersTable.status, ["active", "muted"])));
    const { notify } = await import("../features/notifications/notification.service");
    await Promise.all(recipients.map(({ userId }) => notify({
      userId,
      actorId: viewerId,
      type: "group_announcement",
      title: "New group announcement",
      message: `A new announcement was posted in ${group.name}.`,
      url: `/g/${groupId}`,
      postId: post.id,
      groupId,
    })));
  }
  return res.status(201).json({ ...(await enrichPost(post, viewerId)), groupDetails: details });
});

router.post("/:id/opportunities/:opportunityId/reshare", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = Number(req.params.id);
  const opportunityId = Number(req.params.opportunityId);
  if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(opportunityId) || opportunityId <= 0) {
    return res.status(400).json({ error: "Invalid group or opportunity id" });
  }

  const [membership] = await db.select({ status: groupMembersTable.status })
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, viewerId)));
  if (!membership || membership.status !== "active") return res.status(403).json({ error: "Only active group members can reshare opportunities" });

  const [opportunity] = await db.select().from(jobsTable).where(and(
    eq(jobsTable.id, opportunityId),
    eq(jobsTable.isActive, true),
    eq(jobsTable.isApproved, true),
    eq(jobsTable.moderationStatus, "published"),
  ));
  if (!opportunity) return res.status(404).json({ error: "Opportunity not found or unavailable" });

  const snapshot = {
    title: opportunity.title,
    budget: opportunity.budget,
    currency: null,
    type: opportunity.type,
  };
  const [post] = await db.insert(postsTable).values({
    authorId: viewerId,
    title: opportunity.title.slice(0, 180),
    content: `<p>Shared an opportunity: <strong>${sanitizeRichText(opportunity.title)}</strong></p>`,
    excerpt: opportunity.title.slice(0, 500),
    type: "post",
    visibility: "public",
    groupId,
    isPublished: true,
  }).returning();
  const [details] = await db.insert(groupPostDetailsTable).values({
    postId: post.id,
    groupId,
    type: "opportunity_reshare",
    opportunityId,
    opportunitySnapshot: snapshot,
  }).returning();
  return res.status(201).json({ ...(await enrichPost(post, viewerId)), groupDetails: details });
});

router.post("/:id/posts/:postId/vote", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  const optionIndexes = Array.isArray(req.body?.optionIndexes) ? [...new Set(req.body.optionIndexes)] : [];
  if (!optionIndexes.length || optionIndexes.some((index: unknown) => !Number.isInteger(index))) {
    return res.status(400).json({ error: "Choose at least one poll option." });
  }

  const [membership] = await db.select({ status: groupMembersTable.status })
    .from(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, viewerId)));
  if (membership?.status !== "active") return res.status(403).json({ error: "Only active members can vote" });
  const [details] = await db.select().from(groupPostDetailsTable)
    .where(and(eq(groupPostDetailsTable.groupId, groupId), eq(groupPostDetailsTable.postId, postId)));
  if (!details || details.type !== "poll" || !details.poll) return res.status(404).json({ error: "Poll not found" });

  const poll = details.poll;
  if (poll.endsAt && Date.parse(poll.endsAt) <= Date.now()) return res.status(400).json({ error: "This poll has ended" });
  if (optionIndexes.some((index: number) => index < 0 || index >= poll.options.length)) return res.status(400).json({ error: "Invalid poll option" });
  if (!poll.allowMultiple && optionIndexes.length > 1) return res.status(400).json({ error: "Choose only one option" });

  const votes: Record<string, number[]> = Object.fromEntries(Object.entries(poll.votes ?? {}).map(([index, userIds]) => [
    index,
    userIds.filter((userId) => userId !== viewerId),
  ]));
  for (const index of optionIndexes as number[]) votes[String(index)] = [...(votes[String(index)] ?? []), viewerId];
  await db.update(groupPostDetailsTable).set({ poll: { ...poll, votes } }).where(eq(groupPostDetailsTable.id, details.id));
  return res.json({
    myVotes: optionIndexes,
    voteCounts: poll.options.map((_, index) => votes[String(index)]?.length ?? 0),
  });
});

router.post("/:id/posts/:postId/report", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  const reason = req.body?.reason;
  if (!["spam", "harassment", "off_topic", "scam_reshare"].includes(reason)) return res.status(400).json({ error: "Choose a valid group report reason" });
  const [post] = await db.select({ id: postsTable.id }).from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.groupId, groupId), eq(postsTable.isDeleted, false)));
  if (!post) return res.status(404).json({ error: "Group post not found" });
  const [existing] = await db.select({ id: reportsTable.id }).from(reportsTable)
    .where(and(eq(reportsTable.targetType, "group_post"), eq(reportsTable.targetId, postId), eq(reportsTable.reporterId, viewerId), inArray(reportsTable.status, ["group_review", "pending"])));
  if (existing) return res.status(409).json({ error: "You already reported this post" });
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(reportsTable)
    .where(and(eq(reportsTable.targetType, "group_post"), eq(reportsTable.targetId, postId)));
  const escalated = (count?.total ?? 0) + 1 >= 3;
  const [report] = await db.insert(reportsTable).values({
    reporterId: viewerId,
    targetType: "group_post",
    targetId: postId,
    reason,
    category: "group_content",
    status: escalated ? "pending" : "group_review",
  }).returning({ id: reportsTable.id });
  if (escalated) {
    await db.update(reportsTable).set({ status: "pending" })
      .where(and(eq(reportsTable.targetType, "group_post"), eq(reportsTable.targetId, postId), eq(reportsTable.status, "group_review")));
  }
  const [group] = await db.select({ name: groupsTable.name, creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  const moderators = await db.select({ userId: groupMembersTable.userId }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), inArray(groupMembersTable.role, ["admin", "moderator"]), eq(groupMembersTable.status, "active")));
  const { notify } = await import("../features/notifications/notification.service");
  const recipients = escalated
    ? await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "super_admin"))
    : [{ id: group?.creatorId ?? 0 }, ...moderators.map(member => ({ id: member.userId }))];
  await Promise.all(recipients.filter(recipient => recipient.id > 0).map(recipient => notify({
    userId: recipient.id,
    actorId: viewerId,
    type: "system",
    title: escalated ? "Group post report escalated" : "Group post reported",
    message: escalated ? "A group post received three reports and needs review." : `A post in ${group?.name ?? "a group"} needs moderator review.`,
    url: `/g/${groupId}`,
    groupId,
    postId,
  })));
  await db.insert(groupActivityLogsTable).values({ groupId, actorId: viewerId, action: "post_reported", details: { postId, reportId: report.id } });
  return res.status(201).json({ ok: true, escalated });
});

router.patch("/:id/posts/:postId/comments", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
  const [post] = await db.select({ authorId: postsTable.authorId }).from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.groupId, groupId)));
  if (!post) return res.status(404).json({ error: "Post not found" });
  const role = await getGroupRole(groupId, viewerId);
  if (post.authorId !== viewerId && !canModerateGroup(role)) return res.status(403).json({ error: "Forbidden" });
  const [details] = await db.update(groupPostDetailsTable).set({ commentsEnabled: req.body.enabled })
    .where(and(eq(groupPostDetailsTable.groupId, groupId), eq(groupPostDetailsTable.postId, postId)))
    .returning({ commentsEnabled: groupPostDetailsTable.commentsEnabled });
  return details ? res.json(details) : res.status(404).json({ error: "Group post not found" });
});

router.post("/:id/posts/:postId/archive", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  const [post] = await db.select({ authorId: postsTable.authorId }).from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.groupId, groupId), eq(postsTable.isDeleted, false)));
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.authorId !== viewerId && !canModerateGroup(await getGroupRole(groupId, viewerId))) return res.status(403).json({ error: "Forbidden" });
  await db.update(postsTable).set({ isPublished: false, updatedAt: new Date() })
    .where(and(eq(postsTable.id, postId), eq(postsTable.groupId, groupId)));
  return res.json({ ok: true });
});

router.post("/:id/posts/:postId/best-answer", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  const commentId = Number(req.body?.commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) return res.status(400).json({ error: "A valid answer is required" });

  const [details] = await db.select().from(groupPostDetailsTable)
    .where(and(eq(groupPostDetailsTable.groupId, groupId), eq(groupPostDetailsTable.postId, postId)));
  if (!details || details.type !== "question" || !details.question) return res.status(404).json({ error: "Question not found" });
  const [post] = await db.select({ authorId: postsTable.authorId }).from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.groupId, groupId)));
  if (!post) return res.status(404).json({ error: "Question not found" });
  const [membership] = await db.select({ role: groupMembersTable.role, status: groupMembersTable.status })
    .from(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, viewerId)));
  const canChoose = post.authorId === viewerId || (membership?.status === "active" && ["owner", "admin"].includes(membership.role));
  if (!canChoose) return res.status(403).json({ error: "Only the question author or a group moderator can select the best answer" });
  if (details.question.isAnswered) return res.status(409).json({ error: "This question already has a best answer." });
  const [comment] = await db.select({ id: commentsTable.id, authorId: commentsTable.authorId }).from(commentsTable)
    .where(and(eq(commentsTable.id, commentId), eq(commentsTable.postId, postId)));
  if (!comment) return res.status(404).json({ error: "Answer not found on this question" });
  const question = { isAnswered: true, bestAnswerId: commentId };
  await db.update(groupPostDetailsTable).set({ question }).where(eq(groupPostDetailsTable.id, details.id));
  const { addReputationEvent } = await import("../features/trust/reputation.service");
  await addReputationEvent(comment.authorId, "milestone", "Your reply was marked as the best answer", 5);
  return res.json({ question });
});

router.get("/:id", async (req, res) => {
  const viewer = await loadCurrentUser(req);
  const viewerId = viewer?.id ?? null;
  const identifier = String(req.params.id);
  const id = Number(identifier);
  const [group] = await db.select().from(groupsTable).where(and(
    Number.isInteger(id) && id > 0 ? eq(groupsTable.id, id) : eq(groupsTable.slug, identifier),
    eq(groupsTable.isDeleted, false),
  ));
  if (!group) return res.status(404).json({ error: "Group not found" });

  if (group.type === "secret" && group.creatorId !== viewerId && viewer?.role !== "super_admin") {
    const [membership] = viewerId ? await db.select({ id: groupMembersTable.id, status: groupMembersTable.status })
      .from(groupMembersTable).where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, viewerId))) : [];
    if (!membership || !["active", "muted"].includes(membership.status)) return res.status(404).json({ error: "Group not found" });
  }

  const enriched = await enrichGroup(group, viewerId, viewer?.role === "super_admin");
  return res.json(enriched);
});

router.post("/:id/join", async (req, res) => {
  const viewerId = getViewerId(req);
  if (!viewerId) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id);

  const [group] = await db.select({ privacy: groupsTable.privacy, type: groupsTable.type }).from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.type === "secret") return res.status(404).json({ error: "Secret groups are invite-only" });
  const [ban] = await db.select({ id: groupBansTable.id }).from(groupBansTable)
    .where(and(eq(groupBansTable.groupId, id), eq(groupBansTable.userId, viewerId)));
  if (ban) return res.status(403).json({ error: "You are banned from this group" });

  const existing = await db.select().from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.userId, viewerId)));
  const joinAction = getGroupJoinAction(group.privacy);
  const isActiveMember = existing.some((member) => ["active", "muted"].includes(member.status));
  if (joinAction === "invite" && !isActiveMember) {
    return res.status(403).json({ error: "This group is invite-only" });
  }

  let isMember: boolean;
  if (existing[0]?.status === "pending") {
    await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.userId, viewerId)));
    await db.update(groupJoinRequestsTable).set({ status: "cancelled" })
      .where(and(eq(groupJoinRequestsTable.groupId, id), eq(groupJoinRequestsTable.userId, viewerId), eq(groupJoinRequestsTable.status, "pending")));
    await db.insert(groupActivityLogsTable).values({ groupId: id, actorId: viewerId, action: "join_request_cancelled", details: {} });
    isMember = false;
  } else if (existing.length > 0) {
    await db.delete(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.userId, viewerId)));
    isMember = false;
  } else {
    if (joinAction === "request") {
      const screeningAnswers = req.body?.screeningAnswers && typeof req.body.screeningAnswers === "object" && !Array.isArray(req.body.screeningAnswers)
        ? Object.fromEntries(Object.entries(req.body.screeningAnswers).slice(0, 10).map(([key, value]) => [String(key).slice(0, 80), String(value).slice(0, 500)]))
        : {};
      await db.insert(groupJoinRequestsTable).values({ groupId: id, userId: viewerId, status: "pending", screeningAnswers })
        .onConflictDoUpdate({ target: [groupJoinRequestsTable.groupId, groupJoinRequestsTable.userId], set: { status: "pending", reviewedBy: null, reviewedAt: null, screeningAnswers } });
      await db.insert(groupActivityLogsTable).values({ groupId: id, actorId: viewerId, action: "join_request_created", details: {} });
      const [trust] = await db.select({ uti: userTrustScoresTable.uti }).from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, viewerId));
      await db.insert(groupMembersTable).values({ groupId: id, userId: viewerId, role: "member", status: "pending", trustScoreAtJoin: trust?.uti ?? null })
        .onConflictDoUpdate({ target: [groupMembersTable.groupId, groupMembersTable.userId], set: { status: "pending", mutedUntil: null } });
      return res.json({ isMember: false, hasPendingJoinRequest: true });
    }
    const [trust] = await db.select({ uti: userTrustScoresTable.uti }).from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, viewerId));
    await db.insert(groupMembersTable).values({ groupId: id, userId: viewerId, role: "member", trustScoreAtJoin: trust?.uti ?? null });
    isMember = true;
  }

  const [membersResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(groupMembersTable).where(and(eq(groupMembersTable.groupId, id), inArray(groupMembersTable.status, ["active", "muted"])));

  if (isMember) await db.insert(groupActivityLogsTable).values({ groupId: id, actorId: viewerId, action: "member_joined", details: {} });

  return res.json({ isMember, hasPendingJoinRequest: false, membersCount: membersResult?.count ?? 0 });
});

router.get("/:id/posts", async (req, res) => {
  const viewer = await loadCurrentUser(req);
  const viewerId = viewer?.id ?? null;
  const isSuperAdmin = viewer?.role === "super_admin";
  const id = parseInt(req.params.id);
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;

  const [group] = await db.select({ privacy: groupsTable.privacy, type: groupsTable.type, creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.type === "secret" && group.creatorId !== viewerId && !isSuperAdmin) {
    const [secretMembership] = viewerId ? await db.select({ status: groupMembersTable.status }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.userId, viewerId))) : [];
    if (!secretMembership || !["active", "muted"].includes(secretMembership.status)) return res.status(404).json({ error: "Group not found" });
  }
  if (!canViewGroupPosts(group.privacy, false, isSuperAdmin)) {
    if (!viewerId) return res.status(403).json({ error: "Join this private group to view its posts" });
    const [membership] = await db.select({ id: groupMembersTable.id }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.userId, viewerId), inArray(groupMembersTable.status, ["active", "muted"])));
    if (!canViewGroupPosts(group.privacy, Boolean(membership), isSuperAdmin)) {
      return res.status(403).json({ error: "Join this private group to view its posts" });
    }
  }

  const posts = await db.select({ post: postsTable, groupDetails: groupPostDetailsTable }).from(postsTable)
    .leftJoin(groupPostDetailsTable, eq(groupPostDetailsTable.postId, postsTable.id))
    .where(and(eq(postsTable.groupId, id), eq(postsTable.isPublished, true), eq(postsTable.isDeleted, false), postVisibilityCondition(viewerId, isSuperAdmin)))
    .orderBy(desc(postsTable.createdAt))
    .limit(limit).offset((page - 1) * limit);

  const enriched = await Promise.all(posts.map(async ({ post, groupDetails }) => {
    const poll = groupDetails?.poll;
    const votes = poll?.votes ?? {};
    return {
      ...(await enrichPost(post, viewerId)),
      groupDetails: groupDetails ? {
        ...groupDetails,
        poll: poll ? {
          options: poll.options,
          endsAt: poll.endsAt,
          allowMultiple: poll.allowMultiple,
          voteCounts: poll.options.map((_, index) => votes[String(index)]?.length ?? 0),
          myVotes: viewerId ? poll.options.map((_, index) => votes[String(index)]?.includes(viewerId) ? index : -1).filter(index => index >= 0) : [],
        } : null,
      } : null,
    };
  }));
  return res.json({ posts: enriched, total: enriched.length, page, limit });
});

export default router;
