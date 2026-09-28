import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Heart, MessageCircle, Share2, Bookmark, Copy, Check, Repeat2, ShieldCheck, AlertTriangle, Languages, HelpCircle, Code2, Clock, Zap, History, Pin, Rocket, Loader2, TrendingUp, BadgeCheck, Eye, Megaphone, Star, Lightbulb, Trophy, Sparkles, Bell, Users, ExternalLink, Quote as QuoteIcon } from 'lucide-react';
import { EditHistoryModal } from './EditHistoryModal';
import { TrustIndicator, type TrustTier } from './TrustIndicator';
import { AttachmentList } from './AttachmentList';
import { readingTimeLabel } from '@/lib/readingTime';
import { useLikePost, useDeletePost, type Post } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { apiUrl, mediaUrl } from '@/lib/api';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { clsx } from 'clsx';
import { safeHtml } from '@/lib/sanitize';
import { linkifyHashtags } from '@/lib/hashtags';
import { getStoredToken } from '@/lib/api';
import { useI18n, useT } from '@/lib/i18n';
import { CreatorLevelBadge } from '@/components/trust/CreatorLevelBadge';
import { PollBlock } from '@/components/post/PollBlock';
import { PostOptionsMenu, type PostOptionAction, type PostOptionPost } from './PostOptionsMenu';
import { ToastAction } from '@/components/ui/toast';
import { ImageLightbox } from './ImageLightbox';
import { formatPostTimestamp } from '@/lib/postTimestamp';

type CtaButton = { label: string; url: string; style: 'primary' | 'secondary' | 'outline' };

type EnrichedPost = Post & {
  repostsCount?: number;
  isReposted?: boolean;
  isSaved?: boolean;
  authorTrustTier?: string;
  authorIsOfficial?: boolean;
  authorIsSuperUser?: boolean;
  authorCreatorLevel?: string | null;
  authorStreakDays?: number;
  hasPoll?: boolean;
  reason?: string;
  reasonDetails?: string;
  editedCount?: number;
  trustScore?: { cis: number; retention: number; tier: TrustTier } | null;
  groupId?: number | null;
  titleA?: string | null;
  titleB?: string | null;
  abSelectedTitle?: 'a' | 'b' | null;
  abLockedAt?: string | null;
  isSponsored?: boolean;
  sponsorName?: string | null;
  sponsorLogoUrl?: string | null;
  sponsorUrl?: string | null;
  isBoosted?: boolean;
  boostPlan?: string | null;
  boostEndsAt?: string | Date | null;
  boostReachMultiplier?: number;
  boostPlacementPriority?: number;
  isTrending?: boolean;
  viewsCount?: number;
  // Official QuillHive System Posts
  isOfficialPost?: boolean;
  postCategory?: string | null;
  officialPostPriority?: number;
  ctaButtons?: CtaButton[] | null;
  challengeHashtag?: string | null;
  challengeEndsAt?: string | Date | null;
  challengeRewardText?: string | null;
  featuredCreatorId?: number | null;
  authorHireEnabled?: boolean;
  quotedPost?: {
    id: number;
    content: string;
    excerpt?: string | null;
    title?: string | null;
    imageUrl?: string | null;
    author?: { displayName: string; username: string; avatarUrl?: string | null } | null;
  } | null;
};

function renderHashtags(content: string) {
  return content.split(/(#\w+)/g).map((part, index) => (
    part.startsWith('#') ? (
      <Link
        key={index}
        href={`/search?q=${encodeURIComponent(part)}`}
        onClick={(event) => event.stopPropagation()}
        className="text-primary hover:underline"
      >
        {part}
      </Link>
    ) : part
  ));
}

function OfficialBadge({ isOfficial }: { isOfficial?: boolean }) {
  if (!isOfficial) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center ml-1">
          <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Official QuillHive Account</TooltipContent>
    </Tooltip>
  );
}

function SuperUserBadge({ isSuperUser }: { isSuperUser?: boolean }) {
  if (!isSuperUser) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center ml-1"><BadgeCheck className="w-3.5 h-3.5 text-blue-500" /></span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Super User</TooltipContent>
    </Tooltip>
  );
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; gradient: string; accent: string; textColor: string; borderColor: string }> = {
  announcement: {
    label: "Announcement",
    icon: <Megaphone className="w-3.5 h-3.5" />,
    gradient: "from-blue-600/15 to-indigo-600/10",
    accent: "bg-blue-500/15 border-blue-500/30",
    textColor: "text-blue-400",
    borderColor: "border-blue-500/25",
  },
  creator_tip: {
    label: "Creator Tip",
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    gradient: "from-amber-500/15 to-yellow-500/10",
    accent: "bg-amber-500/15 border-amber-500/30",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/25",
  },
  spotlight: {
    label: "Creator Spotlight",
    icon: <Star className="w-3.5 h-3.5" />,
    gradient: "from-purple-600/15 to-pink-600/10",
    accent: "bg-purple-500/15 border-purple-500/30",
    textColor: "text-purple-400",
    borderColor: "border-purple-500/25",
  },
  challenge: {
    label: "Writing Challenge",
    icon: <Trophy className="w-3.5 h-3.5" />,
    gradient: "from-emerald-600/15 to-teal-600/10",
    accent: "bg-emerald-500/15 border-emerald-500/30",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/25",
  },
  update: {
    label: "Product Update",
    icon: <Sparkles className="w-3.5 h-3.5" />,
    gradient: "from-cyan-600/15 to-blue-600/10",
    accent: "bg-cyan-500/15 border-cyan-500/30",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/25",
  },
  featured_creator: {
    label: "Featured Creator",
    icon: <Star className="w-3.5 h-3.5" />,
    gradient: "from-pink-600/15 to-rose-600/10",
    accent: "bg-pink-500/15 border-pink-500/30",
    textColor: "text-pink-400",
    borderColor: "border-pink-500/25",
  },
  growth: {
    label: "Growth Tip",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    gradient: "from-violet-600/15 to-purple-600/10",
    accent: "bg-violet-500/15 border-violet-500/30",
    textColor: "text-violet-400",
    borderColor: "border-violet-500/25",
  },
  event: {
    label: "Platform Event",
    icon: <Bell className="w-3.5 h-3.5" />,
    gradient: "from-orange-600/15 to-amber-600/10",
    accent: "bg-orange-500/15 border-orange-500/30",
    textColor: "text-orange-400",
    borderColor: "border-orange-500/25",
  },
  milestone: {
    label: "Community Milestone",
    icon: <Users className="w-3.5 h-3.5" />,
    gradient: "from-teal-600/15 to-emerald-600/10",
    accent: "bg-teal-500/15 border-teal-500/30",
    textColor: "text-teal-400",
    borderColor: "border-teal-500/25",
  },
  community: {
    label: "Community Highlight",
    icon: <Users className="w-3.5 h-3.5" />,
    gradient: "from-indigo-600/15 to-violet-600/10",
    accent: "bg-indigo-500/15 border-indigo-500/30",
    textColor: "text-indigo-400",
    borderColor: "border-indigo-500/25",
  },
};

function OfficialPostBanner({ category }: { category: string | null | undefined }) {
  const cfg = CATEGORY_CONFIG[category ?? ""] ?? CATEGORY_CONFIG["announcement"];
  return (
    <div className={`-mx-5 -mt-5 mb-4 px-5 py-3 bg-gradient-to-r ${cfg.gradient} border-b ${cfg.borderColor} flex items-center justify-between`}>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${cfg.textColor}`}>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.accent}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Official</span>
      </div>
    </div>
  );
}

function OfficialCtaButtons({ buttons, postId }: { buttons: CtaButton[]; postId: number }) {
  const token = getStoredToken();
  const trackClick = (label: string) => {
    fetch(`/api/posts/${postId}/cta-click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ label }),
    }).catch(() => {});
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4 mb-1">
      {buttons.map((btn) => {
        const isExternal = btn.url.startsWith('http');
        const baseClasses = "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all";
        const styleClasses = btn.style === 'primary'
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          : btn.style === 'secondary'
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            : "border border-border bg-transparent hover:bg-accent text-foreground";

        if (isExternal) {
          return (
            <a
              key={btn.label}
              href={btn.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); trackClick(btn.label); }}
              className={`${baseClasses} ${styleClasses}`}
            >
              {btn.label}
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          );
        }
        return (
          <Link
            key={btn.label}
            href={btn.url}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); trackClick(btn.label); }}
            className={`${baseClasses} ${styleClasses}`}
          >
            {btn.label}
          </Link>
        );
      })}
    </div>
  );
}

function ChallengeCountdown({ endsAt, hashtag, rewardText }: { endsAt: string | Date | null | undefined; hashtag: string | null | undefined; rewardText: string | null | undefined }) {
  if (!endsAt && !hashtag) return null;
  const msLeft = endsAt ? new Date(endsAt).getTime() - Date.now() : null;
  const daysLeft = msLeft !== null ? Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24))) : null;

  return (
    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
      {hashtag && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Challenge Hashtag</span>
          <span className="text-sm font-semibold text-emerald-300">#{hashtag}</span>
        </div>
      )}
      {daysLeft !== null && (
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-300 font-medium">
            {daysLeft === 0 ? "Ends today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
          </span>
        </div>
      )}
      {rewardText && (
        <div className="flex items-start gap-2">
          <Trophy className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <span className="text-xs text-muted-foreground">{rewardText}</span>
        </div>
      )}
    </div>
  );
}

function TrustBadge({ tier, isAdmin }: { tier?: string; isAdmin?: boolean }) {
  if (tier === 'trusted') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center ml-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Trusted Contributor</TooltipContent>
      </Tooltip>
    );
  }
  if (tier === 'restricted' && isAdmin) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center ml-1">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Restricted account</TooltipContent>
      </Tooltip>
    );
  }
  return null;
}

export function PostCard({ post: initialPost, compact = false }: { post: EnrichedPost; compact?: boolean }) {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [post, setPost] = useState<EnrichedPost>(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const [showWhyDialog, setShowWhyDialog] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [boostPlan, setBoostPlan] = useState<'starter' | 'growth' | 'spotlight'>('starter');
  const [isBoosting, setIsBoosting] = useState(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState('');
  const [isBoostActive, setIsBoostActive] = useState(() => Boolean(
    post.isBoosted && post.boostEndsAt && new Date(post.boostEndsAt as string).getTime() > Date.now(),
  ));
  const [optimisticLiked, setOptimisticLiked] = useState<boolean>(Boolean(initialPost.isLiked));
  const [optimisticLikes, setOptimisticLikes] = useState<number>(Number(initialPost.likesCount ?? 0));
  const isOwner = currentUser?.id === post.author.id;
  const isModerator = currentUser?.role === 'moderator' || isAdmin;
  const canPinToGroup = !!post.groupId && (isOwner || isModerator);
  const token = getStoredToken();
  const t = useT();
  const { lang } = useI18n();

  useEffect(() => {
    if (!post.isBoosted || !post.boostEndsAt) {
      setIsBoostActive(false);
      setBoostTimeLeft('');
      return;
    }
    const update = () => {
      const remaining = new Date(post.boostEndsAt as string).getTime() - Date.now();
      if (remaining <= 0) {
        setIsBoostActive(false);
        setBoostTimeLeft('');
        return;
      }
      setIsBoostActive(true);
      const hours = Math.floor(remaining / 3_600_000);
      const minutes = Math.floor((remaining % 3_600_000) / 60_000);
      setBoostTimeLeft(hours > 0 ? `${hours}h ${minutes}m left` : `${Math.max(1, minutes)}m left`);
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [post.isBoosted, post.boostEndsAt]);

  // A/B title display: pick random variant on mount unless winner is locked.
  // After first click on the post, increment that variant's click counter.
  const abVariant: 'a' | 'b' | null = (() => {
    if (!post.titleA || !post.titleB) return null;
    if (post.abSelectedTitle === 'a' || post.abSelectedTitle === 'b') return post.abSelectedTitle;
    // stable per render; deterministic by post id so SSR-safe and avoids flicker
    return post.id % 2 === 0 ? 'a' : 'b';
  })();
  const abDisplayedTitle = abVariant === 'a' ? post.titleA : abVariant === 'b' ? post.titleB : null;

  const handleAbClickTrack = () => {
    if (!abVariant || post.abSelectedTitle) return;
    fetch(`/api/posts/${post.id}/ab-click/${abVariant}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => { /* non-fatal */ });
  };

  const handlePinToGroup = async () => {
    if (!canPinToGroup || !post.groupId) return;
    try {
      const res = await fetch(`/api/groups/${post.groupId}/posts/${post.id}/pin`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        toast({ title: 'Pinned to group' });
      } else {
        toast({ title: 'Could not pin', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Could not pin', variant: 'destructive' });
    }
  };

  const handleTranslate = async () => {
    if (showTranslated && translatedContent) {
      setShowTranslated(false);
      return;
    }
    if (translatedContent) {
      setShowTranslated(true);
      return;
    }
    const textToTranslate = post.excerpt || post.content || post.title || '';
    if (!textToTranslate.trim()) return;

    setIsTranslating(true);
    setTranslateError(false);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: textToTranslate.slice(0, 2000), targetLang: lang }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTranslatedContent(data.translatedText);
      setShowTranslated(true);
    } catch {
      setTranslateError(true);
    } finally {
      setIsTranslating(false);
    }
  };

  const { mutate: toggleLike, isPending: isLiking } = useLikePost({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/posts'] }),
    }
  });

  const { mutate: deletePost } = useDeletePost({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
        toast({ title: 'Post deleted' });
      },
      onError: () => {
        setIsHidden(false);
        toast({ title: 'Failed to delete post', variant: 'destructive' });
      }
    }
  });

  const handleDeleteWithUndo = () => {
    setIsHidden(true);
    const timeoutId = window.setTimeout(() => {
      deletePost({ id: post.id });
    }, 5_000);
    toast({
      title: 'Post deleted',
      action: (
        <ToastAction altText="Undo post deletion" onClick={() => {
          window.clearTimeout(timeoutId);
          setIsHidden(false);
        }}>
          Undo
        </ToastAction>
      ),
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: 'Link copied!', description: 'Post link copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleQuote = () => {
    if (!currentUser) {
      toast({ title: 'Sign in to quote posts', variant: 'destructive' });
      return;
    }
    setLocation(`/write?quote=${post.id}`);
  };

  const handleRepost = async () => {
    if (!currentUser) { toast({ title: 'Sign in to repost', variant: 'destructive' }); return; }
    setIsReposting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/repost`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setPost(p => ({ ...p, isReposted: data.isReposted, repostsCount: data.repostsCount }));
      toast({ title: data.isReposted ? 'Reposted!' : 'Repost removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
    } catch {
      toast({ title: 'Failed to repost', variant: 'destructive' });
    } finally {
      setIsReposting(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) { toast({ title: 'Sign in to save posts', variant: 'destructive' }); return; }
    if (!token) { toast({ title: 'Sign in to save posts', variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const method = post.isSaved ? 'DELETE' : 'POST';
      const res = await fetch(apiUrl(`/api/posts/${post.id}/save`), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok || res.status === 409) {
        const newSaved = !post.isSaved;
        setPost(p => ({ ...p, isSaved: newSaved }));
        window.dispatchEvent(new CustomEvent('quillhive:saved-changed'));
        toast({ title: newSaved ? 'Saved' : 'Removed from saved' });
      } else {
        toast({ title: 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBoost = async () => {
    if (!currentUser || !token) { toast({ title: 'Sign in to boost', variant: 'destructive' }); return; }
    setIsBoosting(true);
    try {
      const res = await fetch(apiUrl('/api/boost/init-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.id, plan: boostPlan }),
      });
      const data = await res.json() as {
        txRef?: string; amount?: number; currency?: string; publicKey?: string;
        planLabel?: string; customerEmail?: string; customerName?: string; error?: string;
      };
      if (!res.ok) {
        toast({ title: data.error ?? 'Failed to initialise boost payment', variant: 'destructive' });
        setIsBoosting(false);
        return;
      }
      if (!document.getElementById('flw-js')) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.id = 'flw-js';
          s.src = 'https://checkout.flutterwave.com/v3.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load payment provider'));
          document.head.appendChild(s);
        });
      }
      type FlwResult = { status: string; transaction_id: string; tx_ref: string };
      interface FlwConfig {
        public_key: string; tx_ref: string; amount: number; currency: string;
        payment_options: string;
        customer: { email: string; name: string };
        customizations: { title: string; description: string; logo?: string };
        callback: (r: FlwResult) => void;
        onclose: () => void;
      }
      const flwCheckout = (window as Window & { FlutterwaveCheckout?: (c: FlwConfig) => void }).FlutterwaveCheckout;
      if (!flwCheckout) throw new Error('Payment provider not available - please refresh and try again');
      flwCheckout({
        public_key: data.publicKey ?? '',
        tx_ref: data.txRef ?? '',
        amount: data.amount ?? 0,
        currency: data.currency ?? 'USD',
        payment_options: 'card',
        customer: { email: data.customerEmail ?? '', name: data.customerName ?? 'Creator' },
        customizations: {
          title: 'QuillHive Boost',
          description: data.planLabel ?? 'Post Boost',
          logo: `${window.location.origin}/icons/icon-192.png`,
        },
        callback: async (result) => {
          if (result.status === 'successful') {
            const vRes = await fetch(
              apiUrl(`/api/boost/verify-payment?tx_ref=${encodeURIComponent(result.tx_ref)}&transaction_id=${encodeURIComponent(result.transaction_id)}`),
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const vData = await vRes.json() as { ok?: boolean; message?: string; error?: string };
            if (vRes.ok && vData.ok) {
              toast({ title: '🚀 Boost activated!', description: vData.message ?? 'Your post is now getting boosted reach.' });
              setBoostOpen(false);
            } else {
              toast({ title: 'Verification failed', description: vData.error ?? 'Please contact support.', variant: 'destructive' });
            }
          } else {
            toast({ title: 'Payment incomplete', description: 'Your boost was not activated.', variant: 'destructive' });
          }
          setIsBoosting(false);
        },
        onclose: () => setIsBoosting(false),
      });
    } catch (err) {
      toast({ title: 'Payment error', description: err instanceof Error ? err.message : 'Failed to start payment', variant: 'destructive' });
      setIsBoosting(false);
    }
  };

  React.useEffect(() => {
    if (!isOwner) return;
    const url = new URL(window.location.href);
    const pathPostId = url.pathname.match(/\/post\/(\d+)/)?.[1];
    const boostParam = url.searchParams.get('boost');
    if (pathPostId === String(post.id) && boostParam === 'success') {
      toast({ title: '🚀 Boost activated!', description: 'Your post is now getting boosted reach.' });
      url.searchParams.delete('boost');
      window.history.replaceState({}, '', url.toString());
    }
  }, [post.id]);

  const handleReport = () => {
    toast({ title: 'Report submitted', description: 'Our team will review this post.' });
  };

  const handlePostOptionAction = async (action: PostOptionAction, optionPost: PostOptionPost) => {
    switch (action) {
      case 'copy-link':
        handleCopyLink();
        break;
      case 'edit':
        setLocation(`/write?edit=${post.id}`);
        break;
      case 'save':
      case 'save-job':
        await handleSave();
        break;
      case 'embed': {
        const embedCode = `<iframe src="${apiUrl(`/api/embed/${optionPost.id}`)}" width="100%" height="240" frameborder="0" allowfullscreen></iframe>`;
        await navigator.clipboard.writeText(embedCode);
        toast({ title: 'Embed code copied', description: 'Paste it anywhere on the web.' });
        break;
      }
      case 'boost':
        setBoostOpen(true);
        break;
      case 'report':
        handleReport();
        break;
      case 'mute': {
        const res = await fetch(apiUrl(`/api/blocks/mute/${optionPost.authorId}`), {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Could not mute author');
        toast({ title: 'Author muted', description: 'Their posts will no longer appear in your feed.' });
        break;
      }
      case 'pin':
        await handlePinToGroup();
        break;
      case 'toggle-comments':
        toast({ title: 'Comment settings updated' });
        break;
      case 'archive':
        toast({ title: 'Archive is unavailable for this post', variant: 'destructive' });
        break;
      default:
        toast({ title: 'Action saved', description: 'Your preference has been updated.' });
    }
  };

  const optionPost: PostOptionPost = {
    id: post.id,
    type: ['article', 'update', 'portfolio', 'job', 'gig', 'group_post'].includes(post.type)
      ? post.type as PostOptionPost['type']
      : 'update',
    status: (['active', 'filled', 'closed', 'completed', 'archived'].includes((post as EnrichedPost & { status?: string }).status ?? '')
      ? (post as EnrichedPost & { status: PostOptionPost['status'] }).status
      : 'active'),
    authorId: post.author.id,
  };

  if (isHidden) return null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'story': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30';
      case 'poem': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'novel': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'artwork': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'article': return 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30';
      case 'post': return 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30';
      case 'spark': return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }

  };

  const isSpark = (post.type as string) === 'spark';
  const isFirst24h = (Date.now() - new Date(post.createdAt).getTime()) < 24 * 60 * 60 * 1000;
  const postTimestamp = formatPostTimestamp(post.createdAt);
  const feelingTag = (post.tags || []).find((t: string) => typeof t === 'string' && t.startsWith('feeling:'));
  const feelingMap: Record<string, { emoji: string; label: string }> = {
    happy: { emoji: '😊', label: 'feeling happy' },
    thinking: { emoji: '🤔', label: 'thinking' },
    grateful: { emoji: '🙏', label: 'feeling grateful' },
    excited: { emoji: '🎉', label: 'excited' },
    tired: { emoji: '😴', label: 'tired' },
    inspired: { emoji: '✨', label: 'feeling inspired' },
    curious: { emoji: '👀', label: 'curious' },
    love: { emoji: '❤️', label: 'feeling love' },
  };
  const feeling = feelingTag ? feelingMap[feelingTag.split(':')[1]] : null;

  let parsedAttachments: Array<{ url: string; mimeType: string; filename?: string; sizeBytes?: number }> = [];
  const rawAttachments = (post as EnrichedPost & { attachments?: unknown }).attachments;
  if (Array.isArray(rawAttachments)) {
    parsedAttachments = rawAttachments;
  } else if (typeof rawAttachments === 'string' && rawAttachments.length > 0) {
    try { parsedAttachments = JSON.parse(rawAttachments); } catch { parsedAttachments = []; }
  }

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        data-card
        className={`bg-card border rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-lg transition-all duration-300 ${
          post.isOfficialPost
            ? 'border-blue-500/30 hover:border-blue-400/50 shadow-blue-500/5'
            : 'border-border/60 hover:border-primary/20'
        }`}
      >
        {/* Official Post Banner */}
        {post.isOfficialPost && <OfficialPostBanner category={post.postCategory} />}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <Link href={`/profile/${post.author.username}`} className="flex items-center gap-3 group">
            <Avatar className="h-10 w-10 border border-border group-hover:border-primary transition-colors">
              <AvatarImage src={post.author.avatarUrl || ''} />
              <AvatarFallback className="bg-primary/10 text-primary">{post.author.displayName.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors flex items-center flex-wrap gap-1">
                {post.author.displayName}
                <OfficialBadge isOfficial={post.authorIsOfficial} />
                <SuperUserBadge isSuperUser={post.authorIsSuperUser} />
                <TrustBadge tier={post.authorTrustTier} isAdmin={isAdmin} />
                <CreatorLevelBadge level={post.authorCreatorLevel} size="xs" />
                {post.authorHireEnabled && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    ⚡ Open for Projects
                  </span>
                )}
                {(post.authorStreakDays ?? 0) >= 3 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-500 bg-orange-500/10 rounded-full px-1.5 py-0.5"
                    title={`${post.authorStreakDays}-day posting streak`}
                  >
                    🔥 {post.authorStreakDays}
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>
                  @{post.author.username} · {postTimestamp && (
                    <time dateTime={postTimestamp.dateTime} title={postTimestamp.title}>{postTimestamp.label}</time>
                  )}
                </span>
                {!isSpark && readingTimeLabel(post.content || post.excerpt || '') && (
                  <span className="inline-flex items-center gap-0.5">
                    · <Clock className="w-3 h-3" /> {readingTimeLabel(post.content || post.excerpt || '')}
                  </span>
                )}
                {isSpark && feeling && (
                  <span className="inline-flex items-center gap-0.5">· {feeling.emoji} {feeling.label}</span>
                )}
              </p>
            </div>
          </Link>

          <PostOptionsMenu
            post={optionPost}
            currentUserId={currentUser?.id}
            isOwner={isOwner}
            isSaved={post.isSaved}
            onAction={handlePostOptionAction}
            onDeletePermanently={handleDeleteWithUndo}
          />
        </div>

        {/* Content */}
        <Link href={`/post/${post.id}`} className="block group" onClick={handleAbClickTrack}>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {post.isTrending && (
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 uppercase tracking-wider inline-flex items-center gap-1" data-testid="badge-trending">
                  <TrendingUp className="w-3 h-3" /> Trending
                </Badge>
              )}
              {isBoostActive && (
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 uppercase tracking-wider inline-flex items-center gap-1" data-testid="badge-boosted">
                  <Rocket className="w-3 h-3" /> Boosted{boostTimeLeft ? ` · ${boostTimeLeft}` : ''}
                </Badge>
              )}
              {isFirst24h && !post.isBoosted && (
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 uppercase tracking-wider inline-flex items-center gap-1">
                  <Zap className="w-3 h-3" /> First 24h
                </Badge>
              )}
              {(post as any).isFeatured && (
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 inline-flex items-center gap-1" data-testid="badge-featured">
                  ✦ Featured
                </Badge>
              )}
              {post.isSponsored && (
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 uppercase tracking-wider" data-testid="badge-sponsored">
                  Sponsored
                </Badge>
              )}
              <Badge variant="outline" className={`capitalize px-2.5 py-0.5 font-medium ${getTypeColor(post.type)} inline-flex items-center gap-1`}>
                {isSpark && <Zap className="w-3 h-3 fill-current" />}
                {isSpark ? 'Spark' : (
                  { artwork: 'Motion', blog: 'Post', article: 'Post', post: 'Post', story: 'Story', poem: 'Story', novel: 'Story', note: 'Spark' }[post.type as string] ?? post.type
                )}
              </Badge>
              {(post.editedCount ?? 0) > 0 && (
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] text-muted-foreground border-border/60 inline-flex items-center gap-1" data-testid="badge-edited">
                  <History className="w-3 h-3" /> Edited
                </Badge>
              )}
              {post.trustScore && <TrustIndicator tier={post.trustScore.tier} />}
              {post.reason && post.reason !== 'following_creator' && (() => {
                const reasonMap: Record<string, { icon: React.ReactNode; color: string }> = {
                  trending_in_topic:  { icon: <TrendingUp className="w-3 h-3" />, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
                  popular_in_topic:   { icon: <Rocket className="w-3 h-3" />,     color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
                  high_engagement:    { icon: <Zap className="w-3 h-3" />,        color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
                  rising_fast:        { icon: <TrendingUp className="w-3 h-3" />, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
                  popular_this_week:  { icon: <Star className="w-3 h-3" />,       color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
                  readers_loved_this: { icon: <Trophy className="w-3 h-3" />,     color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30' },
                  similar_interests:  { icon: <Sparkles className="w-3 h-3" />,   color: 'bg-primary/10 text-primary border-primary/30' },
                };
                const entry = reasonMap[post.reason] ?? { icon: <Sparkles className="w-3 h-3" />, color: 'bg-muted text-muted-foreground border-border/60' };
                return (
                  <Badge
                    variant="outline"
                    className={`px-2 py-0.5 text-[10px] font-medium ${entry.color} inline-flex items-center gap-1 cursor-pointer`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowWhyDialog(true); }}
                    title={t("trust.whySeeing", "Why am I seeing this?")}
                  >
                    {entry.icon}
                    {t(`trust.${post.reason}`, post.reason.replace(/_/g, ' '))}
                  </Badge>
                );
              })()}
            </div>
            {!isSpark && (post.title || abDisplayedTitle) && (
              <h2 className="text-xl md:text-2xl font-serif font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {abDisplayedTitle || post.title}
              </h2>
            )}
          </div>

          {post.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden bg-muted aspect-video relative">
              <ImageLightbox
                src={post.imageUrl}
                alt={post.title || "Post image"}
                className="h-full w-full"
                imageClassName="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          )}

          {isSpark ? (
            <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed mb-2">
              {renderHashtags(showTranslated && translatedContent ? translatedContent : post.content || '')}
            </p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
              <AnimatePresence mode="wait">
                {showTranslated && translatedContent ? (
                  <motion.p
                    key="translated"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="line-clamp-3"
                  >
                    {renderHashtags(translatedContent)}
                  </motion.p>
                ) : (
                  <motion.div
                    key="original"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="line-clamp-3"
                  >
                    {post.excerpt
                      ? renderHashtags(post.excerpt)
                      : <span dangerouslySetInnerHTML={{ __html: linkifyHashtags(safeHtml(post.content ?? '')) }} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {parsedAttachments.length > 0 && (
            <AttachmentList attachments={parsedAttachments} />
          )}
          {post.quotedPost && (
            <Link
              href={`/post/${post.quotedPost.id}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-3 block rounded-xl border border-border/70 bg-muted/20 p-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={post.quotedPost.author?.avatarUrl || ''} />
                  <AvatarFallback className="text-[10px]">{post.quotedPost.author?.displayName?.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold">{post.quotedPost.author?.displayName || 'Original post'}</span>
                {post.quotedPost.author?.username && <span className="text-xs text-muted-foreground">@{post.quotedPost.author.username}</span>}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{post.quotedPost.excerpt || post.quotedPost.content}</p>
              {post.quotedPost.imageUrl && (
                <ImageLightbox
                  src={post.quotedPost.imageUrl}
                  alt="Quoted post image"
                  className="mt-2 h-20 w-28 overflow-hidden rounded-lg"
                  imageClassName="h-full w-full object-cover"
                />
              )}
            </Link>
          )}
        </Link>

        {post.hasPoll && (
          <div className="mt-3" onClick={e => e.stopPropagation()}>
            <PollBlock postId={post.id} />
          </div>
        )}

        <Link href={`/post/${post.id}`} className="block group" onClick={handleAbClickTrack}>

          {lang !== 'en' && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTranslate(); }}
              disabled={isTranslating}
              className="mt-2 mb-3 flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
            >
              <Languages className="w-3.5 h-3.5" />
              {isTranslating
                ? t('post.translating')
                : showTranslated
                  ? t('post.showOriginal')
                  : t('post.viewInYourLanguage')}
              {translateError && <span className="text-destructive ml-1">({t('common.error')})</span>}
            </button>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
              {post.tags.slice(0, 5).map((tag: string) => {
                const cleanTag = tag.replace(/^#/, '').toLowerCase();
                return (
                  <Link
                    key={cleanTag}
                    href={`/topics/${cleanTag}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <Badge
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
                    >
                      #{cleanTag}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Link>

        {/* Official post CTA buttons */}
        {post.isOfficialPost && post.ctaButtons && post.ctaButtons.length > 0 && (
          <OfficialCtaButtons buttons={post.ctaButtons} postId={post.id} />
        )}

        {/* Challenge info block */}
        {post.isOfficialPost && post.postCategory === 'challenge' && (
          <ChallengeCountdown
            endsAt={post.challengeEndsAt}
            hashtag={post.challengeHashtag}
            rewardText={post.challengeRewardText}
          />
        )}

        {post.isSponsored && post.sponsorName && (
          <div
            className="mb-3 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-foreground/80"
            data-testid="strip-sponsor"
          >
            {post.sponsorLogoUrl ? (
              <img
                src={post.sponsorLogoUrl}
                alt={post.sponsorName}
                className="w-5 h-5 rounded object-cover shrink-0"
                loading="lazy"
              />
            ) : (
              <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                {post.sponsorName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-muted-foreground">Presented by</span>
            {post.sponsorUrl ? (
              <a
                href={post.sponsorUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-amber-700 dark:text-amber-300 hover:underline truncate"
                data-testid="link-sponsor"
              >
                {post.sponsorName}
              </a>
            ) : (
              <span className="font-medium text-foreground truncate">{post.sponsorName}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-4 border-t border-border/50">
          {/* Curate (optimistic like) */}
          <button
            onClick={() => {
              const wasLiked = optimisticLiked;
              setOptimisticLiked(!wasLiked);
              setOptimisticLikes((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
              toggleLike({ id: post.id });
            }}
            disabled={isLiking}
            title={optimisticLiked ? 'Remove curation' : 'Curate this work'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              optimisticLiked
                ? 'text-rose-500 bg-rose-500/10'
                : 'text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10'
            }`}
            data-testid={`button-like-${post.id}`}
          >
            <Heart className={`w-4 h-4 ${optimisticLiked ? 'fill-current' : ''}`} />
            {optimisticLikes > 0 ? (
              <span>{optimisticLikes}</span>
            ) : (
              <span className="text-[11px]">{optimisticLiked ? 'Curated' : 'Curate'}</span>
            )}
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          >
            <MessageCircle className={`w-4 h-4 ${showComments ? 'fill-primary/20 text-primary' : ''}`} />
            <span>{post.commentsCount}</span>
          </button>

          {/* Repost */}
          <button
            onClick={handleRepost}
            disabled={isReposting}
            title="Repost"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              post.isReposted
                ? 'text-emerald-500 bg-emerald-500/10'
                : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10'
            }`}
          >
            <Repeat2 className="w-4 h-4" />
            {(post.repostsCount ?? 0) > 0 && <span>{post.repostsCount}</span>}
          </button>

          {/* Share */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                <Share2 className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer gap-2">
                <Copy className="w-4 h-4" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: 'Coming soon', description: 'Share to Group is coming.' })} className="cursor-pointer gap-2">
                <MessageCircle className="w-4 h-4" /> Share to Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quote */}
          <button
            onClick={handleQuote}
            title="Quote"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          >
            <QuoteIcon className="w-4 h-4" />
          </button>

          {/* Save / Bookmark */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            title={post.isSaved ? 'Remove from saved' : 'Save post'}
            className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              post.isSaved
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${post.isSaved ? 'fill-current' : ''}`} />
          </button>

          {/* Boost (owner only) */}
          {isOwner && (
            <button
              onClick={() => setBoostOpen(true)}
              title="Boost this post"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-orange-500 bg-orange-500/8 hover:bg-orange-500/15 border border-orange-500/20 transition-all"
              data-testid={`button-boost-${post.id}`}
            >
              <Rocket className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Boost</span>
            </button>
          )}
        </div>

        {/* Visibility signal (owner only or if viewsCount available) */}
        {((isOwner && isFirst24h) || (post.viewsCount ?? 0) > 0) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            {(post.viewsCount ?? 0) > 0 ? (
              <span className="text-xs text-muted-foreground">
                Seen by <span className="font-semibold text-foreground">{(post.viewsCount ?? 0).toLocaleString()}</span> people
              </span>
            ) : isFirst24h && isOwner ? (
              <span className="text-xs text-muted-foreground">Your first 24h - posts get extra reach right now. <button onClick={() => setBoostOpen(true)} className="text-primary hover:underline font-medium">Boost to grow faster →</button></span>
            ) : null}
          </div>
        )}

        {/* Inline Comments */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-border/40"
            >
              <Link href={`/post/${post.id}`} className="block text-center py-3 text-sm text-primary hover:underline">
                View all {post.commentsCount} comment{post.commentsCount !== 1 ? 's' : ''} →
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>

      {/* Boost Dialog */}
      <Dialog open={boostOpen} onOpenChange={setBoostOpen}>
        <DialogContent className="rounded-2xl border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-orange-500" /> Boost this post
            </DialogTitle>
            <DialogDescription>
              Pay once - your post gets boosted immediately upon payment. No review delay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {([
              { key: 'starter',   label: 'Starter Boost', duration: '2 days',  perk: 'Increased feed ranking',   emoji: '⚡', price: '$5'  },
              { key: 'growth',    label: 'Growth Boost',  duration: '7 days',  perk: 'Featured in Explore',      emoji: '🚀', price: '$15' },
              { key: 'spotlight', label: 'Spotlight',     duration: '15 days', perk: 'Homepage + newsletter',    emoji: '🌟', price: '$30' },
            ] as const).map(plan => (
              <button
                key={plan.key}
                onClick={() => setBoostPlan(plan.key)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  boostPlan === plan.key
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-border/60 bg-card hover:border-orange-500/50'
                }`}
                data-testid={`boost-plan-${plan.key}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{plan.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{plan.label}</p>
                    <p className="text-xs text-muted-foreground">{plan.duration} · {plan.perk}</p>
                  </div>
                  <span className={`text-base font-bold ${boostPlan === plan.key ? 'text-orange-500' : 'text-foreground'}`}>{plan.price}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center">Secure payment via Flutterwave · No subscription</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBoostOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleBoost} disabled={isBoosting} className="rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white border-0">
              {isBoosting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
              Pay &amp; Boost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Why am I seeing this? Dialog */}
      <Dialog open={showWhyDialog} onOpenChange={setShowWhyDialog}>
        <DialogContent className="rounded-2xl border-border/50 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              {t("trust.whySeeing", "Why am I seeing this?")}
            </DialogTitle>
            <DialogDescription>
              {t("trust.whySeeingDesc", "This post appears in your feed because:")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4 text-sm text-foreground font-medium">
            {post.reason && t(`trust.${post.reason}`, post.reason.replace(/_/g, " "))}
          </div>
          {post.reasonDetails && (
            <p className="text-xs text-muted-foreground px-1">{post.reasonDetails}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowWhyDialog(false)} className="rounded-xl w-full">Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit history modal */}
      <EditHistoryModal postId={post.id} open={showHistoryModal} onOpenChange={setShowHistoryModal} />

    </>
  );
}
