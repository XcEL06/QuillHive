/**
 * QuillHive platform seed script.
 * Safe to run on every startup - all operations are idempotent (ON CONFLICT DO NOTHING).
 * Populates: official QuillHive account, super admin, default topics, achievement definitions.
 */
import { db } from "@workspace/db";
import {
  usersTable,
  sessionsTable,
  topicsTable,
  achievementsTable,
} from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import { logger } from "../lib/logger";
import { ACHIEVEMENT_DEFS } from "../features/achievements/achievement.service";
import { assertOfficialSystemAccount, OFFICIAL_SYSTEM_ACCOUNT } from "../lib/officialSystemAccount";

// ── Default topics ──────────────────────────────────────────────────────────
const DEFAULT_TOPICS = [
  { name: "Fiction", slug: "fiction", description: "Short stories, novels, flash fiction, and creative narrative.", color: "#8B5CF6", icon: "BookOpen" },
  { name: "Non-Fiction", slug: "non-fiction", description: "Essays, memoirs, investigative reporting, and long-form journalism.", color: "#3B82F6", icon: "FileText" },
  { name: "Poetry", slug: "poetry", description: "Verse, spoken word, lyric poetry, and experimental forms.", color: "#EC4899", icon: "Feather" },
  { name: "Technology", slug: "technology", description: "Software, AI, hardware, and the digital world.", color: "#10B981", icon: "Cpu" },
  { name: "Science", slug: "science", description: "Research, discoveries, and science communication.", color: "#06B6D4", icon: "Flask" },
  { name: "Philosophy", slug: "philosophy", description: "Ethics, metaphysics, epistemology, and applied philosophy.", color: "#6366F1", icon: "Brain" },
  { name: "Culture", slug: "culture", description: "Art, film, music, fashion, and cultural criticism.", color: "#F59E0B", icon: "Palette" },
  { name: "Politics", slug: "politics", description: "Policy, governance, political theory, and civic life.", color: "#EF4444", icon: "Landmark" },
  { name: "Business", slug: "business", description: "Entrepreneurship, startups, strategy, and economics.", color: "#84CC16", icon: "Briefcase" },
  { name: "Health & Wellness", slug: "health", description: "Mental health, fitness, nutrition, and medicine.", color: "#14B8A6", icon: "Heart" },
  { name: "Environment", slug: "environment", description: "Climate, sustainability, conservation, and ecology.", color: "#22C55E", icon: "Leaf" },
  { name: "History", slug: "history", description: "World history, biography, and historical analysis.", color: "#D97706", icon: "Clock" },
  { name: "Travel", slug: "travel", description: "Adventures, guides, cultural immersion, and exploration.", color: "#F97316", icon: "Map" },
  { name: "Food & Drink", slug: "food", description: "Recipes, restaurant reviews, food culture, and culinary travel.", color: "#EF4444", icon: "UtensilsCrossed" },
  { name: "Personal Growth", slug: "personal-growth", description: "Productivity, habits, self-improvement, and learning.", color: "#A855F7", icon: "TrendingUp" },
  { name: "Writing Craft", slug: "writing-craft", description: "Techniques, craft essays, editing advice, and the writing life.", color: "#64748B", icon: "PenTool" },
  { name: "Humor", slug: "humor", description: "Satire, comedy, wit, and lighthearted essays.", color: "#FACC15", icon: "Smile" },
  { name: "Relationships", slug: "relationships", description: "Love, family, friendship, and human connection.", color: "#FB7185", icon: "Users" },
  { name: "Education", slug: "education", description: "Teaching, learning, curriculum, and EdTech.", color: "#0EA5E9", icon: "GraduationCap" },
  { name: "Finance", slug: "finance", description: "Personal finance, investing, crypto, and financial independence.", color: "#16A34A", icon: "DollarSign" },
] as const;

// ── Official QuillHive account ───────────────────────────────────────────────
const QUILLHIVE_ACCOUNT = {
  ...OFFICIAL_SYSTEM_ACCOUNT,
  displayName: "QuillHive",
  bio: "The official QuillHive account. Tips, updates, and featured stories.",
  isOfficialAccount: true,
  reachMultiplier: 10,
  role: "super_admin" as const,
  emailVerified: true,
  passwordHash: "",
};

// ── Seed functions ───────────────────────────────────────────────────────────

export async function seedOfficialAccount(database: typeof db = db): Promise<void> {
  assertOfficialSystemAccount(QUILLHIVE_ACCOUNT);
  const [existing] = await database
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, isOfficialAccount: usersTable.isOfficialAccount })
    .from(usersTable)
    .where(eq(usersTable.email, OFFICIAL_SYSTEM_ACCOUNT.email))
    .limit(1);

  if (existing) {
    assertOfficialSystemAccount(existing);
    await database
      .update(usersTable)
      .set({ reachMultiplier: 10, passwordHash: "" })
      .where(and(
        eq(usersTable.id, existing.id),
        eq(usersTable.username, OFFICIAL_SYSTEM_ACCOUNT.username),
        eq(usersTable.email, OFFICIAL_SYSTEM_ACCOUNT.email),
        eq(usersTable.isOfficialAccount, true),
      ));
    logger.info("[Seed] @quillhive account already exists - flags verified");
    return;
  }

  const [usernameCollision] = await database
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, isOfficialAccount: usersTable.isOfficialAccount })
    .from(usersTable)
    .where(eq(usersTable.username, OFFICIAL_SYSTEM_ACCOUNT.username))
    .limit(1);
  if (usernameCollision) {
    assertOfficialSystemAccount(usernameCollision);
    throw new Error("Official system account email lookup returned no matching account.");
  }

  assertOfficialSystemAccount(QUILLHIVE_ACCOUNT);
  const [created] = await database
    .insert(usersTable)
    .values(QUILLHIVE_ACCOUNT)
    .onConflictDoNothing()
    .returning({ id: usersTable.id });
  if (!created) throw new Error("Could not create the official system account because its identity conflicts with an existing account.");
  logger.info("[Seed] Created @quillhive official account");
}

async function seedCareereviveAdmin(): Promise<void> {
  try {
    const password = process.env.CAREEREVIVE_ADMIN_PASSWORD;
    const [existing] = await db
      .select({ id: usersTable.id, role: usersTable.role, passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.email, "careerevive@gmail.com"));

    if (!password || password.length < 16) {
      logger.warn("[Seed] CAREEREVIVE_ADMIN_PASSWORD is missing or shorter than 16 characters; admin seed skipped");
      return;
    }
    const admin = {
      username: "careerevive",
      email: "careerevive@gmail.com",
      displayName: "CareerEvive Admin",
      bio: "Platform super-administrator.",
      role: "super_admin" as const,
      emailVerified: true,
      passwordHash: hashPassword(password),
    };
    if (existing) {
      const passwordChanged = !verifyPassword(password, existing.passwordHash);
      const roleChanged = existing.role !== "super_admin";
      if (passwordChanged || roleChanged) {
        const updates = {
          ...(passwordChanged ? {
            passwordHash: admin.passwordHash,
            authVersion: sql`${usersTable.authVersion} + 1`,
          } : {}),
          ...(roleChanged ? { role: "super_admin" as const } : {}),
        };
        await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, existing.id));
        if (passwordChanged) await db.delete(sessionsTable).where(eq(sessionsTable.userId, existing.id));
        logger.info("[Seed] Configured careerevive account promoted to super_admin");
      } else {
        logger.info("[Seed] Configured careerevive account already super_admin - skipping");
      }
      return;
    }

    await db.insert(usersTable).values(admin).onConflictDoNothing();
    logger.info("[Seed] Created configured careerevive super_admin account");
  } catch (err) {
    logger.warn({ err }, "[Seed] Failed to seed careerevive admin");
  }
}

async function seedTopics(): Promise<void> {
  try {
    const [first] = await db.select({ id: topicsTable.id }).from(topicsTable).limit(1);
    if (first) {
      logger.info("[Seed] Topics already seeded - skipping");
      return;
    }
    for (const topic of DEFAULT_TOPICS) {
      await db.insert(topicsTable).values(topic).onConflictDoNothing();
    }
    logger.info(`[Seed] Seeded ${DEFAULT_TOPICS.length} topics`);
  } catch (err) {
    logger.warn({ err }, "[Seed] Failed to seed topics");
  }
}

async function seedAchievements(): Promise<void> {
  try {
    for (const def of ACHIEVEMENT_DEFS) {
      await db
        .insert(achievementsTable)
        .values(def)
        .onConflictDoNothing();
    }
    logger.info(`[Seed] Seeded ${ACHIEVEMENT_DEFS.length} achievement definitions`);
  } catch (err) {
    logger.warn({ err }, "[Seed] Failed to seed achievements");
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function runSeed(): Promise<void> {
  logger.info("[Seed] Starting platform seed…");
  await Promise.all([
    seedOfficialAccount(),
    seedCareereviveAdmin(),
    seedTopics(),
    seedAchievements(),
  ]);
  logger.info("[Seed] Platform seed complete");
}
