DELETE FROM "likes" AS duplicate
USING "likes" AS canonical
WHERE duplicate."post_id" = canonical."post_id"
  AND duplicate."user_id" = canonical."user_id"
  AND duplicate."id" > canonical."id";

CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_post_unique"
  ON "likes" ("post_id", "user_id");