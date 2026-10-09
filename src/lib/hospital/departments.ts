/**
 * Hospital Clinical Departments Management
 */

export interface Department {
  id: string;
  name: string;
  description: string;
  leadSpecialist: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'dept-skin',
    name: 'Dermatology & Skin Care',
    description: 'Clinical skin therapies, chemical peels, acne treatments, and medical dermatology under Dr. Mrinalini.',
    leadSpecialist: 'Dr. Mrinalini',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dept-laser',
    name: 'Laser & Aesthetics',
    description: 'Triple-wavelength diode laser hair reduction, carbon laser peel, and scar revision.',
    leadSpecialist: 'Dr. Mrinalini',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dept-hair',
    name: 'Trichology & Hair Restoration',
    description: 'GFC therapy, PRP hair restoration, mesotherapy, and scalp rejuvenation protocols.',
    leadSpecialist: 'Dr. Mrinalini',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dept-antiaging',
    name: 'Anti-Aging & Cosmetology',
    description: 'Botox, dermal fillers, collagen induction therapy, HIFU skin tightening, and thread lifts.',
    leadSpecialist: 'Dr. Mrinalini',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dept-wellness',
    name: 'Wellness & Body Contouring',
    description: 'IV glutathione therapy, vitamin drips, and body sculpting treatments.',
    leadSpecialist: 'Dr. Mrinalini',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dept-consultation',
    name: 'Clinical Consultation',
    description: 'Comprehensive diagnostic consultations, skin & hair barrier analysis, and personalized medical prescription.',
    leadSpecialist: 'Dr. Mrinalini',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const DEPARTMENTS_STORAGE_KEY = 'wacrm_hospital_departments_v1';

export function getRuntimeDepartments(): Department[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return DEFAULT_DEPARTMENTS;
}

export function saveDepartments(departments: Department[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(departments));
      window.dispatchEvent(new Event('departments-updated'));
    } catch {}
  }
}

/**
 * Match or resolve legacy short category names to full active clinical department names.
 */
export function matchDepartmentName(category: string, departments: Department[]): string {
  if (!category) return departments[0]?.name || 'Dermatology & Skin Care';
  const trimmed = category.trim();
  const exact = departments.find(d => d.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact.name;

  const lower = trimmed.toLowerCase();
  if (lower.includes('skin')) {
    return departments.find(d => d.name.toLowerCase().includes('skin'))?.name || 'Dermatology & Skin Care';
  }
  if (lower.includes('laser')) {
    return departments.find(d => d.name.toLowerCase().includes('laser'))?.name || 'Laser & Aesthetics';
  }
  if (lower.includes('hair') || lower.includes('tricho')) {
    return departments.find(d => d.name.toLowerCase().includes('hair') || d.name.toLowerCase().includes('tricho'))?.name || 'Trichology & Hair Restoration';
  }
  if (lower.includes('aging') || lower.includes('aesthetic') || lower.includes('cosmeto') || lower.includes('botox')) {
    return departments.find(d => d.name.toLowerCase().includes('anti-aging') || d.name.toLowerCase().includes('cosmeto'))?.name || 'Anti-Aging & Cosmetology';
  }
  if (lower.includes('body') || lower.includes('wellness')) {
    return departments.find(d => d.name.toLowerCase().includes('wellness') || d.name.toLowerCase().includes('body'))?.name || 'Wellness & Body Contouring';
  }
  if (lower.includes('consult')) {
    return departments.find(d => d.name.toLowerCase().includes('consult'))?.name || 'Clinical Consultation';
  }

  return trimmed;
}
