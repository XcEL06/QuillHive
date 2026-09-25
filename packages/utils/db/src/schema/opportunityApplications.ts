import { pgTable, serial, integer, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { jobsTable } from "./jobs";

export const opportunityApplicationsTable = pgTable("opportunity_applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  applicantId: integer("applicant_id").notNull().references(() => usersTable.id),
  message: text("message"),
  proposedBudget: real("proposed_budget"),
  proposedCurrency: text("proposed_currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  conversationId: integer("conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  applicantJobUnique: uniqueIndex("opportunity_applications_job_applicant_unique").on(t.jobId, t.applicantId),
}));

export type OpportunityApplication = typeof opportunityApplicationsTable.$inferSelect;