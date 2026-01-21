-- Community leads table for B2B validation
CREATE TABLE IF NOT EXISTS community_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    platform TEXT NOT NULL, -- discord, telegram, both
    community_size TEXT NOT NULL, -- under_100, 100_500, 500_1000, over_1000
    willing_to_pay TEXT NOT NULL, -- yes, maybe, no
    community_name TEXT,
    games TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_leads_created_at ON community_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_leads_willing_to_pay ON community_leads(willing_to_pay);
