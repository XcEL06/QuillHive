ALTER TABLE "group_post_details"
  ADD COLUMN IF NOT EXISTS "comments_enabled" boolean NOT NULL DEFAULT true;