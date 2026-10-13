import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2 } from 'lucide-react';
import { getApiErrorMessage, getStoredToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SearchUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConversationStart: (conversationId: number) => void;
}

export default function NewConversationModal({ open, onClose, onConversationStart }: Props) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setUsers([]);
      setNoResults(false);
      setIsSearching(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setUsers([]);
      setNoResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
        setNoResults(Array.isArray(data) && data.length === 0);
      } catch {
        setUsers([]);
        setNoResults(true);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelectUser = async (userId: number) => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const token = getStoredToken();
      const res = await fetch('/api/messages/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Could not start this conversation. Please try again.'));
      }
      const data = await res.json() as { conversationId?: number };
      if (typeof data.conversationId !== 'number' || !Number.isInteger(data.conversationId)) {
        throw new Error('The conversation could not be started. Please try again.');
      }
      onConversationStart(data.conversationId);
      onClose();
    } catch (error) {
      toast({
        title: 'Could not start conversation',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isStarting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">New Conversation</DialogTitle>
        </DialogHeader>

        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
          <Input
            ref={inputRef}
            placeholder="Search users..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 pr-9 rounded-xl"
            disabled={isStarting}
          />
        </div>

        <div className="mt-1 max-h-72 overflow-y-auto space-y-0.5">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user.id)}
              disabled={isStarting}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 active:bg-muted/80 transition-colors text-left disabled:opacity-50"
            >
              <Avatar className="w-10 h-10 shrink-0 border border-border/50">
                <AvatarImage src={user.avatarUrl || ''} />
                <AvatarFallback className="text-sm font-medium">
                  {user.displayName?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold text-sm text-foreground truncate">{user.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                {user.bio && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{user.bio}</p>
                )}
              </div>
              {isStarting && (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
              )}
            </button>
          ))}

          {noResults && !isSearching && query.trim() && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No users found for "{query}"</p>
            </div>
          )}

          {!query.trim() && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">Search for someone to message</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
