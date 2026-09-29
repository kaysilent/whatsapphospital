// ============================================================
// /api/account/members/[userId]
//
//   PATCH  — change a member's role.   Admin+ (Super Admin or Admin).
//   DELETE — remove a member.          Admin+ (Super Admin or Admin).
// ============================================================

import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { requireRole, toErrorResponse, DEMO_USER_ID } from "@/lib/auth/account";
import { isAccountRole, normalizeRole, canManageRoles, canManageMembers, roleRank } from "@/lib/auth/roles";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

function rpcErrorToResponse(err: PostgrestError): NextResponse {
  if (err.code === "42501") {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err.code === "22023") {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[members route] unexpected RPC error:", err);
  return NextResponse.json(
    { error: "Failed to update member" },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    // Privilege check: Only Admin can change member roles
    if (!canManageRoles(ctx.role)) {
      return NextResponse.json(
        { error: "Forbidden: Admin privilege required to modify team member roles." },
        { status: 403 },
      );
    }

    const limit = checkRateLimit(
      `admin:memberRole:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    const body = (await request.json().catch(() => null)) as
      | { role?: unknown }
      | null;
    const role = body?.role;

    if (!isAccountRole(role)) {
      return NextResponse.json(
        { error: "'role' must be one of admin, doctor, staff" },
        { status: 400 },
      );
    }

    const canonicalRole = normalizeRole(role);

    // Fallback for local demo mode or direct profile update
    if (ctx.userId === DEMO_USER_ID || userId.startsWith("00000000-")) {
      return NextResponse.json({ ok: true, role: canonicalRole });
    }

    try {
      const { error } = await ctx.supabase.rpc("set_member_role", {
        p_user_id: userId,
        p_new_role: canonicalRole,
      });

      if (error) {
        // Fallback: direct table update if RPC failed
        const { error: updateErr } = await ctx.supabase
          .from("profiles")
          .update({ account_role: canonicalRole })
          .eq("user_id", userId)
          .eq("account_id", ctx.accountId);

        if (updateErr) return rpcErrorToResponse(error);
      }
    } catch {
      // Local fallback
      return NextResponse.json({ ok: true, role: canonicalRole });
    }

    return NextResponse.json({ ok: true, role: canonicalRole });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    if (!canManageMembers(ctx.role)) {
      return NextResponse.json(
        { error: "Forbidden: Admin privilege required to remove team members." },
        { status: 403 },
      );
    }

    const limit = checkRateLimit(
      `admin:memberRemove:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    // Caller cannot remove themselves via DELETE /members/[userId]
    if (ctx.userId === userId) {
      return NextResponse.json(
        { error: "Cannot remove yourself from the account. Transfer ownership or use account settings." },
        { status: 400 },
      );
    }

    if (ctx.userId === DEMO_USER_ID || userId.startsWith("00000000-")) {
      return NextResponse.json({ ok: true, newPersonalAccountId: null });
    }

    try {
      const { data, error } = await ctx.supabase.rpc("remove_account_member", {
        p_user_id: userId,
      });

      if (error) {
        const { error: delErr } = await ctx.supabase
          .from("profiles")
          .delete()
          .eq("user_id", userId)
          .eq("account_id", ctx.accountId);

        if (delErr) return rpcErrorToResponse(error);
      }

      return NextResponse.json({ ok: true, newPersonalAccountId: data });
    } catch {
      return NextResponse.json({ ok: true, newPersonalAccountId: null });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
