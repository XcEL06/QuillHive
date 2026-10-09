import { useEffect, useState } from "react";
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
import { Megaphone, Search, Send } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

type CommunicationMode = "message" | "notification" | "broadcast";
type Recipient = {
  id: number;
  username: string;
  displayName: string;
  email: string;
};

const MODES: Array<{ key: CommunicationMode; label: string }> = [
  { key: "message", label: "Message a specific user" },
  { key: "notification", label: "Notify a specific user" },
  { key: "broadcast", label: "Broadcast notification to all users" },
];

export default function AdminCommunications({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [mode, setMode] = useState<CommunicationMode>("message");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<Recipient[]>([]);
  const [selectedUser, setSelectedUser] = useState<Recipient | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);

  useEffect(() => {
    if (mode === "broadcast" || search.trim().length < 2) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchAdmin(`/api/admin/master/users?q=${encodeURIComponent(search.trim())}`)
        .then((data) => {
          if (!cancelled) setUsers(data.users ?? []);
        })
        .catch((error: Error) => {
          if (!cancelled) toast({ title: "Could not search users", description: error.message, variant: "destructive" });
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fetchAdmin, mode, search, toast]);

  const send = async (selectedMode: CommunicationMode) => {
    if (!content.trim() || (selectedMode !== "broadcast" && !selectedUser)) return;
    setSending(true);
    try {
      const result = await fetchAdmin("/api/admin/communications", {
        method: "POST",
        body: JSON.stringify({
          mode: selectedMode,
          ...(selectedMode !== "broadcast" ? { userId: selectedUser!.id } : {}),
          content: content.trim(),
        }),
      });
      setContent("");
      if (selectedMode === "message") {
        toast({
          title: "Platform message sent",
          description: `Conversation #${result.conversationId} was created with @quillhive as the sender.`,
        });
      } else if (selectedMode === "notification") {
        toast({ title: "QuillHive notification sent", description: "It was saved and pushed through the live notification channel." });
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
  const recipientLabel = selectedUser
    ? `${selectedUser.displayName || selectedUser.username} (@${selectedUser.username})`
    : "";

  return <>
    <section className="mx-auto max-w-3xl space-y-5 rounded-xl border border-border/70 bg-background p-5 shadow-sm sm:p-6">
      <header>
        <h2 className="font-semibold">Platform communications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recipients will see <strong>@quillhive</strong> as the official sender, not your personal account.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Communication type">
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
            className="h-auto min-h-10 whitespace-normal py-2 text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      {!isBroadcast && (
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
          {search.trim().length >= 2 && users.length === 0 && !selectedUser && (
            <p className="text-xs text-muted-foreground">No matching users. Try a username or email address.</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="communication-content">{isBroadcast ? "Notification body" : mode === "message" ? "Message body" : "Notification body"}</Label>
        <Textarea
          id="communication-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
          rows={7}
          placeholder={isBroadcast ? "Write the announcement for all users..." : "Write a message from QuillHive..."}
        />
        <p className="text-right text-xs text-muted-foreground">{content.length}/5000</p>
      </div>

      {isBroadcast ? (
        <Button
          onClick={() => setConfirmBroadcast(true)}
          disabled={sending || !content.trim()}
          variant="destructive"
        >
          <Megaphone className="mr-2 h-4 w-4" />Review broadcast
        </Button>
      ) : (
        <Button onClick={() => void send(mode)} disabled={sending || !selectedUser || !content.trim()}>
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Sending..." : mode === "message" ? "Send platform message" : "Send notification"}
        </Button>
      )}
    </section>

    <AlertDialog open={confirmBroadcast} onOpenChange={setConfirmBroadcast}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Broadcast this notification to everyone?</AlertDialogTitle>
          <AlertDialogDescription>
            This notification will be delivered to all non-deleted users in batches, with @quillhive shown as the sender. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm">
          {content}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={sending}
            onClick={(event) => {
              event.preventDefault();
              void send("broadcast");
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {sending ? "Queueing..." : "Confirm broadcast"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
