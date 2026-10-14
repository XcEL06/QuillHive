import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  publicId: text("public_id").notNull().default(sql`gen_random_uuid()::text`),
  slug: text("slug").notNull().default(""),
  name: text("name").notNull(),
  description: text("description"),
  iconImage: text("icon_image"),
  coverImage: text("cover_image"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  category: text("category").notNull().default("general"),
  tags: text("tags").array().notNull().default([]),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id),
  privacy: text("privacy").notNull().default("open"),
  type: text("type").notNull().default("public"),
  rules: jsonb("rules").$type<string[]>().notNull().default([]),
  isAnnouncementOnly: boolean("is_announcement_only").notNull().default(false),
  requireApprovalFirstThree: boolean("require_approval_first_three").notNull().default(false),
  requireApprovalAll: boolean("require_approval_all").notNull().default(false),
  announcementPolicy: text("announcement_policy").notNull().default("admins"),
  isArchived: boolean("is_archived").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  features: jsonb("features").$type<{ eventsEnabled: boolean }>().notNull().default({ eventsEnabled: false }),
  isVerified: boolean("is_verified").notNull().default(false),
  isPromoted: boolean("is_promoted").notNull().default(false),
  promotedUntil: timestamp("promoted_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  slugUnique: uniqueIndex("groups_slug_unique").on(t.slug),
  publicIdUnique: uniqueIndex("groups_public_id_unique").on(t.publicId),
}));

export const groupMembersTable = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  mutedUntil: timestamp("muted_until"),
  trustScoreAtJoin: integer("trust_score_at_join"),
}, (t) => ({
  memberUnique: uniqueIndex("group_members_group_user_unique").on(t.groupId, t.userId),
  groupStatusIdx: index("group_members_group_status_idx").on(t.groupId, t.status),
}));

export const groupPostDetailsTable = pgTable("group_post_details", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("discussion"),
  poll: jsonb("poll").$type<{ options: string[]; endsAt: string | null; allowMultiple: boolean; votes: Record<string, number[]> } | null>(),
  question: jsonb("question").$type<{ isAnswered: boolean; bestAnswerId: number | null } | null>(),
  opportunityId: integer("opportunity_id"),
  opportunitySnapshot: jsonb("opportunity_snapshot").$type<{ title: string; budget: number | null; currency: string | null; type: string } | null>(),
  isPinned: boolean("is_pinned").notNull().default(false),
  isAnnouncement: boolean("is_announcement").notNull().default(false),
  commentsEnabled: boolean("comments_enabled").notNull().default(true),
  approvalStatus: text("approval_status").notNull().default("approved"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  postUnique: uniqueIndex("group_post_details_post_unique").on(t.postId),
  groupCreatedIdx: index("group_post_details_group_created_idx").on(t.groupId, t.createdAt),
}));

export const groupJoinRequestsTable = pgTable("group_join_requests", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  screeningAnswers: jsonb("screening_answers").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  requestUnique: uniqueIndex("group_join_requests_group_user_unique").on(t.groupId, t.userId),
}));

export const groupInvitesTable = pgTable("group_invites", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  invitedByUserId: integer("invited_by_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => ({
  inviteCodeUnique: uniqueIndex("group_invites_code_unique").on(t.inviteCode),
  groupStatusIdx: index("group_invites_group_status_idx").on(t.groupId, t.status),
}));

export const groupBansTable = pgTable("group_bans", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  bannedBy: integer("banned_by").notNull().references(() => usersTable.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  banUnique: uniqueIndex("group_bans_group_user_unique").on(t.groupId, t.userId),
}));

export const groupPinnedPostsTable = pgTable("group_pinned_posts", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  pinnedBy: integer("pinned_by").notNull().references(() => usersTable.id),
  pinnedAt: timestamp("pinned_at").defaultNow().notNull(),
});

export const groupActivityLogsTable = pgTable("group_activity_logs", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  groupCreatedIdx: index("group_activity_logs_group_created_idx").on(t.groupId, t.createdAt),
}));

export const insertGroupSchema = createInsertSchema(groupsTable).omit({ id: true, publicId: true, createdAt: true });
export const insertGroupMemberSchema = createInsertSchema(groupMembersTable).omit({ id: true, joinedAt: true });

export type Group = typeof groupsTable.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type GroupMember = typeof groupMembersTable.$inferSelect;
export type GroupJoinRequest = typeof groupJoinRequestsTable.$inferSelect;
export type GroupInvite = typeof groupInvitesTable.$inferSelect;
export type GroupBan = typeof groupBansTable.$inferSelect;
export type GroupPinnedPost = typeof groupPinnedPostsTable.$inferSelect;
