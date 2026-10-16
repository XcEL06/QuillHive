ALTER TABLE "posts"
  ADD COLUMN "comments_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN "likes_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN "reposts_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN "sharing_enabled" boolean NOT NULL DEFAULT true;
