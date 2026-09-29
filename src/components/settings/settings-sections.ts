import {
  Coins,
  FileText,
  KeyRound,
  LayoutGrid,
  Palette,
  PlugZap,
  Shield,
  Tags,
  User,
  UsersRound,
  Zap,
  Bot,
  BookOpen,
  Building2,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import type { AccountRole } from '@/lib/auth/roles';

export const SETTINGS_SECTIONS = [
  'overview',
  'hospital',
  'payments',
  'profile',
  'security',
  'appearance',
  'whatsapp',
  'templates',
  'quick-replies',
  'fields',
  'members',
  'api',
  'ai',
  'knowledge',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';

export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'top' | 'account' | 'workspace';
  minRole?: AccountRole;
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'top' },
  hospital: { id: 'hospital', label: 'Hospital & Timings', icon: Building2, group: 'workspace', minRole: 'manager' },
  payments: { id: 'payments', label: 'Payment Gateway', icon: CreditCard, group: 'workspace', minRole: 'admin' },
  profile: { id: 'profile', label: 'Your profile', icon: User, group: 'account' },
  security: { id: 'security', label: 'Login & security', icon: Shield, group: 'account' },
  appearance: { id: 'appearance', label: 'Appearance', icon: Palette, group: 'account' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp', icon: PlugZap, group: 'workspace', minRole: 'admin' },
  templates: { id: 'templates', label: 'Care Templates', icon: FileText, group: 'workspace', minRole: 'manager' },
  'quick-replies': { id: 'quick-replies', label: 'Quick replies', icon: Zap, group: 'workspace' },
  fields: { id: 'fields', label: 'Fields & tags', icon: Tags, group: 'workspace', minRole: 'admin' },
  members: { id: 'members', label: 'Team members', icon: UsersRound, group: 'workspace', minRole: 'admin' },
  api: { id: 'api', label: 'API keys', icon: KeyRound, group: 'workspace', minRole: 'admin' },
  ai: { id: 'ai', label: 'AI Agent', icon: Bot, group: 'workspace', minRole: 'admin' },
  knowledge: { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, group: 'workspace', minRole: 'admin' },
};

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null, group: 'top' },
  { label: 'Account', group: 'account' },
  { label: 'Workspace', group: 'workspace' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}
