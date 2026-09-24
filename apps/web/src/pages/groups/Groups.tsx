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
import { Search, Plus, Users, Hash, Loader2, ArrowLeft, BadgeCheck, Megaphone, Settings, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { useT } from '@/lib/i18n';

import { GroupMembersList } from '@/components/groups/GroupMembersList';
import { PinnedPosts } from '@/components/groups/PinnedPosts';
import { useAuthStore } from '@/store/auth';
import { apiUrl, mediaUrl } from '@/lib/api';
import { ImageUploadField } from '@/components/media/ImageUploadField';

async function uploadGroupCover(file: File, token: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch(apiUrl('/api/upload'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64: base64, category: 'group' }),
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        resolve(mediaUrl(data.url ?? data.secure_url));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
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
  rules?: string | null;
  memberRole?: 'admin' | 'moderator' | 'member' | null;
}

function GroupDetail({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const t = useT();

  const { data: group, isLoading: groupLoading, refetch } = useGetGroup(id);
  const { data: postsData, isLoading: postsLoading } = useGetGroupPosts(id, {});
  const { token } = useAuthStore();
  const [myRole, setMyRole] = useState<GroupView['memberRole']>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ name: '', description: '', privacy: 'open', rules: '', coverUrl: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (!group) return;
    const current = group as GroupView;
    setMyRole(current.memberRole ?? null);
    setSettings({ name: current.name, description: current.description ?? '', privacy: current.privacy ?? 'open', rules: current.rules ?? '', coverUrl: current.coverUrl ?? '' });
  }, [group]);

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
    const res = await fetch(`/api/groups/${id}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(settings) });
    if (!res.ok) return toast({ title: 'Could not update group settings', variant: 'destructive' });
    toast({ title: 'Group settings updated' });
    setSettingsOpen(false);
    void refetch();
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-0">
        <Link href="/groups" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t('groups.backToGroups', 'Back to Groups')}
        </Link>

        <div className="w-full h-40 md:h-56 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/30 to-accent/30 mb-0 relative">
          {group.coverUrl ? (
            <img src={group.coverUrl} alt={group.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-primary/40 font-serif">
              {group.name[0]}
            </div>
          )}
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-6 -mt-6 mx-4 md:mx-0 shadow-lg mb-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary text-3xl font-bold font-serif flex items-center justify-center border border-border/40 shrink-0">
              {group.avatarUrl ? <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover rounded-2xl" /> : group.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
                  {group.name}
                  {(group as GroupView).isVerified && (
                      <span className="inline-flex" title={t('groups.verifiedGroup', 'Verified group')} data-testid="badge-group-verified">
                      <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500/15" />
                    </span>
                  )}
                </h1>
                {(group as GroupView).isPromoted && (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] uppercase tracking-wider gap-1" data-testid="badge-group-promoted">
                    <Megaphone className="w-3 h-3" /> {t('groups.promoted', 'Promoted')}
                  </Badge>
                )}
              </div>
              {group.description && <p className="text-muted-foreground text-sm mb-3">{group.description}</p>}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{group.membersCount} {t('groups.members', 'members')}</span>
                <span>{group.postsCount} {t('groups.posts', 'posts')}</span>
              </div>
            </div>
            <Button
              onClick={() => toggleJoin({ id })}
              disabled={isJoining}
              className={`shrink-0 rounded-xl ${group.isMember ? 'bg-secondary text-secondary-foreground hover:bg-destructive/10 hover:text-destructive' : 'bg-primary text-primary-foreground'}`}
            >
              {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : group.isMember ? t('groups.leaveGroup', 'Leave Group') : t('groups.joinGroup', '+ Join Group')}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="posts">
          <TabsList className="mb-6 bg-muted/50 rounded-xl p-1">
            <TabsTrigger value="posts" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('groups.postsTab', 'Posts')}</TabsTrigger>
            <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('groups.membersTab', 'Members')}</TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="space-y-5">
            <PinnedPosts groupId={id} myRole={myRole ?? null} />
            {myRole === 'admin' && (
              <div className="mb-5">
                <Button variant="outline" onClick={() => setSettingsOpen(value => !value)} className="rounded-xl gap-2"><Settings className="w-4 h-4" /> Group settings</Button>
                {settingsOpen && <div className="mt-3 rounded-2xl border border-border bg-card p-4 space-y-3">
                  <Input value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} placeholder="Group name" />
                  <Textarea value={settings.description} onChange={e => setSettings(s => ({ ...s, description: e.target.value }))} placeholder="Description" />
                  <Select value={settings.privacy} onValueChange={privacy => setSettings(s => ({ ...s, privacy }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open group</SelectItem><SelectItem value="private">Private group</SelectItem></SelectContent></Select>
                  <Textarea value={settings.rules} onChange={e => setSettings(s => ({ ...s, rules: e.target.value }))} placeholder="Group rules" />
                  <ImageUploadField value={settings.coverUrl} onChange={coverUrl => setSettings(s => ({ ...s, coverUrl }))} category="group" label="Choose cover photo" />
                  <Button onClick={() => void saveSettings()} className="rounded-xl">Save settings</Button>
                </div>}
              </div>
            )}
            {postsLoading && Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
            {!postsLoading && postsData?.posts.length === 0 && (
              <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed border-border text-muted-foreground">
                <Hash className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">{t('groups.noPostsYet', 'No posts yet')}</p>
                <p className="text-sm mt-1">{t('groups.beFirstPost', 'Be the first to post in this group')}</p>
              </div>
            )}
            {postsData?.posts.map(post => (
              <div key={post.id} className="relative">
                <PostCard post={post} />
                {(myRole === 'admin' || myRole === 'moderator') && <button type="button" title="Remove post" onClick={() => void removePost(post.id)} className="absolute right-3 top-3 rounded-lg border border-border bg-background/90 p-2 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="members">
            <GroupMembersList groupId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function GroupsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const t = useT();
  const { token } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', privacy: 'public', coverUrl: '' });
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const { data, isLoading } = useGetGroups({ search: search || undefined });

  const { mutate: createGroup, isPending: isCreating } = useCreateGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
        toast({ title: t('groups.groupCreated', 'Group created!'), description: t('groups.groupCreatedDesc', 'Your community is live.') });
        setCreateOpen(false);
        setForm({ name: '', description: '', privacy: 'public', coverUrl: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      onError: () => toast({ title: t('groups.createFailed', 'Failed to create group'), variant: 'destructive' })
    }
  });

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const uploadedUrl = await uploadGroupCover(file, token);
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
                    {(group as GroupView).isPromoted && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] uppercase tracking-wider gap-1">
                        <Megaphone className="w-2.5 h-2.5" /> {t('groups.promoted', 'Promoted')}
                      </Badge>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">{group.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />{group.membersCount} {t('groups.members', 'members')}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link href={`/groups/${group.id}`}>
                        <Button variant="ghost" size="sm" className="rounded-xl h-8 text-xs">{t('groups.view', 'View')}</Button>
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => joinGroup({ id: group.id })}
                        className={`rounded-xl h-8 text-xs ${group.isMember ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}
                      >
                        {group.isMember ? t('groups.joined', 'Joined') : t('groups.join', '+ Join')}
                      </Button>
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
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('groups.descriptionPlaceholder', 'What is this group about?')} className="mt-1.5 rounded-xl resize-none" rows={3} />
            </div>
            <div>
              <Label>{t('groups.coverPhoto', 'Cover photo')}</Label>
              <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="mt-1.5 rounded-xl file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm" />
              {isUploadingCover && <p className="mt-2 text-xs text-muted-foreground">Uploading cover photo...</p>}
              {form.coverUrl && <img src={form.coverUrl} alt="Cover preview" className="mt-3 h-28 w-full rounded-xl object-cover border border-border" />}
            </div>
            <div>
              <Label>{t('groups.privacy', 'Privacy')}</Label>
              <Select value={form.privacy} onValueChange={v => setForm(f => ({ ...f, privacy: v }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => createGroup({
                data: {
                  name: form.name,
                  description: form.description || null,
                  category: 'general',
                  coverUrl: form.coverUrl || null,
                  privacy: form.privacy as 'public' | 'private',
                },
              })}
              disabled={isCreating || !form.name}
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

export default function Groups() {
  const [, params] = useRoute('/groups/:id');
  const groupId = params?.id ? parseInt(params.id) : null;
  if (groupId) return <GroupDetail id={groupId} />;
  return <GroupsList />;
}
