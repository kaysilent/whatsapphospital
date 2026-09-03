"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/hooks/use-theme";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  RefreshCcw, 
  Bot, 
  Send, 
  UserPlus, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  LifeBuoy,
  MessageSquareText,
  Activity,
  ShieldCheck
} from "lucide-react";

interface NavGroup {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Clinical & Inbound",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/contacts", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: Calendar },
      { href: "/demo", label: "AI Receptionist", icon: Bot, badge: "Live", badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
      { href: "/follow-ups", label: "Follow-Ups", icon: RefreshCcw },
    ]
  },
  {
    label: "Messaging & Outreach",
    items: [
      { href: "/broadcasts", label: "Broadcasts", icon: Send },
      { href: "/templates", label: "Message Templates", icon: MessageSquareText },
      { href: "/pipelines", label: "Patient Leads", icon: UserPlus },
    ]
  },
  {
    label: "Insights & Config",
    items: [
      { href: "/escalations", label: "Escalations", icon: AlertTriangle, badge: "Triage", badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
      { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ]
  }
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { appName, logoUrl } = useTheme();

  return (
    <aside className="flex flex-col w-64 h-screen border-r border-border bg-sidebar flex-shrink-0 transition-colors duration-200 select-none">
      {/* Brand Logo & Clinic Badge */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border bg-sidebar">
        <Link 
          href="/dashboard" 
          onClick={onNavigate}
          className="flex items-center gap-3 group transition-transform active:scale-95"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-9 w-9 rounded-xl object-contain shadow-xs" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-bold">
              <Activity className="h-5 w-5 text-white animate-pulse" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-tight tracking-tight flex items-center gap-1.5">
              Aivry Health
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">WhatsApp Hospital CRM</span>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navigationGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Live System Status & Support Footer */}
      <div className="p-3 border-t border-border bg-card-2/50 space-y-2">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-background border border-border/80 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-muted-foreground font-medium">Meta WhatsApp</span>
          </div>
          <span className="text-[10px] font-semibold text-primary">Connected</span>
        </div>

        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <LifeBuoy className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Documentation & Help</span>
        </Link>
      </div>
    </aside>
  );
}
