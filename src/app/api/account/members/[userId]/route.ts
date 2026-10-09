import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAccountRole, normalizeRole, canManageRoles, canManageMembers } from "@/lib/auth/roles";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

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
    const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
    const role = body?.role;

    if (!isAccountRole(role)) {
      return NextResponse.json(
        { error: "'role' must be one of admin, doctor, staff" },
        { status: 400 },
      );
    }

    const canonicalRole = normalizeRole(role);
    const admin = supabaseAdmin();

    // Update in database
    await admin
      .from("profiles")
      .update({ account_role: canonicalRole, role: canonicalRole })
      .eq("user_id", userId);

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
        { error: "Cannot remove yourself from the account." },
        { status: 400 },
      );
    }

    const admin = supabaseAdmin();

    // 1. Delete from profiles table
    await admin
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    // 2. Also attempt removing from auth if real auth user
    try {
      if (!userId.startsWith("00000000-")) {
        await admin.auth.admin.deleteUser(userId);
      }
    } catch (authDelErr) {
      console.warn('[Member DELETE auth notice]:', authDelErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
