/**
 * Hospital Profile & Treatments Management Engine
 * Provides centralized storage, retrieval, and AI sync for hospital details and treatment catalog.
 */

export type TreatmentCategory = 
  | 'Skin' 
  | 'Laser' 
  | 'Aesthetic' 
  | 'Body' 
  | 'Hair' 
  | 'Wellness' 
  | 'Consultation';

export interface Treatment {
  id: string;
  name: string;
  category: TreatmentCategory;
  description: string;
  durationMinutes: number; // e.g. 45
  price: number;           // e.g. 3500
  currency: string;        // e.g. "₹"
  recommendedSittings: number; // e.g. 3
  sittingInterval: string;     // e.g. "Every 3-4 weeks"
  sittingIntervalDays: number; // e.g. 21
  preCareAdvice?: string;      // e.g. "Avoid direct sun exposure for 48h before procedure"
  postCareAdvice?: string;     // e.g. "Apply broad-spectrum SPF 50+ sunscreen and gentle moisturizer"
  isActive: boolean;
  isPopular?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DaySchedule {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  isOpen: boolean;
  openTime: string;  // e.g. "10:00 AM"
  closeTime: string; // e.g. "07:00 PM"
  hasLunchBreak?: boolean;
  lunchStart?: string; // e.g. "01:00 PM"
  lunchEnd?: string;   // e.g. "02:00 PM"
  notes?: string;      // e.g. "OPD & Laser Procedures"
}

export interface HospitalTimingsConfig {
  weekdayOpen: string;       // e.g. "10:00 AM"
  weekdayClose: string;      // e.g. "07:00 PM"
  lunchStart: string;        // e.g. "01:00 PM"
  lunchEnd: string;          // e.g. "02:00 PM"
  isSundayOpen: boolean;
  sundayOpen?: string;       // e.g. "10:00 AM"
  sundayClose?: string;      // e.g. "02:00 PM"
  emergencyTimingNote?: string; // e.g. "24/7 on-call for emergency cases"
  weeklySchedule: DaySchedule[];
}

export const DEFAULT_WEEKLY_SCHEDULE: DaySchedule[] = [
  { day: 'Monday', isOpen: true, openTime: '10:00 AM', closeTime: '07:00 PM', hasLunchBreak: true, lunchStart: '01:00 PM', lunchEnd: '02:00 PM', notes: 'Consultations & Laser' },
  { day: 'Tuesday', isOpen: true, openTime: '10:00 AM', closeTime: '07:00 PM', hasLunchBreak: true, lunchStart: '01:00 PM', lunchEnd: '02:00 PM', notes: 'Clinical Procedures' },
  { day: 'Wednesday', isOpen: true, openTime: '10:00 AM', closeTime: '07:00 PM', hasLunchBreak: true, lunchStart: '01:00 PM', lunchEnd: '02:00 PM', notes: 'Hair Restoration' },
  { day: 'Thursday', isOpen: true, openTime: '10:00 AM', closeTime: '07:00 PM', hasLunchBreak: true, lunchStart: '01:00 PM', lunchEnd: '02:00 PM', notes: 'Aesthetic Injectables' },
  { day: 'Friday', isOpen: true, openTime: '10:00 AM', closeTime: '07:00 PM', hasLunchBreak: true, lunchStart: '01:00 PM', lunchEnd: '02:00 PM', notes: 'Laser Skin Care' },
  { day: 'Saturday', isOpen: true, openTime: '10:00 AM', closeTime: '06:00 PM', hasLunchBreak: true, lunchStart: '01:00 PM', lunchEnd: '02:00 PM', notes: 'Full Consultations' },
  { day: 'Sunday', isOpen: false, openTime: '10:00 AM', closeTime: '02:00 PM', hasLunchBreak: false, notes: 'Weekly Holiday / Closed' },
];

export const DEFAULT_HOSPITAL_TIMINGS: HospitalTimingsConfig = {
  weekdayOpen: '10:00 AM',
  weekdayClose: '07:00 PM',
  lunchStart: '01:00 PM',
  lunchEnd: '02:00 PM',
  isSundayOpen: false,
  sundayOpen: '10:00 AM',
  sundayClose: '02:00 PM',
  emergencyTimingNote: 'Emergency on-call available 24/7 for post-procedure patients.',
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
};

export interface HospitalProfile {
  name: string;
  tagline: string;
  leadDoctor: string;
  doctorTitle: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram?: string;
  mapsUrl?: string;
  address: string;
  city: string;
  postalCode: string;
  emergencyContact: string;
  consultationFee: number;
  advanceTokenFee: number;
  clinicBalanceFee: number;
  currency: string;
  openingHoursSummary: string;
  aboutText: string;
  timings?: HospitalTimingsConfig;
  updatedAt: string;
}

export const DEFAULT_HOSPITAL_PROFILE: HospitalProfile = {
  name: 'La Fleur Aesthetic & Wellness Clinic',
  tagline: 'Advanced Clinical Aesthetics, Trichology & Aesthetic Medicine',
  leadDoctor: 'Dr. Mrinalini',
  doctorTitle: 'MD, Senior Aesthetic Specialist & Chief Physician',
  phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210',
  email: 'care@lafleurwellness.com',
  website: 'https://lafleurwellness.com',
  instagram: 'https://instagram.com/lafleur.clinic',
  mapsUrl: 'https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Bangalore',
  address: 'Suite 402, Green Glen Towers, Outer Ring Road',
  city: 'Bangalore',
  postalCode: '560103',
  emergencyContact: '+91 98765 00112',
  consultationFee: 500,
  advanceTokenFee: 300,
  clinicBalanceFee: 200,
  currency: '₹',
  openingHoursSummary: 'Monday – Saturday: 10:00 AM – 07:00 PM (Closed on Sunday)',
  aboutText: 'Premier center for evidence-based clinical aesthetics, advanced laser skin rejuvenation, anti-aging therapies, and personalized hair restoration under Dr. Mrinalini. Tied up with leading plastic surgeons in the city.',
  timings: DEFAULT_HOSPITAL_TIMINGS,
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_TREATMENTS: Treatment[] = [
  {
    id: 'trt-lhr',
    name: 'Laser Hair Reduction',
    category: 'Laser',
    description: 'US-FDA approved triple-wavelength diode laser targeting hair follicles safely for painless, permanent hair reduction across Indian skin types.',
    durationMinutes: 45,
    price: 4999,
    currency: '₹',
    recommendedSittings: 6,
    sittingInterval: '4-6 weeks',
    sittingIntervalDays: 28,
    preCareAdvice: 'Shave the treatment area 24 hours prior. Do not wax, pluck, or bleach for 3 weeks before.',
    postCareAdvice: 'Apply cooling aloe vera gel or prescribed calming cream. Strictly avoid sun exposure for 48 hours.',
    isActive: true,
    isPopular: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-carbon-laser',
    name: 'Carbon Laser Hollywood Peel',
    category: 'Laser',
    description: 'Q-Switched Nd:YAG laser with liquid carbon for instantaneous porcelain glow, sebum control, blackhead clearance, and pore tightening.',
    durationMinutes: 45,
    price: 3800,
    currency: '₹',
    recommendedSittings: 4,
    sittingInterval: '3-4 weeks',
    sittingIntervalDays: 21,
    preCareAdvice: 'No chemical exfoliants 3 days prior.',
    postCareAdvice: 'Keep skin hydrated. Mild redness subsides within 1-2 hours.',
    isActive: true,
    isPopular: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-prp-hair',
    name: 'PRP Hair Therapy & Scalp Restoration',
    category: 'Hair',
    description: 'Autologous Platelet-Rich Plasma micro-injections concentrated with growth factors to stimulate dormant hair follicles and reverse thinning.',
    durationMinutes: 60,
    price: 4500,
    currency: '₹',
    recommendedSittings: 4,
    sittingInterval: '3-4 weeks',
    sittingIntervalDays: 21,
    preCareAdvice: 'Wash hair with mild shampoo on the morning of procedure. Drink plenty of water.',
    postCareAdvice: 'Avoid washing hair for 24 hours. Do not use hair dyes or harsh styling products for 48 hours.',
    isActive: true,
    isPopular: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-gfc-hair',
    name: 'GFC Hair Restoration',
    category: 'Hair',
    description: 'Advanced Growth Factor Concentrate therapy extracted from patient blood to regenerate hair density with zero downtime.',
    durationMinutes: 45,
    price: 6500,
    currency: '₹',
    recommendedSittings: 3,
    sittingInterval: '4 weeks',
    sittingIntervalDays: 28,
    preCareAdvice: 'Hydrate well before session. Clean scalp.',
    postCareAdvice: 'Avoid intense workouts for 24 hours.',
    isActive: true,
    isPopular: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-hydrafacial',
    name: 'HydraFacial Deluxe',
    category: 'Skin',
    description: 'Medical-grade hydra-dermabrasion vortex cleansing, painless extraction, peptide infusion, and deep antioxidant hydration.',
    durationMinutes: 45,
    price: 3500,
    currency: '₹',
    recommendedSittings: 3,
    sittingInterval: '4 weeks',
    sittingIntervalDays: 28,
    preCareAdvice: 'Avoid active retinoids or strong exfoliants 48 hours prior to treatment.',
    postCareAdvice: 'Apply broad-spectrum SPF 50+ sunscreen daily and avoid steam/sauna for 24 hours.',
    isActive: true,
    isPopular: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-pigmentation',
    name: 'Pigmentation & Chemical Peels',
    category: 'Skin',
    description: 'Targeted AHA/BHA chemical peels for active acne marks, stubborn dark spots, uneven skin tone, and cellular renewal.',
    durationMinutes: 30,
    price: 2200,
    currency: '₹',
    recommendedSittings: 4,
    sittingInterval: '2-3 weeks',
    sittingIntervalDays: 14,
    preCareAdvice: 'Stop using AHA/BHA serums and tretinoin 3 days prior.',
    postCareAdvice: 'Do not pick or peel flaking skin. Moisturize frequently with ceramide cream and apply SPF 50+.',
    isActive: true,
    isPopular: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-skin-tightening',
    name: 'Skin Tightening (RF / MNRF)',
    category: 'Skin',
    description: 'Fractional radiofrequency microneedling with dermal subcision to stimulate collagen remodeling and smooth depressed acne scars and textural irregularities.',
    durationMinutes: 60,
    price: 5500,
    currency: '₹',
    recommendedSittings: 4,
    sittingInterval: '3-4 weeks',
    sittingIntervalDays: 21,
    preCareAdvice: 'No harsh peels or active breakouts in the targeted zone.',
    postCareAdvice: 'Apply antibiotic calming balm for 48 hours. Mild grid redness resolves in 3-4 days.',
    isActive: true,
    isPopular: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-botox',
    name: 'Anti-Aging & Botox',
    category: 'Aesthetic',
    description: 'US-FDA approved botulinum toxin micro-injections for forehead lines, crow\'s feet, frown lines, and facial contouring by Dr. Mrinalini.',
    durationMinutes: 30,
    price: 8500,
    currency: '₹',
    recommendedSittings: 1,
    sittingInterval: '4-6 months',
    sittingIntervalDays: 150,
    preCareAdvice: 'Avoid blood-thinning supplements (Vitamin E, fish oil, aspirin) for 3 days before procedure.',
    postCareAdvice: 'Remain upright for 4 hours post-injection. Avoid strenuous exercise and facial massages for 24 hours.',
    isActive: true,
    isPopular: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-fillers',
    name: 'Dermal Fillers & Lip Enhancement',
    category: 'Aesthetic',
    description: 'Premium hyaluronic acid fillers for cheek volume restoration, tear trough under-eye correction, and natural lip definition.',
    durationMinutes: 45,
    price: 18000,
    currency: '₹',
    recommendedSittings: 1,
    sittingInterval: '9-12 months',
    sittingIntervalDays: 300,
    preCareAdvice: 'Avoid alcohol and anti-inflammatory medications for 48 hours prior.',
    postCareAdvice: 'Apply cold compress if minor swelling occurs. Avoid dental work or intense pressure for 2 weeks.',
    isActive: true,
    isPopular: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-body-contouring',
    name: 'Body Contouring & Cellulite Reduction',
    category: 'Body',
    description: 'Non-invasive acoustic wave and radiofrequency body sculpting targeting stubborn subcutaneous fat and skin tightening.',
    durationMinutes: 60,
    price: 7500,
    currency: '₹',
    recommendedSittings: 6,
    sittingInterval: '2 weeks',
    sittingIntervalDays: 14,
    preCareAdvice: 'Drink 2 liters of water before treatment.',
    postCareAdvice: 'Engage in light 20-minute cardio walk post procedure.',
    isActive: true,
    isPopular: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'trt-consultation',
    name: 'Clinical Consultation',
    category: 'Consultation',
    description: 'Comprehensive clinical analysis, personalized skin barrier diagnosis, and customized medical prescription by Dr. Mrinalini.',
    durationMinutes: 20,
    price: 500,
    currency: '₹',
    recommendedSittings: 1,
    sittingInterval: 'As advised',
    sittingIntervalDays: 30,
    preCareAdvice: 'Bring any current skincare products or medications you are using.',
    postCareAdvice: 'Follow the prescribed clinical routine and scheduled follow-up visits.',
    isActive: true,
    isPopular: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
];

export const HOSPITAL_PROFILE_STORAGE_KEY = 'wacrm_hospital_profile_v1';
export const TREATMENTS_STORAGE_KEY = 'wacrm_hospital_treatments_v1';

export function getRuntimeHospitalProfile(): HospitalProfile {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(HOSPITAL_PROFILE_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_HOSPITAL_PROFILE, ...JSON.parse(stored) };
      }
    } catch {}
  }
  return DEFAULT_HOSPITAL_PROFILE;
}

export function saveHospitalProfile(profile: HospitalProfile): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(HOSPITAL_PROFILE_STORAGE_KEY, JSON.stringify({
        ...profile,
        updatedAt: new Date().toISOString(),
      }));
    } catch {}
  }
}

export function getRuntimeTreatments(): Treatment[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(TREATMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return DEFAULT_TREATMENTS;
}

export function saveTreatments(treatments: Treatment[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TREATMENTS_STORAGE_KEY, JSON.stringify(treatments));
    } catch {}
  }
}

/**
 * Builds a structured knowledge summary of hospital details and treatments for LLM context.
 */
export function buildHospitalKnowledgeText(profile?: HospitalProfile, treatments?: Treatment[]): string {
  const p = profile || getRuntimeHospitalProfile();
  const trts = (treatments || getRuntimeTreatments()).filter(t => t.isActive);

  let text = `=== CLINIC / HOSPITAL PROFILE ===\n`;
  text += `Hospital Name: ${p.name}\n`;
  text += `Tagline: ${p.tagline}\n`;
  text += `Sole Doctor: ${p.leadDoctor} (${p.doctorTitle})\n`;
  text += `Contact WhatsApp / Phone: ${p.whatsapp || p.phone}\n`;
  text += `Email: ${p.email}\n`;
  text += `Address: ${p.address}, ${p.city} - ${p.postalCode}\n`;
  text += `Emergency Contact: ${p.emergencyContact}\n`;
  text += `Consultation Fee: ${p.currency}${p.consultationFee}\n`;
  text += `Working Hours: ${p.openingHoursSummary}\n`;
  text += `About: ${p.aboutText}\n\n`;

  text += `=== ACTIVE TREATMENTS & PROCEDURES CATALOG (${trts.length} Available) ===\n`;
  trts.forEach((t, idx) => {
    text += `${idx + 1}. ${t.name} [${t.category}]\n`;
    text += `   - Price: ${t.currency}${t.price.toLocaleString('en-IN')}\n`;
    text += `   - Duration: ${t.durationMinutes} minutes\n`;
    text += `   - Recommended Sittings: ${t.recommendedSittings} sitting${t.recommendedSittings > 1 ? 's' : ''} (${t.sittingInterval})\n`;
    text += `   - Description: ${t.description}\n`;
    if (t.preCareAdvice) text += `   - Pre-Care: ${t.preCareAdvice}\n`;
    if (t.postCareAdvice) text += `   - Post-Care: ${t.postCareAdvice}\n`;
    text += `\n`;
  });

  return text;
}
