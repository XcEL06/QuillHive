import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

export type AccountBanStatus =
  | { kind: "none" }
  | { kind: "expired" }
  | { kind: "permanent"; reason: string | null }
  | { kind: "temporary"; until: Date; reason: string | null };

export function getAccountBanStatus(
  isBanned: boolean,
  bannedUntil: Date | null,
  reason: string | null = null,
  now = new Date(),
): AccountBanStatus {
  if (!isBanned) return { kind: "none" };
  if (!bannedUntil) return { kind: "permanent", reason };
  if (bannedUntil.getTime() <= now.getTime()) return { kind: "expired" };
  return { kind: "temporary", until: bannedUntil, reason };
}

export function temporaryRestrictionResponse(until: Date, reason: string | null) {
  return {
    error: "Account temporarily restricted",
    code: "TEMPORARY_RESTRICTION",
    until: until.toISOString(),
    reason,
  };
}

export async function getUserAccountBanStatus(userId: number): Promise<AccountBanStatus | null> {
  const [user] = await db.select({
    isBanned: usersTable.isBanned,
    bannedUntil: usersTable.bannedUntil,
    banReason: usersTable.banReason,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;

  const status = getAccountBanStatus(user.isBanned, user.bannedUntil, user.banReason);
  if (status.kind === "expired") {
    await db.update(usersTable).set({
      isBanned: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));
    return { kind: "none" };
  }
  return status;
}
