-- Fix NULL pinned values in existing parties table
-- This migration fixes any NULL values that may exist before the NOT NULL constraint was added

-- Update any NULL pinned values to FALSE
UPDATE parties SET pinned = FALSE WHERE pinned IS NULL;

-- Ensure the column is NOT NULL (if it isn't already)
DO $$ 
BEGIN
    -- Check if column allows NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'parties' 
        AND column_name = 'pinned' 
        AND is_nullable = 'YES'
    ) THEN
        -- Set default for existing NULL values
        ALTER TABLE parties ALTER COLUMN pinned SET DEFAULT FALSE;
        -- Make it NOT NULL
        ALTER TABLE parties ALTER COLUMN pinned SET NOT NULL;
    END IF;
END $$;

