import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Ban, Check, Shield, ShieldCheck, User as UserIcon, UserMinus, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type GroupRole = "owner" | "admin" | "moderator" | "member";
type MemberStatus = "active" | "pending" | "muted" | "banned";

interface Member {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt: string;
  status: MemberStatus;
  mutedUntil: string | null;
  trustScoreAtJoin: number | null;
  trustScore: number | null;
}

interface JoinRequest {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  joinedAt: string;
  trustScore: number | null;
  screeningAnswers: Record<string, string>;
}

interface GroupMembersListProps {
  groupId: number;
}

const ROLES: GroupRole[] = ["admin", "moderator", "member"];

function TrustBadge({ score }: { score: number | null }) {
  return <Badge variant="outline" className="whitespace-nowrap">Trust {score ?? "--"}</Badge>;
}

export function GroupMembersList({ groupId }: GroupMembersListProps) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [myRole, setMyRole] = useState<GroupRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletePosts, setDeletePosts] = useState(false);
  const [muteDuration, setMuteDuration] = useState("24h");
  const [customMuteUntil, setCustomMuteUntil] = useState("");

  const load = async () => {
    try {
      const [membersResponse, roleResponse] = await Promise.all([
        apiFetch(`/api/groups/${groupId}/members`),
        token ? apiFetch(`/api/groups/${groupId}/my-role`) : Promise.resolve(null),
      ]);
      if (membersResponse.ok) {
        const data = await membersResponse.json() as { members?: Member[] };
        setMembers(Array.isArray(data.members) ? data.members : []);
      }
      if (roleResponse?.ok) {
        const data = await roleResponse.json() as { role: GroupRole | null };
        setMyRole(data.role);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [groupId, token]);

  useEffect(() => {
    if ((myRole !== "admin" && myRole !== "owner") || !token) return;
    void apiFetch(`/api/groups/${groupId}/join-requests`)
      .then(response => response.ok ? response.json() as Promise<{ requests?: JoinRequest[] }> : { requests: [] })
      .then(data => setRequests(Array.isArray(data.requests) ? data.requests : []));
  }, [groupId, myRole, token]);

  const updateRole = async (userId: number, role: GroupRole) => {
    const response = await apiFetch(`/api/groups/${groupId}/members/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }),
    });
    if (!response.ok) return toast({ title: "Could not update role", variant: "destructive" });
    setMembers(current => current.map(member => member.userId === userId ? { ...member, role } : member));
    toast({ title: "Role updated" });
  };

  const reviewRequest = async (request: JoinRequest, decision: "approve" | "reject" | "block") => {
    const response = await apiFetch(`/api/groups/${groupId}/join-requests/${request.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
    });
    if (!response.ok) return toast({ title: "Could not review request", variant: "destructive" });
    setRequests(current => current.filter(item => item.id !== request.id));
    if (decision === "approve") {
      setMembers(current => [...current, { ...request, id: request.id, role: "member", status: "active", mutedUntil: null, trustScoreAtJoin: request.trustScore } as Member]);
    }
    toast({ title: decision === "approve" ? "Member approved" : decision === "block" ? "Applicant blocked" : "Request declined" });
  };

  const updateMemberStatus = async (member: Member, status: "active" | "muted") => {
    let mutedUntil: string | null = null;
    if (status === "muted") {
      const now = Date.now();
      const duration = muteDuration === "7d" ? 7 * 86400000 : muteDuration === "30d" ? 30 * 86400000 : 86400000;
      mutedUntil = muteDuration === "custom" && customMuteUntil ? new Date(customMuteUntil).toISOString() : new Date(now + duration).toISOString();
    }
    const response = await apiFetch(`/api/groups/${groupId}/members/${member.userId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, mutedUntil }),
    });
    if (!response.ok) return toast({ title: "Could not update member status", variant: "destructive" });
    setMembers(current => current.map(item => item.userId === member.userId ? { ...item, status, mutedUntil } : item));
  };

  const removeMember = async (member: Member, ban: boolean) => {
    const response = await apiFetch(ban ? `/api/groups/${groupId}/bans` : `/api/groups/${groupId}/members/${member.userId}`, {
      method: ban ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ban ? { userId: member.userId, deletePosts } : { deletePosts }),
    });
    if (!response.ok) return toast({ title: "Could not update member", variant: "destructive" });
    setMembers(current => ban
      ? current.map(item => item.userId === member.userId ? { ...item, status: "banned" } : item)
      : current.filter(item => item.userId !== member.userId));
    toast({ title: ban ? "Member banned" : "Member removed" });
  };

  const unban = async (member: Member) => {
    const response = await apiFetch(`/api/groups/${groupId}/bans/${member.userId}`, { method: "DELETE" });
    if (!response.ok) return toast({ title: "Could not unban member", variant: "destructive" });
    setMembers(current => current.map(item => item.userId === member.userId ? { ...item, status: "active" } : item));
  };

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading members...</div>;

  const canManage = myRole === "admin" || myRole === "owner";
  const canModerate = canManage || myRole === "moderator";
  const memberRows = (list: Member[]) => list.length === 0
    ? <p className="border-y border-dashed py-8 text-center text-sm text-muted-foreground">No members in this view.</p>
    : <div className="divide-y divide-border">{list.map(member => <div key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10"><AvatarImage src={member.avatarUrl ?? undefined} /><AvatarFallback>{(member.displayName || member.username || "?").slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
        <div className="min-w-0"><Link href={`/u/${member.username}`} className="block truncate text-sm font-semibold hover:underline">{member.displayName || member.username}</Link><p className="truncate text-xs text-muted-foreground">@{member.username} · joined <Timestamp value={member.joinedAt} mode="date" /></p></div>
        <TrustBadge score={member.trustScore} />
        <Badge variant="secondary" className="capitalize">{member.role}</Badge>
      </div>
      {canModerate && member.role !== "owner" && <div className="flex flex-wrap items-center gap-2">
        {canManage && <Select value={member.role} onValueChange={value => void updateRole(member.userId, value as GroupRole)}><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map(role => <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>)}</SelectContent></Select>}
        {member.status === "banned" ? <Button size="sm" variant="outline" onClick={() => void unban(member)}><Check className="mr-1.5 h-4 w-4" />Unban</Button> : <>
          <Select value={muteDuration} onValueChange={setMuteDuration}><SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24h">24 hours</SelectItem><SelectItem value="7d">7 days</SelectItem><SelectItem value="30d">30 days</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select>
          {muteDuration === "custom" && <Input aria-label="Mute until" type="datetime-local" className="h-9 w-44" value={customMuteUntil} onChange={event => setCustomMuteUntil(event.target.value)} />}
          <Button size="sm" variant="outline" onClick={() => void updateMemberStatus(member, member.status === "muted" ? "active" : "muted")} title={member.status === "muted" ? "Unmute member" : "Mute member"}>{member.status === "muted" ? <Volume2 className="mr-1.5 h-4 w-4" /> : <VolumeX className="mr-1.5 h-4 w-4" />}{member.status === "muted" ? "Unmute" : "Mute"}</Button>
          {canManage && <><Button size="sm" variant="ghost" onClick={() => void removeMember(member, false)}><UserMinus className="mr-1.5 h-4 w-4" />Remove</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeMember(member, true)}><Ban className="mr-1.5 h-4 w-4" />Ban</Button></>}
        </>}
      </div>}
    </div>)}</div>;

  const pendingMembers = members.filter(member => member.status === "pending");
  const tabs = ["all", "admins", "pending", "muted", "banned"] as const;
  return <section className="space-y-4" data-testid="group-members-list">
    {canManage && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={deletePosts} onChange={event => setDeletePosts(event.target.checked)} />Delete all group posts when removing or banning a member</label>}
    <Tabs defaultValue="all">
      <TabsList className="w-full justify-start overflow-x-auto">{tabs.map(tab => <TabsTrigger key={tab} value={tab} className="capitalize">{tab}{tab === "pending" && requests.length > 0 ? ` (${requests.length})` : ""}</TabsTrigger>)}</TabsList>
      <TabsContent value="all">{memberRows(members)}</TabsContent>
      <TabsContent value="admins">{memberRows(members.filter(member => member.role !== "member"))}</TabsContent>
      <TabsContent value="pending" className="space-y-5">
        {canManage && requests.length > 0 && <div className="divide-y divide-border border-y">{requests.map(request => <article key={request.id} className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-3"><Avatar className="h-10 w-10"><AvatarImage src={request.avatarUrl ?? undefined} /><AvatarFallback>{(request.displayName || request.username).slice(0, 1)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><Link href={`/u/${request.username}`} className="text-sm font-semibold hover:underline">{request.displayName || request.username}</Link><p className="text-xs text-muted-foreground">@{request.username} · applied <Timestamp value={request.createdAt} mode="date" /> · joined platform <Timestamp value={request.joinedAt} mode="date" /></p></div><TrustBadge score={request.trustScore} /></div>
          {Object.entries(request.screeningAnswers ?? {}).map(([question, answer]) => <div key={question} className="pl-13 text-sm"><p className="text-xs font-medium text-muted-foreground">{question}</p><p>{answer}</p></div>)}
          <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void reviewRequest(request, "approve")}><Check className="mr-1.5 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => void reviewRequest(request, "reject")}>Decline</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void reviewRequest(request, "block")}><Ban className="mr-1.5 h-4 w-4" />Block</Button></div>
        </article>)}</div>}
        {pendingMembers.length > 0 && <div>{memberRows(pendingMembers)}</div>}
        {!requests.length && !pendingMembers.length && <p className="py-8 text-center text-sm text-muted-foreground">No pending members or join requests.</p>}
      </TabsContent>
      <TabsContent value="muted">{memberRows(members.filter(member => member.status === "muted"))}</TabsContent>
      <TabsContent value="banned">{memberRows(members.filter(member => member.status === "banned"))}</TabsContent>
    </Tabs>
  </section>;
}