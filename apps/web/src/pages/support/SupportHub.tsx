import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";

export default function SupportHub() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [ticketReply, setTicketReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [severity, setSeverity] = useState("normal");
  const [mutedWords, setMutedWords] = useState("");
  const [contentFilter, setContentFilter] = useState("standard");

  const authHeaders = () => {
    const token = localStorage.getItem("qh_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const loadTickets = async () => {
    const res = await fetch("/api/support/tickets", { headers: authHeaders() });
    const data = await res.json();
    if (res.ok) setTickets(data.tickets || []);
  };

  useEffect(() => {
    loadTickets();
    fetch("/api/support/safety", { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        setMutedWords((data.mutedWords || []).join(", "));
        setContentFilter(data.contentFilter || "standard");
      })
      .catch(() => undefined);
  }, []);

  const createTicket = async () => {
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subject, message, category, severity }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not create ticket");
      return;
    }
    setSubject("");
    setMessage("");
    toast.success("Support ticket created");
    loadTickets();
  };

  const openTicket = async (ticket: any) => {
    const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Could not load ticket"); return; }
    setSelectedTicket(data.ticket);
    setTicketMessages(data.messages || []);
  };

  const replyToTicket = async () => {
    if (!selectedTicket || !ticketReply.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/message`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: ticketReply.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send reply");
      setTicketMessages((current) => [...current, data]);
      setTicketReply("");
      await loadTickets();
    } catch (error: any) {
      toast.error(error.message || "Could not send reply");
    } finally { setSendingReply(false); }
  };

  const saveSafety = async () => {
    const res = await fetch("/api/support/safety", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        mutedWords: mutedWords.split(",").map(word => word.trim()).filter(Boolean),
        contentFilter,
      }),
    });
    if (res.ok) toast.success("Safety preferences saved");
    else toast.error("Could not save safety preferences");
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-0 space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold">Support Hub</h1>
          <p className="text-muted-foreground">Get help, report issues, and manage safety preferences.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Create ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Subject</Label>
                <Input className="rounded-xl mt-1.5" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="abuse">Abuse</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="upload">Upload</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea className="rounded-xl mt-1.5 min-h-32" value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              <Button className="rounded-xl" onClick={createTicket} disabled={!subject || !message}>Submit Ticket</Button>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Safety Center</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Muted words</Label>
                <Textarea className="rounded-xl mt-1.5" value={mutedWords} onChange={e => setMutedWords(e.target.value)} placeholder="Separate words with commas" />
              </div>
              <div>
                <Label>Content filter</Label>
                <Select value={contentFilter} onValueChange={setContentFilter}>
                  <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" className="rounded-xl" onClick={saveSafety}>Save Safety Preferences</Button>
            </CardContent>
          </Card>
        </div>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Your tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.length === 0 && <p className="text-sm text-muted-foreground">No support tickets yet.</p>}
            {tickets.map(ticket => (
              <button key={ticket.id} onClick={() => void openTicket(ticket)} className="flex w-full items-center justify-between rounded-xl border border-border/60 p-4 text-left hover:bg-muted/40">
                <div>
                  <p className="font-medium">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">{ticket.category} • {new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <Badge>{ticket.status}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
        {selectedTicket && <Card className="rounded-2xl">
          <CardHeader><CardTitle>{selectedTicket.subject}</CardTitle><p className="text-xs text-muted-foreground">Status: {selectedTicket.status}</p></CardHeader>
          <CardContent className="space-y-3">
            {ticketMessages.map(item => <div key={item.id} className="rounded-xl border border-border/60 p-3"><p className="whitespace-pre-wrap text-sm">{item.message}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div>)}
            <Textarea value={ticketReply} onChange={event => setTicketReply(event.target.value)} placeholder="Reply to support..." rows={3} />
            <Button onClick={() => void replyToTicket()} disabled={sendingReply || !ticketReply.trim()}>Send Reply</Button>
          </CardContent>
        </Card>}
      </div>
    </AppLayout>
  );
}