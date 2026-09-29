/**
 * Doctor Availability & Holiday Management System
 * Handles doctor status (Available, Away, Holiday, In Surgery), date ranges (From - To),
 * covering doctors, and WhatsApp patient auto-replies.
 */

export type DoctorStatusType = 'available' | 'away' | 'holiday' | 'in_surgery' | 'off_duty';

export interface DoctorAvailability {
  id: string;
  doctorId: string;
  doctorName: string;
  title: string;
  department: string;
  avatarUrl?: string;
  status: DoctorStatusType;
  // Active away / holiday schedule details:
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  startTime?: string; // e.g. "10:00 AM" (optional for partial day away)
  endTime?: string;   // e.g. "04:00 PM"
  reason?: string;    // e.g. "Annual Leave / Holiday", "Medical Conference in London", "Personal Emergency"
  coveringDoctor?: string; // e.g. "Dr. Shalini Roy"
  autoReplyNotice?: string;
  emergencyContact?: string;
  updatedAt: string;
}

export interface DoctorHolidayRecord {
  id: string;
  doctorId: string;
  doctorName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  coveringDoctor?: string;
  status: 'active' | 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface HospitalConfig {
  hospitalName: string;
  doctorName: string;
  title: string;
  openingTime: string; // e.g. "10:00 AM"
  closingTime: string; // e.g. "07:00 PM"
  lunchStartTime: string; // e.g. "01:00 PM"
  lunchEndTime: string; // e.g. "02:00 PM"
  standardSlots: string[];
  status: 'online' | 'offline' | 'holiday';
  offlineReturnTime?: string; // e.g. "03:00 PM" or "Tomorrow 10:00 AM"
  offlineReason?: string; // e.g. "Lunch Break", "Clinical Procedure", "Out of Office"
  holidayStartDate?: string; // YYYY-MM-DD
  holidayEndDate?: string; // YYYY-MM-DD
  holidayReason?: string;
  googleCalendarUrl?: string;
  updatedAt: string;
}

export const DEFAULT_HOSPITAL_CONFIG: HospitalConfig = {
  hospitalName: 'La Fleur Aesthetic & Wellness Clinic',
  doctorName: 'Dr. Mrinalini',
  title: 'Chief Dermatologist & Aesthetic Physician',
  openingTime: '10:00 AM',
  closingTime: '07:00 PM',
  lunchStartTime: '01:00 PM',
  lunchEndTime: '02:00 PM',
  standardSlots: ['10:30 AM', '11:30 AM', '02:30 PM', '04:00 PM', '05:30 PM'],
  status: 'online',
  offlineReturnTime: '02:00 PM',
  offlineReason: 'Lunch Break',
  holidayStartDate: '',
  holidayEndDate: '',
  holidayReason: 'Annual Leave / Vacation',
  googleCalendarUrl: 'https://calendar.google.com',
  updatedAt: new Date().toISOString()
};

export const DEFAULT_DOCTORS: DoctorAvailability[] = [
  {
    id: 'doc-mrinalini',
    doctorId: 'doc-mrinalini',
    doctorName: 'Dr. Mrinalini',
    title: 'Chief Dermatologist & Aesthetic Physician',
    department: 'Dermatology, Trichology & Aesthetic Medicine',
    status: 'available',
    updatedAt: new Date().toISOString(),
  }
];

export function getRuntimeHospitalConfig(): HospitalConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(HOSPITAL_CONFIG_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_HOSPITAL_CONFIG, ...JSON.parse(stored) };
      }
    } catch {}
  }
  return DEFAULT_HOSPITAL_CONFIG;
}

export const HOLIDAY_REASON_PRESETS = [
  'Annual Vacation / Holiday',
  'Medical Conference / CME Workshop',
  'Personal / Family Leave',
  'Medical / Sick Leave',
  'Out of Station / Travel',
  'Emergency Leave',
  'Administrative / Research Duty'
];

export const HOSPITAL_CONFIG_STORAGE_KEY = 'wacrm_hospital_config_v1';
export const DOCTOR_STORAGE_KEY = 'wacrm_doctor_availability_v1';
export const HOLIDAY_HISTORY_STORAGE_KEY = 'wacrm_doctor_holidays_history_v1';

/**
 * Format date string (YYYY-MM-DD) into readable format like "24 Sep 2026"
 */
export function formatReadableDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format "when to when" date range string (e.g. "24 Sep 2026 – 28 Sep 2026")
 */
export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '';
  if (startDate && !endDate) return `From ${formatReadableDate(startDate)}`;
  if (!startDate && endDate) return `Until ${formatReadableDate(endDate)}`;
  
  const startFormatted = formatReadableDate(startDate);
  const endFormatted = formatReadableDate(endDate);
  
  if (startFormatted === endFormatted) {
    return startFormatted;
  }
  return `${startFormatted} – ${endFormatted}`;
}

/**
 * Check if targetDate falls within [startDate, endDate] inclusive
 */
export function isDateWithinRange(targetDate: string | Date, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return false;
  
  try {
    const target = typeof targetDate === 'string' 
      ? new Date(targetDate.split('T')[0] + 'T00:00:00').getTime()
      : new Date(targetDate.toISOString().split('T')[0] + 'T00:00:00').getTime();

    if (isNaN(target)) return false;

    const start = startDate ? new Date(startDate.split('T')[0] + 'T00:00:00').getTime() : -Infinity;
    const end = endDate ? new Date(endDate.split('T')[0] + 'T23:59:59').getTime() : Infinity;

    return target >= start && target <= end;
  } catch {
    return false;
  }
}

/**
 * Check if a doctor is currently away or on holiday on a specific date
 */
export function isDoctorAway(
  doctor: DoctorAvailability,
  targetDate: string | Date = new Date()
): boolean {
  if (doctor.status === 'available') {
    return false;
  }

  // If status is away/holiday, check date range if specified
  if (doctor.status === 'away' || doctor.status === 'holiday') {
    if (doctor.startDate || doctor.endDate) {
      return isDateWithinRange(targetDate, doctor.startDate, doctor.endDate);
    }
    // If no dates set but status is away/holiday, treat as currently away
    return true;
  }

  // In surgery / off duty is immediate/active
  if (doctor.status === 'in_surgery' || doctor.status === 'off_duty') {
    const todayStr = new Date().toISOString().split('T')[0];
    const checkStr = typeof targetDate === 'string' ? targetDate.split('T')[0] : targetDate.toISOString().split('T')[0];
    return todayStr === checkStr;
  }

  return false;
}

/**
 * Generate human-readable WhatsApp auto-reply notice for when a doctor is away
 */
export function generateDoctorAwayNotice(doctor: DoctorAvailability): string {
  const dateRangeStr = formatDateRange(doctor.startDate, doctor.endDate);
  const doctorName = doctor.doctorName || 'The Doctor';
  const covering = doctor.coveringDoctor ? ` (${doctor.coveringDoctor} is covering consultations)` : '';
  const reasonText = doctor.reason ? ` for ${doctor.reason}` : '';

  if (doctor.status === 'holiday' || doctor.status === 'away') {
    if (dateRangeStr) {
      return `${doctorName} is away on holiday from ${dateRangeStr}${reasonText}.${covering} Urgent appointments can be scheduled with our covering specialist.`;
    }
    return `${doctorName} is temporarily away${reasonText}.${covering} Consultations will resume shortly.`;
  }

  if (doctor.status === 'in_surgery') {
    const timeText = doctor.endTime ? ` until ${doctor.endTime}` : ' for the next few hours';
    return `${doctorName} is currently in a clinical procedure/surgery${timeText}. Consultations will resume as soon as the procedure concludes.`;
  }

  if (doctor.status === 'off_duty') {
    return `${doctorName} is currently off-duty. OPD hours resume tomorrow at 10:00 AM.`;
  }

  return `${doctorName} is currently unavailable.`;
}

/**
 * Get status label and color classes for UI badges
 */
export function getDoctorStatusMeta(status: DoctorStatusType): {
  label: string;
  badgeClass: string;
  dotClass: string;
  icon: string;
} {
  switch (status) {
    case 'available':
      return {
        label: 'Active & Available',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        dotClass: 'bg-emerald-500 animate-pulse',
        icon: '🟢'
      };
    case 'holiday':
      return {
        label: 'Away on Holiday',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
        dotClass: 'bg-purple-500',
        icon: '🏖️'
      };
    case 'away':
      return {
        label: 'Doctor Away',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        dotClass: 'bg-amber-500',
        icon: '🟡'
      };
    case 'in_surgery':
      return {
        label: 'In Surgery',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        dotClass: 'bg-rose-500 animate-ping',
        icon: '🔴'
      };
    case 'off_duty':
      return {
        label: 'Off Duty',
        badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
        dotClass: 'bg-slate-400',
        icon: '⚪'
      };
    default:
      return {
        label: 'Unknown',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
        icon: '⚪'
      };
  }
}
