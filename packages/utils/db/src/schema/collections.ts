import { pgTable, text, serial, timestamp, integer, unique, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const collectionPostsTable = pgTable("collection_posts", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => collectionsTable.id),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.collectionId, t.postId)]);

export const insertCollectionSchema = createInsertSchema(collectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCollectionPostSchema = createInsertSchema(collectionPostsTable).omit({ id: true, createdAt: true });

export type Collection = typeof collectionsTable.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type CollectionPost = typeof collectionPostsTable.$inferSelect;
