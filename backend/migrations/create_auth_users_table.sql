-- Create auth_users table for persistent user storage
CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    preferred_contact TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create auth_identities table for OAuth provider identities
CREATE TABLE IF NOT EXISTS auth_identities (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    username TEXT,
    url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);

-- Create auth_contacts table for contact handles
CREATE TABLE IF NOT EXISTS auth_contacts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    handle TEXT NOT NULL,
    url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_id ON auth_identities(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_auth_contacts_user_id ON auth_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_contacts_provider ON auth_contacts(user_id, provider);

