ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "require_approval_first_three" boolean NOT NULL DEFAULT false;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "require_approval_all" boolean NOT NULL DEFAULT false;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "announcement_policy" text NOT NULL DEFAULT 'admins';
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false;
ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "screening_answers" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "approval_status" text NOT NULL DEFAULT 'approved';

CREATE TABLE IF NOT EXISTS "group_activity_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups" ("id") ON DELETE CASCADE,
  "actor_id" integer REFERENCES "users" ("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_activity_logs_group_created_idx"
  ON "group_activity_logs" ("group_id", "created_at");