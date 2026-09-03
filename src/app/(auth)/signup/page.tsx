"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { Activity, CheckCircle, Mail, Lock, User, UsersRound } from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <Card className="relative z-10 w-full max-w-md border-border bg-card shadow-2xl">
          <CardHeader className="items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Verification Link Sent
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-2">
              We&apos;ve sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>. Click the link to activate your hospital access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
            >
              <Button
                variant="outline"
                className="w-full text-xs h-10"
              >
                Back to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="items-center text-center pb-4">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {inviteToken ? "Join Clinic Team" : "Create Clinic Account"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs">
            {inviteToken
              ? "Set up your credentials to join your hospital team"
              : "Get started with Aivry WhatsApp Hospital CRM"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignup} className="flex flex-col gap-3.5">
            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName" className="text-xs font-semibold text-foreground">
                Doctor / Staff Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Dr. Ananya Rao"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="pl-9 h-10 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground text-xs focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Hospital Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ananya@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 h-10 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground text-xs focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 h-10 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground text-xs focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-9 h-10 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground text-xs focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md text-xs sm:text-sm disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Register Hospital Account"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground">
            <span>Already have an account?</span>
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
              className="font-semibold text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
