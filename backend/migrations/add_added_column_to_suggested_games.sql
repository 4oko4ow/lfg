-- Add added column to suggested_games table to track if a game has been added
ALTER TABLE suggested_games
ADD COLUMN IF NOT EXISTS added BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster lookups of added/not added games
CREATE INDEX IF NOT EXISTS idx_suggested_games_added ON suggested_games(added);


