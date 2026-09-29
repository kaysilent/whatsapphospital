"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, MessageSquare, Stethoscope, Shield, ShieldCheck, Lock, Mail, UserCheck, KeyRound, User } from "lucide-react";
import { AccountRole } from "@/lib/auth/roles";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

  const [email, setEmail] = useState("getaivry@gmail.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoginWithRole = async (targetEmail: string, targetPass: string, roleOverride?: AccountRole) => {
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const emailLower = targetEmail.toLowerCase().trim();
      let determinedRole: AccountRole = "admin";
      let fullName = "Hospital Admin";

      if (roleOverride) {
        determinedRole = roleOverride;
        if (roleOverride === "admin") fullName = "Hospital Admin (CMO)";
        else if (roleOverride === "doctor") fullName = "Dr. Ananya Sharma";
        else fullName = "Arbaz Khan (Staff)";
      } else if (emailLower.includes("doctor") || emailLower.includes("wearedarkbox") || emailLower.includes("ananya")) {
        determinedRole = "doctor";
        fullName = "Dr. Ananya Sharma";
      } else if (emailLower.includes("staff") || emailLower.includes("arbaz") || emailLower.includes("nurse")) {
        determinedRole = "staff";
        fullName = "Arbaz Khan (Staff)";
      } else {
        determinedRole = "admin";
        fullName = "Hospital Admin (CMO)";
      }

      const demoUser = {
        id: "00000000-0000-0000-0000-000000000001",
        email: targetEmail.trim() || "getaivry@gmail.com",
        user_metadata: { full_name: fullName },
        role: "authenticated",
      };

      // Set client session & role
      if (typeof window !== "undefined") {
        localStorage.setItem("wacrm_demo_user", JSON.stringify(demoUser));
        localStorage.setItem("wacrm_active_role", determinedRole);
        document.cookie = "wacrm_demo_session=1; path=/; max-age=604800; SameSite=Lax";
      }

      // Try Supabase auth if configured with a real instance
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
        try {
          const supabase = createClient();
          await supabase.auth.signInWithPassword({
            email: targetEmail.trim(),
            password: targetPass,
          });
        } catch (clientErr) {
          console.warn("[Supabase client sign-in notice]:", clientErr);
        }
      }

      // Sync server cookies
      try {
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail.trim(), password: targetPass }),
        });
      } catch (serverErr) {
        console.warn("[Server cookie sync notice]:", serverErr);
      }

      const destination = inviteToken
        ? `/join/${encodeURIComponent(inviteToken)}`
        : "/dashboard";

      window.location.href = destination;
    } catch (err: any) {
      console.error("[Login Error]:", err);
      document.cookie = "wacrm_demo_session=1; path=/; max-age=604800; SameSite=Lax";
      window.location.href = "/dashboard";
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLoginWithRole(email, password);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="flex flex-col items-center justify-center text-center pb-3">
          <div className="mx-auto mb-2.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground text-center w-full">
            {inviteToken ? "Join Hospital CRM" : "Sign In to Hospital CRM"}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 max-w-xs text-center">
            Hospital WhatsApp Operating System & Patient Triage
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Quick 1-Click Role Login Test Cards */}
          <div className="mb-4 p-2.5 rounded-xl border border-border/80 bg-muted/30 space-y-1.5">
            <p className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              Select Role to Login
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmail("getaivry@gmail.com");
                  setPassword("123456");
                  handleLoginWithRole("getaivry@gmail.com", "123456", "admin");
                }}
                className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-left transition-colors flex flex-col items-start gap-1"
              >
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <p className="font-bold text-[11px] leading-tight">Admin</p>
                </div>
                <p className="text-[9px] text-muted-foreground">Full Control</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("wearedarkbox@gmail.com");
                  setPassword("123456");
                  handleLoginWithRole("wearedarkbox@gmail.com", "123456", "doctor");
                }}
                className="p-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-left transition-colors flex flex-col items-start gap-1"
              >
                <div className="flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                  <p className="font-bold text-[11px] leading-tight">Doctor</p>
                </div>
                <p className="text-[9px] text-muted-foreground">Clinical & Relay</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail("arbaz59468@gmail.com");
                  setPassword("123456");
                  handleLoginWithRole("arbaz59468@gmail.com", "123456", "staff");
                }}
                className="p-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-left transition-colors flex flex-col items-start gap-1"
              >
                <div className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <p className="font-bold text-[11px] leading-tight">Staff</p>
                </div>
                <p className="text-[9px] text-muted-foreground">Frontline Desk</p>
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@lafleur.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 h-10 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground text-xs focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 h-10 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground text-xs focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md text-xs sm:text-sm disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In to Clinic Dashboard"}
            </Button>
          </form>

          {/* Live WhatsApp AI Emulator Quick Access */}
          <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-col gap-2">
            <Link
              href="/demo"
              className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-muted/30 text-xs font-semibold text-foreground hover:bg-muted transition-colors gap-2"
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              <span>Launch Live WhatsApp AI Emulator</span>
            </Link>
          </div>

          <div className="mt-3.5 pt-3 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground">
            <span>Need a new clinic account?</span>
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="font-semibold text-primary hover:underline"
            >
              Create clinic account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

