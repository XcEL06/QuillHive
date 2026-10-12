import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { Link } from "wouter";

const CREATOR_LEVELS: Record<string, string> = {
  new_voice: "New voice",
  rising: "Rising creator",
  established: "Established creator",
  featured: "Featured creator",
  luminary: "Luminary",
};

export default function AdminTrust({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [insights, setInsights] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [accountsPage, setAccountsPage] = useState(1);
  const [moderation, setModeration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    void Promise.all([
      fetchAdmin("/api/admin/insights"),
      fetchAdmin(`/api/admin/trust/accounts?page=${accountsPage}&limit=100`),
      fetchAdmin("/api/admin/trust/moderation"),
    ]).then(([nextInsights, accountResponse, moderationResponse]) => {
      setInsights(nextInsights);
      setScores(Array.isArray(accountResponse?.rows) ? accountResponse.rows : []);
      setTotalAccounts(Number(accountResponse?.total) || 0);
      setModeration(moderationResponse);
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Could not load trust and moderation data.");
      toast({ title: "Could not load trust data", description: err.message, variant: "destructive" });
    }).finally(() => setLoading(false));
  }, [fetchAdmin, toast, accountsPage, loadAttempt]);

  const accountsById = new Map(scores.map((account) => [account.userId, account]));
  const suspiciousUsers = Array.isArray(insights?.suspiciousUsers) ? insights.suspiciousUsers : [];
  const reportedPosts = Array.isArray(insights?.mostReportedPosts) ? insights.mostReportedPosts : [];
  const trendingTopics = Array.isArray(insights?.trendingTopics) ? insights.trendingTopics : [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-base font-semibold">Trust and moderation overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">Trust scores summarize recorded creator activity. Low scores are review signals, not automatic moderation decisions.</p>
        <Button type="button" size="sm" variant="outline" className="mt-3" disabled={loading} onClick={() => setLoadAttempt(attempt => attempt + 1)}>Refresh trust and moderation</Button>
      </header>
      {loading && <p className="text-sm text-muted-foreground" role="status">Loading trust and moderation data…</p>}
      {loadError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">Some trust and moderation data could not be loaded: {loadError}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Metric label="Accounts below 30 trust" value={insights?.suspiciousCount} detail="May need a closer look" />
        <Metric label="Accounts below 20 trust" value={insights?.trustAnomalies} detail="Very low trust scores" />
      </div>

      <section className="space-y-4">
        <SectionHeading title="Moderation activity" description="Plain-language review context from reports, strikes, bans, spam patterns, and trust events. Direct messages are not included." />
        <div className="grid gap-5 xl:grid-cols-2">
          <ModerationList title="Pending reports" empty="No reports are waiting for review." rows={moderation?.reports} render={(row: any) => {
            const targetHref = row.targetType === "post" ? `/post/${row.targetId}` : row.targetType === "user" && row.target?.username ? `/profile/${encodeURIComponent(row.target.username)}` : null;
            return <><p className="text-sm font-medium">{row.reason || "Report submitted"} <span className="font-normal text-muted-foreground">· {String(row.category || "other").replace(/_/g, " ")}</span></p><p className="mt-1 text-xs text-muted-foreground">Reported {row.targetType} {row.target?.title ? `“${row.target.title}”` : `#${row.targetId}`} · {row.priority} priority</p>{targetHref && <a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={targetHref} target="_blank" rel="noreferrer">Open {row.targetType}</a>}</>;
          }} />
          <ModerationList title="Open spam & scam flags" empty="No heuristic flags are waiting for review." rows={moderation?.spamFlags} render={(row: any) => <><p className="text-sm font-medium">{row.reason}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{row.ruleKey.replace(/_/g, " ")} · {row.user?.displayName || `Account #${row.userId}`}</p>{row.user?.username && <a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={`/profile/${encodeURIComponent(row.user.username)}`} target="_blank" rel="noreferrer">Open profile</a>}</>} />
          <ModerationList title="Recent strikes" empty="No moderation strikes have been issued." rows={moderation?.strikes} render={(row: any) => <><p className="text-sm font-medium">{row.reason}</p><p className="mt-1 text-xs text-muted-foreground">{row.user?.displayName || `Account #${row.userId}`} · severity {row.severity}/10 · issued <Timestamp value={row.createdAt} mode="datetime" /></p>{row.user?.username && <a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={`/profile/${encodeURIComponent(row.user.username)}`} target="_blank" rel="noreferrer">Open profile</a>}</>} />
          <ModerationList title="Banned accounts" empty="No currently banned accounts." rows={moderation?.bannedUsers} render={(row: any) => <><p className="text-sm font-medium">{row.displayName || `Account #${row.id}`} <span className="font-normal text-muted-foreground">@{row.username}</span></p><p className="mt-1 text-xs text-muted-foreground">Banned <Timestamp value={row.bannedAt} mode="datetime" /></p><a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={`/profile/${encodeURIComponent(row.username)}`} target="_blank" rel="noreferrer">Open profile</a></>} />
          <ModerationList title="Trust signals" empty="No recent behavior or trust signals." rows={moderation?.trustSignals} render={(row: any) => <><p className="text-sm font-medium capitalize">{row.label}</p><p className="mt-1 text-xs text-muted-foreground">{row.user?.displayName || `Account #${row.userId}`} · {row.detail} · <Timestamp value={row.createdAt} mode="datetime" /></p>{row.user?.username && <a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={`/profile/${encodeURIComponent(row.user.username)}`} target="_blank" rel="noreferrer">Open profile</a>}</>} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
          <SectionHeading title="Accounts to review" description="Lowest trust scores, shown as review signals." />
          <div className="mt-4 divide-y divide-border/60">
            {suspiciousUsers.filter((user: any) => {
              const account = accountsById.get(user.id);
              return account?.role !== "super_admin" && !account?.isOfficialAccount;
            }).length === 0 ? <EmptyState>There are no accounts in this review range.</EmptyState> : suspiciousUsers.filter((user: any) => {
              const account = accountsById.get(user.id);
              return account?.role !== "super_admin" && !account?.isOfficialAccount;
            }).map((user: any) => (
              <div key={user.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.displayName || `Account #${user.id}`}</p>
                  {user.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">{Math.round(accountsById.get(user.id)?.uti ?? user.uti ?? 0)} / 100</span>
                  {user.username && <Link href={`/profile/${user.username}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">Open profile</Link>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
          <SectionHeading title="Posts with pending reports" description="Posts with the most reports still awaiting review." />
          <div className="mt-4 divide-y divide-border/60">
            {reportedPosts.length === 0 ? <EmptyState>No posts have pending reports.</EmptyState> : reportedPosts.map((post: any) => (
              <div key={post.postId} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm font-medium">Post #{post.postId}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{post.reportCount} pending {post.reportCount === 1 ? "report" : "reports"}</span>
                  <Link href={`/post/${post.postId}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">Open post</Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm xl:col-span-2">
          <SectionHeading title="Trust score breakdown" description={`All ${totalAccounts.toLocaleString()} accounts, including new users without an activity record. Trust score is earned from existing grading rules; official and super admin accounts are displayed at the platform trust maximum.`} />
          <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground"><tr>
                <th className="px-3 py-2">Account</th><th className="px-3 py-2">Trust score</th><th className="px-3 py-2">Creator level</th>
                <th className="px-3 py-2">Content value</th><th className="px-3 py-2">Consistency</th><th className="px-3 py-2">Community trust</th><th className="px-3 py-2">Content impact</th>
              </tr></thead>
              <tbody className="divide-y divide-border/60">
                {scores.map((score) => {
                  const platformTrusted = score.role === "super_admin" || score.isOfficialAccount;
                  const creatorLevel = platformTrusted ? "luminary" : score.creatorLevel ?? "new_voice";
                  return <tr key={score.userId}>
                    <td className="px-3 py-2">{score.username ? <Link href={`/profile/${encodeURIComponent(score.username)}`} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{score.displayName || `@${score.username}`}</Link> : score.displayName || `Account #${score.userId}`}{platformTrusted && <Badge variant="secondary" className="ml-2 text-[9px]">{score.role === "super_admin" ? "Super admin" : "Official"}</Badge>}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{Math.round(score.uti ?? 0)} / 100</td>
                    <td className="px-3 py-2">{CREATOR_LEVELS[creatorLevel] || "New voice"}</td>
                    <td className="px-3 py-2 tabular-nums">{Math.round(score.cvs ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{Math.round(score.bcs ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{Math.round(score.cts ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{Math.round(score.avgCis ?? 0)}</td>
                  </tr>;
                })}
                {scores.length === 0 && <tr><td colSpan={7}><EmptyState>No trust scores are available.</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2"><span className="text-xs text-muted-foreground">Page {accountsPage} · {scores.length} accounts shown</span><Button type="button" size="sm" variant="outline" disabled={accountsPage <= 1} onClick={() => setAccountsPage(page => page - 1)}>Previous</Button><Button type="button" size="sm" variant="outline" disabled={accountsPage * 100 >= totalAccounts} onClick={() => setAccountsPage(page => page + 1)}>Next</Button></div>
        </section>

        <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm xl:col-span-2">
          <SectionHeading title="Trending topics" description="Topics with the most published posts." />
          {trendingTopics.length === 0 ? <EmptyState>No topic activity is available.</EmptyState> : (
            <div className="mt-4 flex flex-wrap gap-2">
              {trendingTopics.map((topic: any) => <span key={topic.slug} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">{topic.name}<span className="ml-2 text-xs text-muted-foreground">{topic.postCount ?? 0} posts</span></span>)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value?: number; detail: string }) {
  return <div className="rounded-xl border border-border/70 bg-background p-5 shadow-sm"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value == null ? "--" : value.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function ModerationList({ title, empty, rows, render }: {
  title: string;
  empty: string;
  rows?: any[];
  render: (row: any) => React.ReactNode;
}) {
  const items = Array.isArray(rows) ? rows : [];
  return <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
    <h3 className="text-sm font-semibold">{title} <Badge variant="outline" className="ml-1">{items.length}</Badge></h3>
    {items.length === 0 ? <EmptyState>{empty}</EmptyState> : <div className="mt-3 divide-y divide-border/60">
      {items.map((row) => <article key={row.id} className="py-3 first:pt-0 last:pb-0">{render(row)}</article>)}
    </div>}
  </section>;
}