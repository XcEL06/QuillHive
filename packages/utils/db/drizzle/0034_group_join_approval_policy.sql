ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "join_approval_policy" text NOT NULL DEFAULT 'admins';
