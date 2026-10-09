import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { useGetPost, useGetPostComments, useCreateComment, useLikePost } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MentionInput } from '@/components/MentionInput';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Timestamp, formatPostTimestamp } from '@/lib/postTimestamp';
import { Heart, Send, Share2, MessageCircle, ChevronDown, ChevronRight, CornerDownRight, ShieldCheck, Clock, BarChart3, BadgeCheck, Award, BookOpen, Zap } from 'lucide-react';
import { BoostModal } from '@/components/boost/BoostModal';
import { safeHtml } from '@/lib/sanitize';
import { linkifyHashtags } from '@/lib/hashtags';
import { readingTimeLabel } from '@/lib/readingTime';
import { useToast } from '@/hooks/use-toast';
import { apiUrl, getStoredToken } from '@/lib/api';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { clsx } from 'clsx';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { ReadingProgressBar } from '@/components/post/ReadingProgressBar';
import { TableOfContents, buildToc } from '@/components/post/TableOfContents';
import { TranslateButton } from '@/components/post/TranslateButton';
import { ReaderModeToggle } from '@/components/post/ReaderModeToggle';
import { OriginalityPanel } from '@/components/post/OriginalityPanel';
import { ShareSheet } from '@/components/post/ShareSheet';
import { EditHistoryModal } from '@/components/post/EditHistoryModal';
import { useT } from '@/lib/i18n';
import { SeriesNavigation } from '@/components/post/SeriesNavigation';
import { PollBlock } from '@/components/post/PollBlock';
import { MoreLikeThis } from '@/components/post/MoreLikeThis';
import { ImageLightbox } from '@/components/post/ImageLightbox';
import { BackButton } from '@/components/ui/BackButton';
import { useRecordRead } from '@/hooks/useReadingStreak';
import { useFeature } from '@/lib/features';
import { PollComposer, type DraftPoll } from '@/components/post/PollComposer';
import { LiveReadCounter } from '@/components/post/LiveReadCounter';

const MAX_DEPTH = 3;

// ── CuratingExperts ───────────────────────────────────────────────────────────

interface CuratorEntry {
  id: number; username: string; displayName: string; avatarUrl?: string | null;
  tier?: string | null; creatorLevel?: string | null; uti?: number | null;
}

const LEVEL_LABELS: Record<string, string> = {
  luminary: 'Luminary', featured: 'Featured Voice', established: 'Certified Operator',
  rising: 'Proven Writer', new_voice: 'Aspiring',
};

function CuratingExperts({ postId }: { postId: number }) {
  const [curators, setCurators] = useState<CuratorEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [loaded, setLoaded]     = useState(false);
  const token = getStoredToken();

  useEffect(() => {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/posts/${postId}/curators`, { headers })
      .then(r => r.ok ? r.json() : { curators: [], total: 0 })
      .then((d: { curators?: CuratorEntry[]; total?: number }) => {
        setCurators(Array.isArray(d?.curators) ? d.curators : []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [postId]);

  if (!loaded || curators.length === 0) return null;

  return (
    <div className="mb-10 rounded-2xl border border-primary/15 bg-primary/[0.03] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Curating Experts</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {total > curators.length ? `${total} total curations · top verified shown` : `${total} curation${total !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {curators.map(c => (
          <Link
            key={c.id}
            href={`/profile/${c.username}`}
            className="flex items-center gap-2 rounded-xl bg-card border border-border/60 px-3 py-2 hover:border-primary/40 transition-colors group"
          >
            <Avatar className="h-7 w-7 shrink-0">
              {c.avatarUrl && <AvatarImage src={c.avatarUrl} />}
              <AvatarFallback className="text-[10px]">{(c.displayName || c.username).slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-none group-hover:text-primary transition-colors">{c.displayName}</p>
              {c.creatorLevel && LEVEL_LABELS[c.creatorLevel] && (
                <p className="text-[9px] text-muted-foreground mt-0.5">{LEVEL_LABELS[c.creatorLevel]}</p>
              )}
            </div>
            {c.tier === 'trusted' && <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />}
          </Link>
        ))}
      </div>
    </div>
  );
}

type CommentWithReplies = {
  id: number;
  content: string;
  author: { id: number; username: string; displayName: string; avatarUrl?: string | null; trustTier?: string };
  createdAt: string;
  depth?: number;
  likeCount?: number;
  replyCount?: number;
  parentCommentId?: number | null;
  replies?: CommentWithReplies[];
  trustTier?: string;
};

function CommentNode({
  comment,
  postId,
  depth = 0,
  onReplyPosted,
}: {
  comment: CommentWithReplies;
  postId: number;
  depth?: number;
  onReplyPosted: () => void;
}) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const token = getStoredToken();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likeCount ?? 0);
  const [showReplies, setShowReplies] = useState(depth < 2);
  const [replies, setReplies] = useState<CommentWithReplies[]>(
    Array.isArray(comment.replies) ? comment.replies : []
  );
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(Array.isArray(comment.replies));

  const loadReplies = async () => {
    if (repliesLoaded) { setShowReplies(true); return; }
    setLoadingReplies(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}/replies`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setReplies(Array.isArray(data) ? data : []);
      setRepliesLoaded(true);
      setShowReplies(true);
    } catch {
      toast({ title: 'Failed to load replies', variant: 'destructive' });
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleLike = async () => {
    try {
      const res = await fetch(`/api/comments/${comment.id}/like`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setLiked(data.liked ?? !liked);
      setLikeCount(data.likeCount ?? (liked ? likeCount - 1 : likeCount + 1));
    } catch {
      toast({ title: 'Failed to like comment', variant: 'destructive' });
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    if (!user) { toast({ title: 'Sign in to reply', variant: 'destructive' }); return; }
    setIsReplying(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: replyText }),
      });
      if (!res.ok) throw new Error('Failed');
      const newReply = await res.json();
      setReplies(r => [...r, newReply]);
      setRepliesLoaded(true);
      setShowReplies(true);
      setReplyText('');
      setShowReplyBox(false);
      onReplyPosted();
      toast({ title: 'Reply posted!' });
    } catch {
      toast({ title: 'Failed to post reply', variant: 'destructive' });
    } finally {
      setIsReplying(false);
    }
  };

  const indentClass = depth === 0 ? '' : depth === 1 ? 'ml-8' : 'ml-14';
  const hasReplies = (comment.replyCount ?? 0) > 0 || replies.length > 0;

  return (
    <div className={clsx(indentClass, depth > 0 && 'border-l-2 border-border/40 pl-4 mt-3')}>
      <div className="flex gap-3">
        <Link href={`/profile/${comment.author.username}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={comment.author.avatarUrl || ''} />
            <AvatarFallback className="text-xs">{comment.author.displayName.substring(0, 2)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <div className="bg-muted/30 border border-border/30 rounded-2xl rounded-tl-none p-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="flex items-center gap-1">
                <Link href={`/profile/${comment.author.username}`} className="font-semibold text-xs hover:underline">
                  {comment.author.displayName}
                </Link>
                {(comment.trustTier === 'trusted' || comment.author?.trustTier === 'trusted') && (
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                )}
              </span>
              <Timestamp value={comment.createdAt} className="text-xs text-muted-foreground" />
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
          </div>

          <div className="flex items-center gap-3 mt-1.5 ml-1">
            <button
              onClick={handleLike}
              className={clsx(
                'flex items-center gap-1 text-xs font-medium transition-colors',
                liked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500'
              )}
            >
              <Heart className={clsx('w-3.5 h-3.5', liked && 'fill-current')} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>

            {depth < MAX_DEPTH && (
              <button
                onClick={() => setShowReplyBox(s => !s)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <CornerDownRight className="w-3.5 h-3.5" /> Reply
              </button>
            )}

            {hasReplies && !showReplies && (
              <button
                onClick={loadReplies}
                disabled={loadingReplies}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                {loadingReplies ? 'Loading...' : `${comment.replyCount ?? replies.length} repl${(comment.replyCount ?? replies.length) === 1 ? 'y' : 'ies'}`}
              </button>
            )}

            {showReplies && replies.length > 0 && (
              <button
                onClick={() => setShowReplies(false)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" /> Collapse
              </button>
            )}
          </div>

          {showReplyBox && (
            <div className="mt-2 ml-1">
              <MentionInput
                placeholder={`Reply to ${comment.author.displayName}...`}
                value={replyText}
                onChange={setReplyText}
                className="text-sm min-h-[70px]"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => { setShowReplyBox(false); setReplyText(''); }} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || isReplying} className="rounded-xl text-xs gap-1">
                  <Send className="w-3 h-3" /> {isReplying ? 'Posting...' : 'Reply'}
                </Button>
              </div>
            </div>
          )}

          {showReplies && replies.map(reply => (
            <CommentNode
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
              onReplyPosted={onReplyPosted}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PostDetail() {
  const [, params] = useRoute('/post/:id');
  const postId = Number(params?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useT();
  const [historyOpen, setHistoryOpen] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [readerMode, setReaderMode] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [pollDraft, setPollDraft] = useState<DraftPoll | null>(null);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [cwAcknowledged, setCwAcknowledged] = useState(false);
  const { user } = useAuthStore();
  const aiToolsAvailable = useFeature('ai_tools_enabled') && (user?.role === 'admin' || user?.role === 'super_admin');

  const { data: post, isLoading: isLoadingPost } = useGetPost(postId);
  const progress = useReadingProgress(postId, { enabled: !!post });
  useRecordRead(post ? postId : null, !!user && !!post);
  const { data: comments, isLoading: isLoadingComments } = useGetPostComments(postId);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('stripe_session_id');
    if (!sessionId || !user) return;
    const token = getStoredToken();
    void fetch(apiUrl(`/api/boost/stripe/session/${encodeURIComponent(sessionId)}`), {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async response => {
        const data = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? 'Stripe payment verification failed');
        queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
        toast({ title: 'Your boost is live!' });
      })
      .catch(error => toast({ title: error instanceof Error ? error.message : 'Stripe payment verification failed', variant: 'destructive' }));
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
  }, [postId, queryClient, toast, user]);

  const { mutate: toggleLike } = useLikePost({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] }),
      onError: (error) => toast({
        title: 'Could not like post',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      }),
    }
  });

  const { mutate: submitComment, isPending: isCommenting } = useCreateComment({
    mutation: {
      onSuccess: () => {
        setCommentText('');
        queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}/comments`] });
        queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
        toast({ title: 'Comment posted!' });
      },
      onError: (error) => toast({
        title: 'Could not post comment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      }),
    }
  });

  const handleReplyPosted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/posts/${postId}`] });
  }, [postId, queryClient]);

  if (isLoadingPost) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-10 w-3/4" />
          <div className="flex gap-4"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-12 w-48" /></div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (!post) return <AppLayout><div className="text-center py-20 text-muted-foreground">Post not found</div></AppLayout>;

  const isOwner = user?.id === post.author.id;
  const sourceText = post.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
  const { html: contentHtml, headings } = buildToc(post.content || '');
  const displayHtml = linkifyHashtags(
    translated
      ? safeHtml(`<p>${translated.replace(/\n+/g, '</p><p>')}</p>`)
      : safeHtml(contentHtml),
  );

  const widthClass = readerMode ? 'max-w-2xl' : 'max-w-3xl';
  const fontClass = readerMode ? 'prose-xl' : 'prose-lg';
  const postType = String(post.type);
  const postTypeLabel = postType === 'spark' || postType === 'note'
    ? null
    : ({ artwork: 'Motion', blog: 'Article', article: 'Article', story: 'Story', poem: 'Story', novel: 'Story' } as Record<string, string>)[postType] ?? postType;

  async function createPoll() {
    if (!pollDraft || !pollDraft.question.trim()) return;
    const cleanOptions = pollDraft.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      toast({ title: 'Add at least 2 options', variant: 'destructive' });
      return;
    }
    try {
      await apiRequest('POST', '/api/polls', {
        postId,
        question: pollDraft.question.trim(),
        options: cleanOptions,
        allowMultiple: pollDraft.allowMultiple,
      });
      toast({ title: 'Poll added' });
      setShowPollDialog(false);
      setPollDraft(null);
      queryClient.invalidateQueries({ queryKey: ['/api/polls/post', postId] });
    } catch (err: any) {
      const msg = err?.message?.includes('409') ? 'This post already has a poll' : 'Could not create poll';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  return (
    <AppLayout>
      <ReadingProgressBar percent={progress} />
      <div className={`${widthClass} mx-auto px-4 md:px-0 pb-20 pt-6 transition-all`}>
        <BackButton />

        {/* Post Header */}
        <div className="mb-8">
          {postTypeLabel && (
            <Badge variant="outline" className="mb-4 capitalize bg-secondary text-secondary-foreground">
              {postTypeLabel}
            </Badge>
          )}
          {post.title && <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">{post.title}</h1>}

          <div className="flex items-center justify-between">
            <Link href={`/profile/${post.author.username}`} className="flex items-center gap-4 group">
              <Avatar className="h-12 w-12 border-2 border-transparent group-hover:border-primary transition-colors">
                <AvatarImage src={post.author.avatarUrl || ''} />
                <AvatarFallback>{post.author.displayName.substring(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                  {post.author.displayName}
                  {(post as any).authorIsOfficial && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center">
                          <BadgeCheck className="w-4 h-4 text-blue-500" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Official QuillHive Account</TooltipContent>
                    </Tooltip>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Timestamp value={post.createdAt} mode="date" />
                  {(post.updatedAt && post.updatedAt !== post.createdAt) || (post as { isEdited?: boolean }).isEdited ? (
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(true)}
                      className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      title={`Edited ${formatPostTimestamp(post.updatedAt || post.createdAt)?.title ?? ''}`}
                      data-testid="button-edit-history"
                    >
                      · {t('post.edited')}
                    </button>
                  ) : null}
                  {readingTimeLabel(post.content) && (
                    <span className="inline-flex items-center gap-1">
                      · <Clock className="w-3 h-3" /> {readingTimeLabel(post.content)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    · <LiveReadCounter postId={post.id} initialViews={(post as { viewCount?: number }).viewCount} />
                  </span>
                </p>
              </div>
            </Link>

            <div className="flex gap-2 items-center flex-wrap justify-end">
              <ReaderModeToggle active={readerMode} onToggle={() => setReaderMode((v) => !v)} />
              {aiToolsAvailable && <TranslateButton postId={post.id} sourceText={sourceText} onTranslated={setTranslated} />}
              {isOwner && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPollDialog(true)}
                    className="text-muted-foreground"
                    title="Add a poll"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowBoostModal(true)}
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    title="Boost this post"
                  >
                    <Zap className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button size="icon" variant="ghost" onClick={() => {
                if (!user) {
                  toast({ title: 'Sign in to like posts', variant: 'destructive' });
                  return;
                }
                toggleLike({ id: post.id });
              }} className={post.isLiked ? 'text-rose-500 hover:text-rose-600' : 'text-muted-foreground'}>
                <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} />
              </Button>
              <ShareSheet
                postId={post.id}
                title={post.title || undefined}
                trigger={
                  <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" data-testid="button-open-share-sheet">
                    <Share2 className="w-5 h-5" />
                  </Button>
                }
              />
              {user && isOwner && post.isPublished && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-amber-500"
                      onClick={() => setShowLibraryDialog(true)}
                      title="Add to Library"
                    >
                      <BookOpen className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add to Library</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {isOwner && <OriginalityPanel postId={post.id} />}

        {/* Content + TOC layout */}
        <div className={readerMode ? '' : 'xl:grid xl:grid-cols-[1fr_220px] xl:gap-10'}>
          <div>
            {post.imageUrl && (
              <div className="mb-10 rounded-2xl overflow-hidden border border-border shadow-sm">
                <ImageLightbox
                  src={post.imageUrl}
                  alt={post.title || 'Artwork'}
                  className="bg-muted/50"
                  imageClassName="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
            )}

            {(post as any).contentWarning && !cwAcknowledged ? (
              <div className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 text-center">
                <div className="text-amber-600 dark:text-amber-400 font-semibold mb-2">Content warning</div>
                <p className="text-sm text-foreground/80 mb-4">{(post as any).contentWarning}</p>
                <button
                  type="button"
                  onClick={() => setCwAcknowledged(true)}
                  data-testid="cw-acknowledge"
                  className="px-4 py-2 rounded-md border border-border bg-background hover:bg-muted text-sm font-medium"
                >
                  Show content
                </button>
              </div>
            ) : (
              <div
                className={`prose ${fontClass} dark:prose-invert prose-p:leading-relaxed prose-headings:font-serif max-w-none mb-8 text-foreground/90 scroll-smooth`}
                dangerouslySetInnerHTML={{ __html: displayHtml }}
              />
            )}
            {translated && (
              <p className="text-xs text-muted-foreground italic mb-8">
                Machine-translated. Click "Translate" again to restore the original.
              </p>
            )}

            <PollBlock postId={post.id} />
            <SeriesNavigation postId={post.id} />
            <MoreLikeThis postId={post.id} />
          </div>

          {!readerMode && headings.length >= 2 && (
            <aside className="xl:block">
              <TableOfContents headings={headings} />
            </aside>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-12 pb-8 border-b border-border/50">
            {post.tags.map(tag => (
              <Link key={tag} href={`/topics/${tag}`} className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Curating Experts */}
        {((post.type as string) === 'article' || (post.type as string) === 'blog') && (
          <CuratingExperts postId={post.id} />
        )}

        {/* Comments Section */}
        <section className="mt-12" id="comments">
          <h3 className="text-2xl font-serif font-bold flex items-center gap-2 mb-8">
            <MessageCircle className="w-6 h-6 text-primary" />
            Comments ({post.commentsCount})
          </h3>

          <div className="bg-card border border-border/50 rounded-2xl p-4 mb-10 shadow-sm focus-within:border-primary/50 focus-within:shadow-md transition-all">
            <MentionInput
              placeholder="Share your thoughts on this piece... (@mention someone)"
              className="min-h-[100px] border-0 focus-visible:ring-0 bg-transparent p-2 text-base"
              value={commentText}
              onChange={setCommentText}
              rows={4}
            />
            <div className="flex justify-end mt-2 pt-2 border-t border-border/40">
              <Button
                onClick={() => submitComment({ id: post.id, data: { content: commentText } })}
                disabled={!user || !commentText.trim() || isCommenting}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Send className="w-4 h-4 mr-2" /> Post Comment
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {isLoadingComments ? (
              <Skeleton className="h-24 w-full rounded-2xl" />
            ) : (comments as any[])?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Be the first to comment!</p>
            ) : (
              (Array.isArray(comments) ? comments as CommentWithReplies[] : []).map(comment => (
                <CommentNode
                  key={comment.id}
                  comment={comment}
                  postId={postId}
                  depth={0}
                  onReplyPosted={handleReplyPosted}
                />
              ))
            )}
          </div>
        </section>

      </div>

      <Dialog open={showPollDialog} onOpenChange={(o) => { setShowPollDialog(o); if (!o) setPollDraft(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add a poll to this post</DialogTitle>
          </DialogHeader>
          <PollComposer value={pollDraft} onChange={setPollDraft} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowPollDialog(false); setPollDraft(null); }}>Cancel</Button>
            <Button onClick={createPoll} disabled={!pollDraft || !pollDraft.question.trim()}>Save poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditHistoryModal postId={post.id} open={historyOpen} onOpenChange={setHistoryOpen} />
      {showBoostModal && (
        <BoostModal
          postId={post.id}
          postTitle={post.title ?? `Post #${post.id}`}
          onClose={() => setShowBoostModal(false)}
        />
      )}

      <Dialog open={showLibraryDialog} onOpenChange={setShowLibraryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              Add to Library
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Contribute this post as a Library entry - a free, SEO-indexed knowledge resource open to the world.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowLibraryDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setShowLibraryDialog(false);
                window.location.href = `/library/new?postId=${post.id}`;
              }}
            >
              Continue to Library Form
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
