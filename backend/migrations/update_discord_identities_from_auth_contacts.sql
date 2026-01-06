-- Update Discord identities username from auth_contacts if available
-- This helps update identities where access_token might be expired
-- but we have the correct username in auth_contacts

DO $$
DECLARE
    identity_record RECORD;
    contact_handle TEXT;
    updated_count INTEGER := 0;
BEGIN
    -- Loop through all Discord identities
    FOR identity_record IN 
        SELECT ai.id, ai.provider_id, ai.username, ac.handle as contact_handle
        FROM auth_identities ai
        LEFT JOIN auth_contacts ac ON ac.user_id = ai.user_id AND ac.provider = 'discord'
        WHERE ai.provider = 'discord'
        AND ac.handle IS NOT NULL
        AND ac.handle != ''
        AND (
            -- Update if username is NULL or empty
            ai.username IS NULL 
            OR ai.username = ''
            -- Or if username is different from contact handle (might be global_name)
            OR ai.username != ac.handle
        )
    LOOP
        contact_handle := identity_record.contact_handle;
        
        -- Only update if contact_handle looks like a username (not a user ID)
        -- User IDs are 17-19 digits, usernames are not
        IF contact_handle !~ '^\d{17,19}$' THEN
            UPDATE auth_identities
            SET username = contact_handle
            WHERE id = identity_record.id
            AND (username IS NULL OR username = '' OR username != contact_handle);
            
            IF FOUND THEN
                updated_count := updated_count + 1;
                RAISE NOTICE 'Updated identity % (provider_id: %) with username from contacts: %', 
                    identity_record.id, identity_record.provider_id, contact_handle;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Updated % Discord identities from auth_contacts', updated_count;
END $$;

