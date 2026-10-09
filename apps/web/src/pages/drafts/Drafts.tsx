import { useState, useEffect, useCallback } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, PenLine, Trash2, Clock, AlertCircle, RefreshCw,
  PlusCircle, BookOpen, Sparkles,
} from "lucide-react";
import { apiUrl, getStoredToken } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface Draft {
  id: number;
  title: string | null;
  type: string;
  content: string;
  updatedAt: string;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  article: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  story: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  novel: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  artwork: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  spark: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  blog: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  note: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function preview(content: string, len = 160): string {
  const stripped = content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > len ? stripped.slice(0, len) + "…" : stripped;
}

export default function Drafts() {
  const [, setLocation] = useLocation();
  const t = useT();
  const token = getStoredToken();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/posts/my-drafts"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load drafts");
      const data = await res.json();
      setDrafts(Array.isArray(data?.drafts) ? data.drafts : []);
    } catch {
      setError("Could not load your drafts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleResume = (draft: Draft) => {
    setLocation(`/write?draftId=${draft.id}`);
  };

  const handleDelete = (id: number) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return;
    setDrafts(prev => prev.filter(item => item.id !== id));
    const timeoutId = window.setTimeout(() => {
      void fetch(apiUrl(`/api/posts/draft/${id}`), {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((res) => {
        if (!res.ok) throw new Error();
      }).catch(() => {
        setDrafts(prev => [...prev, draft]);
        toast({ title: "Failed to delete draft", variant: "destructive" });
      });
    }, 5_000);
    toast({
      title: "Draft deleted",
      action: (
        <ToastAction altText="Undo draft deletion" onClick={() => {
          window.clearTimeout(timeoutId);
          setDrafts(prev => [...prev, draft]);
        }}>
          Undo
        </ToastAction>
      ),
    });
  };

  const handleNewDraft = () => setLocation("/write");

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 md:px-0 space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">My Drafts</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading…" : `${drafts.length} saved draft${drafts.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchDrafts} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={handleNewDraft} className="gap-2">
              <PlusCircle className="w-4 h-4" />
              New Draft
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={fetchDrafts}>Retry</Button>
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-5 w-5 rounded mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-16 w-full rounded-lg" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-28 rounded-lg" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary/60" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">No drafts yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Start writing and your work will auto-save here every 2 minutes. Pick up where you left off any time.
              </p>
            </div>
            <Button onClick={handleNewDraft} className="gap-2">
              <PenLine className="w-4 h-4" />
              Start writing
            </Button>
          </div>
        )}

        {/* Draft Cards */}
        {!loading && drafts.length > 0 && (
          <div className="space-y-4">
            {drafts.map(draft => {
              const isDel = deleting.has(draft.id);
              const confirmingDel = confirmDelete === draft.id;
              const typeColor = TYPE_COLORS[draft.type] ?? TYPE_COLORS.blog;
              const previewText = preview(draft.content);

              return (
                <div
                  key={draft.id}
                  className="group bg-card border border-border/50 hover:border-primary/30 rounded-2xl p-5 space-y-3 transition-all duration-200"
                >
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-foreground leading-snug truncate">
                        {draft.title?.trim() || <span className="italic text-muted-foreground">Untitled draft</span>}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <Timestamp value={draft.updatedAt} />
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs capitalize border ${typeColor}`}>
                      {draft.type}
                    </Badge>
                  </div>

                  {/* Preview */}
                  {previewText && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 pl-12">
                      {previewText}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pl-12">
                    <Button
                      size="sm"
                      onClick={() => handleResume(draft)}
                      className="gap-2"
                      disabled={isDel}
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      Resume editing
                    </Button>

                    {confirmingDel ? (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-xs text-destructive">Delete this draft?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(draft.id)}
                          disabled={isDel}
                          className="h-7 px-3 text-xs"
                        >
                          Yes, delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(null)}
                          className="h-7 px-3 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-muted-foreground hover:text-destructive gap-1.5"
                        onClick={() => handleDelete(draft.id)}
                        disabled={isDel}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info banner at bottom */}
        {!loading && drafts.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pt-2">
            Drafts auto-save every 2 minutes while you write. You can also save manually at any time.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
