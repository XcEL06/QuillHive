import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/lib/api";
import { ChevronDown, MessageSquare, Send } from "lucide-react";

export function ApplyOpportunityActions({ jobId, title, compact = false, externalHref }: { jobId: number; title: string; compact?: boolean; externalHref?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sending, setSending] = useState(false);

  const submit = async (mode: "apply" | "apply_and_message") => {
    const token = getStoredToken();
    if (!token) { toast({ title: "Sign in to apply", variant: "destructive" }); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, message: message.trim() || undefined, proposedBudget: budget ? Number(budget) : undefined, proposedCurrency: currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not apply");
      toast({ title: mode === "apply" ? "Application sent" : "Application and message sent" });
      setOpen(false);
      setMessage("");
      setBudget("");
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not apply", variant: "destructive" });
    } finally { setSending(false); }
  };

  return <>
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      <div className="flex items-center">
      <Button size={compact ? "sm" : "default"} className="gap-1 whitespace-normal rounded-r-none text-center leading-tight" onClick={() => void submit("apply")} disabled={sending}>
        <Send className="h-3.5 w-3.5" /> Apply
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size={compact ? "sm" : "default"} className="rounded-l-none border-l border-primary-foreground/20 px-2" disabled={sending} aria-label="More application options">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <MessageSquare className="h-4 w-4" /> Apply + message
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
      {externalHref && <a href={externalHref} target={externalHref.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline">External application</a>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Apply and message about {title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Message to the poster</Label><Textarea className="mt-1.5" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Introduce yourself and explain why you are a fit..." /></div>
          <div className="grid grid-cols-[1fr_5rem] gap-2"><div><Label>Proposed budget or rate</Label><Input className="mt-1.5" type="number" min="0" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Optional" /></div><div><Label>Currency</Label><Input className="mt-1.5" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></div></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void submit("apply_and_message")} disabled={sending || !message.trim()}><MessageSquare className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Apply + message"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}