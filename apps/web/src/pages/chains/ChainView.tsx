import { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { ChainShareSheet } from '@/components/chains/ChainShareSheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import { apiRequest } from '@/lib/api';
import { Timestamp } from '@/lib/postTimestamp';
import {
  Link2, ArrowLeft, Plus, CheckCircle2, Eye, Users,
  ExternalLink, Lock, BarChart3, Loader2, ChevronRight, Share2
} from 'lucide-react';

interface ChainEntry {
  id: number;
  chainId: number;
  postId: number;
  authorId: number;
  position: number;
  addedAt: string;
  postTitle?: string | null;
  postExcerpt?: string | null;
  postCoverImage?: string | null;
  authorName?: string | null;
  authorUsername?: string | null;
  authorAvatar?: string | null;
}

interface ChainDetail {
  id: number;
  title: string;
  description?: string | null;
  prompt?: string | null;
  category?: string | null;
  maxEntries?: number | null;
  isComplete: boolean;
  isPublic: boolean;
  totalViews: number;
  createdAt: string;
  creatorId: number;
  creatorName?: string | null;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  entries: ChainEntry[];
  hasJoined: boolean;
  entryCount: number;
}

interface UserPost {
  id: number;
  title?: string | null;
  excerpt?: string | null;
}

function EntryCard({ entry, index }: { entry: ChainEntry; index: number }) {
  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0 z-10">
          <span className="text-xs font-bold text-primary">{index + 1}</span>
        </div>
        {index < 999 && <div className="w-0.5 bg-border flex-1 mt-1" style={{ minHeight: 32 }} />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <Link href={`/post/${entry.postId}`}>
          <div className="bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={entry.authorAvatar ?? undefined} />
                <AvatarFallback className="text-[9px]">
                  {(entry.authorName ?? entry.authorUsername ?? '?')[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-foreground">
                {entry.authorName ?? entry.authorUsername}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                <Timestamp value={entry.addedAt} />
              </span>
            </div>
            {entry.postTitle && (
              <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
                {entry.postTitle}
              </p>
            )}
            {entry.postExcerpt && (
              <p className="text-xs text-muted-foreground line-clamp-2">{entry.postExcerpt}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Read <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function AddLinkDialog({
  open,
  onClose,
  chainId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  chainId: number;
  onSuccess: () => void;
}) {
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const { toast } = useToast();
  const { token } = useAuthStore();

  const { data: myPosts, isLoading: loadingPosts } = useQuery({
    queryKey: ['/api/posts/mine/simple'],
    enabled: open,
    queryFn: async () => {
      const res = await fetch('/api/posts?authorId=me&limit=30', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      return (Array.isArray(d?.posts) ? d.posts : Array.isArray(d) ? d : []) as UserPost[];
    },
  });

  const { mutate: addEntry, isPending } = useMutation({
    mutationFn: () => apiRequest('POST', `/api/chains/${chainId}/entries`, { postId: selectedPostId }) as Promise<unknown>,
    onSuccess: () => {
      toast({ title: 'Your link was added to the chain!' });
      onClose();
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? 'Failed to add link', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" /> Add Your Link
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Choose one of your published posts to add as the next link in this chain.
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {loadingPosts ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : !myPosts?.length ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No published posts found.{' '}
              <Link href="/write" className="text-primary hover:underline">Write one first</Link>.
            </div>
          ) : (
            myPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedPostId === post.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="font-medium text-sm text-foreground line-clamp-1">
                  {post.title ?? '(Untitled)'}
                </p>
                {post.excerpt && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.excerpt}</p>
                )}
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button
            onClick={() => addEntry()}
            disabled={!selectedPostId || isPending}
            className="rounded-xl gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Add to Chain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ChainView() {
  const [, params] = useRoute('/chains/:id');
  const chainId = Number(params?.id);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { data: chain, isLoading } = useQuery({
    queryKey: [`/api/chains/${chainId}`],
    queryFn: () => (apiRequest('GET', `/api/chains/${chainId}`) as unknown) as Promise<ChainDetail>,
    enabled: !isNaN(chainId),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (!chain) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
          Chain not found.
        </div>
      </AppLayout>
    );
  }

  const isOwner = user?.id === chain.creatorId;
  const progress = chain.maxEntries ? Math.round((chain.entryCount / chain.maxEntries) * 100) : null;
  const canJoin = !chain.isComplete && !chain.hasJoined && !!user;
  const spotsLeft = chain.maxEntries ? chain.maxEntries - chain.entryCount : null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Back */}
        <Link href="/chains">
          <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 -ml-2 text-xs">
            <ArrowLeft className="w-3 h-3" /> All Chains
          </Button>
        </Link>

        {/* Chain header */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-serif font-bold text-foreground">{chain.title}</h1>
                {chain.isComplete && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 text-xs gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </Badge>
                )}
                {!chain.isPublic && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Lock className="w-3 h-3" /> Private
                  </Badge>
                )}
                {chain.category && (
                  <Badge variant="secondary" className="text-xs capitalize">{chain.category}</Badge>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {chain.creatorUsername && (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={chain.creatorAvatar ?? undefined} />
                      <AvatarFallback className="text-[8px]">
                        {(chain.creatorName ?? chain.creatorUsername)[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Link href={`/profile/${chain.creatorUsername}`} className="hover:underline">
                      {chain.creatorName ?? chain.creatorUsername}
                    </Link>
                  </span>
                )}
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {(chain.totalViews ?? 0).toLocaleString()}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {chain.entryCount} links</span>
                <span><Timestamp value={chain.createdAt} /></span>
              </div>
            </div>
          </div>

          {chain.prompt && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <p className="text-xs text-primary font-medium uppercase tracking-wide mb-1">Prompt</p>
              <p className="text-sm italic text-foreground">"{chain.prompt}"</p>
            </div>
          )}

          {chain.description && (
            <p className="text-sm text-muted-foreground">{chain.description}</p>
          )}

          {/* Progress bar */}
          {progress !== null && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{chain.entryCount} / {chain.maxEntries} links</span>
                {spotsLeft !== null && !chain.isComplete && (
                  <span>{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} remaining</span>
                )}
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${chain.isComplete ? 'bg-emerald-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            {canJoin && (
              <Button onClick={() => setAddOpen(true)} className="rounded-xl gap-2 flex-1">
                <Plus className="w-4 h-4" /> Add Your Link
              </Button>
            )}
            {chain.hasJoined && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" /> You've linked to this chain
              </div>
            )}
            {chain.isComplete && !chain.hasJoined && (
              <p className="text-sm text-muted-foreground">This chain is complete.</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="rounded-xl gap-1.5 text-xs"
            >
              <Share2 className="w-3 h-3" /> Share
            </Button>
            {isOwner && (
              <Link href={`/chains/${chain.id}/analytics`}>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
                  <BarChart3 className="w-3 h-3" /> Analytics
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Entries */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            The Chain ({chain.entryCount} link{chain.entryCount !== 1 ? 's' : ''})
          </h2>

          {chain.entries.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
              <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No links yet. Be the first to add yours!</p>
              {canJoin && (
                <Button onClick={() => setAddOpen(true)} className="mt-4 rounded-xl gap-2" size="sm">
                  <Plus className="w-3 h-3" /> Add First Link
                </Button>
              )}
            </div>
          ) : (
            <div>
              {chain.entries.map((entry, i) => (
                <EntryCard key={entry.id} entry={entry} index={i} />
              ))}
              {/* Final node */}
              <div className="flex gap-4 items-center">
                <div className="w-8 h-8 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center shrink-0">
                  {chain.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{chain.entryCount + 1}</span>
                  )}
                </div>
                {canJoin && !chain.isComplete && (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add your link <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                {chain.isComplete && (
                  <p className="text-sm text-muted-foreground italic">Chain complete</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AddLinkDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        chainId={chain.id}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: [`/api/chains/${chainId}`] })}
      />

      <ChainShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        chainId={chain.id}
        chainTitle={chain.title}
        isOwner={isOwner}
      />
    </AppLayout>
  );
}
