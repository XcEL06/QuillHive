import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { AdminOverviewStats } from "./AdminOverviewStats";

interface Opportunity {
  id: number;
  title: string;
  description: string;
  type: string;
  authorId: number;
  isActive: boolean;
  isApproved: boolean;
  moderationStatus: string;
  isFeatured: boolean;
  createdAt: string;
}

export default function AdminOpportunities({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdmin("/api/admin/jobs");
      setOpportunities(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (error) {
      toast({ title: "Could not load opportunities", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [fetchAdmin, toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  const updateOpportunity = async (opportunity: Opportunity, action: "approve" | "reject" | "feature") => {
    setActingId(opportunity.id);
    try {
      const result = await fetchAdmin(`/api/admin/jobs/${opportunity.id}/${action}`, { method: "PATCH", body: JSON.stringify({}) });
      setOpportunities(current => current.map(item => item.id !== opportunity.id ? item : {
        ...item,
        ...(action === "approve" ? { isApproved: true, isActive: true, moderationStatus: "published" } : {}),
        ...(action === "reject" ? { isActive: false, isApproved: false, moderationStatus: "rejected" } : {}),
        ...(action === "feature" ? { isFeatured: true, featuredUntil: result.featuredUntil } : {}),
      }));
      toast({ title: action === "feature" ? "Opportunity featured" : action === "approve" ? "Opportunity approved" : "Opportunity rejected" });
    } catch (error) {
      toast({ title: `Could not ${action} opportunity`, description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const pendingCount = opportunities.filter(item => item.moderationStatus === "under_review" || (!item.isApproved && item.moderationStatus !== "rejected")).length;
  const activeCount = opportunities.filter(item => item.isActive && item.isApproved).length;
  const featuredCount = opportunities.filter(item => item.isFeatured).length;
  const filtered = useMemo(() => opportunities.filter(item =>
    `${item.id} ${item.title} ${item.type} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [opportunities, search]);

  return (
    <div className="space-y-5">
      <AdminOverviewStats items={[
        { label: "Recent opportunities", value: opportunities.length, detail: "Latest records returned by admin API" },
        { label: "Pending review", value: pendingCount, detail: "Unapproved or under review" },
        { label: "Active listings", value: activeCount, detail: "Approved and available" },
        { label: "Featured listings", value: featuredCount, detail: "Currently marked featured" },
      ]} />
      <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 sm:px-5">
          <div><h2 className="font-semibold">Opportunity moderation</h2><p className="mt-1 text-xs text-muted-foreground">Approve, reject, and feature job and collaboration listings.</p></div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </header>
        <div className="border-b border-border/70 p-4 sm:px-5">
          <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, type, description, or ID" className="pl-9" /></div>
          <p className="mt-2 text-xs text-muted-foreground">{filtered.length} matching opportunities · latest 200 records</p>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading opportunities…</p> : filtered.length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">No opportunities match this search.</p> : (
          <div className="divide-y divide-border/60">
            {filtered.map(opportunity => (
              <article key={opportunity.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{opportunity.title}</h3>
                    <Badge variant="outline" className="capitalize">{opportunity.type.replace(/_/g, " ")}</Badge>
                    <Badge variant={opportunity.isApproved ? "secondary" : "destructive"}>{opportunity.moderationStatus || (opportunity.isApproved ? "approved" : "pending")}</Badge>
                    {opportunity.isFeatured && <Badge variant="outline" className="gap-1"><Star className="h-3 w-3" />Featured</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{opportunity.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">#{opportunity.id} · Creator #{opportunity.authorId} · {new Date(opportunity.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline"><a href="/jobs" target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open board</a></Button>
                  {!opportunity.isApproved && <Button size="sm" disabled={actingId === opportunity.id} onClick={() => void updateOpportunity(opportunity, "approve")}>Approve</Button>}
                  {(opportunity.isApproved || opportunity.isActive) && <Button size="sm" variant="destructive" disabled={actingId === opportunity.id} onClick={() => void updateOpportunity(opportunity, "reject")}>Reject</Button>}
                  {!opportunity.isFeatured && opportunity.isApproved && <Button size="sm" variant="outline" disabled={actingId === opportunity.id} onClick={() => void updateOpportunity(opportunity, "feature")}><Star className="mr-1.5 h-3.5 w-3.5" />Feature</Button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
