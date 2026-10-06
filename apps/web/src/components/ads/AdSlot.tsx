import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID?.trim();
const adSlotId = import.meta.env.VITE_ADSENSE_SLOT_ID?.trim();
const layoutKey = import.meta.env.VITE_ADSENSE_LAYOUT_KEY?.trim();
const testMode = import.meta.env.VITE_ADSENSE_TEST_MODE === "true";

export const isAdSenseConfigured = Boolean(clientId && adSlotId && layoutKey);

type AdSenseWindow = Window & {
  adsbygoogle?: Array<Record<string, never>>;
};

const pushedSlots = new WeakSet<HTMLElement>();
let scriptLoad: Promise<void> | null = null;

function loadAdSenseScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("AdSense requires a browser"));
  if ((window as AdSenseWindow).adsbygoogle) return Promise.resolve();
  if (scriptLoad) return scriptLoad;

  scriptLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("AdSense script failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.qhAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId ?? "")}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("AdSense script failed to load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptLoad = null;
    throw error;
  });

  return scriptLoad;
}

export function AdSlot({ placementId, canRequestAd = true }: { placementId: string; canRequestAd?: boolean }) {
  const [location] = useLocation();
  const slotRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!isAdSenseConfigured || !canRequestAd || !slot) return;
    if (pushedSlots.has(slot) || slot.hasAttribute("data-adsbygoogle-status")) return;

    pushedSlots.add(slot);
    void loadAdSenseScript().then(() => {
      if (!slot.isConnected || slot.hasAttribute("data-adsbygoogle-status")) return;
      const adsWindow = window as AdSenseWindow;
      (adsWindow.adsbygoogle ??= []).push({});
    }).catch(() => {
      pushedSlots.delete(slot);
    });
  }, [canRequestAd, location, placementId]);

  if (!isAdSenseConfigured) return null;

  return (
    <aside
      aria-label="Sponsored content"
      data-ad-placement={placementId}
      className="bg-card border border-border/60 rounded-2xl p-4 md:p-5 shadow-sm"
    >
      <div className="mb-3 text-[10px] font-semibold uppercase text-muted-foreground">Sponsored</div>
      <ins
        ref={slotRef}
        className="adsbygoogle block min-h-24 w-full"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={adSlotId}
        data-ad-format="fluid"
        data-ad-layout-key={layoutKey}
        data-adtest={testMode ? "on" : undefined}
      />
    </aside>
  );
}