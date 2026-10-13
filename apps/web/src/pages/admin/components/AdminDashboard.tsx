import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, FileText, Flag, RefreshCw, Rocket, ShieldCheck, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

type PulsePoint = { day: string; signups: number; posts: number; reports: number; boosts: number };
type Stats = {
  totalUsers?: number;
  totalPosts?: number;
  pendingReports?: number;
  bannedUsers?: number;
  pendingBoosts?: number;
  activeBoosts?: number;
  trustDistribution?: Array<{ level: string; count: number }>;
};

export default function AdminDashboard({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pulse, setPulse] = useState<PulsePoint[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.allSettled([
      fetchAdmin("/api/admin/stats"),
      fetchAdmin("/api/admin/pulse"),
      fetchAdmin("/api/admin/settings/features"),
    ]).then(([statsResult, pulseResult, featureResult]) => {
      if (!active) return;
      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if (pulseResult.status === "fulfilled") {
        const days = Array.isArray(pulseResult.value.days) ? pulseResult.value.days : [];
        setPulse(days.map((row: Record<string, unknown>) => ({
          day: String(row.day),
          signups: Number(row.signups) || 0,
          posts: Number(row.posts) || 0,
          reports: Number(row.reports) || 0,
          boosts: Number(row.boosts) || 0,
        })));
      }
      if (featureResult.status === "fulfilled") setFeatures(featureResult.value);
      const failed = [statsResult, pulseResult, featureResult].filter((result) => result.status === "rejected");
      if (failed.length) toast({ title: "Some dashboard data is unavailable", description: "Refresh the overview or open the relevant operations tab to retry.", variant: "destructive" });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAdmin, toast, refreshKey]);

  const enabledFlags = Object.values(features).filter(Boolean).length;
  const trustLevels = [
    ["New voice", "new_voice", "bg-slate-400"],
    ["Rising", "rising", "bg-cyan-500"],
    ["Established", "established", "bg-emerald-500"],
    ["Featured", "featured", "bg-amber-500"],
    ["Luminary", "luminary", "bg-rose-500"],
  ] as const;
  const trustCounts = new Map((stats?.trustDistribution ?? []).map((item) => [item.level, Number(item.count)]));
  const trustTotal = [...trustCounts.values()].reduce((total, value) => total + value, 0);
  const cards = [
    ["Users", stats?.totalUsers, Users, "All accounts", "users"],
    ["Posts", stats?.totalPosts, FileText, "Published content", "content"],
    ["Reports", stats?.pendingReports, Flag, "Awaiting review", "trust"],
    ["Bans", stats?.bannedUsers, ShieldCheck, "Currently suspended", "users"],
    ["Active boosts", stats?.activeBoosts, Rocket, "Running now", "content"],
    ["Boost requests", stats?.pendingBoosts, ArrowUpRight, "Pending decision", "content"],
    ["Flags enabled", enabledFlags, Activity, `${Object.keys(features).length} available`, "features"],
  ] as const;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Platform overview</h2><p className="mt-1 text-sm text-muted-foreground">Operational totals, trust health, and activity across QuillHive.</p></div>
      <Button size="sm" variant="outline" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, Icon, hint, section]) => <Link key={label} href={`/admin?section=${section}`} className="group rounded-lg border border-border/70 bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{loading && value == null ? <span className="inline-block h-7 w-14 animate-pulse rounded bg-muted" /> : Number(value ?? 0).toLocaleString()}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </Link>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <section className="rounded-lg border border-border/70 bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3"><div><h3 className="text-sm font-semibold">Platform pulse</h3><p className="mt-0.5 text-xs text-muted-foreground">Daily signups, published posts, reports, and boost requests · last 7 days</p></div><Activity className="h-4 w-4 text-primary" /></div>
        <div className="h-64 p-3">
          {loading && pulse.length === 0 ? <div className="h-full animate-pulse rounded-md bg-muted/50" /> : pulse.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No activity data is available.</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pulse} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickFormatter={(day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip labelFormatter={(day) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#0891b2" fill="#0891b2" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="posts" name="Posts" stroke="#16a34a" fill="#16a34a" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="reports" name="Reports" stroke="#e11d48" fill="#e11d48" fillOpacity={0.08} strokeWidth={2} />
                <Area type="monotone" dataKey="boosts" name="Boost requests" stroke="#d97706" fill="#d97706" fillOpacity={0.08} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-background">
        <div className="border-b border-border/60 px-4 py-3"><h3 className="text-sm font-semibold">Trust distribution</h3><p className="mt-0.5 text-xs text-muted-foreground">{trustTotal.toLocaleString()} accounts by creator level</p></div>
        <div className="space-y-3 p-4">
          {trustLevels.map(([label, key, color]) => {
            const value = trustCounts.get(key) ?? 0;
            const percent = trustTotal > 0 ? value / trustTotal * 100 : 0;
            return <div key={key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="tabular-nums text-muted-foreground">{value.toLocaleString()} · {percent.toFixed(1)}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${color}`} style={{ width: `${percent}%` }} /></div>
            </div>;
          })}
          <Link href="/admin?section=trust" className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline">Open trust & safety <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>
    </div>

    <section className="rounded-lg border border-border/70 bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3"><div><h3 className="text-sm font-semibold">Operations shortcuts</h3><p className="mt-0.5 text-xs text-muted-foreground">Jump to queues and platform controls</p></div></div>
      <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {[["Review reports", "Triage user and content reports", "trust"], ["Manage users", "Search, inspect, and moderate accounts", "users"], ["Review content", "Posts, boosts, and publishing", "content"], ["Feature flags", `${enabledFlags} switches currently enabled`, "features"]].map(([label, detail, section]) => <Link key={section} href={`/admin?section=${section}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20"><span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span><ArrowUpRight className="h-4 w-4 shrink-0 text-primary" /></Link>)}
      </div>
    </section>
  </div>;
}