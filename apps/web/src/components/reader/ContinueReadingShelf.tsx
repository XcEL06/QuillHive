import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { BookOpen } from 'lucide-react';
import { Timestamp } from '@/lib/postTimestamp';
import { Skeleton } from '@/components/ui/skeleton';
import { getStoredToken } from '@/lib/api';

interface ProgressRow {
  id: number;
  postId: number;
  percent: number;
  lastReadAt: string;
}

interface PostMeta {
  id: number;
  title: string | null;
  excerpt: string | null;
  type: string;
  author: { username: string; displayName: string };
}

export function ContinueReadingShelf() {
  const [items, setItems] = useState<Array<{ progress: ProgressRow; post: PostMeta }>>([]);
  const [loading, setLoading] = useState(true);
  const token = getStoredToken();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/reading-progress', { headers });
        if (!res.ok) {
          setItems([]);
          return;
        }
        const rows = (await res.json()) as ProgressRow[];
        // Filter to in-progress only (1% ≤ p < 95%) and take top 6
        const inProgress = rows
          .filter((r) => r.percent >= 1 && r.percent < 95)
          .slice(0, 6);
        if (inProgress.length === 0) {
          if (!cancelled) setItems([]);
          return;
        }
        const fetched = await Promise.all(
          inProgress.map(async (r) => {
            try {
              const pr = await fetch(`/api/posts/${r.postId}`, { headers });
              if (!pr.ok) return null;
              const post = (await pr.json()) as PostMeta;
              return { progress: r, post };
            } catch {
              return null;
            }
          })
        );
        if (!cancelled) {
          setItems(fetched.filter((x): x is { progress: ProgressRow; post: PostMeta } => x !== null));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Continue reading</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 mb-6" data-testid="continue-reading-shelf">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Continue reading
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(({ progress, post }) => (
          <Link
            key={post.id}
            href={`/post/${post.id}#resume`}
            className="block rounded-xl border border-border/50 p-3 hover:border-primary/40 hover:shadow-sm transition-all"
            data-testid={`continue-reading-item-${post.id}`}
          >
            <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">
              {post.title || post.excerpt || 'Untitled'}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              by {post.author.displayName} · <Timestamp value={progress.lastReadAt} />
            </p>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{Math.round(progress.percent)}% read</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
