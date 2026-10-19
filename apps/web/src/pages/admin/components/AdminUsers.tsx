import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ChevronLeft, ChevronRight, Send, ShieldAlert, Ban, ChevronDown, ChevronUp, Eye, RotateCcw } from "lucide-react";
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
  const [restrictingUser, setRestrictingUser] = useState<any | null>(null);
  const [restrictionDays, setRestrictionDays] = useState<1 | 7 | 30>(7);
  const [restrictionReason, setRestrictionReason] = useState("");
  const [submittingRestriction, setSubmittingRestriction] = useState(false);
  const [userDetail, setUserDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [clusters, setClusters] = useState<any[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [banningCluster, setBanningCluster] = useState<string | null>(null);
  const [changingBanId, setChangingBanId] = useState<number | null>(null);
  const [revivingId, setRevivingId] = useState<number | null>(null);
  const [showDeletedAccounts, setShowDeletedAccounts] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const query = search.trim();
      const queryParam = query.length >= 2 ? `&q=${encodeURIComponent(query)}` : "";
      const deletedParam = showDeletedAccounts ? "&deleted=true" : "";
      void fetchAdmin(`/api/admin/users?page=${page}&limit=25${queryParam}${deletedParam}`)
        .then((data) => {
          if (!active) return;
          setUsers(data.users ?? data);
          setTotalUsers(Number(data.total ?? data.users?.length ?? 0));
        })
        .catch((error) => {
          if (active) toast({ title: "Could not load users", description: error.message, variant: "destructive" });
        })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [fetchAdmin, toast, page, search, showDeletedAccounts]);
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
  const toggleBan = async (account: any) => {
    const nextBanned = !account.isBanned;
    const action = nextBanned ? "suspend" : "restore";
    if (!window.confirm(`${nextBanned ? "Suspend" : "Restore"} @${account.username}?`)) return;
    setChangingBanId(account.id);
    try {
      const result = await fetchAdmin(`/api/admin/users/${account.id}/ban`, { method: "POST" });
      setUsers((current) => current.map((user) => user.id === account.id ? {
        ...user,
        isBanned: Boolean(result.isBanned),
        bannedAt: result.isBanned ? new Date().toISOString() : null,
        bannedUntil: null,
        banReason: null,
      } : user));
      setClusters((current) => current.map((cluster) => ({
        ...cluster,
        accounts: cluster.accounts.map((user: any) => user.id === account.id ? { ...user, isBanned: Boolean(result.isBanned) } : user),
      })));
      toast({ title: result.isBanned ? "Account suspended" : "Account restored", description: `@${account.username} can ${result.isBanned ? "no longer" : "now"} sign in.` });
    } catch (error) {
      toast({ title: `Could not ${action} account`, description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setChangingBanId(null);
    }
  };
  const temporarilyRestrictUser = async () => {
    if (!restrictingUser || restrictionReason.trim().length < 10) return;
    setSubmittingRestriction(true);
    try {
      const result = await fetchAdmin(`/api/admin/users/${restrictingUser.id}/temporary-restriction`, {
        method: "POST",
        body: JSON.stringify({ durationDays: restrictionDays, reason: restrictionReason.trim() }),
      });
      setUsers((current) => current.map((user) => user.id === restrictingUser.id ? { ...user, ...result } : user));
      setClusters((current) => current.map((cluster) => ({
        ...cluster,
        accounts: cluster.accounts.map((user: any) => user.id === restrictingUser.id ? { ...user, isBanned: true } : user),
      })));
      toast({
        title: "Temporary restriction applied",
        description: `@${restrictingUser.username} cannot sign in until ${new Date(result.bannedUntil).toLocaleString()}.`,
      });
      setRestrictingUser(null);
      setRestrictionReason("");
    } catch (error) {
      toast({ title: "Could not restrict account", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setSubmittingRestriction(false);
    }
  };
  const reviveAccount = async (account: any) => {
    if (currentUser.role !== "super_admin" || !account.isDeleted) return;
    const confirmed = window.confirm(
      `Revive @${account.username}? Their saved profile and follower relationships will return, and trust starts over. Permanently deleted posts, Sparks, polls, opportunities, and applications will not return. They will need to reset their password.`
    );
    if (!confirmed) return;
    setRevivingId(account.id);
    try {
      await fetchAdmin(`/api/admin/users/${account.id}/revive`, { method: "POST" });
      setUsers((current) => current.filter((user) => user.id !== account.id));
      setTotalUsers((current) => Math.max(0, current - 1));
      if (userDetail?.user?.id === account.id) setUserDetail(null);
      toast({ title: "Account revived", description: `@${account.username} can reset their password using their original email.` });
    } catch (error) {
      toast({ title: "Could not revive account", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setRevivingId(null);
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
  const openUserDetail = async (user: any) => {
    setUserDetail({ user });
    setDetailLoading(true);
    try {
      setUserDetail(await fetchAdmin(`/api/admin/users/${user.id}/detail`));
    } catch (error) {
      setUserDetail(null);
      toast({ title: "Could not load user details", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };
  const filtered = users;
  const bannedVisible = users.filter((u) => u.isBanned).length;
  return <>
    <AdminOverviewStats items={[
      { label: "Total accounts", value: totalUsers, detail: showDeletedAccounts ? "Deleted-account tombstones" : "All non-deleted accounts" },
      { label: "Banned on this page", value: bannedVisible, detail: `Page ${page} · ${users.length} records loaded` },
      { label: "Flagged signup clusters", value: clusters.length, detail: "Shared signup IP hash signals" },
      { label: "Matching accounts", value: totalUsers, detail: search.trim().length >= 2 ? "Across all accounts" : "Current directory" },
    ]} />
    <section className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" /><div><h2 className="text-sm font-semibold">Suspicious clusters</h2><p className="mt-1 text-xs text-muted-foreground">Three or more accounts sharing a signup IP hash within 24 hours.</p></div></div>
        <Badge variant="outline" className="border-amber-500/40">{clusters.length} flagged</Badge>
      </div>
      {clustersLoading ? <div className="h-16 animate-pulse rounded-lg bg-muted" /> : clusters.length === 0 ? <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No suspicious account clusters found.</p> : <div className="space-y-3">{clusters.map((cluster) => { const expanded = openCluster === cluster.id; return <div key={cluster.id} className="rounded-lg border border-border/70 bg-background"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold">{cluster.accountCount} accounts in one 24-hour window</p><p className="mt-1 text-xs text-muted-foreground">Started <Timestamp value={cluster.firstCreatedAt} mode="datetime" /></p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setOpenCluster(expanded ? null : cluster.id)}>{expanded ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}Review individually</Button><Button variant="destructive" size="sm" disabled={banningCluster === cluster.id || cluster.accounts.every((account: any) => account.isBanned)} onClick={() => void banAll(cluster)}><Ban className="mr-1.5 h-4 w-4" />{banningCluster === cluster.id ? "Banning..." : "Ban all"}</Button></div></div>{expanded && <div className="border-t border-border/70 divide-y divide-border/60">{cluster.accounts.map((account: any) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-medium">{account.displayName || account.username}</p><p className="text-xs text-muted-foreground">@{account.username}</p></div><div className="flex items-center gap-2">{account.usedReferralCode && <Badge variant="outline" className="text-[10px]">Referral used</Badge>}<Badge variant={account.isBanned ? "destructive" : "secondary"} className="text-[10px]">{account.isBanned ? "Banned" : "Active"}</Badge></div></div>)}</div>}</div>; })}</div>}
    </section>
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search username or email across accounts" className="pl-9" /></div>
        <div className="flex items-center gap-3">
          {currentUser.role === "super_admin" && (
            <Button variant="outline" size="sm" onClick={() => { setShowDeletedAccounts((value) => !value); setPage(1); }}>
              {showDeletedAccounts ? "Show active accounts" : "Deleted accounts"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{totalUsers.toLocaleString()} {showDeletedAccounts ? "deleted accounts" : "matching accounts"}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1fr)_130px_100px_100px_310px] gap-4 border-b border-border/70 bg-muted/30 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid"><span>User</span><span>Trust score</span><span>Role</span><span>Status</span><span>Actions</span></div>
        {loading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((row) => <div key={row} className="h-12 animate-pulse rounded bg-muted" />)}</div> : filtered.length === 0 ? <div className="p-12 text-center"><p className="text-sm font-medium">No users found</p><p className="mt-1 text-xs text-muted-foreground">Try a different search.</p></div> : <div className="divide-y divide-border/60">{filtered.map((u) => { const protectedAccount = u.id === currentUser.id || u.role === "super_admin" || (u.role === "admin" && currentUser.role !== "super_admin"); const userContent = <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{u.displayName?.[0] ?? u.username?.[0] ?? "?"}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{u.displayName || "Unnamed user"}{u.isOfficialAccount && <Badge variant="secondary" className="ml-2 text-[9px]">Official</Badge>}</p><p className="truncate text-xs text-muted-foreground">@{u.username} · {u.email}</p></div></div>; return <div key={u.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_130px_100px_100px_310px] sm:items-center">{u.isDeleted ? <div className="min-w-0">{userContent}<p className="mt-1 pl-12 text-[10px] text-muted-foreground">Deleted <Timestamp value={u.deletedAt} mode="datetime" /></p></div> : <Link href={`/profile/${encodeURIComponent(u.username)}`} target="_blank" rel="noreferrer" aria-label={`Open ${u.displayName || u.username}'s profile in a new tab`} className="hover:underline">{userContent}</Link>}<div><p className="text-sm font-semibold tabular-nums">{Math.round(Number(u.uti) || 0)} / 100</p><p className="text-[10px] capitalize text-muted-foreground">{String(u.creatorLevel || "new_voice").replace(/_/g, " ")}</p></div><Badge variant="outline" className="w-fit text-[10px] capitalize">{u.role}</Badge><div><Badge variant={u.isDeleted ? "outline" : u.isBanned ? "destructive" : "secondary"} className="w-fit text-[10px]">{u.isDeleted ? "Deleted" : u.isBanned && u.bannedUntil ? "Temporarily restricted" : u.isBanned ? "Banned" : "Active"}</Badge>{u.isBanned && u.bannedUntil && <p className="mt-1 text-[10px] text-muted-foreground">Until <Timestamp value={u.bannedUntil} mode="datetime" /></p>}</div><div className="flex flex-wrap gap-1"><Button variant="outline" size="sm" className="h-8" onClick={() => void openUserDetail(u)}><Eye className="mr-1 h-3.5 w-3.5" />Details</Button>{u.isDeleted && currentUser.role === "super_admin" ? <Button variant="outline" size="sm" className="h-8" disabled={revivingId === u.id} onClick={() => void reviveAccount(u)}><RotateCcw className="mr-1 h-3.5 w-3.5" />{revivingId === u.id ? "Reviving..." : "Revive"}</Button> : !protectedAccount && <>{u.isBanned ? <Button variant="outline" size="sm" className="h-8" disabled={changingBanId === u.id} onClick={() => void toggleBan(u)}><Ban className="mr-1 h-3.5 w-3.5" />{changingBanId === u.id ? "Working…" : "Restore"}</Button> : <><Button variant="destructive" size="sm" className="h-8" disabled={changingBanId === u.id} onClick={() => void toggleBan(u)}><Ban className="mr-1 h-3.5 w-3.5" />Ban indefinitely</Button><Button variant="outline" size="sm" className="h-8" onClick={() => { setRestrictionDays(7); setRestrictionReason(""); setRestrictingUser(u); }}>Restrict</Button></>}</>}{currentUser.role === "super_admin" && !u.isDeleted && <Button variant="outline" size="sm" className="h-8" onClick={() => setNoticeUser(u)}><Send className="mr-1 h-3.5 w-3.5" />Notice</Button>}</div></div>; })}</div>}
      </div>
      <div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><span className="text-xs text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(totalUsers / 25))}</span><Button variant="outline" size="sm" disabled={page * 25 >= totalUsers || loading} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
    </section>
    {currentUser.role === "super_admin" && <Dialog open={!!noticeUser} onOpenChange={(open) => { if (!open) { setNoticeUser(null); setNotice(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Send official notice</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">This will notify {noticeUser?.displayName || noticeUser?.username} in QuillHive and by email.</p>
        <Textarea value={notice} onChange={(event) => setNotice(event.target.value)} placeholder="Write your message..." maxLength={5000} rows={5} />
        <DialogFooter><Button variant="outline" onClick={() => setNoticeUser(null)}>Cancel</Button><Button onClick={() => void sendNotice()} disabled={sending || !notice.trim()}><Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Send"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
    <Dialog open={!!restrictingUser} onOpenChange={(open) => { if (!open && !submittingRestriction) setRestrictingUser(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Temporarily restrict account</DialogTitle>
          <DialogDescription>
            @{restrictingUser?.username} will be signed out and unable to sign in until the restriction expires. They will see the reason and expiry when they try to sign in.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-sm font-medium">
          Duration
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={restrictionDays}
            onChange={(event) => setRestrictionDays(Number(event.target.value) as 1 | 7 | 30)}
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Reason (shown to the user)
          <Textarea value={restrictionReason} onChange={(event) => setRestrictionReason(event.target.value)} minLength={10} maxLength={1000} rows={4} />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRestrictingUser(null)} disabled={submittingRestriction}>Cancel</Button>
          <Button variant="destructive" onClick={() => void temporarilyRestrictUser()} disabled={submittingRestriction || restrictionReason.trim().length < 10}>
            {submittingRestriction ? "Applying…" : "Apply restriction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!userDetail} onOpenChange={(open) => { if (!open) setUserDetail(null); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{userDetail?.user?.displayName || userDetail?.user?.username || "User details"}</DialogTitle>
          <DialogDescription>{userDetail?.user?.isDeleted ? "Deleted-account tombstone. Profile and relationships are retained for account revival; deleted content and direct messages are not included here." : "Trust and moderation record. Direct messages are not included."}</DialogDescription>
        </DialogHeader>
        {detailLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading account details…</p> : userDetail && <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div><p className="text-xs text-muted-foreground">Trust score</p><p className="text-xl font-semibold tabular-nums">{Math.round(userDetail.trustScore?.uti ?? 0)} / 100</p><p className="text-xs capitalize text-muted-foreground">{String(userDetail.trustScore?.creatorLevel || "new_voice").replace(/_/g, " ")}</p></div>
            {!userDetail.user.isDeleted && <a href={`/profile/${encodeURIComponent(userDetail.user.username)}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">Open profile</a>}
          </div>
          {userDetail.user.isBanned && <section className="space-y-1 rounded-lg border border-destructive/40 p-4">
            <h3 className="text-sm font-semibold">Account restriction</h3>
            <p className="text-xs text-muted-foreground">
              {userDetail.user.bannedUntil ? <>Until <Timestamp value={userDetail.user.bannedUntil} mode="datetime" /></> : "No expiry (permanent ban)"}
            </p>
            {userDetail.user.banReason && <p className="text-sm">{userDetail.user.banReason}</p>}
          </section>}
          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">{userDetail.user.isDeleted ? "Profile retained on the tombstone" : "Profile"}</h3>
            <p className="text-xs text-muted-foreground">@{userDetail.user.username} · {userDetail.user.email}</p>
            {userDetail.user.headline && <p className="text-sm">{userDetail.user.headline}</p>}
            {userDetail.user.bio && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{userDetail.user.bio}</p>}
            <p className="text-xs text-muted-foreground">
              {userDetail.user.followersCount} followers · {userDetail.user.followingCount} following
              {userDetail.user.isDeleted && userDetail.user.deletedAt && <> · Deleted <Timestamp value={userDetail.user.deletedAt} mode="datetime" /></>}
            </p>
            {userDetail.workHistory?.length > 0 && <p className="text-xs text-muted-foreground">Work history retained: {userDetail.workHistory.length} entries</p>}
            {userDetail.educationHistory?.length > 0 && <p className="text-xs text-muted-foreground">Education history retained: {userDetail.educationHistory.length} entries</p>}
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <section><h3 className="mb-2 text-sm font-semibold">Reports ({userDetail.reports?.length ?? 0})</h3><div className="max-h-52 space-y-2 overflow-y-auto">{userDetail.reports?.map((report: any) => <article key={report.id} className="rounded-md bg-muted/30 p-3"><p className="text-sm">{report.reason}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{report.targetType} · {report.status} · <Timestamp value={report.createdAt} mode="datetime" /></p>{report.targetType === "post" && <a href={`/post/${report.targetId}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">Open reported post</a>}</article>)}</div></section>
            <section><h3 className="mb-2 text-sm font-semibold">Strikes ({userDetail.strikes?.length ?? 0})</h3><div className="max-h-52 space-y-2 overflow-y-auto">{userDetail.strikes?.map((strike: any) => <article key={strike.id} className="rounded-md bg-muted/30 p-3"><p className="text-sm">{strike.reason}</p><p className="mt-1 text-xs text-muted-foreground">Severity {strike.severity}/10 · <Timestamp value={strike.createdAt} mode="datetime" /></p></article>)}</div></section>
            <section className="sm:col-span-2"><h3 className="mb-2 text-sm font-semibold">Recent posts ({userDetail.recentPosts?.length ?? 0})</h3><div className="space-y-1">{userDetail.recentPosts?.map((post: any) => <a key={post.id} href={`/post/${post.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-md p-2 text-sm hover:bg-muted/40"><span className="truncate">{post.title || `${post.type} #${post.id}`}</span><span className="shrink-0 text-xs text-primary">Open post</span></a>)}</div></section>
          </div>
        </>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setUserDetail(null)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}