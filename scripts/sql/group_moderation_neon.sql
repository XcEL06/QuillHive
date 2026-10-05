-- QuillHive group moderation schema for an existing database.
-- Safe to run more than once in the Neon SQL Editor.
-- Requires the base Groups schema (groups, group_join_requests, posts, users).

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.groups') IS NULL
    OR to_regclass('public.group_join_requests') IS NULL
    OR to_regclass('public.posts') IS NULL
    OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'QuillHive base schema is missing. Run the project database migrations before this group moderation script.';
  END IF;
END;
$$;

ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "require_approval_first_three" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "require_approval_all" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "announcement_policy" text NOT NULL DEFAULT 'admins',
  ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false;

ALTER TABLE "group_join_requests"
  ADD COLUMN IF NOT EXISTS "screening_answers" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "group_post_details" (
  "id" serial PRIMARY KEY NOT NULL,
  "post_id" integer NOT NULL REFERENCES "posts" ("id") ON DELETE CASCADE,
  "group_id" integer NOT NULL REFERENCES "groups" ("id") ON DELETE CASCADE,
  "type" text NOT NULL DEFAULT 'discussion',
  "poll" jsonb,
  "question" jsonb,
  "opportunity_id" integer,
  "opportunity_snapshot" jsonb,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "is_announcement" boolean NOT NULL DEFAULT false,
  "comments_enabled" boolean NOT NULL DEFAULT true,
  "approval_status" text NOT NULL DEFAULT 'approved',
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Additions are repeated after CREATE TABLE so this also upgrades an existing
-- group_post_details table created by an earlier Groups migration.
ALTER TABLE "group_post_details"
  ADD COLUMN IF NOT EXISTS "comments_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "approval_status" text NOT NULL DEFAULT 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS "group_post_details_post_unique"
  ON "group_post_details" ("post_id");
CREATE INDEX IF NOT EXISTS "group_post_details_group_created_idx"
  ON "group_post_details" ("group_id", "created_at");

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

COMMIT;
