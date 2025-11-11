-- Create chat_messages table for chat functionality (if it doesn't exist)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_display_name TEXT,
    message TEXT NOT NULL,
    client_msg_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if they don't exist (for existing tables)
DO $$ 
BEGIN
    -- Add anon_id column if it doesn't exist (make it nullable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'anon_id') THEN
        ALTER TABLE chat_messages ADD COLUMN anon_id TEXT;
    END IF;
    
    -- Make anon_id nullable (remove NOT NULL constraint if it exists)
    -- Check if column is NOT NULL and make it nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'anon_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE chat_messages ALTER COLUMN anon_id DROP NOT NULL;
    END IF;
    
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'user_id') THEN
        ALTER TABLE chat_messages ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Add user_display_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'user_display_name') THEN
        ALTER TABLE chat_messages ADD COLUMN user_display_name TEXT;
    END IF;
    
    -- Add client_msg_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'client_msg_id') THEN
        ALTER TABLE chat_messages ADD COLUMN client_msg_id TEXT;
    END IF;
    
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'created_at') THEN
        ALTER TABLE chat_messages ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Create indexes (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- Clean up duplicate client_msg_id values before creating unique index
-- Keep the oldest record for each duplicate client_msg_id
DO $$
BEGIN
    -- Delete duplicates, keeping only the first occurrence (by created_at or id)
    DELETE FROM chat_messages
    WHERE id IN (
        SELECT id
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY client_msg_id ORDER BY created_at ASC, id ASC) as rn
            FROM chat_messages
            WHERE client_msg_id IS NOT NULL
        ) t
        WHERE t.rn > 1
    );
END $$;

-- Drop the index if it exists (in case of previous failed attempt)
DROP INDEX IF EXISTS idx_chat_messages_client_msg_id;

-- Create unique index on client_msg_id (only for non-null values)
CREATE UNIQUE INDEX idx_chat_messages_client_msg_id ON chat_messages(client_msg_id) WHERE client_msg_id IS NOT NULL;

-- Enable Row Level Security (RLS) for chat messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read chat messages
DROP POLICY IF EXISTS "Anyone can read chat messages" ON chat_messages;
CREATE POLICY "Anyone can read chat messages"
    ON chat_messages
    FOR SELECT
    USING (true);

-- Policy: Allow authenticated users to insert chat messages
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON chat_messages;
CREATE POLICY "Authenticated users can insert chat messages"
    ON chat_messages
    FOR INSERT
    WITH CHECK (true);

-- Note: Service role key bypasses RLS, so these policies are for client-side access
-- If you're using service role key from backend, RLS won't apply

