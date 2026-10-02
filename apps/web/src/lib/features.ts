import { useQuery } from "@tanstack/react-query";

export type FeatureFlags = Record<string, boolean>;

export function useFeatureFlags(): FeatureFlags {
  const { data } = useQuery<FeatureFlags>({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/features");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  return data ?? {};
}

export function useFeature(flag: string): boolean {
  const flags = useFeatureFlags();
  // Missing flags should keep normal features available, but maintenance is
  // an explicit opt-in switch and must never default to taking the app down.
  return flags[flag] ?? (flag === "maintenance_mode" || flag === "ai_tools_enabled" ? false : true);
}
