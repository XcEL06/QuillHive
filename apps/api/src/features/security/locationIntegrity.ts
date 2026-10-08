import { createHash } from "crypto";
import type { Request } from "express";
import { db } from "@workspace/db";
import { loginEventsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

function readClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (forwardedValue?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown").slice(0, 128);
}

export function hashIP(req: Request): string {
  return createHash("sha256").update(readClientIP(req)).digest("hex");
}

function getHeader(req: Request, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0]?.slice(0, 128) ?? null;
  return typeof value === "string" && value.trim() ? value.slice(0, 128) : null;
}

export function getLoginMeta(req: Request) {
  return {
    ipHash: hashIP(req),
    userAgent: getHeader(req, "user-agent")?.slice(0, 500),
    country: getHeader(req, "x-replit-user-country") ?? getHeader(req, "cf-ipcountry"),
    timezone: getHeader(req, "x-timezone") ?? (typeof req.body?.timezone === "string" ? req.body.timezone.slice(0, 128) : null),
  };
}

export async function recordLoginIntegrity(userId: number, req: Request, options: { deferReviewBaseline?: boolean } = {}) {
  const meta = getLoginMeta(req);
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const ipChanged = Boolean(user?.lastKnownIPHash && user.lastKnownIPHash !== meta.ipHash);
    const countryChanged = Boolean(user?.lastKnownCountry && meta.country && user.lastKnownCountry !== meta.country);
    const timezoneChanged = Boolean(user?.lastKnownTimezone && meta.timezone && user.lastKnownTimezone !== meta.timezone);
    const riskScore = Math.min(100, (ipChanged ? 30 : 0) + (countryChanged ? 45 : 0) + (timezoneChanged ? 15 : 0));
    const integrityStatus = riskScore >= 70 ? "review" : riskScore >= 35 ? "changed" : "normal";

    await db.insert(loginEventsTable).values({
      userId,
      ipHash: meta.ipHash,
      userAgent: meta.userAgent ?? null,
      country: meta.country,
      timezone: meta.timezone,
      integrityStatus,
      riskScore,
    });

    if (!(options.deferReviewBaseline && integrityStatus === "review")) {
      await db.update(usersTable).set({
        lastKnownIPHash: meta.ipHash,
        lastKnownCountry: meta.country ?? user?.lastKnownCountry ?? null,
        lastKnownTimezone: meta.timezone ?? user?.lastKnownTimezone ?? null,
        locationIntegrityStatus: integrityStatus,
        locationRiskScore: riskScore,
        updatedAt: new Date(),
      }).where(eq(usersTable.id, userId));
    }

    return { ...meta, integrityStatus, riskScore };
  } catch {
    return { ...meta, integrityStatus: "unknown", riskScore: 0 };
  }
}

export async function acceptLoginIntegrity(userId: number, meta: {
  ipHash: string;
  country: string | null;
  timezone: string | null;
}) {
  await db.update(usersTable).set({
    lastKnownIPHash: meta.ipHash,
    lastKnownCountry: meta.country,
    lastKnownTimezone: meta.timezone,
    locationIntegrityStatus: "normal",
    locationRiskScore: 0,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, userId));
}
