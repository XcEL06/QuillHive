DELETE FROM "reposts" AS duplicate
USING "reposts" AS canonical
WHERE duplicate."post_id" = canonical."post_id"
  AND duplicate."user_id" = canonical."user_id"
  AND duplicate."id" > canonical."id";

CREATE UNIQUE INDEX IF NOT EXISTS "reposts_user_post_unique"
  ON "reposts" ("post_id", "user_id");
