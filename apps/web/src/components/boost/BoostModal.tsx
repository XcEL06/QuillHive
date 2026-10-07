import { useState, useEffect, useCallback } from "react";
import { X, Zap, TrendingUp, Star, Check, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { apiUrl, getStoredToken } from "@/lib/api";

type FlwResult = { status: string; transaction_id: string; tx_ref: string };
interface FlwConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options: string;
  customer: { email: string; name: string };
  customizations: { title: string; description: string; logo?: string };
  callback: (r: FlwResult) => void;
  onclose: () => void;
}

type Plan = {
  key: "starter" | "growth" | "spotlight";
  label: string;
  price: number;
  duration: string;
  icon: typeof Zap;
  color: string;
  border: string;
  features: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    key: "starter",
    label: "Starter Boost",
    price: 5,
    duration: "2 days",
    icon: Zap,
    color: "from-blue-500 to-blue-600",
    border: "border-blue-500/40",
    features: ["3.5× visibility boost", "Featured in feed", "2-day campaign"],
  },
  {
    key: "growth",
    label: "Growth Boost",
    price: 15,
    duration: "7 days",
    icon: TrendingUp,
    color: "from-purple-500 to-purple-600",
    border: "border-purple-500/40",
    features: ["3.5× visibility boost", "Priority placement", "7-day campaign", "Analytics tracking"],
    popular: true,
  },
  {
    key: "spotlight",
    label: "Spotlight",
    price: 30,
    duration: "15 days",
    icon: Star,
    color: "from-amber-500 to-amber-600",
    border: "border-amber-500/40",
    features: ["3.5× visibility boost", "Top-tier placement", "15-day campaign", "Detailed analytics", "Creator badge on post"],
  },
];

type PlanKey = "starter" | "growth" | "spotlight";
type Step = "select" | "processing" | "success" | "error";
type Gateway = "flutterwave" | "stripe";

interface BoostModalProps {
  postId: number;
  postTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
  /** Pre-select a plan when reopening from "Boost Again" */
  defaultPlan?: PlanKey;
}

function pollForFlutterwaveCheckout(resolve: () => void, reject: (err?: unknown) => void, timeout = 6000): void {
  const start = Date.now();
  const check = () => {
    if ((window as Window & { FlutterwaveCheckout?: unknown }).FlutterwaveCheckout) {
      resolve();
    } else if (Date.now() - start > timeout) {
      reject(new Error("Payment provider did not initialize in time"));
    } else {
      setTimeout(check, 80);
    }
  };
  check();
}

function loadFlutterwaveScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as Window & { FlutterwaveCheckout?: unknown }).FlutterwaveCheckout) {
      resolve();
      return;
    }
    const existing = document.getElementById("flw-checkout-script");
    if (existing) {
      pollForFlutterwaveCheckout(resolve, reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "flw-checkout-script";
    s.src = "https://checkout.flutterwave.com/v3.js";
    s.onload = () => pollForFlutterwaveCheckout(resolve, reject);
    s.onerror = () => reject(new Error("Failed to load payment provider"));
    document.head.appendChild(s);
  });
}

export function BoostModal({ postId, postTitle, onClose, onSuccess, defaultPlan }: BoostModalProps) {
  const { user } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(defaultPlan ?? "growth");
  const [step, setStep] = useState<Step>("select");
  const [errorMsg, setErrorMsg] = useState("");
  const [boostEndsAt, setBoostEndsAt] = useState<string>("");
  const [gateway, setGateway] = useState<Gateway>("flutterwave");
  const [availableGateways, setAvailableGateways] = useState<{ flutterwave: boolean; stripe: boolean }>({ flutterwave: true, stripe: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void fetch(apiUrl("/api/boost/payment-methods"), { credentials: "include" })
      .then(res => res.ok ? res.json() as Promise<{ flutterwave?: boolean; stripe?: boolean }> : null)
      .then(data => {
        if (!data) return;
        const configured = { flutterwave: Boolean(data.flutterwave), stripe: Boolean(data.stripe) };
        setAvailableGateways(configured);
        if (!configured.flutterwave && configured.stripe) setGateway("stripe");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (gateway === "flutterwave") void loadFlutterwaveScript().catch(() => {});
  }, [gateway]);

  const verifyPayment = useCallback(async (txRef: string, transactionId: string) => {
    try {
      const token = getStoredToken();
      const res = await fetch(
        apiUrl(`/api/boost/verify-payment?tx_ref=${encodeURIComponent(txRef)}&transaction_id=${encodeURIComponent(transactionId)}`),
        { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await res.json() as { ok?: boolean; boostEndsAt?: string; error?: string };
      if (data.ok) {
        setBoostEndsAt(data.boostEndsAt ?? "");
        setStep("success");
        onSuccess?.();
      } else {
        setErrorMsg(data.error ?? "Payment verification failed.");
        setStep("error");
      }
    } catch {
      setErrorMsg("Network error during verification. Contact support if charged.");
      setStep("error");
    }
  }, [onSuccess]);

  const startPayment = useCallback(async () => {
    if (!user || isSubmitting) return;
    const plan = PLANS.find(p => p.key === selectedPlan)!;
    setIsSubmitting(true);
    setStep("processing");

    try {
      const token = getStoredToken();
      if (gateway === "stripe") {
        const initRes = await fetch(apiUrl("/api/boost/stripe/init-payment"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
          body: JSON.stringify({ postId, plan: selectedPlan }),
        });
        const initData = await initRes.json() as { checkoutUrl?: string; error?: string };
        if (!initRes.ok || !initData.checkoutUrl) {
          setErrorMsg(initData.error ?? "Failed to initialise Stripe checkout.");
          setStep("error");
          return;
        }
        window.location.assign(initData.checkoutUrl);
        return;
      }

      await loadFlutterwaveScript();

      const initRes = await fetch(apiUrl("/api/boost/init-payment"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ postId, plan: selectedPlan }),
      });
      if (initRes.status === 503) {
        setErrorMsg("Boost payments aren't set up yet. Please check back soon.");
        setStep("error");
        return;
      }
      const initData = await initRes.json() as {
        txRef?: string;
        amount?: number;
        currency?: string;
        publicKey?: string;
        error?: string;
      };

      if (!initData.txRef || !initData.publicKey) {
        setErrorMsg(initData.error ?? "Failed to initialise payment.");
        setStep("error");
        return;
      }

      const flwCheckout = (window as Window & { FlutterwaveCheckout?: (c: FlwConfig) => void }).FlutterwaveCheckout;
      if (!flwCheckout) {
        setErrorMsg("Payment SDK not loaded. Please refresh and try again.");
        setStep("error");
        return;
      }

      flwCheckout({
        public_key: initData.publicKey,
        tx_ref: initData.txRef,
        amount: initData.amount ?? plan.price,
        currency: initData.currency ?? "USD",
        payment_options: "card",
        customer: {
          email: user.email ?? "",
          name: user.displayName ?? user.username ?? "Creator",
        },
        customizations: {
          title: "QuillHive Boost",
          description: `${plan.label} for "${postTitle.slice(0, 50)}"`,
          logo: `${window.location.origin}/images/logo-icon-192.png`,
        },
        callback: (data) => {
          if (data.status === "successful") {
            setStep("processing");
            void verifyPayment(data.tx_ref, data.transaction_id);
          } else {
            setErrorMsg("Payment was not completed.");
            setStep("error");
          }
        },
        onclose: () => {
          setStep(prev => prev === "processing" ? "select" : prev);
        },
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to start payment. Please try again.");
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedPlan, postId, postTitle, gateway, verifyPayment, isSubmitting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-[95vw] max-w-lg sm:w-full shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 rounded-lg">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Boost this Post</h2>
              <p className="text-xs text-white/50 line-clamp-1">{postTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="p-5">
          {step === "select" && (
            <>
              <p className="text-sm text-white/60 mb-4">
                Amplify your post reach with a 3.5× visibility multiplier in the discovery feed.
              </p>
              <div className="space-y-3 mb-5">
                {PLANS.map((plan) => {
                  const Icon = plan.icon;
                  const isSelected = selectedPlan === plan.key;
                  return (
                    <button
                      key={plan.key}
                      onClick={() => setSelectedPlan(plan.key)}
                      className={`w-full text-left rounded-xl border p-4 transition-all relative ${
                        isSelected
                          ? `bg-gradient-to-r ${plan.color} bg-opacity-10 ${plan.border} border-2`
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute top-2 right-2 text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-semibold">
                          POPULAR
                        </span>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 bg-gradient-to-br ${plan.color} rounded-lg`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-semibold text-white text-sm">{plan.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-bold">${plan.price}</span>
                          <span className="text-white/40 text-xs ml-1">USD</span>
                        </div>
                      </div>
                      <div className="text-xs text-white/50 mb-2">{plan.duration}</div>
                      <div className="flex flex-wrap gap-1">
                        {plan.features.map((f) => (
                          <span key={f} className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                            {f}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              {(availableGateways.flutterwave || availableGateways.stripe) && (
                <div className="mb-5">
                  <p className="text-xs text-white/50 mb-2">Payment method</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableGateways.flutterwave && (
                      <button
                        type="button"
                        onClick={() => setGateway("flutterwave")}
                        className={`rounded-lg border px-3 py-2 text-sm ${gateway === "flutterwave" ? "border-amber-400 bg-amber-400/10 text-white" : "border-white/10 text-white/60"}`}
                      >
                        Pay with Flutterwave
                      </button>
                    )}
                    {availableGateways.stripe && (
                      <button
                        type="button"
                        onClick={() => setGateway("stripe")}
                        className={`rounded-lg border px-3 py-2 text-sm ${gateway === "stripe" ? "border-amber-400 bg-amber-400/10 text-white" : "border-white/10 text-white/60"}`}
                      >
                        Pay with Card (Stripe)
                      </button>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={() => void startPayment()}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isSubmitting ? "Starting payment..." : `Pay $${PLANS.find(p => p.key === selectedPlan)?.price} · Boost Now`}
              </button>
              <p className="text-center text-xs text-white/30 mt-3">
                Secured by {gateway === "stripe" ? "Stripe" : "Flutterwave"} · Instant activation · Cancel anytime
              </p>
            </>
          )}

          {step === "processing" && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
              <p className="text-white/70 text-sm">Processing your payment…</p>
            </div>
          )}

          {step === "success" && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-white font-bold text-lg">Your boost is live! 🚀</h3>
              <p className="text-white/60 text-sm max-w-xs">
                Your post is now receiving a 3.5× visibility boost. A receipt has been sent to your email.
              </p>
              {boostEndsAt && (
                <p className="text-xs text-white/40">
                  Campaign ends: {new Date(boostEndsAt).toLocaleDateString()}
                </p>
              )}
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium"
              >
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-white font-bold">Something went wrong</h3>
              <p className="text-white/60 text-sm max-w-xs">{errorMsg}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setStep("select")}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-white/50 hover:text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
