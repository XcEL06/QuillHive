import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/lib/api";
import { ChevronDown, MessageSquare, Send } from "lucide-react";

export function ApplyOpportunityActions({ jobId, title, compact = false, externalHref, closed = false }: { jobId: number; title: string; compact?: boolean; externalHref?: string; closed?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sending, setSending] = useState(false);
  const [appliedLocally, setAppliedLocally] = useState(false);
  const { data: applications = [] } = useQuery({
    queryKey: ["/api/jobs/applications"],
    queryFn: async () => {
      const token = getStoredToken();
      const response = await fetch("/api/jobs/applications", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Could not load application status");
      const data = await response.json();
      return Array.isArray(data?.applications) ? data.applications : [];
    },
    enabled: Boolean(getStoredToken()),
    staleTime: 30_000,
  });
  const hasApplied = appliedLocally || applications.some((application: any) => application.jobId === jobId && application.isMine);

  const submit = async (mode: "apply" | "apply_and_message") => {
    const token = getStoredToken();
    if (closed || hasApplied) return;
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
      setAppliedLocally(true);
      void queryClient.invalidateQueries({ queryKey: ["/api/jobs/applications"] });
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
      {hasApplied ? <Badge variant="secondary">Applied</Badge> : closed ? <Badge variant="outline">Closed</Badge> : <>
      <div className="flex items-center">
      <Button size={compact ? "sm" : "default"} title="Apply if you can do this work." aria-label="Apply if you can do this work" className="gap-1 whitespace-normal rounded-r-none text-center leading-tight" onClick={() => void submit("apply")} disabled={sending}>
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
            <MessageSquare className="h-4 w-4" /> Apply + discuss fee
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
      <span className="basis-full text-[11px] text-muted-foreground">Apply if you can do this work.</span>
      </>}
      {externalHref && !closed && <a href={externalHref} target={externalHref.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline">External application</a>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Apply and discuss fee for {title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Message to the poster</Label><Textarea className="mt-1.5" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Introduce yourself, discuss the scope, and ask or propose a fee..." /></div>
          <div className="grid grid-cols-[1fr_5rem] gap-2"><div><Label>Proposed fee or rate</Label><Input className="mt-1.5" type="number" min="0" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Optional" /></div><div><Label>Currency</Label><Input className="mt-1.5" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></div></div>
          <p className="text-xs text-muted-foreground">Use your message to discuss scope, milestones, and payment timing. Your proposed fee will be included in the application.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void submit("apply_and_message")} disabled={sending || !message.trim()}><MessageSquare className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Apply + discuss fee"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}