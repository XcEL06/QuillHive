import { pgTable, serial, integer, text, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const spamReviewFlagsTable = pgTable("spam_review_flags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ruleKey: text("rule_key").notNull(),
  reason: text("reason").notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("pending"),
  decision: text("decision"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userRuleUnique: uniqueIndex("spam_review_flags_user_rule_unique").on(table.userId, table.ruleKey),
  statusCreatedIdx: index("spam_review_flags_status_created_idx").on(table.status, table.createdAt),
}));
