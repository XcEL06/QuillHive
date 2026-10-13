import { createHash } from "crypto";
import type { RequestHandler } from "express";
import { getSessionUserId } from "../lib/auth";

type AbuseEntry = {
  count: number;
  resetAt: number;
  lastContentHash?: string;
  lastContentAt?: number;
  contentHistory: Array<{ hash: string; at: number }>;
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

export function preventSpam(scope: string, options: { windowMs?: number; max?: number; duplicateWindowMs?: number; contentField?: string } = {}): RequestHandler {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 8;
  const duplicateWindowMs = options.duplicateWindowMs ?? 120_000;
  const contentField = options.contentField ?? "content";
  return (req, res, next) => {
    const now = Date.now();
    const key = `${scope}:${getActorKey(req)}`;
    const current = entries.get(key);
    const content = typeof req.body?.[contentField] === "string" ? req.body[contentField] : "";
    const contentHash = content ? hashContent(content) : undefined;

    const duplicateHits = contentHash
      ? (current?.contentHistory ?? []).filter((entry) => entry.hash === contentHash && now - entry.at < duplicateWindowMs).length
      : 0;

    if (!current || now > current.resetAt) {
      entries.set(key, {
        count: 1,
        resetAt: now + windowMs,
        lastContentHash: contentHash,
        lastContentAt: contentHash ? now : undefined,
        contentHistory: contentHash ? [{ hash: contentHash, at: now }] : [],
      });
      next();
      return;
    }

    if (contentHash && duplicateHits >= 2) {
      res.status(429).json({ error: "Duplicate content detected. Please slow down before posting again." });
      return;
    }

    if (current.count >= max) {
      res.status(429).json({ error: "Too many actions. Please slow down and try again." });
      return;
    }

    current.count += 1;
    current.lastContentHash = contentHash;
    current.lastContentAt = contentHash ? now : current.lastContentAt;
    current.contentHistory = (current.contentHistory ?? []).filter((entry) => now - entry.at < duplicateWindowMs + windowMs)
      .concat(contentHash ? [{ hash: contentHash, at: now }] : []);
    next();
  };
}