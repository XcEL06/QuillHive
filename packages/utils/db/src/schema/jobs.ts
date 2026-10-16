import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("job"),
  skills: text("skills").notNull().default("[]"),
  compensation: text("compensation"),
  feeDetails: text("fee_details"),
  remote: boolean("remote").notNull().default(true),
  location: text("location"),
  isPaid: boolean("is_paid").notNull().default(false),
  budget: real("budget"),
  companyName: text("company_name"),
  applyUrl: text("apply_url"),
  applyEmail: text("apply_email"),
  isActive: boolean("is_active").notNull().default(true),
  isApproved: boolean("is_approved").notNull().default(true),
  moderationStatus: text("moderation_status").notNull().default("published"),
  isFeatured: boolean("is_featured").notNull().default(false),
  featuredUntil: timestamp("featured_until"),
  viewCount: integer("view_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true });
export type Job = typeof jobsTable.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
