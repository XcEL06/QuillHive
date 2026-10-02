import { useEffect, useState } from "react";
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
  service_checkout_enabled: {
    label: "Creator Service Checkout",
    description: "Allow buyers to pay for fixed-price creator services through Flutterwave and credit creator earnings.",
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
};

export default function AdminFeatureFlags({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  useEffect(() => { void fetchAdmin("/api/admin/settings/features").then(setFeatures).catch((err) => toast({ title: "Could not load feature flags", description: err.message, variant: "destructive" })); }, [fetchAdmin, toast]);
  const toggle = async (key: string, value: boolean) => { if (!window.confirm(`${value ? "Enable" : "Disable"} this feature flag?`)) return; try { await fetchAdmin("/api/admin/settings/features", { method: "PATCH", body: JSON.stringify({ [key]: value }) }); setFeatures((f) => ({ ...f, [key]: value })); } catch (err: any) { toast({ title: "Could not update flag", description: err.message, variant: "destructive" }); } };
  return <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"><div className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-5 py-4"><AlertTriangle className="h-4 w-4 text-amber-500" /><p className="text-xs text-muted-foreground">Changes apply platform-wide and may affect active users.</p></div><div className="divide-y divide-border/60">{Object.entries(features).map(([key, value]) => { const metadata = FLAG_METADATA[key]; return <div key={key} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{metadata?.label ?? key}</span><Badge variant={value ? "default" : "outline"} className="text-[10px]">{value ? "Enabled" : "Off"}</Badge></div><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{metadata?.description ?? "Controls availability of this platform capability."}</p></div><Switch checked={value} onCheckedChange={(v) => void toggle(key, v)} /></div>; })}</div></section>;
}