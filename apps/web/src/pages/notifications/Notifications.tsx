import { useState, useCallback } from 'react';
import { useGetNotifications, useMarkNotificationsRead } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Users, CheckCheck, Trash2, AlertCircle, Info, Zap, BadgeCheck } from 'lucide-react';
import { Timestamp } from '@/lib/postTimestamp';
import { Link } from 'wouter';
import { useSocketEvent } from '@/hooks/useSocket';
import { apiUrl, getStoredToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { clsx } from 'clsx';
import { useT } from '@/lib/i18n';
import { OFFICIAL_NOTICE_WARNING } from '@/lib/official-notice';

export default function Notifications() {
  usePageTitle('Notifications');
  const { data, isLoading } = useGetNotifications();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useT();
  const token = getStoredToken();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const { mutate: markRead, isPending } = useMarkNotificationsRead({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        void queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      }
    }
  });

  useSocketEvent<any>('notification:new', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
  }, [queryClient]));

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(apiUrl('/api/notifications/read-all'), {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        queryClient.setQueriesData({ queryKey: ['/api/notifications'] }, (current: any[] | undefined) =>
          Array.isArray(current) ? current.map(item => ({ ...item, isRead: true })) : current,
        );
        await queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        await queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
        toast({ title: t('notifications.markedAllRead') });
      } else {
        throw new Error('Could not mark notifications as read');
      }
    } catch {
      markRead();
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingIds(s => new Set([...s, id]));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not delete notification');
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    } catch {
      toast({ title: t('notifications.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeletingIds(s => { const next = new Set(s); next.delete(id); return next; });
    }
  };

  const getIcon = (type: string) => {
    const cls = 'p-1.5 text-white rounded-full absolute -bottom-1 -right-1 ring-2 ring-background';
    switch (type) {
      case 'like': return <div className={`${cls} bg-rose-500`}><Heart className="w-3 h-3 fill-current" /></div>;
      case 'comment': return <div className={`${cls} bg-blue-500`}><MessageCircle className="w-3 h-3 fill-current" /></div>;
      case 'follow': return <div className={`${cls} bg-primary`}><UserPlus className="w-3 h-3" /></div>;
      case 'mention': return <div className={`${cls} bg-amber-500`}><AtSign className="w-3 h-3" /></div>;
      case 'group_invite': return <div className={`${cls} bg-emerald-500`}><Users className="w-3 h-3" /></div>;
      case 'admin_action': return <div className={`${cls} bg-rose-600`}><AlertCircle className="w-3 h-3" /></div>;
      case 'official_notice': return <div className={`${cls} bg-amber-600`}><BadgeCheck className="w-3 h-3" /></div>;
      case 'system': return <div className={`${cls} bg-violet-500`}><Info className="w-3 h-3" /></div>;
      default: return <div className={`${cls} bg-muted-foreground`}><Zap className="w-3 h-3" /></div>;
    }
  };

  const getLink = (notif: any) => {
    if (notif.type === 'official_notice') return '/notifications';
    if (notif.postId) return `/post/${notif.postId}`;
    if (notif.groupId) return `/groups/${notif.groupId}`;
    return `/profile/${notif.actor?.username}`;
  };

  const allNotifs: any[] = Array.isArray(data) ? data : [];
  const unreadCount = allNotifs.filter((n: any) => !n.isRead).length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 pt-4 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-serif font-bold text-foreground">{t('notifications.title')}</h1>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-primary hover:text-primary/80 hover:bg-primary/10"
            >
              <CheckCheck className="w-4 h-4 mr-2" /> {t('notifications.markAllRead')}
            </Button>
          )}
        </div>

        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm divide-y divide-border/50">
          {isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-5 flex gap-4">
              <Skeleton className="w-12 h-12 rounded-full shrink-0" />
              <div className="space-y-2 w-full"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/4" /></div>
            </div>
          ))}

          {!isLoading && allNotifs.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t('notifications.allCaughtUp', "You're all caught up!")}</p>
            </div>
          )}

          {allNotifs.map((notif: any) => (
              <div
                key={notif.id}
                className={clsx(
                  'flex items-start gap-4 p-5 hover:bg-muted/50 transition-colors group',
                  !notif.isRead && 'bg-primary/5',
                   notif.type === 'official_notice' && 'border-l-4 border-l-amber-500 bg-amber-50/60 ring-1 ring-inset ring-amber-500/15 dark:bg-amber-950/20'
                )}
              >
                <Link
                  href={getLink(notif)}
                  onClick={() => {
                    if (!notif.isRead) {
                      void fetch(apiUrl(`/api/notifications/${notif.id}/read`), {
                        method: 'PATCH',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        credentials: 'include',
                      }).then(res => {
                        if (!res.ok) throw new Error('Could not mark notification as read');
                        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
                        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
                      }).catch(() => {});
                      queryClient.setQueriesData({ queryKey: ['/api/notifications'] }, (current: any[] | undefined) =>
                        Array.isArray(current)
                          ? current.map(item => item.id === notif.id ? { ...item, isRead: true } : item)
                          : current,
                      );
                    }
                  }}
                  className="flex-1 flex items-start gap-4 min-w-0"
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-12 h-12 border border-border">
                      <AvatarImage src={notif.actor?.avatarUrl || ''} />
                      <AvatarFallback>{notif.actor?.displayName?.substring(0, 2) ?? 'S'}</AvatarFallback>
                    </Avatar>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm text-foreground/90 leading-snug">
                      {notif.type === 'like' && notif.groupCount > 1
                        ? notif.title || `${notif.groupCount} people liked your post`
                        : <><span className="font-bold text-foreground">{notif.actor?.displayName ?? 'System'}</span>{' '}{notif.message}</>}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {notif.type === 'official_notice' && <Badge className="bg-amber-600 px-2 py-0 text-[10px] text-white hover:bg-amber-600">Official notice</Badge>}
                      <p className="text-xs text-muted-foreground font-medium">
                        <Timestamp value={notif.createdAt} />
                      </p>
                    </div>
                      {notif.type === 'official_notice' && (
                        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-950/80 dark:text-amber-100/80">
                          {OFFICIAL_NOTICE_WARNING}
                        </p>
                      )}
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1" />}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    disabled={deletingIds.has(notif.id)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t('notifications.dismiss')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
