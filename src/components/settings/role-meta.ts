import {
  Shield,
  Stethoscope,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';

import type { AccountRole } from '@/lib/auth/roles';
import type { ChipVariant } from './settings-chip';

/**
 * Single source of truth for per-role chip metadata across settings
 * surfaces (the Overview identity chip, header profile pill, and Members roster).
 */
export const ROLE_META: Record<
  AccountRole,
  { icon: LucideIcon; label: string; displayName: string; variant: ChipVariant; className: string }
> = {
  admin: {
    icon: Shield,
    label: 'admin',
    displayName: 'Admin',
    variant: 'admin',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold',
  },
  doctor: {
    icon: Stethoscope,
    label: 'doctor',
    displayName: 'Doctor',
    variant: 'admin',
    className: 'border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold',
  },
  staff: {
    icon: UserIcon,
    label: 'staff',
    displayName: 'Staff',
    variant: 'staff',
    className: 'border-border bg-muted text-muted-foreground font-medium',
  },
  // Legacy aliases mapped to the 3 roles:
  super_admin: {
    icon: Shield,
    label: 'admin',
    displayName: 'Admin',
    variant: 'admin',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold',
  },
  owner: {
    icon: Shield,
    label: 'admin',
    displayName: 'Admin',
    variant: 'admin',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold',
  },
  manager: {
    icon: Stethoscope,
    label: 'doctor',
    displayName: 'Doctor',
    variant: 'admin',
    className: 'border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold',
  },
  agent: {
    icon: UserIcon,
    label: 'staff',
    displayName: 'Staff',
    variant: 'staff',
    className: 'border-border bg-muted text-muted-foreground font-medium',
  },
  viewer: {
    icon: UserIcon,
    label: 'staff',
    displayName: 'Staff',
    variant: 'staff',
    className: 'border-border bg-transparent text-muted-foreground font-normal',
  },
};
