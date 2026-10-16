ALTER TABLE "portfolio_items"
  ADD COLUMN IF NOT EXISTS "evidence_url" text;

ALTER TABLE "opportunity_applications"
  ADD COLUMN IF NOT EXISTS "completion_requested_by_id" integer REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp;

ALTER TABLE "collaboration_rooms"
  ALTER COLUMN "request_id" DROP NOT NULL;

ALTER TABLE "collaboration_rooms"
  ADD COLUMN IF NOT EXISTS "opportunity_application_id" integer REFERENCES "opportunity_applications"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_rooms_opportunity_application_unique"
  ON "collaboration_rooms" ("opportunity_application_id");
