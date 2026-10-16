import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const userTrustScoresTable = pgTable("user_trust_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id),
  cvs: real("cvs").notNull().default(0),
  bcs: real("bcs").notNull().default(0),
  cts: real("cts").notNull().default(0),
  avgCis: real("avg_cis").notNull().default(0),
  uti: real("uti").notNull().default(0),
  isDisputed: boolean("is_disputed").notNull().default(false),
  disputeReason: text("dispute_reason"),
  disputeReviewNote: text("dispute_review_note"),
  disputedAt: timestamp("disputed_at"),
  visibilityMultiplier: real("visibility_multiplier").notNull().default(0.3),
  // Deprecated compatibility field. Use creatorLevel for display and logic.
  tier: text("tier").notNull().default("restricted"),
  creatorLevel: text("creator_level").notNull().default("new_voice"),
  levelUpdatedAt: timestamp("level_updated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const postTrustScoresTable = pgTable("post_trust_scores", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().unique().references(() => postsTable.id),
  retentionScore: real("retention_score").notNull().default(0),
  saveRate: real("save_rate").notNull().default(0),
  deepEngagementRate: real("deep_engagement_rate").notNull().default(0),
  thoughtSpread: real("thought_spread").notNull().default(0),
  cisScore: real("cis_score").notNull().default(0),
  longevityScore: real("longevity_score").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const behaviorEventsTable = pgTable("behavior_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  eventType: text("event_type").notNull(),
  severity: integer("severity").notNull().default(1),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reputationEventsTable = pgTable("reputation_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  scoreChange: real("score_change").notNull().default(0),
  reason: text("reason").notNull(),
  eventKey: text("event_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserTrustScore = typeof userTrustScoresTable.$inferSelect;
export type PostTrustScore = typeof postTrustScoresTable.$inferSelect;
export type BehaviorEvent = typeof behaviorEventsTable.$inferSelect;
export type ReputationEvent = typeof reputationEventsTable.$inferSelect;
