ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "min_join_reputation" real;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "min_post_reputation" real;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "min_review_bypass_reputation" real;

ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "review_reason" text;
ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "approval_reason" text;

ALTER TABLE "user_trust_scores"
  ADD COLUMN IF NOT EXISTS "is_disputed" boolean NOT NULL DEFAULT false;
