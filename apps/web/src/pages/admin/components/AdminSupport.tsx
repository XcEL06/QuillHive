import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

type Ticket = {
  id: number;
  userId: number;
  subject: string;
  category: string;
  severity: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  username?: string;
  displayName?: string;
  email?: string;
};

type TicketMessage = { id: number; userId: number; message: string; createdAt: string };

export default function AdminSupport({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await fetchAdmin("/api/support/admin/tickets");
      setTickets(data.tickets ?? []);
    } catch (error: any) {
      toast({ title: "Could not load support tickets", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (ticket: Ticket) => {
    try {
      const data = await fetchAdmin(`/api/support/admin/tickets/${ticket.id}/messages`);
      setSelected(ticket);
      setMessages(data.messages ?? []);
    } catch (error: any) {
      toast({ title: "Could not load ticket", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => { void loadTickets(); }, []);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const message = await fetchAdmin(`/api/support/admin/tickets/${selected.id}/message`, {
        method: "POST",
        body: JSON.stringify({ message: reply.trim() }),
      });
      setMessages((current) => [...current, message]);
      setReply("");
      toast({ title: "Reply sent" });
      await loadTickets();
    } catch (error: any) {
      toast({ title: "Could not send reply", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    try {
      const updated = await fetchAdmin(`/api/support/admin/tickets/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setSelected(updated);
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? { ...ticket, status: updated.status, updatedAt: updated.updatedAt } : ticket));
    } catch (error: any) {
      toast({ title: "Could not update ticket", description: error.message, variant: "destructive" });
    }
  };

  return <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
    <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div><h2 className="font-semibold">Support inbox</h2><p className="text-xs text-muted-foreground">Tickets routed to super admins</p></div>
        <Button variant="ghost" size="icon" onClick={() => void loadTickets()} aria-label="Refresh support tickets"><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading ? <div className="p-5 text-sm text-muted-foreground">Loading tickets...</div> : tickets.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No support tickets.</div> : <div className="divide-y divide-border/60">{tickets.map((ticket) => <button key={ticket.id} onClick={() => void loadThread(ticket)} className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${selected?.id === ticket.id ? "bg-primary/5" : ""}`}><div className="flex items-start justify-between gap-3"><span className="truncate text-sm font-medium">{ticket.subject}</span><Badge variant={ticket.status === "closed" || ticket.status === "resolved" ? "secondary" : "default"} className="shrink-0 text-[10px]">{ticket.status}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{ticket.displayName || ticket.username || ticket.email || `User #${ticket.userId}`} · {ticket.category}</p><p className="mt-1 text-[10px] text-muted-foreground">Updated {new Date(ticket.updatedAt).toLocaleString()}</p></button>)}</div>}
    </section>
    <section className="rounded-xl border border-border/70 bg-background shadow-sm">
      {!selected ? <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageSquare className="mb-3 h-8 w-8" /><p className="text-sm">Select a ticket to read and reply.</p></div> : <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4"><div><h2 className="font-semibold">{selected.subject}</h2><p className="text-xs text-muted-foreground">{selected.displayName || selected.username || selected.email || `User #${selected.userId}`} · {selected.severity}</p></div><Select value={selected.status} onValueChange={(value) => void updateStatus(value)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div><div className="max-h-[28rem] space-y-3 overflow-y-auto p-5">{messages.map((item) => <div key={item.id} className={`rounded-lg border p-3 ${item.userId === selected.userId ? "bg-muted/40" : "border-primary/20 bg-primary/5"}`}><p className="whitespace-pre-wrap text-sm">{item.message}</p><p className="mt-2 text-[10px] text-muted-foreground">{item.userId === selected.userId ? "User" : "Admin"} · {new Date(item.createdAt).toLocaleString()}</p></div>)}</div><div className="border-t border-border/70 p-4"><Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to this ticket..." maxLength={5000} rows={4} /><div className="mt-3 flex justify-end"><Button onClick={() => void sendReply()} disabled={sending || !reply.trim()}><Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Send reply"}</Button></div></div></>}
    </section>
  </div>;
}