import { useEffect, useState } from 'react';
import { Share2, Send, Users, Zap, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiFetch, copyTextToClipboard } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';

type ShareDestination = 'group' | 'dm' | 'spark' | 'link';

interface ShareGroup {
  id: number;
  name: string;
  isMember?: boolean;
}

interface ShareUser {
  id: number;
  username: string;
  displayName?: string;
}

export function OpportunityShareDialog({ opportunityId, title }: { opportunityId: number; title: string }) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<ShareDestination>('group');
  const [groups, setGroups] = useState<ShareGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<ShareUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ShareUser | null>(null);
  const [caption, setCaption] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!open || destination !== 'group' || !token) return;
    void apiFetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const joined = (Array.isArray(data?.groups) ? data.groups : []).filter((group: ShareGroup) => group.isMember);
        setGroups(joined);
        setSelectedGroup(current => current && joined.some((group: ShareGroup) => group.id === current) ? current : joined[0]?.id ?? null);
      })
      .catch(() => setGroups([]));
  }, [open, destination, token]);

  useEffect(() => {
    if (!open || destination !== 'dm' || contactSearch.trim().length < 2) {
      setContacts([]);
      return;
    }
    const query = new URLSearchParams({ q: contactSearch.trim() });
    void apiFetch(`/api/users/search?${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(response => response.ok ? response.json() : [])
      .then(data => setContacts(Array.isArray(data) ? data.slice(0, 8) : []))
      .catch(() => setContacts([]));
  }, [open, destination, contactSearch, token]);

  const share = async () => {
    if (!token) return toast({ title: 'Sign in to share an opportunity', variant: 'destructive' });
    setIsSharing(true);
    try {
      let response: Response;
      if (destination === 'link') {
        await copyTextToClipboard(`${window.location.origin}/jobs?opportunity=${opportunityId}`);
        toast({ title: 'Opportunity link copied' });
        setOpen(false);
        return;
      }
      if (destination === 'group') {
        if (!selectedGroup) throw new Error('Choose a group you belong to.');
        response = await apiFetch(`/api/groups/${selectedGroup}/opportunities/${opportunityId}/reshare`, { method: 'POST' });
      } else if (destination === 'dm') {
        if (!selectedUser) throw new Error('Choose someone to message.');
        const startResponse = await apiFetch('/api/messages/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id }),
        });
        const started = await startResponse.json().catch(() => null);
        if (!startResponse.ok || !started?.conversationId) throw new Error(started?.error ?? 'Could not open this conversation.');
        response = await apiFetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: started.conversationId,
            content: `${title}\n${window.location.origin}/jobs?opportunity=${opportunityId}`,
          }),
        });
      } else {
        const shareUrl = `${window.location.origin}/jobs?opportunity=${opportunityId}`;
        const prefix = caption.trim() ? `${caption.trim()} ` : '';
        const sparkContent = `${prefix}${title.slice(0, Math.max(0, 280 - prefix.length - shareUrl.length - 1))} ${shareUrl}`.slice(0, 280);
        response = await apiFetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: sparkContent, type: 'spark', visibility: 'public', tags: [`opportunity:${opportunityId}`] }),
        });
      }

      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Could not share this opportunity.');
      toast({ title: destination === 'group' ? 'Shared with the group' : destination === 'dm' ? 'Sent in a direct message' : 'Shared as a Spark' });
      setOpen(false);
      setSelectedUser(null);
      setContactSearch('');
      setCaption('');
    } catch (error) {
      toast({ title: 'Could not share opportunity', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)} aria-label={`Share ${title}`}>
        <Share2 className="h-4 w-4" /> Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share opportunity</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground line-clamp-2">{title}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Share destination">
            {([
              ['group', Users, 'Group'],
              ['dm', Send, 'DM'],
              ['spark', Zap, 'Spark'],
              ['link', Link2, 'Link'],
            ] as const).map(([value, Icon, label]) => (
              <Button key={value} type="button" variant={destination === value ? 'default' : 'outline'} onClick={() => setDestination(value)} className="gap-1.5">
                <Icon className="h-4 w-4" />{label}
              </Button>
            ))}
          </div>
          {destination === 'group' && (
            <select aria-label="Choose a group" value={selectedGroup ?? ''} onChange={event => setSelectedGroup(Number(event.target.value) || null)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Choose a group</option>
              {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          )}
          {destination === 'dm' && (
            <div className="space-y-2">
              <Input value={contactSearch} onChange={event => { setContactSearch(event.target.value); setSelectedUser(null); }} placeholder="Find someone by name or username" />
              {selectedUser && <p className="text-sm">Sending to <strong>{selectedUser.displayName || selectedUser.username}</strong></p>}
              {!selectedUser && contacts.length > 0 && <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {contacts.map(contact => <button type="button" key={contact.id} onClick={() => setSelectedUser(contact)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">{contact.displayName || contact.username} <span className="text-muted-foreground">@{contact.username}</span></button>)}
              </div>}
            </div>
          )}
          {destination === 'spark' && <Input value={caption} maxLength={120} onChange={event => setCaption(event.target.value)} placeholder="Add a note (optional)" />}
          {destination === 'group' && groups.length === 0 && <p className="text-sm text-muted-foreground">Join a group before resharing an opportunity there.</p>}
          <Button type="button" onClick={() => void share()} disabled={isSharing || (destination === 'group' && !selectedGroup) || (destination === 'dm' && !selectedUser)} className="w-full">
            {isSharing ? 'Sharing...' : destination === 'dm' ? 'Send message' : destination === 'spark' ? 'Post Spark' : destination === 'link' ? 'Copy link' : 'Share to group'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}