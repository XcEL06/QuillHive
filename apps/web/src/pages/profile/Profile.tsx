import { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useGetUserByUsername, useFollowUser } from '@workspace/api-client-react';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/post/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AchievementBadgeRow from '@/components/profile/AchievementBadgeRow';
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
  MessageCircle, Zap, Rocket, TrendingUp, Camera,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch, apiUrl, getStoredToken, mediaUrl } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { useT } from '@/lib/i18n';
import { CreatorLevelBadge } from '@/components/trust/CreatorLevelBadge';
import { BackButton } from '@/components/ui/BackButton';
import { ReportDialog } from '@/components/report/ReportDialog';

interface CreatorProfile {
  skills: string[]; links: { label: string; url: string }[];
  verified: boolean; isAvailableForHire: boolean; availableFor: string[];
}

interface ProfilePost {
  id: number;
  authorId?: number;
  type: string;
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
  const [location, navigate] = useLocation();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const username = profileParams?.username || publicParams?.username || currentUser?.username || '';
  const { toast } = useToast();
  const t = useT();
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

  const { data: rawData, isLoading, refetch } = useGetUserByUsername(username);
  const data = rawData as ExtendedProfileData | undefined;
  const { mutate: toggleFollow, isPending: isFollowing } = useFollowUser({ mutation: { onSuccess: () => refetch() } });

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

  // Creator profile state
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>({ skills: [], links: [], verified: false, isAvailableForHire: false, availableFor: [] });
  const [isEditCreatorOpen, setIsEditCreatorOpen] = useState(false);
  const [creatorForm, setCreatorForm] = useState({ skills: '', links: '', isAvailableForHire: false, availableFor: [] as string[] });
  const [isSavingCreator, setIsSavingCreator] = useState(false);

  // Trust state
  const [profileTrust, setProfileTrust] = useState<{ creatorLevel?: string } | null>(null);

  // Collaboration state
  const [isCollaborateOpen, setIsCollaborateOpen] = useState(false);
  const [collaborateMsg, setCollaborateMsg] = useState('');
  const [isSendingCollab, setIsSendingCollab] = useState(false);

  useEffect(() => {
    const action = new URLSearchParams(location.split("?")[1] ?? "").get("action");
    if (action === "collaborate" && !isMe && data?.user?.id) setIsCollaborateOpen(true);
  }, [location, isMe, data?.user?.id]);

  useEffect(() => {
    if (data?.user?.username) {
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
        .catch(() => { setProfileContentPosts([]); setProfileContentHasMore(false); })
        .finally(() => setProfileContentLoading(false));
      fetch(`/api/trust/${data.user.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setProfileTrust({ creatorLevel: d.creatorLevel }); })
        .catch(() => {});
    }
    const cp = (data as { creatorProfile?: CreatorProfile })?.creatorProfile;
    if (cp) setCreatorProfile(cp);

  }, [data?.user?.id, data?.user?.username, token]);

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

  const handleHireMe = async () => {
    if (!data?.user?.id) return;
    try {
      const startRes = await fetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: data.user.id }),
      });
      const startJson = await startRes.json();
      const convId = startJson.conversationId;
      if (convId) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ conversationId: convId, content: `Hi ${data.user.displayName}, I'm interested in hiring you for a project!`, type: 'hire_request' }),
        });
      }
      navigate(`/messages?conv=${convId}`);
    } catch { toast({ title: t('profile.couldNotOpenChat', 'Could not open chat'), variant: 'destructive' }); }
  };

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
              className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs font-medium bg-black/60 text-white px-3 py-1.5 rounded-full hover:bg-black/75 transition-colors"
            >
              {uploadingCover ? 'Uploading...' : 'Change cover'}
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
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </Avatar>
            {creatorProfile.verified && (
              <Badge className="mb-2 bg-primary/10 text-primary border-primary/30 gap-1.5">
                <Sparkles className="w-3 h-3" /> {t('profile.verifiedCreator', 'Verified Creator')}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isMe ? (
              <>
                <Link href="/settings">
                  <Button variant="outline" className="rounded-xl border-border/80">{t('profile.editProfile', 'Edit Profile')}</Button>
                </Link>
                <Button variant="outline" onClick={openEditCreator} className="rounded-xl gap-2">
                  <Pencil className="w-4 h-4" /> {t('profile.creatorProfile', 'Creator Profile')}
                </Button>
                <Link href="/inbox">
                  <Button variant="outline" className="rounded-xl gap-2">
                    <Handshake className="w-4 h-4" /> {t('profile.collabInbox', 'Collab Inbox')}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                {creatorProfile.isAvailableForHire && (
                  <Button onClick={handleHireMe} className="rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/30 font-semibold">
                    <Zap className="w-4 h-4" /> {t('profile.inviteToCollaborate', 'Message about a project')}
                  </Button>
                )}
                <Button onClick={() => setIsCollaborateOpen(true)} variant="outline" className="rounded-xl gap-2 border-primary/50 text-primary hover:bg-primary/5">
                  <Handshake className="w-4 h-4" /> {t('profile.collaborate', 'Request collaboration')}
                </Button>
                {currentUser && (
                  <Button onClick={handleHireMe} variant="outline" className="rounded-xl gap-2 border-border/60 hover:border-primary/40">
                    <MessageCircle className="w-4 h-4" /> {t('profile.message', 'Message')}
                  </Button>
                )}
                <Button
                  onClick={() => toggleFollow({ username })}
                  disabled={isFollowing}
                  className={`rounded-xl shadow-md transition-all ${user.isFollowing ? 'bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground' : 'bg-primary text-primary-foreground hover:-translate-y-0.5'}`}
                >
                  {user.isFollowing ? <><UserCheck className="w-4 h-4 mr-2" />{t('profile.following', 'Following')}</> : <><UserPlus className="w-4 h-4 mr-2" />{t('profile.follow', 'Follow')}</>}
                </Button>
                <ReportDialog targetType="user" targetId={user.id} label="Report" />
              </>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-serif font-bold text-foreground">{user.displayName}</h1>
            <CreatorLevelBadge level={profileTrust?.creatorLevel} size="sm" />
            {creatorProfile.isAvailableForHire && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-300 dark:border-amber-700">
                <Zap className="w-3.5 h-3.5" />
                {t('profile.openToOpportunities', '⚡ Available for others to find')}
              </span>
            )}
            {(creatorProfile.availableFor || []).map(af => {
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
          {creatorProfile.skills.length > 0 && (
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
          {creatorProfile.links.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {creatorProfile.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                  <ExternalLink className="w-3.5 h-3.5" /> {link.label}
                </a>
              ))}
            </div>
          )}

          {isMe && creatorProfile.skills.length === 0 && creatorProfile.links.length === 0 && (
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
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {t('profile.joined', 'Joined')} {format(new Date(user.createdAt), 'MMM yyyy')}</span>
          </div>

          {/* Social Links */}
          {(user.facebook || user.linkedin || user.twitter || user.instagram) && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {user.facebook && <a href={user.facebook} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center hover:scale-110 transition-transform" aria-label="Facebook"><Facebook className="w-4 h-4 text-blue-600" /></a>}
              {user.linkedin && <a href={user.linkedin} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center hover:scale-110 transition-transform" aria-label="LinkedIn"><Linkedin className="w-4 h-4 text-blue-700" /></a>}
              {user.twitter && <a href={user.twitter} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-110 transition-transform" aria-label="Twitter"><Twitter className="w-4 h-4 text-slate-700 dark:text-slate-300" /></a>}
              {user.instagram && <a href={user.instagram} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800 flex items-center justify-center hover:scale-110 transition-transform" aria-label="Instagram"><Instagram className="w-4 h-4 text-pink-600" /></a>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex flex-col"><span className="text-xl font-bold text-foreground">{user.followersCount}</span><span className="text-sm text-muted-foreground">{t('profile.followers', 'Followers')}</span></div>
            <div className="flex flex-col"><span className="text-xl font-bold text-foreground">{user.followingCount}</span><span className="text-sm text-muted-foreground">{t('profile.following', 'Following')}</span></div>
          </div>
        </div>

        {/* Growth CTA for owner */}
        {isMe && (
          <div className="mb-6 bg-gradient-to-r from-primary/8 via-violet-500/5 to-transparent border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Grow your creator presence</p>
                <p className="text-xs text-muted-foreground truncate">Post, get discovered, and boost your reach across QuillHive.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/write">
                <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                  <Zap className="w-3.5 h-3.5" /> Post
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="sm" className="rounded-xl text-xs gap-1.5 bg-gradient-to-r from-primary to-violet-500 border-0 text-white">
                  <Rocket className="w-3.5 h-3.5" /> Boost
                </Button>
              </Link>
            </div>
          </div>
        )}

        {data?.user?.username && <div className="mb-8"><AchievementBadgeRow username={data.user.username} isMe={isMe} /></div>}

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
            {profileContentLoading && profileContentPosts.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : allUserPosts.length === 0 ? (
              <p className="text-muted-foreground text-center py-10 bg-muted/20 rounded-2xl">{profileContentHasMore ? 'No posts on this page yet. Load more to check older posts.' : t('profile.noPostsYet', 'This person has no posts yet.')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allUserPosts.map((post) => <PostCard key={post.id} post={post as import('@workspace/api-client-react').Post & { authorTrustTier?: string; authorCreatorLevel?: string | null; authorHireEnabled?: boolean }} />)}
              </div>
            )}
            {profileContentHasMore && <div className="text-center"><Button variant="outline" onClick={() => void loadMoreProfilePosts()} disabled={profileContentLoadingMore}>{profileContentLoadingMore ? 'Loading…' : 'Load more posts'}</Button></div>}
          </TabsContent>

          <TabsContent value="sparks" className="space-y-6 focus-visible:outline-none">
            {profileContentLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : sparkPosts.length === 0 ? (
              <p className="text-muted-foreground text-center py-10 bg-muted/20 rounded-2xl">{profileContentHasMore ? 'No Sparks on this page yet. Load more to check older Sparks.' : 'This person has no Sparks yet.'}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sparkPosts.map(post => <PostCard key={post.id} post={post as import('@workspace/api-client-react').Post & { authorTrustTier?: string; authorCreatorLevel?: string | null; authorHireEnabled?: boolean }} />)}
              </div>
            )}
            {profileContentHasMore && <div className="text-center"><Button variant="outline" onClick={() => void loadMoreProfilePosts()} disabled={profileContentLoadingMore}>{profileContentLoadingMore ? 'Loading…' : 'Load more Sparks'}</Button></div>}
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
      <Dialog open={isEditCreatorOpen} onOpenChange={setIsEditCreatorOpen}>
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
      </Dialog>
    </AppLayout>
  );
}
