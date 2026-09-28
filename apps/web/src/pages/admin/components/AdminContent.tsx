import { useEffect, useState } from "react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Search, Zap } from "lucide-react";
import { Link } from "wouter";
import { safeHtml } from "@/lib/sanitize";
import { mediaUrl } from "@/lib/api";

export default function AdminContent({ token, toast, currentUser }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [posts, setPosts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [boostPost, setBoostPost] = useState<any | null>(null);
  const [previewPost, setPreviewPost] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [plan, setPlan] = useState<"starter" | "growth" | "spotlight">("starter");
  const [reason, setReason] = useState("");
  const [granting, setGranting] = useState(false);
  useEffect(() => { void Promise.all([fetchAdmin("/api/admin/posts?limit=100"), fetchAdmin("/api/admin/reports?limit=100")]).then(([p, r]) => { setPosts(p.posts ?? p); setReports(r.reports ?? r); }).catch((err) => toast({ title: "Could not load content", description: err.message, variant: "destructive" })); }, [fetchAdmin, toast]);
  const grantBoost = async () => {
    if (!boostPost) return;
    setGranting(true);
    try {
      await fetchAdmin(`/api/admin/posts/${boostPost.id}/grant-boost`, { method: "POST", body: JSON.stringify({ plan, reason: reason.trim() || undefined }) });
      toast({ title: "Boost granted", description: `${boostPost.title || "Post"} now has a free editorial boost.` });
      setBoostPost(null);
      setReason("");
    } catch (err: any) {
      toast({ title: "Could not grant boost", description: err.message, variant: "destructive" });
    } finally {
      setGranting(false);
    }
  };
  const openPostPreview = async (post: any) => {
    setPreviewPost(post);
    setPreviewLoading(true);
    try {
      setPreviewPost(await fetchAdmin(`/api/admin/posts/${post.id}`));
    } catch (err) {
      setPreviewPost(null);
      toast({ title: "Could not load post", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };
  const needle = search.toLowerCase();
  const canGrantBoost = currentUser.role === "admin" || currentUser.role === "super_admin";
  return <>
    <div className="space-y-4"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter posts and reports" className="pl-9" /></div><div className="grid gap-6 lg:grid-cols-2"><List title={`Posts (${posts.length})`} rows={posts.filter((p) => `${p.title} ${p.authorDisplayName} ${p.authorUsername}`.toLowerCase().includes(needle))} label={(p) => p.title || "(untitled)"} inspectLabel="View post" onInspect={(post) => void openPostPreview(post)} actionLabel={canGrantBoost ? "Grant Boost" : undefined} onAction={canGrantBoost ? (post) => setBoostPost(post) : undefined} /><List title={`Reports (${reports.length})`} rows={reports.filter((r) => `${r.reason} ${r.status}`.toLowerCase().includes(needle))} label={(r) => r.reason || r.category || "Reported item"} /></div></div>
    <Dialog open={!!boostPost} onOpenChange={(open) => { if (!open) { setBoostPost(null); setReason(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Grant Boost</DialogTitle><DialogDescription>Give this post a free editorial campaign. The creator will not be charged.</DialogDescription></DialogHeader>
        <p className="text-sm font-medium">{boostPost?.title || "Untitled post"}</p>
        <label className="space-y-2 text-sm font-medium">Plan<select value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="starter">Starter · 2 days</option><option value="growth">Growth · 7 days</option><option value="spotlight">Spotlight · 15 days</option></select></label>
        <label className="space-y-2 text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(optional)</span><Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} placeholder="Why was this post selected?" /></label>
        <DialogFooter><Button variant="outline" onClick={() => setBoostPost(null)}>Cancel</Button><Button onClick={() => void grantBoost()} disabled={granting}><Zap className="mr-2 h-4 w-4" />{granting ? "Granting..." : "Confirm Grant"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!previewPost} onOpenChange={(open) => { if (!open) setPreviewPost(null); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{previewPost?.title || `Post #${previewPost?.id ?? ""}`}</DialogTitle>
          <DialogDescription>
            {previewPost?.authorDisplayName || previewPost?.authorUsername || "Unknown creator"}
            {previewPost?.authorUsername ? ` · @${previewPost.authorUsername}` : ""}
            {previewPost ? ` · ${previewPost.isPublished ? "Published" : "Draft"}` : ""}
          </DialogDescription>
        </DialogHeader>
        {previewLoading ? <p className="py-8 text-sm text-muted-foreground">Loading post…</p> : previewPost && (
          <div className="space-y-4">
            {previewPost.imageUrl && <img src={mediaUrl(previewPost.imageUrl)} alt="Post media" className="max-h-80 w-full rounded-lg object-contain bg-muted" />}
            {previewPost.excerpt && <p className="text-sm font-medium text-muted-foreground">{previewPost.excerpt}</p>}
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml(previewPost.content || "") }} />
            {Array.isArray(previewPost.attachments) && previewPost.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {previewPost.attachments.map((attachment: { url?: string; filename?: string; mimeType?: string }, index: number) => (
                  <a key={`${attachment.url}-${index}`} href={attachment.url ? mediaUrl(attachment.url) : undefined} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                    {attachment.filename || attachment.mimeType || `Attachment ${index + 1}`}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {previewPost?.isPublished && <Button asChild variant="outline"><Link href={`/post/${previewPost.id}`}>Open post page</Link></Button>}
          <Button variant="outline" onClick={() => setPreviewPost(null)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
function List({ title, rows, label, actionLabel, onAction, inspectLabel, onInspect }: { title: string; rows: any[]; label: (row: any) => string; actionLabel?: string; onAction?: (row: any) => void; inspectLabel?: string; onInspect?: (row: any) => void }) {
  return <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"><div className="border-b border-border/70 px-5 py-4"><h2 className="text-sm font-semibold">{title}</h2></div><div className="divide-y divide-border/60">{rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Nothing needs attention here.</p> : rows.slice(0, 8).map((row) => { const href = row.targetType === "post" ? `/post/${row.targetId}` : row.targetType === "user" && row.target?.username ? `/profile/${row.target.username}` : `/post/${row.id}`; const status = row.status || (typeof row.isPublished === "boolean" ? row.isPublished ? "published" : "draft" : "published"); return <div key={row.id} className="flex items-center gap-3 px-5 py-3.5"><Link href={href} className="min-w-0 flex-1 hover:underline"><p className="truncate text-sm font-medium">{label(row)}</p><p className="truncate text-xs text-muted-foreground">{row.authorDisplayName || row.category || "Awaiting review"}</p></Link><Badge variant={status === "pending" || status === "draft" ? "secondary" : "outline"} className="text-[10px] capitalize">{status}</Badge>{inspectLabel && onInspect && <Button variant="ghost" size="sm" onClick={() => onInspect(row)} title={inspectLabel}><Eye className="h-4 w-4" /><span className="sr-only">{inspectLabel}</span></Button>}{actionLabel && onAction && <Button variant="outline" size="sm" onClick={() => onAction(row)}><Zap className="mr-1.5 h-3.5 w-3.5" />{actionLabel}</Button>}</div>; })}</div></section>;
}