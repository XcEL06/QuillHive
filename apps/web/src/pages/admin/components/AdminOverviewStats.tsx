import type { LucideIcon } from "lucide-react";

export interface AdminOverviewStat {
  label: string;
  value: number | string;
  detail?: string;
  icon?: LucideIcon;
}

export function AdminOverviewStats({ items }: { items: AdminOverviewStat[] }) {
  return (
    <section aria-label="Section overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, detail, icon: Icon }) => (
        <article key={label} className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
            <span>{label}</span>
            {Icon && <Icon aria-hidden="true" className="h-4 w-4 text-primary" />}
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </article>
      ))}
    </section>
  );
}
