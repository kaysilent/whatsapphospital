"use client";

import Link from 'next/link';
import ChatEmulator from '@/components/ChatEmulator';
import { useDemoState } from '@/hooks/use-demo-state';
import { ArrowLeft, Sparkles, Calendar, Settings, LayoutDashboard, Sliders, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DemoPage() {
  const { systemPrompt, addAppointment, rescheduleAppointment } = useDemoState();
  const isLaFleur = systemPrompt.includes("La Fleur") || systemPrompt.includes("LA FLEUR");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Dedicated Top Navbar */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-30 sticky top-0 shadow-xs">
        {/* Left: Brand & Back to Dashboard */}
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-all shadow-xs group"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="h-5 w-px bg-border hidden sm:block" />

          <div className="hidden sm:flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
              {isLaFleur ? "🌸" : <Sparkles className="h-4 w-4" />}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">
                {isLaFleur ? "La Fleur WhatsApp Assistant" : "WhatsApp AI Assistant"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {isLaFleur ? "Aesthetic & Wellness Clinic Simulator" : "Live Chat Simulator"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Status Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{isLaFleur ? "La Fleur AI Engine Active" : "WhatsApp Engine Active"}</span>
        </div>

        {/* Right: Quick Links */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/settings?tab=knowledge"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/40 transition-colors shadow-xs"
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Knowledge Base</span>
          </Link>

          <Link
            href="/settings?tab=ai"
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors shadow-xs"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">System Prompt</span>
          </Link>

          <Link
            href="/appointments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
          >
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Appointments</span>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area: Centered Phone Emulator */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full">
        <div className="w-full max-w-[420px] flex justify-center py-2">
          <ChatEmulator 
            onBookAppointment={addAppointment} 
            onRescheduleAppointment={rescheduleAppointment}
            systemPrompt={systemPrompt} 
          />
        </div>
      </main>
    </div>
  );
}

