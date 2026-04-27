-- ─────────────────────────────────────────────────────────────────────────────
-- Migration v5 — Device API tokens
--
-- Adds a stable, revocable api_token to each device row.
-- The token is used by:
--   • The browser player URL:  /player/<id>?token=<api_token>
--   • The future Android APK:  Authorization: Bearer <api_token>
--     or as a URL param:       ?token=<api_token>
-- The feed endpoint (/api/player/[deviceId]/feed) validates the token so
-- only authorised screens can pull the feed.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add api_token column — 64-char hex, unique, not null with generated default
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS api_token TEXT
    NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex');

-- Make sure every existing device without a token gets one
UPDATE devices
SET api_token = encode(gen_random_bytes(32), 'hex')
WHERE api_token IS NULL OR api_token = '';

-- Enforce uniqueness
ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_api_token_key;
ALTER TABLE devices
  ADD CONSTRAINT devices_api_token_key UNIQUE (api_token);

-- 2. Index for fast token lookups (feed endpoint will query by token)
CREATE INDEX IF NOT EXISTS idx_devices_api_token ON devices (api_token);

-- 3. Helper function: regenerate a device's token (called from admin API)
CREATE OR REPLACE FUNCTION regenerate_device_token(p_device_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token TEXT;
BEGIN
  new_token := encode(gen_random_bytes(32), 'hex');
  UPDATE devices SET api_token = new_token WHERE id = p_device_id;
  RETURN new_token;
END;
$$;
