import { useState, type ReactElement } from "react";
import { Redirect, useLocation } from "wouter";
import {
  Activity, BarChart3, BookOpen, Briefcase, Flag, Gauge, Languages, LayoutDashboard, MessageSquare, Send,
  ListTodo, Settings, Shield, ToggleRight, Users,
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
import AdminConsoleShell, { type AdminNavItem, type AdminTabKey } from "./components/AdminConsoleShell";
import type { AdminProps } from "./components/types";

const ADMIN_GROUPS: readonly { label: string; items: readonly AdminNavItem[] }[] = [
  { label: "Overview", items: [["dashboard", "Dashboard", LayoutDashboard]] },
  { label: "People", items: [["users", "Users", Users], ["referrals", "Growth / Referrals", BarChart3]] },
  { label: "Communications", items: [["support", "Support inbox", MessageSquare], ["communications", "Send messages", Send]] },
  { label: "Content", items: [["content", "Content", BookOpen], ["trust", "Moderation", Shield]] },
  { label: "Growth", items: [["chains", "Chains", ListTodo], ["scheduled", "Scheduled posts", Gauge]] },
  { label: "Payments / Boosts", items: [["revenue", "Revenue & boosts", Briefcase]] },
  { label: "Feature Flags", items: [["features", "Feature flags", ToggleRight]] },
  { label: "System", items: [["settings", "Settings", Settings], ["monitoring", "Monitoring", Activity], ["languages", "Languages", Languages]] },
];

export default function Admin() {
  const { user, logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTabKey>("dashboard");
  const role = (user as { role?: string } | null)?.role;
  if (!user || !["moderator", "admin", "super_admin"].includes(role ?? "")) {
    return <Redirect to="/" />;
  }

  const currentUser = {
    id: Number((user as { id?: number }).id),
    role,
    displayName: (user as { displayName?: string }).displayName,
  };
  const props: AdminProps = { token: getStoredToken(), toast, currentUser };
  const panels: Record<string, ReactElement> = {
    dashboard: <AdminDashboard {...props} />,
    users: <AdminUsers {...props} />,
    referrals: <AdminReferrals {...props} />,
    content: <AdminContent {...props} />,
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
  };

  const signOut = () => { logout(); setLocation("/"); };

  return (
    <AdminConsoleShell
      groups={ADMIN_GROUPS}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      currentUser={currentUser}
      onLogout={signOut}
    >
      {panels[activeTab]}
    </AdminConsoleShell>
  );
}