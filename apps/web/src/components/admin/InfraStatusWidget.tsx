import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { getStoredToken } from "@/lib/api";

interface ServiceStatus {
  status: "ok" | "error" | "unconfigured" | "loading";
  label: string;
  detail?: string;
  latency_ms?: number;
}

const SERVICES = [
  { key: "email",  label: "Email (Resend)",    endpoint: "/api/health/email"  },
  { key: "cache",  label: "Redis (Upstash)",   endpoint: "/api/health/cache"  },
  { key: "cdn",    label: "CDN (Cloudinary)",  endpoint: "/api/health/cdn"    },
  { key: "payments", label: "Flutterwave Payments", endpoint: "/api/health/payments" },
  { key: "db",     label: "PostgreSQL",        endpoint: "/api/health/db"     },
] as const;

function StatusIcon({ status }: { status: ServiceStatus["status"] }) {
  if (status === "ok")           return <CheckCircle  className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (status === "error")        return <XCircle      className="w-4 h-4 text-red-400     flex-shrink-0" />;
  if (status === "unconfigured") return <AlertCircle  className="w-4 h-4 text-amber-400   flex-shrink-0" />;
  return <RefreshCw className="w-4 h-4 text-zinc-500 flex-shrink-0 animate-spin" />;
}

function statusColor(status: ServiceStatus["status"]) {
  if (status === "ok")           return "border-emerald-800/50 bg-emerald-950/20";
  if (status === "error")        return "border-red-800/50    bg-red-950/20";
  if (status === "unconfigured") return "border-amber-800/50  bg-amber-950/20";
  return "border-zinc-800 bg-zinc-900/40";
}

export function InfraStatusWidget() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>(
    () => Object.fromEntries(SERVICES.map(s => [s.key, { status: "loading", label: s.label }]))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkAll = async () => {
    const token = getStoredToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    setStatuses(Object.fromEntries(SERVICES.map(s => [s.key, { status: "loading", label: s.label }])));

    await Promise.allSettled(
      SERVICES.map(async (svc) => {
        try {
          const r = await fetch(svc.endpoint, { headers });
          const data = await r.json();
          const s: ServiceStatus["status"] = r.ok ? (data.status === "ok" ? "ok" : data.status) : "error";
          setStatuses(prev => ({
            ...prev,
            [svc.key]: {
              status: s,
              label: svc.label,
              detail: data.provider || data.error || data.message || undefined,
              latency_ms: data.latency_ms,
            },
          }));
        } catch {
          setStatuses(prev => ({ ...prev, [svc.key]: { status: "error", label: svc.label, detail: "Unreachable" } }));
        }
      })
    );
    setLastChecked(new Date());
  };

  useEffect(() => { checkAll(); }, []);

  const allOk = Object.values(statuses).every(s => s.status === "ok");
  const hasError = Object.values(statuses).some(s => s.status === "error");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${allOk ? "bg-emerald-400" : hasError ? "bg-red-400" : "bg-amber-400"} ${allOk ? "animate-pulse" : ""}`} />
          <h3 className="font-semibold text-sm text-zinc-100">Infrastructure Status</h3>
        </div>
        <button
          onClick={checkAll}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {SERVICES.map(svc => {
          const s = statuses[svc.key];
          if (!s) return null;
          return (
            <div key={svc.key} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${statusColor(s.status)}`}>
              <StatusIcon status={s.status} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-zinc-200">{svc.label}</span>
                {s.detail && <span className="ml-2 text-[11px] text-zinc-500 truncate">{s.detail}</span>}
              </div>
              {s.latency_ms !== undefined && (
                <span className="text-[11px] text-zinc-600 flex-shrink-0">{s.latency_ms}ms</span>
              )}
              <span className={`text-[10px] font-semibold flex-shrink-0 ${
                s.status === "ok" ? "text-emerald-400" : s.status === "error" ? "text-red-400" : s.status === "unconfigured" ? "text-amber-400" : "text-zinc-500"
              }`}>
                {s.status === "unconfigured" ? "MISSING" : s.status.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      {lastChecked && (
        <p className="text-[11px] text-zinc-600 mt-3 text-right">
          Checked <Timestamp value={lastChecked} mode="datetime" />
        </p>
      )}
    </div>
  );
}
