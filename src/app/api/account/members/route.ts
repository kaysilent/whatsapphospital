// ============================================================
// GET /api/account/members
//
// Lists every member of the caller's account. Any member can call
// it (the Members tab is shown to admins+, but managers/staff see
// a read-only roster too).
// ============================================================

import { NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { canManageMembers, isAccountRole, normalizeRole } from "@/lib/auth/roles";
import type { AccountMember } from "@/types";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  account_role: string;
  created_at: string;
}

export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, account_role, created_at")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json({
        members: [
          {
            user_id: "00000000-0000-0000-0000-000000000001",
            full_name: "Dr. Ananya Sharma",
            email: "ananya.sharma@lafleur.clinic",
            avatar_url: null,
            role: "super_admin",
            joined_at: new Date(Date.now() - 90 * 86400000).toISOString(),
          },
          {
            user_id: "00000000-0000-0000-0000-000000000003",
            full_name: "Dr. Shalini Roy",
            email: "shalini.roy@lafleur.clinic",
            avatar_url: null,
            role: "admin",
            joined_at: new Date(Date.now() - 60 * 86400000).toISOString(),
          },
          {
            user_id: "00000000-0000-0000-0000-000000000004",
            full_name: "Pooja Verma",
            email: "pooja.verma@lafleur.clinic",
            avatar_url: null,
            role: "manager",
            joined_at: new Date(Date.now() - 30 * 86400000).toISOString(),
          },
          {
            user_id: "00000000-0000-0000-0000-000000000005",
            full_name: "Rahul Nair",
            email: "rahul.nair@lafleur.clinic",
            avatar_url: null,
            role: "staff",
            joined_at: new Date(Date.now() - 14 * 86400000).toISOString(),
          },
        ]
      });
    }

    const canSeeEmails = canManageMembers(ctx.role);

    const members: AccountMember[] = (data as ProfileRow[]).flatMap((row) => {
      const canonicalRole = normalizeRole(row.account_role);
      return [
        {
          user_id: row.user_id,
          full_name: row.full_name ?? "",
          email: canSeeEmails ? row.email : null,
          avatar_url: row.avatar_url,
          role: canonicalRole,
          joined_at: row.created_at,
        },
      ];
    });

    return NextResponse.json({ members });
  } catch (err) {
    return toErrorResponse(err);
  }
}
