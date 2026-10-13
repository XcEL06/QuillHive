ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_weekly_digest_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "day3_nurture_sent_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "day7_nurture_sent_at" timestamp;
