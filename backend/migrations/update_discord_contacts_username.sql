-- Update Discord contacts in parties.contacts to use username instead of user ID or global_name
-- This migration updates ALL Discord contacts by matching with username in auth_identities
-- It updates contacts where handle is either:
-- 1. A user ID (17-19 digits)
-- 2. A different value than the username in auth_identities (could be global_name)
--
-- NOTE: For better performance, use update_discord_contacts_username_optimized.sql instead
-- This migration uses loops and is slower for large datasets

DO $$
DECLARE
    party_record RECORD;
    contact_item JSONB;
    updated_contacts JSONB;
    discord_handle TEXT;
    discord_user_id TEXT;
    discord_username TEXT;
    contact_updated BOOLEAN;
BEGIN
    -- Loop through all parties with contacts
    FOR party_record IN 
        SELECT id, contacts 
        FROM parties 
        WHERE contacts IS NOT NULL 
        AND jsonb_array_length(contacts) > 0
    LOOP
        updated_contacts := '[]'::JSONB;
        contact_updated := false;
        
        -- Loop through each contact in the party
        FOR contact_item IN 
            SELECT * FROM jsonb_array_elements(party_record.contacts)
        LOOP
            -- Check if this is a Discord contact
            IF contact_item->>'type' = 'discord' THEN
                discord_handle := contact_item->>'handle';
                
                -- Try to find the user_id from the contact URL or handle
                -- Discord URLs are like: https://discord.com/channels/@me/{user_id}
                IF contact_item->>'url' IS NOT NULL THEN
                    -- Extract user_id from URL
                    discord_user_id := substring(contact_item->>'url' from 'discord\.com/channels/@me/(\d{17,19})');
                END IF;
                
                -- If we couldn't get user_id from URL, check if handle is a user ID
                IF discord_user_id IS NULL AND discord_handle ~ '^\d{17,19}$' THEN
                    discord_user_id := discord_handle;
                END IF;
                
                -- If we have a user_id, try to find username in auth_identities
                IF discord_user_id IS NOT NULL THEN
                    SELECT username INTO discord_username
                    FROM auth_identities
                    WHERE provider = 'discord'
                    AND provider_id = discord_user_id
                    AND username IS NOT NULL
                    AND username != '';
                    
                    -- If we found a username and it's different from current handle, update
                    IF discord_username IS NOT NULL AND discord_username != discord_handle THEN
                        contact_item := jsonb_set(
                            contact_item,
                            '{handle}',
                            to_jsonb(discord_username)
                        );
                        contact_updated := true;
                        RAISE NOTICE 'Updated Discord contact in party %: "%" -> "%" (user_id: %)', 
                            party_record.id, discord_handle, discord_username, discord_user_id;
                    END IF;
                END IF;
            END IF;
            
            -- Add contact to updated array
            updated_contacts := updated_contacts || jsonb_build_array(contact_item);
        END LOOP;
        
        -- Update party if any contact was updated
        IF contact_updated THEN
            UPDATE parties
            SET contacts = updated_contacts
            WHERE id = party_record.id;
            RAISE NOTICE 'Updated contacts for party %', party_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Discord contacts update completed';
END $$;

