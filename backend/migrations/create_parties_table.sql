-- Create parties table for storing party listings
CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    game TEXT NOT NULL,
    goal TEXT NOT NULL,
    slots INTEGER NOT NULL,
    joined INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contacts JSONB,
    pinned BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_parties_created_at ON parties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parties_game ON parties(game);
CREATE INDEX IF NOT EXISTS idx_parties_pinned ON parties(pinned) WHERE pinned = TRUE;

