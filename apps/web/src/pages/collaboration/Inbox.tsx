import { useEffect, useState, useCallback } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Link, useSearch } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Handshake, Check, X, Inbox as InboxIcon, Send, Briefcase,
  DollarSign, Calendar, MessageSquare, ChevronDown, ChevronUp, Loader2,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, FileText
} from "lucide-react";
import { SmartProjectDraft } from "@/components/collaboration/SmartProjectDraft";
import { getInitials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useFeature } from "@/lib/features";

// ── Types ────────────────────────────────────────────────────────────────────

interface UserSnippet {
  id: number; username: string; displayName: string; avatarUrl: string | null;
}

interface CollabRequest {
  id: number;
  senderId: number; receiverId: number;
  message: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string; updatedAt: string;
  sender?: UserSnippet; receiver?: UserSnippet;
}

interface CommissionRequest {
  id: number;
  fromUserId: number; toCreatorId: number;
  serviceListingId: number | null;
  title: string; description: string;
  budget: number | null; currency: string;
  deadline: string | null;
  status: string;
  creatorResponse: string | null;
  respondedAt: string | null;
  createdAt: string; updatedAt: string;
  fromUser?: UserSnippet;
  toUser?: UserSnippet;
}

interface CollaborationRoom {
  id: number;
  requestId: number;
  title: string;
  brief: string;
  splitSuggestion: Record<string, number>;
  status: string;
  updatedAt: string;
}

// ── Status helpers ───────────────────────────────────────────────────────────

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
  const map = { pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", accepted: "bg-green-500/10 text-green-600 dark:text-green-400", rejected: "bg-red-500/10 text-red-600 dark:text-red-400" } as const;
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{status}</span>;
}

// ── CommissionCard ───────────────────────────────────────────────────────────

function CommissionCard({
  commission, mode, onRespond,
}: {
  commission: CommissionRequest;
  mode: "received" | "sent";
  onRespond?: (id: number, status: string, response: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(false);
  const [respText, setRespText] = useState("");
  const [acting, setActing] = useState(false);
  const t = useT();

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

  const formatBudget = () => {
    if (!commission.budget) return null;
    return `${commission.currency} ${commission.budget.toLocaleString()}`;
  };

  const formatDeadline = () => {
    if (!commission.deadline) return null;
    return new Date(commission.deadline).toLocaleDateString(undefined, { dateStyle: "medium" });
  };

  return (
    <Card className="overflow-hidden border-border transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${counterpart?.username ?? ""}`}>
            <Avatar className="h-10 w-10 shrink-0">
              {counterpart?.avatarUrl ? <img src={counterpart.avatarUrl} alt="" className="rounded-full object-cover w-full h-full" /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {getInitials(counterpart?.displayName || counterpart?.username || "?")}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {mode === "received" ? "From" : "To"}{" "}
                  <Link href={`/profile/${counterpart?.username ?? ""}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                    {counterpart?.displayName || counterpart?.username || "Unknown"}
                  </Link>
                </p>
                <h3 className="font-semibold text-foreground leading-tight mt-0.5 line-clamp-1">{commission.title}</h3>
              </div>
              <CommissionStatusBadge status={commission.status} />
            </div>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {formatBudget() && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="w-3 h-3" />{formatBudget()}
                </span>
              )}
              {formatDeadline() && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />By {formatDeadline()}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                <Timestamp value={commission.createdAt} mode="date" />
              </span>
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          className="mt-3 w-full text-left text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide details" : "Show details & brief"}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {/* Brief */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Project Brief</p>
            <div className="bg-muted/40 rounded-xl p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {commission.description}
            </div>
          </div>

          {/* Creator response thread */}
          {commission.creatorResponse && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Creator Response
                {commission.respondedAt && (
                  <span className="ml-1 font-normal">· <Timestamp value={commission.respondedAt} mode="date" /></span>
                )}
              </p>
              <div className={`rounded-xl p-3 text-sm whitespace-pre-wrap border ${COMMISSION_STATUS[commission.status]?.cls ?? "bg-muted/40 border-border"}`}>
                {commission.creatorResponse}
              </div>
            </div>
          )}

          {/* Actions for pending received commissions */}
          {canRespond && (
            <div className="space-y-2">
              {responding && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Your response (optional)</p>
                  <Textarea
                    value={respText}
                    onChange={e => setRespText(e.target.value)}
                    placeholder="Add a note, counter-offer details, or questions…"
                    className="text-sm resize-none"
                    rows={3}
                    maxLength={1000}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {!responding && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setResponding(true)}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Add Response
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800"
                  onClick={() => handleAct("declined")}
                  disabled={acting}
                >
                  {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Decline
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                  onClick={() => handleAct("counter_offered")}
                  disabled={acting}
                >
                  {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Counter
                </Button>
                <Button
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => handleAct("accepted")}
                  disabled={acting}
                >
                  {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Accept
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Inbox ───────────────────────────────────────────────────────────────

export default function Inbox() {
  const { toast } = useToast();
  const t = useT();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const creatorIncomeEnabled = useFeature("creator_income_enabled");
  const requestedTab = params.get("tab") ?? "received-collab";
  const defaultTab = !creatorIncomeEnabled && requestedTab.endsWith("-comm")
    ? "received-collab"
    : requestedTab;
  const [activeTab, setActiveTab] = useState(defaultTab);
  useEffect(() => {
    if (!creatorIncomeEnabled && activeTab.endsWith("-comm")) setActiveTab("received-collab");
  }, [activeTab, creatorIncomeEnabled]);

  // Collaboration state
  const [collabReceived, setCollabReceived] = useState<CollabRequest[]>([]);
  const [collabSent, setCollabSent] = useState<CollabRequest[]>([]);
  const [draftCollab, setDraftCollab] = useState<CollabRequest | null>(null);
  const [rooms, setRooms] = useState<CollaborationRoom[]>([]);
  const [savingRoomId, setSavingRoomId] = useState<number | null>(null);

  // Commission state
  const [commReceived, setCommReceived] = useState<CommissionRequest[]>([]);
  const [commSent, setCommSent] = useState<CommissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, cs, mr, ms, roomsRes] = await Promise.all([
        apiFetch("/api/collaboration/requests/received"),
        apiFetch("/api/collaboration/requests/sent"),
        creatorIncomeEnabled ? apiFetch("/api/services/commissions/received") : Promise.resolve(null),
        creatorIncomeEnabled ? apiFetch("/api/services/commissions/sent") : Promise.resolve(null),
        apiFetch("/api/collaboration/rooms"),
      ]);
      if (cr.ok) setCollabReceived(await cr.json());
      if (cs.ok) setCollabSent(await cs.json());
      if (mr?.ok) setCommReceived(await mr.json());
      if (ms?.ok) setCommSent(await ms.json());
      if (!creatorIncomeEnabled) {
        setCommReceived([]);
        setCommSent([]);
      }
      if (roomsRes.ok) setRooms(await roomsRes.json());
    } catch {
      toast({ title: "Failed to load inbox", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [creatorIncomeEnabled, toast]);

  useEffect(() => { void load(); }, [load]);

  // Collab: accept / reject
  const decideCollab = async (id: number, status: "accepted" | "rejected") => {
    setActingId(id);
    try {
      const res = await apiFetch(`/api/collaboration/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: status === "accepted" ? "Request accepted" : "Request rejected" });
      await load();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const createRoom = async (request: CollabRequest) => {
    try {
      const counterpart = request.sender ?? request.receiver;
      const res = await apiFetch("/api/collaboration/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          title: `Project with ${counterpart?.displayName ?? counterpart?.username ?? "Creator"}`,
          brief: request.message,
          splitSuggestion: { You: 50, [counterpart?.displayName ?? "Collaborator"]: 50 },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const room = await res.json();
      setRooms(previous => [room, ...previous.filter(item => item.id !== room.id)]);
      toast({ title: "Project room created" });
    } catch {
      toast({ title: "Could not create project room", variant: "destructive" });
    }
  };

  const saveRoom = async (room: CollaborationRoom) => {
    setSavingRoomId(room.id);
    try {
      const res = await apiFetch(`/api/collaboration/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: room.title, brief: room.brief, splitSuggestion: room.splitSuggestion }),
      });
      if (!res.ok) throw new Error("Failed");
      setRooms(previous => previous.map(item => item.id === room.id ? { ...item, updatedAt: new Date().toISOString() } : item));
      toast({ title: "Room updated" });
    } catch {
      toast({ title: "Could not update room", variant: "destructive" });
    } finally {
      setSavingRoomId(null);
    }
  };

  // Commission: respond
  const respondCommission = async (id: number, status: string, response: string) => {
    if (!creatorIncomeEnabled) return;
    try {
      const res = await apiFetch(`/api/services/commissions/${id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, response: response.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      const label = status === "accepted" ? "accepted" : status === "declined" ? "declined" : "counter-offer sent";
      toast({ title: `Commission ${label}` });
      await load();
    } catch {
      toast({ title: "Failed to respond", variant: "destructive" });
    }
  };

  const pendingCollab = collabReceived.filter(r => r.status === "pending").length;
  const pendingComm = commReceived.filter(r => r.status === "pending").length;
  const totalPending = pendingCollab + (creatorIncomeEnabled ? pendingComm : 0);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Handshake className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Inbox</h1>
              {totalPending > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold">
                  {totalPending}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {creatorIncomeEnabled ? "Collaboration requests and commission inquiries." : "Collaboration requests."}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-5 h-auto flex-wrap gap-1">
            <TabsTrigger value="received-collab" className="gap-1.5 text-xs">
              <InboxIcon className="w-3.5 h-3.5" /> Collaborations
              {pendingCollab > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{pendingCollab}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent-collab" className="gap-1.5 text-xs">
              <Send className="w-3.5 h-3.5" /> Sent Collabs
            </TabsTrigger>
            {creatorIncomeEnabled && (
              <>
                <TabsTrigger value="received-comm" className="gap-1.5 text-xs">
                  <Briefcase className="w-3.5 h-3.5" /> Commissions
                  {pendingComm > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{pendingComm}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sent-comm" className="gap-1.5 text-xs">
                  <Send className="w-3.5 h-3.5" /> Sent Commissions
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {rooms.length > 0 && (
            <section className="mb-6 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Project rooms</h2>
                <p className="text-xs text-muted-foreground">Shared briefs and split suggestions for accepted collaborations.</p>
              </div>
              {rooms.map(room => (
                <Card key={room.id} className="p-4 border-primary/20 bg-primary/[0.03]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        value={room.title}
                        onChange={event => setRooms(previous => previous.map(item => item.id === room.id ? { ...item, title: event.target.value } : item))}
                        className="w-full bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-primary/40"
                        aria-label="Project room title"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Updated <Timestamp value={room.updatedAt} mode="date" /></p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={() => saveRoom(room)} disabled={savingRoomId === room.id}>
                      {savingRoomId === room.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Save
                    </Button>
                  </div>
                  <Textarea
                    value={room.brief}
                    onChange={event => setRooms(previous => previous.map(item => item.id === room.id ? { ...item, brief: event.target.value } : item))}
                    placeholder="Shared project brief"
                    className="mt-3 min-h-[72px] text-sm resize-y"
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Suggested split</span>
                    {Object.entries(room.splitSuggestion).map(([name, share]) => (
                      <Badge key={name} variant="outline">{name}: {share}%</Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </section>
          )}

          {/* ── Received Collaborations ── */}
          <TabsContent value="received-collab" className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && collabReceived.length === 0 && (
              <Card className="p-10 text-center">
                <Handshake className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No collaboration requests yet.</p>
              </Card>
            )}
            {collabReceived.map(r => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-sm">
                      <Link href={`/profile/${r.sender?.username ?? ""}`} className="font-medium hover:underline">
                        {r.sender?.displayName || r.sender?.username || "Unknown"}
                      </Link>{" "}
                      wants to collaborate
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5"><Timestamp value={r.createdAt} mode="datetime" /></div>
                  </div>
                  <CollabStatusPill status={r.status} />
                </div>
                <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{r.message}</p>
                {r.status === "pending" && (
                  <div className="flex gap-2 mt-3 justify-end">
                    <Button variant="outline" size="sm" className="rounded-xl gap-1 min-h-[44px]" onClick={() => decideCollab(r.id, "rejected")} disabled={actingId === r.id}>
                      <X className="w-4 h-4" /> Reject
                    </Button>
                    <Button size="sm" className="rounded-xl gap-1 min-h-[44px]" onClick={() => decideCollab(r.id, "accepted")} disabled={actingId === r.id}>
                      <Check className="w-4 h-4" /> Accept
                    </Button>
                  </div>
                )}
                {r.status === "accepted" && (
                  <div className="flex justify-end mt-3">
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs min-h-[44px]" onClick={() => createRoom(r)} disabled={rooms.some(room => room.requestId === r.id)}>
                      <Handshake className="w-3.5 h-3.5" /> {rooms.some(room => room.requestId === r.id) ? "Room Created" : "Create Project Room"}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-xs min-h-[44px]" onClick={() => setDraftCollab(r)}>
                      <FileText className="w-3.5 h-3.5" /> Create Project Draft
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* ── Sent Collaborations ── */}
          <TabsContent value="sent-collab" className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && collabSent.length === 0 && (
              <Card className="p-10 text-center">
                <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">You haven't sent any requests yet.</p>
              </Card>
            )}
            {collabSent.map(r => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-sm">
                      To{" "}
                      <Link href={`/profile/${r.receiver?.username ?? ""}`} className="font-medium hover:underline">
                        {r.receiver?.displayName || r.receiver?.username || "Unknown"}
                      </Link>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5"><Timestamp value={r.createdAt} mode="datetime" /></div>
                  </div>
                  <CollabStatusPill status={r.status} />
                </div>
                <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{r.message}</p>
              </Card>
            ))}
          </TabsContent>

          {/* ── Received Commissions ── */}
          {creatorIncomeEnabled && <TabsContent value="received-comm" className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && commReceived.length === 0 && (
              <Card className="p-10 text-center">
                <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No commission requests yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Set up your availability on the{" "}
                  <Link href="/opportunities" className="text-primary hover:underline">Opportunity Board</Link>{" "}
                  to attract clients.
                </p>
              </Card>
            )}
            {commReceived.map(c => (
              <CommissionCard key={c.id} commission={c} mode="received" onRespond={respondCommission} />
            ))}
          </TabsContent>}

          {/* ── Sent Commissions ── */}
          {creatorIncomeEnabled && <TabsContent value="sent-comm" className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && commSent.length === 0 && (
              <Card className="p-10 text-center">
                <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No commissions sent yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Browse the{" "}
                  <Link href="/opportunities" className="text-primary hover:underline">Opportunity Board</Link>{" "}
                  to hire a creator.
                </p>
              </Card>
            )}
            {commSent.map(c => (
              <CommissionCard key={c.id} commission={c} mode="sent" />
            ))}
          </TabsContent>}
        </Tabs>
      </div>

      {draftCollab && (
        <SmartProjectDraft
          open={!!draftCollab}
          onOpenChange={(v) => { if (!v) setDraftCollab(null); }}
          defaultTitle={`Collaboration with ${draftCollab.sender?.displayName ?? draftCollab.sender?.username ?? 'Creator'}`}
          collaborators={[
            { displayName: 'You', share: 50 },
            { displayName: draftCollab.sender?.displayName ?? draftCollab.sender?.username ?? 'Creator', share: 50 },
          ]}
        />
      )}
    </AppLayout>
  );
}
