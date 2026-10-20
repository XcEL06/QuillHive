import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const inviteCodesTable = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  usedBy: integer("used_by").references(() => usersTable.id),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  oneActiveReusableCodePerUser: uniqueIndex("invite_codes_one_active_reusable_per_user")
    .on(table.createdBy)
    .where(sql`${table.expiresAt} IS NULL AND ${table.isActive} = true`),
}));

export type InviteCode = typeof inviteCodesTable.$inferSelect;
