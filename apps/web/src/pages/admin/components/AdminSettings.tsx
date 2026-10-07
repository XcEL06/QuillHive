import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AdminProps } from "./types";
import { useAdminFetch } from "../hooks/useAdminFetch";

export default function AdminSettings({ token, toast, currentUser }: AdminProps) {
  const fetchAdmin = useAdminFetch(token);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const canManageSettings = currentUser.role === "super_admin";
  useEffect(() => { void fetchAdmin("/api/admin/settings").then(setSettings).catch((err) => toast({ title: "Could not load settings", description: err.message, variant: "destructive" })); }, [fetchAdmin, toast]);
  const save = async () => {
    setSaving(true);
    try {
      const updated = await fetchAdmin("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settings) });
      setSettings(updated);
      toast({ title: "Settings saved" });
    } catch (err) {
      toast({ title: "Could not save settings", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
    <div className="space-y-4">
      {Object.entries(settings).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <span className="text-sm">{key.replace(/_/g, " ")}</span>
          <Switch checked={value === "true"} disabled={!canManageSettings || saving} onCheckedChange={(enabled) => setSettings(current => ({ ...current, [key]: String(enabled) }))} aria-label={`Enable ${key.replace(/_/g, " ")}`} />
        </div>
      ))}
    </div>
    {canManageSettings ? <Button className="mt-6" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button> : <p className="mt-4 text-sm text-muted-foreground">Only super admins can change general settings.</p>}
  </section>;
}