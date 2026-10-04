import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  groupsTable,
  groupMembersTable,
  groupJoinRequestsTable,
  groupBansTable,
  groupPinnedPostsTable,
  groupPostDetailsTable,
  groupActivityLogsTable,
  postsTable,
  userTrustScoresTable,
  usersTable,
  reportsTable,
} from "@workspace/db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { optionalAuth, requireAuth, requireSuperAdmin } from "../../middleware/admin";
import { enrichPost } from "../profiles/profile.service";
import { loadCurrentUser } from "../../lib/auth-types";

interface AuthedRequest extends Request {
  currentUser: { id: number };
}

export const groupAdminRouter = Router();

type GroupRole = "member" | "moderator" | "admin" | "owner";
const ALLOWED_ROLES: GroupRole[] = ["member", "moderator", "admin"];

async function getActorRole(groupId: number, userId: number): Promise<GroupRole | null> {
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (group?.creatorId === userId) return "owner";
  const [member] = await db
    .select({ role: groupMembersTable.role, status: groupMembersTable.status })
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)));
  if (!member || member.status !== "active") return null;
  return (member.role as GroupRole) ?? "member";
}

async function checkGroupReadAccess(groupId: number, viewerId: number | null, isSuperAdmin = false): Promise<"missing" | "forbidden" | null> {
  const [group] = await db.select({ privacy: groupsTable.privacy }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) return "missing";
  if (group.privacy === "private" && !isSuperAdmin && (!viewerId || !(await getActorRole(groupId, viewerId)))) return "forbidden";
  return null;
}

function canModerate(role: GroupRole | null): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

groupAdminRouter.get("/:id/pinned", optionalAuth, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) return res.status(400).json({ error: "Invalid id" });
  const viewer = await loadCurrentUser(req);
  const viewerId = viewer?.id ?? null;
  const access = await checkGroupReadAccess(groupId, viewerId, viewer?.role === "super_admin");
  if (access === "missing") return res.status(404).json({ error: "Group not found" });
  if (access === "forbidden") return res.status(403).json({ error: "Forbidden" });
  const pinned = await db
    .select({ post: postsTable, pinnedAt: groupPinnedPostsTable.pinnedAt })
    .from(groupPinnedPostsTable)
    .innerJoin(postsTable, eq(postsTable.id, groupPinnedPostsTable.postId))
    .where(eq(groupPinnedPostsTable.groupId, groupId))
    .orderBy(desc(groupPinnedPostsTable.pinnedAt))
    .limit(3);
  const enriched = await Promise.all(pinned.map((row) => enrichPost(row.post, viewerId)));
  return res.json({ pinned: enriched });
});

groupAdminRouter.post("/:id/posts/:postId/pin", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(groupId) || !Number.isFinite(postId)) return res.status(400).json({ error: "Invalid id" });
  const role = await getActorRole(groupId, userId);
  if (!canModerate(role)) return res.status(403).json({ error: "Forbidden" });
  const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(and(eq(postsTable.id, postId), eq(postsTable.groupId, groupId)));
  if (!post) return res.status(404).json({ error: "Post not in this group" });
  await db
    .insert(groupPinnedPostsTable)
    .values({ groupId, postId, pinnedBy: userId })
    .onConflictDoNothing();
  await db.update(groupPostDetailsTable).set({ isPinned: true })
    .where(and(eq(groupPostDetailsTable.postId, postId), eq(groupPostDetailsTable.groupId, groupId)));
  await db.insert(groupActivityLogsTable).values({ groupId, actorId: userId, action: "post_pinned", details: { postId } });
  return res.json({ ok: true });
});

groupAdminRouter.delete("/:id/posts/:postId/pin", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(groupId) || !Number.isFinite(postId)) return res.status(400).json({ error: "Invalid id" });
  const role = await getActorRole(groupId, userId);
  if (!canModerate(role)) return res.status(403).json({ error: "Forbidden" });
  await db
    .delete(groupPinnedPostsTable)
    .where(and(eq(groupPinnedPostsTable.groupId, groupId), eq(groupPinnedPostsTable.postId, postId)));
  await db.update(groupPostDetailsTable).set({ isPinned: false })
    .where(and(eq(groupPostDetailsTable.postId, postId), eq(groupPostDetailsTable.groupId, groupId)));
  await db.insert(groupActivityLogsTable).values({ groupId, actorId: userId, action: "post_unpinned", details: { postId } });
  return res.json({ ok: true });
});

groupAdminRouter.get("/:id/members", optionalAuth, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) return res.status(400).json({ error: "Invalid id" });
  const viewer = await loadCurrentUser(req);
  const viewerId = viewer?.id ?? null;
  const access = await checkGroupReadAccess(groupId, viewerId, viewer?.role === "super_admin");
  if (access === "missing") return res.status(404).json({ error: "Group not found" });
  if (access === "forbidden") return res.status(403).json({ error: "Forbidden" });
  const members = await db
    .select({
      id: groupMembersTable.id,
      userId: groupMembersTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      role: groupMembersTable.role,
      joinedAt: groupMembersTable.joinedAt,
      status: groupMembersTable.status,
      mutedUntil: groupMembersTable.mutedUntil,
      trustScoreAtJoin: groupMembersTable.trustScoreAtJoin,
      trustScore: userTrustScoresTable.uti,
    })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, groupMembersTable.userId))
    .leftJoin(userTrustScoresTable, eq(userTrustScoresTable.userId, groupMembersTable.userId))
    .where(eq(groupMembersTable.groupId, groupId))
    .orderBy(desc(groupMembersTable.joinedAt))
    .limit(200);
  return res.json({ members });
});

groupAdminRouter.post("/:id/invite", requireAuth, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.body?.userId);
  const inviterId = (req as AuthedRequest).currentUser.id;
  if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid group or user id" });
  }
  if (!(await getActorRole(groupId, inviterId))) return res.status(403).json({ error: "Join this group before inviting someone" });
  const [ban] = await db.select({ id: groupBansTable.id }).from(groupBansTable)
    .where(and(eq(groupBansTable.groupId, groupId), eq(groupBansTable.userId, targetUserId)));
  if (ban) return res.status(403).json({ error: "This user is banned from the group" });
  const [existing] = await db.select({ status: groupMembersTable.status }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  if (existing && ["active", "muted"].includes(existing.status)) return res.status(409).json({ error: "This user is already a member" });

  const [trust] = await db.select({ uti: userTrustScoresTable.uti }).from(userTrustScoresTable)
    .where(eq(userTrustScoresTable.userId, targetUserId));
  await db.insert(groupMembersTable).values({
    groupId,
    userId: targetUserId,
    role: "member",
    status: "active",
    trustScoreAtJoin: trust?.uti ?? null,
  }).onConflictDoUpdate({
    target: [groupMembersTable.groupId, groupMembersTable.userId],
    set: { status: "active", mutedUntil: null, role: "member", trustScoreAtJoin: trust?.uti ?? null },
  });
  await db.delete(groupJoinRequestsTable).where(and(eq(groupJoinRequestsTable.groupId, groupId), eq(groupJoinRequestsTable.userId, targetUserId)));
  return res.status(201).json({ ok: true });
});

groupAdminRouter.patch("/:id/members/:userId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  if (!Number.isFinite(groupId) || !Number.isFinite(targetUserId)) return res.status(400).json({ error: "Invalid id" });
  const role = req.body?.role as string | undefined;
  if (!role || !ALLOWED_ROLES.includes(role as GroupRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner") return res.status(403).json({ error: "Only group admins can change roles" });
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.creatorId === targetUserId) return res.status(400).json({ error: "The group creator must remain an admin" });
  const [updated] = await db
    .update(groupMembersTable)
    .set({ role })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Member not found" });
  await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: "member_role_changed", details: { userId: targetUserId, role } });
  return res.json({ ok: true, member: updated });
});

groupAdminRouter.patch("/:id/settings", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid id" });
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner") return res.status(403).json({ error: "Only group admins can update settings" });
  const { name, description, privacy, type, rules, coverUrl, coverImage, avatarUrl, iconImage, category, tags, isAnnouncementOnly, requireApprovalFirstThree, requireApprovalAll, announcementPolicy } = req.body ?? {};
  const normalizedType = type ?? (privacy === "private" ? "private" : privacy === "open" ? "public" : undefined);
  if (normalizedType !== undefined && !["public", "private", "secret"].includes(normalizedType)) return res.status(400).json({ error: "Invalid group type" });
  const [currentGroup] = await db.select({ type: groupsTable.type }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!currentGroup) return res.status(404).json({ error: "Group not found" });
  if (currentGroup.type !== "public" && normalizedType === "public") {
    const viewer = await loadCurrentUser(req);
    if (viewer?.role !== "super_admin") return res.status(403).json({ error: "Only a super admin can make a private group public" });
  }
  if (typeof name === "string" && (!name.trim() || name.trim().length > 80)) return res.status(400).json({ error: "Group name must be 1 to 80 characters" });
  if (typeof description === "string" && description.trim().length > 280) return res.status(400).json({ error: "Description must be 280 characters or fewer" });
  const normalizedRules = Array.isArray(rules) ? rules.map((rule: unknown) => String(rule).trim()).filter(Boolean)
    : typeof rules === "string" ? rules.split("\n").map((rule: string) => rule.trim()).filter(Boolean) : undefined;
  if (normalizedRules && (normalizedRules.length > 5 || normalizedRules.some((rule: string) => rule.length > 240))) {
    return res.status(400).json({ error: "Groups can have up to 5 rules, each 240 characters or fewer" });
  }
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (description !== undefined) updates.description = String(description).trim() || null;
  if (normalizedType !== undefined) {
    updates.type = normalizedType;
    updates.privacy = normalizedType === "public" ? "open" : "private";
  }
  if (normalizedRules !== undefined) updates.rules = normalizedRules;
  if (coverUrl !== undefined || coverImage !== undefined) {
    updates.coverUrl = coverUrl ?? coverImage ?? null;
    updates.coverImage = coverImage ?? coverUrl ?? null;
  }
  if (avatarUrl !== undefined || iconImage !== undefined) {
    updates.avatarUrl = avatarUrl ?? iconImage ?? null;
    updates.iconImage = iconImage ?? avatarUrl ?? null;
  }
  if (category !== undefined) updates.category = String(category).trim().slice(0, 80) || "general";
  if (tags !== undefined) {
    if (!Array.isArray(tags)) return res.status(400).json({ error: "Tags must be a list" });
    updates.tags = tags.filter((tag: unknown): tag is string => typeof tag === "string").map((tag: string) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 20);
  }
  if (isAnnouncementOnly !== undefined) {
    if (typeof isAnnouncementOnly !== "boolean") return res.status(400).json({ error: "isAnnouncementOnly must be a boolean" });
    updates.isAnnouncementOnly = isAnnouncementOnly;
  }
  if (requireApprovalFirstThree !== undefined) {
    if (typeof requireApprovalFirstThree !== "boolean") return res.status(400).json({ error: "requireApprovalFirstThree must be a boolean" });
    updates.requireApprovalFirstThree = requireApprovalFirstThree;
  }
  if (requireApprovalAll !== undefined) {
    if (typeof requireApprovalAll !== "boolean") return res.status(400).json({ error: "requireApprovalAll must be a boolean" });
    updates.requireApprovalAll = requireApprovalAll;
  }
  if (announcementPolicy !== undefined) {
    if (announcementPolicy !== "owner" && announcementPolicy !== "admins") return res.status(400).json({ error: "announcementPolicy must be owner or admins" });
    updates.announcementPolicy = announcementPolicy;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No settings provided" });
  const [updated] = await db.update(groupsTable).set(updates).where(eq(groupsTable.id, groupId)).returning();
  return updated ? res.json({ group: updated }) : res.status(404).json({ error: "Group not found" });
});

groupAdminRouter.patch("/:id/features", requireSuperAdmin, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) return res.status(400).json({ error: "Invalid id" });
  if (typeof req.body?.eventsEnabled !== "boolean") return res.status(400).json({ error: "eventsEnabled must be a boolean" });
  const [updated] = await db.update(groupsTable)
    .set({ features: { eventsEnabled: req.body.eventsEnabled } })
    .where(eq(groupsTable.id, groupId))
    .returning();
  return updated ? res.json({ features: updated.features }) : res.status(404).json({ error: "Group not found" });
});

groupAdminRouter.get("/:id/join-requests", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner") return res.status(403).json({ error: "Only group admins can view join requests" });
  const requests = await db.select({
    id: groupJoinRequestsTable.id,
    userId: groupJoinRequestsTable.userId,
    createdAt: groupJoinRequestsTable.createdAt,
    screeningAnswers: groupJoinRequestsTable.screeningAnswers,
    username: usersTable.username,
    displayName: usersTable.displayName,
    avatarUrl: usersTable.avatarUrl,
    trustScore: userTrustScoresTable.uti,
    joinedAt: usersTable.createdAt,
  }).from(groupJoinRequestsTable)
    .innerJoin(usersTable, eq(usersTable.id, groupJoinRequestsTable.userId))
    .leftJoin(userTrustScoresTable, eq(userTrustScoresTable.userId, groupJoinRequestsTable.userId))
    .where(and(eq(groupJoinRequestsTable.groupId, groupId), eq(groupJoinRequestsTable.status, "pending")))
    .orderBy(desc(groupJoinRequestsTable.createdAt));
  return res.json({ requests });
});

groupAdminRouter.get("/:id/pending-posts", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (!canModerate(await getActorRole(groupId, actorId))) return res.status(403).json({ error: "Only group moderators can review posts" });
  const pending = await db.select({ post: postsTable, details: groupPostDetailsTable })
    .from(groupPostDetailsTable)
    .innerJoin(postsTable, eq(postsTable.id, groupPostDetailsTable.postId))
    .where(and(eq(groupPostDetailsTable.groupId, groupId), eq(groupPostDetailsTable.approvalStatus, "pending"), eq(postsTable.isDeleted, false)))
    .orderBy(desc(groupPostDetailsTable.createdAt));
  const posts = await Promise.all(pending.map(async ({ post, details }) => ({
    ...(await enrichPost(post, actorId)),
    groupDetails: details,
  })));
  return res.json({ posts });
});

groupAdminRouter.patch("/:id/posts/:postId/approval", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const postId = Number(req.params.postId);
  const decision = req.body?.decision;
  if (decision !== "approve" && decision !== "reject") return res.status(400).json({ error: "Decision must be approve or reject" });
  if (!canModerate(await getActorRole(groupId, actorId))) return res.status(403).json({ error: "Only group moderators can review posts" });
  const [details] = await db.select().from(groupPostDetailsTable)
    .where(and(eq(groupPostDetailsTable.groupId, groupId), eq(groupPostDetailsTable.postId, postId), eq(groupPostDetailsTable.approvalStatus, "pending")));
  if (!details) return res.status(404).json({ error: "Pending post not found" });
  const approved = decision === "approve";
  await db.update(groupPostDetailsTable).set({ approvalStatus: approved ? "approved" : "rejected" })
    .where(eq(groupPostDetailsTable.id, details.id));
  await db.update(postsTable).set(approved ? { isPublished: true } : { isDeleted: true, deletedAt: new Date() })
    .where(and(eq(postsTable.id, postId), eq(postsTable.groupId, groupId)));
  if (approved && details.isAnnouncement) {
    await db.insert(groupPinnedPostsTable).values({ groupId, postId, pinnedBy: actorId }).onConflictDoNothing();
    const [group] = await db.select({ name: groupsTable.name }).from(groupsTable).where(eq(groupsTable.id, groupId));
    const recipients = await db.select({ userId: groupMembersTable.userId }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.status, "active")));
    const { notify } = await import("../notifications/notification.service");
    await Promise.all(recipients.map(({ userId }) => notify({
      userId, actorId, type: "group_announcement", title: "New group announcement",
      message: `A new announcement was posted in ${group?.name ?? "your group"}.`,
      url: `/g/${groupId}`, postId, groupId,
    })));
  }
  await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: approved ? "post_approved" : "post_rejected", details: { postId } });
  return res.json({ ok: true, status: approved ? "approved" : "rejected" });
});

groupAdminRouter.get("/:id/activity", optionalAuth, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  const viewer = await loadCurrentUser(req);
  const access = await checkGroupReadAccess(groupId, viewer?.id ?? null, viewer?.role === "super_admin");
  if (access === "missing") return res.status(404).json({ error: "Group not found" });
  if (access === "forbidden") return res.status(403).json({ error: "Forbidden" });
  const activity = await db.select({
    id: groupActivityLogsTable.id,
    actorId: groupActivityLogsTable.actorId,
    actorName: usersTable.displayName,
    actorUsername: usersTable.username,
    action: groupActivityLogsTable.action,
    details: groupActivityLogsTable.details,
    createdAt: groupActivityLogsTable.createdAt,
  }).from(groupActivityLogsTable)
    .leftJoin(usersTable, eq(usersTable.id, groupActivityLogsTable.actorId))
    .where(eq(groupActivityLogsTable.groupId, groupId))
    .orderBy(desc(groupActivityLogsTable.createdAt))
    .limit(50);
  const endedPolls = await db.select({ postId: groupPostDetailsTable.postId, poll: groupPostDetailsTable.poll })
    .from(groupPostDetailsTable)
    .where(and(eq(groupPostDetailsTable.groupId, groupId), eq(groupPostDetailsTable.type, "poll")));
  const pollEvents = endedPolls.flatMap(({ postId, poll }) => {
    if (!poll?.endsAt || Date.parse(poll.endsAt) > Date.now()) return [];
    return [{ id: -postId, actorId: null, actorName: null, actorUsername: null, action: "poll_ended", details: { postId }, createdAt: new Date(poll.endsAt) }];
  });
  const timeline = [...activity, ...pollEvents]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 50);
  return res.json({ activity: timeline });
});

groupAdminRouter.get("/:id/reports", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (!canModerate(await getActorRole(groupId, actorId))) return res.status(403).json({ error: "Only group moderators can review reports" });
  const posts = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.groupId, groupId));
  if (posts.length === 0) return res.json({ reports: [] });
  const reports = await db.select({
    id: reportsTable.id,
    targetId: reportsTable.targetId,
    reason: reportsTable.reason,
    status: reportsTable.status,
    createdAt: reportsTable.createdAt,
    postTitle: postsTable.title,
    reporterName: usersTable.displayName,
    reporterUsername: usersTable.username,
  }).from(reportsTable)
    .innerJoin(usersTable, eq(usersTable.id, reportsTable.reporterId))
    .innerJoin(postsTable, eq(postsTable.id, reportsTable.targetId))
    .where(and(eq(reportsTable.targetType, "group_post"), inArray(reportsTable.targetId, posts.map(post => post.id)), eq(reportsTable.status, "group_review")))
    .orderBy(desc(reportsTable.createdAt));
  return res.json({ reports });
});

groupAdminRouter.patch("/:id/reports/:reportId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const reportId = Number(req.params.reportId);
  if (!canModerate(await getActorRole(groupId, actorId))) return res.status(403).json({ error: "Only group moderators can review reports" });
  const decision = req.body?.decision;
  if (!["dismiss", "remove_post", "escalate"].includes(decision)) return res.status(400).json({ error: "Invalid report decision" });
  const [report] = await db.select({ targetId: reportsTable.targetId }).from(reportsTable)
    .where(and(eq(reportsTable.id, reportId), eq(reportsTable.targetType, "group_post"), eq(reportsTable.status, "group_review")));
  if (!report) return res.status(404).json({ error: "Report not found" });
  const [post] = await db.select({ id: postsTable.id }).from(postsTable)
    .where(and(eq(postsTable.id, report.targetId), eq(postsTable.groupId, groupId)));
  if (!post) return res.status(404).json({ error: "Reported post not found in this group" });
  if (decision === "remove_post") await db.update(postsTable).set({ isDeleted: true, deletedAt: new Date() }).where(eq(postsTable.id, post.id));
  await db.update(reportsTable).set({
    status: decision === "escalate" ? "pending" : "resolved",
    resolvedBy: decision === "escalate" ? null : actorId,
    resolvedAt: decision === "escalate" ? null : new Date(),
  }).where(eq(reportsTable.id, reportId));
  await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: `report_${decision}`, details: { postId: post.id, reportId } });
  return res.json({ ok: true });
});

groupAdminRouter.post("/:id/archive", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (await getActorRole(groupId, actorId) !== "owner" && await getActorRole(groupId, actorId) !== "admin") return res.status(403).json({ error: "Only group owners and admins can archive groups" });
  const [group] = await db.update(groupsTable).set({ isArchived: true }).where(eq(groupsTable.id, groupId)).returning({ id: groupsTable.id });
  if (!group) return res.status(404).json({ error: "Group not found" });
  await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: "group_archived", details: {} });
  return res.json({ ok: true });
});

groupAdminRouter.delete("/:id", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const role = await getActorRole(groupId, actorId);
  if (role !== "owner" && role !== "admin") return res.status(403).json({ error: "Only group owners and admins can delete groups" });
  const [group] = await db.update(groupsTable).set({ isDeleted: true, isArchived: true }).where(eq(groupsTable.id, groupId)).returning({ id: groupsTable.id });
  return group ? res.json({ ok: true }) : res.status(404).json({ error: "Group not found" });
});

groupAdminRouter.patch("/:id/join-requests/:requestId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const requestId = Number(req.params.requestId);
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner") return res.status(403).json({ error: "Only group admins can review join requests" });
  const decision = req.body?.decision as string;
  if (!["approve", "reject", "block"].includes(decision)) return res.status(400).json({ error: "Decision must be approve, reject, or block" });
  const [request] = await db.select().from(groupJoinRequestsTable)
    .where(and(eq(groupJoinRequestsTable.id, requestId), eq(groupJoinRequestsTable.groupId, groupId), eq(groupJoinRequestsTable.status, "pending")));
  if (!request) return res.status(404).json({ error: "Join request not found" });
  const status = decision === "approve" ? "approved" : "rejected";
  await db.update(groupJoinRequestsTable).set({ status, reviewedBy: actorId, reviewedAt: new Date() }).where(eq(groupJoinRequestsTable.id, requestId));
  if (decision === "approve") {
    const [membership] = await db.update(groupMembersTable).set({ status: "active", mutedUntil: null })
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, request.userId)))
      .returning({ id: groupMembersTable.id });
    if (!membership) {
      const [trust] = await db.select({ uti: userTrustScoresTable.uti }).from(userTrustScoresTable).where(eq(userTrustScoresTable.userId, request.userId));
      await db.insert(groupMembersTable).values({ groupId, userId: request.userId, role: "member", trustScoreAtJoin: trust?.uti ?? null }).onConflictDoNothing();
    }
  } else {
    await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, request.userId), eq(groupMembersTable.status, "pending")));
    if (decision === "block") {
      await db.insert(groupBansTable).values({ groupId, userId: request.userId, bannedBy: actorId, reason: "Blocked from join request" }).onConflictDoNothing();
      await db.update(groupMembersTable).set({ status: "banned" }).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, request.userId)));
    }
  }
  await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: `join_request_${decision}`, details: { userId: request.userId } });
  return res.json({ ok: true, status });
});

groupAdminRouter.delete("/:id/members/:userId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner") return res.status(403).json({ error: "Only group admins can remove members" });
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (group?.creatorId === targetUserId) return res.status(400).json({ error: "The group creator cannot be removed" });
  if (req.body?.deletePosts === true) {
    await db.update(postsTable).set({ isDeleted: true, deletedAt: new Date() })
      .where(and(eq(postsTable.groupId, groupId), eq(postsTable.authorId, targetUserId), eq(postsTable.isDeleted, false)));
  }
  await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: "member_removed", details: { userId: targetUserId } });
  return res.json({ ok: true });
});

groupAdminRouter.post("/:id/bans", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.body?.userId);
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner") return res.status(403).json({ error: "Only group admins can ban members" });
  if (!Number.isFinite(targetUserId)) return res.status(400).json({ error: "Invalid user id" });
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (group?.creatorId === targetUserId) return res.status(400).json({ error: "The group creator cannot be banned" });
  if (req.body?.deletePosts === true) {
    await db.update(postsTable).set({ isDeleted: true, deletedAt: new Date() })
      .where(and(eq(postsTable.groupId, groupId), eq(postsTable.authorId, targetUserId), eq(postsTable.isDeleted, false)));
  }
  await db.insert(groupBansTable).values({ groupId, userId: targetUserId, bannedBy: actorId, reason: req.body?.reason || null }).onConflictDoNothing();
  await db.update(groupMembersTable).set({ status: "banned" })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: "member_banned", details: { userId: targetUserId } });
  return res.json({ ok: true });
});

groupAdminRouter.delete("/:id/bans/:userId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner") return res.status(403).json({ error: "Only group admins can unban members" });
  await db.delete(groupBansTable).where(and(eq(groupBansTable.groupId, groupId), eq(groupBansTable.userId, Number(req.params.userId))));
  await db.update(groupMembersTable).set({ status: "active" }).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, Number(req.params.userId)), eq(groupMembersTable.status, "banned")));
  return res.json({ ok: true });
});

groupAdminRouter.patch("/:id/members/:userId/status", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const actorRole = await getActorRole(groupId, actorId);
  if (actorRole !== "admin" && actorRole !== "owner" && actorRole !== "moderator") return res.status(403).json({ error: "Only group moderators can change member status" });
  if (req.body?.status !== "active" && req.body?.status !== "muted") return res.status(400).json({ error: "Status must be active or muted" });
  const mutedUntil = req.body.status === "muted" && typeof req.body.mutedUntil === "string" ? new Date(req.body.mutedUntil) : null;
  if (mutedUntil && !Number.isFinite(mutedUntil.getTime())) return res.status(400).json({ error: "Invalid mute expiry" });
  const [banned] = await db.select({ id: groupBansTable.id }).from(groupBansTable)
    .where(and(eq(groupBansTable.groupId, groupId), eq(groupBansTable.userId, targetUserId)));
  if (banned) return res.status(409).json({ error: "Unban this member before reactivating them" });
  const [target] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  if (!target) return res.status(404).json({ error: "Member not found" });
  if (target.role === "owner" || target.role === "admin") return res.status(403).json({ error: "Admins and owners cannot be muted here" });
  const [updated] = await db.update(groupMembersTable).set({ status: req.body.status, mutedUntil })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId), ne(groupMembersTable.status, "banned")))
    .returning({ userId: groupMembersTable.userId, status: groupMembersTable.status, mutedUntil: groupMembersTable.mutedUntil });
  if (updated) await db.insert(groupActivityLogsTable).values({ groupId, actorId, action: req.body.status === "muted" ? "member_muted" : "member_unmuted", details: { userId: targetUserId, mutedUntil } });
  return updated ? res.json({ member: updated }) : res.status(404).json({ error: "Active member not found" });
});

groupAdminRouter.delete("/:id/posts/:postId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (!canModerate(await getActorRole(groupId, actorId))) return res.status(403).json({ error: "Only group moderators can remove posts" });
  const [post] = await db.update(postsTable).set({ isDeleted: true, deletedAt: new Date() })
    .where(and(eq(postsTable.id, Number(req.params.postId)), eq(postsTable.groupId, groupId))).returning({ id: postsTable.id });
  return post ? res.json({ ok: true }) : res.status(404).json({ error: "Post not found" });
});

groupAdminRouter.get("/:id/my-role", requireAuth, async (req, res: Response) => {
  const userId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid id" });
  const role = await getActorRole(groupId, userId);
  return res.json({ role });
});

// ensure sql import retained for future use
void sql;
