import { useState, useEffect, useRef, useCallback } from 'react';
import { useGetConversations, useGetMessages, useSendMessage, getGetMessagesQueryKey } from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearch } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Users, Search, MessageCircle, PenSquare, Check, CheckCheck, BadgeCheck } from 'lucide-react';
import NewConversationModal from '@/components/messages/NewConversationModal';
import { ReportDialog } from '@/components/report/ReportDialog';
import { Timestamp, formatPostTimestamp } from '@/lib/postTimestamp';
import { useSocketEvent, useJoinConversation } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';
import { reportCaughtError } from '@/lib/reportCaughtError';
import { AttachmentPicker, type Attachment } from '@/components/post/AttachmentPicker';
import { useToast } from '@/hooks/use-toast';

function renderMessageContent(content: string) {
  const parts = content.split(/(https?:\/\/[^\s<>]+|\/api\/file\/\d+(?:\?[^\s<>]*)?)/g);
  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part) || /^\/api\/file\/\d+/.test(part)) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">
          {part}
        </a>
      );
    }
    return part;
  });
}

interface LocalMessage {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  deliveredAt?: string | null;
  seenAt?: string | null;
  conversationId?: number;
  sender?: {
    id?: number;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    isOfficialAccount?: boolean;
  };
}

interface MessageRequest {
  id: number;
  requester: {
    id: number;
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
  };
  createdAt: string;
  lastMessageAt: string;
  contextCard?: { type: string; title: string; url: string } | null;
}

export default function Messages() {
  usePageTitle('Messages');
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user: currentUser } = useAuthStore();
  const t = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread'>('all');
  const [conversationFolder, setConversationFolder] = useState<'inbox' | 'requests'>('inbox');
  const [respondingRequestId, setRespondingRequestId] = useState<number | null>(null);
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageAttachments, setMessageAttachments] = useState<Attachment[]>([]);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestedUserStartRef = useRef<number | null>(null);

  const { data: conversations, isLoading: isConvsLoading } = useGetConversations();
  const conversationList = Array.isArray(conversations) ? conversations : [];
  const { data: messageRequests = [], isLoading: isRequestsLoading, isError: requestsFailed } = useQuery<MessageRequest[]>({
    queryKey: ['/api/messages/requests'],
    queryFn: async () => {
      const response = await apiFetch('/api/messages/requests');
      if (!response.ok) throw new Error('Could not load message requests.');
      return response.json() as Promise<MessageRequest[]>;
    },
  });
  const visibleConversations = conversationList.filter((conversation) => (
    conversationFilter === 'all' || conversation.unreadCount > 0
  ));

  const { data: messages, isLoading: isMsgsLoading, isError: isMsgsError } = useGetMessages(activeConvId ?? 0, {
    query: { enabled: !!activeConvId, queryKey: getGetMessagesQueryKey(activeConvId ?? 0) }
  });
  const activeConvRequest = conversationList.find((conversation) => conversation.id === activeConvId) as
    | { requestStatus?: string; requestRecipientId?: number | null }
    | undefined;
  const isOutgoingRequest = activeConvRequest?.requestStatus === 'pending_request'
    && activeConvRequest.requestRecipientId !== currentUser?.id;
  const isClosedOutgoingRequest = activeConvRequest?.requestStatus === 'declined'
    && activeConvRequest.requestRecipientId !== currentUser?.id;

  useEffect(() => {
    setLocalMessages(Array.isArray(messages) ? messages as unknown as LocalMessage[] : []);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  const canJoinActiveConversation = !!activeConvRequest && (
    activeConvRequest.requestStatus === 'accepted'
    || activeConvRequest.requestRecipientId !== currentUser?.id
  );
  useJoinConversation(canJoinActiveConversation ? activeConvId : null);

  useSocketEvent<LocalMessage & { conversationId: number }>('message:receive', useCallback((msg) => {
    if (msg.conversationId !== activeConvId) {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      return;
    }
    setLocalMessages(prev => {
      if (prev.find((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
  }, [activeConvId, queryClient]));

  useSocketEvent<{ conversationId: number }>('message:request', useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['/api/messages/requests'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
  }, [queryClient]));

  useSocketEvent<{ conversationId: number; requestStatus: string }>('message:request-updated', useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['/api/messages/requests'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
  }, [queryClient]));

  useEffect(() => {
    if (!activeConvId || !currentUser?.id || !conversationList.some(conversation => conversation.id === activeConvId)) return;

    const markSeen = async () => {
      try {
        await fetch(`/api/messages/conversations/${activeConvId}/seen`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
        });
      } catch (error) {
        console.error('Failed to mark messages as seen', error);
        reportCaughtError(error, { action: 'mark_messages_seen', conversationId: activeConvId });
      }
    };

    void markSeen();
  }, [activeConvId, currentUser?.id, conversationList]);

  useSocketEvent<{ conversationId: number; seenAt: string; messageIds?: number[] }>('messages:seen', useCallback((data) => {
    if (!activeConvId || data.conversationId !== activeConvId) return;

    setLocalMessages(prev => prev.map(msg => {
      if (msg.senderId !== currentUser?.id) return msg;
      if (data.messageIds && !data.messageIds.includes(msg.id)) return msg;
      return { ...msg, seenAt: data.seenAt };
    }));
  }, [activeConvId, currentUser?.id]));

  useSocketEvent<{ conversationId: number; userId: number }>('typing:start', useCallback((data) => {
    if (data.conversationId === activeConvId && data.userId !== currentUser?.id) {
      setTypingUsers(prev => new Set(prev).add(data.userId));
    }
  }, [activeConvId, currentUser?.id]));

  useSocketEvent<{ conversationId: number; userId: number }>('typing:stop', useCallback((data) => {
    if (data.conversationId === activeConvId) {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    }
  }, [activeConvId]));

  const handleTyping = (value: string) => {
    setMessageText(value);
    if (!activeConvId || !currentUser?.id) return;
    const socket = getSocket();
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', { conversationId: activeConvId, userId: currentUser.id });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing:stop', { conversationId: activeConvId, userId: currentUser.id });
    }, 1500);
  };

  const { mutate: sendMsg, isPending: isSending } = useSendMessage({
    mutation: {
      onSuccess: (data: unknown) => {
        const msg = data as LocalMessage;
        setMessageText('');
        setMessageAttachments([]);
        setLocalMessages(prev => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (activeConvId && currentUser) {
          const socket = getSocket();
          isTypingRef.current = false;
          socket.emit('typing:stop', { conversationId: activeConvId, userId: currentUser.id });
        }
        queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      }
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && messageAttachments.length === 0) || !activeConvId) return;
    const attachmentContent = messageAttachments.map(attachment => (
      `[Attachment: ${attachment.filename || 'file'}]\n${attachment.url}`
    )).join('\n\n');
    const content = [messageText.trim(), attachmentContent].filter(Boolean).join('\n\n');
    if (content.length > 5_000) {
      toast({ title: 'Message is too long', description: 'Remove some attachments or shorten your message.', variant: 'destructive' });
      return;
    }
    sendMsg({ data: { conversationId: activeConvId, content } });
  };

  const respondToRequest = async (conversationId: number, action: 'accept' | 'decline') => {
    setRespondingRequestId(conversationId);
    try {
      const response = await apiFetch(`/api/messages/requests/${conversationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Could not update the message request.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/messages/requests'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] }),
      ]);
      if (action === 'accept') {
        setConversationFolder('inbox');
        handleSelectConv(conversationId);
      }
    } catch (error) {
      toast({
        title: action === 'accept' ? 'Could not accept request' : 'Could not decline request',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRespondingRequestId(null);
    }
  };

  const handleSelectConv = (convId: number) => {
    setConversationFolder('inbox');
    setActiveConvId(convId);
    setLocalMessages([]);
    setTypingUsers(new Set());
    if (Number(new URLSearchParams(search).get('conv')) !== convId) {
      setLocation(`/messages?conv=${convId}`);
    }
  };

  useEffect(() => {
    if (new URLSearchParams(search).get('requests') === '1') {
      setConversationFolder('requests');
      setActiveConvId(null);
    }
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const requestedConversationId = Number(params.get('conv'));
    if (Number.isInteger(requestedConversationId) && requestedConversationId > 0) {
      requestedUserStartRef.current = null;
      if (requestedConversationId !== activeConvId) handleSelectConv(requestedConversationId);
      return;
    }

    const requestedUserId = Number(params.get('userId'));
    if (!Number.isInteger(requestedUserId) || requestedUserId < 1) {
      requestedUserStartRef.current = null;
      return;
    }
    if (!currentUser || requestedUserStartRef.current === requestedUserId) return;
    requestedUserStartRef.current = requestedUserId;

    void (async () => {
      try {
        const contextType = params.get('contextType');
        const contextId = Number(params.get('contextId'));
        const context = ['post', 'series', 'chain', 'project'].includes(contextType || '')
          && Number.isInteger(contextId) && contextId > 0
          ? { type: contextType, id: contextId }
          : undefined;
        const response = await apiFetch('/api/messages/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: requestedUserId, ...(context ? { context } : {}) }),
        });
        const result = await response.json().catch(() => null);
        const conversationId = Number(result?.conversationId);
        if (!response.ok || !Number.isInteger(conversationId) || conversationId < 1) {
          throw new Error(result?.error || 'Could not open this conversation.');
        }
        void queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
        void queryClient.invalidateQueries({ queryKey: ['/api/messages/requests'] });
        if (result?.requestStatus === 'pending_request' && result?.requestRecipientId === currentUser.id) {
          setConversationFolder('requests');
          setLocation('/messages?requests=1');
          return;
        }
        setLocation(`/messages?conv=${conversationId}`);
      } catch (error) {
        requestedUserStartRef.current = null;
        toast({
          title: 'Could not open this conversation',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    })();
  }, [search, activeConvId, currentUser, queryClient, setLocation, toast]);

  const handleConversationStart = (convId: number) => {
    queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
    queryClient.invalidateQueries({ queryKey: ['/api/messages/requests'] });
    const conversation = conversationList.find((item) => item.id === convId) as
      | { requestStatus?: string; requestRecipientId?: number | null }
      | undefined;
    if (
      (conversation?.requestStatus === 'pending_request' && conversation.requestRecipientId === currentUser?.id)
      || messageRequests.some(request => request.id === convId)
    ) {
      setConversationFolder('requests');
      setLocation('/messages?requests=1');
      return;
    }
    handleSelectConv(convId);
  };

  const activeConv = conversationList.find((c) => (c as { id: number }).id === activeConvId) as { id: number; isGroup?: boolean; groupName?: string; contextCard?: { type: string; title: string; url: string } | null; participants: Array<{ id: number; displayName?: string; avatarUrl?: string | null; username?: string }> } | undefined;
  const otherUser = activeConv?.participants.find((p) => p.id !== currentUser?.id);

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-8rem)] min-h-0 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm md:h-[calc(100dvh-6rem)]">

        {/* Sidebar List */}
        <div className={`${activeConvId ? 'hidden md:flex' : 'flex'} min-h-0 w-full flex-col border-r border-border/50 bg-muted/10 md:w-80`}>
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold font-serif">{t('messages.title')}</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNewConvOpen(true)}
                className="flex items-center gap-1.5 rounded-xl text-xs h-8 px-3"
              >
                <PenSquare className="w-3.5 h-3.5" />
                {t('messages.new')}
              </Button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('messages.searchPlaceholder')} className="pl-9 bg-background rounded-xl border-border/60" />
            </div>
            <div className="mt-3 flex gap-1" role="tablist" aria-label="Message folder">
              {(['inbox', 'requests'] as const).map((folder) => (
                <button
                  key={folder}
                  type="button"
                  role="tab"
                  aria-selected={conversationFolder === folder}
                  onClick={() => setConversationFolder(folder)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${conversationFolder === folder ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                >
                  {folder === 'inbox' ? 'Inbox' : <>Requests{messageRequests.length > 0 && <span className="ml-1.5">{messageRequests.length}</span>}</>}
                </button>
              ))}
            </div>
            {conversationFolder === 'inbox' && (
              <div className="mt-2 flex gap-1" role="tablist" aria-label="Conversation filter">
                {(['all', 'unread'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={conversationFilter === filter}
                    onClick={() => setConversationFilter(filter)}
                    className={`flex-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${conversationFilter === filter ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                  >
                    {filter === 'all' ? 'All' : 'Unread'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {conversationFolder === 'requests' ? (
              isRequestsLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading message requests...</div>
              ) : requestsFailed ? (
                <div className="p-6 text-center text-sm text-destructive">Could not load message requests. Please try again.</div>
              ) : messageRequests.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
                  <MessageCircle className="mb-3 h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">No message requests</p>
                  <p className="mt-1 text-xs">Requests from people you do not follow will appear here.</p>
                </div>
              ) : messageRequests.map((request) => (
                <div key={request.id} className="flex items-center gap-3 border-b border-border/30 p-4">
                  {request.requester.username ? (
                    <Link href={`/profile/${request.requester.username}`} className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring">
                      <Avatar className="h-11 w-11 border border-border/50">
                        <AvatarImage src={request.requester.avatarUrl || ''} />
                        <AvatarFallback>{request.requester.displayName?.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="h-11 w-11 border border-border/50">
                      <AvatarFallback>{request.requester.displayName?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{request.requester.displayName}</p>
                    <p className="text-xs text-muted-foreground">Message request</p>
                    {request.contextCard && <Link href={request.contextCard.url} className="text-xs text-primary hover:underline" onClick={(event) => event.stopPropagation()}>About: {request.contextCard.title}</Link>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" className="h-8 px-3 text-xs" disabled={respondingRequestId === request.id} onClick={() => void respondToRequest(request.id, 'accept')}>Accept</Button>
                    <Button size="sm" variant="outline" className="h-8 px-3 text-xs" disabled={respondingRequestId === request.id} onClick={() => void respondToRequest(request.id, 'decline')}>Decline</Button>
                  </div>
                </div>
              ))
            ) : isConvsLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <div className="w-12 h-12 rounded-full bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                      <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !conversations || conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center text-muted-foreground">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <PenSquare className="w-6 h-6 opacity-40" />
                </div>
                <p className="font-medium text-sm">{t('messages.noConversations', 'No conversations yet')}</p>
                <p className="text-xs mt-1">{t('messages.startFirstConversation', 'Start a conversation with a creator you follow')}</p>
                <Button size="sm" className="mt-4 rounded-xl" onClick={() => setIsNewConvOpen(true)}>
                  <PenSquare className="w-3.5 h-3.5 mr-1.5" />
                  {t('messages.newConversation', 'New Conversation')}
                </Button>
              </div>
            ) : visibleConversations?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center text-muted-foreground">
                <MessageCircle className="w-8 h-8 mb-3 opacity-40" />
                <p className="font-medium text-sm">No unread conversations</p>
              </div>
            ) : visibleConversations?.map((conv) => {
              const typedConv = conv as { id: number; isGroup?: boolean; groupName?: string; lastMessageContent?: string; lastMessageAt?: string; participants: Array<{ id: number; displayName?: string; avatarUrl?: string | null; username?: string }> };
              const partner = typedConv.participants.find((p) => p.id !== currentUser?.id);
              const isActive = activeConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConv(conv.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectConv(conv.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full text-left p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/30 ${isActive ? 'bg-muted/80 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                >
                  {conv.isGroup ? (
                    <Avatar className="w-12 h-12 border border-border/50">
                      <AvatarFallback className="bg-primary/20 text-primary"><Users className="w-5 h-5" /></AvatarFallback>
                    </Avatar>
                  ) : partner?.username ? (
                    <Link href={`/profile/${partner.username}`} onClick={event => event.stopPropagation()} className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring">
                      <Avatar className="w-12 h-12 border border-border/50">
                        <AvatarImage src={partner.avatarUrl || ''} />
                        <AvatarFallback>{partner.displayName?.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="w-12 h-12 border border-border/50">
                      <AvatarImage src={partner?.avatarUrl || ''} />
                      <AvatarFallback>{partner?.displayName?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      {conv.isGroup || !partner?.username ? (
                        <h4 className="font-semibold text-sm truncate">{conv.isGroup ? conv.groupName : partner?.displayName}</h4>
                      ) : (
                        <Link href={`/profile/${partner.username}`} onClick={event => event.stopPropagation()} className="font-semibold text-sm truncate hover:text-primary transition-colors">
                          {partner.displayName}
                        </Link>
                      )}
                      {conv.lastMessage && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          <Timestamp value={conv.lastMessage.createdAt} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage?.content || 'Say hi!'}
                    </p>
                    {(conv as { requestStatus?: string }).requestStatus === 'pending_request' && (
                      <p className="mt-1 text-[10px] font-medium text-primary">Message request sent</p>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              );
            })}
          </ScrollArea>
        </div>

        {activeConv?.contextCard && (
          <div className="border-b border-border/50 bg-primary/5 px-6 py-2 text-xs">
            <span className="text-muted-foreground">Conversation context · </span>
            <Link href={activeConv.contextCard.url} className="font-medium text-primary hover:underline">{activeConv.contextCard.title}</Link>
          </div>
        )}

        {/* Chat Area */}
        <div className={`${!activeConvId ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-1 flex-col bg-background`}>
          {activeConvId ? (
            <>
              {/* Header */}
              <div className="min-h-16 border-b border-border/50 flex flex-wrap items-center px-3 sm:px-6 py-2 bg-card shrink-0 gap-2 sm:gap-3 shadow-sm z-10">
                <button className="md:hidden p-2 -ml-2 text-muted-foreground" onClick={() => setActiveConvId(null)}>
                  ←
                </button>
                {activeConv?.isGroup ? (
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-primary/20 text-primary"><Users className="w-4 h-4" /></AvatarFallback>
                  </Avatar>
                ) : otherUser?.username ? (
                  <Link href={`/profile/${otherUser.username}`} className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={otherUser.avatarUrl || ''} />
                      <AvatarFallback>{otherUser.displayName?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                  </Link>
                ) : (
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={otherUser?.avatarUrl || ''} />
                    <AvatarFallback>{otherUser?.displayName?.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 flex-1">
                  {activeConv?.isGroup || !otherUser?.username ? (
                    <h3 className="truncate font-semibold text-foreground">{activeConv?.isGroup ? activeConv?.groupName : otherUser?.displayName}</h3>
                  ) : (
                    <Link href={`/profile/${otherUser.username}`} className="block truncate font-semibold text-foreground hover:text-primary transition-colors">
                      {otherUser.displayName}
                    </Link>
                  )}
                  {typingUsers.size > 0 ? (
                    <p className="text-xs text-primary animate-pulse">{t('messages.typing')}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">@{otherUser?.username}</p>
                  )}
                </div>
                {(isOutgoingRequest || isClosedOutgoingRequest) && (
                  <p className="min-w-0 basis-full text-xs text-muted-foreground sm:ml-auto sm:basis-auto sm:text-right">
                    {isOutgoingRequest ? 'Your message request is awaiting acceptance.' : 'This conversation is unavailable.'}
                  </p>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="min-h-0 flex-1 p-3 sm:p-5">
                <div className="flex min-h-full flex-col justify-end gap-3">
                  {!activeConv && (
                    <div className="my-auto text-center text-sm text-muted-foreground">
                      This conversation is unavailable in your inbox. Check Requests to review a message request.
                    </div>
                  )}
                  {isMsgsError && activeConv && (
                    <div className="my-auto text-center text-sm text-destructive">
                      Could not load this conversation. Please try again.
                    </div>
                  )}
                  {isMsgsLoading && localMessages.length === 0 && (
                    <div className="text-center text-muted-foreground">{t('messages.loadingMessages')}</div>
                  )}
                  {!isMsgsLoading && localMessages.length === 0 && (
                    <div className="flex flex-col items-center text-center py-16 px-4"><div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3"><MessageCircle className="w-5 h-5 text-muted-foreground" /></div><p className="text-sm font-medium">No messages yet</p><p className="text-xs text-muted-foreground mt-1">Start the conversation and say hello.</p></div>
                  )}
                  {localMessages.map((msg) => {
                    const isMine = msg.senderId === currentUser?.id;
                    const sender = msg.sender;
                    const messageSeenAt = msg.seenAt ? new Date(msg.seenAt) : null;
                    const latestSeenMessage = localMessages
                      .filter(m => m.senderId === currentUser?.id && m.seenAt)
                      .sort((a, b) => new Date(b.seenAt ?? 0).getTime() - new Date(a.seenAt ?? 0).getTime())[0];
                    const showSeenLabel = isMine && msg.id === latestSeenMessage?.id && !!messageSeenAt;

                    return (
                      <div key={msg.id} className={`flex max-w-[88%] ${isMine ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                        {!isMine && sender && (
                          sender.username ? (
                            <Link href={`/profile/${sender.username}`} className="shrink-0 mr-2 self-end rounded-full focus-visible:ring-2 focus-visible:ring-ring">
                              <Avatar className="w-7 h-7 border border-border/50">
                                <AvatarImage src={sender.avatarUrl || ''} />
                                <AvatarFallback className="text-[10px]">{sender.displayName?.substring(0, 2)}</AvatarFallback>
                              </Avatar>
                            </Link>
                          ) : (
                            <Avatar className="w-7 h-7 border border-border/50 shrink-0 mr-2 self-end">
                              <AvatarImage src={sender.avatarUrl || ''} />
                              <AvatarFallback className="text-[10px]">{sender.displayName?.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                          )
                        )}
                        <div className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:px-4 ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted/60 text-foreground border border-border/50 rounded-tl-sm'}`}>
                          {!isMine && sender?.isOfficialAccount && (
                            <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              <BadgeCheck className="h-3.5 w-3.5" /> Official QuillHive account · @{sender.username}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{renderMessageContent(msg.content)}</p>
                          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-80">
                            <Timestamp value={msg.createdAt} />
                            {isMine && (
                              <div className="inline-flex items-center gap-0.5" title={msg.seenAt ? `Seen ${formatPostTimestamp(msg.seenAt)?.title ?? ''}` : msg.deliveredAt ? 'Delivered' : 'Sent'}>
                                {msg.seenAt ? (
                                  <>
                                    <CheckCheck className="h-3.5 w-3.5 fill-current text-primary-foreground/95" />
                                    <CheckCheck className="h-3.5 w-3.5 fill-current text-primary-foreground/95 -ml-1.5" />
                                  </>
                                ) : msg.deliveredAt ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-primary-foreground/80" />
                                    <Check className="h-3.5 w-3.5 text-primary-foreground/80 -ml-1.5" />
                                  </>
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-primary-foreground/60" />
                                )}
                              </div>
                            )}
                          </div>
                          {showSeenLabel && messageSeenAt && (
                            <div className="mt-1 text-[10px] text-primary-foreground/80 text-right">
                              Seen <Timestamp value={messageSeenAt} />
                            </div>
                          )}
                          {!isMine && <ReportDialog targetType="message" targetId={msg.id} label="Report" className="mt-1 h-5 px-1 text-[9px]" />}
                        </div>
                      </div>
                    );
                  })}
                  {typingUsers.size > 0 && (
                    <div className="flex justify-start mr-auto">
                      <div className="bg-muted/60 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1 items-center h-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              {activeConv && (isOutgoingRequest && localMessages.length > 0) ? (
                  <div className="border-t border-border/50 bg-card px-4 py-3 text-center text-xs text-muted-foreground">
                    You can send another message after this request is accepted.
                  </div>
              ) : activeConv && isClosedOutgoingRequest ? (
                  <div className="border-t border-border/50 bg-card px-4 py-3 text-center text-xs text-muted-foreground">
                    This conversation is unavailable.
                  </div>
              ) : activeConv ? (
                <div className="shrink-0 border-t border-border/50 bg-card p-3 sm:p-4">
                  <form
                    onSubmit={handleSend}
                    className="flex min-w-0 flex-wrap items-center gap-2 rounded-3xl border border-border/50 bg-muted/30 p-1.5 transition-colors focus-within:border-primary/50"
                  >
                    <AttachmentPicker
                      attachments={messageAttachments}
                      onChange={setMessageAttachments}
                      category="general"
                      max={5}
                      compact
                      iconOnly
                      label="Add attachment"
                    />
                    <Input
                      placeholder={t('messages.typePlaceholder', 'Type a message...')}
                      value={messageText}
                      onChange={e => handleTyping(e.target.value)}
                      className="min-w-[120px] flex-1 border-0 bg-transparent px-2 focus-visible:ring-0"
                    />
                    <Button type="submit" size="icon" disabled={isSending || (!messageText.trim() && messageAttachments.length === 0)} className="rounded-full shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-serif font-medium text-foreground mb-2">{t('messages.yourMessages')}</h3>
              <p>{t('messages.selectConversation', 'Select a conversation or start a new one to connect with other creatives.')}</p>
            </div>
          )}
        </div>
      </div>

      <NewConversationModal
        open={isNewConvOpen}
        onClose={() => setIsNewConvOpen(false)}
        onConversationStart={handleConversationStart}
      />
    </AppLayout>
  );
}
