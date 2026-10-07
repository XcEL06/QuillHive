import { useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw, ShieldAlert, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { AdminOverviewStats } from "./AdminOverviewStats";

interface ReviewFlag {
  id: number;
  userId: number;
  ruleKey: string;
  reason: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  username: string;
  displayName: string;
  isBanned: boolean;
  accountCreatedAt: string;
}

const ACTIONS = [
  ["dismiss", "Dismiss"],
  ["warn", "Warn"],
  ["strike", "Issue strike"],
  ["ban", "Ban account"],
] as const;

export default function AdminSpamReview({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [flags, setFlags] = useState<ReviewFlag[]>([]);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = async () => {
    const data = await fetchAdmin("/api/admin/spam-review");
    setFlags(Array.isArray(data.flags) ? data.flags : []);
  };

  useEffect(() => {
    let active = true;
    void fetchAdmin("/api/admin/spam-review")
      .then((data) => { if (active) setFlags(Array.isArray(data.flags) ? data.flags : []); })
      .catch((error) => toast({ title: "Could not load review queue", description: error.message, variant: "destructive" }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAdmin, toast]);

  const decide = async (flag: ReviewFlag, decision: typeof ACTIONS[number][0]) => {
    const reason = reasons[flag.id]?.trim() || flag.reason;
    if (decision === "ban" && !window.confirm(`Ban @${flag.username}? This action will suspend the account.`)) return;
    setBusyId(flag.id);
    try {
      await fetchAdmin(`/api/admin/spam-review/${flag.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      });
      setFlags((current) => current.filter((item) => item.id !== flag.id));
      toast({ title: decision === "dismiss" ? "Flag dismissed" : `${decision === "strike" ? "Strike issued" : decision === "ban" ? "Account banned" : "Warning issued"}` });
    } catch (error) {
      toast({ title: "Could not apply moderation decision", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return <section className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Spam & scam review</h2><p className="mt-1 text-sm text-muted-foreground">Heuristic signals are review leads only. No account is restricted unless an admin chooses an action.</p></div>
      <Button variant="outline" onClick={() => void refresh().catch((error) => toast({ title: "Could not refresh queue", description: error.message, variant: "destructive" }))}><RefreshCw className="mr-2 h-4 w-4" />Refresh scan</Button>
    </header>
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground"><AlertTriangle className="mr-2 inline h-4 w-4 text-amber-500" />Patterns can produce false positives. Inspect the evidence and choose dismiss, warn, strike, or ban for each flag.</div>
    <AdminOverviewStats items={[
      { label: "Pending flags", value: flags.length, detail: "Current review queue" },
      { label: "Affected accounts", value: new Set(flags.map((flag) => flag.userId)).size },
      { label: "Already banned", value: flags.filter((flag) => flag.isBanned).length },
      { label: "Signal types", value: new Set(flags.map((flag) => flag.ruleKey)).size },
    ]} />
    {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Scanning recent activity…</p> : flags.length === 0 ? <div className="rounded-xl border border-dashed border-border p-12 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Queue is clear</p><p className="mt-1 text-sm text-muted-foreground">No pending heuristic flags were found.</p></div> : (
      <div className="space-y-4">{flags.map((flag) => (
        <article key={flag.id} className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="rounded-lg bg-amber-500/10 p-2 text-amber-600"><ShieldAlert className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="font-semibold">{flag.displayName || `Account #${flag.userId}`} <span className="font-normal text-muted-foreground">@{flag.username}</span></p><p className="mt-1 text-sm">{flag.reason}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{flag.ruleKey.replace(/_/g, " ")}</Badge>{flag.isBanned && <Badge variant="destructive">Already banned</Badge>}<span className="text-xs text-muted-foreground">Account created {new Date(flag.accountCreatedAt).toLocaleString()}</span></div></div>
            </div>
            <a className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={`/profile/${encodeURIComponent(flag.username)}`} target="_blank" rel="noreferrer"><UserRound className="h-3.5 w-3.5" />Open profile</a>
          </div>
          <details className="mt-4 rounded-lg bg-muted/30 p-3">
            <summary className="cursor-pointer text-xs font-medium">Review evidence</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(flag.evidence, null, 2)}</pre>
          </details>
          <Textarea value={reasons[flag.id] ?? flag.reason} onChange={(event) => setReasons((current) => ({ ...current, [flag.id]: event.target.value }))} aria-label={`Decision reason for @${flag.username}`} className="mt-4 min-h-16" />
          <div className="mt-3 flex flex-wrap justify-end gap-2">{ACTIONS.map(([decision, label]) => <Button key={decision} size="sm" variant={decision === "ban" ? "destructive" : decision === "dismiss" ? "outline" : "default"} disabled={busyId === flag.id} onClick={() => void decide(flag, decision)}>{decision === "dismiss" && <Check className="mr-1.5 h-3.5 w-3.5" />}{busyId === flag.id ? "Working…" : label}</Button>)}</div>
        </article>
      ))}</div>
    )}
  </section>;
}
