import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canManageMembers, normalizeRole } from "@/lib/auth/roles";
import type { AccountMember } from "@/types";

export async function GET() {
  try {
    let accountId: string | null = null;
    let userRole = 'admin';

    try {
      const ctx = await getCurrentAccount();
      accountId = ctx.accountId;
      userRole = ctx.role;
    } catch {}

    const admin = supabaseAdmin();
    
    // 1. Fetch live profiles from database
    let profileQuery = admin
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, account_role, role, created_at")
      .order("created_at", { ascending: true });

    if (accountId) {
      profileQuery = profileQuery.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data: rawProfiles } = await profileQuery;
    let profilesList: any[] = rawProfiles || [];

    // Fallback without account filter if empty
    if (profilesList.length === 0 && accountId) {
      const { data: fallbackProfiles } = await admin
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, account_role, role, created_at")
        .order("created_at", { ascending: true });
      if (fallbackProfiles && fallbackProfiles.length > 0) {
        profilesList = fallbackProfiles;
      }
    }

    // 2. Also check real Supabase Auth users to ensure all registered clinic logins appear
    try {
      const { data: authUsersData } = await admin.auth.admin.listUsers();
      const authUsers = authUsersData?.users || [];
      const profileUserIds = new Set(profilesList.map(p => p.user_id));

      for (const u of authUsers) {
        if (!profileUserIds.has(u.id)) {
          const uRole = u.user_metadata?.role || u.user_metadata?.account_role || 'staff';
          const uName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Clinic Staff';
          
          profilesList.push({
            user_id: u.id,
            full_name: uName,
            email: u.email || null,
            avatar_url: u.user_metadata?.avatar_url || null,
            account_role: uRole,
            created_at: u.created_at || new Date().toISOString()
          });
          profileUserIds.add(u.id);

          // Auto-persist profile row in DB
          admin.from("profiles").insert({
            user_id: u.id,
            account_id: accountId,
            full_name: uName,
            email: u.email,
            account_role: uRole
          }).then(() => {}).catch(() => {});
        }
      }
    } catch (authErr) {
      console.warn('[API /members Auth Sync Notice]:', authErr);
    }

    // Filter out dummy placeholder emails
    const validProfiles = profilesList.filter(p => {
      const em = (p.email || '').toLowerCase();
      if (em.includes('demo') || em.includes('00000000-')) return false;
      return true;
    });

    const canSeeEmails = canManageMembers(userRole as any);

    const members: AccountMember[] = validProfiles.map((row) => {
      const canonicalRole = normalizeRole(row.account_role || row.role || 'staff');
      return {
        user_id: row.user_id,
        full_name: row.full_name || (row.email ? row.email.split('@')[0] : "Team Member"),
        email: canSeeEmails ? row.email : null,
        avatar_url: row.avatar_url || null,
        role: canonicalRole,
        joined_at: row.created_at || new Date().toISOString(),
      };
    });

    return NextResponse.json({ members });
  } catch (err) {
    return toErrorResponse(err);
  }
}
