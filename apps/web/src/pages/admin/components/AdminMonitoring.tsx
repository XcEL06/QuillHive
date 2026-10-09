import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Badge } from "@/components/ui/badge";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

const EVENT_LABELS: Record<string, string> = {
  SYSTEM_ERROR: "Application error",
  DB_FAILURE: "Database issue",
  UPLOAD_FAILURE: "Upload failure",
  PUSH_FAILURE: "Notification delivery issue",
  SECURITY_ALERT: "Security alert",
  USER_EVENT: "User activity",
  ENGAGEMENT_METRIC: "Engagement update",
};

const METADATA_LABELS: Record<string, string> = {
  country: "Country",
  count: "Count",
  duration: "Duration",
  errorMessage: "Error detail",
  errorName: "Error type",
  groupId: "Group",
  ipMasked: "Masked IP",
  limit: "Limit",
  method: "Method",
  postId: "Post",
  reason: "Reason",
  route: "Route",
  service: "Service",
  source: "Source",
  statusCode: "Status code",
  threshold: "Threshold",
  type: "Activity",
  userId: "User ID",
  username: "Username",
};

function formatUptime(milliseconds: number) {
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function severityVariant(severity: string) {
  if (severity === "critical" || severity === "high") return "destructive" as const;
  if (severity === "medium") return "secondary" as const;
  return "outline" as const;
}

export default function AdminMonitoring({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [health, setHealth] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => { void Promise.all([fetchAdmin("/api/admin/monitoring/health"), fetchAdmin("/api/admin/monitoring/events")]).then(([h, e]) => { setHealth(h); setEvents(Array.isArray(e?.events) ? e.events : Array.isArray(e) ? e : []); }).catch((err) => toast({ title: "Could not load monitoring", description: err.message, variant: "destructive" })); }, [fetchAdmin, toast]);
  const metrics = health?.metrics ?? {};
  const totals = health?.totals ?? {};
  const statusLabel = health?.status === "healthy" ? "Healthy" : health?.status === "degraded" ? "Needs attention" : health?.status === "warning" ? "Warning" : "Loading";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">System health</h2>
            <p className="mt-1 text-xs text-muted-foreground">Service availability and recent request activity.</p>
          </div>
          <Badge variant={health?.status === "healthy" ? "outline" : "destructive"} className="capitalize">{statusLabel}</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Running for", health ? formatUptime(health.uptimeMs ?? 0) : "--"],
            ["Requests, last 5 minutes", metrics.requests5m ?? 0],
            ["Errors, last 5 minutes", metrics.errors5m ?? 0],
            ["Recent error rate", `${Number(metrics.errorRatePct ?? 0).toFixed(1)}%`],
            ["Total application errors", totals.errors ?? 0],
            ["Upload failures", totals.uploadFailures ?? 0],
            ["Notification failures", totals.pushFailures ?? 0],
            ["Signups, last 5 minutes", metrics.signups5m ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-sm font-semibold">Recent system events</h2>
            <p className="mt-1 text-xs text-muted-foreground">Latest operational, security and user activity signals.</p>
          </div>
          <Badge variant="outline">{events.length} events</Badge>
        </div>
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No recent system events.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {events.map((event, index) => (
              <article key={`${event.timestamp}-${event.type}-${index}`} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severityVariant(event.severity)} className="capitalize">{event.severity || "Information"}</Badge>
                  <h3 className="text-sm font-medium">{EVENT_LABELS[event.type] || "System event"}</h3>
                  <Timestamp value={event.timestamp} mode="datetime" className="ml-auto text-xs text-muted-foreground" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{event.message || "No additional description."}</p>
                {event.metadata && Object.entries(event.metadata).length > 0 && (
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {Object.entries(event.metadata).map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <dt className="font-medium">{METADATA_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}:</dt>
                        <dd className="break-all">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}