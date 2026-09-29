"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { 
  LogOut, 
  Menu, 
  Settings as SettingsIcon, 
  User, 
  Search, 
  Bell, 
  Sparkles,
  ChevronDown,
  Volume2,
  VolumeX,
  AlertTriangle
} from "lucide-react";
import { emergencyAudio } from "@/lib/audio/emergency-audio";
import { useState, useEffect } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getRoleDisplayName } from "@/lib/auth/roles";
import { useDoctorAvailability } from "@/hooks/use-doctor-availability";
import { DoctorStatusModal } from "@/components/doctor/doctor-status-modal";
import { formatDateRange, getDoctorStatusMeta } from "@/lib/doctor/availability";
import { Plane, CalendarCheck } from "lucide-react";

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const { profile, accountRole, signOut } = useAuth();
  const { appName } = useTheme();
  const [alarmState, setAlarmState] = useState(emergencyAudio.getState());
  const [isDoctorStatusOpen, setIsDoctorStatusOpen] = useState(false);
  const { activeDoctor, isDoctorAwayByName } = useDoctorAvailability();

  useEffect(() => {
    const unsubscribe = emergencyAudio.subscribe((state) => {
      setAlarmState(state);
    });
    return unsubscribe;
  }, []);

  const doctorName = profile?.full_name || (accountRole === "admin" ? "Hospital Admin" : accountRole === "doctor" ? "Dr. Ananya Sharma" : "Staff Member");
  const doctorInitials = doctorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "HA";


  const handleTestSound = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (alarmState.isRunning) {
      emergencyAudio.stopAlarm();
    } else {
      emergencyAudio.startAlarm("test-alert", "TEST EMERGENCY SOUND: Clinical urgent alert simulation beeping every 4s.");
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-8 z-20">
      {/* Left: Mobile Toggle & Global Hospital Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label={t("openMenu")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        
        {/* Global Search Bar */}
        <div className="hidden sm:flex items-center w-full h-9 px-3 bg-muted/50 border border-border rounded-lg text-muted-foreground focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <Search className="w-4 h-4 text-muted-foreground/70 mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Search patients, appointments, phone, doctors..." 
            className="w-full bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Hospital Status, Mode Toggle, Notifications & Doctor Profile */}
      <div className="flex items-center gap-3">
        {/* Dark / Light Mode Toggle */}
        <div className="flex items-center">
          <ModeToggle />
        </div>

        {/* Notifications Bell Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger 
            aria-label="Notifications"
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-2 ${
              alarmState.isRunning
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/50 animate-pulse'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary/30'
            }`}
          >
            {alarmState.isRunning ? (
              <AlertTriangle className="h-4 w-4 animate-bounce" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                alarmState.isRunning ? 'bg-rose-500' : 'bg-primary'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                alarmState.isRunning ? 'bg-rose-600' : 'bg-primary'
              }`}></span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-80 sm:w-96 bg-popover text-popover-foreground border-border shadow-xl p-0 overflow-hidden"
          >
            {/* Dropdown Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                {alarmState.isRunning ? (
                  <AlertTriangle className="h-4 w-4 text-rose-600 animate-pulse" />
                ) : (
                  <Bell className="h-4 w-4 text-primary" />
                )}
                <span className="text-xs font-bold text-foreground">Clinical Notifications</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  alarmState.isRunning
                    ? 'bg-rose-500/15 text-rose-600'
                    : 'bg-primary/15 text-primary'
                }`}>
                  {alarmState.isRunning ? '🚨 Emergency Active' : '3 New'}
                </span>
              </div>
              <Link 
                href="/notifications"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {/* Notification Items List */}
            <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
              <Link
                href="/escalations"
                onClick={() => emergencyAudio.stopAlarm()}
                className={`flex items-start gap-3 p-3.5 hover:bg-muted/40 transition-colors group ${
                  alarmState.isRunning ? 'bg-rose-500/10' : ''
                }`}
              >
                <div className="h-8 w-8 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  🚨
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      Clinical Emergency Alert
                      {alarmState.isRunning && (
                        <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-mono font-bold animate-pulse">
                          🔊 BEEPING
                        </span>
                      )}
                    </p>
                    <span className="text-[10px] text-muted-foreground font-mono">4m ago</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    Vikram Malhotra reported severe rash post-peel. Click to open and acknowledge.
                  </p>
                </div>
              </Link>

              <Link
                href="/follow-ups"
                className="flex items-start gap-3 p-3.5 hover:bg-muted/40 transition-colors group"
              >
                <div className="h-8 w-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  📅
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      Sitting 2 Interval Due
                    </p>
                    <span className="text-[10px] text-muted-foreground font-mono">15m ago</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    Rohan Mehra is due for PRP Sitting 2 (3-week interval window).
                  </p>
                </div>
              </Link>

              <Link
                href="/notifications"
                className="flex items-start gap-3 p-3.5 hover:bg-muted/40 transition-colors group"
              >
                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  💬
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      New Patient Assigned
                    </p>
                    <span className="text-[10px] text-muted-foreground font-mono">1h ago</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    Kavita Sharma inquiry for HydraFacial was assigned to you.
                  </p>
                </div>
              </Link>
            </div>

            {/* Full Center Link */}
            <div className="p-2.5 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleTestSound}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  alarmState.isRunning
                    ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                    : 'bg-card hover:bg-muted text-foreground border-border'
                }`}
              >
                {alarmState.isRunning ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5" />
                    Stop Sound Alarm
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-primary" />
                    Test Emergency Beep
                  </>
                )}
              </button>

              <Link
                href="/notifications"
                className="text-xs font-semibold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Full Center →
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-5 w-px bg-border mx-0.5 hidden sm:block" />

        {/* Doctor Live Availability / Holiday Status Pill */}
        {activeDoctor && (
          <button
            type="button"
            onClick={() => setIsDoctorStatusOpen(true)}
            title="Doctor Availability & Holiday Schedule: Click to configure dates"
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold shadow-xs transition-all cursor-pointer ${
              activeDoctor.status === 'holiday' || activeDoctor.status === 'away'
                ? 'border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 ring-1 ring-purple-500/30'
                : activeDoctor.status === 'in_surgery'
                ? 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {activeDoctor.status === 'holiday' || activeDoctor.status === 'away' ? (
              <>
                <span className="text-xs">🏖️</span>
                <span>Away: {formatDateRange(activeDoctor.startDate, activeDoctor.endDate) || 'Holiday'}</span>
              </>
            ) : activeDoctor.status === 'in_surgery' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span>In Surgery {activeDoctor.endTime ? `(Till ${activeDoctor.endTime})` : ''}</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Available</span>
              </>
            )}
          </button>
        )}

        {/* Doctor Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-full p-1 pr-2.5 transition-all hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("openAccountMenu")}
          >
            <Avatar className="size-8 rounded-full border border-primary/20 bg-primary/10 text-primary font-bold text-xs">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={doctorName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {doctorInitials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start leading-none text-left">
              <span className="text-xs font-semibold text-foreground">
                {doctorName}
              </span>
              <span className="text-[10px] font-medium mt-0.5 flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  accountRole === "admin" || accountRole === "super_admin" || accountRole === "owner" 
                    ? "bg-emerald-500" 
                    : accountRole === "doctor" || accountRole === "manager" || accountRole === "agent" 
                    ? "bg-purple-500" 
                    : "bg-blue-500"
                }`} />
                <span className={`${
                  accountRole === "admin" || accountRole === "super_admin" || accountRole === "owner" 
                    ? "text-emerald-600 dark:text-emerald-400 font-medium" 
                    : accountRole === "doctor" || accountRole === "manager" || accountRole === "agent" 
                    ? "text-purple-600 dark:text-purple-400 font-medium" 
                    : "text-muted-foreground"
                }`}>
                  {getRoleDisplayName(accountRole)}
                </span>
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 bg-popover text-popover-foreground border-border shadow-lg"
          >
            <div className="px-3 py-2.5 border-b border-border">
              <div className="flex items-center justify-between">
                <p className="truncate text-xs font-bold text-foreground">
                  {doctorName}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  accountRole === "admin" || accountRole === "super_admin" || accountRole === "owner" 
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold" 
                    : accountRole === "doctor" || accountRole === "manager" || accountRole === "agent" 
                    ? "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold" 
                    : "border-border bg-muted text-muted-foreground font-medium"
                }`}>
                  {getRoleDisplayName(accountRole)}
                </span>
              </div>
              <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                {profile?.email ?? "user@hospital.com"}
              </p>
            </div>

            <div className="py-1">
              <DropdownMenuItem 
                onClick={() => setIsDoctorStatusOpen(true)} 
                className="cursor-pointer text-xs py-1.5 font-medium text-primary hover:bg-primary/10"
              >
                <Plane className="size-3.5 mr-2 text-primary" />
                Doctor Away & Holiday Schedule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/settings"} className="cursor-pointer text-xs py-1.5">
                <User className="size-3.5 mr-2 text-muted-foreground" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/settings"} className="cursor-pointer text-xs py-1.5">
                <SettingsIcon className="size-3.5 mr-2 text-muted-foreground" />
                Clinic Settings
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-xs text-destructive focus:text-destructive py-1.5">
              <LogOut className="size-3.5 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>

        </DropdownMenu>
      </div>

      {/* Doctor Availability & Holiday Modal */}
      <DoctorStatusModal
        isOpen={isDoctorStatusOpen}
        onClose={() => setIsDoctorStatusOpen(false)}
        defaultDoctorId={activeDoctor?.doctorId}
      />
    </header>
  );
}
