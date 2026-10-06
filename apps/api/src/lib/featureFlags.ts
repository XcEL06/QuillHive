import { db } from "@workspace/db";
import { systemSettingsTable } from "@workspace/db/schema";

export const FEATURE_FLAG_KEYS = [
  "registration_open",
  "maintenance_mode",
  "post_creation_enabled",
  "quick_posts_enabled",
  "ai_tools_enabled",
  "polls_enabled",
  "motion_enabled",
  "chains_enabled",
  "series_enabled",
  "highlights_enabled",
  "gallery_enabled",
  "embed_enabled",
  "ab_testing_enabled",
  "collections_enabled",
  "income_tracker_enabled",
  "service_checkout_enabled",
  "magic_link_enabled",
  "passkey_enabled",
  "tipping_enabled",
  "subscriptions_enabled",
  "podcast_enabled",
  "referral_rewards_enabled",
  "identity_verification_enabled",
  "phone_verification_enabled",
  "ads_enabled",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

const DEFAULT_FLAGS: Partial<Record<string, boolean>> = {
  // Maintenance is an explicit opt-in state. A missing setting must not
  // take the public app offline.
  maintenance_mode:   false,
  ai_tools_enabled:       false,
  motion_enabled:          false,
  chains_enabled:          false,
  series_enabled:          false,
  highlights_enabled:      false,
  gallery_enabled:         false,
  embed_enabled:           false,
  ab_testing_enabled:      false,
  magic_link_enabled:      false,
  passkey_enabled:         false,
  income_tracker_enabled:  false,
  service_checkout_enabled: false,
  collections_enabled:     false,
  tipping_enabled:         false,
  subscriptions_enabled:   false,
  podcast_enabled:         false,
  referral_rewards_enabled: false,
  identity_verification_enabled: false,
  phone_verification_enabled: false,
  ads_enabled: false,
};

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export async function reloadFeatureFlags(): Promise<void> {
  const rows = await db.select().from(systemSettingsTable);
  cache.clear();
  const expiresAt = Date.now() + TTL_MS;
  for (const row of rows) {
    if ((FEATURE_FLAG_KEYS as readonly string[]).includes(row.key)) {
      cache.set(row.key, { value: row.value === "true", expiresAt });
    }
  }
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const rows = await db.select().from(systemSettingsTable);
  const expiresAt = Date.now() + TTL_MS;

  for (const row of rows) {
    if ((FEATURE_FLAG_KEYS as readonly string[]).includes(row.key)) {
      cache.set(row.key, { value: row.value === "true", expiresAt });
    }
  }

  if (!cache.has(key)) {
    const defaultVal = DEFAULT_FLAGS[key] ?? true;
    cache.set(key, { value: defaultVal, expiresAt });
  }

  return cache.get(key)?.value ?? (DEFAULT_FLAGS[key] ?? true);
}

export async function getAllFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const rows = await db.select().from(systemSettingsTable);
  const map: Record<string, boolean> = {};
  for (const k of FEATURE_FLAG_KEYS) {
    map[k] = DEFAULT_FLAGS[k] ?? true;
  }
  for (const row of rows) {
    if ((FEATURE_FLAG_KEYS as readonly string[]).includes(row.key)) {
      map[row.key] = row.value === "true";
    }
  }
  return map as Record<FeatureFlagKey, boolean>;
}

export async function seedFeatureFlags(): Promise<void> {
  for (const key of FEATURE_FLAG_KEYS) {
    const defaultVal = DEFAULT_FLAGS[key] ?? true;
    await db
      .insert(systemSettingsTable)
      .values({ key, value: String(defaultVal) })
      .onConflictDoNothing();
  }
}
