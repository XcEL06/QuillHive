import { useEffect, useState } from "react";
import { Check, Eye, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { Link } from "wouter";
import { safeHtml } from "@/lib/sanitize";
import { mediaUrl } from "@/lib/api";
import { AdminOverviewStats } from "./AdminOverviewStats";

export default function AdminRevenue({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPost, setPreviewPost] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const data = await fetchAdmin("/api/boost/admin"); setBoosts(Array.isArray(data?.requests) ? data.requests : []); }
    catch (err) { toast({ title: "Could not load boost requests", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [fetchAdmin]);
  const act = async (id: number, action: "approve" | "reject" | "revoke") => {
    try { await fetchAdmin(`/api/boost/${id}/${action}`, { method: "POST", body: JSON.stringify({}) }); await load(); }
    catch (err) { toast({ title: `Could not ${action} boost`, description: err instanceof Error ? err.message : "Request failed", variant: "destructive" }); }
  };
  const openPostPreview = async (postId: number) => {
    setPreviewLoading(true);
    setPreviewPost({ id: postId });
    try {
      setPreviewPost(await fetchAdmin(`/api/admin/posts/${postId}`));
    } catch (err) {
      setPreviewPost(null);
      toast({ title: "Could not load post", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };
  const previewAttachments = (() => {
    const raw = previewPost?.attachments;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
  })();
  const pendingBoosts = boosts.filter(boost => boost.status === "pending").length;
  const approvedBoosts = boosts.filter(boost => boost.status === "approved").length;
  const paidCents = boosts.reduce((total, boost) => total + (Number(boost.paidAmountCents) || 0), 0);

  return <>
    <AdminOverviewStats items={[
      { label: "Boost requests", value: boosts.length, detail: "Returned promotion records" },
      { label: "Awaiting review", value: pendingBoosts },
      { label: "Approved campaigns", value: approvedBoosts },
      { label: "Recorded boost payments", value: `$${(paidCents / 100).toFixed(2)}`, detail: "Sum of returned paid amounts" },
    ]} />
    <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
    <div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><h2 className="text-sm font-semibold">Boost requests</h2><button onClick={() => void load()} title="Refresh" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><RefreshCw className="h-4 w-4" /></button></div>
    {loading ? <p className="p-8 text-sm text-muted-foreground">Loading requests...</p> : boosts.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No boost requests.</p> : <div className="divide-y divide-border/60">{boosts.map((b) => <div key={b.id} className="px-5 py-4 text-sm">
      <div className="flex items-start justify-between gap-3"><Link href={b.postId ? `/post/${b.postId}` : b.authorUsername ? `/profile/${b.authorUsername}` : "/admin"} className="min-w-0 hover:underline"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">#{b.id} · {b.plan}</p><Badge variant={b.status === "pending" ? "secondary" : "outline"} className="text-[10px] capitalize">{b.status}</Badge></div><p className="mt-1 truncate text-muted-foreground">{b.postTitle ?? "Post unavailable"} · {b.authorDisplayName ?? b.authorUsername ?? "Creator unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">{b.paidAmountCents != null ? `$${(b.paidAmountCents / 100).toFixed(2)} paid` : "Payment pending"} · {new Date(b.createdAt).toLocaleDateString()}</p></Link>
      <div className="flex shrink-0 items-center gap-1">
        {b.postId && <button type="button" onClick={() => void openPostPreview(b.postId)} title="Preview post" aria-label={`Preview post ${b.postId}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>}
        {b.status === "pending" && <><button onClick={() => void act(b.id, "approve")} title="Approve" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"><Check className="h-4 w-4" /></button><button onClick={() => void act(b.id, "reject")} title="Reject" className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button></>}
      </div>
      {b.status === "approved" && <button onClick={() => void act(b.id, "revoke")} className="text-xs text-destructive hover:underline">Revoke</button>}</div>
    </div>)}</div>}
    </section>
    <Dialog open={!!previewPost} onOpenChange={(open) => { if (!open) setPreviewPost(null); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{previewPost?.title || `Post #${previewPost?.id ?? ""}`}</DialogTitle>
          <DialogDescription>
            {previewPost?.authorDisplayName || previewPost?.authorUsername || "Post preview"}
            {previewPost?.authorUsername ? ` · @${previewPost.authorUsername}` : ""}
          </DialogDescription>
        </DialogHeader>
        {previewLoading ? <p className="py-8 text-sm text-muted-foreground">Loading post…</p> : previewPost && (
          <div className="space-y-4">
            {previewPost.imageUrl && <img src={mediaUrl(previewPost.imageUrl)} alt="Post media" className="max-h-80 w-full rounded-lg object-contain bg-muted" />}
            {previewPost.excerpt && <p className="text-sm font-medium text-muted-foreground">{previewPost.excerpt}</p>}
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml(previewPost.content || "") }} />
            {previewAttachments.length > 0 && <div className="flex flex-wrap gap-2 border-t border-border pt-4">{previewAttachments.map((attachment: { url?: string; filename?: string; mimeType?: string }, index: number) => <a key={`${attachment.url}-${index}`} href={attachment.url ? mediaUrl(attachment.url) : undefined} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">{attachment.filename || attachment.mimeType || `Attachment ${index + 1}`}</a>)}</div>}
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