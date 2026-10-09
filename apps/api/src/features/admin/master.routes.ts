import { Router } from "express";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  boostRequestsTable,
  commentsTable,
  conversationParticipantsTable,
  conversationsTable,
  creatorProfilesTable,
  followsTable,
  groupActivityLogsTable,
  groupBansTable,
  groupInvitesTable,
  groupJoinRequestsTable,
  groupMembersTable,
  groupPostDetailsTable,
  groupsTable,
  messagesTable,
  postsTable,
  usersTable,
  workHistoryTable,
  educationHistoryTable,
} from "@workspace/db/schema";
import { requireSuperAdmin } from "../../middleware/admin";

export const masterAdminRouter = Router();
masterAdminRouter.use(requireSuperAdmin);

masterAdminRouter.get("/overview", async (_req, res) => {
  const [[userStats], [groupStats], [contentStats], [conversationStats]] = await Promise.all([
    db.select({ total: count(), banned: count(sql`CASE WHEN ${usersTable.isBanned} THEN 1 END`) }).from(usersTable),
    db.select({ total: count(), private: count(sql`CASE WHEN ${groupsTable.privacy} = 'private' THEN 1 END`) }).from(groupsTable),
    db.select({ total: count(), sparks: count(sql`CASE WHEN ${postsTable.type} = 'spark' THEN 1 END`) }).from(postsTable),
    db.select({ total: count() }).from(conversationsTable),
  ]);
  return res.json({ users: userStats, groups: groupStats, content: contentStats, conversations: conversationStats });
});

masterAdminRouter.get("/users", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) return res.json({ users: [] });
  const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    email: usersTable.email,
    avatarUrl: usersTable.avatarUrl,
    role: usersTable.role,
    profileVisibility: usersTable.profileVisibility,
    isBanned: usersTable.isBanned,
    isDeleted: usersTable.isDeleted,
    createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(and(
      eq(usersTable.isDeleted, false),
      or(ilike(usersTable.username, pattern), ilike(usersTable.displayName, pattern), ilike(usersTable.email, pattern)),
    ))
    .orderBy(desc(usersTable.createdAt)).limit(30);
  return res.json({ users });
});

masterAdminRouter.get("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid user id" });
  const [user] = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    email: usersTable.email,
    displayName: usersTable.displayName,
    bio: usersTable.bio,
    headline: usersTable.headline,
    avatarUrl: usersTable.avatarUrl,
    coverUrl: usersTable.coverUrl,
    website: usersTable.website,
    location: usersTable.location,
    country: usersTable.country,
    facebook: usersTable.facebook,
    linkedin: usersTable.linkedin,
    twitter: usersTable.twitter,
    instagram: usersTable.instagram,
    profileVisibility: usersTable.profileVisibility,
    showEmail: usersTable.showEmail,
    showWebsite: usersTable.showWebsite,
    showLocation: usersTable.showLocation,
    showPostsToEveryone: usersTable.showPostsToEveryone,
    role: usersTable.role,
    emailVerified: usersTable.emailVerified,
    isBanned: usersTable.isBanned,
    bannedAt: usersTable.bannedAt,
    isDeleted: usersTable.isDeleted,
    deletedAt: usersTable.deletedAt,
    isCreatorMode: usersTable.isCreatorMode,
    isPremium: usersTable.isPremium,
    isOfficialAccount: usersTable.isOfficialAccount,
    createdAt: usersTable.createdAt,
    updatedAt: usersTable.updatedAt,
  }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) return res.status(404).json({ error: "User not found" });

  const [posts, workHistory, education, creatorProfile, boosts, [followers], [following], [comments]] = await Promise.all([
    db.select({
      id: postsTable.id,
      title: postsTable.title,
      content: postsTable.content,
      excerpt: postsTable.excerpt,
      type: postsTable.type,
      visibility: postsTable.visibility,
      groupId: postsTable.groupId,
      isPublished: postsTable.isPublished,
      isDeleted: postsTable.isDeleted,
      createdAt: postsTable.createdAt,
      updatedAt: postsTable.updatedAt,
    }).from(postsTable).where(eq(postsTable.authorId, id)).orderBy(desc(postsTable.createdAt)).limit(100),
    db.select().from(workHistoryTable).where(eq(workHistoryTable.userId, id)).orderBy(desc(workHistoryTable.startYear)),
    db.select().from(educationHistoryTable).where(eq(educationHistoryTable.userId, id)).orderBy(desc(educationHistoryTable.startYear)),
    db.select().from(creatorProfilesTable).where(eq(creatorProfilesTable.userId, id)).then((rows) => rows[0] ?? null),
    db.select().from(boostRequestsTable).where(eq(boostRequestsTable.userId, id)).orderBy(desc(boostRequestsTable.createdAt)).limit(50),
    db.select({ count: count() }).from(followsTable).where(eq(followsTable.followingId, id)),
    db.select({ count: count() }).from(followsTable).where(eq(followsTable.followerId, id)),
    db.select({ count: count() }).from(commentsTable).where(eq(commentsTable.authorId, id)),
  ]);
  return res.json({
    user,
    posts,
    workHistory,
    education,
    creatorProfile,
    boosts,
    activity: { followers: followers.count, following: following.count, comments: comments.count },
  });
});

masterAdminRouter.get("/groups", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) return res.json({ groups: [] });
  const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
  const groups = await db.select({
    id: groupsTable.id,
    slug: groupsTable.slug,
    name: groupsTable.name,
    description: groupsTable.description,
    privacy: groupsTable.privacy,
    type: groupsTable.type,
    creatorId: groupsTable.creatorId,
    isArchived: groupsTable.isArchived,
    isDeleted: groupsTable.isDeleted,
    createdAt: groupsTable.createdAt,
  }).from(groupsTable).where(or(ilike(groupsTable.name, pattern), ilike(groupsTable.slug, pattern)))
    .orderBy(desc(groupsTable.createdAt)).limit(30);
  return res.json({ groups });
});

masterAdminRouter.get("/groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid group id" });
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) return res.status(404).json({ error: "Group not found" });
  const [posts, members, [memberCount], postDetails, joinRequests, bans, invites, activity] = await Promise.all([
    db.select({
      id: postsTable.id,
      title: postsTable.title,
      content: postsTable.content,
      type: postsTable.type,
      visibility: postsTable.visibility,
      isPublished: postsTable.isPublished,
      isDeleted: postsTable.isDeleted,
      createdAt: postsTable.createdAt,
      authorId: usersTable.id,
      authorUsername: usersTable.username,
      authorDisplayName: usersTable.displayName,
    }).from(postsTable).leftJoin(usersTable, eq(usersTable.id, postsTable.authorId))
      .where(eq(postsTable.groupId, id)).orderBy(desc(postsTable.createdAt)).limit(100),
    db.select({
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      profileVisibility: usersTable.profileVisibility,
      role: groupMembersTable.role,
      status: groupMembersTable.status,
      joinedAt: groupMembersTable.joinedAt,
    }).from(groupMembersTable).innerJoin(usersTable, eq(usersTable.id, groupMembersTable.userId))
      .where(eq(groupMembersTable.groupId, id)).orderBy(desc(groupMembersTable.joinedAt)).limit(300),
    db.select({ count: count() }).from(groupMembersTable).where(eq(groupMembersTable.groupId, id)),
    db.select().from(groupPostDetailsTable).where(eq(groupPostDetailsTable.groupId, id)).orderBy(desc(groupPostDetailsTable.createdAt)).limit(100),
    db.select({
      id: groupJoinRequestsTable.id,
      userId: groupJoinRequestsTable.userId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      status: groupJoinRequestsTable.status,
      screeningAnswers: groupJoinRequestsTable.screeningAnswers,
      reviewedBy: groupJoinRequestsTable.reviewedBy,
      reviewedAt: groupJoinRequestsTable.reviewedAt,
      createdAt: groupJoinRequestsTable.createdAt,
    }).from(groupJoinRequestsTable).innerJoin(usersTable, eq(usersTable.id, groupJoinRequestsTable.userId))
      .where(eq(groupJoinRequestsTable.groupId, id)).orderBy(desc(groupJoinRequestsTable.createdAt)).limit(100),
    db.select().from(groupBansTable).where(eq(groupBansTable.groupId, id)).orderBy(desc(groupBansTable.createdAt)).limit(100),
    db.select({
      id: groupInvitesTable.id,
      invitedByUserId: groupInvitesTable.invitedByUserId,
      status: groupInvitesTable.status,
      createdAt: groupInvitesTable.createdAt,
      expiresAt: groupInvitesTable.expiresAt,
    }).from(groupInvitesTable).where(eq(groupInvitesTable.groupId, id)).orderBy(desc(groupInvitesTable.createdAt)).limit(100),
    db.select().from(groupActivityLogsTable).where(eq(groupActivityLogsTable.groupId, id)).orderBy(desc(groupActivityLogsTable.createdAt)).limit(100),
  ]);
  return res.json({ group, posts, members, memberCount: memberCount.count, postDetails, joinRequests, bans, invites, activity });
});

masterAdminRouter.get("/conversations", async (_req, res) => {
  const conversations = await db.select({
    id: conversationsTable.id,
    isGroup: conversationsTable.isGroup,
    groupName: conversationsTable.groupName,
    createdAt: conversationsTable.createdAt,
    lastActivity: sql<Date>`COALESCE(MAX(${messagesTable.createdAt}), ${conversationsTable.updatedAt})`,
    messageCount: count(messagesTable.id),
  }).from(conversationsTable).leftJoin(messagesTable, eq(messagesTable.conversationId, conversationsTable.id))
    .groupBy(conversationsTable.id)
    .orderBy(desc(sql`COALESCE(MAX(${messagesTable.createdAt}), ${conversationsTable.updatedAt})`))
    .limit(100);
  const ids = conversations.map((conversation) => conversation.id);
  const participants = ids.length ? await db.select({
    conversationId: conversationParticipantsTable.conversationId,
    userId: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
  }).from(conversationParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.id, conversationParticipantsTable.userId))
    .where(inArray(conversationParticipantsTable.conversationId, ids)) : [];
  return res.json({
    conversations: conversations.map((conversation) => ({
      ...conversation,
      participants: participants.filter((participant) => participant.conversationId === conversation.id),
    })),
  });
});
