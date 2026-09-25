import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Briefcase, Users2, Handshake, X } from "lucide-react";
import { JobsPanel } from "./JobsPanel";
import { TalentPanel } from "./TalentPanel";
import { CollaboratePanel } from "./CollaboratePanel";
import { BackButton } from "@/components/ui/BackButton";

const WORKSPACE_SAFETY_DISMISSED_KEY = "quillhive_workspace_safety_dismissed";

function hasDismissedSafetyNotice() {
  try {
    return window.sessionStorage.getItem(WORKSPACE_SAFETY_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function Workspace() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const [tab, setTab] = useState(params.get("tab") ?? "work");
  const [showSafetyNotice, setShowSafetyNotice] = useState(() => !hasDismissedSafetyNotice());

  const dismissSafetyNotice = () => {
    try {
      window.sessionStorage.setItem(WORKSPACE_SAFETY_DISMISSED_KEY, "true");
    } catch {
      // Keep the banner dismissible even when session storage is unavailable.
    }
    setShowSafetyNotice(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <BackButton />
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Turn your body of work, Trust Score, and availability into your next paid opportunity.
          </p>
        </div>

        {showSafetyNotice && (
          <div className="relative rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 pr-12 text-sm mb-4">
            <strong>Stay safe on Workspace:</strong>{" "}
            QuillHive helps you find opportunities — we don't process or hold any payment made here.
            Never pay a fee to apply for work. Verify who you're working with, and report anything that
            feels wrong.
            <Link href="/safety" className="underline ml-1 whitespace-nowrap">Learn more →</Link>
            <button
              type="button"
              onClick={dismissSafetyNotice}
              aria-label="Dismiss Workspace safety notice"
              title="Dismiss safety notice"
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-amber-500/10 hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="work" className="gap-1.5">
              <Briefcase className="w-4 h-4" />
              <span className="hidden sm:inline">Find Opportunities</span>
              <span className="sm:hidden">Work</span>
            </TabsTrigger>
            <TabsTrigger value="talent" className="gap-1.5">
              <Users2 className="w-4 h-4" />
              <span className="hidden sm:inline">Browse People</span>
              <span className="sm:hidden">Talent</span>
            </TabsTrigger>
            <TabsTrigger value="collaborate" className="gap-1.5">
              <Handshake className="w-4 h-4" />
              <span className="hidden sm:inline">Collaborate</span>
              <span className="sm:hidden">Collab</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="work">
            <JobsPanel />
          </TabsContent>

          <TabsContent value="talent">
            <TalentPanel />
          </TabsContent>

          <TabsContent value="collaborate">
            <CollaboratePanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
