ALTER TABLE "posts"
  ADD COLUMN "is_archived" boolean NOT NULL DEFAULT false,
  ADD COLUMN "archive_type" text NOT NULL DEFAULT 'owner';

CREATE INDEX "posts_is_archived_author_id_idx"
  ON "posts" ("is_archived", "author_id");

CREATE INDEX "posts_is_archived_group_id_idx"
  ON "posts" ("is_archived", "group_id");
