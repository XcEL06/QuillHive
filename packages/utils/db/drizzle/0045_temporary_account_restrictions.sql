ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned_until" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason" text;
