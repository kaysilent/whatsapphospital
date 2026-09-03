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
  Building2
} from "lucide-react";
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

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { appName } = useTheme();

  const doctorName = profile?.full_name || "Dr. Ananya Rao";
  const doctorInitials = doctorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AR";

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
        {/* Clinic Branch Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card-2 text-[11px] font-medium text-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span>Main Hospital Branch</span>
        </div>

        {/* Dark / Light Mode Toggle */}
        <div className="flex items-center">
          <ModeToggle />
        </div>

        {/* Notifications Bell with Ping */}
        <button 
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        </button>

        <div className="h-5 w-px bg-border mx-0.5 hidden sm:block" />

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
              <span className="text-[10px] font-medium text-primary mt-0.5 flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Clinic Admin
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-56 bg-popover text-popover-foreground border-border shadow-lg"
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="truncate text-xs font-semibold text-foreground">
                {doctorName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                {profile?.email ?? "dr.ananya@hospital.com"}
              </p>
            </div>
            <div className="py-1">
              <DropdownMenuItem onClick={() => window.location.href = "/settings"} className="cursor-pointer text-xs py-1.5">
                <User className="size-3.5 mr-2 text-muted-foreground" />
                Doctor Profile
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
    </header>
  );
}
