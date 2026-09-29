import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ROLES,
  type AccountRole,
  canDeleteAccount,
  canEditSettings,
  canManageMembers,
  canSendMessages,
  canTransferOwnership,
  canViewOnly,
  canViewReports,
  canManageCampaigns,
  hasMinRole,
  isAccountRole,
  normalizeRole,
  getRoleDisplayName,
  roleRank,
} from "./roles";

describe("roleRank", () => {
  it("orders admin > doctor > staff", () => {
    expect(roleRank("admin")).toBeGreaterThan(roleRank("doctor"));
    expect(roleRank("doctor")).toBeGreaterThan(roleRank("staff"));
  });

  it("matches the numeric mapping for all 3 roles + legacy aliases", () => {
    expect(roleRank("admin")).toBe(3);
    expect(roleRank("super_admin")).toBe(3);
    expect(roleRank("owner")).toBe(3);
    expect(roleRank("doctor")).toBe(2);
    expect(roleRank("manager")).toBe(2);
    expect(roleRank("agent")).toBe(2);
    expect(roleRank("staff")).toBe(1);
    expect(roleRank("viewer")).toBe(1);
  });
});

describe("normalizeRole and getRoleDisplayName", () => {
  it("normalizes canonical and legacy roles properly", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("super_admin")).toBe("admin");
    expect(normalizeRole("owner")).toBe("admin");
    expect(normalizeRole("doctor")).toBe("doctor");
    expect(normalizeRole("manager")).toBe("staff");
    expect(normalizeRole("agent")).toBe("staff");
    expect(normalizeRole("staff")).toBe("staff");
    expect(normalizeRole("viewer")).toBe("staff");
  });

  it("returns clean display names", () => {
    expect(getRoleDisplayName("admin")).toBe("Admin");
    expect(getRoleDisplayName("super_admin")).toBe("Admin");
    expect(getRoleDisplayName("owner")).toBe("Admin");
    expect(getRoleDisplayName("doctor")).toBe("Doctor");
    expect(getRoleDisplayName("staff")).toBe("Staff");
  });
});

describe("hasMinRole", () => {
  it("returns true when role meets the threshold", () => {
    expect(hasMinRole("admin", "staff")).toBe(true);
    expect(hasMinRole("admin", "doctor")).toBe(true);
    expect(hasMinRole("doctor", "doctor")).toBe(true);
    expect(hasMinRole("staff", "staff")).toBe(true);
  });

  it("returns false when role is below the threshold", () => {
    expect(hasMinRole("staff", "doctor")).toBe(false);
    expect(hasMinRole("doctor", "admin")).toBe(false);
    expect(hasMinRole("staff", "admin")).toBe(false);
  });
});

describe("isAccountRole", () => {
  it("accepts all valid roles including aliases", () => {
    for (const role of ACCOUNT_ROLES) {
      expect(isAccountRole(role)).toBe(true);
    }
    expect(isAccountRole("owner")).toBe(true);
    expect(isAccountRole("agent")).toBe(true);
    expect(isAccountRole("viewer")).toBe(true);
  });

  it("rejects garbage / empty / non-strings", () => {
    expect(isAccountRole("")).toBe(false);
    expect(isAccountRole(null)).toBe(false);
    expect(isAccountRole(undefined)).toBe(false);
    expect(isAccountRole(123)).toBe(false);
    expect(isAccountRole("hacker")).toBe(false);
  });
});

describe("capability predicates", () => {
  it("canManageMembers: super_admin & admin only", () => {
    expect(canManageMembers("super_admin")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("manager")).toBe(false);
    expect(canManageMembers("staff")).toBe(false);
  });

  it("canEditSettings: super_admin & admin only", () => {
    expect(canEditSettings("super_admin")).toBe(true);
    expect(canEditSettings("admin")).toBe(true);
    expect(canEditSettings("manager")).toBe(false);
    expect(canEditSettings("staff")).toBe(false);
  });

  it("canViewReports: manager+ only", () => {
    expect(canViewReports("super_admin")).toBe(true);
    expect(canViewReports("admin")).toBe(true);
    expect(canViewReports("manager")).toBe(true);
    expect(canViewReports("staff")).toBe(false);
  });

  it("canManageCampaigns: manager+ only", () => {
    expect(canManageCampaigns("super_admin")).toBe(true);
    expect(canManageCampaigns("admin")).toBe(true);
    expect(canManageCampaigns("manager")).toBe(true);
    expect(canManageCampaigns("staff")).toBe(false);
  });

  it("canSendMessages: all 4 tiers", () => {
    expect(canSendMessages("super_admin")).toBe(true);
    expect(canSendMessages("admin")).toBe(true);
    expect(canSendMessages("manager")).toBe(true);
    expect(canSendMessages("staff")).toBe(true);
  });

  it("canDeleteAccount: admin only", () => {
    expect(canDeleteAccount("super_admin")).toBe(true);
    expect(canDeleteAccount("owner")).toBe(true);
    expect(canDeleteAccount("admin")).toBe(true);
    expect(canDeleteAccount("doctor")).toBe(false);
    expect(canDeleteAccount("manager")).toBe(false);
    expect(canDeleteAccount("staff")).toBe(false);
  });

  it("canTransferOwnership: admin only", () => {
    expect(canTransferOwnership("super_admin")).toBe(true);
    expect(canTransferOwnership("owner")).toBe(true);
    expect(canTransferOwnership("admin")).toBe(true);
    expect(canTransferOwnership("doctor")).toBe(false);
    expect(canTransferOwnership("manager")).toBe(false);
    expect(canTransferOwnership("staff")).toBe(false);
  });
});
