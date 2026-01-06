-- Update Discord identities to use username instead of global_name
-- This migration will update existing Discord identities when users log in next time
-- For now, we just ensure the logic is updated in the code
-- Note: To fully update existing users, we would need to fetch their username from Discord API
-- which requires access tokens. This will happen automatically on next login.

-- If you want to force update all Discord identities immediately, you would need to:
-- 1. Fetch access_token from auth_identities where provider = 'discord'
-- 2. Call Discord API /users/@me for each token
-- 3. Update username field with the response
-- However, this is complex and tokens may be expired, so it's better to update on next login

-- This migration file is a placeholder to document the change.
-- The actual update happens in the application code when users authenticate.

