'use client';

import { Suspense, useMemo, useState, useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { QuickRepliesManager } from '@/components/settings/quick-replies-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { MembersTab } from '@/components/settings/members-tab';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import { AiAgentPanel } from '@/components/settings/ai-agent-panel';
import { KnowledgeBasePanel } from '@/components/settings/knowledge-base-panel';
import { HospitalSettingsPanel } from '@/components/settings/hospital-settings-panel';
import { PaymentGatewayPanel } from '@/components/settings/payment-gateway-panel';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';

// `useSearchParams` opts this page out of static prerendering unless it
// sits under a Suspense boundary. Without one, the production build hits
// the "missing Suspense with CSR bailout" error and the whole page bails
// to client-side rendering — shipping a settings screen whose rail never
// wires up its click handlers. You land on the section the URL carried
// (the account-menu Settings link points at `?tab=whatsapp`) and can't
// navigate away. Mirror the login/signup split: a thin wrapper supplies
// the boundary; the inner component reads the query string.
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency } = useAuth();
  const { mode } = useTheme();
  const t = useTranslations('Settings');

  // Maintain local state for instant 0ms tab switching
  const [section, setSection] = useState<SettingsSection>(() => {
    return resolveSection(searchParams?.get('tab') ?? null);
  });

  // Keep in sync with URL search params
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam) {
      setSection(resolveSection(tabParam));
    }
  }, [searchParams]);

  const go = (next: SettingsSection) => {
    setSection(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url.toString());
    } catch {}
    try {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', next);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    } catch {}
  };

  // Cheap, fetch-free rail hints. The Overview landing carries the
  // full live status/counts; the rail just surfaces the two that are
  // already in context.
  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const renderPanel = (sec: SettingsSection) => {
    switch (sec) {
      case 'overview':
        return <SettingsOverview onSelect={go} />;
      case 'hospital':
        return <HospitalSettingsPanel />;
      case 'payments':
        return <PaymentGatewayPanel />;
      case 'profile':
        return <ProfileForm />;
      case 'security':
        return <SecurityPanel />;
      case 'appearance':
        return <AppearancePanel />;
      case 'whatsapp':
        return <WhatsAppConfig />;
      case 'templates':
        return <TemplateManager />;
      case 'quick-replies':
        return <QuickRepliesManager />;
      case 'fields':
        return <FieldsAndTagsPanel />;
      case 'members':
        return <MembersTab />;
      case 'api':
        return <ApiKeysSettings />;
      case 'ai':
        return <AiAgentPanel />;
      case 'knowledge':
        return <KnowledgeBasePanel />;
      default:
        return <SettingsOverview onSelect={go} />;
    }
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pageDesc')}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={section} onSelect={go} hints={hints} />
        <div className="min-w-0">{renderPanel(section)}</div>
      </div>
    </div>
  );
}
