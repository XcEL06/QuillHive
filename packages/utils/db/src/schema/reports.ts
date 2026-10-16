import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(),
  category: text("category").notNull().default("other"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("pending"),
  resolvedBy: integer("resolved_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const moderationStrikesTable = pgTable("moderation_strikes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  reportId: integer("report_id").references(() => reportsTable.id),
  reason: text("reason").notNull(),
  severity: integer("severity").notNull().default(1),
  issuedBy: integer("issued_by").references(() => usersTable.id),
  expiresAt: timestamp("expires_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  appealText: text("appeal_text"),
  appealStatus: text("appeal_status").notNull().default("none"),
  appealedAt: timestamp("appealed_at"),
  appealReviewedBy: integer("appeal_reviewed_by").references(() => usersTable.id),
  appealReviewedAt: timestamp("appeal_reviewed_at"),
  appealReviewNote: text("appeal_review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export const insertModerationStrikeSchema = createInsertSchema(moderationStrikesTable).omit({ id: true, createdAt: true });
export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type ModerationStrike = typeof moderationStrikesTable.$inferSelect;
