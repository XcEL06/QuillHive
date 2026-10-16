import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const seriesTable = pgTable("series", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  slug: text("slug").notNull(),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const seriesFollowsTable = pgTable("series_follows", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull().references(() => seriesTable.id, { onDelete: "cascade" }),
  followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  seriesFollowerUnique: uniqueIndex("series_follows_series_follower_unique").on(table.seriesId, table.followerId),
}));

export const insertSeriesSchema = createInsertSchema(seriesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Series = typeof seriesTable.$inferSelect;
export type InsertSeries = z.infer<typeof insertSeriesSchema>;
