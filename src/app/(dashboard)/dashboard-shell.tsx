"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { PresenceHeartbeat } from "@/components/presence/presence-heartbeat";
import { Sidebar } from "@/components/layout/sidebar";
import { EmergencyAlarmBanner } from "@/components/emergency/EmergencyAlarmBanner";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Mobile menu drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-primary border-t-transparent shadow-md" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Aivry Hospital CRM...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <PresenceHeartbeat />
      
      {/* Desktop Fixed Left Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={closeMobileMenu}
          />
          <div className="relative z-50 flex w-72 max-w-[80vw] flex-1 flex-col bg-sidebar shadow-2xl">
            <Sidebar onNavigate={closeMobileMenu} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden w-full min-w-0">
        <EmergencyAlarmBanner />
        <Header onOpenSidebar={() => setMobileMenuOpen(true)} />
        
        <main className="flex-1 overflow-y-auto w-full">
          <div className="p-4 sm:p-6 lg:p-8 mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
