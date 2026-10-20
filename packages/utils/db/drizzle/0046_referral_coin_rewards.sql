WITH ranked_reusable_codes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY created_by ORDER BY created_at, id) AS row_number
  FROM invite_codes
  WHERE expires_at IS NULL AND is_active = true
)
UPDATE invite_codes
SET is_active = false
WHERE id IN (
  SELECT id FROM ranked_reusable_codes WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_one_active_reusable_per_user
  ON invite_codes (created_by)
  WHERE expires_at IS NULL AND is_active = true;

CREATE TABLE IF NOT EXISTS coin_ledger (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  amount integer NOT NULL CHECK (amount > 0),
  source text NOT NULL,
  basis text NOT NULL,
  reason text NOT NULL,
  admin_id integer NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coin_ledger_user_created_at_idx
  ON coin_ledger (user_id, created_at);
CREATE INDEX IF NOT EXISTS coin_ledger_admin_id_idx
  ON coin_ledger (admin_id);

CREATE OR REPLACE FUNCTION reject_coin_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'coin ledger entries are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coin_ledger_append_only ON coin_ledger;
CREATE TRIGGER coin_ledger_append_only
  BEFORE UPDATE OR DELETE ON coin_ledger
  FOR EACH ROW EXECUTE FUNCTION reject_coin_ledger_mutation();

INSERT INTO system_settings (key, value)
VALUES ('referral_program_enabled', 'false'), ('quillhive_coins_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
