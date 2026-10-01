import { useEffect, useState } from "react";
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
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    void Promise.all([
      fetchAdmin("/api/admin/insights"),
      fetchAdmin("/api/trust/admin/users"),
      fetchAdmin("/api/admin/users?page=1&limit=100"),
    ]).then(([nextInsights, trustScores, userResponse]) => {
      setInsights(nextInsights);
      setScores(Array.isArray(trustScores) ? trustScores : []);
      setUsers(Array.isArray(userResponse?.users) ? userResponse.users : Array.isArray(userResponse) ? userResponse : []);
    }).catch((err) => toast({ title: "Could not load trust data", description: err.message, variant: "destructive" }));
  }, [fetchAdmin, toast]);

  const usersById = new Map(users.map((user) => [user.id, user]));
  const suspiciousUsers = Array.isArray(insights?.suspiciousUsers) ? insights.suspiciousUsers : [];
  const reportedPosts = Array.isArray(insights?.mostReportedPosts) ? insights.mostReportedPosts : [];
  const trendingTopics = Array.isArray(insights?.trendingTopics) ? insights.trendingTopics : [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-base font-semibold">Trust and moderation overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">Trust scores summarize recorded creator activity. Low scores are review signals, not automatic moderation decisions.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Metric label="Accounts below 30 trust" value={insights?.suspiciousCount} detail="May need a closer look" />
        <Metric label="Accounts below 20 trust" value={insights?.trustAnomalies} detail="Very low trust scores" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
          <SectionHeading title="Accounts to review" description="Lowest trust scores, shown as review signals." />
          <div className="mt-4 divide-y divide-border/60">
            {suspiciousUsers.length === 0 ? <EmptyState>There are no accounts in this review range.</EmptyState> : suspiciousUsers.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.displayName || `Account #${user.id}`}</p>
                  {user.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">{Math.round(user.uti ?? 0)} / 100</span>
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
          <SectionHeading title="Trust score breakdown" description="All components are out of 100; Creator level is the plain-language interpretation of the overall score." />
          <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground"><tr>
                <th className="px-3 py-2">Account</th><th className="px-3 py-2">Trust score</th><th className="px-3 py-2">Creator level</th>
                <th className="px-3 py-2">Content value</th><th className="px-3 py-2">Consistency</th><th className="px-3 py-2">Community trust</th><th className="px-3 py-2">Content impact</th>
              </tr></thead>
              <tbody className="divide-y divide-border/60">
                {scores.map((score) => {
                  const user = usersById.get(score.userId);
                  const isSuperAdmin = user?.role === "super_admin";
                  const creatorLevel = isSuperAdmin ? "luminary" : score.creatorLevel ?? "new_voice";
                  return <tr key={score.id}>
                    <td className="px-3 py-2">{user?.username ? <Link href={`/profile/${user.username}`} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{user.displayName || `@${user.username}`}</Link> : user?.displayName || `Account #${score.userId}`}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{isSuperAdmin ? 100 : Math.round(score.uti ?? 0)} / 100</td>
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