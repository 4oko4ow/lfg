-- Optimized update of Discord contacts in parties.contacts
-- This migration uses JSONB functions for efficient bulk updates
-- Updates all Discord contacts to use username from auth_identities

-- Step 1: Create a function to update a single contact
CREATE OR REPLACE FUNCTION update_discord_contact_handle(contact JSONB) RETURNS JSONB AS $$
DECLARE
    contact_type TEXT;
    contact_handle TEXT;
    contact_url TEXT;
    discord_user_id TEXT;
    discord_username TEXT;
BEGIN
    contact_type := contact->>'type';
    
    -- Only process Discord contacts
    IF contact_type != 'discord' THEN
        RETURN contact;
    END IF;
    
    contact_handle := contact->>'handle';
    contact_url := contact->>'url';
    
    -- Extract user_id from URL or handle
    IF contact_url IS NOT NULL THEN
        discord_user_id := substring(contact_url from 'discord\.com/channels/@me/(\d{17,19})');
    END IF;
    
    IF discord_user_id IS NULL AND contact_handle ~ '^\d{17,19}$' THEN
        discord_user_id := contact_handle;
    END IF;
    
    -- If we have user_id, get username from auth_identities
    IF discord_user_id IS NOT NULL THEN
        SELECT username INTO discord_username
        FROM auth_identities
        WHERE provider = 'discord'
        AND provider_id = discord_user_id
        AND username IS NOT NULL
        AND username != '';
        
        -- Update if username found and different from current handle
        IF discord_username IS NOT NULL AND discord_username != contact_handle THEN
            RETURN jsonb_set(contact, '{handle}', to_jsonb(discord_username));
        END IF;
    END IF;
    
    -- If no user_id found, try to find by username (in case handle is global_name)
    IF discord_user_id IS NULL AND contact_handle !~ '^\d{17,19}$' THEN
        SELECT provider_id, username INTO discord_user_id, discord_username
        FROM auth_identities
        WHERE provider = 'discord'
        AND username = contact_handle
        LIMIT 1;
        
        IF discord_username IS NOT NULL AND discord_username != contact_handle THEN
            RETURN jsonb_set(contact, '{handle}', to_jsonb(discord_username));
        END IF;
    END IF;
    
    RETURN contact;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update all parties in one query using the function
UPDATE parties
SET contacts = (
    SELECT jsonb_agg(update_discord_contact_handle(contact))
    FROM jsonb_array_elements(contacts) AS contact
)
WHERE contacts IS NOT NULL
AND jsonb_array_length(contacts) > 0
AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(contacts) AS contact
    WHERE contact->>'type' = 'discord'
);

-- Step 3: Clean up the function
DROP FUNCTION update_discord_contact_handle(JSONB);

-- Report results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM parties
    WHERE contacts IS NOT NULL
    AND jsonb_array_length(contacts) > 0
    AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(contacts) AS contact
        WHERE contact->>'type' = 'discord'
    );
    
    RAISE NOTICE 'Processed % parties with Discord contacts', updated_count;
END $$;

