import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  groupsTable,
  groupMembersTable,
  groupJoinRequestsTable,
  groupBansTable,
  groupPinnedPostsTable,
  postsTable,
} from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { optionalAuth, requireAuth } from "../../middleware/admin";
import { enrichPost } from "../profiles/profile.service";

interface AuthedRequest extends Request {
  currentUser: { id: number };
}

export const groupAdminRouter = Router();

type GroupRole = "member" | "moderator" | "admin";
const ALLOWED_ROLES: GroupRole[] = ["member", "moderator", "admin"];

async function getActorRole(groupId: number, userId: number): Promise<GroupRole | null> {
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (group?.creatorId === userId) return "admin";
  const [member] = await db
    .select({ role: groupMembersTable.role })
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId)));
  if (!member) return null;
  return (member.role as GroupRole) ?? "member";
}

async function checkGroupReadAccess(groupId: number, viewerId: number | null): Promise<"missing" | "forbidden" | null> {
  const [group] = await db.select({ privacy: groupsTable.privacy }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) return "missing";
  if (group.privacy === "private" && (!viewerId || !(await getActorRole(groupId, viewerId)))) return "forbidden";
  return null;
}

function canModerate(role: GroupRole | null): boolean {
  return role === "admin" || role === "moderator";
}

groupAdminRouter.get("/:id/pinned", optionalAuth, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) return res.status(400).json({ error: "Invalid id" });
  const viewerId = (req as any).userId ?? null;
  const access = await checkGroupReadAccess(groupId, viewerId);
  if (access === "missing") return res.status(404).json({ error: "Group not found" });
  if (access === "forbidden") return res.status(403).json({ error: "Forbidden" });
  const pinned = await db
    .select({ post: postsTable, pinnedAt: groupPinnedPostsTable.pinnedAt })
    .from(groupPinnedPostsTable)
    .innerJoin(postsTable, eq(postsTable.id, groupPinnedPostsTable.postId))
    .where(eq(groupPinnedPostsTable.groupId, groupId))
    .orderBy(desc(groupPinnedPostsTable.pinnedAt))
    .limit(10);
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
  return res.json({ ok: true });
});

groupAdminRouter.get("/:id/members", optionalAuth, async (req, res: Response) => {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) return res.status(400).json({ error: "Invalid id" });
  const viewerId = (req as any).userId ?? null;
  const access = await checkGroupReadAccess(groupId, viewerId);
  if (access === "missing") return res.status(404).json({ error: "Group not found" });
  if (access === "forbidden") return res.status(403).json({ error: "Forbidden" });
  const members = await db
    .select({
      id: groupMembersTable.id,
      userId: groupMembersTable.userId,
      role: groupMembersTable.role,
      joinedAt: groupMembersTable.joinedAt,
    })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId))
    .orderBy(desc(groupMembersTable.joinedAt))
    .limit(200);
  return res.json({ members });
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
  if (actorRole !== "admin") return res.status(403).json({ error: "Only group admins can change roles" });
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.creatorId === targetUserId) return res.status(400).json({ error: "The group creator must remain an admin" });
  const [updated] = await db
    .update(groupMembersTable)
    .set({ role })
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Member not found" });
  return res.json({ ok: true, member: updated });
});

groupAdminRouter.patch("/:id/settings", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid id" });
  if (await getActorRole(groupId, actorId) !== "admin") return res.status(403).json({ error: "Only group admins can update settings" });
  const { name, description, privacy, rules, coverUrl, avatarUrl, category } = req.body ?? {};
  if (privacy !== undefined && !["open", "private"].includes(privacy)) return res.status(400).json({ error: "Invalid privacy" });
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({ name, description, privacy, rules, coverUrl, avatarUrl, category })) {
    if (value !== undefined) updates[key] = value || null;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No settings provided" });
  const [updated] = await db.update(groupsTable).set(updates).where(eq(groupsTable.id, groupId)).returning();
  return updated ? res.json({ group: updated }) : res.status(404).json({ error: "Group not found" });
});

groupAdminRouter.get("/:id/join-requests", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (await getActorRole(groupId, actorId) !== "admin") return res.status(403).json({ error: "Only group admins can view join requests" });
  const requests = await db.select().from(groupJoinRequestsTable)
    .where(and(eq(groupJoinRequestsTable.groupId, groupId), eq(groupJoinRequestsTable.status, "pending")))
    .orderBy(desc(groupJoinRequestsTable.createdAt));
  return res.json({ requests });
});

groupAdminRouter.patch("/:id/join-requests/:requestId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const requestId = Number(req.params.requestId);
  if (await getActorRole(groupId, actorId) !== "admin") return res.status(403).json({ error: "Only group admins can review join requests" });
  const decision = req.body?.decision as string;
  if (!["approve", "reject"].includes(decision)) return res.status(400).json({ error: "Decision must be approve or reject" });
  const [request] = await db.select().from(groupJoinRequestsTable)
    .where(and(eq(groupJoinRequestsTable.id, requestId), eq(groupJoinRequestsTable.groupId, groupId), eq(groupJoinRequestsTable.status, "pending")));
  if (!request) return res.status(404).json({ error: "Join request not found" });
  const status = decision === "approve" ? "approved" : "rejected";
  await db.update(groupJoinRequestsTable).set({ status, reviewedBy: actorId, reviewedAt: new Date() }).where(eq(groupJoinRequestsTable.id, requestId));
  if (decision === "approve") await db.insert(groupMembersTable).values({ groupId, userId: request.userId, role: "member" }).onConflictDoNothing();
  return res.json({ ok: true, status });
});

groupAdminRouter.delete("/:id/members/:userId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  if (await getActorRole(groupId, actorId) !== "admin") return res.status(403).json({ error: "Only group admins can remove members" });
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (group?.creatorId === targetUserId) return res.status(400).json({ error: "The group creator cannot be removed" });
  await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  return res.json({ ok: true });
});

groupAdminRouter.post("/:id/bans", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.body?.userId);
  if (await getActorRole(groupId, actorId) !== "admin") return res.status(403).json({ error: "Only group admins can ban members" });
  if (!Number.isFinite(targetUserId)) return res.status(400).json({ error: "Invalid user id" });
  const [group] = await db.select({ creatorId: groupsTable.creatorId }).from(groupsTable).where(eq(groupsTable.id, groupId));
  if (group?.creatorId === targetUserId) return res.status(400).json({ error: "The group creator cannot be banned" });
  await db.insert(groupBansTable).values({ groupId, userId: targetUserId, bannedBy: actorId, reason: req.body?.reason || null }).onConflictDoNothing();
  await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId)));
  return res.json({ ok: true });
});

groupAdminRouter.delete("/:id/bans/:userId", requireAuth, async (req, res: Response) => {
  const actorId = (req as AuthedRequest).currentUser.id;
  const groupId = Number(req.params.id);
  if (await getActorRole(groupId, actorId) !== "admin") return res.status(403).json({ error: "Only group admins can unban members" });
  await db.delete(groupBansTable).where(and(eq(groupBansTable.groupId, groupId), eq(groupBansTable.userId, Number(req.params.userId))));
  return res.json({ ok: true });
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
