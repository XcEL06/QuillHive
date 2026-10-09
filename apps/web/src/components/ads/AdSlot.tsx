import { useEffect, useRef, useState } from "react";
import { COOKIE_CONSENT_CHANGE_EVENT, readCookieConsent } from "@/lib/cookieConsent";

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
const SCRIPT_URL = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

function loadAdSenseScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("AdSense requires a browser"));
  if (scriptLoad) return scriptLoad;

  scriptLoad = new Promise<void>((resolve, reject) => {
    const adsWindow = window as AdSenseWindow;
    let script = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_URL}"]`);
    if (!script && adsWindow.adsbygoogle) {
      resolve();
      return;
    }

    let timeoutId: number | undefined;
    const cleanup = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
    const onLoad = () => {
      if (script?.dataset.qhAdsense === "true") {
        script.dataset.qhAdsenseLoaded = "true";
      }
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("AdSense script failed to load"));
    };

    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.qhAdsense = "true";
      script.src = `${SCRIPT_URL}?client=${encodeURIComponent(clientId ?? "")}`;
    }

    if (
      adsWindow.adsbygoogle &&
      (script.dataset.qhAdsenseLoaded === "true" || script.dataset.qhAdsense !== "true")
    ) {
      resolve();
      return;
    }

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    timeoutId = window.setTimeout(onError, 15_000);
    if (!script.isConnected) document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptLoad = null;
    throw error;
  });

  return scriptLoad;
}

export function AdSlot({ placementId }: { placementId: string }) {
  const [hasConsent, setHasConsent] = useState(false);
  const [failed, setFailed] = useState(false);
  const slotRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    const syncConsent = () => setHasConsent(readCookieConsent() === "accepted");
    syncConsent();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, syncConsent);
    window.addEventListener("storage", syncConsent);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, []);

  useEffect(() => {
    const slot = slotRef.current;
    if (!isAdSenseConfigured || !hasConsent || !slot) return;
    if (pushedSlots.has(slot) || slot.hasAttribute("data-adsbygoogle-status")) return;

    setFailed(false);
    let active = true;
    const collapseIfUnfilled = () => {
      if (slot.getAttribute("data-ad-status") === "unfilled") {
        setFailed(true);
      }
    };
    const observer = new MutationObserver(collapseIfUnfilled);
    observer.observe(slot, { attributes: true, attributeFilter: ["data-ad-status"] });
    const timeoutId = window.setTimeout(() => {
      if (active && slot.getAttribute("data-ad-status") !== "filled") setFailed(true);
    }, 15_000);

    void loadAdSenseScript().then(() => {
      if (!active || !slot.isConnected || pushedSlots.has(slot) || slot.hasAttribute("data-adsbygoogle-status")) return;
      const adsWindow = window as AdSenseWindow;
      const queue = (adsWindow.adsbygoogle ??= []);
      pushedSlots.add(slot);
      try {
        queue.push({});
      } catch (error) {
        pushedSlots.delete(slot);
        throw error;
      }
    }).catch((error: unknown) => {
      if (active) {
        console.warn("[ads] Could not initialize AdSense placement.", error);
        setFailed(true);
      }
    });
    return () => {
      active = false;
      observer.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, [hasConsent, placementId]);

  if (!isAdSenseConfigured || !hasConsent || failed) return null;

  return (
    <aside
      aria-label="Sponsored content"
      data-ad-placement={placementId}
      className="w-full min-w-0 overflow-hidden bg-card border border-border/60 rounded-2xl p-4 md:p-5 shadow-sm"
    >
      <div className="mb-3 text-[10px] font-semibold uppercase text-muted-foreground">Sponsored</div>
      <ins
        ref={slotRef}
        className="adsbygoogle block w-full"
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