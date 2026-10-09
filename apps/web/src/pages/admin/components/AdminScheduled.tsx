import { useEffect, useState } from "react";
import { Timestamp } from '@/lib/postTimestamp';
import { Button } from "@/components/ui/button";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { Link } from "wouter";

export default function AdminScheduled({ token, toast }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const load = () => void fetchAdmin("/api/admin/scheduled-posts").then((d) => setScheduled(Array.isArray(d?.scheduled) ? d.scheduled : [])).catch((err) => toast({ title: "Could not load scheduled posts", description: err.message, variant: "destructive" }));
  useEffect(load, [fetchAdmin]);
  const publish = async (id: number) => { try { await fetchAdmin(`/api/admin/scheduled-posts/${id}/publish`, { method: "PATCH" }); toast({ title: "Post published" }); load(); } catch (err: any) { toast({ title: "Could not publish post", description: err.message, variant: "destructive" }); } };
  return <section className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"><h2 className="border-b border-border/70 px-5 py-4 text-sm font-semibold">Scheduled posts</h2><div className="divide-y divide-border/60">{scheduled.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No scheduled posts.</p> : scheduled.map((p) => <div key={p.id} className="flex items-center gap-3 px-5 py-4"><Link href={`/post/${p.id}`} className="min-w-0 flex-1 hover:underline"><p className="truncate text-sm font-medium">{p.title || "(untitled)"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{p.authorDisplayName} · {p.scheduledAt && <Timestamp value={p.scheduledAt} mode="datetime" />}</p></Link><Button size="sm" onClick={() => publish(p.id)}>Publish</Button></div>)}</div></section>;
}