-- ==============================================================================
-- MIGRATION: 040_payments_gateway.sql
-- Description: Adds Payment Gateway integration (Razorpay, Stripe, UPI, Checkout)
--              with payment link generation, webhook listener, and WhatsApp receipts.
-- ==============================================================================

-- 1. Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    patient_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    treatment TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    gateway TEXT NOT NULL DEFAULT 'razorpay', -- 'razorpay' | 'stripe' | 'upi' | 'mock'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('created', 'pending', 'paid', 'failed', 'refunded')),
    
    payment_link_id TEXT,
    payment_link_url TEXT,
    gateway_payment_id TEXT,
    gateway_order_id TEXT,
    gateway_signature TEXT,
    receipt_number TEXT,
    
    appointment_date DATE,
    appointment_time TEXT,
    doctor TEXT DEFAULT 'Dr. Mrinalini',
    notes TEXT,
    
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON payments(phone_number);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_id ON payments(gateway_payment_id);

-- 2. Create payment_configs table for clinic gateway credentials
CREATE TABLE IF NOT EXISTS payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
    gateway_provider TEXT NOT NULL DEFAULT 'razorpay', -- 'razorpay' | 'stripe' | 'upi' | 'mock'
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_test_mode BOOLEAN NOT NULL DEFAULT true,
    
    -- Razorpay Credentials
    razorpay_key_id TEXT,
    razorpay_key_secret TEXT,
    razorpay_webhook_secret TEXT,
    
    -- Stripe Credentials
    stripe_publishable_key TEXT,
    stripe_secret_key TEXT,
    stripe_webhook_secret TEXT,
    
    -- UPI Config
    upi_vpa TEXT DEFAULT 'lafleur@okhdfcbank',
    merchant_name TEXT DEFAULT 'La Fleur Aesthetic Clinic',
    
    -- Pricing Rules
    currency TEXT DEFAULT 'INR',
    default_consultation_fee NUMERIC DEFAULT 500,
    default_advance_token_fee NUMERIC DEFAULT 300,
    require_payment_for_booking BOOLEAN DEFAULT true,
    auto_send_whatsapp_receipt BOOLEAN DEFAULT true,
    
    thank_you_message_template TEXT DEFAULT '🎉 *Payment Received & Booking Confirmed!*\n\nDear {patient_name}, we have successfully received your payment of {currency}{amount} for {treatment}.\n\n📅 Date: {date}\n⏰ Time: {time}\n👨‍⚕️ Consulting: {doctor}\n🧾 Receipt ID: {receipt_id}\n\n📍 Clinic Address:\nSuite 402, Green Glen Towers, Outer Ring Road, Bangalore\n\nThank you for choosing La Fleur Aesthetic Clinic! Reply if you need directions or have questions.',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enhance appointments table with payment tracking columns
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_amount NUMERIC DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS receipt_number TEXT;

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage payments in their accounts" ON payments;
CREATE POLICY "Users can manage payments in their accounts"
    ON payments FOR ALL
    USING (account_id IS NULL OR is_account_member(account_id))
    WITH CHECK (account_id IS NULL OR is_account_member(account_id));

DROP POLICY IF EXISTS "Users can manage payment configs in their accounts" ON payment_configs;
CREATE POLICY "Users can manage payment configs in their accounts"
    ON payment_configs FOR ALL
    USING (account_id IS NULL OR is_account_member(account_id))
    WITH CHECK (account_id IS NULL OR is_account_member(account_id));
