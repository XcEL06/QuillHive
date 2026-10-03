ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "slug" text NOT NULL DEFAULT '';
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "icon_image" text;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "cover_image" text;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'public';
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_announcement_only" boolean NOT NULL DEFAULT false;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "features" jsonb NOT NULL DEFAULT '{"eventsEnabled":false}'::jsonb;

UPDATE "groups"
SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')) || '-' || "id"::text
WHERE "slug" = '';

UPDATE "groups"
SET "type" = CASE WHEN "privacy" = 'private' THEN 'private' ELSE 'public' END;

ALTER TABLE "groups" ALTER COLUMN "rules" TYPE jsonb
USING CASE
  WHEN "rules" IS NULL OR btrim("rules") = '' THEN '[]'::jsonb
  WHEN left(btrim("rules"), 1) = '[' THEN "rules"::jsonb
  ELSE jsonb_build_array("rules")
END;
ALTER TABLE "groups" ALTER COLUMN "rules" SET DEFAULT '[]'::jsonb;
ALTER TABLE "groups" ALTER COLUMN "rules" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "groups_slug_unique" ON "groups" ("slug");

ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "muted_until" timestamp;
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "trust_score_at_join" integer;
CREATE INDEX IF NOT EXISTS "group_members_group_status_idx" ON "group_members" ("group_id", "status");

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
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "group_post_details_post_unique"
  ON "group_post_details" ("post_id");
CREATE INDEX IF NOT EXISTS "group_post_details_group_created_idx"
  ON "group_post_details" ("group_id", "created_at");