import { useCallback, useEffect, useState } from 'react';
import { Archive as ArchiveIcon, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/post/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { apiUrl, getStoredToken } from '@/lib/api';

export default function Archive() {
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadArchivedPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getStoredToken();
      const response = await fetch(apiUrl(`/api/posts/archived?page=${page}&limit=20`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json() as { posts?: any[]; total?: number; hasMore?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not load archived posts.');
      const nextPosts = Array.isArray(result.posts) ? result.posts : [];
      setPosts(nextPosts);
      setTotal(Number(result.total) || 0);
      setHasMore(Boolean(result.hasMore));
      if (nextPosts.length === 0 && page > 1) setPage(current => Math.max(1, current - 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load archived posts.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadArchivedPosts();
    window.addEventListener('quillhive:post-archive-changed', loadArchivedPosts);
    return () => window.removeEventListener('quillhive:post-archive-changed', loadArchivedPosts);
  }, [loadArchivedPosts]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-5 md:px-0">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ArchiveIcon className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-serif font-bold">Your archive</h1>
            <p className="text-sm text-muted-foreground">Archived posts are only visible to you until you restore them.{total ? ` · ${total}` : ''}</p>
          </div>
        </header>

        {loading && <div className="space-y-4">{[0, 1, 2].map(item => <Skeleton key={item} className="h-48 rounded-2xl" />)}</div>}
        {!loading && error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive" role="alert">{error}</div>}
        {!loading && !error && posts.length === 0 && <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h2 className="font-semibold">Your archive is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">When you archive a post, it will be kept here until you restore or delete it.</p>
        </div>}
        {!loading && !error && <div className="space-y-4">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>}
        {!loading && !error && posts.length > 0 && (page > 1 || hasMore) && <nav className="flex items-center justify-center gap-3 pb-8" aria-label="Archived post pages">
          <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Previous</button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <button type="button" onClick={() => setPage(value => value + 1)} disabled={!hasMore} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-40">Next<ChevronRight className="h-4 w-4" /></button>
        </nav>}
      </div>
    </AppLayout>
  );
}
