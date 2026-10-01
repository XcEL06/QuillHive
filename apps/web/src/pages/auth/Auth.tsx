import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { apiUrl, getStoredToken, setStoredRefreshToken, setStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Eye, EyeOff, PenTool, ShieldAlert, Mail, Chrome } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, useT, SUPPORTED_LANGS } from "@/lib/i18n";

const MAGIC_LINK_COOLDOWN_S = 60;

function friendlyError(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes("too many") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("please wait a moment")
  ) {
    return "Please wait a moment before trying again.";
  }
  return msg;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(() => {
    if (typeof window === "undefined") return true;
    const mode = new URLSearchParams(window.location.search).get("mode");
    return window.location.pathname !== "/signup" && mode !== "signup" && mode !== "register";
  });
  const [, setLocation] = useLocation();
  const { setAuth, user, refreshUser } = useAuthStore();
  const [inviteCode, setInviteCode] = useState("");
  const [refSource, setRefSource] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"checking" | "valid" | "invalid" | "unavailable" | null>(null);

  // Guards: prevent StrictMode double-fire of one-shot effects
  const oauthHandled = useRef(false);
  const magicConsumed = useRef(false);
  // Guard: prevent double form submission
  const submitting = useRef(false);

  useEffect(() => {
    if (user) {
      setLocation("/");
      return;
    }
    if (!getStoredToken()) return;
    void refreshUser().then(() => {
      if (useAuthStore.getState().user) setLocation("/");
    });
  }, [user, refreshUser, setLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inv = (params.get("invite") || "").trim().toUpperCase();
    const ref = (params.get("ref") || "").trim().slice(0, 80);
    if (inv) {
      setInviteCode(inv);
      setIsLogin(false);
      setInviteStatus("checking");
      fetch(apiUrl(`/api/invites/validate/${encodeURIComponent(inv)}`))
        .then(async response => {
          if (!response.ok) throw new Error("Invite validation failed");
          return response.json() as Promise<{ valid?: boolean }>;
        })
        .then(result => setInviteStatus(result.valid ? "valid" : "invalid"))
        .catch(() => setInviteStatus("unavailable"));
    }
    if (ref) setRefSource(ref);
    if (window.location.pathname === "/signup" || params.get("mode") === "signup" || params.get("mode") === "register") setIsLogin(false);
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [magicCooldown, setMagicCooldown] = useState(0);
  const [resendVerificationLoading, setResendVerificationLoading] = useState(false);

  // Countdown timer for magic link resend
  useEffect(() => {
    if (magicCooldown <= 0) return;
    const id = window.setTimeout(() => setMagicCooldown(c => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [magicCooldown]);

  // One-shot: handle OAuth callback (/auth/oauth-complete)
  // One-shot: handle magic link consumption (/auth/magic)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      const messages: Record<string, string> = {
        provider_not_configured: `${url.searchParams.get("provider") === "github" ? "GitHub" : "OAuth provider"} sign-in is not configured. Contact the site administrator.`,
        oauth_cancelled: "GitHub sign-in was cancelled.",
        oauth_failed: "GitHub sign-in could not be completed. Please try again.",
        no_email: "GitHub did not provide a verified email address. Add a verified email to your GitHub account and try again.",
        oauth_error: "GitHub sign-in failed. Please try again.",
      };
      toast.error(messages[oauthError] || "Sign-in failed. Please try again.");
      url.searchParams.delete("error");
      url.searchParams.delete("provider");
      window.history.replaceState({}, "", url.toString());
    }

    if (url.pathname === "/auth/oauth-complete") {
      if (oauthHandled.current) return;
      oauthHandled.current = true;
      const tok = url.searchParams.get("token");
      const ref = url.searchParams.get("refreshToken");
      if (tok) {
        setStoredToken(tok);
        if (ref) setStoredRefreshToken(ref);
        fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${tok}` } })
          .then((r) => r.ok ? r.json() : null)
          .then((u) => {
            if (u) { setAuth(u, tok); setLocation("/"); }
            else { toast.error("Sign-in failed. Please try again."); }
          })
          .catch(() => toast.error("Sign-in failed. Please try again."));
      }
      return;
    }

    if (url.pathname === "/auth/magic") {
      if (magicConsumed.current) return;
      magicConsumed.current = true;
      const token = url.searchParams.get("token");
      if (!token) { toast.error("Missing sign-in token."); return; }
      (async () => {
        try {
          const res = await fetch(apiUrl("/api/auth/magic-link/consume"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || t("auth.invalidLink", "Invalid or expired link"));
          storeAuth(data);
          toast.success(t("auth.signedIn", "Signed in successfully!"));
          setLocation("/");
        } catch (err: any) {
          toast.error(friendlyError(err?.message || t("auth.magicLinkFailed", "Magic link failed")));
        }
      })();
    }
  }, [setLocation, setAuth]);

  const sendMagicLink = async () => {
    if (!email || !email.includes("@")) {
      toast.error(t("auth.enterEmailFirst", "Enter your email first"));
      return;
    }
    if (magicCooldown > 0) return;

    setMagicLinkLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/magic-link/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("auth.couldNotSendLink", "Could not send link"));
      setMagicLinkSent(true);
      setMagicCooldown(MAGIC_LINK_COOLDOWN_S);
      if (data?.devLink) setDevMagicLink(data.devLink);
      toast.success(t("auth.checkInbox", "Check your inbox for a sign-in link"));
    } catch (err: any) {
      toast.error(friendlyError(err?.message || t("auth.couldNotSendLink", "Could not send link")));
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const startOAuth = (provider: "google") => {
    window.location.href = apiUrl(`/api/auth/oauth/${provider}/start`);
  };

  const [verificationToken, setVerificationToken] = useState("");
  const [pendingVerificationToken, setPendingVerificationToken] = useState("");
  const { lang, setLang } = useI18n();
  const t = useT();

  useEffect(() => {
    if (isLogin || !email || !email.includes("@")) {
      setEmailStatus(null);
      return;
    }
    const timeout = window.setTimeout(async () => {
      setIsCheckingEmail(true);
      try {
        const res = await fetch(apiUrl(`/api/email/check?email=${encodeURIComponent(email)}`));
        const data = await res.json();
        setEmailStatus({ allowed: Boolean(data.allowed), reason: data.reason });
      } catch {
        setEmailStatus({ allowed: true, reason: t("auth.emailCheckUnavailable", "Email check temporarily unavailable.") });
      } finally {
        setIsCheckingEmail(false);
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [email, isLogin]);

  const storeAuth = (data: any) => {
    setStoredToken(data.token);
    if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
    setAuth(data.user, data.token);
  };

  const verifyEmail = async (token: string) => {
    const res = await fetch(apiUrl("/api/auth/verify-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("auth.emailVerificationFailed", "Email verification failed"));
    storeAuth(data);
    toast.success(t("auth.emailVerifiedWelcome", "Email verified. Welcome to QuillHive!"));
    setLocation("/");
  };

  const resendVerification = async () => {
    if (!email || !email.includes("@")) {
      toast.error(t("auth.enterEmailFirst", "Enter your email first"));
      return;
    }
    setResendVerificationLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("auth.resendVerificationFailed", "Could not resend verification email"));
      toast.success(data?.message || t("auth.verificationEmailResent", "Verification email sent."));
    } catch (err: any) {
      toast.error(friendlyError(err?.message || t("auth.resendVerificationFailed", "Could not resend verification email")));
    } finally {
      setResendVerificationLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent double-submission (race condition protection)
    if (submitting.current || isLoading) return;
    submitting.current = true;
    setIsLoading(true);

    try {
      if (isLogin) {
        const res = await fetch(apiUrl("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `Something went wrong (status ${res.status}). Please try again.` };
        }
        if (!res.ok) throw new Error(data.error || t("auth.loginFailed", "Login failed"));
        storeAuth(data);
        toast.success(t("auth.welcomeBackToast", "Welcome back!"));
        setLocation("/");
      } else {
        if (password !== confirmPassword) {
          toast.error(t("auth.passwordsNoMatch", "Passwords don't match"));
          return;
        }
        if (password.length < 8) {
          toast.error(t("auth.passwordMin", "Password must be at least 8 characters"));
          return;
        }
        if (emailStatus && !emailStatus.allowed) {
          toast.error(emailStatus.reason || t("auth.useDifferentEmail", "Please use a different email address"));
          return;
        }
        const turnstileToken = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value ?? "";
        const res = await fetch(apiUrl("/api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            username: username.toLowerCase().trim(),
            displayName: name.trim(),
            inviteCode: inviteCode || undefined,
            ref: refSource || undefined,
            turnstileToken,
          }),
        });
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `Something went wrong (status ${res.status}). Please try again.` };
        }
        if (!res.ok) throw new Error(data.error || t("auth.registrationFailed", "Registration failed"));
        const inviteNotApplied = Boolean(inviteCode && data.inviteApplied === false);
        if (data.verificationRequired) {
          setPendingVerificationToken(data.verificationToken || "");
          setVerificationToken(data.verificationToken || "");
          if (inviteNotApplied) toast.error("Account created, but this invite could not be applied. Ask for a current invite link.");
          else toast.success(t("auth.accountCreatedVerify", "Account created. Verify your email to activate sign in."));
        } else {
          storeAuth(data);
          if (inviteNotApplied) toast.error("Account created, but this invite could not be applied. Ask for a current invite link.");
          else toast.success(t("auth.welcomeToQuillhive", "Welcome to QuillHive!"));
          setLocation("/onboarding");
        }
      }
    } catch (err: any) {
      toast.error(friendlyError(err?.message || t("auth.somethingWentWrong", "Something went wrong")));
    } finally {
      setIsLoading(false);
      submitting.current = false;
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      <Toaster position="top-center" />

      {/* Visual Side */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 opacity-20">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-white/30 font-serif text-6xl select-none"
              style={{
                left: `${(i * 17) % 90}%`,
                top: `${(i * 23) % 85}%`,
                transform: `rotate(${(i * 37) % 60 - 30}deg)`,
                opacity: 0.1 + (i % 5) * 0.05,
              }}
            >
              {["✍", "📖", "🎨", "✨", "🖊"][i % 5]}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-violet-950/80 via-transparent to-transparent" />
        <div className="absolute bottom-16 left-16 max-w-lg z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <PenTool className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-serif font-bold text-white tracking-tight">QuillHive</h1>
          </div>
          <p className="text-sm text-muted-foreground text-center italic">
            "Your work is your proof. Your hive is where it gets discovered."
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Build a visible creative track record and get found for real paid opportunities.
          </p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <PenTool className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif font-bold text-xl text-primary">QuillHive</span>
        </div>

        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex justify-end mb-4">
              <Select value={lang} onValueChange={(v) => setLang(v)}>
                <SelectTrigger aria-label="Choose language" className="w-44 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGS.map(l => (
                    <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <h2 className="text-3xl font-serif font-bold text-foreground mb-2">
              {isLogin ? t("auth.welcomeBack", "Welcome back") : t("auth.createAccount", "Create your account")}
            </h2>
            <p className="text-muted-foreground mb-8">
              {isLogin
                ? t("auth.signInTagline", "Sign in to your creator growth space.")
                : t("auth.signUpTagline", "Join creators who grow, get discovered, and earn on QuillHive.")}
            </p>

            <Card className="border-border/50 shadow-xl shadow-black/5 rounded-3xl overflow-hidden">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (inviteCode || refSource) && (
                    <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                      {inviteCode ? (
                        <><strong>Invite {inviteCode}</strong>: {inviteStatus === "checking" ? "checking this link…" :
                          inviteStatus === "valid" ? "verified; this referral will be applied when you create your account." :
                          inviteStatus === "invalid" ? "invalid, expired, or already used. You can still create an account without it." :
                          "could not be verified right now; it will be checked again when you create your account."}</>
                      ) : "Referral source detected. It will be saved when you create your account."}
                    </p>
                  )}
                  {!isLogin && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="name">{t("auth.displayName", "Full Name")}</Label>
                        <Input
                          id="name" placeholder="Jane Austen" required
                          value={name} onChange={e => setName(e.target.value)}
                          className="rounded-xl h-12 bg-muted/30"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">{t("auth.username", "Username")}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                          <Input
                            id="username" autoComplete="username" placeholder="janeausten" required
                            value={username} onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, ""))}
                            className="rounded-xl h-12 bg-muted/30 pl-7"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">{t("auth.email", "Email")}</Label>
                    <Input
                      id="email" type="email" autoComplete="email" placeholder="name@example.com" required
                      value={email} onChange={e => setEmail(e.target.value)}
                      className="rounded-xl h-12 bg-muted/30"
                      disabled={isLoading}
                    />
                    {!isLogin && (isCheckingEmail || emailStatus) && (
                      <div className={`flex items-center gap-2 text-xs ${emailStatus?.allowed ? "text-emerald-600" : "text-destructive"}`} role="status" aria-live="polite">
                        {isCheckingEmail
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : emailStatus?.allowed
                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                            : <ShieldAlert className="w-3.5 h-3.5" />}
                        <span>
                          {isCheckingEmail
                            ? "Checking email..."
                            : emailStatus?.allowed
                              ? emailStatus.reason || "Email looks good."
                              : emailStatus?.reason || "This email cannot be used."}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t("auth.password", "Password")}</Label>
                      {isLogin && (
                        <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                          {t("auth.forgotPassword", "Forgot password?")}
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} required
                        minLength={isLogin ? undefined : 8}
                        value={password} onChange={e => setPassword(e.target.value)}
                        className="rounded-xl h-12 bg-muted/30 pr-11"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">{t("auth.confirmPassword", "Confirm Password")}</Label>
                      <Input
                        id="confirmPassword" type="password" autoComplete="new-password" required minLength={8}
                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        className="rounded-xl h-12 bg-muted/30"
                        disabled={isLoading}
                      />
                    </div>
                  )}

                  {!isLogin && (
                    <div className="space-y-2.5 pt-1">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0"
                          checked={termsAccepted}
                          onChange={e => setTermsAccepted(e.target.checked)}
                        />
                        <span className="text-sm text-foreground leading-snug">
                          I agree to the{" "}
                          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                          {" "}and{" "}
                          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                        </span>
                      </label>
                    </div>
                  )}

                  {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
                    <div
                      className="cf-turnstile"
                      data-sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                      data-theme="auto"
                    />
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || (!isLogin && !termsAccepted)}
                    className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-violet-500 hover:-translate-y-0.5 shadow-lg shadow-primary/25 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading
                      ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />{isLogin ? "Signing in…" : "Creating account…"}</>
                      : isLogin ? t("auth.login", "Sign In") : t("auth.register", "Create Account")
                    }
                  </Button>

                  {!isLogin && pendingVerificationToken && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <p className="text-sm font-medium">{t("auth.verifyYourEmail", "Verify your email")}</p>
                      <p className="text-xs text-muted-foreground">{t("auth.verificationRequired", "A verification link was sent to your email. Paste the token below to activate your account.")}</p>
                      <Input
                        value={verificationToken}
                        onChange={e => setVerificationToken(e.target.value)}
                        className="rounded-xl"
                        aria-label={t("auth.emailVerificationToken", "Email verification token")}
                      />
                      <Button
                        type="button" variant="secondary" className="w-full rounded-xl"
                        disabled={isLoading}
                        onClick={async () => {
                          setIsLoading(true);
                          try { await verifyEmail(verificationToken); }
                          catch (err: any) { toast.error(friendlyError(err?.message || t("auth.verificationFailed", "Verification failed"))); }
                          finally { setIsLoading(false); }
                        }}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("auth.verifyEmail", "Verify Email")}
                      </Button>
                      <Button
                        type="button" variant="ghost" className="w-full rounded-xl"
                        disabled={resendVerificationLoading}
                        onClick={resendVerification}
                      >
                        {resendVerificationLoading
                          ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          : null}
                        {t("auth.resendVerification", "Resend verification email")}
                      </Button>
                    </div>
                  )}
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wide">
                    <span className="bg-background px-3 text-muted-foreground">{t("auth.or", "or")}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Magic link */}
                  <Button
                    type="button" variant="outline"
                    className="w-full h-11 rounded-xl gap-2 font-medium"
                    onClick={sendMagicLink}
                    disabled={magicLinkLoading || magicCooldown > 0}
                    data-testid="btn-magic-link"
                  >
                    {magicLinkLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Mail className="w-4 h-4" />}
                    {magicLinkLoading
                      ? "Sending…"
                      : magicCooldown > 0
                        ? `Resend in ${magicCooldown}s`
                        : magicLinkSent
                          ? t("auth.magicLinkResend", "Resend sign-in link")
                          : t("auth.magicLink", "Email me a sign-in link")}
                  </Button>

                  {magicLinkSent && magicCooldown <= 0 && (
                    <p className="text-xs text-center text-muted-foreground">
                      Didn't receive it? Check your spam folder or request another link above.
                    </p>
                  )}

                  {devMagicLink && (
                    <p className="text-[11px] text-muted-foreground break-all bg-muted/40 rounded-lg p-2">
                      Dev link: <a href={devMagicLink} className="underline">{devMagicLink}</a>
                    </p>
                  )}

                  {/* Google OAuth */}
                  <div>
                    <Button
                      type="button" variant="outline" className="h-11 w-full rounded-xl gap-2"
                      onClick={() => startOAuth("google")}
                      data-testid="btn-oauth-google"
                    >
                      <Chrome className="w-4 h-4" /> {t("auth.google", "Continue with Google")}
                    </Button>
                  </div>

                  {/* GitHub OAuth */}
                  <div>
                    <a
                      href={apiUrl("/api/auth/oauth/github/start")}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5
                        rounded-xl border border-border bg-card hover:bg-muted transition-colors
                        text-sm font-medium text-foreground"
                      data-testid="btn-oauth-github"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" aria-hidden="true">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255
                          .825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345
                          -.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23
                          1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335
                          -5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315
                          3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23
                          .66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625
                          -5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225
                          .69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      {t("auth.continueWithGithub", "Continue with GitHub")}
                    </a>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    {t("auth.passkeyHint", "Passkey sign-in is available in Settings → Security after you sign in once.")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                {isLogin ? t("auth.noAccount", "Don't have an account?") : t("auth.hasAccount", "Already have an account?")}{" "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="font-semibold text-primary hover:underline"
                >
                  {isLogin ? t("auth.signUp", "Sign up") : t("auth.signIn", "Sign in")}
                </button>
              </p>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-6">
              {t("auth.termsPrefix", "By continuing, you agree to our")}{" "}
              <Link href="/terms" className="underline hover:text-foreground">{t("auth.termsLink", "Terms of Service")}</Link>
              {" "}{t("auth.termsAnd", "and")}{" "}
              <Link href="/privacy" className="underline hover:text-foreground">{t("auth.privacyLink", "Privacy Policy")}</Link>.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
