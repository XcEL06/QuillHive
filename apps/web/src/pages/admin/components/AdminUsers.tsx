import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ChevronLeft, ChevronRight, Send, ShieldAlert, Ban, ChevronDown, ChevronUp } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { Link } from "wouter";
import { AdminOverviewStats } from "./AdminOverviewStats";

export default function AdminUsers({ token, toast, currentUser }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [users, setUsers] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [noticeUser, setNoticeUser] = useState<any | null>(null);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [clusters, setClusters] = useState<any[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [banningCluster, setBanningCluster] = useState<string | null>(null);
  useEffect(() => { setLoading(true); void fetchAdmin(`/api/admin/users?page=${page}&limit=25`).then((d) => { setUsers(d.users ?? d); setTotalUsers(Number(d.total ?? d.users?.length ?? 0)); }).catch((err) => toast({ title: "Could not load users", description: err.message, variant: "destructive" })).finally(() => setLoading(false)); }, [fetchAdmin, toast, page]);
  useEffect(() => { setClustersLoading(true); void fetchAdmin("/api/admin/suspicious-clusters").then((d) => setClusters(d.clusters ?? [])).catch((err) => toast({ title: "Could not load suspicious clusters", description: err.message, variant: "destructive" })).finally(() => setClustersLoading(false)); }, [fetchAdmin, toast]);

  const banAll = async (cluster: any) => {
    const activeAccounts = cluster.accounts.filter((account: any) => !account.isBanned);
    if (!activeAccounts.length) return;
    setBanningCluster(cluster.id);
    try {
      await Promise.all(activeAccounts.map((account: any) => fetchAdmin(`/api/admin/users/${account.id}/ban`, { method: "POST" })));
      setClusters((current) => current.map((item) => item.id === cluster.id ? { ...item, accounts: item.accounts.map((account: any) => ({ ...account, isBanned: true })) } : item));
      toast({ title: "Cluster accounts banned", description: `${activeAccounts.length} account${activeAccounts.length === 1 ? "" : "s"} banned.` });
    } catch (err: any) {
      toast({ title: "Could not ban cluster", description: err.message, variant: "destructive" });
    } finally {
      setBanningCluster(null);
    }
  };
  const sendNotice = async () => {
    if (!noticeUser || !notice.trim()) return;
    setSending(true);
    try {
      await fetchAdmin(`/api/admin/users/${noticeUser.id}/notice`, { method: "POST", body: JSON.stringify({ message: notice.trim() }) });
      toast({ title: "Notice sent", description: `Delivered to ${noticeUser.displayName || noticeUser.username}.` });
      setNoticeUser(null);
      setNotice("");
    } catch (err: any) {
      toast({ title: "Could not send notice", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };
  const filtered = users.filter((u) => `${u.displayName} ${u.username} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
  const bannedVisible = users.filter((u) => u.isBanned).length;
  return <>
    <AdminOverviewStats items={[
      { label: "Total accounts", value: totalUsers, detail: "All non-deleted accounts" },
      { label: "Banned on this page", value: bannedVisible, detail: `Page ${page} · ${users.length} records loaded` },
      { label: "Flagged signup clusters", value: clusters.length, detail: "Shared signup IP hash signals" },
      { label: "Visible after search", value: filtered.length, detail: "Current page results" },
    ]} />
    <section className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" /><div><h2 className="text-sm font-semibold">Suspicious clusters</h2><p className="mt-1 text-xs text-muted-foreground">Three or more accounts sharing a signup IP hash within 24 hours.</p></div></div>
        <Badge variant="outline" className="border-amber-500/40">{clusters.length} flagged</Badge>
      </div>
      {clustersLoading ? <div className="h-16 animate-pulse rounded-lg bg-muted" /> : clusters.length === 0 ? <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No suspicious account clusters found.</p> : <div className="space-y-3">{clusters.map((cluster) => { const expanded = openCluster === cluster.id; return <div key={cluster.id} className="rounded-lg border border-border/70 bg-background"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold">{cluster.accountCount} accounts in one 24-hour window</p><p className="mt-1 text-xs text-muted-foreground">Started {new Date(cluster.firstCreatedAt).toLocaleString()}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setOpenCluster(expanded ? null : cluster.id)}>{expanded ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}Review individually</Button><Button variant="destructive" size="sm" disabled={banningCluster === cluster.id || cluster.accounts.every((account: any) => account.isBanned)} onClick={() => void banAll(cluster)}><Ban className="mr-1.5 h-4 w-4" />{banningCluster === cluster.id ? "Banning..." : "Ban all"}</Button></div></div>{expanded && <div className="border-t border-border/70 divide-y divide-border/60">{cluster.accounts.map((account: any) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium">{account.displayName || account.username}</p><p className="text-xs text-muted-foreground">@{account.username} · Joined {new Date(account.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-2">{account.usedReferralCode && <Badge variant="outline" className="text-[10px]">Referral used</Badge>}<Badge variant={account.isBanned ? "destructive" : "secondary"} className="text-[10px]">{account.isBanned ? "Banned" : "Active"}</Badge></div></div>)}</div>}</div>; })}</div>}
    </section>
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, handle, or email" className="pl-9" /></div>
        <p className="text-xs text-muted-foreground">{filtered.length} visible users</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_120px] gap-4 border-b border-border/70 bg-muted/30 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid"><span>User</span><span>Role</span><span>Status</span><span>Action</span></div>
        {loading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((row) => <div key={row} className="h-12 animate-pulse rounded bg-muted" />)}</div> : filtered.length === 0 ? <div className="p-12 text-center"><p className="text-sm font-medium">No users found</p><p className="mt-1 text-xs text-muted-foreground">Try a different search.</p></div> : <div className="divide-y divide-border/60">{filtered.map((u) => <div key={u.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_100px_100px_120px] sm:items-center"><Link href={`/profile/${encodeURIComponent(u.username)}`} target="_blank" rel="noreferrer" aria-label={`Open ${u.displayName || u.username}'s profile in a new tab`} className="flex min-w-0 items-center gap-3 hover:underline"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{u.displayName?.[0] ?? u.username?.[0] ?? "?"}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{u.displayName || "Unnamed user"}</p><p className="truncate text-xs text-muted-foreground">@{u.username} · {u.email}</p></div></Link><Badge variant="outline" className="w-fit text-[10px] capitalize">{u.role}</Badge><Badge variant={u.isBanned ? "destructive" : "secondary"} className="w-fit text-[10px]">{u.isBanned ? "Banned" : "Active"}</Badge>{currentUser.role === "super_admin" && <Button variant="outline" size="sm" className="w-fit" onClick={() => setNoticeUser(u)}><Send className="mr-1.5 h-3.5 w-3.5" />Send Notice</Button>}</div>)}</div>}
      </div>
      <div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><span className="text-xs text-muted-foreground">Page {page}</span><Button variant="outline" size="sm" disabled={users.length < 25} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
    </section>
    {currentUser.role === "super_admin" && <Dialog open={!!noticeUser} onOpenChange={(open) => { if (!open) { setNoticeUser(null); setNotice(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Send official notice</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">This will notify {noticeUser?.displayName || noticeUser?.username} in QuillHive and by email.</p>
        <Textarea value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="Write your message..." maxLength={5000} rows={5} />
        <DialogFooter><Button variant="outline" onClick={() => setNoticeUser(null)}>Cancel</Button><Button onClick={() => void sendNotice()} disabled={sending || !notice.trim()}><Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Send"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </>;
}