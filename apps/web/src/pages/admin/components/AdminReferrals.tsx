import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Link2, BarChart3, Coins } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { Link } from "wouter";

type ReferralData = {
  rewardsEnabled: boolean;
  referrers: Array<{ id: number; username: string; displayName: string; referredUserCount: number; inviteCodeCount: number }>;
  inviteCodes: Array<{ createdBy: number; code: string; usedBy: number | null; createdAt: string }>;
  referralSources: Array<{ source: string; count: number }>;
};

type RewardAdminData = {
  coinsEnabled: boolean;
  users: Array<{ id: number; username: string; displayName: string; trustScore: number | null; referredCount: number; activityCount: number; totalCoins: number }>;
};

export default function AdminReferrals({ token, toast, currentUser }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [data, setData] = useState<ReferralData | null>(null);
  const [rewardData, setRewardData] = useState<RewardAdminData | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { amount: string; reason: string; basis: string }>>({});
  const [grantingId, setGrantingId] = useState<number | null>(null);
  useEffect(() => {
    void fetchAdmin("/api/admin/referrals")
      .then(setData)
      .catch((err) => toast({ title: "Could not load referral metrics", description: err.message, variant: "destructive" }));
    if (currentUser.role === "super_admin") {
      void fetchAdmin("/api/admin/rewards")
        .then(setRewardData)
        .catch((err) => toast({ title: "Could not load Coin distribution data", description: err.message, variant: "destructive" }));
    }
  }, [fetchAdmin, toast, currentUser.role]);

  const grantCoins = async (userId: number) => {
    const draft = drafts[userId];
    const amount = Number(draft?.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !draft?.reason.trim() || !draft?.basis.trim()) {
      toast({ title: "Enter a positive whole Coin amount, reason, and allocation basis.", variant: "destructive" });
      return;
    }
    setGrantingId(userId);
    try {
      await fetchAdmin("/api/admin/rewards/credit", {
        method: "POST",
        body: JSON.stringify({ userId, amount, reason: draft.reason.trim(), basis: draft.basis.trim() }),
      });
      const refreshed = await fetchAdmin("/api/admin/rewards");
      setRewardData(refreshed);
      setDrafts(current => ({ ...current, [userId]: { amount: "", reason: "", basis: "" } }));
      toast({ title: `${amount} QHC credited` });
    } catch (error) {
      toast({ title: "Could not credit QuillHive Coins", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setGrantingId(null);
    }
  };

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
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background"><div className="border-b border-border/70 px-5 py-4 text-sm font-semibold">Top referrers</div><div className="divide-y divide-border/60">{data.referrers.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No referred accounts yet.</p> : data.referrers.map((referrer) => <Link key={referrer.id} href={`/profile/${encodeURIComponent(referrer.username)}`} target="_blank" rel="noreferrer" aria-label={`Open ${referrer.displayName || referrer.username}'s profile in a new tab`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40"><div><p className="text-sm font-medium">{referrer.displayName || referrer.username}</p><p className="text-xs text-muted-foreground">@{referrer.username}</p></div><Badge variant="secondary">{referrer.referredUserCount} referred</Badge></Link>)}</div></div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background"><div className="border-b border-border/70 px-5 py-4 text-sm font-semibold">Referral sources</div><div className="divide-y divide-border/60">{data.referralSources.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No referral sources recorded yet.</p> : data.referralSources.map((source) => <div key={source.source} className="flex items-center justify-between px-5 py-3"><span className="text-sm">{source.source}</span><Badge variant="outline">{source.count}</Badge></div>)}</div></div>
    </div>
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background"><div className="border-b border-border/70 px-5 py-4 text-sm font-semibold">Recent invite codes</div><div className="divide-y divide-border/60">{data.inviteCodes.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No invite codes created yet.</p> : data.inviteCodes.slice(0, 12).map((invite) => <div key={invite.code} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="font-mono text-sm">{invite.code}</p><p className="text-xs text-muted-foreground">Created <Timestamp value={invite.createdAt} mode="date" /> by user #{invite.createdBy}</p></div><Badge variant={invite.usedBy ? "default" : "outline"}>{invite.usedBy ? "Used" : "Unused"}</Badge></div>)}</div></div>
    {currentUser.role === "super_admin" && (
      <section className="space-y-4 rounded-xl border border-amber-500/25 bg-background p-5">
        <div className="flex items-start gap-3"><Coins className="mt-1 h-5 w-5 shrink-0 text-amber-500" /><div><h3 className="font-semibold">QuillHive Coin allocation</h3><p className="mt-1 text-sm text-muted-foreground">Admin-only internal rewards. Review trust, referrals, and activity, then record a reason and allocation basis. These Coins are not cash payouts.</p></div></div>
        {!rewardData ? <p className="text-sm text-muted-foreground">Loading allocation data…</p> : !rewardData.coinsEnabled ? <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">Coin balances and allocations are disabled. Enable QuillHive Coins in Feature Flags before granting rewards.</p> : (
          <div className="space-y-3">
            {rewardData.users.map(user => {
              const draft = drafts[user.id] ?? { amount: "", reason: "", basis: "" };
              return <div key={user.id} className="grid gap-3 rounded-lg border border-border/70 p-4 lg:grid-cols-[minmax(170px,1fr)_repeat(4,minmax(0,1fr))_auto] lg:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.displayName || user.username}</p><p className="truncate text-xs text-muted-foreground">@{user.username} · {user.totalCoins} QHC balance</p><p className="text-[11px] text-muted-foreground">Trust {user.trustScore ?? "—"} · {user.referredCount} referred · {user.activityCount} activity</p></div>
                <Input aria-label={`Coin amount for ${user.username}`} type="number" min="1" step="1" placeholder="Coins" value={draft.amount} onChange={event => setDrafts(current => ({ ...current, [user.id]: { ...draft, amount: event.target.value } }))} />
                <Input aria-label={`Reason for ${user.username}`} placeholder="Reward reason" maxLength={180} value={draft.reason} onChange={event => setDrafts(current => ({ ...current, [user.id]: { ...draft, reason: event.target.value } }))} />
                <Input aria-label={`Allocation basis for ${user.username}`} placeholder="Trust / referrals / activity" maxLength={500} value={draft.basis} onChange={event => setDrafts(current => ({ ...current, [user.id]: { ...draft, basis: event.target.value } }))} />
                <Button disabled={grantingId === user.id} onClick={() => void grantCoins(user.id)}>{grantingId === user.id ? "Saving…" : "Credit"}</Button>
              </div>;
            })}
            {!rewardData.users.length && <p className="text-sm text-muted-foreground">No eligible accounts found.</p>}
          </div>
        )}
      </section>
    )}
  </section>;
}