ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "opportunity_id" integer;
CREATE TABLE IF NOT EXISTS "opportunity_applications" (
  "id" serial PRIMARY KEY NOT NULL,
  "job_id" integer NOT NULL REFERENCES "jobs"("id"),
  "applicant_id" integer NOT NULL REFERENCES "users"("id"),
  "message" text,
  "proposed_budget" real,
  "proposed_currency" text NOT NULL DEFAULT 'USD',
  "status" text NOT NULL DEFAULT 'pending',
  "conversation_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_applications_job_applicant_unique" ON "opportunity_applications" ("job_id", "applicant_id");
CREATE TABLE IF NOT EXISTS "conversation_payment_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "conversation_id" integer NOT NULL REFERENCES "conversations"("id"),
  "proposer_id" integer NOT NULL REFERENCES "users"("id"),
  "amount" real NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "note" text,
  "status" text NOT NULL DEFAULT 'proposed',
  "created_at" timestamp DEFAULT now() NOT NULL
);