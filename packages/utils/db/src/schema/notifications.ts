import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  actorId: integer("actor_id").notNull().references(() => usersTable.id),
  postId: integer("post_id"),
  groupId: integer("group_id"),
  url: text("url"),
  message: text("message").notNull(),
  title: text("title"),
  groupCount: integer("group_count").default(1),
  isRead: boolean("is_read").notNull().default(false),
  category: text("category").notNull().default("social"),
  digestGroup: text("digest_group"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxNotificationsUserId: index("idx_notifications_user_id").on(t.userId),
  idxNotificationsIsRead: index("idx_notifications_is_read").on(t.isRead),
  idxNotificationsCreatedAt: index("idx_notifications_created_at").on(t.createdAt),
}));

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
