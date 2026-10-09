"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CalendarDays,
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
  BookOpen,
  Stethoscope,
  CreditCard,
  LayoutGrid,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  minRole?: AccountRole;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL_NAVIGATION_GROUPS: NavGroup[] = [
  {
    label: "Clinical & Inbound",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/inbox", label: "Live Inbox", icon: MessageSquareText, badge: "Chats", badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
      { href: "/contacts", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: Calendar },
      { href: "/prescriptions", label: "Prescriptions", icon: Stethoscope, badge: "Rx", badgeColor: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/20" },
      { href: "/calendar", label: "Doctor Schedule", icon: CalendarDays, badge: "Calendar", badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20" },
      { href: "/settings?tab=knowledge", label: "Knowledge Base", icon: BookOpen, badge: "RAG", badgeColor: "bg-primary/15 text-primary border border-primary/20", minRole: "admin" },
      { href: "/follow-ups", label: "Follow-Ups", icon: RefreshCcw },
    ]
  },
  {
    label: "Messaging & Outreach",
    items: [
      { href: "/pipelines", label: "Sales Pipelines", icon: LayoutGrid, badge: "Kanban", badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20", minRole: "manager" },
      { href: "/templates", label: "Meta Templates", icon: ShieldCheck, badge: "v21.0", badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", minRole: "manager" },
      { href: "/broadcasts", label: "Broadcasts", icon: Send, minRole: "manager" },
    ]
  },
  {
    label: "Insights & Config",
    items: [
      { href: "/payments", label: "Payments & Payouts", icon: CreditCard, badge: "₹ INR", badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", minRole: "manager" },
      { href: "/escalations", label: "Escalations", icon: AlertTriangle, badge: "Triage", badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20", minRole: "manager" },
      { href: "/reports", label: "Reports & Analytics", icon: BarChart3, minRole: "manager" },
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
  const { isStaff, isManager } = useAuth();

  // Filter items based on active role
  const filteredGroups = ALL_NAVIGATION_GROUPS.map((group) => {
    const items = group.items.filter((item) => {
      if (!item.minRole) return true;
      if (item.minRole === "manager") {
        return !isStaff; // accessible by manager, admin, super_admin
      }
      if (item.minRole === "admin") {
        return !isStaff && !isManager; // accessible by admin, super_admin
      }
      return true;
    });
    return { ...group, items };
  }).filter((group) => group.items.length > 0);

  return (
    <aside className="flex flex-col w-[270px] h-screen border-r border-border bg-sidebar shrink-0 transition-colors duration-200 select-none">
      {/* Brand Logo & Clinic Badge */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border bg-sidebar">
        <Link 
          href="/dashboard" 
          onClick={onNavigate}
          className="flex items-center gap-3 group transition-transform active:scale-95 min-w-0"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-9 w-9 rounded-xl object-contain shadow-xs shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-bold">
              <Activity className="h-5 w-5 text-white animate-pulse" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground leading-tight tracking-tight truncate flex items-center gap-1.5">
              {appName && appName !== "Aivry CRM" ? appName : "La Fleur Clinic"}
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-500/20" />
            </span>
            <span className="text-[11px] text-muted-foreground font-medium truncate">WhatsApp AI Assistant</span>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin">
        {filteredGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
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
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`shrink-0 whitespace-nowrap inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold leading-tight ${item.badgeColor}`}>
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
      <div className="p-3 border-t border-border bg-muted/20 space-y-2 shrink-0">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-muted-foreground font-medium truncate">Meta WhatsApp Cloud</span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">Live</span>
        </div>

        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <LifeBuoy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">Settings & API Keys</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        </Link>
      </div>
    </aside>
  );
}
