import { useState, useEffect, useRef } from 'react';
import { Timestamp } from '@/lib/postTimestamp';
import { useRoute, Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useGetUserByUsername, useFollowUser } from '@workspace/api-client-react';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/post/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin, Link as LinkIcon, Calendar, UserPlus, UserCheck, Plus, Loader2, Handshake,
  Pencil, X, ExternalLink, Sparkles, Globe, Facebook, Linkedin, Twitter, Instagram,
  MessageCircle, Zap, Camera, Share2,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch, apiUrl, getStoredToken, mediaUrl } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { useT } from '@/lib/i18n';
import { BackButton } from '@/components/ui/BackButton';
import { ReportDialog } from '@/components/report/ReportDialog';
import { useFeature } from '@/lib/features';

interface CreatorProfile {
  skills: string[]; links: { label: string; url: string }[];
  verified: boolean; isAvailableForHire: boolean; availableFor: string[];
}

interface ProfilePost {
  id: number;
  authorId?: number;
  type: string;
  visibility?: 'public' | 'followers' | 'private';
  title?: string | null;
  content?: string | null;
  excerpt?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  isPublished?: boolean;
}

interface ExtendedProfileData {
  user: {
    id: number;
    username: string;
    email: string;
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    website?: string | null;
    location?: string | null;
    country?: string | null;
    headline?: string | null;
    identityType?: string | null;
    facebook?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
    instagram?: string | null;
    followersCount: number;
    followingCount: number;
    postsCount: number;
    isFollowing: boolean;
    createdAt: string;
    isPremium?: boolean;
    isOfficialAccount?: boolean;
  };
}

const AVAILABLE_FOR_OPTIONS = [
  { id: 'collaborations', label: 'Collaborations', displayLabel: 'Collaboration Ready',          icon: '🤝' },
  { id: 'commissions',    label: 'Commissions',    displayLabel: 'Available for Commissions',    icon: '💰' },
  { id: 'freelance',      label: 'Freelance',      displayLabel: 'Accepting Creative Projects',  icon: '🧑‍💻' },
  { id: 'beta_readers',   label: 'Beta Readers',   displayLabel: 'Seeking Beta Readers',         icon: '📖' },
  { id: 'editing',        label: 'Editing',        displayLabel: 'Accepting Editing Work',       icon: '✏️' },
  { id: 'sponsorships',   label: 'Sponsorships',   displayLabel: 'Available for others to find', icon: '🌟' },
];

export default function Profile() {
  const [, profileParams] = useRoute('/profile/:username');
  const [, publicParams] = useRoute('/u/:username');
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const username = profileParams?.username || publicParams?.username || currentUser?.username || '';
  const { toast } = useToast();
  const t = useT();
  const creatorIncomeEnabled = useFeature('creator_income_enabled');
  const isMe = currentUser?.username === username;
  const token = getStoredToken();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [coverImageError, setCoverImageError] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);

  async function handleImageUpload(file: File, type: 'avatar' | 'cover') {
    const setLoading = type === 'avatar' ? setUploadingAvatar : setUploadingCover;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Image must be under 10 MB', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const uploaded = await uploadFile(file, 'profile');
      const url = uploaded.url;
      const field = type === 'avatar' ? 'avatarUrl' : 'coverUrl';

      const profileRes = await apiFetch('/api/users/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: url }),
      });
      const updatedUser = await profileRes.json().catch(() => null);
      if (!profileRes.ok) throw new Error(updatedUser?.error || 'Profile update failed');

      queryClient.setQueryData(['/api/users/' + username], (previous: ExtendedProfileData | undefined) => (
        previous
          ? { ...previous, user: { ...previous.user, [field]: url } }
          : previous
      ));
      const authUser = useAuthStore.getState().user;
      if (authUser && isMe) {
        useAuthStore.setState({ user: { ...authUser, ...updatedUser, [field]: url } });
      }

      toast({ title: `${type === 'avatar' ? 'Profile' : 'Cover'} photo updated` });
      void refetch();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const { data: rawData, isLoading, isError, refetch } = useGetUserByUsername(username);
  const data = rawData as ExtendedProfileData | undefined;
  const { mutate: toggleFollow, isPending: isFollowing } = useFollowUser({ mutation: { onSuccess: () => refetch() } });

  const shareProfile = async () => {
    if (!data?.user) return;
    const url = `${window.location.origin}/profile/${encodeURIComponent(data.user.username)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${data.user.displayName} on QuillHive`, text: 'Find this voice on QuillHive.', url });
        toast({ title: 'Profile shared' });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Profile link copied', description: 'Your QuillHive profile is ready to share.' });
      } else {
        throw new Error('Sharing is not available in this browser.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast({ title: 'Could not share profile', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    setCoverImageError(false);
    setAvatarImageError(false);
  }, [data?.user?.coverUrl, data?.user?.avatarUrl]);

  const [endorsements, setEndorsements] = useState<Record<string, number>>({});

  const [profileContentPosts, setProfileContentPosts] = useState<ProfilePost[]>([]);
  const [profileContentLoading, setProfileContentLoading] = useState(false);
  const [profileContentPage, setProfileContentPage] = useState(1);
  const [profileContentHasMore, setProfileContentHasMore] = useState(false);
  const [profileContentLoadingMore, setProfileContentLoadingMore] = useState(false);
  const [profileContentError, setProfileContentError] = useState(false);
  const [profileContentRetryCount, setProfileContentRetryCount] = useState(0);

  // Creator profile state
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>({ skills: [], links: [], verified: false, isAvailableForHire: false, availableFor: [] });
  const [isEditCreatorOpen, setIsEditCreatorOpen] = useState(false);
  const [creatorForm, setCreatorForm] = useState({ skills: '', links: '', isAvailableForHire: false, availableFor: [] as string[] });
  const [isSavingCreator, setIsSavingCreator] = useState(false);

  // Collaboration state
  const [isCollaborateOpen, setIsCollaborateOpen] = useState(false);
  const [collaborateMsg, setCollaborateMsg] = useState('');
  const [isSendingCollab, setIsSendingCollab] = useState(false);
  const [isOpeningMessage, setIsOpeningMessage] = useState(false);

  useEffect(() => {
    const action = new URLSearchParams(search).get("action");
    if (action === "collaborate" && !isMe && data?.user?.id) setIsCollaborateOpen(true);
  }, [search, isMe, data?.user?.id]);

  useEffect(() => {
    let creatorProfileRequestCancelled = false;
    if (creatorIncomeEnabled && data?.user?.username) {
      fetch(`/api/users/${data.user.username}/endorsements`)
        .then(r => r.ok ? r.json() : { endorsements: [] })
        .then((d: { endorsements: Array<{ skill: string; count: number }> }) => {
          const map: Record<string, number> = {};
          const endorsements = Array.isArray(d?.endorsements) ? d.endorsements : [];
          endorsements.forEach((e) => { map[e.skill] = e.count; });
          setEndorsements(map);
        })
        .catch(() => {});
    }
    if (data?.user?.id) {
      setProfileContentLoading(true);
      setProfileContentError(false);
      setProfileContentPage(1);
      setProfileContentPosts([]);
      fetch(`/api/users/${encodeURIComponent(data.user.username)}/posts?page=1&limit=30`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => { if (!r.ok) throw new Error('Could not load profile posts'); return r.json(); })
        .then(d => {
          const posts = Array.isArray(d?.posts) ? d.posts : [];
          setProfileContentPosts(posts.filter((post: ProfilePost) => post.authorId === data.user.id));
          setProfileContentPage(Number(d?.page) || 1);
          setProfileContentHasMore(Boolean(d?.hasMore));
        })
        .catch(() => { setProfileContentPosts([]); setProfileContentHasMore(false); setProfileContentError(true); })
        .finally(() => setProfileContentLoading(false));
    }
    if (creatorIncomeEnabled) {
      const cp = (data as { creatorProfile?: CreatorProfile })?.creatorProfile;
      if (cp) setCreatorProfile(cp);
      else if (data?.user?.username) {
        fetch(`/api/users/${encodeURIComponent(data.user.username)}/creator`)
          .then(response => {
            if (!response.ok) throw new Error("Could not load creator profile");
            return response.json();
          })
          .then((profile: CreatorProfile) => {
            if (!creatorProfileRequestCancelled) {
              setCreatorProfile({
                ...profile,
                skills: profile.skills || [],
                links: profile.links || [],
                availableFor: profile.availableFor || [],
              });
            }
          })
          .catch(error => {
            if (!creatorProfileRequestCancelled) {
              toast({
                title: "Could not load creator profile",
                description: error instanceof Error ? error.message : "Please try again.",
                variant: "destructive",
              });
            }
          });
      }
    } else {
      setCreatorProfile({ skills: [], links: [], verified: false, isAvailableForHire: false, availableFor: [] });
      setEndorsements({});
      setIsEditCreatorOpen(false);
    }

    return () => { creatorProfileRequestCancelled = true; };
  }, [creatorIncomeEnabled, data?.user?.id, data?.user?.username, token, toast, profileContentRetryCount]);

  const loadMoreProfilePosts = async () => {
    if (!data?.user?.username || profileContentLoadingMore || !profileContentHasMore) return;
    const nextPage = profileContentPage + 1;
    setProfileContentLoadingMore(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(data.user.username)}/posts?page=${nextPage}&limit=30`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Could not load more posts');
      const result = await response.json();
      const nextPosts = Array.isArray(result?.posts) ? result.posts.filter((post: ProfilePost) => post.authorId === data.user.id) : [];
      setProfileContentPosts(current => {
        const existingIds = new Set(current.map(post => post.id));
        return [...current, ...nextPosts.filter((post: ProfilePost) => !existingIds.has(post.id))];
      });
      setProfileContentPage(Number(result?.page) || nextPage);
      setProfileContentHasMore(Boolean(result?.hasMore));
    } catch (error) {
      toast({ title: 'Could not load more posts', description: error instanceof Error ? error.message : 'Please retry.', variant: 'destructive' });
    } finally {
      setProfileContentLoadingMore(false);
    }
  };

  const openEditCreator = () => {
    setCreatorForm({
      skills: creatorProfile.skills.join(', '),
      links: creatorProfile.links.map(l => `${l.label}|${l.url}`).join('\n'),
      isAvailableForHire: creatorProfile.isAvailableForHire,
      availableFor: creatorProfile.availableFor || [],
    });
    setIsEditCreatorOpen(true);
  };

  const handleSaveCreator = async () => {
    setIsSavingCreator(true);
    try {
      const skills = creatorForm.skills.split(',').map(s => s.trim()).filter(Boolean);
      const links = creatorForm.links.split('\n').map(l => {
        const [label, url] = l.split('|');
        if (!label || !url) return null;
        const cleanUrl = url.trim();
        return { label: label.trim(), url: /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}` };
      }).filter(Boolean) as { label: string; url: string }[];

      const res = await fetch('/api/users/me/creator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ skills, links, isAvailableForHire: creatorForm.isAvailableForHire, availableFor: creatorForm.availableFor }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setCreatorProfile({ ...updated, skills: updated.skills || [], links: updated.links || [], availableFor: updated.availableFor || [] });
      toast({ title: t('profile.creatorProfileUpdated', 'Creator profile updated!') });
      setIsEditCreatorOpen(false);
    } catch { toast({ title: t('profile.creatorProfileUpdateFailed', 'Failed to update creator profile'), variant: 'destructive' }); }
    finally { setIsSavingCreator(false); }
  };

  const openDirectMessage = async (initialMessage?: string) => {
    if (!data?.user?.id || !currentUser || isOpeningMessage) return;
    setIsOpeningMessage(true);
    try {
      const startRes = await apiFetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id }),
      });
      const startJson = await startRes.json().catch(() => null);
      const conversationId = Number(startJson?.conversationId);
      if (!startRes.ok || !Number.isInteger(conversationId) || conversationId < 1) {
        throw new Error(startJson?.error || 'Could not open this conversation.');
      }

      if (initialMessage) {
        const sendRes = await apiFetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, content: initialMessage }),
        });
        const sendJson = await sendRes.json().catch(() => null);
        if (!sendRes.ok) throw new Error(sendJson?.error || 'Could not send your message.');
      }
      void queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      navigate(`/messages?conv=${conversationId}`);
    } catch (error) {
      toast({
        title: initialMessage ? 'Could not send your message' : t('profile.couldNotOpenChat', 'Could not open chat'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsOpeningMessage(false);
    }
  };

  const handleHireMe = () => openDirectMessage(`Hi ${data?.user?.displayName}, I'm interested in hiring you for a project!`);

  const handleCollaborate = async () => {
    if (!data?.user?.id || !collaborateMsg.trim()) return;
    setIsSendingCollab(true);
    try {
      const res = await fetch('/api/collaboration/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ receiverId: data.user.id, message: collaborateMsg }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: t('profile.collaborationRequestSent', 'Collaboration request sent!') });
      setIsCollaborateOpen(false);
      setCollaborateMsg('');
    } catch { toast({ title: t('profile.collaborationRequestFailed', 'Failed to send request'), variant: 'destructive' }); }
    finally { setIsSendingCollab(false); }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="w-full h-64 bg-muted animate-pulse rounded-b-3xl" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative -top-16">
          <Skeleton className="w-32 h-32 rounded-full border-4 border-background" />
          <div className="mt-4 space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32" /></div>
        </div>
      </AppLayout>
    );
  }

  if (isError && !data) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <p className="font-medium text-foreground">This profile is unavailable right now.</p>
          <p className="mt-2 text-sm text-muted-foreground">Your hive is still here. Try loading this profile again.</p>
          <Button onClick={() => void refetch()} variant="outline" className="mt-5 min-h-11 rounded-xl">Try again</Button>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return <AppLayout><div className="py-20 text-center text-muted-foreground">{t('profile.userNotFound', 'User not found')}</div></AppLayout>;
  }

  const { user } = data;
  const allUserPosts = profileContentPosts.filter(post => post.type !== 'spark');
  const sparkPosts = profileContentPosts.filter(post => post.type === 'spark');

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
        <BackButton />
      </div>
      {/* Cover Photo */}
      <div className="w-full h-48 md:h-72 bg-muted relative md:rounded-b-3xl overflow-hidden shadow-sm">
        {user.coverUrl && !coverImageError ? (
          <img
            src={mediaUrl(user.coverUrl)}
            alt="Cover"
            className="w-full h-full object-cover"
            onError={() => setCoverImageError(true)}
          />
        ) : user.coverUrl && coverImageError ? (
          <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-destructive" role="alert">
            Cover image could not be loaded.
          </div>
        ) : (
          <img src={`${import.meta.env.BASE_URL}images/default-cover.png`} alt="Default Cover" className="w-full h-full object-cover opacity-80" />
        )}
        {isMe && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                input.value = '';
                if (file) handleImageUpload(file, 'cover');
              }}
            />
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="absolute bottom-3 right-3 flex min-h-11 items-center gap-1.5 text-xs font-medium bg-black/65 text-white px-3 py-2 rounded-full hover:bg-black/80 transition-colors"
            >
              {uploadingCover ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading cover…</> : <><Camera className="h-4 w-4" /> Change cover</>}
            </button>
          </>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative -top-16 md:-top-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div className="flex items-end gap-4">
            <Avatar className="relative w-32 h-32 md:w-40 md:h-40 border-4 border-background shadow-xl">
              <AvatarImage src={mediaUrl(user.avatarUrl)} onError={() => setAvatarImageError(true)} />
              <AvatarFallback className="text-4xl bg-primary/10 text-primary font-serif">
                {user.displayName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
              {avatarImageError && <span className="absolute inset-x-0 bottom-8 bg-destructive/90 px-1 py-0.5 text-center text-[9px] font-medium text-white">Photo unavailable</span>}
              {isMe && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const input = e.currentTarget;
                      const file = input.files?.[0];
                      input.value = '';
                      if (file) handleImageUpload(file, 'avatar');
                    }}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label={uploadingAvatar ? 'Uploading profile photo' : 'Change profile photo'}
                    title={uploadingAvatar ? 'Uploading profile photo' : 'Change profile photo'}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
                  >
                    {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </Avatar>
            {creatorIncomeEnabled && creatorProfile.verified && (
              <Badge className="mb-2 bg-primary/10 text-primary border-primary/30 gap-1.5">
                <Sparkles className="w-3 h-3" /> {t('profile.verifiedCreator', 'Verified Creator')}
              </Badge>
            )}
          </div>

        </div>

        {/* User Info */}
        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-serif font-bold text-foreground">{user.displayName}</h1>
            {creatorIncomeEnabled && creatorProfile.isAvailableForHire && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-300 dark:border-amber-700">
                <Zap className="w-3.5 h-3.5" />
                {t('profile.openToOpportunities', '⚡ Available for others to find')}
              </span>
            )}
            {creatorIncomeEnabled && (creatorProfile.availableFor || []).map(af => {
              const opt = AVAILABLE_FOR_OPTIONS.find(o => o.id === af);
              if (!opt) return null;
              return (
                <span key={af} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-medium border border-violet-200 dark:border-violet-800">
                  {opt.icon} {opt.displayLabel}
                </span>
              );
            })}
          </div>

          {user.headline && (
            <p className="text-base font-medium text-primary/90 mt-0.5 mb-1">{user.headline}</p>
          )}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="text-lg text-muted-foreground">@{user.username}</p>
            {user.identityType && (() => {
              const identityLabels: Record<string, string> = {
                everyone: t('profile.member', 'Member'), reader: t('profile.reader', 'Reader'), writer: t('profile.writer', 'Writer'), artist: t('profile.artist', 'Artist'),
                professional: t('profile.professional', 'Professional'), student: t('profile.student', 'Student'), builder: t('profile.builder', 'Builder'), community: t('profile.community', 'Community'),
              };
              const label = identityLabels[user.identityType ?? ''];
              if (!label) return null;
              return (
                <Badge variant="outline" className="text-xs rounded-full px-2.5 py-0.5 bg-primary/5 text-primary border-primary/30">
                  {label}
                </Badge>
              );
            })()}
          </div>

          {user.bio ? (
            <p className="text-foreground/90 max-w-2xl mb-4 leading-relaxed">{user.bio}</p>
          ) : isMe ? (
            <div className="mb-4 flex max-w-2xl flex-col gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Tell people a little about yourself</p>
                <p className="mt-1 text-sm text-muted-foreground">A short bio helps your voice stand out in the hive.</p>
              </div>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="w-full rounded-xl sm:w-auto">Add a bio</Button>
              </Link>
            </div>
          ) : null}

          {/* Skills */}
          {creatorIncomeEnabled && creatorProfile.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {creatorProfile.skills.map(skill => (
                <div key={skill} className="flex items-center gap-1">
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm font-medium bg-primary/8 text-primary border-primary/20">
                    {skill}
                    {(endorsements[skill] ?? 0) > 0 && (
                      <span className="ml-1.5 text-xs font-bold text-primary/60">{endorsements[skill]}</span>
                    )}
                  </Badge>
                  {!isMe && token && (
                    <button
                      onClick={async () => {
                        if (!token) return;
                        await fetch(`/api/users/${username}/endorse`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ skill }),
                        });
                        setEndorsements(prev => ({ ...prev, [skill]: (prev[skill] ?? 0) + 1 }));
                        toast({ title: `${t('profile.endorseSkill', 'Endorsed')} ${skill} ✓` });
                      }}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors border border-border hover:border-primary/40 rounded-full px-2 py-0.5"
                      title={`${t('profile.endorseSkill', 'Endorse')} ${skill}`}
                    >
                      +1
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Links */}
          {creatorIncomeEnabled && creatorProfile.links.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {creatorProfile.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                  <ExternalLink className="w-3.5 h-3.5" /> {link.label}
                </a>
              ))}
            </div>
          )}

          {creatorIncomeEnabled && isMe && creatorProfile.skills.length === 0 && creatorProfile.links.length === 0 && (
            <button onClick={openEditCreator} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5 mb-4 transition-colors">
              <Plus className="w-3.5 h-3.5" /> {t('profile.addSkillsLinks', 'Add skills and links to your profile')}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {user.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {user.location}{user.country ? `, ${user.country}` : ''}</span>}
            {!user.location && user.country && <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> {user.country}</span>}
            {user.website && (
              <a href={user.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                <LinkIcon className="w-4 h-4" /> {user.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {t('profile.joined', 'Joined')} <Timestamp value={user.createdAt} mode="date" /></span>
          </div>

          {/* Social Links */}
          {(user.facebook || user.linkedin || user.twitter || user.instagram) && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {user.facebook && <a href={user.facebook} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground hover:text-primary" aria-label="Facebook"><Facebook className="w-4 h-4" /></a>}
              {user.linkedin && <a href={user.linkedin} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground hover:text-primary" aria-label="LinkedIn"><Linkedin className="w-4 h-4" /></a>}
              {user.twitter && <a href={user.twitter} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground hover:text-primary" aria-label="Twitter"><Twitter className="w-4 h-4" /></a>}
              {user.instagram && <a href={user.instagram} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground hover:text-primary" aria-label="Instagram"><Instagram className="w-4 h-4" /></a>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex flex-col"><span className="text-xl font-bold text-foreground">{user.followersCount}</span><span className="text-sm text-muted-foreground">{t('profile.followers', 'Followers')}</span></div>
            <div className="flex flex-col"><span className="text-xl font-bold text-foreground">{user.followingCount}</span><span className="text-sm text-muted-foreground">{t('profile.following', 'Following')}</span></div>
          </div>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {isMe ? (
            <>
              <Link href="/settings"><Button variant="outline" className="min-h-11 rounded-xl border-border/80"><Pencil className="mr-2 h-4 w-4" />{t('profile.editProfile', 'Edit Profile')}</Button></Link>
              {creatorIncomeEnabled && <Button variant="outline" onClick={openEditCreator} className="min-h-11 rounded-xl gap-2"><Sparkles className="h-4 w-4" />{t('profile.creatorProfile', 'Creator Profile')}</Button>}
              <Link href="/inbox"><Button variant="outline" className="min-h-11 rounded-xl gap-2"><Handshake className="h-4 w-4" />{t('profile.collabInbox', 'Collab Inbox')}</Button></Link>
            </>
          ) : (
            <>
              {creatorIncomeEnabled && creatorProfile.isAvailableForHire && <Button onClick={handleHireMe} disabled={isOpeningMessage} className="min-h-11 rounded-xl gap-2"><Zap className="h-4 w-4" />{t('profile.inviteToCollaborate', 'Message about a project')}</Button>}
              {currentUser && <Button onClick={() => void openDirectMessage()} disabled={isOpeningMessage} variant="outline" className="min-h-11 rounded-xl gap-2"><MessageCircle className="h-4 w-4" />{isOpeningMessage ? 'Opening…' : t('profile.message', 'Message')}</Button>}
              <Button onClick={() => toggleFollow({ username })} disabled={isFollowing} className={`min-h-11 rounded-xl ${user.isFollowing ? 'bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>
                {user.isFollowing ? <><UserCheck className="mr-2 h-4 w-4" />{t('profile.following', 'Following')}</> : <><UserPlus className="mr-2 h-4 w-4" />{t('profile.follow', 'Follow')}</>}
              </Button>
              <Button onClick={() => setIsCollaborateOpen(true)} variant="outline" className="min-h-11 rounded-xl gap-2"><Handshake className="h-4 w-4" />{t('profile.collaborate', 'Request collaboration')}</Button>
              <ReportDialog targetType="user" targetId={user.id} label="Report" />
            </>
          )}
          <Button variant="outline" onClick={() => void shareProfile()} className="min-h-11 rounded-xl gap-2"><Share2 className="h-4 w-4" />Share profile</Button>
        </div>

        {/* Profile Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="sticky top-16 z-20 w-full justify-start border-b border-border rounded-none bg-background/95 p-0 mb-8 h-auto gap-8 overflow-x-auto hide-scrollbar backdrop-blur">
            {[
              { value: 'posts', label: t('profile.recentPosts', 'Recent Posts') },
              { value: 'sparks', label: 'Sparks' },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 pt-2 text-base data-[state=active]:text-foreground text-muted-foreground font-medium whitespace-nowrap">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="posts" className="space-y-6 focus-visible:outline-none">
            {profileContentError ? (
              <div className="rounded-2xl border border-border/60 bg-card px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">Posts could not be loaded. Nothing has been changed.</p>
                <Button variant="outline" className="mt-4 min-h-11 rounded-xl" onClick={() => setProfileContentRetryCount(count => count + 1)}>Try again</Button>
              </div>
            ) : profileContentLoading && profileContentPosts.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : allUserPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                <p className="font-medium text-foreground">{profileContentHasMore ? 'No posts on this page yet.' : isMe ? 'Your voice starts with a post.' : t('profile.noPostsYet', 'No posts here yet.')}</p>
                <p className="mt-2 text-sm text-muted-foreground">{profileContentHasMore ? 'There may be older posts in the hive.' : isMe ? 'Put an idea into words and let it find its people.' : 'Check back when this creator shares something new.'}</p>
                {isMe && !profileContentHasMore && <Link href="/write"><Button className="mt-4 min-h-11 rounded-xl"><Pencil className="mr-2 h-4 w-4" />Write a post</Button></Link>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allUserPosts.map((post) => <PostCard key={post.id} post={post as import('@workspace/api-client-react').Post & { authorTrustTier?: string; authorCreatorLevel?: string | null; authorHireEnabled?: boolean }} hideAnalytics hideBoost hideReputation />)}
              </div>
            )}
            {profileContentHasMore && <div className="text-center"><Button variant="outline" onClick={() => void loadMoreProfilePosts()} disabled={profileContentLoadingMore}>{profileContentLoadingMore ? 'Loading…' : 'Load more posts'}</Button></div>}
          </TabsContent>

          <TabsContent value="sparks" className="space-y-6 focus-visible:outline-none">
            {profileContentError ? (
              <div className="rounded-2xl border border-border/60 bg-card px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">Sparks could not be loaded. Nothing has been changed.</p>
                <Button variant="outline" className="mt-4 min-h-11 rounded-xl" onClick={() => setProfileContentRetryCount(count => count + 1)}>Try again</Button>
              </div>
            ) : profileContentLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : sparkPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                <p className="font-medium text-foreground">{profileContentHasMore ? 'No Sparks on this page yet.' : isMe ? 'A small spark can start something big.' : 'No Sparks here yet.'}</p>
                <p className="mt-2 text-sm text-muted-foreground">{profileContentHasMore ? 'There may be older Sparks to discover.' : isMe ? 'Share a quick thought, a work-in-progress, or a bright idea.' : 'Come back when this creator has a thought to share.'}</p>
                {isMe && !profileContentHasMore && <Link href="/write?type=spark"><Button className="mt-4 min-h-11 rounded-xl"><Sparkles className="mr-2 h-4 w-4" />Share a Spark</Button></Link>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sparkPosts.map(post => (
                  <div key={post.id} className="min-w-0">
                    {isMe && post.visibility && <p className="mb-2 text-xs font-medium text-muted-foreground">Visibility: {post.visibility}</p>}
                    <PostCard post={post as import('@workspace/api-client-react').Post & { authorTrustTier?: string; authorCreatorLevel?: string | null; authorHireEnabled?: boolean }} hideAnalytics hideBoost hideReputation />
                  </div>
                ))}
              </div>
            )}
            {profileContentHasMore && <div className="text-center"><Button variant="outline" className="min-h-11 rounded-xl" onClick={() => void loadMoreProfilePosts()} disabled={profileContentLoadingMore}>{profileContentLoadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</> : 'Load more Sparks'}</Button></div>}
          </TabsContent>
















        </Tabs>
      </div>

      {/* Collaborate Modal */}
      <Dialog open={isCollaborateOpen} onOpenChange={setIsCollaborateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" /> {t('profile.collaborateWith', 'Collaborate with')} {user?.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">{t('profile.collaborateDesc', 'Describe your collaboration idea.')} {user?.displayName} {t('profile.collaborateDescTail', 'will receive your request and can accept or decline.')}</p>
            <Textarea
              placeholder={t('profile.collaboratePlaceholder', `Hi ${user?.displayName}, I'd love to collaborate on...`)}
              value={collaborateMsg}
              onChange={e => setCollaborateMsg(e.target.value)}
              className="rounded-xl min-h-[120px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCollaborateOpen(false)} className="rounded-xl">{t('common.cancel', 'Cancel')}</Button>
            <Button onClick={handleCollaborate} disabled={isSendingCollab || !collaborateMsg.trim()} className="rounded-xl gap-2">
              {isSendingCollab ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />} {t('profile.sendRequest', 'Send Request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Creator Profile Modal */}
      {creatorIncomeEnabled && <Dialog open={isEditCreatorOpen} onOpenChange={setIsEditCreatorOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> {t('profile.profile', 'Profile')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-5">
            <div className="space-y-2">
              <Label>{t('profile.skillsLabel', 'Skills')} <span className="text-muted-foreground text-xs">{t('profile.commaSeparated', '(comma-separated)')}</span></Label>
              <Input
                placeholder={t('profile.skillsPlaceholder', 'e.g., Writing, Photography, Illustration')}
                value={creatorForm.skills}
                onChange={e => setCreatorForm(f => ({ ...f, skills: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('profile.linksLabel', 'Links')} <span className="text-muted-foreground text-xs">{t('profile.onePerLine', '(one per line: Label|URL)')}</span></Label>
              <Textarea
                placeholder={t('profile.linksPlaceholder', "Portfolio|https://mysite.com\nInstagram|https://instagram.com/me")}
                value={creatorForm.links}
                onChange={e => setCreatorForm(f => ({ ...f, links: e.target.value }))}
                className="rounded-xl font-mono text-sm min-h-[100px] resize-none"
              />
            </div>
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <input
                type="checkbox"
                id="hire-toggle"
                checked={creatorForm.isAvailableForHire}
                onChange={e => setCreatorForm(f => ({ ...f, isAvailableForHire: e.target.checked }))}
                className="w-4 h-4 accent-emerald-600"
              />
              <div>
                <label htmlFor="hire-toggle" className="font-medium text-sm cursor-pointer text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> {t('profile.openToOpportunities', 'Open to opportunities')}
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('profile.opportunityReadyDesc', 'Let people find you when you are available for creative work')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('profile.creatorAvailability', 'Availability')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.availabilityDesc', 'Select what types of creative work you\'re available for. These appear as badges on your profile.')}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {AVAILABLE_FOR_OPTIONS.map(opt => {
                  const isSelected = creatorForm.availableFor.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCreatorForm(f => ({
                        ...f,
                        availableFor: isSelected
                          ? f.availableFor.filter(id => id !== opt.id)
                          : [...f.availableFor, opt.id],
                      }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700'
                          : 'bg-muted text-muted-foreground border-border hover:border-violet-300'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditCreatorOpen(false)} className="rounded-xl">{t('common.cancel', 'Cancel')}</Button>
            <Button onClick={handleSaveCreator} disabled={isSavingCreator} className="rounded-xl gap-2">
              {isSavingCreator ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {t('settings.saveBtn', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </AppLayout>
  );
}
