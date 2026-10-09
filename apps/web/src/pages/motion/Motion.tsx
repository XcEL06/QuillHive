import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Film,
  Heart,
  MessageCircle,
  Play,
  Share2,
  Sparkles,
  Tag,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { Timestamp } from '@/lib/postTimestamp';

type MotionFeed = 'fresh' | 'trending' | 'following';

interface Attachment {
  url: string;
  mimeType?: string;
  filename?: string;
  size?: number;
  duration?: number;
}

interface MotionPost {
  id: number;
  title: string | null;
  content: string;
  excerpt: string | null;
  attachments: Attachment[] | string;
  imageUrl: string | null;
  tags: string[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewCount?: number;
  isLiked?: boolean;
  author: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified?: boolean;
    bio?: string | null;
  };
}

function parseAttachments(post: MotionPost): Attachment[] {
  if (Array.isArray(post.attachments)) return post.attachments;
  if (typeof post.attachments === 'string') {
    try {
      const parsed = JSON.parse(post.attachments);
      return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function pickVideoAttachment(post: MotionPost): Attachment | null {
  const list = parseAttachments(post);
  return (
    list.find((a) => a?.mimeType?.startsWith?.('video/')) ||
    list.find((a) => /\.(mp4|mov|webm|m4v|ogv)$/i.test(a?.url || '')) ||
    null
  );
}

function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function MotionShowcaseCard({
  post,
  onLike,
}: {
  post: MotionPost;
  onLike: (id: number) => void;
}) {
  const video = pickVideoAttachment(post);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const t = useT();

  if (!video) return null;

  const handlePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play()
        .then(() => {
          setIsPlaying(true);
          setHasStarted(true);
        })
        .catch(() => setIsPlaying(false));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const sizeLabel = formatBytes(video.size);
  const filenameLabel = video.filename || (video.url.split('/').pop() ?? null);

  const sourceMeta: string[] = [];
  if (filenameLabel) sourceMeta.push(filenameLabel);
  if (sizeLabel) sourceMeta.push(sizeLabel);
  if (video.mimeType) sourceMeta.push(video.mimeType.replace('video/', ''));

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          url: shareUrl,
          title: post.title || `Motion by ${post.author.displayName}`,
        })
        .catch(() => {
          navigator.clipboard?.writeText(shareUrl).catch(() => {});
        });
    } else {
      navigator.clipboard?.writeText(shareUrl).catch(() => {});
    }
  };

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
      data-testid={`motion-card-${post.id}`}
    >
      <div
        className="relative aspect-video w-full cursor-pointer bg-gradient-to-br from-muted to-muted/40"
        onClick={handlePlay}
      >
        <video
          ref={videoRef}
          src={video.url}
          poster={post.imageUrl || undefined}
          muted={muted}
          playsInline
          preload="metadata"
          controls={hasStarted && isPlaying}
          className="h-full w-full bg-black object-contain"
          data-testid={`video-${post.id}`}
          onPause={() => setIsPlaying(false)}
          onPlay={() => {
            setIsPlaying(true);
            setHasStarted(true);
          }}
          onEnded={() => setIsPlaying(false)}
        />

        {!isPlaying && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity group-hover:bg-black/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg backdrop-blur">
              <Play className="ml-1 h-7 w-7 fill-current" />
            </div>
          </div>
        )}

        {hasStarted && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMuted((m) => !m);
            }}
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            aria-label={muted ? t('motion.unmute', 'Unmute') : t('motion.mute', 'Mute')}
            data-testid={`mute-${post.id}`}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          {post.title ? (
            <Link href={`/post/${post.id}`}>
              <h3 className="font-serif text-lg font-bold leading-snug text-foreground transition-colors hover:text-primary">
                {post.title}
              </h3>
            </Link>
          ) : (
            <Link href={`/post/${post.id}`}>
              <h3 className="font-serif text-lg font-medium italic text-muted-foreground hover:text-primary">
                {t('motion.untitledMotion', 'Untitled motion')}
              </h3>
            </Link>
          )}
          {post.excerpt && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.author.username}`}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={post.author.avatarUrl || ''} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {post.author.displayName.substring(0, 2)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/profile/${post.author.username}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {post.author.displayName}
            </Link>
            <span className="text-xs text-muted-foreground">
              @{post.author.username} · <Timestamp value={post.createdAt} />
            </span>
          </div>
          <Link href={`/portfolio/${post.author.username}`}>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
              {t('motion.portfolio', 'Portfolio')}
            </Button>
          </Link>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.slice(0, 5).map((t) => (
              <Link key={t} href={`/topics/${t}`}>
                <Badge variant="secondary" className="cursor-pointer rounded-full text-xs">
                  #{t}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {sourceMeta.length > 0 && (
          <p className="truncate text-xs text-muted-foreground/70" title={sourceMeta.join(' · ')}>
            Source: {sourceMeta.join(' · ')}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1 border-t border-border/50 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-lg"
            onClick={() => onLike(post.id)}
            data-testid={`like-${post.id}`}
          >
            <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
            <span className="tabular-nums text-xs">{post.likeCount}</span>
          </Button>
          <Link href={`/post/${post.id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg">
              <MessageCircle className="h-4 w-4" />
              <span className="tabular-nums text-xs">{post.commentCount}</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 rounded-lg"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            <span className="text-xs">{t('common.share', 'Share')}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function Motion() {
  const { token, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const t = useT();
  const [feed, setFeed] = useState<MotionFeed>('fresh');
  const [posts, setPosts] = useState<MotionPost[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "24" });
    if (feed !== "fresh") params.set("feed", feed);
    const url = `/api/feed/motion?${params}`;
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = await res.json();
        const items: MotionPost[] = Array.isArray(data?.posts)
          ? data.posts
          : Array.isArray(data)
            ? data
            : [];
        const onlyVideos = items.filter((p) => !!pickVideoAttachment(p));
        if (!cancelled) {
          setPosts(onlyVideos);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPosts([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [feed, token]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      (p.tags || []).forEach((t) => {
        if (!t) return;
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [posts]);

  const visiblePosts = useMemo(() => {
    if (!activeTag) return posts;
    return posts.filter((p) => (p.tags || []).includes(activeTag));
  }, [posts, activeTag]);

  const featured = visiblePosts[0];
  const grid = visiblePosts.slice(featured ? 1 : 0);

  const featuredCreators = useMemo(() => {
    const seen = new Set<string>();
    const out: MotionPost['author'][] = [];
    for (const p of posts) {
      if (!seen.has(p.author.username)) {
        seen.add(p.author.username);
        out.push(p.author);
      }
      if (out.length >= 6) break;
    }
    return out;
  }, [posts]);

  const handleLike = async (postId: number) => {
    if (!isAuthenticated) {
      toast({ title: t('motion.signInToLike', 'Sign in to like this motion'), variant: 'destructive' });
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !p.isLiked,
              likeCount: p.likeCount + (p.isLiked ? -1 : 1),
            }
          : p,
      ),
    );
    try {
      await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      /* optimistic update only */
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-8 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                <Film className="h-3.5 w-3.5" />
                {t('motion.title', 'Motion Studio')}
              </div>
              <h1 className="font-serif text-3xl font-bold sm:text-4xl">
                {t('motion.subtitle', 'A creator-first motion showcase')}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {t('motion.description', 'Short films, animated essays, video portfolios, and visual storytelling - made by the QuillHive community. Discover work, credit the makers, follow what moves you.')}
              </p>
            </div>
            <Link href="/motion/upload">
              <Button className="gap-2 rounded-xl" data-testid="btn-upload-motion">
                <Upload className="h-4 w-4" />
                {t('motion.upload', 'Upload your motion')}
              </Button>
            </Link>
          </div>
        </header>

        {/* Feed switcher */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={feed} onValueChange={(v) => setFeed(v as MotionFeed)}>
            <TabsList>
              <TabsTrigger value="fresh" data-testid="tab-fresh">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {t('motion.fresh', 'Fresh')}
              </TabsTrigger>
              <TabsTrigger value="trending" data-testid="tab-trending">
                {t('motion.trending', 'Trending')}
              </TabsTrigger>
              <TabsTrigger value="following" data-testid="tab-following">
                {t('motion.following', 'Following')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {allTags.length > 0 && (
            <div className="flex max-w-full flex-wrap items-center gap-1.5 overflow-x-auto">
              <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Badge
                onClick={() => setActiveTag(null)}
                variant={activeTag === null ? 'default' : 'outline'}
                className="cursor-pointer rounded-full text-xs"
              >
                {t('motion.all', 'All')}
              </Badge>
              {allTags.map((t) => (
                <Badge
                  key={t}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                  variant={activeTag === t ? 'default' : 'outline'}
                  className="cursor-pointer rounded-full text-xs"
                  data-testid={`tag-${t}`}
                >
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
                ))}
              </div>
            ) : visiblePosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-16 text-center">
                <Film className="mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                <p className="text-base font-semibold">{t('motion.noMotionsYet', 'No motions to show yet')}</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {t('motion.noMotionsDesc', "When creators upload videos to QuillHive, they'll appear here as showcase cards - not addictive scrolls.")}
                </p>
                <Link href="/upload" className="mt-4">
                  <Button className="gap-2 rounded-xl">
                    <Upload className="h-4 w-4" />
                    {t('motion.beFirst', 'Be the first')}
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {featured && (
                  <div>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('motion.spotlight', 'Spotlight')}
                    </h2>
                    <MotionShowcaseCard post={featured} onLike={handleLike} />
                  </div>
                )}

                {grid.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('motion.moreFromStudio', 'More from the studio')}
                    </h2>
                    <div className="grid gap-6 sm:grid-cols-2">
                      {grid.map((p) => (
                        <MotionShowcaseCard key={p.id} post={p} onLike={handleLike} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">{t('motion.aboutTitle', 'About Motion Studio')}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('motion.aboutBody', "Motion Studio is QuillHive's creator-first video space. It's built for portfolios and storytelling - not endless scrolling. Every piece is presented with credit, context, and tags so creators get discovered for their craft.")}
              </p>
            </div>

            {featuredCreators.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold">{t('motion.featuredCreators', 'Featured creators')}</h3>
                <ul className="space-y-3">
                  {featuredCreators.map((author) => (
                    <li key={author.username}>
                      <Link
                        href={`/profile/${author.username}`}
                        className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={author.avatarUrl || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {author.displayName.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{author.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{author.username}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-accent/10 to-primary/10 p-5">
              <h3 className="mb-2 text-sm font-semibold">{t('motion.makeYourOwn', 'Make your own')}</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {t('motion.makeYourOwnBody', 'Share a short film, an animated piece, or a visual essay. Add a title, tags, and a short description so readers can find your work.')}
              </p>
              <Link href="/upload">
                <Button size="sm" className="w-full gap-1.5 rounded-xl">
                  <Upload className="h-3.5 w-3.5" /> {t('motion.uploadMotion', 'Upload motion')}
                </Button>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
