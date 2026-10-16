UPDATE "users"
SET "email_digest_enabled" = true
WHERE "email_digest_enabled" IS NULL;

ALTER TABLE "users"
  ALTER COLUMN "email_digest_enabled" SET DEFAULT true,
  ALTER COLUMN "email_digest_enabled" SET NOT NULL,
  ALTER COLUMN "date_of_birth" DROP NOT NULL,
  ALTER COLUMN "notification_prefs" DROP NOT NULL,
  ALTER COLUMN "last_weekly_digest_at" DROP NOT NULL;

ALTER TABLE "notifications"
  ALTER COLUMN "digest_group" DROP NOT NULL;
