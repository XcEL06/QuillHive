import { useEffect, useState } from "react";
import { Loader2, Shield, ShieldCheck, User as UserIcon, UserMinus, Ban, Check, X, Volume2, VolumeX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";

type GroupRole = "owner" | "admin" | "moderator" | "member";

interface Member {
  id: number;
  userId: number;
  role: GroupRole;
  joinedAt: string;
  status: "active" | "pending" | "muted" | "banned";
  mutedUntil: string | null;
  trustScoreAtJoin: number | null;
}

interface GroupMembersListProps {
  groupId: number;
}

const ROLES: GroupRole[] = ["admin", "moderator", "member"];

export function GroupMembersList({ groupId }: GroupMembersListProps) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<GroupRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Array<{ id: number; userId: number; createdAt: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [membersRes, roleRes] = await Promise.all([
          fetch(`/api/groups/${groupId}/members`),
          token
            ? fetch(`/api/groups/${groupId}/my-role`, { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve(null),
        ]);
        if (membersRes.ok) {
          const data = await membersRes.json() as { members: Member[] };
          setMembers(Array.isArray(data?.members) ? data.members : []);
        }
        if (roleRes && roleRes.ok) {
          const data = await roleRes.json() as { role: GroupRole | null };
          setMyRole(data.role);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, token]);

  useEffect(() => {
    if ((myRole !== "admin" && myRole !== "owner") || !token) return;
    void fetch(`/api/groups/${groupId}/join-requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() as Promise<{ requests?: typeof requests }> : { requests: [] })
      .then(data => setRequests(Array.isArray(data?.requests) ? data.requests : []));
  }, [groupId, myRole, token]);

  const updateRole = async (userId: number, role: GroupRole) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error();
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role } : m));
      toast({ title: "Role updated" });
    } catch {
      toast({ title: "Could not update role", variant: "destructive" });
    }
  };

  const removeMember = async (userId: number, ban = false) => {
    if (!token) return;
    const endpoint = ban ? `/api/groups/${groupId}/bans` : `/api/groups/${groupId}/members/${userId}`;
    const res = await fetch(endpoint, {
      method: ban ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(ban ? { body: JSON.stringify({ userId }) } : {}),
    });
    if (!res.ok) return toast({ title: "Could not update member", variant: "destructive" });
    setMembers(prev => ban
      ? prev.map(member => member.userId === userId ? { ...member, status: "banned" } : member)
      : prev.filter(member => member.userId !== userId));
    toast({ title: ban ? "Member banned" : "Member removed" });
  };

  const reviewRequest = async (requestId: number, decision: "approve" | "reject") => {
    if (!token) return;
    const res = await fetch(`/api/groups/${groupId}/join-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) return toast({ title: "Could not review request", variant: "destructive" });
    setRequests(prev => prev.filter(request => request.id !== requestId));
    if (decision === "approve") window.location.reload();
  };

  const setMemberStatus = async (userId: number, status: "active" | "muted") => {
    if (!token) return;
    const mutedUntil = status === "muted" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    const res = await fetch(`/api/groups/${groupId}/members/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, mutedUntil }),
    });
    if (!res.ok) return toast({ title: "Could not update member status", variant: "destructive" });
    setMembers(prev => prev.map(member => member.userId === userId ? { ...member, status, mutedUntil } : member));
  };

  const unbanMember = async (userId: number) => {
    if (!token) return;
    const res = await fetch(`/api/groups/${groupId}/bans/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return toast({ title: "Could not unban member", variant: "destructive" });
    setMembers(prev => prev.map(member => member.userId === userId ? { ...member, status: "active", mutedUntil: null } : member));
  };

  if (loading) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-6 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  const canManage = myRole === "admin" || myRole === "owner";
  const canModerate = canManage || myRole === "moderator";

  return (
    <div className="space-y-6" data-testid="group-members-list">
      {canManage && requests.length > 0 && (
        <section className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold">Join requests</h3>
          {requests.map(request => (
            <div key={request.id} className="flex items-center justify-between gap-3 text-sm">
              <span>User #{request.userId}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => void reviewRequest(request.id, "approve")} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-primary-foreground"><Check className="w-3.5 h-3.5" />Approve</button>
                <button type="button" onClick={() => void reviewRequest(request.id, "reject")} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5"><X className="w-3.5 h-3.5" />Reject</button>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="bg-card border border-border/60 rounded-2xl divide-y divide-border">
      <div className="px-4 py-3 text-sm font-semibold">Admins &amp; Moderators</div>
      {members.filter(m => m.role !== "member").map(m => (
        <div key={`staff-${m.id}`} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-primary" /><span className="text-sm">User #{m.userId}</span><span className="text-xs text-muted-foreground capitalize">{m.role}</span></div>
        </div>
      ))}
      </section>
      <section className="bg-card border border-border/60 rounded-2xl divide-y divide-border">
      <div className="px-4 py-3 text-sm font-semibold">All members</div>
      {members.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">No members yet.</p>
      ) : members.map(m => (
        <div key={m.id} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 min-w-0">
            {m.role === "admin" ? <ShieldCheck className="w-4 h-4 text-primary" />
              : m.role === "moderator" ? <Shield className="w-4 h-4 text-amber-500" />
              : <UserIcon className="w-4 h-4 text-muted-foreground" />}
            <div className="min-w-0">
              <p className="font-medium text-sm">User #{m.userId}</p>
              <p className="text-xs text-muted-foreground">{m.role} · joined {new Date(m.joinedAt).toLocaleDateString()} · {m.status}{m.status === "muted" && m.mutedUntil ? ` until ${new Date(m.mutedUntil).toLocaleDateString()}` : ""}</p>
            </div>
          </div>
          {canModerate && m.status !== "banned" && m.role !== "owner" && (
            <div className="flex items-center gap-2">
              {canManage && <Select value={m.role} onValueChange={(v) => updateRole(m.userId, v as GroupRole)}>
                <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-role-${m.userId}`}><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.filter(role => role !== "owner").map(r => <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>}
              {canManage && <button type="button" title="Remove member" onClick={() => void removeMember(m.userId)} className="p-2 rounded-lg hover:bg-muted"><UserMinus className="w-4 h-4" /></button>}
              <button type="button" title={m.status === "muted" ? "Unmute member" : "Mute member for 24 hours"} onClick={() => void setMemberStatus(m.userId, m.status === "muted" ? "active" : "muted")} className="p-2 rounded-lg hover:bg-muted">{m.status === "muted" ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>
              {canManage && <button type="button" title="Ban member" onClick={() => void removeMember(m.userId, true)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10"><Ban className="w-4 h-4" /></button>}
            </div>
          )}
          {canManage && m.status === "banned" && <button type="button" title="Unban member" onClick={() => void unbanMember(m.userId)} className="rounded-lg p-2 hover:bg-muted"><Check className="h-4 w-4" /></button>}
        </div>
      ))}
      </section>
    </div>
  );
}
