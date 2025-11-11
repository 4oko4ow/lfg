-- Create auth_sessions table for persistent session storage
-- If table already exists, drop it first (use with caution in production!)
DROP TABLE IF EXISTS auth_sessions CASCADE;

CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);

-- Create index on expires_at for cleanup queries
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- Note: Row Level Security is optional
-- Service role key bypasses RLS, so policy is not strictly necessary
-- If you want to enable RLS for additional security, uncomment below:

-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "Service role can manage sessions" ON sessions;
-- CREATE POLICY "Service role can manage sessions"
--     ON sessions
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

