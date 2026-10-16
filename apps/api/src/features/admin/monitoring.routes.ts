import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../../middleware/admin";
import {
  getRecentEvents,
  getEventCounters,
  clearEventBuffer,
  type SystemEventType,
} from "../../lib/events";
import { detectAnomalies, alertCooldownStatus, sendDailyDigest } from "../../lib/alertEngine";
import { isEmailConfigured, ADMIN_EMAIL, sendAlertEmail } from "../../lib/emailAlerts";
import { getCacheMetrics } from "../../lib/cache";

export const monitoringRouter: IRouter = Router();
monitoringRouter.use(requireAdmin);

monitoringRouter.get("/events", (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query["limit"]) || 100, 500);
  const type = (req.query["type"] as SystemEventType | undefined) || undefined;
  res.json({ events: getRecentEvents(limit, type) });
});

monitoringRouter.get("/metrics", (_req: Request, res: Response) => {
  const counters = getEventCounters();
  const uptimeMs = Date.now() - (counters["startedAt"] ?? Date.now());
  const anomaly = detectAnomalies();
  res.json({
    counters,
    cache: getCacheMetrics(),
    uptimeMs,
    anomaly,
    rateLimit: alertCooldownStatus(),
    email: { configured: isEmailConfigured(), to: ADMIN_EMAIL },
  });
});

monitoringRouter.get("/health", (_req: Request, res: Response) => {
  const counters = getEventCounters();
  const anomaly = detectAnomalies();
  const status =
    anomaly.metrics.errorRatePct > 10 ? "degraded" : counters["errors"] > 100 ? "warning" : "healthy";
  res.json({
    status,
    uptimeMs: Date.now() - (counters["startedAt"] ?? Date.now()),
    metrics: anomaly.metrics,
    totals: { errors: counters["errors"], uploadFailures: counters["uploadFailures"], pushFailures: counters["pushFailures"] },
  });
});

monitoringRouter.post("/clear", (_req: Request, res: Response) => {
  clearEventBuffer();
  res.json({ ok: true });
});

monitoringRouter.post("/test-email", async (_req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    res.status(400).json({ ok: false, error: "SMTP_HOST / SMTP_USER / SMTP_PASS not configured" });
    return;
  }
  const ok = await sendAlertEmail(
    "✅ QuillHive Test Alert",
    `This is a test alert from your QuillHive Owner Intelligence system.\nIf you can read this, alerts are working.\n\nTime: ${new Date().toISOString()}\n\n- Owner Intelligence`,
  );
  res.json({ ok });
});

monitoringRouter.post("/digest/send", async (_req: Request, res: Response) => {
  await sendDailyDigest();
  res.json({ ok: true });
});
