ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" date;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_birthday_notifications_user_year"
  ON "notifications" ("user_id", "digest_group")
  WHERE "type" = 'birthday';
