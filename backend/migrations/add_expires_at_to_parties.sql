-- Add expires_at column to parties table for optional expiration feature
ALTER TABLE parties
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index for faster lookups of expired parties
CREATE INDEX IF NOT EXISTS idx_parties_expires_at ON parties(expires_at) WHERE expires_at IS NOT NULL;

