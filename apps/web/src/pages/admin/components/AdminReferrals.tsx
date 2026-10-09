import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Badge } from "@/components/ui/badge";
import { Users, Link2, BarChart3 } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { Link } from "wouter";

type ReferralData = {
  rewardsEnabled: boolean;
  referrers: Array<{ id: number; username: string; displayName: string; referredUserCount: number; inviteCodeCount: number }>;
  inviteCodes: Array<{ createdBy: number; code: string; usedBy: number | null; createdAt: string }>;
  referralSources: Array<{ source: string; count: number }>;
};

export default function AdminReferrals({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [data, setData] = useState<ReferralData | null>(null);
  useEffect(() => {
    void fetchAdmin("/api/admin/referrals")
      .then(setData)
      .catch((err) => toast({ title: "Could not load referral metrics", description: err.message, variant: "destructive" }));
  }, [fetchAdmin, toast]);

  if (!data) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Growth / Referrals</h2><p className="text-sm text-muted-foreground">Invite activity, referral sources, and credited users.</p></div><Badge variant={data.rewardsEnabled ? "default" : "outline"}>{data.rewardsEnabled ? "Rewards enabled" : "Rewards disabled"}</Badge></div>
    {!data.rewardsEnabled && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">Referral attribution remains visible, but trust-score rewards are disabled by the referral feature flag.</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-border/70 bg-background p-5"><Users className="h-5 w-5 text-primary" /><p className="mt-3 text-2xl font-semibold">{data.referrers.length}</p><p className="text-xs text-muted-foreground">Active referrers</p></div>
      <div className="rounded-xl border border-border/70 bg-background p-5"><Link2 className="h-5 w-5 text-primary" /><p className="mt-3 text-2xl font-semibold">{data.inviteCodes.length}</p><p className="text-xs text-muted-foreground">Recent invite codes</p></div>
      <div className="rounded-xl border border-border/70 bg-background p-5"><BarChart3 className="h-5 w-5 text-primary" /><p className="mt-3 text-2xl font-semibold">{data.referralSources.length}</p><p className="text-xs text-muted-foreground">Tracked source labels</p></div>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background"><div className="border-b border-border/70 px-5 py-4 text-sm font-semibold">Top referrers</div><div className="divide-y divide-border/60">{data.referrers.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No referred accounts yet.</p> : data.referrers.map((referrer) => <Link key={referrer.id} href={`/profile/${referrer.username}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40"><div><p className="text-sm font-medium">{referrer.displayName || referrer.username}</p><p className="text-xs text-muted-foreground">@{referrer.username}</p></div><Badge variant="secondary">{referrer.referredUserCount} referred</Badge></Link>)}</div></div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background"><div className="border-b border-border/70 px-5 py-4 text-sm font-semibold">Referral sources</div><div className="divide-y divide-border/60">{data.referralSources.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No referral sources recorded yet.</p> : data.referralSources.map((source) => <div key={source.source} className="flex items-center justify-between px-5 py-3"><span className="text-sm">{source.source}</span><Badge variant="outline">{source.count}</Badge></div>)}</div></div>
    </div>
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background"><div className="border-b border-border/70 px-5 py-4 text-sm font-semibold">Recent invite codes</div><div className="divide-y divide-border/60">{data.inviteCodes.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No invite codes created yet.</p> : data.inviteCodes.slice(0, 12).map((invite) => <div key={invite.code} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="font-mono text-sm">{invite.code}</p><p className="text-xs text-muted-foreground">Created <Timestamp value={invite.createdAt} mode="date" /> by user #{invite.createdBy}</p></div><Badge variant={invite.usedBy ? "default" : "outline"}>{invite.usedBy ? "Used" : "Unused"}</Badge></div>)}</div></div>
  </section>;
}