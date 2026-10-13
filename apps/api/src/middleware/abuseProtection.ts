import { createHash } from "crypto";
import type { RequestHandler } from "express";
import { getSessionUserId } from "../lib/auth";

type AbuseEntry = {
  count: number;
  resetAt: number;
  contentHistory: Array<{ hash: string; at: number }>;
};

export type SpamPolicy = {
  max?: number;
  bypassDuplicateCheck?: boolean;
};

type SpamOptions = {
  windowMs?: number;
  max?: number;
  duplicateWindowMs?: number;
  duplicateThreshold?: number;
  contentField?: string;
  ipMax?: number;
  resolvePolicy?: (req: Parameters<RequestHandler>[0]) => Promise<SpamPolicy>;
};

const entries = new Map<string, AbuseEntry>();

function getIp(req: Parameters<RequestHandler>[0]): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getActorKey(req: Parameters<RequestHandler>[0]): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const userId = getSessionUserId(auth.slice(7));
    if (userId) return `user:${userId}`;
  }
  return `ip:${getIp(req)}`;
}

function hashContent(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function preventSpam(scope: string, options: SpamOptions = {}): RequestHandler {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 8;
  const duplicateWindowMs = options.duplicateWindowMs ?? 120_000;
  const duplicateThreshold = options.duplicateThreshold ?? 2;
  const contentField = options.contentField ?? "content";
  return async (req, res, next) => {
    const now = Date.now();
    const actorKey = `${scope}:${getActorKey(req)}`;
    const ipKey = `${scope}:ip:${getIp(req)}`;
    let policy: SpamPolicy = {};
    try {
      policy = await options.resolvePolicy?.(req) ?? {};
    } catch {
      // A policy lookup failure falls back to the configured conservative limit.
    }

    const actorEntry = getEntry(actorKey, now, windowMs);
    const ipEntry = options.ipMax && ipKey !== actorKey ? getEntry(ipKey, now, windowMs) : null;
    const content = typeof req.body?.[contentField] === "string" ? req.body[contentField] : "";
    const contentHash = content ? hashContent(content) : undefined;

    const duplicateHits = contentHash
      ? actorEntry.contentHistory.filter((entry) => entry.hash === contentHash && now - entry.at < duplicateWindowMs).length
      : 0;
    const duplicateFound = contentHash && !policy.bypassDuplicateCheck && duplicateHits >= duplicateThreshold;
    if (duplicateFound) {
      const cooldownSeconds = Math.ceil(duplicateWindowMs / 1000);
      const error = scope === "posts"
        ? `You already posted this recently. You can repost after ${cooldownSeconds} seconds.`
        : `This request was already submitted recently. Please wait ${cooldownSeconds} seconds before retrying.`;
      res.status(429).json({ error });
      return;
    }

    if (actorEntry.count >= (policy.max ?? max) || (ipEntry && ipEntry.count >= options.ipMax!)) {
      res.status(429).json({ error: "You have reached the current posting limit. Please try again shortly." });
      return;
    }

    actorEntry.count += 1;
    if (ipEntry) ipEntry.count += 1;
    actorEntry.contentHistory = actorEntry.contentHistory.filter((entry) => now - entry.at < duplicateWindowMs)
      .concat(contentHash && !policy.bypassDuplicateCheck ? [{ hash: contentHash, at: now }] : []);
    next();
  };
}

function getEntry(key: string, now: number, windowMs: number): AbuseEntry {
  const existing = entries.get(key);
  if (existing && now <= existing.resetAt) return existing;

  const entry = { count: 0, resetAt: now + windowMs, contentHistory: [] };
  entries.set(key, entry);
  return entry;
}