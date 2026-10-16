ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS context_type text,
  ADD COLUMN IF NOT EXISTS context_id integer;

ALTER TABLE reputation_events
  ADD COLUMN IF NOT EXISTS event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS reputation_events_user_event_key_unique
  ON reputation_events (user_id, event_key)
  WHERE event_key IS NOT NULL;

ALTER TABLE moderation_strikes
  ADD COLUMN IF NOT EXISTS appeal_text text,
  ADD COLUMN IF NOT EXISTS appeal_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS appealed_at timestamp,
  ADD COLUMN IF NOT EXISTS appeal_reviewed_by integer REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS appeal_reviewed_at timestamp,
  ADD COLUMN IF NOT EXISTS appeal_review_note text;

ALTER TABLE user_trust_scores
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_review_note text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamp;

CREATE TABLE IF NOT EXISTS series_follows (
  id serial PRIMARY KEY,
  series_id integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  follower_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS series_follows_series_follower_unique
  ON series_follows (series_id, follower_id);
