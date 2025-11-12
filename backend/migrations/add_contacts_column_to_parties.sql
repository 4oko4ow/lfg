-- Add contacts column to parties table if it doesn't exist
DO $$ 
BEGIN
    -- Add contacts column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'parties' AND column_name = 'contacts') THEN
        ALTER TABLE parties ADD COLUMN contacts JSONB;
        RAISE NOTICE 'Added contacts column to parties table';
    ELSE
        RAISE NOTICE 'contacts column already exists in parties table';
    END IF;
END $$;

