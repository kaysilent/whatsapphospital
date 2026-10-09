"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { 
  Stethoscope, 
  Lock, 
  Mail, 
  AlertCircle, 
  CalendarDays, 
  FileText, 
  ShieldCheck, 
  Users,
  ChevronRight
} from "lucide-react";

export default function DoctorLoginPage() {
  return (
    <Suspense fallback={null}>
      <DoctorLoginInner />
    </Suspense>
  );
}

function DoctorLoginInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasRealSupabaseToken = document.cookie.includes("sb-");
      if (!hasRealSupabaseToken) {
        localStorage.removeItem("wacrm_demo_user");
        document.cookie = "wacrm_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    }
  }, []);

  const performLogin = async (targetEmail: string, targetPass: string) => {
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim(), password: targetPass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Invalid doctor credentials. Please check your email and password.");
        setLoading(false);
        return;
      }

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

      if (typeof window !== "undefined") {
        const authUser = data.user || {
          id: "doctor-user",
          email: targetEmail.trim(),
          user_metadata: { full_name: data.user?.full_name || "Dr. Mrinalini" },
          role: "doctor",
        };
        localStorage.setItem("wacrm_demo_user", JSON.stringify(authUser));
        localStorage.setItem("wacrm_active_role", "doctor");
        document.cookie = "wacrm_demo_session=1; path=/; max-age=604800; SameSite=Lax";
      }

      const destination = inviteToken
        ? `/join/${encodeURIComponent(inviteToken)}`
        : "/calendar"; // Doctors directly access their clinical calendar & patients

      window.location.href = destination;
    } catch (err: any) {
      console.error("[Doctor Login Error]:", err);
      setError(err.message || "Failed to sign in. Please verify your connection.");
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Ambient Teal/Emerald glow for Clinical Doctors */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="flex flex-col items-center justify-center text-center pb-3">
          <div className="mx-auto mb-2.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/25">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold border border-teal-500/20 mb-1">
            <Stethoscope className="h-3 w-3" />
            Doctor Portal (Dr. Mrinalini & Medical Team)
          </div>

          <CardTitle className="text-xl font-bold tracking-tight text-foreground text-center w-full">
            Clinical Doctor Login
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 max-w-xs text-center">
            Doctor Calendar, Digital Prescriptions (Rx) & Diagnostic Intake
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Doctor Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="doctor@lafleurclinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs focus-visible:ring-teal-500/20 focus-visible:border-teal-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Doctor Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-xs focus-visible:ring-teal-500/20 focus-visible:border-teal-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-2 shadow-xs transition-colors mt-1"
            >
              {loading ? "Authenticating Doctor..." : "Sign In to Doctor Portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
