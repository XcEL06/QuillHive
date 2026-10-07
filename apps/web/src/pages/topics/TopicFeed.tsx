import { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/post/PostCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BookOpen, Check, ChevronLeft } from 'lucide-react';
import { getStoredToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';

export default function TopicFeed() {
  const [, params] = useRoute('/topics/:slug');
  const slug = params?.slug ?? '';
  const token = getStoredToken();
  const { toast } = useToast();
  const t = useT();

  const [topic, setTopic] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/feed/topic/${slug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async r => {
        if (!r.ok) throw new Error(`Could not load topic (${r.status})`);
        return r.json();
      })
      .then(data => {
        setTopic(data.topic ?? null);
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setIsFollowing(data.topic?.isFollowing ?? false);
      })
      .catch(error => toast({
        title: 'Could not load topic',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      }))
      .finally(() => setLoading(false));
  }, [slug, token, toast]);

  const handleToggleFollow = async () => {
    if (!topic) return;
    setIsToggling(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`/api/topics/${topic.id}/follow`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Follow update failed (${res.status})`);
      const refreshed = await fetch(`/api/feed/topic/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!refreshed.ok) throw new Error(`Could not refresh topic (${refreshed.status})`);
      const data = await refreshed.json();
      setTopic(data.topic ?? null);
      setIsFollowing(data.topic?.isFollowing ?? false);
      toast({ title: isFollowing ? t('topics.unfollowedTopic') : t('topics.followingTopic') });
    } catch (error) {
      toast({
        title: t('topics.followFailed'),
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      </AppLayout>
    );
  }

  if (!topic) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-muted-foreground">
          <p>{t('topics.notFound')}</p>
          <Link href="/explore" className="text-primary text-sm hover:underline mt-2 block">{t('topics.backToExplore')}</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 py-6 space-y-6">
        <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> {t('topics.backToExplore')}
        </Link>

        <div className="bg-card border border-border/60 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-serif font-bold text-foreground mb-1">{topic.name}</h1>
              {topic.description && (
                <p className="text-muted-foreground text-sm mb-3">{topic.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <strong className="text-foreground">{topic.followerCount?.toLocaleString() ?? 0}</strong> {t('topics.followers')}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <strong className="text-foreground">{topic.postCount?.toLocaleString() ?? 0}</strong> {t('topics.posts')}
                </span>
              </div>
            </div>
            <Button
              variant={isFollowing ? 'secondary' : 'default'}
              onClick={handleToggleFollow}
              disabled={isToggling}
              className="rounded-xl gap-2 flex-shrink-0"
            >
              {isFollowing ? <><Check className="w-4 h-4" /> {t('topics.following')}</> : t('topics.follow')}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {posts.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t('topics.noPostsTitle')}</p>
              <p className="text-sm mt-1">Be the first to write about <strong>{topic.name}</strong>!</p>
              <Link href="/write">
                <Button className="mt-4 rounded-xl">{t('topics.writePost')}</Button>
              </Link>
            </div>
          )}
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
