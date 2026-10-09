import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Eye, LockKeyhole, Search, Shield, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

type Row = Record<string, any>;

export default function AdminMaster({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [overview, setOverview] = useState<Row | null>(null);
  const [kind, setKind] = useState<"users" | "groups">("users");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [selection, setSelection] = useState<{ kind: "user" | "group"; id: number } | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [conversations, setConversations] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([fetchAdmin("/api/admin/master/overview"), fetchAdmin("/api/admin/master/conversations")])
      .then(([summary, dmMetadata]) => {
        setOverview(summary);
        setConversations(Array.isArray(dmMetadata.conversations) ? dmMetadata.conversations : []);
      })
      .catch((error) => toast({ title: "Could not load master dashboard", description: error.message, variant: "destructive" }));
  }, [fetchAdmin, toast]);

  const search = async () => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAdmin(`/api/admin/master/${kind}?q=${encodeURIComponent(term)}`);
      setResults(Array.isArray(data[kind]) ? data[kind] : []);
    } catch (error) {
      toast({ title: "Search failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (next: { kind: "user" | "group"; id: number }) => {
    setSelection(next);
    setDetail(null);
    try {
      setDetail(await fetchAdmin(`/api/admin/master/${next.kind === "user" ? "users" : "groups"}/${next.id}`));
    } catch (error) {
      setSelection(null);
      toast({ title: "Could not open record", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    }
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Master dashboard</h2><Badge variant="outline">Super admin only</Badge></div><p className="mt-1 text-sm text-muted-foreground">Unrestricted profile and group inspection. Direct-message bodies are never retrieved or shown.</p></div></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Accounts" value={overview?.users?.total} icon={<Users className="h-4 w-4" />} />
      <Metric label="Banned accounts" value={overview?.users?.banned} />
      <Metric label="Groups" value={overview?.groups?.total} detail={`${overview?.groups?.private ?? 0} private`} />
      <Metric label="Posts & Sparks" value={overview?.content?.total} detail={`${overview?.content?.sparks ?? 0} Sparks`} />
    </div>
    <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Inspect any account or group</h3><p className="mt-1 text-xs text-muted-foreground">Privacy settings, membership, publication state, and visibility are bypassed on these server-authorized queries.</p></div><div className="flex gap-2">
        <Button size="sm" variant={kind === "users" ? "default" : "outline"} onClick={() => { setKind("users"); setResults([]); setSelection(null); setDetail(null); }}>Profiles</Button>
        <Button size="sm" variant={kind === "groups" ? "default" : "outline"} onClick={() => { setKind("groups"); setResults([]); setSelection(null); setDetail(null); }}>Groups</Button>
      </div></div>
      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === "users" ? "Username, display name, or email" : "Group name or slug"} /><Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />Search</Button></form>
      {results.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2">{results.map((row) => <button key={row.id} onClick={() => void openDetail({ kind: kind === "users" ? "user" : "group", id: row.id })} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-left hover:bg-muted/30"><span className="min-w-0"><span className="block truncate text-sm font-medium">{row.displayName ?? row.name ?? row.username}</span><span className="block truncate text-xs text-muted-foreground">{kind === "users" ? `@${row.username} · ${row.email} · ${row.profileVisibility}` : `${row.slug} · ${row.privacy} · ${row.type}`}</span></span><Eye className="h-4 w-4 shrink-0 text-primary" /></button>)}</div>}
      {loading && <p className="py-4 text-sm text-muted-foreground">Searching…</p>}
      {!loading && query.trim().length >= 2 && results.length === 0 && <p className="py-4 text-sm text-muted-foreground">No matching records.</p>}
    </section>
    {selection && detail && <InspectionDetail kind={selection.kind} data={detail} />}
    <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
      <div className="flex items-start gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><LockKeyhole className="h-4 w-4" /></span><div><h3 className="font-semibold">Direct-message metadata only</h3><p className="mt-1 text-xs text-muted-foreground">The API selects conversation IDs, participants, counts, and activity timestamps only. It never queries message content.</p></div></div>
      <div className="mt-4 divide-y divide-border/60">{conversations.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No conversations found.</p> : conversations.map((conversation) => <div key={conversation.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><p className="text-sm font-medium">{conversation.isGroup ? conversation.groupName || `Group conversation #${conversation.id}` : `Conversation #${conversation.id}`}</p><p className="text-xs text-muted-foreground">{conversation.participants.map((participant: Row) => participant.displayName || `@${participant.username}`).join(", ") || "No participants"}</p><p className="text-xs tabular-nums text-muted-foreground">{Number(conversation.messageCount).toLocaleString()} messages · <Timestamp value={conversation.lastActivity} mode="datetime" /></p></div>)}</div>
    </section>
  </div>;
}

function Metric({ label, value, detail, icon }: { label: string; value?: number; detail?: string; icon?: React.ReactNode }) {
  return <div className="rounded-xl border border-border/70 bg-background p-4 shadow-sm"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div><p className="mt-2 text-2xl font-semibold tabular-nums">{value == null ? "—" : Number(value).toLocaleString()}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}

function InspectionDetail({ kind, data }: { kind: "user" | "group"; data: Row }) {
  if (kind === "user") {
    return <section className="space-y-4 rounded-xl border border-border/70 bg-background p-5 shadow-sm"><div><h3 className="text-lg font-semibold">Full profile: {data.user.displayName} <span className="font-normal text-muted-foreground">@{data.user.username}</span></h3><p className="text-xs text-muted-foreground">Includes private profile fields and restricted, unpublished, Spark, and group posts (up to 100 latest). Credentials and authentication secrets are excluded.</p></div><DataGrid value={data.user} /><div className="grid gap-4 sm:grid-cols-3"><Metric label="Followers" value={data.activity.followers} /><Metric label="Following" value={data.activity.following} /><Metric label="Comments" value={data.activity.comments} /></div>{data.creatorProfile && <Listing title="Creator profile" rows={[data.creatorProfile]} />}<Listing title={`Posts and Sparks (${data.posts.length})`} rows={data.posts} bodyKey="content" /><Listing title={`Boost history (${data.boosts.length})`} rows={data.boosts} bodyKey="adminNote" /><Listing title={`Work history (${data.workHistory.length})`} rows={data.workHistory} /><Listing title={`Education (${data.education.length})`} rows={data.education} /></section>;
  }
  return <section className="space-y-4 rounded-xl border border-border/70 bg-background p-5 shadow-sm"><div><h3 className="text-lg font-semibold">Full group: {data.group.name}</h3><p className="text-xs text-muted-foreground">Private settings, posts (up to 100 latest), and member roster (up to 300 latest) are included, along with moderation and join-request metadata.</p></div><DataGrid value={data.group} /><Metric label="Members" value={data.memberCount} /><Listing title={`Group posts (${data.posts.length})`} rows={data.posts} bodyKey="content" /><Listing title={`Post details (${data.postDetails.length})`} rows={data.postDetails} /><Listing title={`Members (${data.members.length})`} rows={data.members} /><Listing title={`Join requests (${data.joinRequests.length})`} rows={data.joinRequests} /><Listing title={`Group bans (${data.bans.length})`} rows={data.bans} /><Listing title={`Invite metadata (${data.invites.length})`} rows={data.invites} /><Listing title={`Recent activity (${data.activity.length})`} rows={data.activity} /></section>;
}

function DataGrid({ value }: { value: Row }) {
  return <div className="grid gap-2 rounded-lg bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(value).map(([key, field]) => <div key={key} className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p><p className="break-words text-xs">{typeof field === "object" && field !== null ? JSON.stringify(field) : String(field ?? "—")}</p></div>)}</div>;
}

function Listing({ title, rows, bodyKey }: { title: string; rows: Row[]; bodyKey?: string }) {
  return <details className="rounded-lg border border-border/70 p-3"><summary className="cursor-pointer text-sm font-semibold">{title}</summary><div className="mt-3 max-h-[32rem] space-y-2 overflow-auto">{rows.map((row, index) => <details key={row.id ?? index} className="rounded-md bg-muted/20 p-3"><summary className="cursor-pointer text-xs font-medium">{row.title ?? row.displayName ?? row.username ?? `Record ${row.id ?? index + 1}`} · {row.createdAt && <Timestamp value={row.createdAt} mode="datetime" />}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{bodyKey ? `${row[bodyKey] ?? ""}\n\n${JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => key !== bodyKey)), null, 2)}` : JSON.stringify(row, null, 2)}</pre></details>)}{rows.length === 0 && <p className="text-xs text-muted-foreground">No records.</p>}</div></details>;
}
