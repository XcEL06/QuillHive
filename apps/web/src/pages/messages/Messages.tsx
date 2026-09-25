import { useState, useEffect, useRef, useCallback } from 'react';
import { useGetConversations, useGetMessages, useSendMessage, getGetMessagesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Users, Search, MessageCircle, PenSquare, Check, CheckCheck, DollarSign } from 'lucide-react';
import NewConversationModal from '@/components/messages/NewConversationModal';
import { ReportDialog } from '@/components/report/ReportDialog';
import { formatDistanceToNow } from 'date-fns';
import { useSocketEvent, useJoinConversation } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';
import { getStoredToken } from '@/lib/api';

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
  };
}

interface PaymentProposal {
  id: number;
  proposerId: number;
  amount: number;
  currency: string;
  note?: string | null;
  status: string;
  createdAt: string;
}

export default function Messages() {
  usePageTitle('Messages');
  const { user: currentUser } = useAuthStore();
  const t = useT();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread'>('all');
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [paymentProposals, setPaymentProposals] = useState<PaymentProposal[]>([]);
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalCurrency, setProposalCurrency] = useState('USD');
  const [proposalNote, setProposalNote] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: isConvsLoading } = useGetConversations();
  const conversationList = Array.isArray(conversations) ? conversations : [];
  const visibleConversations = conversationList.filter((conversation) => (
    conversationFilter === 'all' || conversation.unreadCount > 0
  ));

  const { data: messages, isLoading: isMsgsLoading } = useGetMessages(activeConvId ?? 0, {
    query: { enabled: !!activeConvId, queryKey: getGetMessagesQueryKey(activeConvId ?? 0) }
  });

  useEffect(() => {
    setLocalMessages(Array.isArray(messages) ? messages as unknown as LocalMessage[] : []);
  }, [messages]);

  useEffect(() => {
    if (!activeConvId) { setPaymentProposals([]); return; }
    const token = getStoredToken();
    void fetch(`/api/messages/conversations/${activeConvId}/payment-proposals`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((response) => response.ok ? response.json() : []).then((data) => setPaymentProposals(Array.isArray(data) ? data : [])).catch(() => setPaymentProposals([]));
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  useJoinConversation(activeConvId);

  useSocketEvent<PaymentProposal>('payment:proposal', useCallback((proposal) => {
    if (proposal && !paymentProposals.some((current) => current.id === proposal.id)) {
      setPaymentProposals((current) => [...current, proposal]);
    }
  }, [paymentProposals]));

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

  useEffect(() => {
    if (!activeConvId || !currentUser?.id) return;

    const markSeen = async () => {
      try {
        await fetch(`/api/messages/conversations/${activeConvId}/seen`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
        });
      } catch (error) {
        console.error('Failed to mark messages as seen', error);
      }
    };

    void markSeen();
  }, [activeConvId, currentUser?.id]);

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
    if (!messageText.trim() || !activeConvId) return;
    sendMsg({ data: { conversationId: activeConvId, content: messageText } });
  };

  const proposePayment = async () => {
    if (!activeConvId || !proposalAmount || Number(proposalAmount) <= 0) return;
    const token = getStoredToken();
    const response = await fetch(`/api/messages/conversations/${activeConvId}/payment-proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ amount: Number(proposalAmount), currency: proposalCurrency, note: proposalNote.trim() || undefined }),
    });
    const data = await response.json();
    if (!response.ok) return;
    setPaymentProposals((current) => [...current, data]);
    setProposalAmount('');
    setProposalNote('');
  };

  const updatePaymentProposal = async (proposalId: number, status: 'accepted' | 'rejected') => {
    if (!activeConvId) return;
    const token = getStoredToken();
    const response = await fetch(`/api/messages/conversations/${activeConvId}/payment-proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ status }),
    });
    if (response.ok) setPaymentProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, status } : proposal));
  };

  const handleSelectConv = (convId: number) => {
    setActiveConvId(convId);
    setLocalMessages([]);
    setTypingUsers(new Set());
  };

  const handleConversationStart = (convId: number) => {
    queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
    handleSelectConv(convId);
  };

  const activeConv = conversationList.find((c) => (c as { id: number }).id === activeConvId) as { id: number; isGroup?: boolean; groupName?: string; participants: Array<{ id: number; displayName?: string; avatarUrl?: string | null; username?: string }> } | undefined;
  const otherUser = activeConv?.participants.find((p) => p.id !== currentUser?.id);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem-64px)] md:h-[calc(100vh-4rem-2rem)] flex bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">

        {/* Sidebar List */}
        <div className={`${activeConvId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-border/50 bg-muted/10`}>
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
            <div className="flex gap-1 mt-3" role="tablist" aria-label="Conversation filter">
              {(['all', 'unread'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={conversationFilter === filter}
                  onClick={() => setConversationFilter(filter)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${conversationFilter === filter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                >
                  {filter === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isConvsLoading ? (
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
                          {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage?.content || 'Say hi!'}
                    </p>
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

        {/* Chat Area */}
        <div className={`${!activeConvId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-background`}>
          {activeConvId ? (
            <>
              {/* Header */}
              <div className="h-16 border-b border-border/50 flex items-center px-6 bg-card shrink-0 gap-3 shadow-sm z-10">
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
                <div>
                  {activeConv?.isGroup || !otherUser?.username ? (
                    <h3 className="font-semibold text-foreground">{activeConv?.isGroup ? activeConv?.groupName : otherUser?.displayName}</h3>
                  ) : (
                    <Link href={`/profile/${otherUser.username}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                      {otherUser.displayName}
                    </Link>
                  )}
                  {typingUsers.size > 0 ? (
                    <p className="text-xs text-primary animate-pulse">{t('messages.typing')}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">@{otherUser?.username}</p>
                  )}
                </div>
              </div>

              <div className="border-b border-border/50 bg-muted/20 px-6 py-3">
                <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-primary" /><p className="text-xs font-semibold">Payment terms</p><span className="text-[10px] text-muted-foreground">Propose or counter a budget/rate</span></div>
                <div className="space-y-2">
                  {paymentProposals.map((proposal) => <div key={proposal.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs"><span className="font-semibold">{proposal.currency} {proposal.amount.toLocaleString()}</span><span className="text-muted-foreground">{proposal.note || 'No note'}</span><span className="ml-auto rounded-full bg-muted px-2 py-0.5 capitalize">{proposal.status}</span>{proposal.status === 'proposed' && proposal.proposerId !== currentUser?.id && <><Button size="sm" className="h-6 text-[10px]" onClick={() => void updatePaymentProposal(proposal.id, 'accepted')}>Accept</Button><Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => void updatePaymentProposal(proposal.id, 'rejected')}>Decline</Button></>}</div>)}
                  <div className="flex flex-wrap items-center gap-2"><Input className="h-8 w-24 text-xs" type="number" min="0" placeholder="Amount" value={proposalAmount} onChange={(event) => setProposalAmount(event.target.value)} /><Input className="h-8 w-16 text-xs uppercase" maxLength={3} value={proposalCurrency} onChange={(event) => setProposalCurrency(event.target.value.toUpperCase())} /><Input className="h-8 min-w-40 flex-1 text-xs" placeholder="Scope, timing, or counter terms" value={proposalNote} onChange={(event) => setProposalNote(event.target.value)} /><Button size="sm" className="h-8" onClick={() => void proposePayment()} disabled={!proposalAmount}><DollarSign className="mr-1 h-3.5 w-3.5" />Propose</Button></div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="flex flex-col gap-4 justify-end min-h-full">
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
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} max-w-[80%] ${isMine ? 'ml-auto' : 'mr-auto'}`}>
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
                        <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted/60 text-foreground border border-border/50 rounded-tl-sm'}`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-80">
                            <span>{formatDistanceToNow(new Date(msg.createdAt))}</span>
                            {isMine && (
                              <div className="inline-flex items-center gap-0.5" title={msg.seenAt ? `Seen ${new Date(msg.seenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : msg.deliveredAt ? 'Delivered' : 'Sent'}>
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
                              Seen {formatDistanceToNow(messageSeenAt, { addSuffix: true })}
                            </div>
                          )}
                          {!isMine && <ReportDialog targetType="message" targetId={msg.id} label="Report" className="mt-2 h-7 px-2 text-[10px]" />}
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
              <div className="p-4 border-t border-border/50 bg-card shrink-0">
                <form
                  onSubmit={handleSend}
                  className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-full border border-border/50 focus-within:border-primary/50 transition-colors"
                >
                  <Input
                    placeholder={t('messages.typePlaceholder', 'Type a message...')}
                    value={messageText}
                    onChange={e => handleTyping(e.target.value)}
                    className="border-0 bg-transparent focus-visible:ring-0 flex-1 px-4"
                  />
                  <Button type="submit" size="icon" disabled={isSending || !messageText.trim()} className="rounded-full shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
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
