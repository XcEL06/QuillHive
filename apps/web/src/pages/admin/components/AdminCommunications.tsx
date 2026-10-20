import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, ExternalLink, Heart, Megaphone, MessageCircle, RefreshCw, Search, Send } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

type CommunicationMode = "message" | "notification" | "broadcast" | "announcement";
type Recipient = {
  id: number;
  username: string;
  displayName: string;
  email: string;
};

type Announcement = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isBoosted: boolean;
};

const MODES: Array<{ key: CommunicationMode; label: string }> = [
  { key: "message", label: "Message a specific user" },
  { key: "notification", label: "Notify a specific user" },
  { key: "broadcast", label: "Broadcast notification to all users" },
  { key: "announcement", label: "Publish feed announcement + notify everyone" },
];

export default function AdminCommunications({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [mode, setMode] = useState<CommunicationMode>("message");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<Recipient[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Recipient | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [interactions, setInteractions] = useState({
    commentsEnabled: true,
    likesEnabled: true,
    repostsEnabled: true,
    sharingEnabled: true,
  });
  const [sending, setSending] = useState(false);
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementOffset, setAnnouncementOffset] = useState<number | null>(0);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<number | null>(null);

  const loadAnnouncements = useCallback(async (offset: number | null = 0) => {
    if (offset === null) return;
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);
    try {
      const data = await fetchAdmin(`/api/admin/communications/announcements?limit=20&offset=${offset}`);
      const loaded = Array.isArray(data.announcements) ? data.announcements as Announcement[] : [];
      setAnnouncements(current => offset === 0 ? loaded : [...current, ...loaded]);
      setAnnouncementOffset(data.nextOffset ?? null);
    } catch (error) {
      setAnnouncementsError(error instanceof Error ? error.message : "Could not load announcement history.");
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [fetchAdmin]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    if (mode === "broadcast" || mode === "announcement" || search.trim().length < 2) {
      setUsers([]);
      setSearchingUsers(false);
      setUserSearchError(null);
      return;
    }
    let cancelled = false;
    setSearchingUsers(true);
    setUserSearchError(null);
    const timer = window.setTimeout(() => {
      void fetchAdmin(`/api/admin/users?q=${encodeURIComponent(search.trim())}&limit=30`)
        .then((data) => {
          if (!cancelled) setUsers(data.users ?? []);
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setUsers([]);
            setUserSearchError(error.message);
          }
        })
        .finally(() => {
          if (!cancelled) setSearchingUsers(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fetchAdmin, mode, search]);

  const send = async (selectedMode: CommunicationMode) => {
    const isMassCommunication = selectedMode === "broadcast" || selectedMode === "announcement";
    if (!content.trim() || (!isMassCommunication && !selectedUser) ||
      (selectedMode === "announcement" && !title.trim())) return;
    setSending(true);
    try {
      const result = await fetchAdmin("/api/admin/communications", {
        method: "POST",
        body: JSON.stringify({
          mode: selectedMode,
          ...(!isMassCommunication ? { userId: selectedUser!.id } : {}),
          ...(isMassCommunication ? { title: title.trim() } : {}),
          content: content.trim(),
          ...(selectedMode === "announcement" ? interactions : {}),
        }),
      });
      setContent("");
      setTitle("");
      if (selectedMode === "message") {
        toast({
          title: "Platform message sent",
          description: `Conversation #${result.conversationId} was created with @quillhive as the sender.`,
        });
      } else if (selectedMode === "notification") {
        toast({ title: "QuillHive notification sent", description: "It was saved and pushed through the live notification channel." });
      } else if (selectedMode === "announcement") {
        void loadAnnouncements();
        toast({
          title: "Announcement published",
          description: `Feed post #${result.postId} is live; notification delivery is queued as job ${result.jobId}.`,
        });
      } else {
        toast({ title: "Broadcast queued", description: `Background job ${result.jobId} is processing users in batches.` });
      }
    } catch (error: any) {
      toast({ title: "Could not send communication", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
      setConfirmBroadcast(false);
    }
  };

  const isBroadcast = mode === "broadcast";
  const isAnnouncement = mode === "announcement";
  const isMassCommunication = isBroadcast || isAnnouncement;
  const recipientLabel = selectedUser
    ? `${selectedUser.displayName || selectedUser.username} (@${selectedUser.username})`
    : "";

  return <>
    <section className="mx-auto mb-5 max-w-3xl space-y-4 rounded-xl border border-border/70 bg-background p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Announcement history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Published platform announcements and their current engagement.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadAnnouncements()} disabled={announcementsLoading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${announcementsLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {announcementsError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
          <p className="text-sm text-destructive">Could not load announcement history: {announcementsError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAnnouncements()}>Try again</Button>
        </div>
      )}

      {announcements.length === 0 && announcementsLoading ? (
        <p className="text-sm text-muted-foreground">Loading announcements…</p>
      ) : announcements.length === 0 && !announcementsError ? (
        <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No announcements have been published yet.</p>
      ) : (
        <div className="divide-y divide-border/60 rounded-lg border border-border/60">
          {announcements.map(announcement => {
            const isExpanded = expandedAnnouncementId === announcement.id;
            return (
              <article key={announcement.id} className="p-4">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedAnnouncementId(isExpanded ? null : announcement.id)}
                  className="flex w-full min-w-0 flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{announcement.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(announcement.createdAt).toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{announcement.likesCount} likes</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{announcement.commentsCount} comments</span>
                      {announcement.isBoosted && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">Boosted</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary">{isExpanded ? "Hide details" : "View details"}</span>
                </button>
                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{announcement.content}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex flex-wrap gap-4 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4" />{announcement.likesCount} likes</span>
                        <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{announcement.commentsCount} comments</span>
                      </div>
                      <a href={`/post/${announcement.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                        Open announcement <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {announcementOffset !== null && announcements.length > 0 && (
        <div className="text-center">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAnnouncements(announcementOffset)} disabled={announcementsLoading}>
            {announcementsLoading ? "Loading…" : "Load more announcements"}
          </Button>
        </div>
      )}
    </section>

    <section className="mx-auto max-w-3xl space-y-5 rounded-xl border border-border/70 bg-background p-5 shadow-sm sm:p-6">
      <header>
        <h2 className="font-semibold">Platform communications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recipients will see <strong>@quillhive</strong> as the official sender, not your personal account.
        </p>
      </header>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2" role="group" aria-label="Communication type">
        {MODES.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            variant={mode === key ? "default" : "outline"}
            aria-pressed={mode === key}
            onClick={() => {
              setMode(key);
              setSelectedUser(null);
              setSearch("");
            }}
            className="h-auto min-h-10 w-full min-w-0 whitespace-normal break-words px-2 py-2 text-center text-xs leading-snug"
          >
            {label}
          </Button>
        ))}
      </div>

      {!isMassCommunication && (
        <div className="space-y-2">
          <Label htmlFor="communication-user-search">Recipient</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="communication-user-search"
              className="pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedUser(null);
              }}
              placeholder="Search by username or email"
              autoComplete="off"
            />
          </div>
          {selectedUser && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              Selected: <span className="font-medium">{recipientLabel}</span> · {selectedUser.email}
            </p>
          )}
          {searchingUsers && (
            <p className="text-xs text-muted-foreground" role="status">Searching users…</p>
          )}
          {userSearchError && (
            <p className="text-xs text-destructive" role="alert">Could not search users: {userSearchError}</p>
          )}
          {search.trim().length >= 2 && users.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-md border border-border" role="listbox" aria-label="Matching users">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full flex-col items-start border-b border-border/60 px-3 py-2 text-left last:border-b-0 hover:bg-muted"
                  onClick={() => {
                    setSelectedUser(user);
                    setSearch("");
                    setUsers([]);
                  }}
                >
                  <span className="text-sm font-medium">{user.displayName || user.username} · @{user.username}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </button>
              ))}
            </div>
          )}
          {search.trim().length >= 2 && !searchingUsers && !userSearchError && users.length === 0 && !selectedUser && (
            <p className="text-xs text-muted-foreground">No matching users. Try a username or email address.</p>
          )}
        </div>
      )}

      {isMassCommunication && (
        <div className="space-y-2">
          <Label htmlFor="communication-title">{isAnnouncement ? "Announcement title" : "Notification title (optional)"}</Label>
          <Input
            id="communication-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            placeholder="A message from the QuillHive team"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="communication-content">{isAnnouncement ? "Announcement text" : isBroadcast ? "Notification body" : mode === "message" ? "Message body" : "Notification body"}</Label>
        <Textarea
          id="communication-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
          rows={7}
          placeholder={isAnnouncement ? "Write the announcement to publish in the feed..." : isBroadcast ? "Write the notification for all users..." : "Write a message from QuillHive..."}
        />
        <p className="text-right text-xs text-muted-foreground">{content.length}/5000</p>
      </div>

      {isAnnouncement && (
        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Allow interactions on this announcement</legend>
          {([
            ["commentsEnabled", "Comments and replies"],
            ["likesEnabled", "Likes (including comment likes)"],
            ["repostsEnabled", "Reposts"],
            ["sharingEnabled", "Sharing"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex min-w-0 cursor-pointer items-start gap-2 text-sm leading-snug">
              <input
                type="checkbox"
                checked={interactions[key]}
                onChange={(event) => setInteractions(current => ({ ...current, [key]: event.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 break-words">{label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {isMassCommunication ? (
        <Button
          type="button"
          onClick={() => setConfirmBroadcast(true)}
          disabled={sending || !content.trim() || (isAnnouncement && !title.trim())}
          variant={isBroadcast ? "destructive" : "default"}
          className="w-full sm:w-auto"
        >
          <Megaphone className="mr-2 h-4 w-4" />{isAnnouncement ? "Review announcement" : "Review broadcast"}
        </Button>
      ) : (
        <Button type="button" onClick={() => void send(mode)} disabled={sending || !selectedUser || !content.trim()} className="w-full sm:w-auto">
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Sending..." : mode === "message" ? "Send platform message" : "Send notification"}
        </Button>
      )}
    </section>

    <AlertDialog open={confirmBroadcast} onOpenChange={setConfirmBroadcast}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isAnnouncement ? "Publish this announcement and notify everyone?" : "Broadcast this notification to everyone?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isAnnouncement
              ? "This will publish a QuillHive feed post and queue a notification for all non-deleted users. Interaction settings apply to the post."
              : "This notification will be delivered to all non-deleted users in batches, with @quillhive shown as the sender. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm">
          {isAnnouncement && <p className="mb-2 font-semibold">{title}</p>}
          {content}
        </div>
        {isAnnouncement && (
          <p className="text-xs text-muted-foreground">
            Enabled: {Object.entries(interactions).filter(([, enabled]) => enabled).map(([key]) => ({
              commentsEnabled: "comments",
              likesEnabled: "likes",
              repostsEnabled: "reposts",
              sharingEnabled: "sharing",
            }[key])).join(", ") || "no interactions"}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={sending}
            onClick={(event) => {
              event.preventDefault();
              void send(isAnnouncement ? "announcement" : "broadcast");
            }}
            className={!isAnnouncement ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {sending ? "Publishing..." : isAnnouncement ? "Publish and notify" : "Confirm broadcast"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
