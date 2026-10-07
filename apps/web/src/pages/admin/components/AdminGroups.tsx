import { useEffect, useState } from "react";
import { ExternalLink, Search, Users } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AdminProps } from "./types";
import { AdminOverviewStats } from "./AdminOverviewStats";
import { useAdminFetch } from "../hooks/useAdminFetch";

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

export default function AdminGroups({ token, toast, currentUser }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = currentUser.role === "super_admin";

  useEffect(() => {
    let active = true;
    void fetchAdmin("/api/admin/groups")
      .then(data => { if (active) setGroups(Array.isArray(data.groups) ? data.groups : []); })
      .catch(error => toast({ title: "Could not load groups", description: error.message, variant: "destructive" }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAdmin, toast]);

  const toggleEvents = async (group: GroupRow, enabled: boolean) => {
    try {
      await fetchAdmin(`/api/groups/${group.id}/features`, {
        method: "PATCH",
        body: JSON.stringify({ eventsEnabled: enabled }),
      });
      setGroups(current => current.map(item => item.id === group.id ? { ...item, features: { ...item.features, eventsEnabled: enabled } } : item));
      toast({ title: enabled ? "Events enabled for group" : "Events disabled for group" });
    } catch (error) {
      toast({ title: "Could not update Events feature", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    }
  };

  const filtered = groups.filter(group => `${group.name} ${group.slug}`.toLowerCase().includes(search.trim().toLowerCase()));
  const activeGroups = groups.filter(group => !group.isArchived && !group.isDeleted).length;
  const archivedGroups = groups.filter(group => group.isArchived).length;
  const deletedGroups = groups.filter(group => group.isDeleted).length;
  return <section className="space-y-5">
    <AdminOverviewStats items={[
      { label: "Groups loaded", value: groups.length, detail: "Latest records returned by the admin API" },
      { label: "Active groups", value: activeGroups, detail: "Not archived or deleted" },
      { label: "Archived", value: archivedGroups },
      { label: "Deleted", value: deletedGroups },
    ]} />
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
