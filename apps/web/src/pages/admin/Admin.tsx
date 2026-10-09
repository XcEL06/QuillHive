import { useEffect, useState, type ReactElement } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import {
  Activity, BarChart3, BookOpen, Gauge, Languages, LayoutDashboard, MessageSquare, Send,
  ListTodo, Settings, Shield, ToggleRight, Users, SearchCheck, Crown, CircleDollarSign, ClipboardList,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getStoredToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AdminDashboard from "./components/AdminDashboard";
import AdminUsers from "./components/AdminUsers";
import AdminReferrals from "./components/AdminReferrals";
import AdminContent from "./components/AdminContent";
import AdminRevenue from "./components/AdminRevenue";
import AdminTrust from "./components/AdminTrust";
import AdminChains from "./components/AdminChains";
import AdminScheduled from "./components/AdminScheduled";
import AdminFeatureFlags from "./components/AdminFeatureFlags";
import AdminSettings from "./components/AdminSettings";
import AdminMonitoring from "./components/AdminMonitoring";
import AdminLanguages from "./components/AdminLanguages";
import AdminSupport from "./components/AdminSupport";
import AdminCommunications from "./components/AdminCommunications";
import AdminGroups from "./components/AdminGroups";
import AdminMaster from "./components/AdminMaster";
import AdminSpamReview from "./components/AdminSpamReview";
import AdminOpportunities from "./components/AdminOpportunities";
import AdminConsoleShell, { type AdminNavItem, type AdminTabKey } from "./components/AdminConsoleShell";
import type { AdminProps } from "./components/types";

const ADMIN_GROUPS: readonly { label: string; items: readonly AdminNavItem[] }[] = [
  { label: "Overview", items: [["dashboard", "Dashboard", LayoutDashboard]] },
  { label: "People & growth", items: [["users", "Users", Users], ["referrals", "Growth & referrals", BarChart3]] },
  { label: "Content & community", items: [["content", "Posts & content", BookOpen], ["groups", "Groups", Users], ["opportunities", "Opportunities", ClipboardList]] },
  { label: "Trust & safety", items: [["trust", "Trust & moderation", Shield], ["spamReview", "Spam & scam review", SearchCheck]] },
  { label: "Support", items: [["support", "Support tickets", MessageSquare], ["communications", "Announcements", Send]] },
  { label: "Revenue", items: [["revenue", "Revenue & payments", CircleDollarSign]] },
  { label: "Publishing", items: [["chains", "Chains", ListTodo], ["scheduled", "Scheduled posts", Gauge]] },
  { label: "Feature Flags", items: [["features", "Feature flags", ToggleRight]] },
  { label: "System", items: [["monitoring", "Health & observability", Activity], ["settings", "Settings", Settings], ["languages", "Languages", Languages]] },
  { label: "Restricted tools", items: [["master", "Profile & group viewer", Crown]] },
];

const VALID_ADMIN_TABS = new Set<AdminTabKey>(["dashboard", "users", "referrals", "content", "groups", "opportunities", "revenue", "trust", "chains", "scheduled", "features", "settings", "monitoring", "languages", "support", "communications", "spamReview", "master"]);

export default function Admin({ initialTab }: { initialTab?: AdminTabKey }) {
  const { user, logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const requestedTab = new URLSearchParams(search).get("section");
  const initialSection = initialTab ?? (requestedTab && VALID_ADMIN_TABS.has(requestedTab as AdminTabKey) ? requestedTab as AdminTabKey : "dashboard");
  const [activeTab, setActiveTab] = useState<AdminTabKey>(initialSection);
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      return;
    }
    const section = new URLSearchParams(search).get("section");
    if (section && VALID_ADMIN_TABS.has(section as AdminTabKey)) setActiveTab(section as AdminTabKey);
  }, [initialTab, search]);
  const role = (user as { role?: string } | null)?.role;
  if (!user || !["moderator", "admin", "super_admin"].includes(role ?? "")) {
    return <Redirect to="/" />;
  }

  const currentUser = {
    id: Number((user as { id?: number }).id),
    role,
    displayName: (user as { displayName?: string }).displayName,
  };
  const navGroups = ADMIN_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(([key]) => {
      if (key === "master") return role === "super_admin";
      if (key === "communications") return role === "super_admin";
      if (key === "spamReview") return role === "admin" || role === "super_admin";
      return true;
    }),
  })).filter((group) => group.items.length > 0);
  const selectSection = (section: AdminTabKey) => {
    setActiveTab(section);
    setLocation(section === "dashboard" ? "/admin" : `/admin?section=${encodeURIComponent(section)}`);
  };
  const props: AdminProps = { token: getStoredToken(), toast, currentUser };
  const panels: Record<string, ReactElement> = {
    dashboard: <AdminDashboard {...props} />,
    users: <AdminUsers {...props} />,
    referrals: <AdminReferrals {...props} />,
    content: <AdminContent {...props} />,
    groups: <AdminGroups {...props} />,
    revenue: <AdminRevenue {...props} />,
    trust: <AdminTrust {...props} />,
    chains: <AdminChains {...props} />,
    scheduled: <AdminScheduled {...props} />,
    features: <AdminFeatureFlags {...props} />,
    settings: <AdminSettings {...props} />,
    monitoring: <AdminMonitoring {...props} />,
    languages: <AdminLanguages {...props} />,
    support: <AdminSupport {...props} />,
    communications: <AdminCommunications {...props} />,
    spamReview: <AdminSpamReview {...props} />,
    opportunities: <AdminOpportunities {...props} />,
    master: <AdminMaster {...props} />,
  };

  const signOut = () => { logout(); setLocation("/"); };

  return (
    <AdminConsoleShell
      groups={navGroups}
      activeTab={activeTab}
      onSelectTab={selectSection}
      currentUser={currentUser}
      onLogout={signOut}
    >
      {panels[activeTab]}
    </AdminConsoleShell>
  );
}