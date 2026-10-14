ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "request_status" text NOT NULL DEFAULT 'accepted';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "request_recipient_id" integer REFERENCES "users"("id");
