import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertCircle, MailCheck } from "lucide-react";
import { setStoredRefreshToken, setStoredToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function VerifyEmailPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>(t("auth.verifying", "Verifying your email..."));
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const currentVerificationUrl = typeof window !== "undefined" ? window.location.href : "";

  const resendVerification = async () => {
    if (!resendEmail || !resendEmail.includes("@")) return;
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("auth.resendVerificationFailed", "Could not resend verification email"));
      setMessage(data?.message || t("auth.verificationEmailResent", "Verification email sent."));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("auth.resendVerificationFailed", "Could not resend verification email"));
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage(t("auth.missingVerifyToken", "Missing verification token."));
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("auth.verifyFailed", "Verification failed"));
        setStoredToken(data.token);
        if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
        setAuth(data.user, data.token);
        setStatus("success");
        setMessage(t("auth.verifySuccess", "Your email is verified. Redirecting..."));
        setTimeout(() => setLocation("/"), 1500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("auth.verifyFailed", "Verification failed");
        setStatus("error");
        setMessage(msg);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {status === "loading" && <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />}
          {status === "success" && <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />}
          {status === "error" && <AlertCircle className="w-12 h-12 mx-auto text-destructive" />}
          <h1 className="text-2xl font-serif font-bold flex items-center justify-center gap-2">
            <MailCheck className="w-5 h-5" /> {t("auth.emailVerification", "Email verification")}
          </h1>
          <p className="text-muted-foreground">{message}</p>
          {currentVerificationUrl && (
            <p className="text-[11px] text-muted-foreground break-all bg-muted/40 rounded-lg p-2">
              Verification link: <a href={currentVerificationUrl} className="underline break-all">{currentVerificationUrl}</a>
            </p>
          )}
          {status === "error" && (
            <>
              <Input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder={t("auth.email", "Email")}
                aria-label={t("auth.email", "Email")}
              />
              <Button
                onClick={resendVerification}
                disabled={resendLoading || !resendEmail.includes("@")}
                className="rounded-xl w-full"
              >
                {resendLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t("auth.resendVerification", "Resend verification email")}
              </Button>
              <Button onClick={() => setLocation("/login")} variant="ghost" className="rounded-xl" data-testid="button-back">
                {t("auth.backToSignIn", "Back to sign in")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
