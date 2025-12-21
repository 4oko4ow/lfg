-- Add user_id to parties table to track party creators
ALTER TABLE parties
ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES auth_users(id) ON DELETE
SET NULL;
-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_parties_user_id ON parties(user_id);
-- Create user_stats table for tracking user activity
CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
    parties_created INTEGER NOT NULL DEFAULT 0,
    parties_joined INTEGER NOT NULL DEFAULT 0,
    total_xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Create user_achievements table for tracking achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL,
    achievement_name TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_type)
);
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_level ON user_stats(level DESC, total_xp DESC);