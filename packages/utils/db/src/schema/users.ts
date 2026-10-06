import { pgTable, text, serial, timestamp, integer, boolean, real, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  publicId: text("public_id").notNull().default(sql`gen_random_uuid()::text`),
  username: text("username").notNull().unique(),
  lastUsernameChangeAt: timestamp("last_username_change_at"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  authVersion: integer("auth_version").notNull().default(0),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  headline: text("headline"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  website: text("website"),
  location: text("location"),
  country: text("country"),
  facebook: text("facebook"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  instagram: text("instagram"),
  profileVisibility: text("profile_visibility").notNull().default("public"),
  showEmail: boolean("show_email").notNull().default(false),
  showWebsite: boolean("show_website").notNull().default(true),
  showLocation: boolean("show_location").notNull().default(true),
  showPostsToEveryone: boolean("show_posts_to_everyone").notNull().default(true),
  allowMessagesFromAnyone: boolean("allow_messages_from_anyone").notNull().default(false),
  showInSearch: boolean("show_in_search").notNull().default(true),
  role: text("role").notNull().default("user"),
  lang: text("lang").notNull().default("en"),
  emailVerified: boolean("email_verified").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  bannedAt: timestamp("banned_at"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  isFeatured: boolean("is_featured").notNull().default(false),
  featuredUntil: timestamp("featured_until"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  onboardingGoals: text("onboarding_goals"),
  identityType: text("identity_type"),
  signupIpHash: text("signup_ip_hash"),
  signupUserAgent: text("signup_user_agent"),
  lastKnownIPHash: text("last_known_ip_hash"),
  lastKnownCountry: text("last_known_country"),
  lastKnownTimezone: text("last_known_timezone"),
  locationIntegrityStatus: text("location_integrity_status").notNull().default("unknown"),
  locationRiskScore: integer("location_risk_score").notNull().default(0),
  isCreatorMode: boolean("is_creator_mode").notNull().default(false),
  visibilityPenalty: real("visibility_penalty").notNull().default(0),
  reachMultiplier: real("reach_multiplier").notNull().default(1.0),
  isPremium: boolean("is_premium").notNull().default(false),
  isOfficialAccount: boolean("is_official_account").notNull().default(false),
  hireMeEnabled: boolean("hire_me_enabled").notNull().default(false),
  emailDigestEnabled: boolean("email_digest_enabled").notNull().default(true),
  topicNotificationEnabled: boolean("topic_notification_enabled").notNull().default(true),
  notificationPrefs: jsonb("notification_prefs").$type<Record<string, { inApp: boolean; push: boolean; email: boolean }>>(),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  passwordResetTokenHash: text("password_reset_token_hash"),
  passwordResetExpires: timestamp("password_reset_expires"),
  referralSource: text("referral_source"),
  referredBy: integer("referred_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  publicIdUnique: uniqueIndex("users_public_id_unique").on(t.publicId),
}));

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => usersTable.id),
  followingId: integer("following_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxFollowsFollowerId: index("idx_follows_follower_id").on(t.followerId),
  idxFollowsFollowingId: index("idx_follows_following_id").on(t.followingId),
  uniqFollowerFollowing: uniqueIndex("idx_follows_unique").on(t.followerId, t.followingId),
}));

export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blockedEmailAttemptsTable = pgTable("blocked_email_attempts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  domain: text("domain").notNull(),
  reason: text("reason").notNull(),
  reputationScore: integer("reputation_score").notNull(),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workHistoryTable = pgTable("work_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  organization: text("organization").notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const educationHistoryTable = pgTable("education_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  school: text("school").notNull(),
  degree: text("degree").notNull(),
  field: text("field"),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  tokenHash: text("token_hash").notNull().unique(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revokedTokensTable = pgTable("revoked_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxRevokedTokensExpiresAt: index("idx_revoked_tokens_expires_at").on(t.expiresAt),
}));

export const loginEventsTable = pgTable("login_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  country: text("country"),
  timezone: text("timezone"),
  integrityStatus: text("integrity_status").notNull().default("normal"),
  riskScore: integer("risk_score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, publicId: true, createdAt: true, updatedAt: true });
export const insertFollowSchema = createInsertSchema(followsTable).omit({ id: true, createdAt: true });
export const insertWorkHistorySchema = createInsertSchema(workHistoryTable).omit({ id: true, createdAt: true });
export const insertEducationHistorySchema = createInsertSchema(educationHistoryTable).omit({ id: true, createdAt: true });
export const insertBlockedEmailAttemptSchema = createInsertSchema(blockedEmailAttemptsTable).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export const insertLoginEventSchema = createInsertSchema(loginEventsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Follow = typeof followsTable.$inferSelect;
export type WorkHistory = typeof workHistoryTable.$inferSelect;
export type EducationHistory = typeof educationHistoryTable.$inferSelect;
export type BlockedEmailAttempt = typeof blockedEmailAttemptsTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type LoginEvent = typeof loginEventsTable.$inferSelect;
