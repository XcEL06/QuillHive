import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFeature } from "@/lib/features";
import {
  Handshake, Check, X, Inbox as InboxIcon, Send, Briefcase,
  DollarSign, Calendar, MessageSquare, ChevronDown, ChevronUp, Loader2,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw,
} from "lucide-react";
import { getInitials } from "@/lib/utils";

interface UserSnippet { id: number; username: string; displayName: string; avatarUrl: string | null }
interface CollabRequest {
  id: number; senderId: number; receiverId: number; message: string;
  status: "pending" | "accepted" | "rejected"; createdAt: string; updatedAt: string;
  sender?: UserSnippet; receiver?: UserSnippet;
}
interface CommissionRequest {
  id: number; fromUserId: number; toCreatorId: number; serviceListingId: number | null;
  title: string; description: string; budget: number | null; currency: string;
  deadline: string | null; status: string; creatorResponse: string | null;
  respondedAt: string | null; createdAt: string; updatedAt: string;
  fromUser?: UserSnippet; toUser?: UserSnippet;
}

const COMMISSION_STATUS: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  pending:        { label: "Pending",        icon: Clock,         cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  accepted:       { label: "Accepted",       icon: CheckCircle2,  cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  declined:       { label: "Declined",       icon: XCircle,       cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800" },
  counter_offered:{ label: "Counter Offer",  icon: RefreshCw,     cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
};

function CommissionStatusBadge({ status }: { status: string }) {
  const s = COMMISSION_STATUS[status] ?? { label: status, icon: AlertCircle, cls: "bg-muted text-muted-foreground" };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
      <Icon className="w-3 h-3" />{s.label}
    </span>
  );
}

function CollabStatusPill({ status }: { status: CollabRequest["status"] }) {
  const map = { pending: "bg-yellow-500/10 text-yellow-600", accepted: "bg-green-500/10 text-green-600", rejected: "bg-red-500/10 text-red-600" } as const;
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{status}</span>;
}

function CollabCard({ req, mode, onAct }: {
  req: CollabRequest; mode: "received" | "sent";
  onAct?: (id: number, status: "accepted" | "rejected") => Promise<void>;
}) {
  const [acting, setActing] = useState(false);
  const other = mode === "received" ? req.sender : req.receiver;

  const handleAct = async (status: "accepted" | "rejected") => {
    if (!onAct) return;
    setActing(true);
    await onAct(req.id, status);
    setActing(false);
  };

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {other?.avatarUrl && <img src={other.avatarUrl} alt="" className="rounded-full object-cover w-full h-full" />}
            <AvatarFallback className="text-xs">{getInitials(other?.displayName || other?.username || "?")}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground">
              {mode === "received" ? "From" : "To"}{" "}
              <Link href={`/profile/${other?.username ?? ""}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                {other?.displayName || other?.username || "Unknown"}
              </Link>
            </p>
          </div>
        </div>
        <CollabStatusPill status={req.status} />
      </div>

      {req.message && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{req.message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
        <div className="flex flex-wrap items-center gap-2">
          {req.status === "accepted" && (
            <Link href={`/messages?user=${other?.username}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <MessageSquare className="w-3 h-3" /> Message
              </Button>
            </Link>
          )}
          {mode === "received" && req.status === "pending" && onAct && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 hover:text-red-600" onClick={() => handleAct("rejected")} disabled={acting}>
                {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Decline
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAct("accepted")} disabled={acting}>
                {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Accept
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function CommissionCard({ commission, mode, onRespond }: {
  commission: CommissionRequest; mode: "received" | "sent";
  onRespond?: (id: number, status: string, response: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(false);
  const [respText, setRespText] = useState("");
  const [acting, setActing] = useState(false);
  const counterpart = mode === "received" ? commission.fromUser : commission.toUser;
  const canRespond = mode === "received" && commission.status === "pending";

  const handleAct = async (status: string) => {
    if (!onRespond) return;
    setActing(true);
    await onRespond(commission.id, status, respText);
    setActing(false);
    setResponding(false);
    setRespText("");
  };

  return (
    <Card className="overflow-hidden border-border">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            {counterpart?.avatarUrl && <img src={counterpart.avatarUrl} alt="" className="rounded-full object-cover w-full h-full" />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(counterpart?.displayName || counterpart?.username || "?")}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-xs text-muted-foreground">
                  {mode === "received" ? "From" : "To"}{" "}
                  <Link href={`/profile/${counterpart?.username ?? ""}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                    {counterpart?.displayName || counterpart?.username || "Unknown"}
                  </Link>
                </p>
                <h4 className="font-semibold text-sm mt-0.5 line-clamp-1">{commission.title}</h4>
              </div>
              <CommissionStatusBadge status={commission.status} />
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {commission.budget && (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                  <DollarSign className="w-3 h-3" />{commission.currency} {commission.budget.toLocaleString()}
                </span>
              )}
              {commission.deadline && (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />By {new Date(commission.deadline).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{new Date(commission.createdAt).toLocaleDateString(undefined, { dateStyle: "short" })}</span>
            </div>
          </div>
        </div>

        <button
          className="mt-3 w-full text-left text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Project Brief</p>
            <div className="bg-muted/40 rounded-xl p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{commission.description}</div>
          </div>

          {commission.creatorResponse && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Response
              </p>
              <div className={`rounded-xl p-3 text-sm whitespace-pre-wrap border ${COMMISSION_STATUS[commission.status]?.cls ?? "bg-muted/40 border-border"}`}>
                {commission.creatorResponse}
              </div>
            </div>
          )}

          {canRespond && (
            <div className="space-y-2">
              {responding && (
                <Textarea
                  value={respText}
                  onChange={e => setRespText(e.target.value)}
                  placeholder="Optional message…"
                  rows={3}
                  className="text-sm"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setResponding(v => !v)}>
                  {responding ? <ChevronUp className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                  {responding ? "Cancel" : "Add response"}
                </Button>
                <Button size="sm" variant="destructive" className="text-xs gap-1" onClick={() => handleAct("declined")} disabled={acting}>
                  {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Decline
                </Button>
                <Button size="sm" className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAct("accepted")} disabled={acting}>
                  {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Accept
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function CollaboratePanel() {
  const { toast } = useToast();
  const creatorIncomeEnabled = useFeature("creator_income_enabled");
  const [collabReceived, setCollabReceived] = useState<CollabRequest[]>([]);
  const [collabSent, setCollabSent] = useState<CollabRequest[]>([]);
  const [commReceived, setCommReceived] = useState<CommissionRequest[]>([]);
  const [commSent, setCommSent] = useState<CommissionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, cs, cmr, cms] = await Promise.all([
        apiFetch("/api/collaboration/requests/received").then(r => r.json()).catch(() => ({ requests: [] })),
        apiFetch("/api/collaboration/requests/sent").then(r => r.json()).catch(() => ({ requests: [] })),
        creatorIncomeEnabled ? apiFetch("/api/services/commissions/received").then(r => r.json()).catch(() => ({ commissions: [] })) : Promise.resolve({ commissions: [] }),
        creatorIncomeEnabled ? apiFetch("/api/services/commissions/sent").then(r => r.json()).catch(() => ({ commissions: [] })) : Promise.resolve({ commissions: [] }),
      ]);
      setCollabReceived(Array.isArray(cr?.requests) ? cr.requests : []);
      setCollabSent(Array.isArray(cs?.requests) ? cs.requests : []);
      setCommReceived(Array.isArray(cmr?.commissions) ? cmr.commissions : []);
      setCommSent(Array.isArray(cms?.commissions) ? cms.commissions : []);
    } catch {
      toast({ title: "Failed to load collaborate data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [creatorIncomeEnabled]);

  useEffect(() => { load(); }, [load]);

  const handleCollabAct = async (id: number, status: "accepted" | "rejected") => {
    await apiFetch(`/api/collaboration/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setCollabReceived(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleCommRespond = async (id: number, status: string, response: string) => {
    if (!creatorIncomeEnabled) return;
    await apiFetch(`/api/services/commissions/${id}/respond`, {
      method: "PATCH", body: JSON.stringify({ status, response: response.trim() || undefined }),
    });
    setCommReceived(prev => prev.map(r => r.id === id ? { ...r, status, creatorResponse: response || null } : r));
  };

  const pendingCollab = collabReceived.filter(r => r.status === "pending").length;
  const pendingComm = commReceived.filter(r => r.status === "pending").length;
  const totalPending = pendingCollab + (creatorIncomeEnabled ? pendingComm : 0);

  return (
    <div className="space-y-4">
      {totalPending > 0 && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
          <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-bold">{totalPending}</span>
          <span className="text-foreground">pending request{totalPending !== 1 ? "s" : ""} awaiting your response</span>
        </div>
      )}

      <Tabs defaultValue="received-collab">
        <TabsList className="h-auto flex-wrap gap-1 mb-4">
          <TabsTrigger value="received-collab" className="gap-1.5 text-xs">
            <InboxIcon className="w-3.5 h-3.5" /> Collaborations
            {pendingCollab > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{pendingCollab}</span>}
          </TabsTrigger>
          <TabsTrigger value="sent-collab" className="gap-1.5 text-xs">
            <Send className="w-3.5 h-3.5" /> Sent Collabs
          </TabsTrigger>
          {creatorIncomeEnabled && <TabsTrigger value="received-comm" className="gap-1.5 text-xs">
            <Briefcase className="w-3.5 h-3.5" /> Commissions
            {pendingComm > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{pendingComm}</span>}
          </TabsTrigger>}
          {creatorIncomeEnabled && <TabsTrigger value="sent-comm" className="gap-1.5 text-xs">
            <Send className="w-3.5 h-3.5" /> Sent Commissions
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="received-collab" className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}
          {!loading && collabReceived.length === 0 && (
            <Card className="p-10 text-center">
              <Handshake className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No collaboration requests yet.</p>
            </Card>
          )}
          {collabReceived.map(r => <CollabCard key={r.id} req={r} mode="received" onAct={handleCollabAct} />)}
        </TabsContent>

        <TabsContent value="sent-collab" className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}
          {!loading && collabSent.length === 0 && (
            <Card className="p-10 text-center">
              <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">You haven't sent any collaboration requests yet.</p>
            </Card>
          )}
          {collabSent.map(r => <CollabCard key={r.id} req={r} mode="sent" />)}
        </TabsContent>

        {creatorIncomeEnabled && <TabsContent value="received-comm" className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}
          {!loading && commReceived.length === 0 && (
            <Card className="p-10 text-center">
              <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No commission inquiries yet.</p>
            </Card>
          )}
          {commReceived.map(c => <CommissionCard key={c.id} commission={c} mode="received" onRespond={handleCommRespond} />)}
        </TabsContent>}

        {creatorIncomeEnabled && <TabsContent value="sent-comm" className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}
          {!loading && commSent.length === 0 && (
            <Card className="p-10 text-center">
              <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">You haven't sent any commission requests yet.</p>
            </Card>
          )}
          {commSent.map(c => <CommissionCard key={c.id} commission={c} mode="sent" />)}
        </TabsContent>}
      </Tabs>
    </div>
  );
}
