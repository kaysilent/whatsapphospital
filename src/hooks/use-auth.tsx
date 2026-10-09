"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import {
  canEditSettings as canEditSettingsFor,
  canManageMembers as canManageMembersFor,
  canSendMessages as canSendMessagesFor,
  canViewReports as canViewReportsFor,
  canManageCampaigns as canManageCampaignsFor,
  canManageRoles as canManageRolesFor,
  canEditClinicalConfig as canEditClinicalConfigFor,
  normalizeRole,
  isAccountRole,
  type AccountRole,
} from "@/lib/auth/roles";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  beta_features: string[];
  account_id: string | null;
  account_role: AccountRole | null;
}

interface AccountSummary {
  id: string;
  name: string;
  default_currency: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (newRole: AccountRole) => void;
  updateProfile: (updates: Partial<Profile>) => void;

  accountId: string | null;
  accountRole: AccountRole | null;
  account: AccountSummary | null;
  defaultCurrency: string;

  // Primary Role Checkers
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isDoctor: boolean;
  isManager: boolean;
  isStaff: boolean;

  // Legacy Checkers
  isOwner: boolean;
  isAgent: boolean;
  isViewer: boolean;

  // Capability Flags
  canManageRoles: boolean;
  canManageMembers: boolean;
  canEditSettings: boolean;
  canEditClinicalConfig: boolean;
  canSendMessages: boolean;
  canViewReports: boolean;
  canManageCampaigns: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    if (userId.startsWith("demo-") || userId.startsWith("doctor-")) {
      setProfileLoading(false);
      return;
    }

    const supabase = createClient();
    setProfileLoading(true);
    lastFetchedUserIdRef.current = userId;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, avatar_url, role, beta_features, account_id, account_role",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthProvider] fetchProfile error:", error);
        lastFetchedUserIdRef.current = null;
        return;
      }

      if (data) {
        let accountRow: AccountSummary | null = null;
        if (data.account_id) {
          const { data: accountData, error: accountErr } = await supabase
            .from("accounts")
            .select("id, name, default_currency")
            .eq("id", data.account_id)
            .maybeSingle();
          if (!accountErr && accountData) {
            accountRow = {
              id: accountData.id,
              name: accountData.name,
              default_currency: accountData.default_currency ?? DEFAULT_CURRENCY,
            };
          }
        }

        const accountRole = isAccountRole(data.account_role)
          ? data.account_role
          : "super_admin";

        const storedCustomRole = typeof window !== "undefined" ? localStorage.getItem("wacrm_profile_role") : null;

        setProfile({
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          avatar_url: data.avatar_url,
          role: data.role || storedCustomRole || "Chief Dermatologist & Aesthetic Physician",
          beta_features: data.beta_features ?? [],
          account_id: data.account_id ?? null,
          account_role: accountRole,
        });
        setAccount(accountRow);
      } else {
        hydrateDemoSession();
        lastFetchedUserIdRef.current = null;
      }
    } catch (err) {
      console.error("[AuthProvider] fetchProfile threw:", err);
      lastFetchedUserIdRef.current = null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const hydrateDemoSession = useCallback(() => {
    if (typeof window === "undefined") return null;
    const demoUserStored = localStorage.getItem("wacrm_demo_user");
    const hasDemoCookie = document.cookie.includes("wacrm_demo_session=1");
    if (demoUserStored || hasDemoCookie) {
      try {
        let parsedDemo = demoUserStored ? JSON.parse(demoUserStored) : null;
        const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const demoUserId = (parsedDemo?.id && validUUIDRegex.test(parsedDemo.id)) ? parsedDemo.id : "7177280f-a0ad-4958-8588-5f80a8575007";
        const demoAccountId = "56702d02-aecf-489a-a9cf-632b068f3d29";

        const storedRole = localStorage.getItem("wacrm_active_role") as AccountRole | null;
        const activeRole = storedRole && isAccountRole(storedRole) ? storedRole : "super_admin";
        const customRole = localStorage.getItem("wacrm_profile_role");

        parsedDemo = {
          id: demoUserId,
          email: parsedDemo?.email || "dr.mrinalini@lafleurclinic.com",
          user_metadata: { full_name: parsedDemo?.user_metadata?.full_name || "Dr. Mrinalini" },
          role: "authenticated",
        };
        localStorage.setItem("wacrm_demo_user", JSON.stringify(parsedDemo));
        document.cookie = "wacrm_demo_session=1; path=/; max-age=604800; SameSite=Lax";

        const currentUser = parsedDemo as User;
        setProfile({
          id: demoUserId,
          full_name: parsedDemo.user_metadata?.full_name || "Dr. Mrinalini",
          email: parsedDemo.email || "dr.mrinalini@lafleurclinic.com",
          avatar_url: null,
          role: customRole || parsedDemo.role_title || "Chief Dermatologist & Aesthetic Physician",
          beta_features: [],
          account_id: demoAccountId,
          account_role: activeRole,
        });
        setAccount({
          id: demoAccountId,
          name: "La Fleur Aesthetic & Wellness Clinic",
          default_currency: "INR",
        });
        setUser(currentUser);
        setProfileLoading(false);
        setLoading(false);
        return currentUser;
      } catch {}
    }
    return null;
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
        setProfileLoading(false);
      }
    }, 2000);

    const init = async () => {
      try {
        const demoUser = hydrateDemoSession();
        if (demoUser) {
          if (mounted) {
            setLoading(false);
            setProfileLoading(false);
          }
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) console.warn("[AuthProvider] getSession notice:", error.message);

        if (!mounted) return;
        let currentUser = session?.user ?? null;

        if (!currentUser) {
          currentUser = hydrateDemoSession();
        }

        setUser(currentUser);

        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setProfileLoading(false);
        }
      } catch (err) {
        console.warn("[AuthProvider] init notice:", err);
        if (mounted) {
          hydrateDemoSession();
        }
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;

      if (currentUser) {
        setUser(currentUser);
        if (currentUser.id !== lastFetchedUserIdRef.current) {
          fetchProfile(currentUser.id);
        }
      } else if (event === "SIGNED_OUT") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("wacrm_demo_user");
          document.cookie = "wacrm_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        lastFetchedUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        setAccount(null);
        setProfileLoading(false);
      } else {
        const demoUser = hydrateDemoSession();
        if (!demoUser) {
          lastFetchedUserIdRef.current = null;
          setUser(null);
          setProfile(null);
          setAccount(null);
          setProfileLoading(false);
        }
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile, hydrateDemoSession]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wacrm_demo_user');
      document.cookie = "wacrm_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    setProfile(null);
    setAccount(null);
    window.location.href = "/admin";
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const switchRole = useCallback((newRole: AccountRole) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("wacrm_active_role", newRole);
    }
    setProfile((prev) => (prev ? { ...prev, account_role: newRole } : null));
  }, []);

  const updateProfile = useCallback((updates: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const derived = useMemo(() => {
    const role = profile?.account_role ?? null;
    const norm = role ? normalizeRole(role) : null;
    return {
      accountRole: role,
      accountId: profile?.account_id ?? null,
      isSuperAdmin: norm === "admin",
      isAdmin: norm === "admin",
      isDoctor: norm === "doctor",
      isManager: norm === "doctor",
      isStaff: norm === "staff",
      isOwner: norm === "admin",
      isAgent: norm === "doctor",
      isViewer: norm === "staff",
      canManageRoles: role ? canManageRolesFor(role) : false,
      canManageMembers: role ? canManageMembersFor(role) : false,
      canEditSettings: role ? canEditSettingsFor(role) : false,
      canEditClinicalConfig: role ? canEditClinicalConfigFor(role) : false,
      canSendMessages: role ? canSendMessagesFor(role) : false,
      canViewReports: role ? canViewReportsFor(role) : false,
      canManageCampaigns: role ? canManageCampaignsFor(role) : false,
    };
  }, [profile?.account_role, profile?.account_id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        signOut,
        refreshProfile,
        switchRole,
        updateProfile,
        account,
        defaultCurrency: account?.default_currency ?? DEFAULT_CURRENCY,
        ...derived,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      profile: null,
      loading: false,
      profileLoading: false,
      signOut: async () => {
        window.location.href = "/admin";
      },
      refreshProfile: async () => {},
      switchRole: () => {},
      updateProfile: () => {},
      account: null,
      defaultCurrency: DEFAULT_CURRENCY,
      accountId: null,
      accountRole: null,
      isSuperAdmin: false,
      isAdmin: false,
      isDoctor: false,
      isManager: false,
      isStaff: false,
      isOwner: false,
      isAgent: false,
      isViewer: false,
      canManageRoles: false,
      canManageMembers: false,
      canEditSettings: false,
      canEditClinicalConfig: false,
      canSendMessages: false,
      canViewReports: false,
      canManageCampaigns: false,
    };
  }
  return ctx;
}
