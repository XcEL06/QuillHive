import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

export default function AdminCommunications({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [users, setUsers] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [directMessage, setDirectMessage] = useState("");
  const [title, setTitle] = useState("");
  const [broadcast, setBroadcast] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void fetchAdmin("/api/admin/users?limit=100").then((data) => setUsers(data.users ?? [])).catch((error: any) => toast({ title: "Could not load users", description: error.message, variant: "destructive" }));
  }, [fetchAdmin, toast]);

  const sendDirect = async () => {
    if (!targetUserId || !directMessage.trim()) return;
    setSending(true);
    try {
      await fetchAdmin("/api/admin/communications/direct", { method: "POST", body: JSON.stringify({ userId: Number(targetUserId), content: directMessage.trim() }) });
      setDirectMessage("");
      toast({ title: "Direct message sent" });
    } catch (error: any) {
      toast({ title: "Could not send direct message", description: error.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const sendBroadcast = async () => {
    if (!title.trim() || !broadcast.trim()) return;
    setSending(true);
    try {
      const result = await fetchAdmin("/api/admin/communications/broadcast", { method: "POST", body: JSON.stringify({ title: title.trim(), message: broadcast.trim() }) });
      setTitle("");
      setBroadcast("");
      toast({ title: "Broadcast sent", description: `Delivered to ${result.recipientCount} users.` });
    } catch (error: any) {
      toast({ title: "Could not send broadcast", description: error.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="space-y-4 rounded-xl border border-border/70 bg-background p-5 shadow-sm"><div><h2 className="font-semibold">Direct message</h2><p className="mt-1 text-xs text-muted-foreground">Starts an admin-initiated conversation and sends an in-app notification.</p></div><div><Label>Recipient</Label><Select value={targetUserId} onValueChange={setTargetUserId}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose a user" /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.displayName || user.username || user.email} · #{user.id}</SelectItem>)}</SelectContent></Select></div><div><Label>Message</Label><Textarea className="mt-1.5" value={directMessage} onChange={(event) => setDirectMessage(event.target.value)} maxLength={5000} rows={6} placeholder="Write a private message..." /></div><Button onClick={() => void sendDirect()} disabled={sending || !targetUserId || !directMessage.trim()}><Send className="mr-2 h-4 w-4" />Send direct message</Button></section>
    <section className="space-y-4 rounded-xl border border-border/70 bg-background p-5 shadow-sm"><div><h2 className="font-semibold">Broadcast notification</h2><p className="mt-1 text-xs text-muted-foreground">Sends a persisted notification to every active user through the normal socket and notification pipeline.</p></div><div><Label>Title</Label><Input className="mt-1.5" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Important QuillHive update" /></div><div><Label>Message</Label><Textarea className="mt-1.5" value={broadcast} onChange={(event) => setBroadcast(event.target.value)} maxLength={5000} rows={6} placeholder="Write the announcement..." /></div><Button onClick={() => void sendBroadcast()} disabled={sending || !title.trim() || !broadcast.trim()}><Megaphone className="mr-2 h-4 w-4" />Send to all users</Button></section>
  </div>;
}