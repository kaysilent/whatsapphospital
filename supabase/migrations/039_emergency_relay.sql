-- ==============================================================================
-- MIGRATION: 039_emergency_relay.sql
-- Description: Emergency detection, doctor alerting, and bidirectional
--              WhatsApp relay sessions linking patients and doctors.
-- ==============================================================================

-- 1. Create table for tracking active emergency relay sessions between doctor and patient
CREATE TABLE IF NOT EXISTS emergency_relay_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    doctor_name TEXT DEFAULT 'Dr. Ananya Sharma',
    doctor_phone TEXT NOT NULL,
    
    department TEXT DEFAULT 'Emergency / Acute Care',
    severity TEXT DEFAULT 'CRITICAL' CHECK (severity IN ('CRITICAL', 'URGENT', 'HIGH')),
    emergency_text TEXT NOT NULL,
    
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DOCTOR_ALERTED', 'DOCTOR_REPLIED', 'RESOLVED')),
    doctor_replies_count INTEGER DEFAULT 0,
    last_doctor_reply_text TEXT,
    last_doctor_reply_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for rapid lookup when doctor replies via WhatsApp
CREATE INDEX IF NOT EXISTS idx_emergency_relay_account ON emergency_relay_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_emergency_relay_doc_phone ON emergency_relay_sessions(doctor_phone, status);
CREATE INDEX IF NOT EXISTS idx_emergency_relay_patient_phone ON emergency_relay_sessions(patient_phone);
CREATE INDEX IF NOT EXISTS idx_emergency_relay_status ON emergency_relay_sessions(status);

-- 2. Add doctor emergency phone column to profiles if missing
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS doctor_emergency_phone TEXT,
ADD COLUMN IF NOT EXISTS is_on_duty_doctor BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE emergency_relay_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage emergency relay sessions in their account"
    ON emergency_relay_sessions FOR ALL
    USING (account_id IS NULL OR is_account_member(account_id))
    WITH CHECK (account_id IS NULL OR is_account_member(account_id));

