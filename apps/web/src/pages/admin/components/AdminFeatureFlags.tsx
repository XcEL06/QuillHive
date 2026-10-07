import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

const FLAG_METADATA: Record<string, { label: string; description: string; category: "Core" | "Future" }> = {
  ai_tools_enabled: {
    label: "AI Tools",
    description: "Allow AI writing assistance and translation for administrators. Off by default.",
    category: "Future",
  },
  creator_income_enabled: {
    label: "Creator Income & Monetization",
    description: "Master switch for creator income tracking, service listings, commissions, talent discovery, and service checkout. Off by default.",
    category: "Core",
  },
  referral_rewards_enabled: {
    label: "Referral Rewards",
    description: "Award trust score bonuses to users based on how many valid people they've referred and those referrals' own trust scores. Off by default - enable when ready.",
    category: "Future",
  },
  identity_verification_enabled: {
    label: "Identity Verification",
    description: "Expose identity verification when a supported provider is configured. Off by default.",
    category: "Future",
  },
  phone_verification_enabled: {
    label: "Phone Verification",
    description: "Expose phone verification only when an SMS provider is configured. Off by default.",
    category: "Future",
  },
  ads_enabled: {
    label: "Native Feed Ads",
    description: "Allow configured third-party native ad units in the public Explore feed. Off by default; can be paused without a deploy.",
    category: "Core",
  },
};

export default function AdminFeatureFlags({ token, toast, currentUser }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const queryClient = useQueryClient();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  useEffect(() => { void fetchAdmin("/api/admin/settings/features").then(setFeatures).catch((err) => toast({ title: "Could not load feature flags", description: err.message, variant: "destructive" })); }, [fetchAdmin, toast]);
  const canManageFlags = currentUser.role === "admin" || currentUser.role === "super_admin";
  const enabledCount = Object.values(features).filter(Boolean).length;
  const disabledCount = Object.keys(features).length - enabledCount;
  const toggle = async (key: string, value: boolean) => { if (!canManageFlags || !window.confirm(`${value ? "Enable" : "Disable"} this feature flag?`)) return; try { await fetchAdmin("/api/admin/settings/features", { method: "PATCH", body: JSON.stringify({ [key]: value }) }); setFeatures((f) => ({ ...f, [key]: value })); queryClient.setQueryData<Record<string, boolean>>(["feature-flags"], (current) => ({ ...current, [key]: value })); toast({ title: `${FLAG_METADATA[key]?.label ?? key} ${value ? "enabled" : "disabled"}` }); } catch (err: any) { toast({ title: "Could not update flag", description: err.message, variant: "destructive" }); } };
  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Available flags</p><p className="mt-2 text-2xl font-semibold">{Object.keys(features).length}</p></article>
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Enabled</p><p className="mt-2 text-2xl font-semibold">{enabledCount}</p></article>
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Disabled</p><p className="mt-2 text-2xl font-semibold">{disabledCount}</p></article>
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Master switch</p><p className="mt-2 text-sm font-semibold">{features.creator_income_enabled ? "Creator income enabled" : "Creator income disabled"}</p></article>
    </section>
    <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"><div className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-5 py-4"><AlertTriangle className="h-4 w-4 text-amber-500" /><p className="text-xs text-muted-foreground">Changes apply platform-wide and may affect active users. Admins and super admins can enable or disable flags.</p></div><div className="divide-y divide-border/60">{Object.entries(features).map(([key, value]) => { const metadata = FLAG_METADATA[key]; return <div key={key} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{metadata?.label ?? key}</span><Badge variant={value ? "default" : "outline"} className="text-[10px]">{value ? "Enabled" : "Off"}</Badge></div><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{metadata?.description ?? "Controls availability of this platform capability."}</p></div><Switch checked={value} disabled={!canManageFlags} onCheckedChange={(v) => void toggle(key, v)} /></div>; })}</div>{!canManageFlags && <p className="border-t border-border/70 p-4 text-xs text-muted-foreground">Only admins and super admins can change feature flags.</p>}</section>
  </div>;
}