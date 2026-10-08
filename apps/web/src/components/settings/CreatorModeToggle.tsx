import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getStoredToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { Sparkles } from "lucide-react";

export function CreatorModeToggle() {
  const { user, setUser } = useAuthStore();
  const token = getStoredToken();
  const { toast } = useToast();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const isCreatorMode = !!(user as any)?.isCreatorMode;

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me/creator-mode", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isCreatorMode: !isCreatorMode }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser({ ...(user as any), isCreatorMode: data.isCreatorMode });
      toast({
        title: data.isCreatorMode
          ? t("settings.creatorModeOn", "Creator Mode is ON")
          : t("settings.creatorModeOff", "Creator Mode is OFF"),
        description: data.isCreatorMode
          ? t("settings.creatorModeDesc", "Switch to a creator-focused layout with portfolio, analytics, and opportunities.")
          : "",
      });
    } catch {
      toast({ title: "Error", description: "Could not update creator mode.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
        <Sparkles className="w-5 h-5 text-violet-500" />
      </div>
      <div className="flex-1 min-w-0">
        <Label className="font-semibold text-base cursor-pointer" htmlFor="creator-mode-switch">
          {t("settings.creatorMode", "Creator Mode")}
        </Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("settings.creatorModeDesc", "Switch to a creator-focused layout with portfolio, analytics, and opportunities.")}
        </p>
      </div>
      <Switch
        id="creator-mode-switch"
        checked={isCreatorMode}
        onCheckedChange={toggle}
        disabled={loading}
        className="shrink-0 mt-0.5"
      />
    </div>
  );
}
