import { Fragment, useState, useEffect } from 'react';
import { useGetPosts } from '@workspace/api-client-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PostCard } from '@/components/post/PostCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { PenTool, UserPlus, BookOpen, Check, TrendingUp, Rocket, Sparkles, ArrowUpRight, BriefcaseBusiness, Users, Compass, Flame, Search, ShieldCheck, Feather } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { useSocketConnection } from '@/hooks/useSocket';
import { apiFetch, apiUrl, getApiErrorMessage, getStoredToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { reportCaughtError } from '@/lib/reportCaughtError';
import { StreakChip } from '@/components/profile/StreakWidget';
import { StoriesRow } from '@/components/sparks/StoriesRow';
import { StoryViewer } from '@/components/sparks/StoryViewer';
import { AdSlot, isAdSenseConfigured } from '@/components/ads/AdSlot';
import { getFeedAdPlacementPostIds } from '@/components/ads/feedAdPlacements';
import { useFeature } from '@/lib/features';

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  href?: string;
}

type FeedSource = 'explore' | 'following';
type FeedAlgorithm = 'algorithmic' | 'chronological';
type FeedPost = import('@workspace/api-client-react').Post;

function normalizePostsResponse(value: unknown): FeedPost[] | null {
  if (Array.isArray(value)) return value as FeedPost[];
  if (value && typeof value === 'object' && 'posts' in value) {
    const posts = (value as { posts?: unknown }).posts;
    return Array.isArray(posts) ? posts as FeedPost[] : null;
  }
  return null;
}

interface SuggestedCreator {
  id?: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  headline?: string | null;
}

interface NewVoicePost {
  id: number;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  author?: {
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
  };
}

interface TopicItem {
  id: number;
  name: string;
  slug: string;
  postCount?: number;
  description?: string | null;
  emoji?: string | null;
}

function GettingStartedChecklist() {
  const { user } = useAuthStore();
  const t = useT();
  const STORAGE_KEY = `gh_checklist_dismissed_${user?.id}`;
  const [dismissed, setDismissed] = useState(() => typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1');

  const items: ChecklistItem[] = [
    { id: 'avatar', label: t('home.checklist.avatar'), done: !!user?.avatarUrl, href: '/settings' },
    { id: 'bio', label: t('home.checklist.bio'), done: !!user?.bio, href: '/settings' },
    { id: 'post', label: t('home.checklist.post'), done: (user?.postsCount ?? 0) > 0, href: '/write' },
    { id: 'follow', label: t('home.checklist.follow'), done: (user?.followingCount ?? 0) >= 3, href: '/explore' },
    { id: 'share', label: t('home.checklist.share'), done: (user?.postsCount ?? 0) > 0, href: `/profile/${user?.username}` },
  ];

  const doneCount = items.filter(i => i.done).length;
  if (dismissed || doneCount === items.length) return null;

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          {t('home.checklist.title')} ({doneCount}/{items.length})
        </h2>
        <button onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); setDismissed(true); }} className="text-xs text-muted-foreground hover:text-foreground">{t('home.checklist.dismiss')}</button>
      </div>
      <div className="w-full bg-border rounded-full h-1.5 mb-3">
        <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
      </div>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id}>
            <Link href={item.href ?? '#'} className={`flex items-center gap-2.5 text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-foreground hover:text-primary'}`}>
              <span className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${item.done ? 'bg-primary border-primary' : 'border-border'}`}>
                {item.done && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestedCreators() {
  const [creators, setCreators] = useState<SuggestedCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = getStoredToken();
  const t = useT();

  useEffect(() => {
    fetch('/api/users/recommended?limit=5', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => setCreators(Array.isArray(data) ? data : []))
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, []);

  const handleFollow = async (username: string, idx: number) => {
    try {
      await fetch(`/api/users/${username}/follow`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setCreators(c => c.filter((_, i) => i !== idx));
      toast({ title: t('home.followingUser', 'Following user!') });
    } catch {
      toast({ title: t('home.followFailed', 'Failed to follow'), variant: 'destructive' });
    }
  };

  if (!loading && creators.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-4 mb-6 rounded-2xl border border-dashed border-border bg-card">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3"><UserPlus className="w-5 h-5 text-muted-foreground" /></div>
        <p className="text-sm font-medium">Your network is waiting</p>
        <p className="text-xs text-muted-foreground mt-1">Explore creators and find voices worth following.</p>
        <Link href="/explore"><Button size="sm" className="mt-4 rounded-xl"><UserPlus className="w-4 h-4 mr-1.5" />Explore creators</Button></Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          {t('home.suggestedForYou')}
        </h2>
        <Link href="/explore" className="text-xs text-primary hover:underline">{t('home.seeAll')}</Link>
      </div>
      <div className="space-y-3">
        {loading && [1,2,3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
        {creators.map((creator, idx) => (
          <div key={creator.id} className="flex items-center gap-3">
            <Link href={`/profile/${creator.username}`}>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={creator.avatarUrl || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {creator.displayName?.substring(0, 2)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${creator.username}`}>
                <p className="font-medium text-xs text-foreground hover:text-primary truncate">{creator.displayName}</p>
              </Link>
              <p className="text-xs text-muted-foreground truncate">
                {creator.headline || `@${creator.username}`}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs rounded-lg flex-shrink-0"
              onClick={() => handleFollow(creator.username, idx)}
            >
              {t('home.follow')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewVoicesSection() {
  const [posts, setPosts] = useState<NewVoicePost[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getStoredToken();

  useEffect(() => {
    fetch('/api/new-voices?limit=8', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-4 mb-6 rounded-2xl border border-dashed border-border">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3"><Sparkles className="w-5 h-5 text-muted-foreground" /></div>
        <p className="text-sm font-medium">Fresh voices are on their way</p>
        <p className="text-xs text-muted-foreground mt-1">Explore the hive to discover more creators.</p>
        <Link href="/explore"><Button size="sm" variant="outline" className="mt-4 rounded-xl"><Sparkles className="w-4 h-4 mr-1.5" />Explore the hive</Button></Link>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          Fresh Voices
          <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20 text-[10px] font-semibold ml-0.5">
            New this month
          </Badge>
        </h2>
        <p className="text-xs text-muted-foreground">Discover creators just getting started</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {loading && [1, 2, 3, 4].map(i => (
          <div key={i} className="flex-shrink-0 w-52 bg-card border border-border/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}

        {posts.map(post => {
          const author = post.author ?? {};
          const initials = (author.displayName || author.username || '?').slice(0, 2).toUpperCase();
          const excerpt = post.excerpt || (post.content ? post.content.replace(/<[^>]*>/g, '').slice(0, 80) : '');

          return (
            <Link key={post.id} href={`/post/${post.id}`}>
              <div className="flex-shrink-0 w-52 bg-card border border-border/60 rounded-2xl p-4 space-y-2.5 hover:border-violet-500/40 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8 border border-border flex-shrink-0">
                    <AvatarImage src={author.avatarUrl || ''} />
                    <AvatarFallback className="bg-violet-500/10 text-violet-600 text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground group-hover:text-violet-600 transition-colors truncate">
                      {author.displayName || author.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">@{author.username}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-violet-600 transition-colors">
                  {post.title || 'Untitled'}
                </p>
                {excerpt && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{excerpt}</p>
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-violet-500/8 text-violet-600 dark:text-violet-400 border-violet-500/15">
                    ✨ New creator
                  </Badge>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TopicsPanel() {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getStoredToken();
  const t = useT();

  useEffect(() => {
    fetch('/api/topics', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(data => setTopics(Array.isArray(data) ? data : []))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          {t('home.browseTopics')}
        </h2>
        <Link href="/explore?tab=topics" className="text-xs text-primary hover:underline">{t('home.seeAll')}</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {topics.slice(0, 8).map((topic) => (
          <Link key={topic.id} href={`/topics/${topic.slug}`}>
            <div className="bg-card border border-border/60 rounded-xl p-3 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
              <span className="text-2xl mb-1 block">{topic.emoji || '📝'}</span>
              <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">{topic.name}</p>
              {topic.postCount != null && (
                <p className="text-xs text-muted-foreground mt-0.5">{topic.postCount} {t('home.posts')}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuthStore();

  if (!user) {
    const features = [
      { icon: ShieldCheck, label: 'Trust and growth score', text: 'See the signals behind your creator profile: consistency, engagement, and the work you are building over time.' },
      { icon: PenTool, label: 'Publish your thinking', text: 'Write posts, share sparks, and shape a public body of work that feels like more than a feed.' },
      { icon: Compass, label: 'Be easier to discover', text: 'Explore topics, follow new voices, and give thoughtful work a better chance to travel.' },
      { icon: BriefcaseBusiness, label: 'Turn proof into opportunity', text: 'Use your profile, portfolio, workspace, and collaboration tools to make your next brief easier to find.' },
      { icon: Flame, label: 'Keep your practice visible', text: 'Build a writing streak, collect milestones, and make showing up part of your creative rhythm.' },
    ];

    return (
      <PublicLayout>
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_8%,hsl(263_70%_41%_/_0.12),transparent_30%),linear-gradient(180deg,hsl(0_0%_100%_/_0.4),transparent_35%)]">
          <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
            <div className="grid lg:grid-cols-[1.04fr_.96fr] gap-14 lg:gap-20 items-center">
              <div className="relative z-10 landing-rise">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-7">
                  <span className="h-px w-8 bg-primary" /> For work still becoming
                </p>
                <h1 className="max-w-3xl text-5xl sm:text-6xl lg:text-7xl leading-[0.98] font-serif font-semibold tracking-[-0.04em] text-foreground">
                  Your voice deserves a place to <span className="text-primary italic">grow.</span>
                </h1>
                <p className="max-w-xl mt-7 text-lg leading-relaxed text-muted-foreground">
                  Your quill is your voice. Your hive is where it grows. Publish your ideas, make your progress visible, and find the people and opportunities that fit your work.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-9">
                  <Link href="/login?mode=register" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-transform">
                    Get started <ArrowUpRight className="w-4 h-4" />
                  </Link>
                  <Link href="/login" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-border bg-card/70 font-semibold hover:border-primary/50 transition-colors">
                    Log in
                  </Link>
                  <Link href="/explore" className="inline-flex items-center gap-2 px-5 py-3.5 text-primary font-semibold hover:gap-3 transition-all">
                    Explore <Compass className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="relative min-h-[410px] lg:min-h-[500px] landing-rise landing-rise-delay">
                <div className="absolute inset-4 sm:inset-8 rounded-[2rem] overflow-hidden bg-[#25133d] shadow-2xl shadow-primary/20">
                  <img src="/images/auth-bg.png" alt="Ink and paint texture" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a1028] via-[#33184d]/25 to-transparent" />
                  <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-white/80 text-xs uppercase tracking-[0.14em]">
                    <span>Field notes / 01</span><span>QuillHive</span>
                  </div>
                  <div className="absolute left-7 right-7 bottom-8 text-white">
                    <p className="text-sm text-white/70 mb-3">A home for essays, experiments, questions, and the work after the work.</p>
                    <p className="text-3xl sm:text-4xl font-serif leading-tight">Make something worth finding.</p>
                  </div>
                </div>
                <div className="absolute -left-1 sm:-left-5 top-12 bg-card border border-border/70 rounded-2xl p-4 shadow-xl max-w-[200px]">
                  <div className="flex items-center gap-2 text-primary mb-2"><Feather className="w-4 h-4" /><span className="text-xs font-semibold">Your body of work</span></div>
                  <p className="text-sm leading-relaxed text-muted-foreground">A profile that grows as you publish, connect, and keep going.</p>
                </div>
                <div className="absolute -right-1 sm:-right-5 bottom-12 bg-[#fff9ee] text-[#2d2117] border border-[#eadbc2] rounded-2xl p-4 shadow-xl max-w-[205px]">
                  <Search className="w-5 h-5 text-[#e58a32] mb-2" /><p className="text-sm font-medium leading-relaxed">Be found for the work you actually want to do.</p>
                </div>
              </div>
            </div>
          </section>

          <section id="why" className="border-y border-border/70 bg-card/50">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 lg:py-20 grid lg:grid-cols-[.8fr_1.2fr] gap-12 lg:gap-24 items-start">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary mb-3">Why QuillHive exists</p>
                <h2 className="text-3xl sm:text-4xl font-serif font-semibold leading-tight">The internet is full of noise. Your work needs a trail.</h2>
              </div>
              <div className="space-y-5 text-muted-foreground leading-relaxed">
                <p>Early work is easy to lose: a draft in one place, a project in another, a useful conversation disappearing under a scroll. QuillHive brings those pieces into a public, growing record.</p>
                <p>It is an early platform, still being shaped with the people who use it. There are no inflated numbers here. Just tools for publishing, discovery, trust, practice, and the next opportunity.</p>
              </div>
            </div>
          </section>

          <section id="features" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 lg:py-24">
            <div className="max-w-2xl mb-12">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">The working surface</p>
              <h2 className="text-3xl sm:text-4xl font-serif font-semibold">Small signals. A stronger creative identity.</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">QuillHive gives your practice somewhere to accumulate, so discovery is connected to what you make.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
              {features.map(({ icon: Icon, label, text }, index) => (
                <article key={label} className={`landing-rise landing-rise-delay-${Math.min(index + 1, 3)}`}>
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5"><Icon className="w-5 h-5" /></div>
                  <h3 className="text-xl font-serif font-semibold mb-2">{label}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="how-it-works" className="border-y border-border/70 bg-[#21112f] text-white">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 lg:py-24">
              <div className="max-w-2xl mb-12">
                <p className="text-xs uppercase tracking-[0.18em] text-violet-200 mb-3">How it works</p>
                <h2 className="text-3xl sm:text-4xl font-serif font-semibold">Start with one honest signal.</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-10 lg:gap-16">
                {[
                  { number: '01', title: 'Set your point of view', text: 'Create a profile that says what you care about, what you make, and where you are headed.' },
                  { number: '02', title: 'Publish and connect', text: 'Share posts and sparks, follow thoughtful voices, and take part in conversations around real interests.' },
                  { number: '03', title: 'Let the record compound', text: 'Keep publishing, use your workspace, and make it easier for the right people to discover your work.' },
                ].map(({ number, title, text }) => (
                  <div key={number} className="border-t border-white/20 pt-5">
                    <span className="text-sm font-mono text-violet-200">{number}</span>
                    <h3 className="text-xl font-serif font-semibold mt-5 mb-2">{title}</h3>
                    <p className="text-sm leading-relaxed text-white/65">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
            <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-amber-500/10 px-6 py-14 sm:px-12 sm:py-16 text-center">
              <div className="relative max-w-2xl mx-auto">
                <p className="text-xs uppercase tracking-[0.18em] text-primary mb-4">Make the first mark</p>
                <h2 className="text-4xl sm:text-5xl font-serif font-semibold leading-tight">Your next chapter can start small.</h2>
                <p className="mt-5 text-muted-foreground leading-relaxed">Bring one idea, one project, or one question. Give it a place to grow.</p>
                <div className="flex flex-wrap justify-center items-center gap-3 mt-8">
                  <Link href="/login?mode=register" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-transform">Get started <ArrowUpRight className="w-4 h-4" /></Link>
                  <Link href="/explore" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-border bg-card/70 font-semibold hover:border-primary/50 transition-colors">Explore first</Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </PublicLayout>
    );
  }

  return <AuthenticatedHome />;
}

function AuthenticatedHome() {
  const t = useT();
  const { token, user } = useAuthStore();
  const initialSource: FeedSource = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'following' || tab === 'explore') return tab;
    } catch { /* ignore */ }
    return 'explore';
  })();
  const [feedSource, setFeedSource] = useState<FeedSource>(initialSource);
  const adsFeatureEnabled = useFeature('ads_enabled');
  const showFeedAds = feedSource === 'explore' && adsFeatureEnabled && isAdSenseConfigured;
  const feedAlgorithm: FeedAlgorithm = 'algorithmic';
  const [feedPosts, setFeedPosts] = useState<import('@workspace/api-client-react').Post[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [activeStoryGroup, setActiveStoryGroup] = useState<any>(null);
  const [latestSeenTimestamp, setLatestSeenTimestamp] = useState<string | null>(null);
  const [newPostsAvailable, setNewPostsAvailable] = useState(0);

  useSocketConnection();

  const { data, isLoading, isError: error, refetch } = useGetPosts({
    feed: feedSource === 'following' ? 'following' : undefined,
    limit: 20,
  });

  const fetchAlgorithmicFeed = async (algo: FeedAlgorithm) => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const res = await apiFetch(`/api/feed?type=${algo}&limit=20`);
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Could not load the feed.'));
      const posts = normalizePostsResponse(await res.json());
      if (!posts) throw new Error('The feed returned an invalid response.');
      setFeedPosts(posts);
    } catch (error) {
      try {
        const res = await apiFetch('/api/posts?limit=20');
        if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Could not load posts.'));
        const posts = normalizePostsResponse(await res.json());
        if (!posts) throw new Error('Posts returned an invalid response.');
        setFeedPosts(posts);
      } catch (fallbackError) {
        setFeedPosts([]);
        const primaryMessage = error instanceof Error ? error.message : 'Could not load the feed.';
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Could not load posts.';
        setFeedError(`${primaryMessage} ${fallbackMessage}`);
      }
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (feedSource === 'explore') fetchAlgorithmicFeed('algorithmic');
  }, [feedSource, token]);

  const apiPosts = normalizePostsResponse(data) ?? [];
  const displayPosts =
    feedSource === 'explore' ? (feedPosts ?? apiPosts) : apiPosts;
  const adPlacementPostIds = showFeedAds
    ? getFeedAdPlacementPostIds(displayPosts)
    : new Set<number>();
  const isDisplayLoading =
    feedSource === 'explore' ? (feedLoading || (feedPosts === null && isLoading)) : isLoading;
  const feedLoadFailed = feedSource === 'explore' ? Boolean(feedError) : error;

  useEffect(() => {
    if (isDisplayLoading || latestSeenTimestamp) return;
    const newestPost = displayPosts.reduce<import('@workspace/api-client-react').Post | null>(
      (newest, post) => !newest || new Date(post.createdAt).getTime() > new Date(newest.createdAt).getTime() ? post : newest,
      null,
    );
    setLatestSeenTimestamp(newestPost?.createdAt ?? new Date().toISOString());
  }, [displayPosts, isDisplayLoading, latestSeenTimestamp]);

  useEffect(() => {
    if (!latestSeenTimestamp) return;
    const pollForNewPosts = async () => {
      try {
        const res = await fetch(apiUrl(`/api/feed?since=${encodeURIComponent(latestSeenTimestamp)}&limit=100`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json() as { posts?: unknown };
        setNewPostsAvailable(Array.isArray(data.posts) ? data.posts.length : 0);
      } catch (error) {
        console.error('[home] new-post polling failed', error);
        reportCaughtError(error, { action: 'poll_new_posts' });
      }
    };
    const interval = window.setInterval(() => void pollForNewPosts(), 30_000);
    return () => window.clearInterval(interval);
  }, [latestSeenTimestamp, token]);

  const handleSourceChange = (val: FeedSource) => {
    setFeedSource(val);
    setFeedPosts(null);
    setFeedError(null);
    setLatestSeenTimestamp(null);
    setNewPostsAvailable(0);
  };

  const handleRefreshFeed = async () => {
    setNewPostsAvailable(0);
    if (feedSource === 'explore') {
      await fetchAlgorithmicFeed(feedAlgorithm);
    } else {
      await refetch();
    }
    setLatestSeenTimestamp(null);
  };

  return (
    <>
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 max-w-2xl">
        <div className="flex flex-col gap-4 mb-6 pt-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
              <StreakChip />
            </h1>
            <Tabs value={feedSource} onValueChange={(v) => handleSourceChange(v as FeedSource)}>
              <TabsList className="flex gap-0.5 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="explore" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs shrink-0 px-2.5" data-testid="tab-explore">{t('home.tabs.explore')}</TabsTrigger>
                <TabsTrigger value="following" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs shrink-0 px-2.5" data-testid="tab-following">{t('home.tabs.following')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

        </div>

        {(feedSource === 'explore' || feedSource === 'following') && (
          <div className="sticky top-16 z-50 -mx-4 md:-mx-6 border-b border-border/50 bg-background/95 px-4 md:px-6 backdrop-blur">
            <StoriesRow onOpenViewer={setActiveStoryGroup} />
          </div>
        )}

        <div className="space-y-6">
          {newPostsAvailable > 0 && (
            <button
              type="button"
              onClick={() => void handleRefreshFeed()}
              className="sticky top-16 z-10 mx-auto block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
            >
              {newPostsAvailable} new post{newPostsAvailable > 1 ? 's' : ''} — tap to view
            </button>
          )}

          {isDisplayLoading && (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))
          )}

          {feedLoadFailed && !isDisplayLoading && (
            <div className="text-center py-12 text-destructive bg-destructive/10 rounded-2xl border border-destructive/20">
              <p>{feedError || t('home.failedToLoad', 'Failed to load feed. Please try again.')}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => void handleRefreshFeed()}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          )}

          {displayPosts.length === 0 && !isDisplayLoading && !feedLoadFailed && (
            <div className="text-center py-16 bg-muted/20 rounded-3xl border border-dashed border-border">
              <div className="bg-gradient-to-br from-primary/10 to-violet-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                {feedSource === 'following' ? <UserPlus className="w-8 h-8 text-primary" /> : <Rocket className="w-8 h-8 text-primary" />}
              </div>
              <h3 className="text-xl font-serif font-semibold mb-2">
                {feedSource === 'following' ? 'Welcome to QuillHive' : 'Be the first to share'}
              </h3>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm mb-5">
                {feedSource === 'following'
                  ? "Your quill is your voice. Your hive is where it grows. Follow people whose voices you value and start building your hive."
                  : 'The first posts here get the most visibility. Start your growth journey now.'}
              </p>
              <Link href={feedSource === 'following' ? '/explore' : '/write'}>
                <Button className="rounded-xl bg-gradient-to-r from-primary to-violet-500 border-0 text-white gap-2">
                  {feedSource === 'following' ? <><UserPlus className="w-4 h-4" /> Explore the hive</> : <><TrendingUp className="w-4 h-4" /> Post & Grow</>}
                </Button>
              </Link>
            </div>
          )}

          {displayPosts.map((post) => (
            <Fragment key={post.id}>
              <PostCard post={post} />
              {adPlacementPostIds.has(post.id) && (
                <AdSlot key={`home-explore-${post.id}`} placementId={`home-explore-${post.id}`} />
              )}
            </Fragment>
          ))}
        </div>
        </div>

        <aside className="hidden lg:block pt-4">
          <div className="sticky top-24">
            <GettingStartedChecklist />
            <SuggestedCreators />
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-violet-500/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t('home.whyQuillhive', 'Why QuillHive')}</p>
              <h2 className="mt-2 font-serif text-xl font-bold">{t('home.growWithYourVoice', 'Grow with your voice.')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('home.growWithYourVoiceDesc', 'Share meaningful work, meet collaborators, and turn consistent practice into real opportunities.')}</p>
              <Link href="/explore" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">{t('home.discoverCreators', 'Discover creators')} →</Link>
            </div>
          </div>
        </aside>
      </div>
      </div>
    </AppLayout>
    {activeStoryGroup && (
      <StoryViewer group={activeStoryGroup} onClose={() => setActiveStoryGroup(null)} />
    )}
    </>
  );
}
