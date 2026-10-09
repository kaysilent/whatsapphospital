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
  Users, 
  Lock, 
  Mail, 
  AlertCircle, 
  MessageSquare, 
  Calendar, 
  ShieldCheck, 
  Stethoscope,
  ChevronRight
} from "lucide-react";

export default function StaffLoginPage() {
  return (
    <Suspense fallback={null}>
      <StaffLoginInner />
    </Suspense>
  );
}

function StaffLoginInner() {
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
        setError(data.error || "Invalid staff credentials. Please check your email and password.");
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
          id: "staff-user",
          email: targetEmail.trim(),
          user_metadata: { full_name: data.user?.full_name || "Reception Staff" },
          role: "staff",
        };
        localStorage.setItem("wacrm_demo_user", JSON.stringify(authUser));
        localStorage.setItem("wacrm_active_role", "staff");
        document.cookie = "wacrm_demo_session=1; path=/; max-age=604800; SameSite=Lax";
      }

      const destination = inviteToken
        ? `/join/${encodeURIComponent(inviteToken)}`
        : "/inbox"; // Staff directly access shared live WhatsApp inbox

      window.location.href = destination;
    } catch (err: any) {
      console.error("[Staff Login Error]:", err);
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
      {/* Ambient Blue/Sky glow for Clinical Staff & Reception */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="flex flex-col items-center justify-center text-center pb-3">
          <div className="mx-auto mb-2.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/25">
            <Users className="h-6 w-6 text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-bold border border-sky-500/20 mb-1">
            <MessageSquare className="h-3 w-3" />
            Staff Portal (Frontline Reception & Care Team)
          </div>

          <CardTitle className="text-xl font-bold tracking-tight text-foreground text-center w-full">
            Clinical Staff & Reception Login
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 max-w-xs text-center">
            Shared WhatsApp Inbox, Patient Scheduling & Triage Chats
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
                Staff Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="reception@lafleurclinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs focus-visible:ring-sky-500/20 focus-visible:border-sky-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Staff Password
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
                  className="pl-9 text-xs focus-visible:ring-sky-500/20 focus-visible:border-sky-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs py-2 shadow-xs transition-colors mt-1"
            >
              {loading ? "Authenticating Staff..." : "Sign In to Staff Portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
