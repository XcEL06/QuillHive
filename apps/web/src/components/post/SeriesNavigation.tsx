import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Library } from "lucide-react";
import { getStoredToken } from "@/lib/api";

interface SeriesNavData {
  series: { id: number; title: string } | null;
  position: number;
  total: number;
  prev: { id: number; title: string | null } | null;
  next: { id: number; title: string | null } | null;
}

interface SeriesNavigationProps {
  postId: number;
}

export function SeriesNavigation({ postId }: SeriesNavigationProps) {
  const [data, setData] = useState<SeriesNavData | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/posts/${postId}/series-nav`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return;
        const json = (await res.json()) as SeriesNavData;
        if (!aborted) setData(json);
      } catch { /* ignore */ }
    })();
    return () => { aborted = true; };
  }, [postId]);

  if (!data || !data.series) return null;

  return (
    <div className="my-6 border border-border rounded-2xl p-4 bg-muted/30" data-testid="series-navigation">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <Library className="w-3.5 h-3.5" />
        <Link href={`/series/${data.series.id}`} className="hover:underline font-medium">
          {data.series.title}
        </Link>
        <span>· Part {data.position} of {data.total}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.prev ? (
          <Link
            href={`/post/${data.prev.id}`}
            className="flex items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors text-left min-w-0"
            data-testid="link-series-prev"
          >
            <ChevronLeft className="w-4 h-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Previous</p>
              <p className="text-sm font-medium truncate">{data.prev.title || "Untitled"}</p>
            </div>
          </Link>
        ) : <div />}
        {data.next ? (
          <Link
            href={`/post/${data.next.id}`}
            className="flex items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors text-right min-w-0 justify-end"
            data-testid="link-series-next"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Next</p>
              <p className="text-sm font-medium truncate">{data.next.title || "Untitled"}</p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
