import { pgTable, text, serial, timestamp, integer, boolean, real, jsonb, index, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  title: text("title"),
  titleA: text("title_a"),
  titleB: text("title_b"),
  titleAClicks: integer("title_a_clicks").notNull().default(0),
  titleBClicks: integer("title_b_clicks").notNull().default(0),
  abSelectedTitle: text("ab_selected_title"),
  abLockedAt: timestamp("ab_locked_at"),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  type: text("type").notNull().default("post"),
  imageUrl: text("image_url"),
  attachments: text("attachments").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  isPublished: boolean("is_published").notNull().default(true),
  visibility: text("visibility").notNull().default("public"),
  scheduledAt: timestamp("scheduled_at"),
  expiresAt: timestamp("expires_at"),
  viewedBy: jsonb("viewed_by").default(sql`'[]'::jsonb`),
  isHighlight: boolean("is_highlight").notNull().default(false),
  contentWarning: text("content_warning"),
  contentTags: text("content_tags").notNull().default("[]"),
  aiTextScore: real("ai_text_score"),
  fingerprint: text("fingerprint"),
  seriesId: integer("series_id"),
  seriesOrder: integer("series_order"),
  groupId: integer("group_id"),
  shareClickCount: integer("share_click_count").notNull().default(0),
  isSponsored: boolean("is_sponsored").notNull().default(false),
  sponsorName: text("sponsor_name"),
  sponsorLogoUrl: text("sponsor_logo_url"),
  sponsorUrl: text("sponsor_url"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  isOfficialPost: boolean("is_official_post").notNull().default(false),
  postCategory: text("post_category"),
  officialPostPriority: integer("official_post_priority").notNull().default(0),
  ctaButtons: jsonb("cta_buttons"),
  officialTargetAudience: text("official_target_audience"),
  officialLanguage: text("official_language"),
  challengeHashtag: text("challenge_hashtag"),
  challengeEndsAt: timestamp("challenge_ends_at"),
  challengeRewardText: text("challenge_reward_text"),
  featuredCreatorId: integer("featured_creator_id"),
  quotedPostId: integer("quoted_post_id").references((): AnyPgColumn => postsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxPostsAuthorId: index("idx_posts_author_id").on(t.authorId),
  idxPostsCreatedAt: index("idx_posts_created_at").on(t.createdAt),
  idxPostsIsPublished: index("idx_posts_is_published").on(t.isPublished),
  idxPostsIsDeleted: index("idx_posts_is_deleted").on(t.isDeleted),
  idxPostsType: index("idx_posts_type").on(t.type),
  idxPostsScheduledAt: index("idx_posts_scheduled_at").on(t.scheduledAt),
}));

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  parentCommentId: integer("parent_comment_id"),
  depth: integer("depth").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxCommentsPostId: index("idx_comments_post_id").on(t.postId),
  idxCommentsAuthorId: index("idx_comments_author_id").on(t.authorId),
}));

export const commentLikesTable = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => commentsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxCommentLikesCommentId: index("idx_comment_likes_comment_id").on(t.commentId),
  idxCommentLikesUserId: index("idx_comment_likes_user_id").on(t.userId),
}));

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxLikesPostId: index("idx_likes_post_id").on(t.postId),
  idxLikesUserId: index("idx_likes_user_id").on(t.userId),
  uniqueLikePerUserPost: uniqueIndex("likes_user_post_unique").on(t.postId, t.userId),
}));

export const postSharesTable = pgTable("post_shares", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  source: text("source"),
  clickCount: integer("click_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxPostSharesPostId: index("idx_post_shares_post_id").on(t.postId),
}));

export const repostsTable = pgTable("reposts", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxRepostsPostId: index("idx_reposts_post_id").on(t.postId),
  idxRepostsUserId: index("idx_reposts_user_id").on(t.userId),
}));

export const savedPostsTable = pgTable("saved_posts", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxSavedPostsUserId: index("idx_saved_posts_user_id").on(t.userId),
  idxSavedPostsPostId: index("idx_saved_posts_post_id").on(t.postId),
  uniqueSavedPost: uniqueIndex("saved_posts_user_post_unique").on(t.userId, t.postId),
}));

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export const insertLikeSchema = createInsertSchema(likesTable).omit({ id: true, createdAt: true });
export const insertPostShareSchema = createInsertSchema(postSharesTable).omit({ id: true, createdAt: true });
export const insertRepostSchema = createInsertSchema(repostsTable).omit({ id: true, createdAt: true });
export const insertSavedPostSchema = createInsertSchema(savedPostsTable).omit({ id: true, createdAt: true });
export const insertCommentLikeSchema = createInsertSchema(commentLikesTable).omit({ id: true, createdAt: true });

export type Post = typeof postsTable.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Comment = typeof commentsTable.$inferSelect;
export type Like = typeof likesTable.$inferSelect;
export type PostShare = typeof postSharesTable.$inferSelect;
export type Repost = typeof repostsTable.$inferSelect;
export type SavedPost = typeof savedPostsTable.$inferSelect;
export type CommentLike = typeof commentLikesTable.$inferSelect;
