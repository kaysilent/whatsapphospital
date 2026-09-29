-- ==============================================================================
-- MIGRATION: 038_appointments_sittings.sql
-- Description: Adds multi-sitting treatment tracking, intervals between sittings,
--              and clinical follow-up task queues for doctors and AI agents.
-- ==============================================================================

-- 1. Create or enhance appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    department TEXT NOT NULL,
    doctor TEXT DEFAULT 'Dr. Ananya Sharma',
    status TEXT DEFAULT 'Confirmed (AI)' CHECK (status IN ('Confirmed (AI)', 'Confirmed (Staff)', 'Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show')),
    
    -- Multi-Sitting Treatment Tracking
    current_sitting INTEGER NOT NULL DEFAULT 1,
    total_sittings INTEGER NOT NULL DEFAULT 1,
    sitting_interval TEXT DEFAULT '4-6 weeks', -- Human-readable interval, e.g. "4-6 weeks", "3-4 weeks", "14 days"
    sitting_interval_days INTEGER DEFAULT 28,  -- Numeric interval for automated next-date calculation
    next_sitting_date DATE,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast queries by patient, phone, date, and status
CREATE INDEX IF NOT EXISTS idx_appointments_account_id ON appointments(account_id);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone_number);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 2. Create clinical follow_up_tasks table for AI Agent and Doctor workflows
CREATE TABLE IF NOT EXISTS follow_up_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    department TEXT NOT NULL,
    
    -- Sitting context
    sitting_info TEXT DEFAULT 'After Sitting 1 of 1',
    reason TEXT NOT NULL, -- e.g. "Day 3 Post-Laser Reaction & Calming Gel Check" or "Next Sitting Due (4-week interval)"
    type TEXT NOT NULL DEFAULT 'post_care' CHECK (type IN ('post_care', 'next_sitting_reminder', 'clinical_review', 'treatment_followup')),
    
    due TEXT NOT NULL, -- e.g. "Today", "Tomorrow", "In 3 weeks"
    due_date DATE NOT NULL,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent (AI)', 'Completed')),
    created_by TEXT DEFAULT 'AI Agent' CHECK (created_by IN ('AI Agent', 'Doctor', 'Staff')),
    
    whatsapp_message_content TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for follow-up query performance
CREATE INDEX IF NOT EXISTS idx_follow_ups_account_id ON follow_up_tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON follow_up_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_up_tasks(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_type ON follow_up_tasks(type);

-- Enable Row Level Security (RLS)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant accounts
CREATE POLICY "Users can manage appointments in their accounts"
    ON appointments FOR ALL
    USING (account_id IS NULL OR is_account_member(account_id))
    WITH CHECK (account_id IS NULL OR is_account_member(account_id));

CREATE POLICY "Users can manage follow up tasks in their accounts"
    ON follow_up_tasks FOR ALL
    USING (account_id IS NULL OR is_account_member(account_id))
    WITH CHECK (account_id IS NULL OR is_account_member(account_id));

