import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/post/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Bookmark, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiUrl, getStoredToken } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function Saved() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const token = getStoredToken();
  const t = useT();

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    const fetchSaved = async () => {
      const requestId = ++latestRequest;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(apiUrl(`/api/users/me/saved?page=${page}&limit=20`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load saved posts');
        const nextPosts = Array.isArray(data.posts) ? data.posts : [];
        if (!active || requestId !== latestRequest) return;
        setPosts(nextPosts);
        setTotal(Number(data.total) || 0);
        setHasMore(Boolean(data.hasMore));
        if (nextPosts.length === 0 && page > 1) setPage(current => Math.max(1, current - 1));
      } catch {
        if (!active || requestId !== latestRequest) return;
        setPosts([]);
        setError('Could not load saved posts. Please try again.');
      } finally {
        if (active && requestId === latestRequest) setLoading(false);
      }
    };
    void fetchSaved();
    const refreshSaved = () => void fetchSaved();
    window.addEventListener('quillhive:saved-changed', refreshSaved);
    return () => {
      active = false;
      window.removeEventListener('quillhive:saved-changed', refreshSaved);
    };
  }, [page, token]);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 md:px-0 space-y-6">
        <div className="flex items-center gap-3 pt-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bookmark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">{t('saved.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('saved.subtitle')} {total > 0 ? `· ${total}` : ''}</p>
          </div>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-1">{error || t('saved.noPostsTitle')}</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              {error ? 'Refresh the page and try again.' : t('saved.noPostsDesc')}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {!loading && posts.length > 0 && (page > 1 || hasMore) && (
          <div className="flex items-center justify-center gap-3 pb-8">
            <button
              type="button"
              onClick={() => setPage(value => Math.max(1, value - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <button
              type="button"
              onClick={() => setPage(value => value + 1)}
              disabled={!hasMore}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
