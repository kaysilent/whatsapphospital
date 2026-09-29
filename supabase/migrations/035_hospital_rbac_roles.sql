-- ============================================================
-- 035_hospital_rbac_roles.sql — 4-Tier Hospital CRM Role Based Access Control
--
-- Roles:
--   1. super_admin (Rank 4) — Master / Owner / Chief Medical Officer
--   2. admin       (Rank 3) — Clinic Administrator
--   3. manager     (Rank 2) — Operations / Clinical Triage Manager
--   4. staff       (Rank 1) — Frontline Receptionist / Staff / Nurse
-- ============================================================

-- 1. Extend account_role_enum with new canonical roles if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role_enum') THEN
    BEGIN
      ALTER TYPE account_role_enum ADD VALUE IF NOT EXISTS 'super_admin';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE account_role_enum ADD VALUE IF NOT EXISTS 'manager';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE account_role_enum ADD VALUE IF NOT EXISTS 'staff';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Update is_account_member helper
CREATE OR REPLACE FUNCTION public.is_account_member(
  p_account_id UUID,
  min_role TEXT DEFAULT 'staff'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = p_account_id
      AND CASE p.account_role::text
            WHEN 'super_admin' THEN 4
            WHEN 'owner' THEN 4
            WHEN 'admin' THEN 3
            WHEN 'manager' THEN 2
            WHEN 'agent' THEN 2
            WHEN 'staff' THEN 1
            WHEN 'viewer' THEN 1
            ELSE 0
          END >=
          CASE min_role
            WHEN 'super_admin' THEN 4
            WHEN 'owner' THEN 4
            WHEN 'admin' THEN 3
            WHEN 'manager' THEN 2
            WHEN 'agent' THEN 2
            WHEN 'staff' THEN 1
            WHEN 'viewer' THEN 1
            ELSE 0
          END
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_account_member(UUID, TEXT) TO authenticated, service_role;

