-- Preserve request-to-join groups under the new public privacy state.
-- Existing secret groups remain invite-only.
UPDATE "groups"
SET "privacy" = 'public'
WHERE "privacy" = 'private' AND "type" <> 'secret';

UPDATE "groups"
SET "privacy" = 'private'
WHERE "type" = 'secret' AND "privacy" <> 'private';

UPDATE "groups"
SET "type" = 'private'
WHERE "type" = 'secret';

UPDATE "groups"
SET "privacy" = 'open'
WHERE "privacy" NOT IN ('open', 'public', 'private');

CREATE TABLE IF NOT EXISTS "group_invites" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups" ("id") ON DELETE CASCADE,
  "invited_by_user_id" integer NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "invite_code" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "group_invites_code_unique"
  ON "group_invites" ("invite_code");
CREATE INDEX IF NOT EXISTS "group_invites_group_status_idx"
  ON "group_invites" ("group_id", "status");
