import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Similar = {
  postId: number;
  similarity: number;
  post: { id: number; title: string | null; slug: string | null; authorUsername: string | null; authorDisplayName: string | null } | null;
};
type Result = { status: "original" | "near_duplicate" | "duplicate" | "insufficient_text"; score: number; topSimilarity?: number; interpretation?: string; method?: string; similar: Similar[] };

export function OriginalityPanel({ postId }: { postId: number }) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);
    apiFetch(`/api/posts/${postId}/originality`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId]);

  if (loading) {
    return (
      <div className="mb-6 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-muted/40 text-muted-foreground border border-border/60">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking indexed text overlap…
      </div>
    );
  }
  if (error || !data) {
    return (
      <p role="status" className="mb-6 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        The text-overlap check is unavailable right now. No originality conclusion was reached.
      </p>
    );
  }
  if (data.status === "insufficient_text") {
    return (
      <p className="mb-6 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        There is not enough text to compare this post with indexed posts. No originality conclusion was reached.
      </p>
    );
  }

  const isOriginal = data.status === "original";
  const isDup = data.status === "duplicate";
  const Icon = isOriginal ? ShieldCheck : AlertTriangle;
  const label = isOriginal
    ? "No close indexed match"
    : isDup
      ? "Potential substantial text overlap"
      : "Potential text overlap";
  const tone = isOriginal
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    : isDup
      ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
      : "bg-amber-500/10 text-amber-600 border-amber-500/20";

  return (
    <div className={`mb-6 rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 font-medium text-sm">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
        <span className="ml-2 text-[11px] opacity-80">Top text overlap {((data.topSimilarity ?? 1 - data.score) * 100).toFixed(0)}%</span>
      </div>
      <p className="mt-2 text-xs opacity-80">
        {data.interpretation || "This compares phrases with indexed published posts; overlap can come from quotations, common phrases, or shared sources."}
        It is not an originality score or a plagiarism finding, and this result alone does not affect your trust score, feed ranking, or fees.
        {data.method ? ` Method: ${data.method}.` : ""}
      </p>
      {!isOriginal && data.similar.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-current/10 pt-3 text-xs">
          <p className="opacity-80">Potentially similar indexed posts (visible only to you, the author):</p>
          {data.similar.slice(0, 5).map((s) => (
            <div key={s.postId} className="flex items-center justify-between gap-3">
              <Link href={`/post/${s.postId}`} className="underline truncate">
                {s.post?.title || `Post #${s.postId}`}
                {s.post?.authorDisplayName ? ` - ${s.post.authorDisplayName}` : ""}
              </Link>
              <span className="opacity-70 shrink-0">{(s.similarity * 100).toFixed(0)}% overlap</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
