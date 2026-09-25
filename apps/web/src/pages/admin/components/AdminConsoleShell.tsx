import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, Check, ChevronRight, LogOut, Menu, MonitorCog, Search, X } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type AdminTabKey = "dashboard" | "users" | "referrals" | "content" | "revenue" | "trust" | "chains" | "scheduled" | "features" | "settings" | "monitoring" | "languages" | "support" | "communications";
export type AdminNavItem = readonly [AdminTabKey, string, React.ComponentType<{ className?: string }>];

interface AdminConsoleShellProps {
  groups: readonly { label: string; items: readonly AdminNavItem[] }[];
  activeTab: AdminTabKey;
  onSelectTab: (key: AdminTabKey) => void;
  currentUser: { role?: string; displayName?: string };
  children: ReactNode;
  onLogout: () => void;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "QH";
}

export default function AdminConsoleShell({ groups, activeTab, onSelectTab, currentUser, children, onLogout }: AdminConsoleShellProps) {
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const allItems = groups.flatMap((group) => group.items);
  const active = allItems.find(([key]) => key === activeTab) ?? allItems[0];
  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups.map((group) => ({ ...group, items: group.items.filter(([, label]) => label.toLowerCase().includes(needle)) })).filter((group) => group.items.length > 0);
  }, [groups, search]);

  const selectTab = (key: AdminTabKey) => {
    onSelectTab(key);
    setSidebarOpen(false);
    setSearch("");
  };

  const navigation = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 px-5 py-5">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><BookOpen className="h-4 w-4" /></span>
          <span><span className="block text-sm font-semibold tracking-tight">QuillHive</span><span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Admin console</span></span>
        </button>
      </div>
      <div className="px-3 py-4">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Jump to a section" className="h-9 border-border/70 bg-muted/40 pl-9 text-xs" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-muted-foreground" aria-label="Clear search"><X className="h-4 w-4" /></button>}
        </div>
        <nav className="space-y-5">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(([key, label, Icon]) => (
                  <button key={key} onClick={() => selectTab(key)} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${activeTab === key ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>
                    <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 truncate">{label}</span><ChevronRight className={`h-3.5 w-3.5 transition-opacity ${activeTab === key ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
      <div className="mt-auto border-t border-border/70 p-4">
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-600 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />All systems operational</div>
        <button onClick={onLogout} className="flex w-full items-center gap-2 px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><LogOut className="h-4 w-4" /> Back to app</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/70 bg-background md:block">{navigation}</aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0"><SheetHeader className="sr-only"><SheetTitle>Admin navigation</SheetTitle></SheetHeader>{navigation}</SheetContent>
      </Sheet>
      <main className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden" aria-label="Open admin navigation"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span>Admin</span><ChevronRight className="h-3 w-3" /><span className="truncate text-foreground">{active[1]}</span></div><h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{active[1]}</h1></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Production</div>
              <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><MonitorCog className="h-4 w-4" />Live console</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-muted"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{initials(currentUser.displayName || "Administrator")}</span><span className="hidden max-w-32 truncate text-sm font-medium sm:block">{currentUser.displayName || "Administrator"}</span><ChevronRight className="hidden h-3.5 w-3.5 rotate-90 text-muted-foreground sm:block" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52"><div className="px-2 py-2"><p className="text-sm font-medium">{currentUser.displayName || "Administrator"}</p><p className="text-xs capitalize text-muted-foreground">{currentUser.role?.replace("_", " ")}</p></div><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLocation("/")}><ArrowUpRight className="mr-2 h-4 w-4" />Open QuillHive</DropdownMenuItem><DropdownMenuItem onClick={onLogout}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-4 py-3 shadow-sm"><div><p className="text-sm font-medium">Platform command center</p><p className="mt-0.5 text-xs text-muted-foreground">Operate QuillHive with a clear view of what needs attention.</p></div><Badge variant="outline" className="gap-1.5 font-normal"><Check className="h-3.5 w-3.5 text-emerald-500" />Live data</Badge></div>
          {children}
        </div>
      </main>
    </div>
  );
}
