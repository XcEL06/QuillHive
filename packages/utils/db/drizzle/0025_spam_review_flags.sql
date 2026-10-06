CREATE TABLE IF NOT EXISTS "spam_review_flags" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "rule_key" text NOT NULL,
  "reason" text NOT NULL,
  "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "decision" text,
  "reviewed_by" integer REFERENCES "users" ("id"),
  "reviewed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spam_review_flags_user_rule_unique"
  ON "spam_review_flags" ("user_id", "rule_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spam_review_flags_status_created_idx"
  ON "spam_review_flags" ("status", "created_at");
