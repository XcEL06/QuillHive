import { brandName, privacyEmail } from "@/lib/contact";
import { useT } from "@/lib/i18n";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { BackButton } from "@/components/ui/BackButton";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  readCookieConsent,
  saveCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";
import { Button } from "@/components/ui/button";

export function Privacy() {
  const brand = brandName();
  const email = privacyEmail();
  const t = useT();
  const [cookieConsent, setCookieConsent] = useState<CookieConsentValue | null>(null);

  useEffect(() => {
    const syncConsent = () => setCookieConsent(readCookieConsent());
    syncConsent();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, syncConsent);
    window.addEventListener("storage", syncConsent);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, []);

  const updateCookieConsent = (value: CookieConsentValue) => {
    saveCookieConsent(value);
    setCookieConsent(readCookieConsent());
  };

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <BackButton />
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t("legal.privacy.title", "Privacy Policy")}</h1>
          <p className="text-muted-foreground text-sm">Last updated October 2026 · Platform: {brand}</p>
        </div>

        <div className="space-y-10 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">1. What We Collect</h2>
            <p className="mb-3 leading-relaxed">When you use {brand}, we collect:</p>
            <ul className="list-disc pl-6 space-y-2 leading-relaxed">
              <li><strong>Account information:</strong> email address, username, display name, and profile details you provide.</li>
              <li><strong>Content:</strong> posts, sparks, stories, comments, messages, and other content you create.</li>
              <li><strong>Usage data:</strong> page views, clicks, session duration, features used, and interaction patterns.</li>
              <li><strong>Device data:</strong> IP address, browser type, operating system, device type.</li>
              <li><strong>Payment data:</strong> transaction references, amounts, and payment status (we do not store full card details - payments are processed by Flutterwave).</li>
              <li><strong>Communications:</strong> support tickets, report submissions, and feedback you send us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2 leading-relaxed">
              <li>To operate, maintain, and improve the {brand} platform.</li>
              <li>To display your creator profile and content to other users according to your privacy settings.</li>
              <li>To personalise your feed, recommendations, and opportunity discovery.</li>
              <li>To send service communications including account activity, security alerts, and support responses.</li>
              <li>To process payments for Boost, Spotlight, and Featured Placement services.</li>
              <li>To detect, prevent, and respond to fraud, abuse, spam, and platform policy violations.</li>
              <li>To generate anonymised analytics about platform usage and creator growth.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">3. Creator Profile Visibility</h2>
            <p className="mb-3 leading-relaxed">
              {brand} is designed to make creators discoverable. By default, your profile, posts, and public activity are visible to other users and may be indexed by search engines.
            </p>
            <p className="leading-relaxed">
              You can control profile visibility through Settings → Privacy. You may set your profile to private, restrict recruiter visibility, hide activity history, or lock your profile from public view. Note: platform administrators and moderators retain access to all accounts for security and moderation purposes, regardless of privacy settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">4. Data Sharing</h2>
            <p className="mb-3 leading-relaxed">We do not sell your personal data. We may share data with:</p>
            <ul className="list-disc pl-6 space-y-2 leading-relaxed">
              <li><strong>Service providers:</strong> Flutterwave (payments), Cloudinary (media), Resend (email), Upstash (caching), and Google AdSense for consented native ads when advertising is enabled.</li>
              <li><strong>Legal authorities:</strong> where required by law, court order, or to protect platform safety.</li>
              <li><strong>Business transfers:</strong> in the event of a merger, acquisition, or platform transfer.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">5. Cookies & Tracking</h2>
            <p className="leading-relaxed">
              We use cookies and similar technologies for authentication, session management, preference storage, and analytics. If site advertising is enabled and you accept optional cookies, Google AdSense may process data and use cookies or similar technologies to serve native ads in the Explore feed. Choosing essential-only cookies disables AdSense requests. Essential cookies cannot be disabled as they are required for the platform to function.
            </p>
            <p className="mt-3 leading-relaxed">
              Current optional cookie preference: <strong>{cookieConsent === "accepted" ? "accepted" : cookieConsent === "essential" ? "essential only" : "not set"}</strong>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => updateCookieConsent("accepted")}>Accept optional cookies and ads</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => updateCookieConsent("essential")}>Essential only</Button>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">6. Data Retention</h2>
            <p className="leading-relaxed">
              We retain your account data for as long as your account is active. After account deletion, personal data is removed within 30 days, except where retention is required by law or for fraud prevention. Content you published may be retained in anonymised or aggregated form. Payment records are retained for 7 years for compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">7. Your Rights</h2>
            <p className="mb-3 leading-relaxed">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 leading-relaxed">
              <li>Access, correct, or update your personal data through Settings.</li>
              <li>Request deletion of your account and personal data.</li>
              <li>Withdraw consent where processing is based on consent.</li>
              <li>Lodge a complaint with a data protection authority.</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              To exercise your rights, contact us at <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">8. Security</h2>
            <p className="leading-relaxed">
              We implement industry-standard security measures including encrypted connections (HTTPS), secure session management, rate limiting, and bot protection. Despite these measures, no internet service is completely secure. Please use a strong, unique password and enable account security features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">9. Children</h2>
            <p className="leading-relaxed">
              {brand} is not directed at children under 16. We do not knowingly collect data from users under 16. If we become aware of such collection, we will delete the account promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">10. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. Material changes will be communicated via the platform or email. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground">11. Contact</h2>
            <p className="leading-relaxed">
              Privacy enquiries: <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/content-policy" className="hover:text-foreground transition-colors">Content Policy</Link>
          <Link href="/community-guidelines" className="hover:text-foreground transition-colors">Community Guidelines</Link>
          <Link href="/copyright" className="hover:text-foreground transition-colors">Copyright Policy</Link>
        </div>
      </div>
    </PublicLayout>
  );
}
