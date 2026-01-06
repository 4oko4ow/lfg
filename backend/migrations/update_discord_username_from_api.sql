-- Update Discord identities to use username instead of global_name
-- This migration documents the code change to use username instead of global_name.
-- The actual update happens in the application code when users authenticate.

-- To update existing Discord contacts in parties.contacts, run:
-- 1. SQL migration: update_discord_contacts_username.sql (updates from auth_identities)
-- 2. Go script: cmd/update_discord_contacts/main.go (updates via Discord API if needed)

-- Note: New Discord logins automatically use username (see backend/auth/http.go line 468)

