-- Update Discord contacts in parties.contacts to use username instead of user ID
-- This migration updates contacts where we can find the username in auth_identities

DO $$
DECLARE
    party_record RECORD;
    contact_item JSONB;
    updated_contacts JSONB;
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
                discord_user_id := contact_item->>'handle';
                
                -- Check if handle is a user ID (17-19 digits)
                IF discord_user_id ~ '^\d{17,19}$' THEN
                    -- Try to find username in auth_identities
                    SELECT username INTO discord_username
                    FROM auth_identities
                    WHERE provider = 'discord'
                    AND provider_id = discord_user_id
                    AND username IS NOT NULL
                    AND username != '';
                    
                    -- If we found a username, update the contact
                    IF discord_username IS NOT NULL THEN
                        contact_item := jsonb_set(
                            contact_item,
                            '{handle}',
                            to_jsonb(discord_username)
                        );
                        contact_updated := true;
                        RAISE NOTICE 'Updated Discord contact in party %: % -> %', 
                            party_record.id, discord_user_id, discord_username;
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

