ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "edited_count" integer DEFAULT 0 NOT NULL;
UPDATE "posts" AS post
SET "edited_count" = versions.edit_count
FROM (
	SELECT "post_id", COUNT(*)::integer AS edit_count
	FROM "post_versions"
	GROUP BY "post_id"
) AS versions
WHERE post."id" = versions."post_id";
