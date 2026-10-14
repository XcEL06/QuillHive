import { pgTable, text, serial, timestamp, integer, boolean, real, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const creatorSubscriptionPlansTable = pgTable("creator_subscription_plans", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthly: real("price_monthly").notNull().default(0),
  priceYearly: real("price_yearly"),
  currency: text("currency").notNull().default("USD"),
  perks: text("perks").notNull().default("[]"),
  isActive: boolean("is_active").notNull().default(true),
  subscriberCount: integer("subscriber_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creatorSubscriptionsTable = pgTable("creator_subscriptions", {
  id: serial("id").primaryKey(),
  subscriberId: integer("subscriber_id").notNull().references(() => usersTable.id),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").references(() => creatorSubscriptionPlansTable.id),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  renewsAt: timestamp("renews_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueSubscriberCreator: uniqueIndex("creator_sub_unique").on(t.subscriberId, t.creatorId),
}));

export const creatorTipsTable = pgTable("creator_tips", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => usersTable.id),
  toCreatorId: integer("to_creator_id").notNull().references(() => usersTable.id),
  postId: integer("post_id").references(() => postsTable.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceListingsTable = pgTable("service_listings", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  deliverables: text("deliverables").notNull().default("[]"),
  pricingModel: text("pricing_model").notNull().default("fixed"),
  priceFrom: real("price_from"),
  priceTo: real("price_to"),
  currency: text("currency").notNull().default("USD"),
  deliveryDays: integer("delivery_days"),
  portfolioUrls: text("portfolio_urls").notNull().default("[]"),
  skills: text("skills").notNull().default("[]"),
  isActive: boolean("is_active").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  inquiryCount: integer("inquiry_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxCreatorId: index("idx_service_listings_creator_id").on(t.creatorId),
  idxActive: index("idx_service_listings_active").on(t.isActive),
}));

export const commissionRequestsTable = pgTable("commission_requests", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull().references(() => usersTable.id),
  toCreatorId: integer("to_creator_id").notNull().references(() => usersTable.id),
  serviceListingId: integer("service_listing_id").references(() => serviceListingsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  budget: real("budget"),
  currency: text("currency").notNull().default("USD"),
  deadline: timestamp("deadline"),
  status: text("status").notNull().default("pending"),
  creatorResponse: text("creator_response"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxToCreator: index("idx_commissions_to_creator").on(t.toCreatorId),
  idxFromUser: index("idx_commissions_from_user").on(t.fromUserId),
  idxStatus: index("idx_commissions_status").on(t.status),
}));

export const paidPostAccessTable = pgTable("paid_post_access", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (t) => ({
  uniquePostUser: uniqueIndex("paid_post_access_unique").on(t.postId, t.userId),
}));

export const creatorEarningsTable = pgTable("creator_earnings", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id),
  source: text("source").notNull(),
  sourceId: integer("source_id"),
  grossAmount: real("gross_amount").notNull(),
  platformFee: real("platform_fee").notNull().default(0),
  netAmount: real("net_amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creatorPaymentTransactionsTable = pgTable("creator_payment_transactions", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").notNull().references(() => usersTable.id),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id),
  serviceListingId: integer("service_listing_id").references(() => serviceListingsTable.id),
  commissionRequestId: integer("commission_request_id").references(() => commissionRequestsTable.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  txRef: text("tx_ref").notNull().unique(),
  transactionId: text("transaction_id").unique(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
}, (t) => ({
  idxBuyer: index("idx_creator_payment_buyer").on(t.buyerId),
  idxCreator: index("idx_creator_payment_creator").on(t.creatorId),
  idxStatus: index("idx_creator_payment_status").on(t.status),
}));

export const skillEndorsementsTable = pgTable("skill_endorsements", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull().references(() => usersTable.id),
  toUserId: integer("to_user_id").notNull().references(() => usersTable.id),
  skill: text("skill").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueEndorsement: uniqueIndex("skill_endorsement_unique").on(t.fromUserId, t.toUserId, t.skill),
  idxToUser: index("idx_endorsements_to_user").on(t.toUserId),
  idxToUserSkill: index("idx_endorsements_to_user_skill").on(t.toUserId, t.skill),
  idxFromUser: index("idx_endorsements_from_user").on(t.fromUserId),
}));

export const creatorAvailabilityTable = pgTable("creator_availability", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id),
  status: text("status").notNull().default("available"),
  availableFor: text("available_for").notNull().default("[]"),
  hoursPerWeek: integer("hours_per_week"),
  ratePerHour: real("rate_per_hour"),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone"),
  publicNote: text("public_note"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxAvailabilityUser: index("idx_availability_user").on(t.userId),
  idxAvailabilityStatus: index("idx_availability_status").on(t.status),
}));

export type CreatorSubscriptionPlan = typeof creatorSubscriptionPlansTable.$inferSelect;
export type CreatorSubscription = typeof creatorSubscriptionsTable.$inferSelect;
export type CreatorTip = typeof creatorTipsTable.$inferSelect;
export type ServiceListing = typeof serviceListingsTable.$inferSelect;
export type CommissionRequest = typeof commissionRequestsTable.$inferSelect;
export type CreatorEarnings = typeof creatorEarningsTable.$inferSelect;
export type CreatorPaymentTransaction = typeof creatorPaymentTransactionsTable.$inferSelect;
export type SkillEndorsement = typeof skillEndorsementsTable.$inferSelect;
export type CreatorAvailability = typeof creatorAvailabilityTable.$inferSelect;
