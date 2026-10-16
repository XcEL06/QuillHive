import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Timestamp } from '@/lib/postTimestamp';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Users, Hash, Loader2, ArrowLeft, BadgeCheck, Megaphone, Settings, Trash2, Send, Share2, MoreHorizontal, Copy, LogOut, UserPlus, CircleDot, MessageSquare, BarChart3, Bold, Italic, List, ListOrdered, ImagePlus, AtSign, Pin, Archive, MessageCircleOff, Flag, Check, X, Compass, Redo2 } from 'lucide-react';
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
  privacy?: 'open' | 'public' | 'private';
  type?: 'public' | 'private' | 'secret';
  slug?: string;
  iconImage?: string | null;
  coverImage?: string | null;
  tags?: string[];
  memberCount?: number;
  postCount?: number;
  rules?: string[] | null;
  isAnnouncementOnly?: boolean;
  requireApprovalFirstThree?: boolean;
  requireApprovalAll?: boolean;
  minJoinReputation?: number | null;
  minPostReputation?: number | null;
  minReviewBypassReputation?: number | null;
  announcementPolicy?: 'owner' | 'admins';
  features?: { eventsEnabled: boolean };
  hasPendingJoinRequest?: boolean;
  isMember?: boolean;
  memberRole?: 'owner' | 'admin' | 'moderator' | 'member' | null;
  createdAt?: Date | string;
}

interface GroupMemberPreview {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
}

interface JoinRequestPreview {
  id: number;
  userId: number;
  createdAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  trustScore: number | null;
  reviewReason?: string | null;
}

interface GroupPollData {
  options: string[];
  endsAt: string | null;
  allowMultiple: boolean;
  voteCounts: number[];
  myVotes: number[];
}

interface MentionCandidate {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
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
      {!ended && <Button type="button" size="sm" variant="outline" disabled={!token || isVoting || choices.length === 0} onClick={() => void submitVote()}>{isVoting ? 'Saving...' : 'Vote'}</Button>}
    </div>
  </section>;
}

function GroupActivityTimeline({ groupId }: { groupId: number }) {
  const [activity, setActivity] = useState<Array<{ id: number; actorName: string | null; actorUsername: string | null; action: string; createdAt: string }>>([]);
  useEffect(() => {
    let active = true;
    void apiFetch(`/api/groups/${groupId}/activity`)
      .then(response => response.ok ? response.json() : { activity: [] })
      .then(data => { if (active) setActivity(Array.isArray(data.activity) ? data.activity : []); });
    return () => { active = false; };
  }, [groupId]);
  const labels: Record<string, string> = {
    member_joined: 'joined the group',
    member_muted: 'muted a member',
    member_unmuted: 'unmuted a member',
    member_removed: 'removed a member',
    member_banned: 'banned a member',
    member_role_changed: 'updated a member role',
    post_pinned: 'pinned a post',
    post_unpinned: 'unpinned a post',
    announcement_posted: 'posted an announcement',
    post_approved: 'approved a post',
    post_rejected: 'rejected a post',
    post_archived: 'archived a post',
    post_restored: 'restored a post',
    group_archived: 'archived the group',
    join_request_created: 'requested to join',
    join_request_cancelled: 'cancelled a join request',
    poll_ended: 'Poll ended',
  };
  if (activity.length === 0) return <p className="text-xs text-muted-foreground">No recent activity.</p>;
  return <ol className="space-y-3">{activity.map(item => {
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(item.createdAt)) / 60000));
    const ago = minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
    return <li key={item.id} className="flex items-start justify-between gap-3 text-xs"><span>{item.action === 'poll_ended' ? labels[item.action] : <>
      {item.actorUsername ? (
        <Link href={`/u/${encodeURIComponent(item.actorUsername)}`} className="font-semibold text-foreground hover:text-primary hover:underline">
          {item.actorName || `@${item.actorUsername}`}
        </Link>
      ) : (
        <strong>{item.actorName || 'A member'}</strong>
      )}{' '}{labels[item.action] ?? item.action.replace(/_/g, ' ')}
    </>}</span><time className="shrink-0 text-muted-foreground">{ago}</time></li>;
  })}</ol>;
}

function GroupPostActions({ groupId, postId, isAuthor, canModerate, isPinned, isArchived = false, commentsEnabled, onChanged, children }: {
  groupId: number;
  postId: number;
  isAuthor: boolean;
  canModerate: boolean;
  isPinned: boolean;
  isArchived?: boolean;
  commentsEnabled: boolean;
  onChanged: () => void;
  children: (actions: Array<{ label: string; icon: ComponentType<{ className?: string }>; onSelect: () => void }>) => ReactNode;
}) {
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');

  const run = async (path: string, method: string, body?: unknown) => {
    const response = await apiFetch(path, {
      method,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error ?? 'Could not update this post.');
    }
    onChanged();
  };

  const handleReport = async () => {
    try {
      await run(`/api/groups/${groupId}/posts/${postId}/report`, 'POST', { reason: reportReason });
      setReportOpen(false);
      toast({ title: 'Report sent to group moderators' });
    } catch (error) {
      toast({ title: 'Could not report post', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const runWithToast = (path: string, method: string, successTitle: string, body?: unknown) => {
    void run(path, method, body)
      .then(() => toast({ title: successTitle }))
      .catch(error => toast({ title: 'Could not update post', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }));
  };
  const actions = [
    ...(canModerate ? [{
      label: isPinned ? 'Unpin post' : 'Pin post',
      icon: Pin,
      onSelect: () => runWithToast(`/api/groups/${groupId}/posts/${postId}/pin`, isPinned ? 'DELETE' : 'POST', isPinned ? 'Post unpinned' : 'Post pinned'),
    }] : []),
    ...((isAuthor || canModerate) ? [
      { label: isArchived ? 'Restore post' : 'Archive post', icon: isArchived ? Redo2 : Archive, onSelect: () => runWithToast(`/api/groups/${groupId}/posts/${postId}/archive`, isArchived ? 'DELETE' : 'POST', isArchived ? 'Post restored' : 'Post archived') },
      { label: commentsEnabled ? 'Turn off comments' : 'Turn on comments', icon: MessageCircleOff, onSelect: () => runWithToast(`/api/groups/${groupId}/posts/${postId}/comments`, 'PATCH', commentsEnabled ? 'Comments turned off' : 'Comments turned on', { enabled: !commentsEnabled }) },
    ] : []),
    { label: 'Report to group moderators', icon: Flag, onSelect: () => setReportOpen(true) },
  ];

  return <>
    {children(actions)}
    <Dialog open={reportOpen} onOpenChange={setReportOpen}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Report group post</DialogTitle><DialogDescription>Your report goes to the group moderators first.</DialogDescription></DialogHeader>
        <Select value={reportReason} onValueChange={setReportReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="spam">Spam</SelectItem><SelectItem value="harassment">Harassment</SelectItem><SelectItem value="off_topic">Off-topic</SelectItem><SelectItem value="scam_reshare">Scam reshare</SelectItem></SelectContent></Select>
        <Button onClick={() => void handleReport()}>Submit report</Button>
      </DialogContent>
    </Dialog>
  </>;
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
      <Badge variant="outline" className={question.isAnswered ? 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300' : ''}>{question.isAnswered ? 'Answered question' : 'Open question'}</Badge>
      {canChooseAnswer && !question.isAnswered && <Button type="button" variant="ghost" size="sm" onClick={() => void loadAnswers()}>Choose best answer</Button>}
    </div>
    {isOpen && <div className="space-y-2 rounded-lg border border-border p-3">
      {answers.length === 0 ? <p className="text-xs text-muted-foreground">No answers yet.</p> : [...answers].sort((a, b) => Number(b.id === question.bestAnswerId) - Number(a.id === question.bestAnswerId)).map(answer => <div key={answer.id} className={`flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0 ${answer.id === question.bestAnswerId ? 'rounded-md border-l-2 border-emerald-600 bg-emerald-600/5 pl-3' : ''}`}>
        <div className="min-w-0 space-y-1"><p className="text-sm">{answer.content}</p>{answer.id === question.bestAnswerId && <Badge className="border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">Best answer</Badge>}</div>
        {canChooseAnswer && !question.isAnswered && <Button type="button" size="sm" variant="outline" onClick={() => void selectAnswer(answer.id)}>Best answer</Button>}
      </div>)}
    </div>}
  </section>;
}

function GroupDetail({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const t = useT();
  const [location, setLocation] = useLocation();

  const { data: group, isLoading: groupLoading, isError: groupError, refetch } = useGetGroup(id);
  const [postsPage, setPostsPage] = useState(1);
  const [loadedPosts, setLoadedPosts] = useState<any[]>([]);
  const [pinnedRefreshKey, setPinnedRefreshKey] = useState(0);
  const { data: postsData, isLoading: postsLoading, isError: postsError, refetch: refetchPosts } = useGetGroupPosts(id, { page: postsPage });
  const { token } = useAuthStore();
  const [myRole, setMyRole] = useState<GroupView['memberRole']>(null);
  const [settings, setSettings] = useState({
    name: '', description: '', privacy: 'open', rules: '', coverUrl: '', iconUrl: '',
    isAnnouncementOnly: false, requireApprovalFirstThree: false, requireApprovalAll: false,
    announcementPolicy: 'admins', minJoinReputation: '', minPostReputation: '',
    minReviewBypassReputation: '',
  });
  const [composerType, setComposerType] = useState('discussion');
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [questionTags, setQuestionTags] = useState('');
  const [postAttachments, setPostAttachments] = useState<Array<{ url: string; mimeType: string; filename: string; sizeBytes: number }>>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [pollDuration, setPollDuration] = useState('1d');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [archivedPosts, setArchivedPosts] = useState<any[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [archivedRefreshKey, setArchivedRefreshKey] = useState(0);
  const [joinRequests, setJoinRequests] = useState<JoinRequestPreview[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [moderationReports, setModerationReports] = useState<Array<{ id: number; targetId: number; reason: string; postTitle: string | null; reporterName: string | null; reporterUsername: string | null; createdAt: string }>>([]);
  const [activeTab, setActiveTab] = useState('feed');
  const [feedMode, setFeedMode] = useState('recent');
  const [questionFilter, setQuestionFilter] = useState('unanswered');
  const [membersPreview, setMembersPreview] = useState<GroupMemberPreview[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [membersOpen, setMembersOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<'archive' | 'delete' | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteUsers, setInviteUsers] = useState<Array<{ id: number; username: string; displayName: string; avatarUrl?: string | null }>>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [StarterKit, Underline, Placeholder.configure({ placeholder: composerType === 'question' ? 'Add details (optional)...' : 'Write something…' })],
    content: '',
    onUpdate: ({ editor: updatedEditor }) => setPostContent(updatedEditor.getHTML()),
    editorProps: { attributes: { class: 'min-h-32 px-3 py-2 text-sm focus:outline-none' } },
  });

  useEffect(() => {
    if (!group) return;
    const current = group as GroupView;
    setMyRole(current.memberRole ?? null);
    setSettings({
      name: current.name,
      description: current.description ?? '',
      privacy: current.privacy ?? (current.type === 'secret' ? 'private' : current.type === 'private' ? 'public' : 'open'),
      rules: (current.rules ?? []).join('\n'),
      coverUrl: current.coverImage ?? current.coverUrl ?? '',
      iconUrl: current.iconImage ?? current.avatarUrl ?? '',
      isAnnouncementOnly: current.isAnnouncementOnly ?? false,
      requireApprovalFirstThree: current.requireApprovalFirstThree ?? false,
      requireApprovalAll: current.requireApprovalAll ?? false,
      announcementPolicy: current.announcementPolicy ?? 'admins',
      minJoinReputation: current.minJoinReputation == null ? '' : String(current.minJoinReputation),
      minPostReputation: current.minPostReputation == null ? '' : String(current.minPostReputation),
      minReviewBypassReputation: current.minReviewBypassReputation == null ? '' : String(current.minReviewBypassReputation),
    });
  }, [group]);

  useEffect(() => {
    setPostsPage(1);
    setLoadedPosts([]);
    setActiveTab('feed');
    setComposerType('discussion');
    setIsComposerExpanded(false);
  }, [id]);

  useEffect(() => {
    if (composerType !== 'announcement') return;
    const current = group as GroupView | undefined;
    const allowed = myRole === 'owner' || (myRole === 'admin' && current?.announcementPolicy !== 'owner');
    if (!allowed) setComposerType('discussion');
  }, [composerType, group, myRole]);

  useEffect(() => {
    if (!postsData) return;
    const pagePosts = Array.isArray(postsData.posts) ? postsData.posts : [];
    setLoadedPosts(current => {
      if (postsPage === 1) return pagePosts;
      const existingIds = new Set(current.map(post => post.id));
      return [...current, ...pagePosts.filter(post => !existingIds.has(post.id))];
    });
  }, [postsData, postsPage]);

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
    if (!token || !['owner', 'admin', 'moderator'].includes(myRole ?? '')) {
      setPendingPosts([]);
      return;
    }
    setPendingLoading(true);
    void apiFetch(`/api/groups/${id}/pending-posts`)
      .then(response => response.ok ? response.json() : { posts: [] })
      .then(data => setPendingPosts(Array.isArray(data.posts) ? data.posts : []))
      .finally(() => setPendingLoading(false));
  }, [id, myRole, token]);

  useEffect(() => {
    if (!token || (!['owner', 'admin', 'moderator'].includes(myRole ?? '') && user?.role !== 'super_admin')) {
      setArchivedPosts([]);
      setArchivedError(null);
      return;
    }
    let active = true;
    setArchivedLoading(true);
    setArchivedError(null);
    void apiFetch(`/api/groups/${id}/archived-posts`)
      .then(async response => {
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? 'Could not load archived group posts.');
        }
        return response.json();
      })
      .then(data => { if (active) setArchivedPosts(Array.isArray(data?.posts) ? data.posts : []); })
      .catch(error => { if (active) setArchivedError(error instanceof Error ? error.message : 'Could not load archived group posts.'); })
      .finally(() => { if (active) setArchivedLoading(false); });
    return () => { active = false; };
  }, [id, myRole, token, user?.role, archivedRefreshKey]);

  useEffect(() => {
    if (!token || (myRole !== 'owner' && myRole !== 'admin')) {
      setJoinRequests([]);
      return;
    }
    setJoinRequestsLoading(true);
    void apiFetch(`/api/groups/${id}/join-requests`)
      .then(response => response.ok ? response.json() : { requests: [] })
      .then(data => setJoinRequests(Array.isArray(data.requests) ? data.requests : []))
      .finally(() => setJoinRequestsLoading(false));
  }, [id, myRole, token]);

  useEffect(() => {
    if (!token || !['owner', 'admin', 'moderator'].includes(myRole ?? '')) {
      setModerationReports([]);
      return;
    }
    void apiFetch(`/api/groups/${id}/reports`)
      .then(response => response.ok ? response.json() : { reports: [] })
      .then(data => setModerationReports(Array.isArray(data.reports) ? data.reports : []));
  }, [id, myRole, token]);

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
    if (!window.confirm('Permanently delete this group post? This cannot be undone.')) return;
    const res = await fetch(`/api/groups/${id}/posts/${postId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      toast({ title: 'Post removed' });
      void queryClient.invalidateQueries({ queryKey: ['/api/groups', id, 'posts'] });
    } else {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      toast({ title: 'Could not remove post', description: data?.error ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const reviewPendingPost = async (postId: number, decision: 'approve' | 'reject') => {
    const response = await apiFetch(`/api/groups/${id}/posts/${postId}/approval`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
    });
    if (!response.ok) return toast({ title: 'Could not review post', variant: 'destructive' });
    setPendingPosts(posts => posts.filter(post => post.id !== postId));
    void queryClient.invalidateQueries({ queryKey: ['/api/groups', id, 'posts'] });
    toast({ title: decision === 'approve' ? 'Post approved' : 'Post rejected' });
  };

  const reviewJoinRequest = async (requestId: number, decision: 'approve' | 'deny') => {
    const response = await apiFetch(`/api/groups/${id}/join-requests/${requestId}/${decision}`, { method: 'POST' });
    const result = await response.json().catch(() => null);
    if (!response.ok) return toast({ title: 'Could not review join request', description: result?.error ?? 'Please try again.', variant: 'destructive' });
    setJoinRequests(requests => requests.filter(request => request.id !== requestId));
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
    toast({ title: decision === 'approve' ? 'Join request approved' : 'Join request denied' });
  };

  const reviewGroupReport = async (reportId: number, decision: 'dismiss' | 'remove_post' | 'escalate') => {
    if (decision === 'remove_post' && !window.confirm('Permanently delete the reported group post? This cannot be undone.')) return;
    const response = await apiFetch(`/api/groups/${id}/reports/${reportId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
    });
    if (!response.ok) return toast({ title: 'Could not resolve report', variant: 'destructive' });
    setModerationReports(reports => reports.filter(report => report.id !== reportId));
    void queryClient.invalidateQueries({ queryKey: ['/api/groups', id, 'posts'] });
  };

  const searchMentionCandidates = async (query: string) => {
    setMentionQuery(query);
    if (query.trim().length < 1) {
      setMentionCandidates([]);
      return;
    }
    try {
      const response = await apiFetch(`/api/mentions/search?q=${encodeURIComponent(query.trim())}`);
      const users = response.ok ? await response.json() : [];
      setMentionCandidates(Array.isArray(users) ? users.slice(0, 6) : []);
    } catch {
      setMentionCandidates([]);
    }
  };

  const insertMention = (candidate: MentionCandidate) => {
    editor?.chain().focus().insertContent(`@${candidate.username} `).run();
    setMentionOpen(false);
    setMentionQuery('');
    setMentionCandidates([]);
  };

  const uploadPostImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (postAttachments.length + selected.length > 4) {
      toast({ title: 'Maximum four images', description: 'Remove an image before adding another.', variant: 'destructive' });
      return;
    }
    if (selected.some(file => !file.type.startsWith('image/'))) {
      toast({ title: 'Images only', description: 'Group discussions support image uploads only.', variant: 'destructive' });
      return;
    }
    setIsUploadingImages(true);
    try {
      const uploaded = await Promise.all(selected.map(async file => {
        const result = await uploadFile(file, 'post');
        return { url: result.url, mimeType: file.type, filename: file.name, sizeBytes: file.size };
      }));
      setPostAttachments(current => [...current, ...uploaded].slice(0, 4));
    } catch (error) {
      toast({ title: 'Image upload failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsUploadingImages(false);
      if (groupImageInputRef.current) groupImageInputRef.current.value = '';
    }
  };

  const saveSettings = async () => {
    if (!token) return;
    const threshold = (value: string) => value.trim() === '' ? null : Number(value);
    const payload = {
      name: settings.name,
      description: settings.description,
      rules: settings.rules.split('\n').map(rule => rule.trim()).filter(Boolean).slice(0, 5),
      coverUrl: settings.coverUrl,
      iconUrl: settings.iconUrl,
      isAnnouncementOnly: settings.isAnnouncementOnly,
      requireApprovalFirstThree: settings.requireApprovalFirstThree,
      requireApprovalAll: settings.requireApprovalAll,
      minJoinReputation: threshold(settings.minJoinReputation),
      minPostReputation: threshold(settings.minPostReputation),
      minReviewBypassReputation: threshold(settings.minReviewBypassReputation),
      ...(myRole === 'owner' ? { privacy: settings.privacy, announcementPolicy: settings.announcementPolicy } : {}),
    };
    const res = await apiFetch(`/api/groups/${id}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) return toast({ title: 'Could not update group settings', variant: 'destructive' });
    toast({ title: 'Group settings updated' });
    void refetch();
  };

  const createGroupInvite = async () => {
    const response = await apiFetch(`/api/groups/${id}/invites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresInDays: 7 }) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.inviteCode) return toast({ title: 'Could not create invite link', description: result?.error ?? 'Please try again.', variant: 'destructive' });
    const inviteUrl = `${window.location.origin}/g/${groupView.slug || id}?invite=${encodeURIComponent(result.inviteCode)}`;
    try {
      await copyTextToClipboard(inviteUrl);
      toast({ title: 'Invite link copied', description: 'This link expires in seven days and can be used once.' });
    } catch {
      toast({ title: 'Invite link created', description: inviteUrl });
    }
  };

  const acceptGroupInvite = async (inviteCode: string) => {
    const response = await apiFetch(`/api/groups/invites/${encodeURIComponent(inviteCode)}/accept`, { method: 'POST' });
    const result = await response.json().catch(() => null);
    if (!response.ok) return toast({ title: 'Could not accept invite', description: result?.error ?? 'Please try again.', variant: 'destructive' });
    setLocation(`/g/${groupView.slug || id}`);
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['/api/groups', id, 'posts'] });
    toast({ title: 'You joined the group' });
  };

  const performLifecycleAction = async () => {
    if (!lifecycleAction) return;
    try {
      const response = await apiFetch(`/api/groups/${id}${lifecycleAction === 'archive' ? '/archive' : ''}`, { method: lifecycleAction === 'archive' ? 'POST' : 'DELETE' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? `Could not ${lifecycleAction} group.`);
      toast({ title: lifecycleAction === 'archive' ? 'Group archived' : 'Group permanently deleted' });
      setLifecycleAction(null);
      setLocation('/groups');
    } catch (error) {
      toast({
        title: `Could not ${lifecycleAction} group`,
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const submitGroupPost = async () => {
    const editorText = editor?.getText().trim() ?? '';
    const hasContent = composerType === 'poll' ? Boolean(pollQuestion.trim()) : composerType === 'question' ? Boolean(postTitle.trim()) : Boolean(editorText);
    if (!token || !hasContent) return;
    setIsPosting(true);
    try {
      const response = await apiFetch(`/api/groups/${id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: composerType === 'poll'
            ? `<p>${pollQuestion.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
            : editor?.getHTML() ?? postContent,
          ...(composerType === 'question' ? { title: postTitle.trim(), tags: questionTags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 3) } : {}),
          type: composerType,
          ...(composerType === 'poll' ? { poll: { options: pollOptions, allowMultiple: pollMultiple, duration: pollDuration } } : {}),
          ...(composerType === 'discussion' ? { attachments: postAttachments } : {}),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Could not publish to this group.');
      setPostContent('');
      setPostTitle('');
      setPollQuestion('');
      setQuestionTags('');
      setPostAttachments([]);
      editor?.commands.clearContent();
      setPollOptions(['', '']);
      setPollDuration('1d');
      setPostsPage(1);
      setLoadedPosts(current => [result, ...current.filter(post => post.id !== result.id)]);
      setComposerType('discussion');
      setIsComposerExpanded(false);
      setPinnedRefreshKey(value => value + 1);
      void queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}/posts`] });
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
    const url = `${window.location.origin}/g/${groupView.slug || id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: group?.name, url });
        return;
      }
      await copyTextToClipboard(url);
      toast({ title: 'Group link copied', description: 'Anyone can open this link to view the group.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ title: 'Could not share group link', variant: 'destructive' });
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
    <AppLayout publicPage={!user}>
      <div className="max-w-4xl mx-auto px-4 animate-pulse space-y-4">
        <Skeleton className="w-full h-48 rounded-2xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </AppLayout>
  );

  if (groupError) return <AppLayout publicPage={!user}><div className="mx-auto max-w-xl py-20 text-center"><p className="text-sm text-destructive" role="alert">Could not load this group.</p><Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>Retry</Button></div></AppLayout>;
  if (!group) return <AppLayout publicPage={!user}><div className="py-20 text-center text-muted-foreground">{t('groups.notFound', 'Group not found')}</div></AppLayout>;

  const groupView = group as GroupView;
  const canPostAnnouncement = myRole === 'owner' || (myRole === 'admin' && groupView.announcementPolicy !== 'owner');
  const canReviewJoinRequests = myRole === 'owner' || myRole === 'admin';
  const canManageGroup = myRole === 'owner' || myRole === 'admin' || myRole === 'moderator' || user?.role === 'super_admin';
  const isSettingsView = ['settings', 'pending', 'join-requests', 'reports', 'archived-posts'].includes(activeTab);
  const primaryTab = isSettingsView ? 'settings' : activeTab;
  const hasMorePosts = (postsPage * (postsData?.limit ?? 20)) < (postsData?.total ?? 0);
  if (!user && (groupView.privacy === 'private' || groupView.type === 'secret')) {
    return <AppLayout publicPage>
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-bold">{group.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">This group is invite-only. Sign in with an account that has an invitation to continue.</p>
        <Link href="/login"><Button className="mt-5">Sign in</Button></Link>
      </div>
    </AppLayout>;
  }
  const inviteCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') : null;
  const allGroupPosts = loadedPosts;
  const questions = allGroupPosts.filter(post => post.groupDetails?.type === 'question');
  const activePolls = allGroupPosts.filter(post => post.groupDetails?.type === 'poll' && (!post.groupDetails?.poll?.endsAt || Date.parse(post.groupDetails.poll.endsAt) > Date.now()));
  const hasAnnouncements = allGroupPosts.some(post => post.groupDetails?.type === 'announcement');
  const featuredAnnouncements = allGroupPosts.filter(post => post.groupDetails?.type === 'announcement').slice(0, 3);
  const pendingGroupPosts = pendingPosts;
  const now = Date.now();
  let visiblePosts = allGroupPosts;
  if (activeTab === 'questions') {
    visiblePosts = questions.filter(post => questionFilter === 'all' || Boolean(post.groupDetails?.question?.isAnswered) === (questionFilter === 'answered'));
  } else if (activeTab === 'polls') {
    visiblePosts = activePolls;
  } else if (activeTab === 'announcements') {
    visiblePosts = allGroupPosts.filter(post => post.groupDetails?.type === 'announcement');
  } else if (activeTab === 'pending') {
    visiblePosts = pendingGroupPosts;
  } else if (activeTab === 'archived-posts') {
    visiblePosts = archivedPosts;
  } else if (feedMode === 'unanswered') {
    visiblePosts = questions.filter(post => !post.groupDetails?.question?.isAnswered);
  } else if (feedMode === 'top') {
    visiblePosts = allGroupPosts
      .filter(post => Date.now() - new Date(post.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => Number(b.likesCount ?? b.likeCount ?? 0) - Number(a.likesCount ?? a.likeCount ?? 0));
  }

  const renderGroupPost = (post: any) => <div key={post.id} className="relative">
    {post.groupDetails?.type === 'opportunity_reshare' && <div className="mb-3 rounded-r-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Share2 className="h-3.5 w-3.5" />Opportunity reshared</div>
      <p className="mt-1 font-medium">{post.groupDetails?.opportunitySnapshot?.title}</p>
      {post.groupDetails?.opportunitySnapshot?.budget != null && <p className="mt-1 text-xs text-muted-foreground">Budget {post.groupDetails.opportunitySnapshot.budget}</p>}
    </div>}
    {post.groupDetails?.type === 'announcement' && <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"><Megaphone className="h-3.5 w-3.5" />Announcement</div>}
    <GroupPostActions
      groupId={id}
      postId={post.id}
      isAuthor={user?.id === post.authorId}
      canModerate={myRole === 'owner' || myRole === 'admin' || myRole === 'moderator' || user?.role === 'super_admin'}
      isPinned={Boolean(post.groupDetails?.isPinned)}
      isArchived={Boolean(post.isArchived)}
      commentsEnabled={post.groupDetails?.commentsEnabled !== false}
      onChanged={() => {
        void queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}/posts`] });
        void queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}/archived-posts`] });
        setArchivedRefreshKey(value => value + 1);
        window.dispatchEvent(new CustomEvent('quillhive:post-archive-changed'));
        setPinnedRefreshKey(value => value + 1);
      }}
    >
      {extraActions => <PostCard post={post} feedStyle extraActions={extraActions} />}
    </GroupPostActions>
    {post.groupDetails?.type === 'question' && post.groupDetails?.question && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={post.groupDetails.question.isAnswered ? 'secondary' : 'outline'}>{post.commentsCount ?? 0} answers · {post.groupDetails.question.isAnswered ? 'Answered' : 'Awaiting answer'}</Badge>
      <GroupQuestion groupId={id} postId={post.id} question={post.groupDetails.question} canChooseAnswer={user?.id === post.authorId || myRole === 'owner' || myRole === 'admin'} />
    </div>}
    {post.groupDetails?.type === 'poll' && post.groupDetails?.poll && <GroupPoll groupId={id} postId={post.id} poll={post.groupDetails.poll} />}
    {activeTab === 'pending' && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void reviewPendingPost(post.id, 'approve')}>Approve</Button><Button size="sm" variant="outline" onClick={() => void reviewPendingPost(post.id, 'reject')}>Reject</Button></div>}
  </div>;

  const richEditor = <div className="overflow-hidden rounded-md border border-border bg-background">
    <div className="flex items-center gap-1 border-b border-border px-2 py-1">
      <Button type="button" variant="ghost" size="icon" title="Bold" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" title="Italic" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" title="Bulleted list" aria-label="Bulleted list" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" title="Numbered list" aria-label="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" title="Mention someone" aria-label="Mention someone" onClick={() => setMentionOpen(true)}><AtSign className="h-4 w-4" /></Button>
    </div>
    <EditorContent editor={editor} />
  </div>;

  const emptyStates: Record<string, { icon: typeof MessageSquare; title: string; body: string }> = {
    feed: { icon: MessageSquare, title: 'The conversation starts here', body: 'Share a useful idea or question with the community.' },
    questions: { icon: CircleDot, title: 'No questions in this view', body: 'Questions from members will gather here.' },
    polls: { icon: BarChart3, title: 'No active polls', body: 'Active community polls will appear here.' },
    announcements: { icon: Megaphone, title: 'No announcements yet', body: 'Important notes from group moderators will appear here.' },
    'archived-posts': { icon: Archive, title: 'No moderated posts are archived', body: 'When moderators archive a post, it will be available here to restore.' },
  };
  const EmptyIcon = emptyStates[activeTab]?.icon ?? MessageSquare;

  return (
    <AppLayout publicPage={!user}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-6">
        <Link href="/groups" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('groups.backToGroups', 'Back to Groups')}
        </Link>

        <div className="relative aspect-[16/5] w-full">
          <div className="absolute inset-0 overflow-hidden rounded-xl bg-muted">
            {(groupView.coverImage || group.coverUrl) ? <img src={groupView.coverImage || group.coverUrl || ''} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-primary/10 text-6xl font-serif font-bold text-primary/35">{group.name[0]}</div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
            {groupView.isPromoted && <Badge variant="secondary" className="absolute right-3 top-3">Featured community</Badge>}
          </div>
          <div className="absolute -bottom-8 left-4 z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-4 border-background bg-primary/10 text-3xl font-serif font-bold text-primary shadow-sm">
            {(groupView.iconImage || group.avatarUrl) ? <img src={groupView.iconImage || group.avatarUrl || ''} alt="" className="h-full w-full object-cover" /> : group.name[0]}
          </div>
        </div>

        <header className="border-b border-border/70 px-4 pb-4 pt-12">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-nowrap items-center gap-2">
              <h1 className="min-w-0 flex-1 truncate text-xl font-serif font-bold sm:text-2xl">{group.name}</h1>
              {groupView.isVerified && <BadgeCheck className="h-5 w-5 shrink-0 text-blue-500" aria-label="Verified community" />}
              <Badge variant="outline" className="shrink-0">{groupView.privacy === 'private' ? 'Private' : groupView.privacy === 'public' ? 'Public' : 'Open'}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
              <Link href={`/g/${groupView.slug || id}/members`} className="hover:text-foreground hover:underline">{groupView.memberCount ?? group.membersCount} members</Link>
              <span aria-hidden="true">·</span>
              <span>{groupView.postCount ?? group.postsCount} posts</span>
            </div>
            <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={() => setActiveTab(activeTab === 'about' ? 'feed' : 'about')}>{activeTab === 'about' ? 'Back to feed' : 'About this group'}</Button>
          </div>
          <div className="mt-3 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
            {group.isMember && <Button variant="outline" size="sm" disabled className="h-8 shrink-0 px-3">Joined</Button>}
            {!group.isMember && (groupView.hasPendingJoinRequest
              ? <Button size="sm" variant="outline" disabled className="h-8 shrink-0 px-3"><span className="sm:hidden">Pending</span><span className="hidden sm:inline">Request pending</span></Button>
              : groupView.privacy === 'private' || groupView.type === 'secret'
                ? inviteCode ? <Button size="sm" onClick={() => void acceptGroupInvite(inviteCode)} className="h-8 shrink-0 px-3">Accept invite</Button> : <Badge variant="outline" className="flex h-8 shrink-0 items-center">Invite-only</Badge>
                : !user ? <Link href="/login"><Button size="sm" className="h-8 shrink-0 px-3"><span className="sm:hidden">Join</span><span className="hidden sm:inline">{groupView.privacy === 'public' ? 'Request to join' : 'Join group'}</span></Button></Link>
                : <Button size="sm" onClick={() => toggleJoin({ id })} disabled={isJoining} className="h-8 shrink-0 px-3">{isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span className="sm:hidden">Join</span><span className="hidden sm:inline">{groupView.privacy === 'public' ? 'Request to join' : 'Join group'}</span></>}</Button>)}
            {group.isMember && <Button variant="outline" size="sm" aria-label="Invite members" onClick={() => setInviteOpen(true)} className="h-8 shrink-0 gap-1.5 px-2.5"><UserPlus className="h-4 w-4" /><span>Invite</span></Button>}
            <Button variant="outline" size="sm" aria-label="Share group" title="Share group" onClick={() => void shareGroup()} className="h-8 w-8 shrink-0 gap-1.5 px-0 sm:w-auto sm:px-2.5"><Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More group actions" title="More group actions" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
              {(myRole === 'owner' || myRole === 'admin' || user?.role === 'super_admin') && <DropdownMenuItem onSelect={() => setActiveTab('settings')}><Settings className="mr-2 h-4 w-4" />Group settings</DropdownMenuItem>}
              {myRole === 'moderator' && <DropdownMenuItem onSelect={() => setActiveTab('pending')}><Settings className="mr-2 h-4 w-4" />Moderation tools</DropdownMenuItem>}
              {group.isMember && <DropdownMenuItem onSelect={() => toggleJoin({ id })}><LogOut className="mr-2 h-4 w-4" />Leave community</DropdownMenuItem>}
              {myRole === 'owner' && <DropdownMenuItem onSelect={() => setLifecycleAction('delete')} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete group</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setReportOpen(true)}>Report community</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="mt-5">
          <main className="min-w-0">
            <Tabs value={primaryTab} onValueChange={setActiveTab}>
              {activeTab !== 'about' && !isSettingsView && <TabsList className="mb-4 w-full justify-start overflow-x-auto">
                <TabsTrigger value="feed">Feed</TabsTrigger>
                {questions.length > 0 && <TabsTrigger value="questions">Q&amp;A</TabsTrigger>}
                {activePolls.length > 0 && <TabsTrigger value="polls">Polls</TabsTrigger>}
                {hasAnnouncements && <TabsTrigger value="announcements">Announcements</TabsTrigger>}
              </TabsList>}

              {activeTab === 'feed' && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
              {isSettingsView && <section className="mb-5 space-y-4 rounded-lg border border-border/70 bg-card p-4">
                <div>
                  <h2 className="text-sm font-semibold">Group settings and moderation</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Manage group details, membership, and community posts.</p>
                </div>
                <div className="flex flex-wrap gap-2 border-b border-border/70 pb-3">
                  {myRole === 'owner' || myRole === 'admin' ? <Button size="sm" variant={activeTab === 'settings' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('settings')}>Group settings</Button> : null}
                  {(myRole === 'owner' || myRole === 'admin' || myRole === 'moderator') && <Button size="sm" variant={activeTab === 'pending' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('pending')}>Pending posts{pendingPosts.length ? ` (${pendingPosts.length})` : ''}</Button>}
                  {canReviewJoinRequests && <Button size="sm" variant={activeTab === 'join-requests' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('join-requests')}>Join requests{joinRequests.length ? ` (${joinRequests.length})` : ''}</Button>}
                  {(myRole === 'owner' || myRole === 'admin' || myRole === 'moderator') && <Button size="sm" variant={activeTab === 'reports' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('reports')}>Reports{moderationReports.length ? ` (${moderationReports.length})` : ''}</Button>}
                  {(myRole === 'owner' || myRole === 'admin' || myRole === 'moderator' || user?.role === 'super_admin') && <Button size="sm" variant={activeTab === 'archived-posts' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('archived-posts')}>Archived posts{archivedPosts.length ? ` (${archivedPosts.length})` : ''}</Button>}
                </div>
                {activeTab === 'settings' && (myRole === 'admin' || myRole === 'owner') && <div className="space-y-3">
                  <Input value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} placeholder="Group name" />
                  <Textarea maxLength={280} value={settings.description} onChange={e => setSettings(s => ({ ...s, description: e.target.value }))} placeholder="Description, up to 280 characters" />
                  <div><Label>Group privacy</Label><Select disabled={myRole !== 'owner'} value={settings.privacy} onValueChange={privacy => setSettings(s => ({ ...s, privacy }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="public">Public</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">{settings.privacy === 'open' ? 'Anyone can find and join immediately unless a reputation gate sends them to manual review.' : settings.privacy === 'public' ? 'Anyone can find the group and request to join; managers approve requests.' : 'Only people with a valid invite can join.'}{myRole !== 'owner' ? ' Only the owner can change privacy.' : ''}</p></div>
                  <Textarea value={settings.rules} onChange={e => setSettings(s => ({ ...s, rules: e.target.value }))} placeholder="Up to five rules, one per line" />
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.isAnnouncementOnly} onChange={e => setSettings(s => ({ ...s, isAnnouncementOnly: e.target.checked }))} />Announcement-only</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.requireApprovalFirstThree} onChange={e => setSettings(s => ({ ...s, requireApprovalFirstThree: e.target.checked, requireApprovalAll: false }))} />Require approval for each member's first 3 posts</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.requireApprovalAll} onChange={e => setSettings(s => ({ ...s, requireApprovalAll: e.target.checked, requireApprovalFirstThree: false }))} />Require approval for all posts</label>
                  <div className="space-y-3 rounded-md border border-border/70 p-3">
                    <h3 className="text-sm font-medium">Platform reputation gates</h3>
                    <p className="text-xs text-muted-foreground">Scores are 0–100 and must be refreshed within 30 days. New, missing, stale, or disputed scores require manual join/post review where available. Group comments are blocked until the posting threshold is met.</p>
                    <label className="block space-y-1 text-xs"><span>Minimum reputation to join (blank disables)</span><Input type="number" min="0" max="100" step="0.1" value={settings.minJoinReputation} onChange={e => setSettings(s => ({ ...s, minJoinReputation: e.target.value }))} /></label>
                    <label className="block space-y-1 text-xs"><span>Minimum reputation to publish group posts/comments (blank disables)</span><Input type="number" min="0" max="100" step="0.1" value={settings.minPostReputation} onChange={e => setSettings(s => ({ ...s, minPostReputation: e.target.value }))} /></label>
                    <label className="block space-y-1 text-xs"><span>Minimum reputation to bypass manual post review (blank disables)</span><Input type="number" min="0" max="100" step="0.1" value={settings.minReviewBypassReputation} onChange={e => setSettings(s => ({ ...s, minReviewBypassReputation: e.target.value }))} /></label>
                  </div>
                  <label className="flex items-center justify-between gap-3 text-xs"><span>Who can post announcements</span><Select disabled={myRole !== 'owner'} value={settings.announcementPolicy} onValueChange={announcementPolicy => setSettings(s => ({ ...s, announcementPolicy }))}><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Owner only</SelectItem><SelectItem value="admins">Admins</SelectItem></SelectContent></Select>{myRole !== 'owner' && <span className="text-muted-foreground">Owner only</span>}</label>
                  <ImageUploadField value={settings.iconUrl} onChange={iconUrl => setSettings(s => ({ ...s, iconUrl }))} category="group" label="Change group icon" previewClassName="h-20 w-20" />
                  <ImageUploadField value={settings.coverUrl} onChange={coverUrl => setSettings(s => ({ ...s, coverUrl }))} category="group" label="Change cover image" />
                  <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void saveSettings()}>Save settings</Button><Button size="sm" variant="outline" onClick={() => setLifecycleAction('archive')}>Archive group</Button></div>
                </div>}
                {activeTab === 'settings' && user?.role === 'super_admin' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(groupView.features?.eventsEnabled)} onChange={e => void toggleEvents(e.target.checked)} />Enable group events</label>}
              </section>}

              {activeTab === 'feed' && featuredAnnouncements.length > 0 && <section aria-label="Featured announcements" className="mb-5 border-y border-amber-500/40 bg-amber-500/5 py-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-amber-700 dark:text-amber-300"><Megaphone className="h-4 w-4" />Featured</div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {featuredAnnouncements.map(post => <button key={post.id} type="button" onClick={() => setActiveTab('announcements')} className="min-w-56 max-w-72 flex-1 border-l-2 border-amber-500 px-3 py-1 text-left hover:bg-amber-500/5">
                    <span className="line-clamp-1 text-sm font-semibold">{post.title || 'Group announcement'}</span>
                    <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.excerpt || 'Read the latest from your group admins.'}</span>
                  </button>)}
                </div>
              </section>}

              {activeTab === 'feed' && <PinnedPosts groupId={id} myRole={myRole ?? null} refreshKey={pinnedRefreshKey} />}

              {activeTab === 'feed' && group.isMember && <section className="mb-5 space-y-3 rounded-lg border border-border/70 bg-card p-3 sm:p-4">
                {!isComposerExpanded ? <button type="button" onClick={() => setIsComposerExpanded(true)} className="flex min-h-11 w-full items-center rounded-md bg-muted/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Write something…
                </button> : <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Create a post</h2>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsComposerExpanded(false)}>Cancel</Button>
                </div>
                <Tabs value={composerType} onValueChange={setComposerType}>
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="discussion">Discussion</TabsTrigger>
                    <TabsTrigger value="poll">Poll</TabsTrigger>
                    <TabsTrigger value="question">Question</TabsTrigger>
                    {canPostAnnouncement && <TabsTrigger value="announcement">Announcement</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="discussion" className="mt-3 space-y-3">
                    {richEditor}
                    <input ref={groupImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={event => void uploadPostImages(event.target.files)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={isUploadingImages || postAttachments.length >= 4} onClick={() => groupImageInputRef.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />{isUploadingImages ? 'Uploading...' : `Images ${postAttachments.length}/4`}</Button>
                      {postAttachments.map((image, index) => <div key={image.url} className="relative h-12 w-12 overflow-hidden rounded-md border border-border"><img src={mediaUrl(image.url)} alt={image.filename} className="h-full w-full object-cover" /><button type="button" aria-label="Remove image" onClick={() => setPostAttachments(items => items.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-0 top-0 bg-background/90 px-1 text-xs">×</button></div>)}
                    </div>
                  </TabsContent>
                  <TabsContent value="poll" className="mt-3 space-y-3">
                    <Input value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} maxLength={280} placeholder="Ask your group a question" aria-label="Poll question" />
                    <div className="space-y-2">
                      {pollOptions.map((option, index) => <Input key={index} value={option} maxLength={120} onChange={event => setPollOptions(items => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} />)}
                      {pollOptions.length < 5 && <Button type="button" variant="ghost" size="sm" onClick={() => setPollOptions(items => [...items, ''])}>Add option</Button>}
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm"><span>Duration</span><Select value={pollDuration} onValueChange={setPollDuration}><SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1d">1 day</SelectItem><SelectItem value="3d">3 days</SelectItem><SelectItem value="1w">1 week</SelectItem><SelectItem value="never">Never</SelectItem></SelectContent></Select></label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pollMultiple} onChange={event => setPollMultiple(event.target.checked)} />Allow multiple votes</label>
                    </div>
                  </TabsContent>
                  <TabsContent value="question" className="mt-3 space-y-3">
                    <Input value={postTitle} onChange={event => setPostTitle(event.target.value)} maxLength={180} placeholder="Ask a question" aria-label="Question title" />
                    {richEditor}
                    <Input value={questionTags} onChange={event => setQuestionTags(event.target.value)} maxLength={140} placeholder="Tags, separated by commas (up to 3)" aria-label="Question tags" />
                  </TabsContent>
                  <TabsContent value="announcement" className="mt-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300"><Megaphone className="h-4 w-4" />Group announcement</div>
                    {richEditor}
                    <p className="text-xs text-muted-foreground">One announcement per group every 24 hours.</p>
                  </TabsContent>
                </Tabs>
                <Button onClick={() => void submitGroupPost()} disabled={isPosting || isUploadingImages || (composerType === 'poll' ? !pollQuestion.trim() || pollOptions.filter(option => option.trim()).length < 2 : composerType === 'question' ? !postTitle.trim() : !editor?.getText().trim())} className="gap-2"><Send className="h-4 w-4" />{isPosting ? 'Publishing...' : 'Publish'}</Button>
                </>}
              </section>}

              {activeTab === 'settings' || activeTab === 'about' ? null : activeTab === 'join-requests' ? joinRequestsLoading ? <div className="space-y-3">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)}</div> : <div className="divide-y divide-border border-y">
                {joinRequests.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No pending join requests.</p> : joinRequests.map(request => <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Link href={`/u/${encodeURIComponent(request.username)}`} aria-label={`View ${request.displayName || request.username}'s profile`} className="shrink-0"><Avatar className="h-10 w-10"><AvatarImage src={request.avatarUrl ?? undefined} /><AvatarFallback>{(request.displayName || request.username).slice(0, 1).toUpperCase()}</AvatarFallback></Avatar></Link>
                    <div className="min-w-0"><Link href={`/u/${encodeURIComponent(request.username)}`} className="block truncate text-sm font-semibold hover:underline">{request.displayName || request.username}</Link><p className="truncate text-xs text-muted-foreground"><Link href={`/u/${encodeURIComponent(request.username)}`} className="hover:underline">@{request.username}</Link> · requested <Timestamp value={request.createdAt} mode="date" /></p>{request.trustScore != null && <p className="mt-0.5 text-xs text-muted-foreground">Trust score {request.trustScore}</p>}{request.reviewReason && request.reviewReason !== 'member_request' && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Manual review: platform reputation is {request.reviewReason.replace('reputation_', '').replace(/_/g, ' ')}.</p>}</div>
                  </div>
                  <div className="flex gap-2"><Button size="sm" onClick={() => void reviewJoinRequest(request.id, 'approve')}><Check className="mr-1.5 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => void reviewJoinRequest(request.id, 'deny')}><X className="mr-1.5 h-4 w-4" />Deny</Button></div>
                </article>)}
              </div> : activeTab === 'archived-posts' && archivedError ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center text-sm text-destructive" role="alert">{archivedError}</div> : activeTab === 'archived-posts' && archivedLoading ? <div className="space-y-4">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}</div> : activeTab === 'reports' ? <div className="divide-y divide-border border-y">
                {moderationReports.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No reports need group review.</p> : moderationReports.map(report => <article key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0"><p className="text-sm font-semibold">{report.postTitle || `Post #${report.targetId}`}</p><p className="mt-1 text-xs text-muted-foreground">{report.reason.replace(/_/g, ' ')} · reported by {report.reporterName || `@${report.reporterUsername}`} · <Timestamp value={report.createdAt} mode="date" /></p></div>
                  <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void reviewGroupReport(report.id, 'dismiss')}>Dismiss</Button><Button size="sm" variant="destructive" onClick={() => void reviewGroupReport(report.id, 'remove_post')}>Remove post</Button><Button size="sm" variant="ghost" onClick={() => void reviewGroupReport(report.id, 'escalate')}>Escalate</Button></div>
                </article>)}
              </div> : ((postsLoading && loadedPosts.length === 0) || (activeTab === 'pending' && pendingLoading)) ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-xl" />)}              </div> : (postsError && loadedPosts.length === 0) ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center" role="alert"><p className="text-sm text-destructive">Could not load group posts.</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetchPosts()}>Retry</Button></div> : <>
                {visiblePosts.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center border-y border-dashed border-border px-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"><EmptyIcon className="h-7 w-7" /></div>
                  <h3 className="font-semibold">{emptyStates[activeTab]?.title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyStates[activeTab]?.body}</p>
                </div> : activeTab === 'announcements' ? <div className="space-y-5 border-l border-amber-500/40 pl-4">{visiblePosts.map(renderGroupPost)}</div> : <div className="space-y-5">{visiblePosts.map(renderGroupPost)}</div>}
                {hasMorePosts && activeTab !== 'pending' && <div className="flex justify-center pt-2"><Button type="button" variant="outline" size="sm" disabled={postsLoading} onClick={() => setPostsPage(page => page + 1)}>{postsLoading ? 'Loading...' : 'Load more posts'}</Button></div>}
                {postsError && loadedPosts.length > 0 && <div className="text-center"><Button type="button" size="sm" variant="outline" onClick={() => void refetchPosts()}>Could not load more posts · Retry</Button></div>}
              </>}
            </Tabs>
          </main>
          {activeTab === 'about' && <section className="mt-2 grid gap-6 md:grid-cols-2">
            <section className="space-y-3 border-b border-border/70 pb-4">
              <h2 className="text-lg font-semibold">About {group.name}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{group.description || 'A community for shared interests and useful conversations.'}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">Category</dt><dd className="mt-0.5 font-medium">{group.category}</dd></div><div><dt className="text-muted-foreground">Access</dt><dd className="mt-0.5 font-medium">{groupView.privacy === 'private' ? 'Invite-only' : groupView.privacy === 'public' ? 'Request to join' : 'Open join'}</dd></div>{groupView.createdAt && <div><dt className="text-muted-foreground">Created</dt><dd className="mt-0.5 font-medium"><Timestamp value={groupView.createdAt} mode="date" /></dd></div>}</dl>
              {(groupView.minJoinReputation != null || groupView.minPostReputation != null || groupView.minReviewBypassReputation != null) && <div className="rounded-md bg-muted/50 p-3 text-xs"><h3 className="font-semibold">Reputation requirements</h3><p className="mt-1 text-muted-foreground">{groupView.minJoinReputation != null ? `Join: ${groupView.minJoinReputation} minimum. ` : ''}{groupView.minPostReputation != null ? `Posts and comments: ${groupView.minPostReputation} minimum. ` : ''}{groupView.minReviewBypassReputation != null ? `Manual post-review bypass: ${groupView.minReviewBypassReputation} minimum. ` : ''}Scores older than 30 days, disputed, or unavailable are treated as unverified. Managers can manually review join and post requests.</p></div>}
              {groupView.tags?.length ? <div className="flex flex-wrap gap-1">{groupView.tags.map(tag => <Badge variant="secondary" key={tag} className="text-[10px]">{tag}</Badge>)}</div> : null}
              <details className="group border-t border-border/60 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Community rules <span className="text-muted-foreground group-open:rotate-180">⌄</span></summary>
                {(groupView.rules?.length ?? 0) > 0 ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">{groupView.rules?.map((rule, index) => <li key={`${index}-${rule}`}>{rule}</li>)}</ol> : <p className="mt-2 text-xs text-muted-foreground">No rules have been added.</p>}
              </details>
            </section>

            <section className="space-y-3 border-b border-border/70 pb-4"><h2 className="text-sm font-semibold">Recent activity</h2><GroupActivityTimeline groupId={id} /></section>

            <section className="space-y-3 border-b border-border/70 pb-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Members</h2>{onlineCount > 0 && (groupView.type === 'public' || groupView.type == null || group.isMember) && <span className="text-xs text-muted-foreground">{onlineCount} online now</span>}</div>
              <div className="flex items-center">
                {membersPreview.slice(0, 6).map((member, index) => <Link key={member.userId} href={`/u/${encodeURIComponent(member.username)}`} aria-label={`View ${member.displayName || member.username}'s profile`} className={`rounded-full border-2 border-background ${index ? '-ml-2' : ''}`}>
                  <Avatar className="h-8 w-8"><AvatarImage src={member.avatarUrl ?? undefined} /><AvatarFallback className="text-[10px]">{(member.displayName || member.username).slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                </Link>)}
                {membersPreview.length === 0 && <span className="text-xs text-muted-foreground">Members will appear here.</span>}
              </div>
              <Link href={`/g/${groupView.slug || id}/members`}><Button variant="ghost" size="sm" className="px-0">View all members</Button></Link>
            </section>

            <section className="space-y-2 border-b border-border/70 pb-4">
              <h2 className="text-sm font-semibold">Opportunity reshares</h2>
              {allGroupPosts.filter(post => post.groupDetails?.type === 'opportunity_reshare').slice(0, 3).map(post => <div key={post.id} className="border-l-2 border-primary/50 py-1 pl-3">
                <p className="line-clamp-2 text-sm font-medium">{post.groupDetails.opportunitySnapshot?.title}</p>
                {post.groupDetails.opportunitySnapshot?.budget != null && <p className="text-xs text-muted-foreground">Budget {post.groupDetails.opportunitySnapshot.budget}</p>}
              </div>)}
              {allGroupPosts.every(post => post.groupDetails?.type !== 'opportunity_reshare') && <p className="text-xs text-muted-foreground">No opportunities reshared yet.</p>}
            </section>
          </section>}
        </div>
      </div>

      <Dialog open={Boolean(lifecycleAction)} onOpenChange={open => { if (!open) setLifecycleAction(null); }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{lifecycleAction === 'archive' ? 'Archive this group?' : 'Permanently delete this group?'}</DialogTitle><DialogDescription>{lifecycleAction === 'archive' ? 'The group will be hidden from discovery. Existing posts remain available by direct link.' : 'This permanently deletes the group, its posts, memberships, join requests, and invites. This action cannot be undone.'}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setLifecycleAction(null)}>Cancel</Button><Button variant={lifecycleAction === 'delete' ? 'destructive' : 'default'} onClick={() => void performLifecycleAction()}>{lifecycleAction === 'archive' ? 'Archive group' : 'Permanently delete group'}</Button></div></DialogContent>
      </Dialog>
      <Dialog open={mentionOpen} onOpenChange={setMentionOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Mention a member</DialogTitle></DialogHeader>
          <Input autoFocus value={mentionQuery} onChange={event => void searchMentionCandidates(event.target.value)} placeholder="Search by name or username" />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {mentionCandidates.map(candidate => <button key={candidate.id} type="button" onClick={() => insertMention(candidate)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/60"><Avatar className="h-8 w-8"><AvatarImage src={candidate.avatarUrl ?? undefined} /><AvatarFallback>{(candidate.displayName || candidate.username).slice(0, 1)}</AvatarFallback></Avatar><span className="min-w-0"><span className="block truncate text-sm font-medium">{candidate.displayName}</span><span className="block truncate text-xs text-muted-foreground">@{candidate.username}</span></span></button>)}
            {mentionQuery.trim() && mentionCandidates.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No members found.</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Invite to {group.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={inviteSearch} onChange={event => setInviteSearch(event.target.value)} placeholder="Find someone by name or username" aria-label="Find someone to invite" />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {inviteUsers.map(candidate => <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/60"><div className="min-w-0"><Link href={`/u/${encodeURIComponent(candidate.username)}`} className="block truncate text-sm font-medium hover:underline">{candidate.displayName || candidate.username}</Link><Link href={`/u/${encodeURIComponent(candidate.username)}`} className="block truncate text-xs text-muted-foreground hover:underline">@{candidate.username}</Link></div><Button size="sm" disabled={isInviting} onClick={() => void inviteMember(candidate.id)}>Invite</Button></div>)}
              {inviteSearch.trim().length >= 2 && inviteUsers.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No matching members.</p>}
            </div>
            {groupView.privacy === 'private' && <div className="border-t border-border pt-3"><p className="mb-2 text-sm text-muted-foreground">Or create a single-use invite link that expires in seven days.</p><Button variant="outline" size="sm" onClick={() => void createGroupInvite()}><Copy className="mr-2 h-4 w-4" />Create invite link</Button></div>}
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
  const [scope, setScope] = useState<'discover' | 'joined'>('discover');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'general', privacy: 'open', coverUrl: '', iconUrl: '', tags: '', rules: '', isAnnouncementOnly: false });
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);

  const { data, isLoading, isError, refetch } = useGetGroups({
    search: search.trim() || undefined,
    scope,
    category: category || undefined,
    page,
  });
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.limit ?? 20)));

  useEffect(() => {
    const current = groups.map(group => group.category?.trim()).filter((value): value is string => Boolean(value));
    if (current.length) {
      setCategoryOptions(options => [...new Map([...options, ...current].map(value => [value.toLocaleLowerCase(), value])).values()].sort((a, b) => a.localeCompare(b)));
    }
  }, [groups]);

  const { mutate: createGroup, isPending: isCreating } = useCreateGroup({
    mutation: {
      onSuccess: (createdGroup) => {
        void queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
        toast({ title: t('groups.groupCreated', 'Group created!'), description: t('groups.groupCreatedDesc', 'Your community is live.') });
        setCreateOpen(false);
        setForm({ name: '', description: '', category: 'general', privacy: 'open', coverUrl: '', iconUrl: '', tags: '', rules: '', isAnnouncementOnly: false });
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
        <section className="relative mb-7 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-medium text-primary">
                <Users className="h-3.5 w-3.5" /> Community, built around what you care about
              </div>
              <h1 className="text-3xl font-serif font-bold tracking-tight sm:text-4xl">{t('groups.title', 'Groups & Communities')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{t('groups.subtitle', 'Find your people and shared interests')}</p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> {t('groups.createGroup', 'Create Group')}
            </Button>
          </div>
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search names, topics, tags, or descriptions"
              aria-label="Search groups by name, topic, tag, or description"
              className="h-11 rounded-xl border-border/60 bg-card pl-11"
            />
          </div>
          <div className="flex shrink-0 gap-2" role="group" aria-label="Group directory view">
            <Button type="button" variant={scope === 'discover' ? 'default' : 'outline'} aria-pressed={scope === 'discover'} onClick={() => { setScope('discover'); setPage(1); }} className="h-11 rounded-xl">
              <Compass className="mr-2 h-4 w-4" /> Discover
            </Button>
            <Button type="button" variant={scope === 'joined' ? 'default' : 'outline'} aria-pressed={scope === 'joined'} onClick={() => { setScope('joined'); setPage(1); }} className="h-11 rounded-xl">
              <Users className="mr-2 h-4 w-4" /> Your groups
            </Button>
          </div>
        </div>

        {categoryOptions.length > 0 && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter groups by category">
            <Button type="button" size="sm" variant={!category ? 'secondary' : 'ghost'} aria-pressed={!category} onClick={() => { setCategory(''); setPage(1); }} className="shrink-0 rounded-full">All topics</Button>
            {categoryOptions.map(option => (
              <Button key={option} type="button" size="sm" variant={category === option ? 'secondary' : 'ghost'} aria-pressed={category === option} onClick={() => { setCategory(option); setPage(1); }} className="shrink-0 rounded-full capitalize">{option}</Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center" role="alert">
            <p className="text-sm text-destructive">Could not load groups.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>Retry</Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/20 py-16 text-center text-muted-foreground">
            <Users className="mx-auto mb-4 h-14 w-14 opacity-30" />
            <h3 className="mb-2 text-xl font-serif font-medium">{scope === 'joined' ? 'Your communities will show up here' : search || category ? 'No communities match those filters' : t('groups.noGroupsYet', 'No groups yet')}</h3>
            <p className="mb-6 text-sm">{scope === 'joined' ? 'Join a community to keep its conversations close.' : search || category ? 'Try another keyword or clear a filter to explore more groups.' : t('groups.startFirstGroup', 'Start the first group for creatives like you.')}</p>
            {scope === 'joined' ? (
              <Button type="button" onClick={() => { setScope('discover'); setPage(1); }} className="rounded-xl"><Compass className="mr-2 h-4 w-4" />Explore communities</Button>
            ) : search || category ? (
              <Button type="button" variant="outline" onClick={() => { setSearch(''); setCategory(''); setPage(1); }} className="rounded-xl">Clear filters</Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)} className="rounded-xl"><Plus className="mr-2 h-4 w-4" />{t('groups.createGroup', 'Create Group')}</Button>
            )}
          </div>
        ) : (
          <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {data?.total ?? groups.length} {data?.total === 1 ? 'community' : 'communities'}{search ? ` matching “${search.trim()}”` : ''}
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {groups.map(group => (
              <article key={group.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
                <div className="relative h-32 bg-gradient-to-br from-primary/20 via-accent/15 to-primary/5">
                  {group.coverUrl ? (
                    <img src={group.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl font-bold text-primary/30 font-serif" aria-hidden="true">
                      {group.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-5 left-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-card bg-primary/10 text-lg font-bold text-primary shadow-sm">
                    {group.avatarUrl ? <img src={group.avatarUrl} alt="" className="h-full w-full object-cover" /> : group.name[0]?.toUpperCase()}
                  </div>
                  {(group as GroupView).isPromoted && <Badge className="absolute right-3 top-3 border border-amber-500/30 bg-background/90 text-amber-700 dark:text-amber-300"><Megaphone className="mr-1 h-3 w-3" />Featured</Badge>}
                </div>
                <div className="flex flex-1 flex-col p-4 pt-8">
                  <h3 className="mb-1 flex items-center gap-1.5 font-serif text-lg font-bold transition-colors group-hover:text-primary">
                    {group.name}
                    {(group as GroupView).isVerified && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/15 shrink-0" />
                    )}
                  </h3>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="capitalize">{group.category}</Badge>
                    <Badge variant="outline">{(group as GroupView).privacy === 'private' || (group as GroupView).type === 'secret' ? 'Private' : (group as GroupView).privacy === 'public' ? 'Request to join' : 'Open'}</Badge>
                  </div>
                  {group.description && (
                    <p className="mb-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{group.description}</p>
                  )}
                  {(group as GroupView).tags?.length ? <div className="mb-3 flex flex-wrap gap-1">{(group as GroupView).tags?.slice(0, 3).map(tag => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}</div> : null}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />{group.membersCount} {t('groups.members', 'members')}
                      <span aria-hidden="true">·</span>{group.postsCount} posts
                    </span>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      <Link href={`/g/${(group as GroupView).slug || group.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 rounded-xl px-2 text-xs">{t('groups.view', 'View')}</Button>
                      </Link>
                      {(group as GroupView).privacy === 'private' || (group as GroupView).type === 'secret' ? group.isMember ? <Button size="sm" disabled className="h-8 rounded-xl text-xs">Joined</Button> : <Badge variant="outline">Invite-only</Badge> : group.isMember ? <Button
                        size="sm"
                        disabled
                        className="h-8 rounded-xl text-xs"
                      >{t('groups.joined', 'Joined')}</Button> : (group as GroupView).hasPendingJoinRequest ? <Button size="sm" disabled variant="outline" aria-label="Join request pending" className="rounded-xl h-8 text-xs"><span className="sm:hidden">Pending</span><span className="hidden sm:inline">Request pending</span></Button> : <Button
                        size="sm"
                        onClick={() => joinGroup({ id: group.id })}
                        aria-label={(group as GroupView).privacy === 'public' ? 'Request to join' : t('groups.join', 'Join group')}
                        className="h-8 rounded-xl px-2 text-xs"
                      >
                        {(group as GroupView).privacy === 'public'
                          ? <><span className="sm:hidden">Request</span><span className="hidden sm:inline">Request to join</span></>
                          : t('groups.join', '+ Join')}
                      </Button>}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 && <nav className="mt-6 flex items-center justify-between border-t border-border/60 pt-4" aria-label="Group directory pages">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Next</Button>
            </div>
          </nav>}
          </>
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
            <ImageUploadField value={form.iconUrl} onChange={iconUrl => setForm(f => ({ ...f, iconUrl }))} onUploadingChange={setIsUploadingIcon} category="group" label="Community icon" />
            <div>
              <Label>{t('groups.coverPhoto', 'Cover photo')}</Label>
              <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="mt-1.5 rounded-xl file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm" />
              {isUploadingCover && <p className="mt-2 text-xs text-muted-foreground">Uploading cover photo...</p>}
              {form.coverUrl && <img src={form.coverUrl} alt="Cover preview" className="mt-3 h-28 w-full rounded-xl object-cover border border-border" />}
            </div>
            <div>
              <Label>Group privacy</Label>
              <Select value={form.privacy} onValueChange={privacy => setForm(f => ({ ...f, privacy }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{form.privacy === 'open' ? 'Anyone can find and join immediately.' : form.privacy === 'public' ? 'Anyone can find the group and request to join; moderators approve requests.' : 'Only people with a valid invite can join.'}</p>
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
                  privacy: form.privacy,
                  tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20),
                  rules: form.rules.split('\n').map(rule => rule.trim()).filter(Boolean).slice(0, 5),
                  iconImage: form.iconUrl || null,
                  coverUrl: form.coverUrl || null,
                  isAnnouncementOnly: form.isAnnouncementOnly,
                } as any,
              })}
              disabled={isCreating || isUploadingCover || isUploadingIcon || !form.name.trim()}
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
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setGroupId(null);
    void apiFetch(`/api/groups/${encodeURIComponent(slug)}`)
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Group not found.' : 'Could not load this group.');
        const group = await response.json() as GroupView;
        if (active) setGroupId(group.id);
      })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load this group.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, attempt]);

  if (groupId) return <GroupDetail id={groupId} />;
  if (loading) return <AppLayout><div className="mx-auto max-w-4xl space-y-4 p-4"><Skeleton className="aspect-[16/5] w-full" /><Skeleton className="h-10 w-64" /></div></AppLayout>;
  return <AppLayout><div className="py-20 text-center"><p className="text-sm text-muted-foreground" role={error === 'Group not found.' ? undefined : 'alert'}>{error}</p>{error !== 'Group not found.' && <Button type="button" variant="outline" className="mt-4" onClick={() => setAttempt(value => value + 1)}>Retry</Button>}</div></AppLayout>;
}

function GroupMembersRoute({ slug }: { slug: string }) {
  const [group, setGroup] = useState<GroupView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void apiFetch(`/api/groups/${encodeURIComponent(slug)}`)
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Group not found.' : 'Could not load group members.');
        return await response.json() as GroupView;
      })
      .then(value => { if (active) setGroup(value); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load group members.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, attempt]);
  if (loading) return <AppLayout><div className="mx-auto max-w-5xl p-6 text-sm text-muted-foreground">Loading members...</div></AppLayout>;
  if (error || !group) return <AppLayout><div className="py-20 text-center"><p className={`text-sm ${error === 'Group not found.' || !error ? 'text-muted-foreground' : 'text-destructive'}`} role={error && error !== 'Group not found.' ? 'alert' : undefined}>{error || 'Group not found.'}</p>{error && error !== 'Group not found.' && <Button type="button" variant="outline" className="mt-4" onClick={() => setAttempt(value => value + 1)}>Retry</Button>}</div></AppLayout>;
  return <AppLayout><main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
    <Link href={`/g/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">← Back to {group.name}</Link>
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4"><div><p className="text-xs font-semibold uppercase text-muted-foreground">{group.name}</p><h1 className="mt-1 text-2xl font-semibold">Member management</h1></div><span className="text-sm text-muted-foreground">{group.memberCount ?? group.membersCount} members</span></header>
    <GroupMembersList groupId={group.id} />
  </main></AppLayout>;
}

export default function Groups() {
  const [, groupParams] = useRoute('/groups/:id');
  const [, slugParams] = useRoute('/g/:slug');
  const [, memberParams] = useRoute('/g/:slug/members');
  if (memberParams?.slug) return <GroupMembersRoute slug={memberParams.slug} />;
  if (slugParams?.slug) return <GroupSlugRoute slug={slugParams.slug} />;
  const groupId = groupParams?.id ? Number.parseInt(groupParams.id, 10) : null;
  if (groupId && Number.isInteger(groupId)) return <GroupDetail id={groupId} />;
  return <GroupsList />;
}
