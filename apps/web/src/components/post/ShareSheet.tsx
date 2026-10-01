import { useCallback, useState } from "react";
import { Copy, Twitter, Facebook, Linkedin, MessageCircle, Check, Repeat2, Send, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth";
import { copyTextToClipboard, getPostShareUrl } from "@/lib/api";

interface ShareSheetProps {
  postId: number;
  title?: string;
  trigger: React.ReactNode;
}

interface ConvSummary {
  id: number;
  participantName: string;
}

export function ShareSheet({ postId, title, trigger }: ShareSheetProps) {
  const { toast } = useToast();
  const { token } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showMessagePicker, setShowMessagePicker] = useState(false);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [messageSent, setMessageSent] = useState(false);

  const url = getPostShareUrl(postId);
  const shareText = title ? `${title} - via QuillHive` : "Read this on QuillHive";

  // Fire-and-forget share-click telemetry (anonymous, no PII)
  const trackShare = useCallback((source: string) => {
    try {
      fetch(`/api/posts/${postId}/track-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }, [postId]);

  const copy = useCallback(async () => {
    try {
      await copyTextToClipboard(url);
      setCopied(true);
      toast({ title: "Link copied" });
      trackShare("copy");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [url, toast, trackShare]);

  const repost = useCallback(async () => {
    if (!token) {
      toast({ title: "Sign in to repost" });
      return;
    }
    setReposting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/repost`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setReposted(true);
      toast({ title: "Reposted to your feed ✓" });
    } catch {
      toast({ title: "Could not repost", variant: "destructive" });
    } finally {
      setReposting(false);
    }
  }, [token, postId, toast]);

  const loadConversations = useCallback(async () => {
    if (!token || conversations.length > 0) return;
    try {
      const res = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversations: Array<{ id: number; otherUser?: { displayName?: string }; participantName?: string }>;
      };
      setConversations(
        (Array.isArray(data?.conversations) ? data.conversations : []).map((c) => ({
          id: c.id,
          participantName: c.participantName ?? c.otherUser?.displayName ?? "User",
        })),
      );
    } catch {
      /* ignore */
    }
  }, [token, conversations.length]);

  const sendToConversation = useCallback(
    async (convId: number) => {
      if (!token) return;
      const messageText = title ? `Shared: "${title}" - ${url}` : `Check this out: ${url}`;
      try {
        await fetch(`/api/messages/conversations/${convId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageText }),
        });
        setMessageSent(true);
        setShowMessagePicker(false);
        toast({ title: "Sent as message ✓" });
        setTimeout(() => setMessageSent(false), 2000);
      } catch {
        toast({ title: "Could not send", variant: "destructive" });
      }
    },
    [token, title, url, toast],
  );

  const externalShare = (target: "twitter" | "facebook" | "linkedin" | "whatsapp") => {
    const enc = encodeURIComponent;
    const links: Record<typeof target, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      whatsapp: `https://wa.me/?text=${enc(`${shareText} ${url}`)}`,
    };
    trackShare(target);
    window.open(links[target], "_blank", "noopener,noreferrer,width=600,height=600");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-share-sheet">
        <DialogHeader>
          <DialogTitle>Share post</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {token && (
            <button
              onClick={() => void repost()}
              disabled={reposting || reposted}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left disabled:opacity-60"
              data-testid="button-share-repost"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {reposted ? <Check className="w-4 h-4 text-primary" /> : <Repeat2 className="w-4 h-4 text-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium">{reposted ? "Reposted ✓" : "Repost to feed"}</p>
                <p className="text-xs text-muted-foreground">Share with your followers</p>
              </div>
            </button>
          )}

          {token && (
            <>
              <button
                onClick={() => {
                  setShowMessagePicker((v) => !v);
                  void loadConversations();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                data-testid="button-share-message"
              >
                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{messageSent ? "Sent ✓" : "Send as message"}</p>
                  <p className="text-xs text-muted-foreground">Share in a private conversation</p>
                </div>
              </button>
              {showMessagePicker && (
                <div className="ml-12 space-y-1 pb-1 border-l-2 border-border pl-3">
                  {conversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No conversations yet</p>
                  ) : (
                    conversations.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => void sendToConversation(c.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm"
                        data-testid={`button-send-to-${c.id}`}
                      >
                        {c.participantName}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <input
              readOnly
              value={url}
              className="flex-1 bg-transparent text-sm px-2 outline-none"
              data-testid="input-share-url"
            />
            <Button size="sm" variant="ghost" onClick={copy} data-testid="button-copy-link">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => externalShare("twitter")} className="flex-col h-auto py-3 gap-1" data-testid="button-share-twitter">
              <Twitter className="w-4 h-4" /><span className="text-[10px]">Twitter</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => externalShare("facebook")} className="flex-col h-auto py-3 gap-1" data-testid="button-share-facebook">
              <Facebook className="w-4 h-4" /><span className="text-[10px]">Facebook</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => externalShare("linkedin")} className="flex-col h-auto py-3 gap-1" data-testid="button-share-linkedin">
              <Linkedin className="w-4 h-4" /><span className="text-[10px]">LinkedIn</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => externalShare("whatsapp")} className="flex-col h-auto py-3 gap-1" data-testid="button-share-whatsapp">
              <MessageCircle className="w-4 h-4" /><span className="text-[10px]">WhatsApp</span>
            </Button>
          </div>

          <div className="pt-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Format for social</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="text-left p-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                onClick={async () => {
                  const tags = title ? `#writing #quillhive` : `#quillhive`;
                  const t = `${title ? `"${title}" ` : ''}${tags}\n\n${url}`;
                  await navigator.clipboard.writeText(t);
                  toast({ title: 'Twitter/X format copied' });
                  trackShare('format_twitter');
                }}
                data-testid="button-format-twitter"
              >
                <p className="text-xs font-medium">Twitter / X</p>
                <p className="text-[10px] text-muted-foreground">With hashtags</p>
              </button>
              <button
                className="text-left p-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                onClick={async () => {
                  const t = `I just published${title ? ` "${title}"` : ' a new piece'} on QuillHive - read it here: ${url}`;
                  await navigator.clipboard.writeText(t);
                  toast({ title: 'LinkedIn format copied' });
                  trackShare('format_linkedin');
                }}
                data-testid="button-format-linkedin"
              >
                <p className="text-xs font-medium">LinkedIn</p>
                <p className="text-[10px] text-muted-foreground">Professional tone</p>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
