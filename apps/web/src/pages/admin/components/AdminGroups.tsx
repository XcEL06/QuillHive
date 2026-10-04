import { useEffect, useState } from "react";
import { ExternalLink, Search, Users } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import type { AdminProps } from "./types";

interface GroupRow {
  id: number;
  slug: string;
  name: string;
  type: string;
  memberCount?: number;
  features?: { eventsEnabled?: boolean };
  isArchived: boolean;
  isDeleted: boolean;
}

export default function AdminGroups({ currentUser }: AdminProps) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = currentUser.role === "super_admin";

  useEffect(() => {
    let active = true;
    void apiFetch("/api/admin/groups")
      .then(async response => response.ok ? response.json() as Promise<{ groups?: GroupRow[] }> : { groups: [] })
      .then(data => { if (active) setGroups(Array.isArray(data.groups) ? data.groups : []); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const toggleEvents = async (group: GroupRow, enabled: boolean) => {
    const response = await apiFetch(`/api/groups/${group.id}/features`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventsEnabled: enabled }),
    });
    if (!response.ok) return toast({ title: "Could not update Events feature", variant: "destructive" });
    setGroups(current => current.map(item => item.id === group.id ? { ...item, features: { ...item.features, eventsEnabled: enabled } } : item));
    toast({ title: enabled ? "Events enabled for group" : "Events disabled for group" });
  };

  const filtered = groups.filter(group => `${group.name} ${group.slug}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Group controls</h2><p className="mt-1 text-sm text-muted-foreground">Manage the Events feature flag for each group.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search groups" className="pl-9" /></div></header>
    <div className="divide-y divide-border border-y border-border">
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading groups...</p> : filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No groups found.</p> : filtered.map(group => <div key={group.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Users className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{group.name}</p><p className="text-xs capitalize text-muted-foreground">{group.type} · {group.slug}{group.isArchived ? " · archived" : ""}{group.isDeleted ? " · deleted" : ""}</p></div></div>
        <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><span>Events</span><Switch checked={Boolean(group.features?.eventsEnabled)} disabled={!isSuperAdmin} onCheckedChange={enabled => void toggleEvents(group, enabled)} /></label><Link href={`/g/${group.slug}`} aria-label={`Open ${group.name}`} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></Link></div>
      </div>)}
    </div>
    {!isSuperAdmin && <p className="text-xs text-muted-foreground">Only super admins can change group feature flags.</p>}
  </section>;
}
