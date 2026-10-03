import { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { 
  useGetGroups, useGetGroup, useJoinGroup, useCreateGroup, useGetGroupPosts 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/post/PostCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Users, Hash, Loader2, ArrowLeft, BadgeCheck, Megaphone, Settings, Trash2, Send, Share2, MoreHorizontal, Copy, LogOut, UserPlus, CircleDot, MessageSquare, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useT } from '@/lib/i18n';

import { GroupMembersList } from '@/components/groups/GroupMembersList';
import { PinnedPosts } from '@/components/groups/PinnedPosts';
import { useAuthStore } from '@/store/auth';
import { apiFetch, apiUrl, mediaUrl } from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { ImageUploadField } from '@/components/media/ImageUploadField';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ReportDialog } from '@/components/report/ReportDialog';
import { getSocket } from '@/lib/socket';
import { copyTextToClipboard } from '@/lib/api';

async function uploadGroupCover(file: File): Promise<string> {
  const uploaded = await uploadFile(file, 'group');
  return uploaded.url;
}

interface GroupView {
  id: number;
  name: string;
  description: string | null;
  category: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  membersCount: number;
  postsCount: number;
  isVerified?: boolean;
  isPromoted?: boolean;
  privacy?: string;
  type?: 'public' | 'private' | 'secret';
  slug?: string;
  iconImage?: string | null;
  coverImage?: string | null;
  tags?: string[];
  memberCount?: number;
  postCount?: number;
  rules?: string[] | null;
  isAnnouncementOnly?: boolean;
  features?: { eventsEnabled: boolean };
  hasPendingJoinRequest?: boolean;
  memberRole?: 'owner' | 'admin' | 'moderator' | 'member' | null;
}

interface GroupMemberPreview {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
}

interface GroupPollData {
  options: string[];
  endsAt: string | null;
  allowMultiple: boolean;
  voteCounts: number[];
  myVotes: number[];
}

function GroupPoll({ groupId, postId, poll }: { groupId: number; postId: number; poll: GroupPollData }) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [choices, setChoices] = useState<number[]>(poll.myVotes ?? []);
  const [isVoting, setIsVoting] = useState(false);
  const totalVotes = poll.voteCounts.reduce((total, count) => total + count, 0);
  const ended = Boolean(poll.endsAt && Date.parse(poll.endsAt) <= Date.now());

  useEffect(() => setChoices(poll.myVotes ?? []), [poll]);

  const toggleChoice = (index: number) => {
    setChoices(current => poll.allowMultiple
      ? current.includes(index) ? current.filter(choice => choice !== index) : [...current, index]
      : [index]);
  };

  const submitVote = async () => {
    if (!token || choices.length === 0 || ended) return;
    setIsVoting(true);
    try {
      const response = await apiFetch(`/api/groups/${groupId}/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndexes: choices }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Could not save your vote.');
      void queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId, 'posts'] });
    } catch (error) {
      toast({ title: 'Could not vote', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsVoting(false);
    }
  };

  return <section className="mt-3 space-y-2 rounded-lg border border-border/70 p-3" aria-label="Group poll">
    {poll.options.map((option, index) => {
      const count = poll.voteCounts[index] ?? 0;
      const percentage = totalVotes ? Math.round(count / totalVotes * 100) : 0;
      return <button key={`${index}-${option}`} type="button" disabled={ended || isVoting} onClick={() => toggleChoice(index)} className={`relative flex min-h-10 w-full items-center justify-between overflow-hidden rounded-md border px-3 text-left text-sm ${choices.includes(index) ? 'border-primary' : 'border-border'}`}>
        <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${percentage}%` }} />
        <span className="relative min-w-0 truncate">{option}</span>
        <span className="relative shrink-0 text-xs text-muted-foreground">{percentage}% · {count}</span>
      </button>;
    })}
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{totalVotes} votes{ended ? ' · Poll ended' : ''}</span>
      {!ended && <Button type="button" size="sm" variant="outline" disabled={isVoting || choices.length === 0} onClick={() => void submitVote()}>{isVoting ? 'Saving...' : 'Vote'}</Button>}
    </div>
  </section>;
}

function GroupQuestion({ groupId, postId, question, canChooseAnswer }: {
  groupId: number;
  postId: number;
  question: { isAnswered: boolean; bestAnswerId: number | null };
  canChooseAnswer: boolean;
}) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Array<{ id: number; content: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadAnswers = async () => {
    const response = await apiFetch(`/api/posts/${postId}/comments`);
    if (!response.ok) return;
    const data = await response.json();
    setAnswers(Array.isArray(data) ? data : []);
    setIsOpen(true);
  };

  const selectAnswer = async (commentId: number) => {
    if (!token) return;
    const response = await apiFetch(`/api/groups/${groupId}/posts/${postId}/best-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return toast({ title: 'Could not select answer', description: result?.error ?? 'Please try again.', variant: 'destructive' });
    void queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId, 'posts'] });
    toast({ title: 'Best answer selected' });
  };

  return <section className="mt-2 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={question.isAnswered ? 'secondary' : 'outline'}>{question.isAnswered ? 'Answered question' : 'Open question'}</Badge>
      {canChooseAnswer && !question.isAnswered && <Button type="button" variant="ghost" size="sm" onClick={() => void loadAnswers()}>Choose best answer</Button>}
    </div>
    {isOpen && <div className="space-y-2 rounded-lg border border-border p-3">
      {answers.length === 0 ? <p className="text-xs text-muted-foreground">No answers yet.</p> : answers.map(answer => <div key={answer.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
        <p className="min-w-0 text-sm">{answer.content}</p>
        {canChooseAnswer && <Button type="button" size="sm" variant="outline" onClick={() => void selectAnswer(answer.id)}>Best answer</Button>}
      </div>)}
    </div>}
  </section>;
}

function GroupDetail({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const t = useT();

  const { data: group, isLoading: groupLoading, refetch } = useGetGroup(id);
  const { data: postsData, isLoading: postsLoading } = useGetGroupPosts(id, {});
  const { token } = useAuthStore();
  const [myRole, setMyRole] = useState<GroupView['memberRole']>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ name: '', description: '', type: 'public', rules: '', coverUrl: '', isAnnouncementOnly: false });
  const [composerType, setComposerType] = useState('discussion');
  const [postContent, setPostContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [feedMode, setFeedMode] = useState('recent');
  const [questionFilter, setQuestionFilter] = useState('unanswered');
  const [membersPreview, setMembersPreview] = useState<GroupMemberPreview[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteUsers, setInviteUsers] = useState<Array<{ id: number; username: string; displayName: string; avatarUrl?: string | null }>>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const { user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!group) return;
    const current = group as GroupView;
    setMyRole(current.memberRole ?? null);
    setSettings({ name: current.name, description: current.description ?? '', type: current.type ?? (current.privacy === 'private' ? 'private' : 'public'), rules: (current.rules ?? []).join('\n'), coverUrl: current.coverImage ?? current.coverUrl ?? '', isAnnouncementOnly: current.isAnnouncementOnly ?? false });
  }, [group]);

  useEffect(() => {
    if (!group) return;
    const current = group as GroupView;
    if (current.type !== 'public' && !group.isMember && user?.role !== 'super_admin') {
      setMembersPreview([]);
      return;
    }
    void apiFetch(`/api/groups/${id}/members`)
      .then(response => response.ok ? response.json() : null)
      .then(data => setMembersPreview((Array.isArray(data?.members) ? data.members : []).filter((member: GroupMemberPreview) => ['active', 'muted'].includes(member.status))))
      .catch(() => setMembersPreview([]));
  }, [id, group, user?.role]);

  useEffect(() => {
    if (!group?.isMember || !user?.id) return;
    const socket = getSocket();
    const onPresence = (event: { groupId: number; onlineCount: number }) => {
      if (event.groupId === id) setOnlineCount(event.onlineCount);
    };
    socket.on('group:presence', onPresence);
    socket.emit('join:group', id);
    return () => {
      socket.emit('leave:group', id);
      socket.off('group:presence', onPresence);
    };
  }, [id, group?.isMember, user?.id]);

  useEffect(() => {
    if (!inviteOpen || inviteSearch.trim().length < 2) {
      setInviteUsers([]);
      return;
    }
    const query = new URLSearchParams({ q: inviteSearch.trim() });
    void apiFetch(`/api/users/search?${query}`)
      .then(response => response.ok ? response.json() : [])
      .then(data => setInviteUsers(Array.isArray(data) ? data.slice(0, 8) : []))
      .catch(() => setInviteUsers([]));
  }, [inviteOpen, inviteSearch]);

  const { mutate: toggleJoin, isPending: isJoining } = useJoinGroup({
    mutation: {
      onSuccess: () => refetch(),
      onError: (error) => toast({ title: 'Could not update membership', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
    }
  });

  const removePost = async (postId: number) => {
    if (!token) return;
    const res = await fetch(`/api/groups/${id}/posts/${postId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      toast({ title: 'Post removed' });
      void queryClient.invalidateQueries({ queryKey: ['/api/groups', id, 'posts'] });
    } else {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      toast({ title: 'Could not remove post', description: data?.error ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const saveSettings = async () => {
    if (!token) return;
    const res = await apiFetch(`/api/groups/${id}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...settings, rules: settings.rules.split('\n').map(rule => rule.trim()).filter(Boolean).slice(0, 5) }) });
    if (!res.ok) return toast({ title: 'Could not update group settings', variant: 'destructive' });
    toast({ title: 'Group settings updated' });
    setSettingsOpen(false);
    void refetch();
  };

  const submitGroupPost = async () => {
    if (!token || !postContent.trim()) return;
    setIsPosting(true);
    try {
      const response = await apiFetch(`/api/groups/${id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: postContent.trim(),
          type: composerType,
          ...(composerType === 'poll' ? { poll: { options: pollOptions, allowMultiple: pollMultiple } } : {}),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Could not publish to this group.');
      setPostContent('');
      setPollOptions(['', '']);
      void queryClient.invalidateQueries({ queryKey: ['/api/groups', id, 'posts'] });
      void refetch();
      toast({ title: 'Added to the community' });
    } catch (error) {
      toast({ title: 'Could not publish', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsPosting(false);
    }
  };

  const toggleEvents = async (eventsEnabled: boolean) => {
    if (!token) return;
    const response = await apiFetch(`/api/groups/${id}/features`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventsEnabled }),
    });
    if (!response.ok) return toast({ title: 'Could not update group features', variant: 'destructive' });
    toast({ title: eventsEnabled ? 'Group events enabled' : 'Group events disabled' });
    void refetch();
  };

  const inviteMember = async (userId: number) => {
    if (!token) return;
    setIsInviting(true);
    try {
      const response = await apiFetch(`/api/groups/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Could not invite this member.');
      setInviteUsers(users => users.filter(candidate => candidate.id !== userId));
      void refetch();
      toast({ title: 'Member invited' });
    } catch (error) {
      toast({ title: 'Could not invite member', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsInviting(false);
    }
  };

  const shareGroup = async () => {
    try {
      await copyTextToClipboard(`${window.location.origin}/g/${(groupView.slug || String(id))}`);
      toast({ title: 'Community link copied' });
    } catch {
      toast({ title: 'Could not copy community link', variant: 'destructive' });
    }
  };

  const reportGroup = async () => {
    const response = await apiFetch('/api/support/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'other', targetId: id, reason: 'spam', category: 'spam', details: reportDetails.trim() || `Report for group ${groupView.name}` }),
    });
    if (!response.ok) return toast({ title: 'Could not submit report', variant: 'destructive' });
    setReportOpen(false);
    setReportDetails('');
    toast({ title: 'Report submitted' });
  };

  if (groupLoading) return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 animate-pulse space-y-4">
        <Skeleton className="w-full h-48 rounded-2xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </AppLayout>
  );

  if (!group) return <AppLayout><div className="py-20 text-center text-muted-foreground">{t('groups.notFound', 'Group not found')}</div></AppLayout>;

  const groupView = group as GroupView;
  const allGroupPosts = (postsData?.posts ?? []) as any[];
  const questions = allGroupPosts.filter(post => post.groupDetails?.type === 'question');
  const now = Date.now();
  let visiblePosts = allGroupPosts;
  if (activeTab === 'questions') {
    visiblePosts = questions.filter(post => questionFilter === 'all' || Boolean(post.groupDetails?.question?.isAnswered) === (questionFilter === 'answered'));
  } else if (activeTab === 'polls') {
    visiblePosts = allGroupPosts.filter(post => post.groupDetails?.type === 'poll' && (!post.groupDetails?.poll?.endsAt || Date.parse(post.groupDetails.poll.endsAt) > now));
  } else if (activeTab === 'announcements') {
    visiblePosts = allGroupPosts.filter(post => post.groupDetails?.type === 'announcement');
  } else if (feedMode === 'unanswered') {
    visiblePosts = questions.filter(post => !post.groupDetails?.question?.isAnswered);
  } else if (feedMode === 'top') {
    visiblePosts = allGroupPosts
      .filter(post => Date.now() - new Date(post.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => Number(b.likesCount ?? b.likeCount ?? 0) - Number(a.likesCount ?? a.likeCount ?? 0));
  }

  const renderGroupPost = (post: any) => <article key={post.id} className={post.groupDetails?.type === 'announcement' ? 'rounded-lg border-l-4 border-amber-500 bg-amber-500/5 pl-3' : ''}>
    {post.groupDetails?.type === 'opportunity_reshare' && <div className="mb-3 rounded-r-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Share2 className="h-3.5 w-3.5" />Opportunity reshared</div>
      <p className="mt-1 font-medium">{post.groupDetails?.opportunitySnapshot?.title}</p>
      {post.groupDetails?.opportunitySnapshot?.budget != null && <p className="mt-1 text-xs text-muted-foreground">Budget {post.groupDetails.opportunitySnapshot.budget}</p>}
    </div>}
    {post.groupDetails?.type === 'announcement' && <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"><Megaphone className="h-3.5 w-3.5" />Announcement</div>}
    <PostCard post={post} />
    {post.groupDetails?.type === 'question' && post.groupDetails?.question && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={post.groupDetails.question.isAnswered ? 'secondary' : 'outline'}>{post.commentsCount ?? 0} answers · {post.groupDetails.question.isAnswered ? 'Answered' : 'Awaiting answer'}</Badge>
      <GroupQuestion groupId={id} postId={post.id} question={post.groupDetails.question} canChooseAnswer={user?.id === post.authorId || myRole === 'owner' || myRole === 'admin' || myRole === 'moderator'} />
    </div>}
    {post.groupDetails?.type === 'poll' && post.groupDetails?.poll && <GroupPoll groupId={id} postId={post.id} poll={post.groupDetails.poll} />}
    {(myRole === 'owner' || myRole === 'admin' || myRole === 'moderator') && <button type="button" title="Remove post" onClick={() => void removePost(post.id)} className="absolute right-3 top-3 rounded-lg border border-border bg-background/90 p-2 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></button>}
  </article>;

  const emptyStates: Record<string, { icon: typeof MessageSquare; title: string; body: string }> = {
    feed: { icon: MessageSquare, title: 'The conversation starts here', body: 'Share a useful idea or question with the community.' },
    questions: { icon: CircleDot, title: 'No questions in this view', body: 'Questions from members will gather here.' },
    polls: { icon: BarChart3, title: 'No active polls', body: 'Active community polls will appear here.' },
    announcements: { icon: Megaphone, title: 'No announcements yet', body: 'Important notes from group moderators will appear here.' },
  };
  const EmptyIcon = emptyStates[activeTab]?.icon ?? MessageSquare;

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-6">
        <Link href="/groups" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('groups.backToGroups', 'Back to Groups')}
        </Link>

        <div className="relative aspect-[16/5] w-full overflow-hidden rounded-xl bg-muted">
          {(groupView.coverImage || group.coverUrl) ? <img src={groupView.coverImage || group.coverUrl || ''} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-primary/10 text-6xl font-serif font-bold text-primary/35">{group.name[0]}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        <header className="relative z-10 -mt-8 flex flex-wrap items-end gap-4 border-b border-border/70 px-2 pb-5 sm:px-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-4 border-background bg-primary/10 text-3xl font-serif font-bold text-primary shadow-sm">
            {(groupView.iconImage || group.avatarUrl) ? <img src={groupView.iconImage || group.avatarUrl || ''} alt="" className="h-full w-full object-cover" /> : group.name[0]}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-serif font-bold">{group.name}</h1>
              {(groupView.isVerified) && <BadgeCheck className="h-5 w-5 text-blue-500" aria-label="Verified community" />}
              <Badge variant="outline" className="capitalize">{groupView.type ?? (groupView.privacy === 'private' ? 'private' : 'public')}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{groupView.memberCount ?? group.membersCount} members</span>
              <span>{groupView.postCount ?? group.postsCount} posts</span>
              {groupView.isPromoted && <Badge variant="secondary">Featured community</Badge>}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">
            {group.isMember ? <Button variant="secondary" disabled>Joined</Button> : groupView.hasPendingJoinRequest ? <Button variant="outline" disabled>Request pending</Button> : groupView.type === 'secret' ? <Badge variant="outline">Invite-only</Badge> : <Button onClick={() => toggleJoin({ id })} disabled={isJoining}>{isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : groupView.type === 'private' ? 'Request to join' : 'Join group'}</Button>}
            <Button variant="outline" onClick={() => setInviteOpen(true)} disabled={!group.isMember} className="gap-1.5"><UserPlus className="h-4 w-4" />Invite</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Community actions"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {group.isMember && <DropdownMenuItem onSelect={() => toggleJoin({ id })}><LogOut className="mr-2 h-4 w-4" />Leave community</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => void shareGroup()}><Copy className="mr-2 h-4 w-4" />Copy community link</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setReportOpen(true)}>Report community</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
          <main className="min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 w-full justify-start overflow-x-auto">
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="questions">Q&amp;A</TabsTrigger>
                <TabsTrigger value="polls">Polls</TabsTrigger>
                <TabsTrigger value="announcements">Announcements</TabsTrigger>
              </TabsList>

              {activeTab === 'feed' && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Community feed</h2>
                <Select value={feedMode} onValueChange={setFeedMode}>
                  <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="recent">Recent</SelectItem><SelectItem value="top">Top · 7 days</SelectItem><SelectItem value="unanswered">Unanswered questions</SelectItem></SelectContent>
                </Select>
              </div>}
              {activeTab === 'questions' && <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Questions and answers</h2>
                <Select value={questionFilter} onValueChange={setQuestionFilter}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="unanswered">Unanswered</SelectItem><SelectItem value="answered">Answered</SelectItem><SelectItem value="all">All questions</SelectItem></SelectContent>
                </Select>
              </div>}
              {activeTab === 'polls' && <h2 className="mb-4 text-sm font-semibold">Active polls</h2>}
              {activeTab === 'announcements' && <h2 className="mb-4 text-sm font-semibold">Announcements</h2>}

              {activeTab === 'feed' && group.isMember && <section className="mb-5 space-y-3 rounded-xl border border-border/70 bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Add to the conversation</h2>
                  <Select value={composerType} onValueChange={setComposerType}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discussion">Discussion</SelectItem><SelectItem value="question">Question</SelectItem><SelectItem value="poll">Poll</SelectItem>
                      {(myRole === 'owner' || myRole === 'admin' || myRole === 'moderator') && <SelectItem value="announcement">Announcement</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea value={postContent} onChange={e => setPostContent(e.target.value)} maxLength={50000} placeholder={composerType === 'question' ? 'What would you like help thinking through?' : composerType === 'announcement' ? 'Write a community announcement...' : 'Start a useful conversation...'} rows={4} />
                {composerType === 'poll' && <div className="space-y-2">
                  {pollOptions.map((option, index) => <Input key={index} value={option} maxLength={120} onChange={e => setPollOptions(items => items.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} placeholder={`Option ${index + 1}`} />)}
                  {pollOptions.length < 10 && <Button type="button" variant="ghost" size="sm" onClick={() => setPollOptions(items => [...items, ''])}>Add option</Button>}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={pollMultiple} onChange={e => setPollMultiple(e.target.checked)} />Allow multiple choices</label>
                </div>}
                <Button onClick={() => void submitGroupPost()} disabled={isPosting || !postContent.trim() || (composerType === 'poll' && pollOptions.filter(option => option.trim()).length < 2)} className="gap-2"><Send className="h-4 w-4" />{isPosting ? 'Publishing...' : 'Publish'}</Button>
              </section>}

              {postsLoading ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}</div> : visiblePosts.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center border-y border-dashed border-border px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"><EmptyIcon className="h-7 w-7" /></div>
                <h3 className="font-semibold">{emptyStates[activeTab]?.title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyStates[activeTab]?.body}</p>
              </div> : activeTab === 'announcements' ? <div className="space-y-5 border-l border-amber-500/40 pl-4">{visiblePosts.map(renderGroupPost)}</div> : <div className="space-y-5">{visiblePosts.map(renderGroupPost)}</div>}
            </Tabs>
          </main>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="space-y-3 border-b border-border/70 pb-4">
              <h2 className="text-sm font-semibold">About</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{group.description || 'A community for shared interests and useful conversations.'}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">Category</dt><dd className="mt-0.5 font-medium">{group.category}</dd></div><div><dt className="text-muted-foreground">Visibility</dt><dd className="mt-0.5 font-medium capitalize">{groupView.type ?? 'public'}</dd></div></dl>
              {groupView.tags?.length ? <div className="flex flex-wrap gap-1">{groupView.tags.map(tag => <Badge variant="secondary" key={tag} className="text-[10px]">{tag}</Badge>)}</div> : null}
              <details className="group border-t border-border/60 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Community rules <span className="text-muted-foreground group-open:rotate-180">⌄</span></summary>
                {(groupView.rules?.length ?? 0) > 0 ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">{groupView.rules?.map((rule, index) => <li key={`${index}-${rule}`}>{rule}</li>)}</ol> : <p className="mt-2 text-xs text-muted-foreground">No rules have been added.</p>}
              </details>
            </section>

            <section className="border-b border-border/70 pb-4"><PinnedPosts groupId={id} myRole={myRole ?? null} /></section>

            <section className="space-y-3 border-b border-border/70 pb-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Members</h2><span className="text-xs text-muted-foreground">{groupView.type === 'public' || groupView.type == null || group.isMember ? `${onlineCount} online now` : ''}</span></div>
              <div className="flex items-center">
                {membersPreview.slice(0, 6).map((member, index) => <Avatar key={member.userId} className={`h-8 w-8 border-2 border-background ${index ? '-ml-2' : ''}`}>
                  <AvatarImage src={member.avatarUrl ?? undefined} /><AvatarFallback className="text-[10px]">{(member.displayName || member.username).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>)}
                {membersPreview.length === 0 && <span className="text-xs text-muted-foreground">Members will appear here.</span>}
              </div>
              <Button variant="ghost" size="sm" className="px-0" onClick={() => setMembersOpen(true)}>View all members</Button>
            </section>

            <section className="space-y-2 border-b border-border/70 pb-4">
              <h2 className="text-sm font-semibold">Opportunity reshares</h2>
              {allGroupPosts.filter(post => post.groupDetails?.type === 'opportunity_reshare').slice(0, 3).map(post => <div key={post.id} className="border-l-2 border-primary/50 py-1 pl-3">
                <p className="line-clamp-2 text-sm font-medium">{post.groupDetails.opportunitySnapshot?.title}</p>
                {post.groupDetails.opportunitySnapshot?.budget != null && <p className="text-xs text-muted-foreground">Budget {post.groupDetails.opportunitySnapshot.budget}</p>}
              </div>)}
              {allGroupPosts.every(post => post.groupDetails?.type !== 'opportunity_reshare') && <p className="text-xs text-muted-foreground">No opportunities reshared yet.</p>}
            </section>

            {(myRole === 'admin' || myRole === 'owner') && <details open={settingsOpen} onToggle={event => setSettingsOpen((event.currentTarget as HTMLDetailsElement).open)} className="border-b border-border/70 pb-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><Settings className="h-4 w-4" />Group settings</summary>
              <div className="mt-3 space-y-3">
                <Input value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} placeholder="Group name" />
                <Textarea maxLength={280} value={settings.description} onChange={e => setSettings(s => ({ ...s, description: e.target.value }))} placeholder="Description, up to 280 characters" />
                <Select value={settings.type} onValueChange={type => setSettings(s => ({ ...s, type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="secret">Secret</SelectItem></SelectContent></Select>
                <Textarea value={settings.rules} onChange={e => setSettings(s => ({ ...s, rules: e.target.value }))} placeholder="Up to five rules, one per line" />
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.isAnnouncementOnly} onChange={e => setSettings(s => ({ ...s, isAnnouncementOnly: e.target.checked }))} />Announcement-only</label>
                <ImageUploadField value={settings.coverUrl} onChange={coverUrl => setSettings(s => ({ ...s, coverUrl }))} category="group" label="Change cover image" />
                <Button size="sm" onClick={() => void saveSettings()}>Save settings</Button>
              </div>
            </details>}
            {user?.role === 'super_admin' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(groupView.features?.eventsEnabled)} onChange={e => void toggleEvents(e.target.checked)} />Enable group events</label>}
          </aside>
        </div>
      </div>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Community members</DialogTitle></DialogHeader><GroupMembersList groupId={id} /></DialogContent>
      </Dialog>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Invite to {group.name}</DialogTitle></DialogHeader>
          <Input value={inviteSearch} onChange={event => setInviteSearch(event.target.value)} placeholder="Find someone by name or username" />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {inviteUsers.map(candidate => <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/60"><div className="min-w-0"><p className="truncate text-sm font-medium">{candidate.displayName || candidate.username}</p><p className="truncate text-xs text-muted-foreground">@{candidate.username}</p></div><Button size="sm" disabled={isInviting} onClick={() => void inviteMember(candidate.id)}>Invite</Button></div>)}
            {inviteSearch.trim().length >= 2 && inviteUsers.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No matching members.</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Report community</DialogTitle></DialogHeader><Textarea value={reportDetails} onChange={event => setReportDetails(event.target.value)} maxLength={2000} placeholder="Tell us what concerns you" /><Button onClick={() => void reportGroup()}>Submit report</Button></DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function GroupsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const t = useT();
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'general', type: 'public', coverUrl: '', iconUrl: '', tags: '', rules: '', isAnnouncementOnly: false });
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const { data, isLoading } = useGetGroups({ search: search || undefined });

  const { mutate: createGroup, isPending: isCreating } = useCreateGroup({
    mutation: {
      onSuccess: (createdGroup) => {
        void queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
        toast({ title: t('groups.groupCreated', 'Group created!'), description: t('groups.groupCreatedDesc', 'Your community is live.') });
        setCreateOpen(false);
        setForm({ name: '', description: '', category: 'general', type: 'public', coverUrl: '', iconUrl: '', tags: '', rules: '', isAnnouncementOnly: false });
        if (fileInputRef.current) fileInputRef.current.value = '';
        setLocation(`/g/${(createdGroup as any).slug || createdGroup.id}`);
      },
      onError: (error) => toast({
        title: t('groups.createFailed', 'Failed to create group'),
        description: error instanceof Error ? error.message : t('common.tryAgain', 'Please try again.'),
        variant: 'destructive',
      })
    }
  });

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image', variant: 'destructive' });
      return;
    }
    setIsUploadingCover(true);
    try {
      const uploadedUrl = await uploadGroupCover(file);
      setForm(current => ({ ...current, coverUrl: uploadedUrl }));
    } catch {
      toast({ title: 'Could not upload cover photo', variant: 'destructive' });
    } finally {
      setIsUploadingCover(false);
      event.target.value = '';
    }
  };

  const { mutate: joinGroup } = useJoinGroup({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/groups'] }),
      onError: (error) => toast({ title: 'Could not update membership', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
    }
  });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-0 py-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold">{t('groups.title', 'Groups & Communities')}</h1>
            <p className="text-muted-foreground mt-1">{t('groups.subtitle', 'Find your people and shared interests')}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="rounded-xl bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> {t('groups.createGroup', 'Create Group')}
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('groups.searchPlaceholder', 'Search groups...')}
            className="pl-11 rounded-2xl h-11 bg-card border-border/60"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
          </div>
        ) : data?.groups.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border text-muted-foreground">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-xl font-serif font-medium mb-2">{t('groups.noGroupsYet', 'No groups yet')}</h3>
            <p className="mb-6 text-sm">{t('groups.startFirstGroup', 'Start the first group for creatives like you.')}</p>
            <Button onClick={() => setCreateOpen(true)} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> {t('groups.createGroup', 'Create Group')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data?.groups.map(group => (
              <div key={group.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all group flex flex-col">
                <div className="h-28 bg-gradient-to-br from-primary/20 to-accent/20 relative">
                  {group.coverUrl ? (
                    <img src={group.coverUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-primary/30 font-serif">
                      {group.name[0]}
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg font-serif group-hover:text-primary transition-colors mb-1 flex items-center gap-1.5">
                    {group.name}
                    {(group as GroupView).isVerified && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/15 shrink-0" />
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <Badge variant="outline" className="capitalize">{(group as GroupView).type ?? ((group as GroupView).privacy === 'private' ? 'private' : 'public')}</Badge>
                    {(group as GroupView).isPromoted && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] uppercase tracking-wider gap-1">
                        <Megaphone className="w-2.5 h-2.5" /> {t('groups.promoted', 'Promoted')}
                      </Badge>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">{group.description}</p>
                  )}
                  {(group as GroupView).tags?.length ? <div className="mb-3 flex flex-wrap gap-1">{(group as GroupView).tags?.slice(0, 4).map(tag => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}</div> : null}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />{group.membersCount} {t('groups.members', 'members')}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link href={`/g/${(group as GroupView).slug || group.id}`}>
                        <Button variant="ghost" size="sm" className="rounded-xl h-8 text-xs">{t('groups.view', 'View')}</Button>
                      </Link>
                      {(group as GroupView).type !== 'secret' || group.isMember ? <Button
                        size="sm"
                        onClick={() => joinGroup({ id: group.id })}
                        className={`rounded-xl h-8 text-xs ${group.isMember ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}
                      >
                        {group.isMember ? t('groups.joined', 'Joined') : t('groups.join', '+ Join')}
                      </Button> : <Badge variant="outline">Invite-only</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border/50">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> {t('groups.createAGroup', 'Create a Group')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t('groups.groupName', 'Group Name *')}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('groups.groupNamePlaceholder', 'e.g. Dark Fiction Writers')} className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label>{t('groups.description', 'Description')}</Label>
              <Textarea maxLength={280} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('groups.descriptionPlaceholder', 'What is this group about?')} className="mt-1.5 rounded-xl resize-none" rows={3} />
            </div>
            <ImageUploadField value={form.iconUrl} onChange={iconUrl => setForm(f => ({ ...f, iconUrl }))} category="group" label="Community icon" />
            <div>
              <Label>{t('groups.coverPhoto', 'Cover photo')}</Label>
              <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="mt-1.5 rounded-xl file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm" />
              {isUploadingCover && <p className="mt-2 text-xs text-muted-foreground">Uploading cover photo...</p>}
              {form.coverUrl && <img src={form.coverUrl} alt="Cover preview" className="mt-3 h-28 w-full rounded-xl object-cover border border-border" />}
            </div>
            <div>
              <Label>Community type</Label>
              <Select value={form.type} onValueChange={type => setForm(f => ({ ...f, type }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="secret">Secret, invite-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} maxLength={80} placeholder="e.g. Writing, research, design" />
            </div>
            <div>
              <Label>Tags</Label>
              <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="Writing, research, design" />
            </div>
            <div>
              <Label>Rules, up to 5</Label>
              <Textarea value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))} placeholder="One rule per line" rows={3} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isAnnouncementOnly} onChange={e => setForm(f => ({ ...f, isAnnouncementOnly: e.target.checked }))} /> Announcement-only community</label>
            <Button
              onClick={() => createGroup({
                data: {
                  name: form.name.trim(),
                  description: form.description || null,
                  category: form.category.trim() || 'general',
                  type: form.type,
                  tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20),
                  rules: form.rules.split('\n').map(rule => rule.trim()).filter(Boolean).slice(0, 5),
                  iconImage: form.iconUrl || null,
                  coverUrl: form.coverUrl || null,
                  isAnnouncementOnly: form.isAnnouncementOnly,
                } as any,
              })}
              disabled={isCreating || isUploadingCover || !form.name.trim()}
              className="w-full rounded-xl"
            >
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {t('groups.createGroup', 'Create Group')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function GroupSlugRoute({ slug }: { slug: string }) {
  const [groupId, setGroupId] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    void apiFetch(`/api/groups/${encodeURIComponent(slug)}`)
      .then(async response => {
        if (!response.ok) throw new Error('Group not found');
        const group = await response.json() as GroupView;
        if (active) setGroupId(group.id);
      })
      .catch(() => { if (active) setNotFound(true); });
    return () => { active = false; };
  }, [slug]);

  if (groupId) return <GroupDetail id={groupId} />;
  if (notFound) return <AppLayout><p className="py-20 text-center text-muted-foreground">Group not found</p></AppLayout>;
  return <AppLayout><div className="mx-auto max-w-4xl space-y-4 p-4"><Skeleton className="aspect-[16/5] w-full" /><Skeleton className="h-10 w-64" /></div></AppLayout>;
}

export default function Groups() {
  const [, groupParams] = useRoute('/groups/:id');
  const [, slugParams] = useRoute('/g/:slug');
  if (slugParams?.slug) return <GroupSlugRoute slug={slugParams.slug} />;
  const groupId = groupParams?.id ? Number.parseInt(groupParams.id, 10) : null;
  if (groupId && Number.isInteger(groupId)) return <GroupDetail id={groupId} />;
  return <GroupsList />;
}
