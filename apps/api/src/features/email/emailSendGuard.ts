import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

export type GuardedEmailKind = "weeklyDigest" | "day3Nurture" | "day7Nurture";

const advisoryLockNamespaces: Record<GuardedEmailKind, number> = {
  weeklyDigest: 718301,
  day3Nurture: 718302,
  day7Nurture: 718303,
};

export function getWeeklyDigestIntervalMs(): number {
  const configuredDays = process.env.WEEKLY_DIGEST_INTERVAL_DAYS;
  if (configuredDays === undefined || configuredDays.trim() === "") return 7 * 24 * 60 * 60 * 1000;

  const days = Number(configuredDays);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("WEEKLY_DIGEST_INTERVAL_DAYS must be a number greater than or equal to 1.");
  }
  return days * 24 * 60 * 60 * 1000;
}

export async function sendEmailOncePerPeriod(
  userId: number,
  kind: GuardedEmailKind,
  cooldownMs: number | null,
  send: () => Promise<void>,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${advisoryLockNamespaces[kind]}, ${userId})`);

    const [user] = await tx
      .select({
        sentAt: kind === "weeklyDigest"
          ? usersTable.lastWeeklyDigestAt
          : kind === "day3Nurture"
            ? usersTable.day3NurtureSentAt
            : usersTable.day7NurtureSentAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return false;
    if (user.sentAt && (cooldownMs === null || Date.now() - user.sentAt.getTime() < cooldownMs)) {
      return false;
    }

    await send();
    const sentAt = new Date();
    if (kind === "weeklyDigest") {
      await tx.update(usersTable).set({ lastWeeklyDigestAt: sentAt }).where(eq(usersTable.id, userId));
    } else if (kind === "day3Nurture") {
      await tx.update(usersTable).set({ day3NurtureSentAt: sentAt }).where(eq(usersTable.id, userId));
    } else {
      await tx.update(usersTable).set({ day7NurtureSentAt: sentAt }).where(eq(usersTable.id, userId));
    }
    return true;
  });
}
