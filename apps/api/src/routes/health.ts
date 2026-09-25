import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { getRedis } from "../lib/redis";
import { getAnthropicConfig } from "./ai";

const router: IRouter = Router();

router.get(["/healthz", "/api/healthz"], async (_req, res) => {
  const checks: Record<string, "ok" | "fail"> = {};

  // Database
  try {
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  // Redis (non-critical - degrade gracefully)
  try {
    const redis = getRedis();
    if (redis) {
      await redis.set("healthz:ping", "1", { ex: 10 });
      checks.redis = "ok";
    } else {
      checks.redis = "ok"; // not configured is not a failure
    }
  } catch {
    checks.redis = "fail";
  }

  const allOk = checks.database === "ok";
  return res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    checks,
    version: process.env.npm_package_version ?? "unknown",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get("/health/db", async (_req, res) => {
  const start = Date.now();
  try {
    const { rows } = await pool.query<{
      version: string;
      current_database: string;
      uptime_seconds: string;
      table_count: string;
    }>(`
      SELECT
        version()                                                    AS version,
        current_database()                                           AS current_database,
        EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time()))::bigint AS uptime_seconds,
        (SELECT COUNT(*)::text
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE')                          AS table_count
    `);

    const latencyMs = Date.now() - start;
    const row = rows[0];

    res.json({
      status: "ok",
      latency_ms: latencyMs,
      database: row.current_database,
      pg_version: row.version.split(" ").slice(0, 2).join(" "),
      uptime_seconds: Number(row.uptime_seconds),
      schema_tables: Number(row.table_count),
      migrations_applied: Number(row.table_count) > 0,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    res.status(503).json({
      status: "error",
      latency_ms: latencyMs,
      error: err instanceof Error ? err.message : "Database unreachable",
      checked_at: new Date().toISOString(),
    });
  }
});

router.get("/health/cache", async (_req, res) => {
  const start = Date.now();
  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({
      status: "unconfigured",
      message: "Redis (Upstash) credentials not set - set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
      checked_at: new Date().toISOString(),
    });
  }

  try {
    const probe = `health:probe:${Date.now()}`;
    await redis.setex(probe, 10, "ok");
    const val = await redis.get(probe);
    await redis.del(probe);
    const latencyMs = Date.now() - start;

    if (val !== "ok") {
      return res.status(503).json({ status: "error", latency_ms: latencyMs, error: "Read-back mismatch", checked_at: new Date().toISOString() });
    }

    return res.json({ status: "ok", provider: "upstash", latency_ms: latencyMs, checked_at: new Date().toISOString() });
  } catch (err) {
    return res.status(503).json({
      status: "error",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Redis unreachable",
      checked_at: new Date().toISOString(),
    });
  }
});

router.get("/health/email", async (_req, res) => {
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasSMTP = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const configured = hasResend || hasSMTP;
  const provider = hasResend ? "resend" : hasSMTP ? "smtp" : "none";
  return res.json({
    status: configured ? "ok" : "unconfigured",
    provider,
    from: process.env.MAIL_FROM || `noreply@${process.env.MAIL_DOMAIN || "quillhive.app"}`,
    checked_at: new Date().toISOString(),
  });
});

router.get("/health/ai", async (_req, res) => {
  const directKeyConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const integrationConfigured = Boolean(
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  );
  const configured = Boolean(getAnthropicConfig());
  return res.status(configured ? 200 : 503).json({
    status: configured ? "ok" : "unconfigured",
    provider: directKeyConfigured ? "anthropic" : integrationConfigured ? "anthropic-integration" : "none",
    api_key_set: directKeyConfigured || integrationConfigured,
    base_url_set: directKeyConfigured || Boolean(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL),
    checked_at: new Date().toISOString(),
  });
});

router.get("/health/cdn", async (_req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const configured = !!(cloudName && apiKey);
  return res.json({
    status: configured ? "ok" : "unconfigured",
    provider: configured ? "cloudinary" : "local",
    cloud_name: cloudName || null,
    checked_at: new Date().toISOString(),
  });
});

router.get("/health/payments", async (_req, res) => {
  const configured = !!(process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY);
  return res.json({
    status: configured ? "ok" : "unconfigured",
    provider: "flutterwave",
    public_key_set: !!process.env.FLW_PUBLIC_KEY,
    secret_key_set: !!process.env.FLW_SECRET_KEY,
    encryption_key_set: !!process.env.FLW_ENCRYPTION_KEY,
    checked_at: new Date().toISOString(),
  });
});

export default router;
