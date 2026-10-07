import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/admin";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate";
import { db } from "@workspace/db";
import {
  serviceListingsTable,
  commissionRequestsTable,
  skillEndorsementsTable,
  usersTable,
  creatorAvailabilityTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, and, desc, ilike, or, inArray } from "drizzle-orm";
import { requireCreatorIncomeEnabled } from "../../middleware/creatorIncome";

export const serviceListingsRouter = Router();
export const endorsementsRouter = Router();
export const creatorMarketplaceRouter = Router();
serviceListingsRouter.use(requireCreatorIncomeEnabled);
endorsementsRouter.use(requireCreatorIncomeEnabled);

const createListingSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(2000),
  category: z.string().min(2).max(60),
  deliverables: z.array(z.string().max(200)).max(10).default([]),
  pricingModel: z.enum(["fixed", "hourly", "project", "negotiable"]).default("fixed"),
  priceFrom: z.number().positive().optional(),
  priceTo: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  deliveryDays: z.number().int().positive().max(365).optional(),
  portfolioUrls: z.array(z.string().url()).max(6).default([]),
  skills: z.array(z.string().max(60)).max(15).default([]),
});

const commissionRequestSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(3000),
  budget: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  deadline: z.string().datetime().optional(),
  serviceListingId: z.number().int().positive().optional(),
});

const endorseSchema = z.object({
  skill: z.string().min(2).max(60),
});

const availabilitySchema = z.object({
  status: z.enum(["available", "busy", "unavailable", "open_to_opportunities"]).default("available"),
  availableFor: z.array(z.string().max(80)).max(10).default([]),
  hoursPerWeek: z.number().int().min(1).max(80).optional(),
  ratePerHour: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  timezone: z.string().max(60).optional(),
  publicNote: z.string().max(400).optional(),
});

serviceListingsRouter.get("/", validateQuery(z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})), async (req: any, res) => {
  const { category, q, limit, offset } = req.query as { category?: string; q?: string; limit: number; offset: number };
  const conds: ReturnType<typeof eq>[] = [eq(serviceListingsTable.isActive, true)];
  if (category) conds.push(eq(serviceListingsTable.category, category));
  let listings = await db.select({
    id: serviceListingsTable.id,
    creatorId: serviceListingsTable.creatorId,
    title: serviceListingsTable.title,
    description: serviceListingsTable.description,
    category: serviceListingsTable.category,
    pricingModel: serviceListingsTable.pricingModel,
    priceFrom: serviceListingsTable.priceFrom,
    priceTo: serviceListingsTable.priceTo,
    currency: serviceListingsTable.currency,
    deliveryDays: serviceListingsTable.deliveryDays,
    skills: serviceListingsTable.skills,
    viewCount: serviceListingsTable.viewCount,
    inquiryCount: serviceListingsTable.inquiryCount,
    createdAt: serviceListingsTable.createdAt,
  }).from(serviceListingsTable).where(and(...conds)).orderBy(desc(serviceListingsTable.inquiryCount)).limit(limit).offset(offset);

  if (q) {
    const lq = q.toLowerCase();
    listings = listings.filter(l =>
      l.title.toLowerCase().includes(lq) ||
      l.description.toLowerCase().includes(lq) ||
      l.category.toLowerCase().includes(lq)
    );
  }

  const creatorIds = [...new Set(listings.map(l => l.creatorId))];
  const creators = creatorIds.length > 0
    ? await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username, avatarUrl: usersTable.avatarUrl, headline: usersTable.headline })
        .from(usersTable).where(inArray(usersTable.id, creatorIds))
    : [];
  const creatorMap = new Map(creators.map(c => [c.id, c]));

  return res.json(listings.map(l => ({ ...l, creator: creatorMap.get(l.creatorId) ?? null })));
});

serviceListingsRouter.post("/", requireAuth, validateBody(createListingSchema), async (req: any, res) => {
  const data = req.body as z.infer<typeof createListingSchema>;
  const [listing] = await db.insert(serviceListingsTable).values({
    creatorId: req.currentUser.id,
    ...data,
    deliverables: JSON.stringify(data.deliverables),
    portfolioUrls: JSON.stringify(data.portfolioUrls),
    skills: JSON.stringify(data.skills),
  }).returning();
  return res.status(201).json(listing);
});

serviceListingsRouter.get("/me", requireAuth, async (req: any, res) => {
  const listings = await db.select().from(serviceListingsTable)
    .where(eq(serviceListingsTable.creatorId, req.currentUser.id))
    .orderBy(desc(serviceListingsTable.createdAt));
  return res.json(listings);
});

serviceListingsRouter.get("/creator/:username", validateParams(z.object({ username: z.string() })), async (req: any, res) => {
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, req.params.username));
  if (!user) return res.status(404).json({ error: "User not found" });
  const listings = await db.select().from(serviceListingsTable)
    .where(and(eq(serviceListingsTable.creatorId, user.id), eq(serviceListingsTable.isActive, true)))
    .orderBy(desc(serviceListingsTable.createdAt));
  return res.json(listings);
});

serviceListingsRouter.get("/:id", validateParams(z.object({ id: z.coerce.number().int().positive() })), async (req: any, res) => {
  const [listing] = await db.select().from(serviceListingsTable).where(eq(serviceListingsTable.id, Number(req.params.id)));
  if (!listing) return res.status(404).json({ error: "Not found" });
  await db.update(serviceListingsTable).set({ viewCount: (listing.viewCount ?? 0) + 1 }).where(eq(serviceListingsTable.id, listing.id));
  const [creator] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username, avatarUrl: usersTable.avatarUrl, headline: usersTable.headline }).from(usersTable).where(eq(usersTable.id, listing.creatorId));
  return res.json({ ...listing, creator: creator ?? null });
});

serviceListingsRouter.patch("/:id", requireAuth, validateParams(z.object({ id: z.coerce.number().int().positive() })), validateBody(createListingSchema.partial()), async (req: any, res) => {
  const [listing] = await db.select({ creatorId: serviceListingsTable.creatorId }).from(serviceListingsTable).where(eq(serviceListingsTable.id, Number(req.params.id)));
  if (!listing) return res.status(404).json({ error: "Not found" });
  if (listing.creatorId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
  const data = req.body as Partial<z.infer<typeof createListingSchema>>;
  const update: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.deliverables) update.deliverables = JSON.stringify(data.deliverables);
  if (data.portfolioUrls) update.portfolioUrls = JSON.stringify(data.portfolioUrls);
  if (data.skills) update.skills = JSON.stringify(data.skills);
  const [updated] = await db.update(serviceListingsTable).set(update).where(eq(serviceListingsTable.id, Number(req.params.id))).returning();
  return res.json(updated);
});

serviceListingsRouter.delete("/:id", requireAuth, validateParams(z.object({ id: z.coerce.number().int().positive() })), async (req: any, res) => {
  const [listing] = await db.select({ creatorId: serviceListingsTable.creatorId }).from(serviceListingsTable).where(eq(serviceListingsTable.id, Number(req.params.id)));
  if (!listing) return res.status(404).json({ error: "Not found" });
  if (listing.creatorId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
  await db.update(serviceListingsTable).set({ isActive: false }).where(eq(serviceListingsTable.id, Number(req.params.id)));
  return res.json({ success: true });
});

serviceListingsRouter.post("/:id/commission", requireAuth, validateParams(z.object({ id: z.coerce.number().int().positive() })), validateBody(commissionRequestSchema), async (req: any, res) => {
  const [listing] = await db.select().from(serviceListingsTable).where(and(eq(serviceListingsTable.id, Number(req.params.id)), eq(serviceListingsTable.isActive, true)));
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.creatorId === req.currentUser.id) return res.status(400).json({ error: "Cannot commission yourself" });
  const data = req.body as z.infer<typeof commissionRequestSchema>;
  const [commission] = await db.insert(commissionRequestsTable).values({
    fromUserId: req.currentUser.id,
    toCreatorId: listing.creatorId,
    serviceListingId: listing.id,
    title: data.title,
    description: data.description,
    budget: data.budget,
    currency: data.currency,
    deadline: data.deadline ? new Date(data.deadline) : undefined,
    status: "pending",
  }).returning();
  await db.update(serviceListingsTable).set({ inquiryCount: (listing.inquiryCount ?? 0) + 1 }).where(eq(serviceListingsTable.id, listing.id));
  await db.insert(notificationsTable).values({
    userId: listing.creatorId,
    actorId: req.currentUser.id,
    type: "commission_request",
    message: `You have a new commission request: "${data.title.slice(0, 60)}"`,
    category: "opportunity",
  }).onConflictDoNothing();
  return res.status(201).json(commission);
});

serviceListingsRouter.get("/commissions/received", requireAuth, async (req: any, res) => {
  const fromUser = db.$with("fromUser").as(
    db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
  );
  const commissions = await db.select({
    id: commissionRequestsTable.id,
    fromUserId: commissionRequestsTable.fromUserId,
    toCreatorId: commissionRequestsTable.toCreatorId,
    serviceListingId: commissionRequestsTable.serviceListingId,
    title: commissionRequestsTable.title,
    description: commissionRequestsTable.description,
    budget: commissionRequestsTable.budget,
    currency: commissionRequestsTable.currency,
    deadline: commissionRequestsTable.deadline,
    status: commissionRequestsTable.status,
    creatorResponse: commissionRequestsTable.creatorResponse,
    respondedAt: commissionRequestsTable.respondedAt,
    createdAt: commissionRequestsTable.createdAt,
    updatedAt: commissionRequestsTable.updatedAt,
    fromUser: {
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    },
  })
    .from(commissionRequestsTable)
    .leftJoin(usersTable, eq(usersTable.id, commissionRequestsTable.fromUserId))
    .where(eq(commissionRequestsTable.toCreatorId, req.currentUser.id))
    .orderBy(desc(commissionRequestsTable.createdAt));
  return res.json(commissions);
});

serviceListingsRouter.get("/commissions/sent", requireAuth, async (req: any, res) => {
  const commissions = await db.select({
    id: commissionRequestsTable.id,
    fromUserId: commissionRequestsTable.fromUserId,
    toCreatorId: commissionRequestsTable.toCreatorId,
    serviceListingId: commissionRequestsTable.serviceListingId,
    title: commissionRequestsTable.title,
    description: commissionRequestsTable.description,
    budget: commissionRequestsTable.budget,
    currency: commissionRequestsTable.currency,
    deadline: commissionRequestsTable.deadline,
    status: commissionRequestsTable.status,
    creatorResponse: commissionRequestsTable.creatorResponse,
    respondedAt: commissionRequestsTable.respondedAt,
    createdAt: commissionRequestsTable.createdAt,
    updatedAt: commissionRequestsTable.updatedAt,
    toUser: {
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    },
  })
    .from(commissionRequestsTable)
    .leftJoin(usersTable, eq(usersTable.id, commissionRequestsTable.toCreatorId))
    .where(eq(commissionRequestsTable.fromUserId, req.currentUser.id))
    .orderBy(desc(commissionRequestsTable.createdAt));
  return res.json(commissions);
});

serviceListingsRouter.patch("/commissions/:id/respond", requireAuth, validateParams(z.object({ id: z.coerce.number().int().positive() })), validateBody(z.object({
  status: z.enum(["accepted", "declined", "counter_offered"]),
  response: z.string().max(1000).optional(),
})), async (req: any, res) => {
  const [commission] = await db.select().from(commissionRequestsTable).where(eq(commissionRequestsTable.id, Number(req.params.id)));
  if (!commission) return res.status(404).json({ error: "Not found" });
  if (commission.toCreatorId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
  const { status, response } = req.body as { status: string; response?: string };
  const [updated] = await db.update(commissionRequestsTable).set({
    status,
    creatorResponse: response ?? null,
    respondedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(commissionRequestsTable.id, commission.id)).returning();
  await db.insert(notificationsTable).values({
    userId: commission.fromUserId,
    actorId: req.currentUser.id,
    type: "commission_response",
    message: `Your commission request "${commission.title.slice(0, 50)}" was ${status}.`,
    category: "opportunity",
  }).onConflictDoNothing();
  return res.json(updated);
});

endorsementsRouter.post("/users/:username/endorse", requireAuth, validateParams(z.object({ username: z.string() })), validateBody(endorseSchema), async (req: any, res) => {
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, req.params.username));
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === req.currentUser.id) return res.status(400).json({ error: "Cannot endorse yourself" });
  const { skill } = req.body as { skill: string };
  await db.insert(skillEndorsementsTable).values({
    fromUserId: req.currentUser.id,
    toUserId: target.id,
    skill: skill.trim().toLowerCase().slice(0, 60),
  }).onConflictDoNothing();

  // Dedup: one endorsement notification per endorser × skill per calendar day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { gte: _gte } = await import("drizzle-orm");
  const [existing] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.userId, target.id),
      eq(notificationsTable.actorId, req.currentUser.id),
      eq(notificationsTable.type, "skill_endorsement"),
      _gte(notificationsTable.createdAt, today),
    ))
    .limit(1);

  if (!existing) {
    await db.insert(notificationsTable).values({
      userId: target.id,
      actorId: req.currentUser.id,
      type: "skill_endorsement",
      message: `Someone endorsed your skill: "${skill}"`,
      category: "growth",
    }).onConflictDoNothing();
  }
  return res.status(201).json({ success: true });
});

endorsementsRouter.delete("/users/:username/endorse", requireAuth, validateParams(z.object({ username: z.string() })), validateBody(endorseSchema), async (req: any, res) => {
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, req.params.username));
  if (!target) return res.status(404).json({ error: "User not found" });
  const { skill } = req.body as { skill: string };
  await db.delete(skillEndorsementsTable).where(and(
    eq(skillEndorsementsTable.fromUserId, req.currentUser.id),
    eq(skillEndorsementsTable.toUserId, target.id),
    eq(skillEndorsementsTable.skill, skill.trim().toLowerCase()),
  ));
  return res.json({ success: true });
});

endorsementsRouter.get("/users/:username/endorsements", validateParams(z.object({ username: z.string() })), async (req: any, res) => {
  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, req.params.username));
  if (!target) return res.status(404).json({ error: "User not found" });
  const { sql: _sql } = await import("drizzle-orm");
  const rows = await db.select({
    skill: skillEndorsementsTable.skill,
    count: _sql<number>`count(*)::int`,
  }).from(skillEndorsementsTable)
    .where(eq(skillEndorsementsTable.toUserId, target.id as number))
    .groupBy(skillEndorsementsTable.skill)
    .orderBy(_sql`count(*) DESC`);

  return res.json(rows.map(r => ({ skill: r.skill, count: Number(r.count) })));
});

endorsementsRouter.get("/users/:username/availability", validateParams(z.object({ username: z.string() })), async (req: any, res) => {
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, req.params.username));
  if (!user) return res.status(404).json({ error: "User not found" });
  const [avail] = await db.select().from(creatorAvailabilityTable).where(eq(creatorAvailabilityTable.userId, user.id));
  return res.json(avail ?? { status: "unknown" });
});

endorsementsRouter.put("/users/me/availability", requireAuth, validateBody(availabilitySchema), async (req: any, res) => {
  const data = req.body as z.infer<typeof availabilitySchema>;
  const [existing] = await db.select({ id: creatorAvailabilityTable.id }).from(creatorAvailabilityTable).where(eq(creatorAvailabilityTable.userId, req.currentUser.id));
  if (existing) {
    const [updated] = await db.update(creatorAvailabilityTable).set({
      ...data,
      availableFor: JSON.stringify(data.availableFor),
      updatedAt: new Date(),
    }).where(eq(creatorAvailabilityTable.userId, req.currentUser.id)).returning();
    return res.json(updated);
  }
  const [created] = await db.insert(creatorAvailabilityTable).values({
    userId: req.currentUser.id,
    ...data,
    availableFor: JSON.stringify(data.availableFor),
  }).returning();
  return res.json(created);
});
