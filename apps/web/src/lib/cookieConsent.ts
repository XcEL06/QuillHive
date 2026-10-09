export const COOKIE_CONSENT_STORAGE_KEY = "qh_cookie_consent_v2";
export const COOKIE_CONSENT_CHANGE_EVENT = "qh-cookie-consent-change";

export type CookieConsentValue = "accepted" | "essential";

export function readCookieConsent(): CookieConsentValue | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return value === "accepted" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}

export function saveCookieConsent(value: CookieConsentValue): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
    localStorage.setItem(`${COOKIE_CONSENT_STORAGE_KEY}_at`, new Date().toISOString());
  } catch {
    // Advertising remains disabled if consent cannot be persisted.
  }

  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}
