import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { postsTable } from "@workspace/db/schema";

export const SPARK_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function activeSparkCondition(now = new Date()) {
  const legacyCutoff = new Date(now.getTime() - SPARK_LIFETIME_MS);
  return or(
    gt(postsTable.expiresAt, now),
    and(isNull(postsTable.expiresAt), gt(postsTable.createdAt, legacyCutoff)),
  )!;
}

export function visiblePostExpiryCondition(now = new Date()) {
  return or(
    and(eq(postsTable.type, "spark"), activeSparkCondition(now)),
    and(ne(postsTable.type, "spark"), or(isNull(postsTable.expiresAt), gt(postsTable.expiresAt, now))),
  )!;
}

export function activeHighlightExpiryCondition(now = new Date()) {
  return or(
    and(eq(postsTable.type, "spark"), activeSparkCondition(now)),
    and(ne(postsTable.type, "spark"), gt(postsTable.expiresAt, now)),
  )!;
}