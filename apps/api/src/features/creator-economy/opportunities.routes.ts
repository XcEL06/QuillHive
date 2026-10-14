import { Router } from "express";
import { z } from "zod";
import { optionalAuth } from "../../middleware/admin";
import { validateQuery } from "../../middleware/validate";
import { db } from "@workspace/db";
import {
  usersTable,
  creatorAvailabilityTable,
  skillEndorsementsTable,
  serviceListingsTable,
  userTopicAffinityTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql, desc, gt, or } from "drizzle-orm";

export const opportunitiesRouter = Router();

const listQuerySchema = z.object({
  skill: z.string().max(60).optional(),
  availableFor: z.string().max(80).optional(),
  maxRate: z.coerce.number().positive().max(10000).optional(),
  minEndorsements: z.coerce.number().int().min(0).max(500).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/opportunities
 * Public endpoint (auth optional - adds affinity score when viewer is logged in).
 * Returns creators who are available for hire, sorted by:
 *   1. Affinity match (if viewer authenticated)
 *   2. Total endorsement count (desc)
 */
opportunitiesRouter.get(
  "/opportunities",
  optionalAuth,
  validateQuery(listQuerySchema),
  async (req, res) => {
    const { skill, availableFor, maxRate, minEndorsements, limit, offset } =
      req.query as unknown as z.infer<typeof listQuerySchema>;

    const viewerId: number | null = (req as any).userId ?? null;

    // ── 1. Fetch available creators with their availability row ──────────────
    const availRows = await db
      .select({
        userId: creatorAvailabilityTable.userId,
        status: creatorAvailabilityTable.status,
        availableFor: creatorAvailabilityTable.availableFor,
        hoursPerWeek: creatorAvailabilityTable.hoursPerWeek,
        ratePerHour: creatorAvailabilityTable.ratePerHour,
        currency: creatorAvailabilityTable.currency,
        timezone: creatorAvailabilityTable.timezone,
        publicNote: creatorAvailabilityTable.publicNote,
        updatedAt: creatorAvailabilityTable.updatedAt,
      })
      .from(creatorAvailabilityTable)
      .where(
        and(
          or(
            eq(creatorAvailabilityTable.status, "available"),
            eq(creatorAvailabilityTable.status, "open_to_opportunities"),
          ),
          maxRate != null
            ? sql`${creatorAvailabilityTable.ratePerHour} <= ${maxRate}`
            : sql`1=1`,
          availableFor
            ? sql`${creatorAvailabilityTable.availableFor} like ${"%" + availableFor + "%"}`
            : sql`1=1`,
        ),
      );

    if (!availRows.length) {
      return res.json({ creators: [], total: availRows.length });
    }

    const userIds = availRows.map((r) => r.userId);
    const availMap = new Map(availRows.map((r) => [r.userId, r]));

    // ── 2. Fetch user profiles ────────────────────────────────────────────────
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        bio: usersTable.bio,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));

    // ── 3. Endorsement counts per creator×skill ───────────────────────────────
    const endorsements = await db
      .select({
        toUserId: skillEndorsementsTable.toUserId,
        skill: skillEndorsementsTable.skill,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(skillEndorsementsTable)
      .where(inArray(skillEndorsementsTable.toUserId, userIds))
      .groupBy(skillEndorsementsTable.toUserId, skillEndorsementsTable.skill);

    // Build: userId → { skill → count }
    const endorseMap = new Map<number, Map<string, number>>();
    for (const row of endorsements) {
      if (!endorseMap.has(row.toUserId)) endorseMap.set(row.toUserId, new Map());
      endorseMap.get(row.toUserId)!.set(row.skill, row.count);
    }

    // ── 4. Active service listings (first one per creator for card preview) ──
    const listings = await db
      .select({
        creatorId: serviceListingsTable.creatorId,
        id: serviceListingsTable.id,
        title: serviceListingsTable.title,
        category: serviceListingsTable.category,
        pricingModel: serviceListingsTable.pricingModel,
        priceFrom: serviceListingsTable.priceFrom,
        priceTo: serviceListingsTable.priceTo,
        currency: serviceListingsTable.currency,
        skills: serviceListingsTable.skills,
      })
      .from(serviceListingsTable)
      .where(
        and(
          inArray(serviceListingsTable.creatorId, userIds),
          eq(serviceListingsTable.isActive, true),
        ),
      )
      .orderBy(desc(serviceListingsTable.createdAt));

    // Build: creatorId → listing[]
    const listingMap = new Map<number, typeof listings>();
    for (const l of listings) {
      if (!listingMap.has(l.creatorId)) listingMap.set(l.creatorId, []);
      listingMap.get(l.creatorId)!.push(l);
    }

    // ── 5. Viewer affinity scores (optional) ─────────────────────────────────
    const affinityMap = new Map<number, number>();
    if (viewerId) {
      // Get top topic-ids this viewer cares about
      const viewerAffinity = await db
        .select({ topicId: userTopicAffinityTable.topicId, score: userTopicAffinityTable.affinityScore })
        .from(userTopicAffinityTable)
        .where(
          and(
            eq(userTopicAffinityTable.userId, viewerId),
            gt(userTopicAffinityTable.affinityScore, 0.2),
          ),
        )
        .limit(20);

      if (viewerAffinity.length) {
        const topicIds = viewerAffinity.map((a) => a.topicId);
        const topicScoreMap = new Map(viewerAffinity.map((a) => [a.topicId, a.score]));

        // Find creators who also have affinity with those topics
        const creatorAffinity = await db
          .select({
            userId: userTopicAffinityTable.userId,
            topicId: userTopicAffinityTable.topicId,
            score: userTopicAffinityTable.affinityScore,
          })
          .from(userTopicAffinityTable)
          .where(
            and(
              inArray(userTopicAffinityTable.userId, userIds),
              inArray(userTopicAffinityTable.topicId, topicIds),
            ),
          );

        for (const row of creatorAffinity) {
          const viewerScore = topicScoreMap.get(row.topicId) ?? 0;
          const overlap = Math.min(row.score, viewerScore);
          affinityMap.set(row.userId, (affinityMap.get(row.userId) ?? 0) + overlap);
        }
      }
    }

    // ── 6. Assemble + filter + sort ───────────────────────────────────────────
    const results = users
      .map((u) => {
        const avail = availMap.get(u.id)!;
        const skillMap = endorseMap.get(u.id) ?? new Map<string, number>();
        const totalEndorsements = [...skillMap.values()].reduce((a, b) => a + b, 0);

        // Sort skills by endorsement count
        const skills = [...skillMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([sk, count]) => ({ skill: sk, endorsements: count }));

        // Filter by skill if requested
        if (skill && !skills.some((s) => s.skill.toLowerCase().includes(skill.toLowerCase()))) {
          return null;
        }

        // Filter by minimum endorsements
        if (totalEndorsements < minEndorsements) return null;

        const creatorListings = listingMap.get(u.id) ?? [];
        const affinityScore = affinityMap.get(u.id) ?? 0;

        return {
          user: u,
          availability: {
            status: avail.status,
            availableFor: JSON.parse(avail.availableFor ?? "[]") as string[],
            hoursPerWeek: avail.hoursPerWeek,
            ratePerHour: avail.ratePerHour,
            currency: avail.currency ?? "USD",
            timezone: avail.timezone,
            publicNote: avail.publicNote,
            updatedAt: avail.updatedAt,
          },
          skills,
          totalEndorsements,
          listings: creatorListings.slice(0, 3),
          affinityScore: Math.round(affinityScore * 100) / 100,
        };
      })
      .filter(Boolean) as NonNullable<ReturnType<typeof results.find>>[];

    // Sort: affinity desc → endorsements desc
    results.sort((a, b) => {
      const affinityDiff = b.affinityScore - a.affinityScore;
      if (Math.abs(affinityDiff) > 0.01) return affinityDiff;
      return b.totalEndorsements - a.totalEndorsements;
    });

    const total = results.length;
    const page = results.slice(offset, offset + limit);

    return res.json({ creators: page, total });
  },
);
