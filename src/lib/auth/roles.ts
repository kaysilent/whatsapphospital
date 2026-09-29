// ============================================================
// Hospital CRM 3-Tier Role-Based Access Control (RBAC)
//
// 1. Admin   (Rank 3) — Clinic Administrator / Master Admin (Full System & Team Control)
// 2. Doctor  (Rank 2) — Clinical Doctor (Patient Care, Appointments, Relay, Reports)
// 3. Staff   (Rank 1) — Frontline Receptionist / Staff (Shared Inbox, Chat, Bookings)
// ============================================================

export type AccountRole =
  | "admin"
  | "doctor"
  | "staff"
  // Legacy aliases mapped automatically:
  | "super_admin"
  | "manager"
  | "owner"
  | "agent"
  | "viewer";

/** Ordered list of canonical 3 primary roles, lowest privilege first. */
export const ACCOUNT_ROLES: readonly AccountRole[] = [
  "staff",
  "doctor",
  "admin",
] as const;

export const ALL_ROLES: readonly AccountRole[] = [
  "staff",
  "doctor",
  "admin",
  "super_admin",
  "manager",
  "owner",
  "agent",
  "viewer",
] as const;

/**
 * Numeric rank of a role. Higher = more privileged.
 * Mirrors the CASE expression in `is_account_member` so JS/SQL stay aligned.
 */
export function roleRank(role: AccountRole): number {
  switch (role) {
    case "admin":
    case "super_admin":
    case "owner":
      return 3;
    case "doctor":
    case "manager":
    case "agent":
      return 2;
    case "staff":
    case "viewer":
      return 1;
    default:
      return 1;
  }
}

/**
 * True iff `role` is at least as privileged as `min`.
 */
export function hasMinRole(role: AccountRole, min: AccountRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Type-narrow an unknown string into a valid `AccountRole`. */
export function isAccountRole(value: unknown): value is AccountRole {
  return (
    typeof value === "string" &&
    (ALL_ROLES as readonly string[]).includes(value.toLowerCase())
  );
}

/** Normalize any legacy or canonical role string into one of the 3 primary roles. */
export function normalizeRole(role: AccountRole | string | null | undefined): "admin" | "doctor" | "staff" {
  const r = (role || "").toLowerCase();
  if (r === "admin" || r === "super_admin" || r === "owner") return "admin";
  if (r === "doctor") return "doctor";
  if (r === "staff" || r === "manager" || r === "agent" || r === "viewer") return "staff";
  return "staff";
}

/** Friendly human-readable label for UI badges. */
export function getRoleDisplayName(role: AccountRole | string | null | undefined): string {
  const norm = normalizeRole(role);
  switch (norm) {
    case "admin":
      return "Admin";
    case "doctor":
      return "Doctor";
    case "staff":
      return "Staff";
  }
}

// ============================================================
// Capability predicates
// ============================================================

/** Admin only: change member roles. */
export function canManageRoles(role: AccountRole): boolean {
  return roleRank(role) >= 3;
}

/** Admin: invite & remove team members, configure AI backend & WhatsApp credentials. */
export function canManageMembers(role: AccountRole): boolean {
  return roleRank(role) >= 3;
}

/** Admin: edit AI prompt, API Keys, Webhooks, backend system config. */
export function canEditBackendSettings(role: AccountRole): boolean {
  return roleRank(role) >= 3;
}

/** Admin & Doctor: edit office timings, holiday schedules, and pre/post-op care templates. */
export function canEditClinicalConfig(role: AccountRole): boolean {
  return roleRank(role) >= 2;
}

/** Admin: edit general clinic settings. */
export function canEditSettings(role: AccountRole): boolean {
  return roleRank(role) >= 3;
}

/** Admin, Doctor, Staff: write operational data — send messages, create contacts, manage appointments. */
export function canSendMessages(role: AccountRole): boolean {
  return hasMinRole(role, "staff");
}

/** Admin & Doctor: view analytics, reports, triage escalations, run broadcasts. */
export function canViewReports(role: AccountRole): boolean {
  return hasMinRole(role, "doctor");
}

/** Admin & Doctor: run mass patient broadcasts and manage pipeline lead stages. */
export function canManageCampaigns(role: AccountRole): boolean {
  return hasMinRole(role, "doctor");
}

/** Staff: front-desk operational chat & appointments, but restricted from clinic settings. */
export function canViewOnly(role: AccountRole): boolean {
  return normalizeRole(role) === "staff";
}

/** Admin only: destructive operations. */
export function canDeleteAccount(role: AccountRole): boolean {
  return roleRank(role) >= 3;
}

/** Admin only: transfer clinic ownership. */
export function canTransferOwnership(role: AccountRole): boolean {
  return roleRank(role) >= 3;
}
