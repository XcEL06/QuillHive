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
  referral_program_enabled: {
    label: "User Referral Program",
    description: "Allow each user to share one reusable referral link and view the people they referred. Off by default.",
    category: "Future",
  },
  quillhive_coins_enabled: {
    label: "QuillHive Coins",
    description: "Show user Coin balances and enable super-admin allocation of internal platform rewards. Coins are not cash. Off by default.",
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
    label: "Google AdSense In-Feed Ads",
    description: "Allow consented Google AdSense native ads in the authenticated Explore feed. Off by default; only super admins can change this setting.",
    category: "Core",
  },
  profile_cv_enabled: {
    label: "Profile CV Downloads",
    description: "Allow users to download an ATS-friendly CV generated from their profile. Off by default.",
    category: "Future",
  },
  profile_cv_premium_only: {
    label: "Require Premium for Profile CV Downloads",
    description: "When CV downloads are enabled, restrict them to premium members. Enable this when premium access is available.",
    category: "Future",
  },
  google_oauth_enabled: {
    label: "Google Sign-In",
    description: "Allow users to sign in or create an account with Google. Requires Google OAuth credentials. Off by default.",
    category: "Core",
  },
  github_oauth_enabled: {
    label: "GitHub Sign-In",
    description: "Allow users to sign in or create an account with GitHub. Requires GitHub OAuth credentials. Off by default.",
    category: "Core",
  },
};

export default function AdminFeatureFlags({ token, toast, currentUser }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const queryClient = useQueryClient();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  useEffect(() => { void fetchAdmin("/api/admin/settings/features").then(setFeatures).catch((err) => toast({ title: "Could not load feature flags", description: err.message, variant: "destructive" })); }, [fetchAdmin, toast]);
  const canManageFlags = currentUser.role === "admin" || currentUser.role === "super_admin";
  const canManageOAuth = currentUser.role === "super_admin";
  const canManageAds = currentUser.role === "super_admin";
  const enabledCount = Object.values(features).filter(Boolean).length;
  const disabledCount = Object.keys(features).length - enabledCount;
  const requiresSuperAdmin = (key: string) => ["google_oauth_enabled", "github_oauth_enabled", "ads_enabled", "profile_cv_enabled", "profile_cv_premium_only", "referral_program_enabled", "quillhive_coins_enabled"].includes(key);
  const toggle = async (key: string, value: boolean) => { if (!canManageFlags || (requiresSuperAdmin(key) && !canManageOAuth) || !window.confirm(`${value ? "Enable" : "Disable"} ${FLAG_METADATA[key]?.label ?? "this feature"}?`)) return; try { await fetchAdmin("/api/admin/settings/features", { method: "PATCH", body: JSON.stringify({ [key]: value }) }); setFeatures((f) => ({ ...f, [key]: value })); queryClient.setQueryData<Record<string, boolean>>(["feature-flags"], (current) => ({ ...current, [key]: value })); toast({ title: `${FLAG_METADATA[key]?.label ?? key} ${value ? "enabled" : "disabled"}` }); } catch (err: any) { toast({ title: "Could not update flag", description: err.message, variant: "destructive" }); } };
  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Available flags</p><p className="mt-2 text-2xl font-semibold">{Object.keys(features).length}</p></article>
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Enabled</p><p className="mt-2 text-2xl font-semibold">{enabledCount}</p></article>
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Disabled</p><p className="mt-2 text-2xl font-semibold">{disabledCount}</p></article>
      <article className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><p className="text-xs text-muted-foreground">Master switch</p><p className="mt-2 text-sm font-semibold">{features.creator_income_enabled ? "Creator income enabled" : "Creator income disabled"}</p></article>
    </section>
    <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"><div className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-5 py-4"><AlertTriangle className="h-4 w-4 text-amber-500" /><p className="text-xs text-muted-foreground">Changes apply platform-wide and may affect active users. OAuth, advertising, and profile CV switches are limited to super admins.</p></div><div className="divide-y divide-border/60">{Object.entries(features).map(([key, value]) => { const metadata = FLAG_METADATA[key]; const superAdminOnly = requiresSuperAdmin(key); return <div key={key} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{metadata?.label ?? key}</span><Badge variant={value ? "default" : "outline"} className="text-[10px]">{value ? "Enabled" : "Off"}</Badge></div><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{metadata?.description ?? "Controls availability of this platform capability."}</p></div><Switch checked={value} disabled={!canManageFlags || (superAdminOnly && !canManageOAuth)} onCheckedChange={(v) => void toggle(key, v)} /></div>; })}</div>{!canManageFlags && <p className="border-t border-border/70 p-4 text-xs text-muted-foreground">Only admins and super admins can change feature flags.</p>}</section>
  </div>;
}