/**
 * WhatsApp Hospital AI Engine
 * Full multi-provider support (Gemini, OpenAI, Groq, Claude, Custom)
 * + Zero-config free cloud inference + Resilient stateful multi-turn clinical reasoning engine.
 */

export interface AIRequestOptions {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  knowledgeContext?: string;
  llmConfig?: {
    provider?: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'custom';
    apiKey?: string;
    model?: string;
    customBaseUrl?: string;
    temperature?: number;
    maxTokens?: number;
  };
  existingAppointments?: Array<{
    patient_name?: string;
    date?: string;
    time?: string;
    department?: string;
  }>;
  hospitalProfile?: Partial<HospitalProfile>;
  /** Account's treatment catalog; defaults to the built-in catalog. */
  treatments?: Treatment[];
  senderPhone?: string;
  senderName?: string;
}

export interface AIResponseResult {
  reply: string;
  isAppointmentCard: boolean;
  appointmentData: {
    booking_id?: string;
    patient_name: string;
    phone_number: string;
    date: string;
    time: string;
    department: string;
    doctor?: string;
    current_sitting?: number;
    total_sittings?: number;
    sitting_interval?: string;
    sitting_interval_days?: number;
    sitting?: string;
  } | null;
  provider: string;
  model: string;
}

/**
 * Generates an official, unique clinical booking ID.
 * Format: LF-YYYYMMDD-XXXX (e.g. LF-20261007-8492)
 */
export function generateBookingId(dateStr?: string): string {
  const cleanDate = (dateStr || '').replace(/\D/g, '').slice(0, 8);
  const datePart = cleanDate.length === 8 ? cleanDate : new Date().toISOString().slice(0, 10).replace(/\D/g, '');
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `LF-${datePart}-${randomDigits}`;
}

import { 
  DEFAULT_DOCTORS, 
  DOCTOR_STORAGE_KEY, 
  DoctorAvailability, 
  isDoctorAway, 
  formatDateRange,
  formatReadableDate,
  getRuntimeHospitalConfig,
  HospitalConfig,
  isTimeInLunchBreak,
  isTimeOutsideWorkingHours
} from '@/lib/doctor/availability';

import { DEFAULT_LA_FLEUR_SYSTEM_PROMPT } from '@/lib/ai/assistant-defaults';
import {
  getRuntimeHospitalProfile,
  getRuntimeTreatments,
  buildHospitalKnowledgeText,
  HospitalProfile,
  Treatment
} from '@/lib/hospital/treatments';

/**
 * Strips all emojis and smileys from response text to maintain strict clinical tone.
 */
export function removeEmojisAndSmileys(text: string): string {
  if (!text) return '';
  return text
    // Normalize unicode non-breaking spaces and typography spaces
    .replace(/[\u202f\u00a0\u2000-\u200b\uFEFF]/g, ' ')
    // Normalize unicode dashes
    .replace(/[\u2010-\u2015]/g, '-')
    // Remove standard Unicode emojis & symbols
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    // Remove common text smileys like :) :-) :D ;) :-( but preserve URLs (https://) and numbers/times
    .replace(/(?<!https?)(?<![a-zA-Z0-9])[:;=8][\-o*']?[\)\]\(\[dDpP\}\{](?![a-zA-Z0-9])/g, '')
    .trim();
}

function getRuntimeDoctors(): DoctorAvailability[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(DOCTOR_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return DEFAULT_DOCTORS;
}

function getRuntimeKnowledgeContext(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('wacrm_knowledge_items');
      if (stored) {
        const items = JSON.parse(stored);
        if (Array.isArray(items)) {
          const enabled = items.filter((item: any) => item.isEnabled);
          if (enabled.length > 0) {
            return enabled.map((item: any) => `[${item.category?.toUpperCase() || 'GENERAL'}] ${item.title}:\n${item.content}`).join('\n\n');
          }
        }
      }
    } catch {}
  }
  return '';
}

const STANDARD_SLOTS = ["10:30 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM", "06:30 PM"];

/**
 * Helper to compute real-time dynamic date objects & strings in Asia/Kolkata (IST)
 */
export function getClinicalCalendarInfo(baseDate: Date = new Date()) {
  const timeZone = 'Asia/Kolkata';

  // Format date in IST (Asia/Kolkata)
  let istDateStr = '';
  try {
    istDateStr = baseDate.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
  } catch {
    istDateStr = baseDate.toISOString().split('T')[0];
  }
  
  const [yearStr, monthStr, dayStr] = (istDateStr || '2026-10-06').split('-');
  const year = parseInt(yearStr, 10) || baseDate.getFullYear();
  const monthNum = parseInt(monthStr, 10) || (baseDate.getMonth() + 1);
  const dayNum = parseInt(dayStr, 10) || baseDate.getDate();

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  let todayDayName = 'Tuesday';
  try {
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' });
    todayDayName = weekdayFormatter.format(baseDate);
  } catch {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    todayDayName = dayNames[baseDate.getDay()];
  }
  const monthName = monthNames[monthNum] || 'October';

  const todayStr = istDateStr;
  const todayFormatted = `${todayDayName}, ${dayNum} ${monthName} ${year}`;

  let currentTimeStr = '11:00 AM';
  let currentHour24 = 11;
  let currentMinute = 0;
  try {
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    currentTimeStr = timeFormatter.format(baseDate);

    const hour24Formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const time24Str = hour24Formatter.format(baseDate);
    const [h24Str, mStr] = time24Str.split(':');
    currentHour24 = parseInt(h24Str, 10) || 0;
    currentMinute = parseInt(mStr, 10) || 0;
  } catch {
    currentTimeStr = baseDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    currentHour24 = baseDate.getHours();
    currentMinute = baseDate.getMinutes();
  }
  const currentMinutesFromMidnight = currentHour24 * 60 + currentMinute;

  // Calculate Tomorrow in IST by adding 24 hours
  const tomorrowTimestamp = baseDate.getTime() + 24 * 60 * 60 * 1000;
  const tomDate = new Date(tomorrowTimestamp);
  let tomDateStr = '';
  let tomorrowDayName = 'Wednesday';
  try {
    tomDateStr = tomDate.toLocaleDateString('en-CA', { timeZone });
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' });
    tomorrowDayName = weekdayFormatter.format(tomDate);
  } catch {
    tomDateStr = tomDate.toISOString().split('T')[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    tomorrowDayName = dayNames[tomDate.getDay()];
  }
  const [tomYearStr, tomMonthStr, tomDayStr] = (tomDateStr || '2026-10-07').split('-');
  const tomYear = parseInt(tomYearStr, 10) || year;
  const tomMonthNum = parseInt(tomMonthStr, 10) || monthNum;
  const tomDayNum = parseInt(tomDayStr, 10) || (dayNum + 1);
  const tomorrowStr = tomDateStr;
  const tomorrowFormatted = `${tomorrowDayName}, ${tomDayNum} ${monthNames[tomMonthNum] || 'October'} ${tomYear}`;

  const allStandardSlots = ["10:30 AM", "11:30 AM", "02:30 PM", "04:00 PM", "05:30 PM"];

  const slotMinutesMap: Record<string, number> = {
    "10:30 AM": 10 * 60 + 30,
    "11:30 AM": 11 * 60 + 30,
    "02:00 PM": 14 * 60,
    "02:30 PM": 14 * 60 + 30,
    "03:30 PM": 15 * 60 + 30,
    "04:00 PM": 16 * 60,
    "05:00 PM": 17 * 60,
    "05:30 PM": 17 * 60 + 30,
    "06:30 PM": 18 * 60 + 30
  };

  // Remaining slots today that are at least 30 minutes in the future
  const remainingTodaySlots = allStandardSlots.filter(s => {
    const sMin = slotMinutesMap[s];
    return sMin !== undefined && sMin > (currentMinutesFromMidnight + 30);
  });

  // Clinic consultation hours closed for today if after 5:30 PM (17:30) or no slots left
  const isTodayClinicClosed = remainingTodaySlots.length === 0 || currentMinutesFromMidnight >= (17 * 60 + 30);

  return {
    today: baseDate,
    todayStr,
    todayDayName,
    todayFormatted,
    currentTimeStr,
    currentHour24,
    currentMinute,
    isTodayClinicClosed,
    remainingTodaySlots,
    tomorrow: tomDate,
    tomorrowStr,
    tomorrowDayName,
    tomorrowFormatted,
    year,
    standardSlots: allStandardSlots
  };
}

/** Shift a YYYY-MM-DD calendar date by whole days (timezone independent). */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD for a calendar date, or null if it doesn't exist (e.g. 31 Feb). */
function isoFromParts(year: number, monthIdx: number, day: number): string | null {
  const d = new Date(Date.UTC(year, monthIdx, day));
  if (d.getUTCMonth() !== monthIdx || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

const MONTHS: Array<[string, number]> = [
  ['jan(?:uary)?', 0], ['feb(?:ruary)?', 1], ['mar(?:ch)?', 2], ['apr(?:il)?', 3],
  ['may', 4], ['june?', 5], ['july?', 6], ['aug(?:ust)?', 7],
  ['sep(?:t(?:ember)?)?', 8], ['oct(?:ober)?', 9], ['nov(?:ember)?', 10], ['dec(?:ember)?', 11],
];

const WEEKDAYS: Array<[RegExp, number]> = [
  [/\bsun(?:day)?\b/, 0], [/\bmon(?:day)?\b/, 1], [/\btue(?:s|sday)?\b/, 2], [/\bwed(?:nesday)?\b/, 3],
  [/\bthu(?:r|rs|rsday)?\b/, 4], [/\bfri(?:day)?\b/, 5], [/\bsat(?:urday)?\b/, 6],
];

/**
 * Resolve a patient- or model-supplied date to a YYYY-MM-DD booking date.
 *
 * Works purely on calendar dates relative to `todayStr` (the clinic's IST
 * date), so it gives the same answer whatever timezone the server runs in.
 * Numeric dates are read day-first (10/11/2026 = 10 November), as written in
 * India. Dates without a year that have already passed roll to next year.
 */
export function parseRequestedBookingDate(dateInput: string | undefined, todayStr: string, tomorrowStr: string): string {
  if (!dateInput) return tomorrowStr;
  const lower = dateInput.toLowerCase().trim();
  if (/^today\b/.test(lower)) return todayStr;
  if (/^tomorrow\b/.test(lower)) return tomorrowStr;

  const [todayY, todayM] = todayStr.split('-').map(Number);
  const futureOrNextYear = (monthIdx: number, day: number, year?: number): string | null => {
    const iso = isoFromParts(year ?? todayY, monthIdx, day);
    if (!iso) return null;
    if (year === undefined && iso < todayStr) return isoFromParts(todayY + 1, monthIdx, day);
    return iso < todayStr ? todayStr : iso;
  };

  // 1. ISO YYYY-MM-DD anywhere in the string
  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const iso = isoFromParts(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    if (iso) return iso >= todayStr ? iso : todayStr;
  }

  // 2. Numeric day-first dates: 10/11/2026, 10-11-26, 10.11
  const numMatch = lower.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?\b(?!\s*(?:am|pm)\b)/);
  if (numMatch) {
    let day = Number(numMatch[1]);
    let month = Number(numMatch[2]);
    if (month > 12 && day <= 12) [day, month] = [month, day]; // unambiguous month-first
    const year = numMatch[3] ? (numMatch[3].length === 2 ? 2000 + Number(numMatch[3]) : Number(numMatch[3])) : undefined;
    const iso = month >= 1 && month <= 12 ? futureOrNextYear(month - 1, day, year) : null;
    if (iso) return iso;
  }

  // 3. Month name next to a day: "15 October", "Oct 15th", "Thursday, 15 October 2026"
  for (const [month, monthIdx] of MONTHS) {
    const m = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+${month}\\b|\\b${month}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
    if (m) {
      const yearMatch = lower.match(/\b(20\d{2})\b/);
      const iso = futureOrNextYear(monthIdx, Number(m[1] ?? m[2]), yearMatch ? Number(yearMatch[1]) : undefined);
      if (iso) return iso;
    }
  }

  // 4. Weekday name: the next occurrence after today
  const weekdayHit = WEEKDAYS.find(([re]) => re.test(lower));
  if (weekdayHit) {
    const todayDow = new Date(`${todayStr}T00:00:00Z`).getUTCDay();
    let diff = weekdayHit[1] - todayDow;
    if (diff <= 0) diff += 7;
    return addDaysIso(todayStr, diff);
  }

  // 5. Day of month only: "15th", "the 5th", "15" — this month, or next if passed
  const dayOnly = lower.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/) || lower.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    let iso = isoFromParts(todayY, todayM - 1, day);
    if (!iso || iso < todayStr) {
      const next = todayM === 12 ? [todayY + 1, 0] : [todayY, todayM];
      iso = isoFromParts(next[0], next[1], day);
    }
    if (iso) return iso;
  }

  return tomorrowStr;
}

import { formatProperName } from '@/lib/format-name';
export { formatProperName };

/**
 * Checks if a phone number is a known dummy/placeholder or invalid
 */
export function isDummyPhoneNumber(p?: string | null): boolean {
  if (!p) return true;
  const digits = p.replace(/\D/g, '');
  const dummyNumbers = new Set([
    '919876543210',
    '9876543210',
    '911234567890',
    '1234567890',
    '0000000000',
    '9999999999',
    '1111111111',
  ]);
  return dummyNumbers.has(digits) || digits.length < 8;
}

/**
 * Sanitizes and rewrites any hallucinated model meta-phrases about duplicated names or formats.
 */
export function cleanAIOutputReplies(
  reply: string, 
  currentMessage?: string,
  hospitalProfile?: Partial<HospitalProfile>,
  appointmentData?: AIResponseResult['appointmentData'] | null,
  senderPhone?: string,
  senderName?: string
): string {
  if (!reply || typeof reply !== "string") return "";
  let text = reply;

  const consultationFee = hospitalProfile?.consultationFee ?? 500;
  const bookingFee = hospitalProfile?.advanceTokenFee ?? 100;
  const clinicCurrency = hospitalProfile?.currency || '₹';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-monkey-950817.hostingersite.com';

  // Fix LLM meta-responses talking about "duplicated format", "without duplication", "without any repetition"
  if (
    /rather than a duplicated format/i.test(text) ||
    /without duplication/i.test(text) ||
    /without any repetition/i.test(text) ||
    /in the standard format.*without/i.test(text) ||
    /Thank you for providing "[^"]{2,}"/i.test(text)
  ) {
    const quotedMatch = text.match(/Thank you for providing "([^"]+)"/i);
    let resolvedName = "";
    if (quotedMatch && quotedMatch[1]) {
      resolvedName = formatProperName(quotedMatch[1]);
    } else if (currentMessage) {
      resolvedName = formatProperName(currentMessage);
    }

    if (resolvedName && resolvedName !== "Patient") {
      text = text.replace(/Thank you for providing "[^"]+"[^\r\n]*(?:\r?\n)*/gi, "Thank you, " + resolvedName + "!\n\n");
      text = text.replace(/(?:To ensure accuracy|For our records|To ensure your booking|Please provide your Full Name)[^\r\n]*(?:without duplication|without any repetition|duplicated format|standard format)[^\r\n]*\.?(?:\r?\n)*/gi, "");
    }
  }

  // Also replace any remaining concatenated name patterns in quotes like "arbazarbaz" or "arbaz khanarbaz khan"
  text = text.replace(/"([a-zA-Z\s]{4,})"/g, (match, p1) => {
    const formatted = formatProperName(p1);
    if (formatted && formatted.toLowerCase() !== p1.toLowerCase()) {
      return "\"" + formatted + "\"";
    }
    return match;
  });

  // Normalize Booking fee amount in text if it states old 500 when fee is 100
  if (bookingFee !== 500) {
    text = text.replace(/(?:Booking\s+Fee|Consultancy\s+Fee|booking\s+fee|fee:?)\s*(?::|is)?\s*(?:₹|INR\s*|Rs\.?\s*)?500\b/gi, (match) => {
      return match.replace(/500\b/, String(bookingFee));
    });
    text = text.replace(/(?:for\s+the\s+)(?:₹|INR\s*|Rs\.?\s*)?500(?:\s+booking\s+fee|\s+fee)/gi, `for the ${clinicCurrency}${bookingFee} booking fee`);
  }

  // Strip unnecessary doctor-selection prompts/options when there is only one doctor
  text = text.replace(/(?:Please\s+)?(?:select|choose|pick)\s+(?:a|your|the)\s+(?:preferred\s+)?doctor[^\r\n:?.]*[:?.]?/gi, '');
  text = text.replace(/Which doctor would you like to (?:consult|see|meet|visit)\??/gi, '');
  text = text.replace(/(?:Doctor\s+Options|Available\s+Doctors|Doctor\s+Selection):?[^\r\n]*(?:\r?\n)*(?:•|\d+\.)\s*Dr\.[^\r\n]*/gi, '');

  // Normalize Address & Maps link if AI hallucinates old Green Glen / Bangalore clinic location
  const clinicAddress = hospitalProfile?.address || 'Road No.11 B, Jubilee hills, 500045.';
  const clinicCity = hospitalProfile?.city || 'Hyderabad';
  const clinicPostal = hospitalProfile?.postalCode || '500045';
  const clinicMapsUrl = hospitalProfile?.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(`${hospitalProfile?.name || 'La Fleur Aesthetic Clinic'} ${clinicCity}`)}`;

  if (clinicCity.toLowerCase() !== 'bangalore' && /Suite 402|Green Glen Towers|Outer Ring Road, Bangalore|Green Glen Layout/i.test(text)) {
    text = text.replace(/Suite 402,\s*Green Glen Towers,\s*Outer Ring Road,\s*Bangalore(?:\s*-\s*\d{6})?/gi, `${clinicAddress}, ${clinicCity} - ${clinicPostal}`);
    text = text.replace(/Suite 402,\s*Green Glen Towers,\s*Bangalore(?:\s*-\s*\d{6})?/gi, `${clinicAddress}, ${clinicCity} - ${clinicPostal}`);
    text = text.replace(/(?:our\s+clinic\s+in\s+)?Green Glen Layout,\s*Outer Ring Road/gi, `${clinicAddress}, ${clinicCity}`);
    text = text.replace(/https:\/\/maps\.google\.com\/\?q=La\+Fleur\+Aesthetic\+Clinic\+Bangalore/gi, clinicMapsUrl);
  }

  // Extract patient details to form the direct in-chat payment link ONLY if it's an actual confirmed appointment summary
  const isAppointmentSummary = (!!appointmentData || looksLikeBookingConfirmation(text))
    && !/(?:once I have|will generate|please provide the following|to proceed with your registration|could you please let me know)/i.test(text);

  if (isAppointmentSummary) {
    let pName = appointmentData?.patient_name || '';
    let pPhone = appointmentData?.phone_number || '';
    let pDept = appointmentData?.department || 'Clinical Consultation';
    let pDate = appointmentData?.date || '';
    let pTime = appointmentData?.time || '';

    if (!pName || pName.toLowerCase() === 'patient') {
      const nameMatch = text.match(/Patient(?:\s+Name)?:\s*([^\r\n•]+)/i);
      if (nameMatch && nameMatch[1].trim().toLowerCase() !== 'patient') {
        pName = nameMatch[1].trim();
      } else if (senderName) {
        pName = senderName;
      } else {
        pName = 'Valued Patient';
      }
    }
    if (appointmentData && pName) {
      appointmentData.patient_name = pName;
    }

    if (!pPhone || isDummyPhoneNumber(pPhone)) {
      const phoneMatch = text.match(/(?:Contact|Phone)(?:\s+Number)?:\s*([^\r\n•]+)/i);
      if (phoneMatch && !isDummyPhoneNumber(phoneMatch[1])) {
        pPhone = phoneMatch[1].trim();
      } else if (senderPhone && !isDummyPhoneNumber(senderPhone)) {
        pPhone = senderPhone.trim();
      } else {
        pPhone = '';
      }
    }
    if (appointmentData && pPhone) {
      appointmentData.phone_number = pPhone;
    }

    // Replace dummy phone numbers in text with user's phone if available, or remove dummy phone line
    if (senderPhone && !isDummyPhoneNumber(senderPhone)) {
      text = text.replace(/(?:Contact|Phone)(?:\s+Number)?:\s*(?:\+?91[\s\-]?)?(?:98765\s*43210|81478\s*66324|1234567890)[^\r\n]*/gi, `Contact Number: ${senderPhone.trim()}`);
    } else {
      text = text.replace(/[•\s]*(?:Contact|Phone)(?:\s+Number)?:\s*(?:\+?91[\s\-]?)?(?:98765\s*43210|81478\s*66324|1234567890)[^\r\n]*/gi, '');
    }

    if (!pDept) {
      const deptMatch = text.match(/(?:Treatment|Service|Concern)(?:\/Service)?:\s*([^\r\n•]+)/i);
      if (deptMatch) pDept = deptMatch[1].trim();
    }
    if (!pDate) {
      const dateMatch = text.match(/Date:\s*([^\r\n•]+)/i);
      if (dateMatch) pDate = dateMatch[1].trim();
    }
    if (!pTime) {
      const timeMatch = text.match(/Time(?:\s+Slot)?:\s*([^\r\n•]+)/i);
      if (timeMatch) pTime = timeMatch[1].trim();
    }

    // Ensure unique Booking ID is present in the appointment summary
    const hasBookingId = /Booking(?:\s+ID|#)?:\s*LF-[A-Za-z0-9\-]+/i.test(text);
    const bookingId = appointmentData?.booking_id || generateBookingId(pDate);
    if (appointmentData) {
      appointmentData.booking_id = bookingId;
    }

    if (!hasBookingId) {
      if (/•\s*Patient(?:\s+Name)?:\s*/i.test(text)) {
        text = text.replace(/(•\s*Patient(?:\s+Name)?:\s*)/i, `• Booking ID: ${bookingId}\n$1`);
      } else if (/Patient(?:\s+Name)?:\s*/i.test(text)) {
        text = text.replace(/(Patient(?:\s+Name)?:\s*)/i, `Booking ID: ${bookingId}\n$1`);
      }
    }

    const cleanPhone = pPhone.replace(/[\s\-\(\)]/g, '');
    const payUrl = `${siteUrl}/pay/pay_${Date.now()}?name=${encodeURIComponent(pName || 'Valued Patient')}&phone=${encodeURIComponent(cleanPhone)}&treatment=${encodeURIComponent(pDept)}&amount=${bookingFee}&date=${encodeURIComponent(pDate)}&time=${encodeURIComponent(pTime)}&clinicWa=${clinicWaDigits(hospitalProfile)}`;

    // The model is told not to write payment links, but if it does (often with
    // [Name]-style placeholders) swap in the real one.
    text = text.replace(/https?:\/\/[^\s\/]+\/pay\/[^\s\r\n]*/gi, payUrl);

    // Rewrite any "sent to your email" / "invoice sent to your email" hallucination into in-chat payment link
    if (/sent to your email|sent to email|invoice and secure payment link.*email/i.test(text)) {
      text = text.replace(/An invoice and secure payment link[^\r\n]*sent to your email[^\r\n]*\./gi, `Please complete the ${clinicCurrency}${bookingFee} advance booking fee using the secure payment link below to finalize and confirm your slot on our calendar:`);
      text = text.replace(/(?:has|have) been generated and sent to your email[^\r\n]*\./gi, `can be completed directly below to finalize and secure your slot:`);
      text = text.replace(/sent to your email\s*\([^)]*\)\.?/gi, `available directly in this chat.`);
    }

    // Ensure direct payment link is present only when patient name is identified
    if (!text.includes('/pay/') && pName && pName.toLowerCase() !== 'patient') {
      if (/Next Steps:/i.test(text)) {
        text = text.replace(/Next Steps:([^\r\n]*)/i, `Next Steps:$1\nPlease complete the ${clinicCurrency}${bookingFee} advance booking fee using the secure payment link below to confirm your slot:\n👉 *Pay Online*: ${payUrl}`);
      } else {
        text = `${text}\n\n• Next Steps & Online Payment Link:\nPlease complete the ${clinicCurrency}${bookingFee} advance booking fee using the secure payment link below to confirm your slot:\n👉 *Pay Online*: ${payUrl}`;
      }
    }
  } else {
    // If not a finalized appointment summary or patient name is not yet provided, remove any premature payment links
    text = text.replace(/(?:\r?\n)*[•\s]*(?:Next Steps & Online Payment Link|Next Steps|Payment Link):?[^\r\n]*(?:\r?\n)*Please complete the[^\r\n]*booking fee[^\r\n]*(?:\r?\n)*.*?https?:\/\/[^\s\/]+\/pay\/[^\s\r\n]*/gi, '');
    text = text.replace(/(?:\r?\n)*👉\s*\*Pay Online\*:\s*https?:\/\/[^\s\/]+\/pay\/[^\s\r\n]*/gi, '');
    text = text.replace(/(?:\r?\n)*(?:👉\s*)?Pay Online:\s*https?:\/\/[^\s\/]+\/pay\/[^\s\r\n]*/gi, '');
    text = text.replace(/https?:\/\/[^\s\/]+\/pay\/[^\s\r\n]*/gi, '');
  }

  // Strip repetitive doctor name mentions in conversational flow unless user asked about the doctor or it's the appointment summary
  const userAskedAboutDoc = currentMessage && /(?:doctor|dr|physician|specialist|who\s+is|qualification|mrinalini)/i.test(currentMessage);
  if (!isAppointmentSummary && !userAskedAboutDoc) {
    text = text.replace(/\s+(?:for your (?:clinical\s+)?consultation\s+)?with\s+Dr\.\s*Mrinalini\b/gi, (match) => {
      if (/consultation/i.test(match)) return ' for your consultation';
      return '';
    });
    text = text.replace(/(?:consultation\s+fee\s+to\s+meet\s+Dr\.\s*Mrinalini\s+is)/gi, 'consultation fee is');
    text = text.replace(/(?:assessment\s+with\s+Dr\.\s*Mrinalini)/gi, 'clinical assessment');
    text = text.replace(/(?:consultation\s+with\s+Dr\.\s*Mrinalini)/gi, 'consultation');
    text = text.replace(/(?:appointment\s+with\s+Dr\.\s*Mrinalini)/gi, 'appointment');
  }

  return text.trim();
}

/**
 * Helper to deduplicate conversation history and prevent back-to-back duplicate message prompts.
 */
export function sanitizeConversationHistory(
  history: Array<{ role: string; content: string }> | undefined,
  currentMessage: string
): Array<{ role: string; content: string }> {
  if (!Array.isArray(history) || history.length === 0) return [];
  const cleanMsg = (currentMessage || '').trim().toLowerCase();
  
  const result: Array<{ role: string; content: string }> = [];
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    if (!item || typeof item.content !== 'string' || !item.content.trim()) continue;
    
    // If the history item is near the end and matches the current user message, exclude it to prevent duplication
    if (i >= history.length - 2 && (item.role === 'user' || item.role === 'customer') && item.content.trim().toLowerCase() === cleanMsg) {
      continue;
    }
    
    // Avoid consecutive duplicate messages with identical role and text
    const prev = result[result.length - 1];
    if (prev && prev.role === item.role && prev.content.trim().toLowerCase() === item.content.trim().toLowerCase()) {
      continue;
    }
    
    result.push(item);
  }

  // Ensure trailing item does not duplicate the current user message
  while (result.length > 0) {
    const last = result[result.length - 1];
    if ((last.role === 'user' || last.role === 'customer') && last.content.trim().toLowerCase() === cleanMsg) {
      result.pop();
    } else {
      break;
    }
  }

  return result;
}

/**
 * Detect Out-of-Scope / Non-Business Queries (Math, Coding, Trivia, Jokes, Weather)
 */
export function isOutOfScopeQuery(
  message: string,
  history: Array<{ role: string; content: string }> = []
): boolean {
  if (!message || typeof message !== 'string') return false;
  const lower = message.trim().toLowerCase();

  // 1. If message contains clinic or appointment keywords, it is valid in-scope conversation
  const clinicKeywords = [
    'laser', 'hair', 'acne', 'pimple', 'scar', 'prp', 'scalp', 'gfc', 'hydra', 'facial', 'glow',
    'peel', 'pigment', 'melasma', 'botox', 'filler', 'wrinkle', 'anti-aging', 'skin', 'tightening',
    'rf', 'mnrf', 'carbon', 'hollywood', 'collagen', 'underarm', 'bikini', 'full body', 'mole', 'wart',
    'freckle', 'pore', 'dull', 'sunburn', 'tan', 'whitening', 'brightening', 'stretch mark',
    'hair fall', 'hair loss', 'bald', 'thinning', 'alopecia', 'mintop', 'minoxidil', 'finasteride',
    'doctor', 'dr', 'mrinalini', 'ananya', 'appointment', 'book', 'slot', 'timing', 'time',
    'fee', 'charge', 'price', 'cost', 'consultation', 'clinic', 'hospital', 'location', 'address',
    'maps', 'sunday', 'tomorrow', 'today', 'sitting', 'treatment', 'package', 'cancel', 'reschedule',
    'dermatologist', 'aesthetic', 'wellness', 'lafleur', 'la fleur', 'razorpay', 'upi', 'payment',
    'pre-care', 'post-care', 'invoice', 'pass', 'leave', 'holiday', 'offline'
  ];

  const hasClinicKeyword = clinicKeywords.some(k => lower.includes(k));
  if (hasClinicKeyword) return false;

  // Standalone conversational polite words are in scope
  const cleanTokens = lower.replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
  const politeWords = new Set(['hi', 'hello', 'hey', 'yes', 'no', 'ok', 'okay', 'sure', 'thanks', 'thank', 'you', 'please', 'morning', 'afternoon', 'evening', 'namaste', 'start', 'help']);
  if (cleanTokens.length <= 3 && cleanTokens.every(t => politeWords.has(t))) {
    return false;
  }

  // 2. Strict Out-of-Scope Patterns (Math, Coding, Trivia, Jokes, Weather, News)
  // 2.1 Math expressions & arithmetic queries (e.g. "1+1", "2+2", "what is 2 + 2", "calculate 10*5", "5/2", "2 plus 2", "what is 1+1")
  const hasMathExpr = /\d+\s*(?:[\+\-\*\/\^\%xX÷]|plus|minus|times|multiplied by|divided by)\s*\d+/i.test(lower);
  const isPureMathExpr = /^[\s\d\+\-\*\/\^\(\)\.\=\%xX÷]+$/.test(lower) && /\d/.test(lower) && /[\+\-\*\/\=\%xX÷]/.test(lower);
  const isMathQuery = /^(?:what(?:'s|\s+is)|\bcalculate|\bcompute|\bsolve|\bhow much is|\bsum of|\bproduct of)\s+(?:\d+[\s\+\-\*\/\^\%xX÷a-z]+\d+|[0-9\.\s\+\-\*\/xX÷]+)/i.test(lower) ||
    /\b(?:calculate|compute|solve|arithmetic|square root|cube root|algebra|equation|integral|derivative|trigonometry)\b/i.test(lower);

  if (hasMathExpr || isPureMathExpr || isMathQuery) {
    return true;
  }

  // 2.2 Coding & Programming queries (e.g. "write python code", "create a function in js", "debug this")
  if (
    /^(?:write|generate|create|code|debug|fix|explain|give)\s+(?:python|javascript|typescript|c\+\+|java|react|html|css|sql|function|code|script|program|app|algorithm|regex)\b/i.test(lower) ||
    /\b(?:python|javascript|typescript|reactjs|nodejs|sql query|bash script|powershell|c\+\+|golang|rust|html5|css3)\b/i.test(lower) ||
    /\b(?:console\.log|function\s*\(|def\s+[a-z_]|import\s+react|const\s+[a-z_]+\s*=|class\s+[A-Z]|npm\s+install|docker\s+run)\b/i.test(lower)
  ) {
    return true;
  }

  // 2.3 Trivia, Jokes, Weather, Politics, General assistant queries
  if (
    /\b(?:joke|jokes|poem|poems|song|story|stories|riddle|riddles|essay)\b/i.test(lower) ||
    /^(?:who is the|who was the|who is|who was|who won|what is the capital of|what is the weather|how is the weather|what's the weather|recipe for|how to cook|how to make|translate this|translate to)\b/i.test(lower) ||
    /\b(?:president|prime minister|governor|election|parliament|congress|bjp|democrat|republican|cricket score|fifa world cup|olympics|weather today|temperature today|cryptocurrency|bitcoin|ethereum|chatgpt|openai|claude|gemini)\b/i.test(lower)
  ) {
    return true;
  }

  // 3. In-Scope Clinical Flow Form Inputs
  // Standalone slot selection (e.g. "1", "2", "3", "4", "5", "slot 1", "slot 4")
  if (/^(?:slot\s*)?[1-5]$/i.test(lower)) {
    return false;
  }

  // Standalone time selection (e.g. "10:30 AM", "4 PM", "11:30", "2:30pm")
  if (/^(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(lower)) {
    return false;
  }

  // Email address or phone number input
  if (
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.test(lower) ||
    /^(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(lower) ||
    /^\+?\d{10,15}$/.test(lower.replace(/[\s-]/g, ''))
  ) {
    return false;
  }

  // Standalone name input (1 to 3 words, pure alphabets)
  if (/^[a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20}){0,2}$/.test(message.trim())) {
    return false;
  }

  return false;
}

/**
 * True only for an actual booking confirmation: a confirmation phrase plus the
 * structured Patient Name / Date / Time lines of a summary. Phrases alone
 * ("share your booking details", "consultation details") are not enough —
 * they used to create appointments from ordinary treatment answers.
 */
export function looksLikeBookingConfirmation(rawText: string): boolean {
  const text = rawText.replace(/[*_]/g, '');
  const hasPhrase = /appointment confirmed|consultation confirmed|booking confirmed|your (?:appointment|booking|consultation) is confirmed|appointment booked|consultation booked|slot confirmed|appointment scheduled|consultation scheduled|(?:appointment|booking) summary/i.test(text);
  const hasFields = /Patient(?:\s+Name)?:\s*\S/i.test(text) && /Date:\s*\S/i.test(text) && /Time(?:\s+Slot)?:\s*\S/i.test(text);
  return hasPhrase && hasFields;
}

/**
 * Convert the Markdown LLMs tend to emit into WhatsApp formatting. The
 * dashboard emulator renders Markdown, so replies looked clean there while
 * WhatsApp showed raw `**`, `##` and `[text](url)`.
 */
export function toWhatsAppFormatting(text: string): string {
  return text
    .replace(/^#{1,6}\s+(.+?)\s*#*\s*$/gm, '*$1*')
    .replace(/\*\*\*(.+?)\*\*\*/g, '*$1*')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2')
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ');
}

const TREATMENT_KEYWORDS: Record<string, string[]> = {
  'Laser Hair Reduction': ['laser hair', 'hair removal', 'hair reduction', 'lhr', 'unwanted hair'],
  'Carbon Laser Hollywood Peel': ['carbon', 'hollywood'],
  'PRP Hair Therapy & Scalp Restoration': ['prp', 'hair fall', 'hair loss', 'hair thinning', 'thinning', 'balding', 'scalp'],
  'GFC Hair Restoration': ['gfc'],
  'HydraFacial Deluxe': ['hydrafacial', 'hydra facial', 'hydra', 'facial', 'glow'],
  'Pigmentation & Chemical Peels': ['chemical peel', 'peel', 'peels', 'pigmentation', 'pigment', 'melasma', 'tan', 'dark spots', 'brightening'],
  'Skin Tightening (RF / MNRF)': ['acne scar', 'acne scars', 'scar', 'scars', 'mnrf', 'tightening', 'open pores', 'pores', 'acne'],
  'Anti-Aging & Botox': ['botox', 'wrinkle', 'wrinkles', 'anti-aging', 'anti aging', 'fine lines'],
  'Dermal Fillers & Lip Enhancement': ['filler', 'fillers', 'lip', 'lips'],
  'Body Contouring & Cellulite Reduction': ['cellulite', 'contouring', 'body fat'],
};

/** Catalog treatments the message refers to, by name or common keyword. */
export function findMentionedTreatments(lowerMsg: string, catalog: Treatment[]): Treatment[] {
  return catalog.filter(t => {
    if (t.name === 'Clinical Consultation') return false;
    const keywords = [t.name.toLowerCase(), ...(TREATMENT_KEYWORDS[t.name] || [])];
    return keywords.some(k => new RegExp(`(?<![a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`).test(lowerMsg));
  });
}

/** Digits of the clinic's WhatsApp number, for the pay page's "chat with us" link. */
export function clinicWaDigits(profile?: Partial<HospitalProfile>): string {
  return (profile?.whatsapp || profile?.phone || '').replace(/\D/g, '');
}

/**
 * Intelligent Stateful Multi-Turn Clinical Fallback Engine
 * Tracks history, extracts entities, and maintains conversational state across turns.
 */
export function generateSmartClinicalFallback(
  userMsg: string, 
  history: Array<{ role: string; content: string }> = [],
  customHospitalProfile?: Partial<HospitalProfile>,
  senderPhone?: string,
  senderName?: string,
  treatments?: Treatment[]
): {
  reply: string;
  appointmentObj: AIResponseResult['appointmentData'];
} {
  const calInfo = getClinicalCalendarInfo();
  const lower = userMsg.toLowerCase().trim();
  const cleanHistory = sanitizeConversationHistory(history, userMsg);
  const allUserTexts = cleanHistory
    .filter(h => h.role === 'user' || h.role === 'customer')
    .map(h => h.content)
    .concat([userMsg]);
  const combinedHistoryText = allUserTexts.join(' ').toLowerCase();
  const allChatTexts = cleanHistory.map(h => h.content).concat([userMsg]).join(' ').toLowerCase();

  const hospitalProfile: HospitalProfile = {
    ...getRuntimeHospitalProfile(),
    ...(customHospitalProfile || {})
  };
  const clinicName = hospitalProfile.name || 'La Fleur Aesthetic & Wellness Clinic';
  const doctorName = hospitalProfile.leadDoctor || 'Dr. Mrinalini';
  const doctorTitle = hospitalProfile.doctorTitle || 'Senior Aesthetic Specialist';
  const clinicAddress = hospitalProfile.address 
    ? `${hospitalProfile.address}${hospitalProfile.city ? `, ${hospitalProfile.city}` : ''}${hospitalProfile.postalCode ? ` - ${hospitalProfile.postalCode}` : ''}`.replace(/,\s*-/g, '').trim()
    : 'Road No.11 B, Jubilee hills, Hyderabad - 500045';
  const clinicMaps = hospitalProfile.mapsUrl || 'https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad';
  const consultationFee = hospitalProfile.consultationFee ?? 500;
  const advanceBookingFee = hospitalProfile.advanceTokenFee ?? 10;
  const balanceFee = Math.max(0, consultationFee - advanceBookingFee);
  const clinicCurrency = hospitalProfile.currency || '₹';

  // 0. Strict Out-of-Scope / Math / Non-Clinic Query Filter
  if (isOutOfScopeQuery(userMsg, cleanHistory)) {
    const reply = `I am an AI assistant dedicated exclusively to assisting with clinical inquiries, treatments, and appointment bookings for ${clinicName}.\n\nHow can I help you with our aesthetic treatments or scheduling a consultation with ${doctorName} today?`;
    return { reply, appointmentObj: null };
  }

  // 1. Answer direct current date queries
  if (
    lower.includes('current date') || 
    lower.includes("what is today's date") || 
    lower.includes("what's today's date") || 
    lower.includes("what is the date") || 
    lower.includes("today's date") || 
    lower.includes("what date is today") || 
    lower.includes("date today")
  ) {
    const reply = `Today's Date: ${calInfo.todayFormatted} (${calInfo.todayStr}).\n\nOur clinic is open for consultations Monday to Saturday (10:00 AM – 07:00 PM).\nWe have slots available for today (${calInfo.todayStr}), tomorrow (${calInfo.tomorrowStr}), and upcoming dates.\n\nWould you like to schedule an appointment?`;
    return { reply, appointmentObj: null };
  }

  // 2. Emergency / Urgent Condition Triage
  if (lower.includes('emergency') || lower.includes('breathing') || lower.includes('swelling') || lower.includes('allergic reaction') || lower.includes('chest pain') || lower.includes('severe bleeding') || lower.includes('unconscious') || lower.includes('anaphylaxis')) {
    const reply = `Emergency Notice:\n\nIf you are experiencing severe breathing difficulty, sudden swelling, or acute allergic reactions, please seek immediate emergency medical care at the nearest hospital emergency department or contact emergency medical services right away.\n\nFor non-emergency clinical consultations once you are medically stable, appointments can be scheduled at ${clinicName}.`;
    return { reply, appointmentObj: null };
  }

  // 3. Resolve Slot from direct numbers (1-5), numbers like 44 / 4, or explicit times
  const standardSlots = ["10:30 AM", "11:30 AM", "02:30 PM", "04:00 PM", "05:30 PM"];
  let resolvedTime = '';

  for (let i = allUserTexts.length - 1; i >= 0; i--) {
    const rawU = allUserTexts[i].trim().toLowerCase();
    const cleanNum = rawU.replace(/^(?:slot|option|number)\s*/i, '');
    if (/^[1-5]$/.test(cleanNum)) {
      const slotIdx = parseInt(cleanNum, 10) - 1;
      if (slotIdx >= 0 && slotIdx < standardSlots.length) {
        resolvedTime = standardSlots[slotIdx];
        break;
      }
    } else if (cleanNum === '44' || cleanNum === '4' || cleanNum === '4pm' || cleanNum === '4:00' || cleanNum === '4:00 pm' || cleanNum === '4:00pm' || cleanNum === '04:00 pm' || cleanNum === '04:00pm') {
      resolvedTime = '04:00 PM';
      break;
    } else if (cleanNum === '1' || cleanNum === '10:30' || cleanNum === '10:30am' || cleanNum === '10:30 am') {
      resolvedTime = '10:30 AM';
      break;
    } else if (cleanNum === '2' || cleanNum === '11:30' || cleanNum === '11:30am' || cleanNum === '11:30 am') {
      resolvedTime = '11:30 AM';
      break;
    } else if (cleanNum === '3' || cleanNum === '2:30' || cleanNum === '02:30' || cleanNum === '2:30pm' || cleanNum === '2:30 pm') {
      resolvedTime = '02:30 PM';
      break;
    } else if (cleanNum === '5' || cleanNum === '5:30' || cleanNum === '05:30' || cleanNum === '5:30pm' || cleanNum === '5:30 pm') {
      resolvedTime = '05:30 PM';
      break;
    }
  }

  // Extract time from current or previous turns
  const directTimeMatch = userMsg.match(/(10:30\s*(?:am)?|11:30\s*(?:am)?|02:00\s*(?:pm)?|02:30\s*(?:pm)?|03:30\s*(?:pm)?|04:00\s*(?:pm)?|05:00\s*(?:pm)?|05:30\s*(?:pm)?|06:30\s*(?:pm)?|\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
  const historyTimeMatch = combinedHistoryText.match(/(10:30\s*(?:am)?|11:30\s*(?:am)?|02:00\s*(?:pm)?|02:30\s*(?:pm)?|03:30\s*(?:pm)?|04:00\s*(?:pm)?|05:00\s*(?:pm)?|05:30\s*(?:pm)?|06:30\s*(?:pm)?|\d{1,2}:\d{2}\s*(?:am|pm)?)/i);

  let activeTime = resolvedTime || (directTimeMatch ? directTimeMatch[1] : (historyTimeMatch ? historyTimeMatch[1] : ''));
  if (activeTime) {
    activeTime = activeTime.toUpperCase().trim();
    if (!activeTime.includes('AM') && !activeTime.includes('PM')) {
      activeTime = (activeTime.startsWith('10') || activeTime.startsWith('11')) ? `${activeTime} AM` : `${activeTime} PM`;
    }
  }

  // Extract phone, email, date
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{4}[-.\s]?\d{3}[-.\s]?\d{3}|\d{7,15})|\b\d{7,15}\b/;
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  
  let phoneMatch = userMsg.match(phonePattern) || combinedHistoryText.match(phonePattern);
  if (!phoneMatch) {
    const rawDigits = userMsg.replace(/[^0-9+]/g, '');
    if (rawDigits.length >= 7 && rawDigits.length <= 15 && !rawDigits.startsWith('0000')) {
      phoneMatch = [rawDigits] as any;
    }
  }
  const emailMatch = userMsg.match(emailPattern) || combinedHistoryText.match(emailPattern);
  const dateMatch = userMsg.match(/(\d{4}-\d{2}-\d{2}|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|\d{1,2}(?:st|nd|rd|th))/i)
    || combinedHistoryText.match(/(\d{4}-\d{2}-\d{2}|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|\d{1,2}(?:st|nd|rd|th))/i);

  // Extract treatment concern
  const activeTreatments = (treatments ?? getRuntimeTreatments()).filter(t => t.isActive);

  let treatment = 'Clinical Consultation';
  let totalSittings = 1;
  let sittingInterval = 'As advised';
  let sittingIntervalDays = 30;

  if (combinedHistoryText.includes('laser') || combinedHistoryText.includes('hair reduction') || combinedHistoryText.includes('lhr')) {
    treatment = 'Laser Hair Reduction';
    totalSittings = 6;
    sittingInterval = '4-6 weeks';
    sittingIntervalDays = 28;
  } else if (combinedHistoryText.includes('mintop') || combinedHistoryText.includes('prp') || combinedHistoryText.includes('scalp') || combinedHistoryText.includes('gfc') || combinedHistoryText.includes('hair fall') || combinedHistoryText.includes('hair loss') || combinedHistoryText.includes('thinning') || combinedHistoryText.includes('balding') || combinedHistoryText.includes('hair')) {
    treatment = 'PRP Hair Therapy & Scalp Restoration';
    totalSittings = 4;
    sittingInterval = '3-4 weeks';
    sittingIntervalDays = 21;
  } else if (combinedHistoryText.includes('hydra') || combinedHistoryText.includes('glow') || combinedHistoryText.includes('facial')) {
    treatment = 'HydraFacial Deluxe';
    totalSittings = 3;
    sittingInterval = '4 weeks';
    sittingIntervalDays = 28;
  } else if (combinedHistoryText.includes('carbon') || combinedHistoryText.includes('hollywood')) {
    treatment = 'Carbon Laser Hollywood Peel';
    totalSittings = 4;
    sittingInterval = '3-4 weeks';
    sittingIntervalDays = 21;
  } else if (combinedHistoryText.includes('peel') || combinedHistoryText.includes('pigment') || combinedHistoryText.includes('brightening') || combinedHistoryText.includes('melasma') || combinedHistoryText.includes('dull skin')) {
    treatment = 'Pigmentation & Chemical Peels';
    totalSittings = 4;
    sittingInterval = '2-3 weeks';
    sittingIntervalDays = 14;
  } else if (combinedHistoryText.includes('acne') || combinedHistoryText.includes('pimple') || combinedHistoryText.includes('scar') || combinedHistoryText.includes('rf') || combinedHistoryText.includes('tightening')) {
    treatment = 'Skin Tightening (RF / MNRF)';
    totalSittings = 4;
    sittingInterval = '3-4 weeks';
    sittingIntervalDays = 21;
  } else if (combinedHistoryText.includes('botox') || combinedHistoryText.includes('wrinkle') || combinedHistoryText.includes('anti-aging')) {
    treatment = 'Anti-Aging & Botox';
    totalSittings = 1;
    sittingInterval = '4-6 months';
    sittingIntervalDays = 150;
  } else if (combinedHistoryText.includes('filler') || combinedHistoryText.includes('lip') || combinedHistoryText.includes('cheeks')) {
    treatment = 'Dermal Fillers & Lip Enhancement';
    totalSittings = 1;
    sittingInterval = '9-12 months';
    sittingIntervalDays = 300;
  } else {
    for (const t of activeTreatments) {
      if (combinedHistoryText.includes(t.name.toLowerCase())) {
        treatment = t.name;
        totalSittings = t.recommendedSittings;
        sittingInterval = t.sittingInterval;
        sittingIntervalDays = t.sittingIntervalDays;
        break;
      }
    }
  }

  // Direct Consultation Fee Query (Evaluated before general doctor/clinic hours check)
  const isDirectFeeQuery = 
    lower.includes('consultation fee') || 
    lower.includes('doctor fee') || 
    lower.includes('doctor fees') || 
    lower.includes('booking fee') || 
    lower.includes('booking fees') || 
    lower.includes('consultancy fee') || 
    lower.includes('consultancy price') || 
    lower.includes('consultation charges') || 
    lower.includes('doctor charges') || 
    lower.includes('appointment fee') || 
    lower.includes('appointment charge') || 
    lower.includes('fee for consultation') || 
    lower.includes('fee for doctor') || 
    lower.includes('fee of doctor') || 
    lower.includes('charges for consultation') || 
    lower.includes('what is the fee') || 
    lower.includes('what is the fees') || 
    lower.includes('what are the fees') || 
    lower.includes('what is the charge') || 
    lower.includes('what are the charges') || 
    lower.includes('how much is the fee') || 
    lower.includes('how much is the consultation') || 
    lower.includes('how much is consultation') || 
    lower.includes('how much for consultation') || 
    lower.includes('how much consultation') || 
    lower.includes('consultation cost') || 
    lower.includes('consultation price') || 
    lower.includes('fee is') ||
    lower.includes('fees is') ||
    lower.includes('the fee is') ||
    lower.includes('the fees are') ||
    lower.includes('what fee') ||
    lower.includes('what charge') ||
    lower.includes('consult fee') ||
    lower.trim() === 'fee' || 
    lower.trim() === 'fees' || 
    lower.trim() === 'fee?' || 
    lower.trim() === 'fees?' || 
    lower.trim() === 'doctor fee?' || 
    lower.trim() === 'consultation fee?' ||
    lower.trim() === 'price?' ||
    lower.trim() === 'charges?' ||
    lower.trim() === 'how much' ||
    lower.trim() === 'how much?' ||
    lower.trim() === 'how much fee' ||
    lower.trim() === 'how much fees';

  if (isDirectFeeQuery) {
    const feeBreakdown = balanceFee > 0
      ? `• Doctor Consultation Fee: ${clinicCurrency}${consultationFee}\n• Advance Booking Fee: ${clinicCurrency}${advanceBookingFee} (payable online to secure your slot)\n• Clinic Balance: ${clinicCurrency}${balanceFee} (payable at clinic desk upon arrival)`
      : `• Doctor Consultation Fee: ${clinicCurrency}${consultationFee}`;

    const reply = `The doctor consultation fee with ${doctorName} (${doctorTitle}) at ${clinicName} is ${clinicCurrency}${consultationFee}.\n\n${feeBreakdown}\n\n• Address: ${clinicAddress}\n• Google Maps: ${clinicMaps}\n• Available Consultation Slots tomorrow (${calInfo.tomorrowFormatted}): 10:30 AM, 11:30 AM, 02:30 PM, 04:00 PM, 05:30 PM.\n\nWould you like to schedule an appointment with ${doctorName}?`;
    return { reply, appointmentObj: null };
  }

  // Doctor / Clinic timings / Location / Sunday
  const timings = hospitalProfile.timings;
  const weekdayOpen = timings?.weekdayOpen || '10:00 AM';
  const weekdayClose = timings?.weekdayClose || '07:00 PM';
  const isSunOpen = timings?.isSundayOpen ?? true;
  const sundayOpen = timings?.sundayOpen || '11:00 AM';
  const sundayClose = timings?.sundayClose || '04:00 PM';

  if (lower.includes('sunday')) {
    const sundayScheduleText = isSunOpen 
      ? `Sunday: ${sundayOpen} – ${sundayClose} (By Prior Appointment)`
      : `Sunday: Closed`;
    const reply = `${clinicName} Sunday Schedule:\n\n• Sunday Timings: ${sundayScheduleText}\n• Consulting Specialist: ${doctorName}\n• Location (Google Maps): ${clinicMaps}\n• Address: ${clinicAddress}\n\nWould you like to reserve an appointment slot?`;
    return { reply, appointmentObj: null };
  }

  // Dedicated Doctor Query: If the patient explicitly asks about the doctor, their name, or qualifications
  if (
    lower.includes('who is the doctor') ||
    lower.includes('who is doctor') ||
    lower.includes('doctor name') ||
    lower.includes('name of the doctor') ||
    lower.includes('name of doctor') ||
    lower.includes('about the doctor') ||
    lower.includes('about doctor') ||
    lower.includes('dr name') ||
    lower.includes('which doctor') ||
    lower.includes('doctor details') ||
    lower.includes('doctor profile') ||
    lower.includes('doctor qualification') ||
    lower.includes('who will examine') ||
    lower.includes('who will consult')
  ) {
    const reply = `Our consulting specialist is ${doctorName} (${doctorTitle}).\n\n${hospitalProfile.aboutText || 'Specializing in evidence-based clinical aesthetics, advanced laser skin rejuvenation, and personalized care.'}\n\nWould you like to schedule an in-person consultation?`;
    return { reply, appointmentObj: null };
  }

  // Booking flow state: only continue an intake the assistant actually started.
  const lastAssistantText = [...cleanHistory].reverse()
    .find(h => h.role === 'ai' || h.role === 'assistant' || h.role === 'model' || h.role === 'bot')?.content || '';
  const bookingInProgress = /which slot works best|available slots|full name|confirm (?:this|your) booking|phone number|email address|reserve/i.test(lastAssistantText);
  const isExplicitBookingRequest = /\b(?:book|booking|appointment|schedule|slot|reserve)\b/.test(lower);

  // Treatment advice / comparison questions ("what do you suggest for acne
  // scars?", "is laser painful?"): answer the question first and only offer
  // a booking at the end, instead of jumping straight into slot selection.
  const isPricingWords = /\b(?:price|prices|cost|costs|package|charges?|rates?|fees?)\b|how much/.test(lower);
  const isAdviceQuestion = !isExplicitBookingRequest && !isPricingWords && !directTimeMatch &&
    (lower.includes('?') || /\b(?:suggest|recommend|advice|advise|which|better|best|difference|versus|vs|what|how|why|does|do i|is it|painful|pain|safe|side effects?|results?|downtime|recovery|good for|help)\b/.test(lower));
  if (isAdviceQuestion) {
    const mentioned = findMentionedTreatments(lower, activeTreatments);
    const fromHistory = activeTreatments.find(t => t.name === treatment);
    const toDescribe = mentioned.length > 0 ? mentioned.slice(0, 3) : (fromHistory && treatment !== 'Clinical Consultation' ? [fromHistory] : []);
    if (toDescribe.length > 0) {
      const sections = toDescribe.map(t => {
        const lines = [`*${t.name}*`];
        if (t.description) lines.push(`• ${t.description}`);
        if (t.recommendedSittings) {
          lines.push(`• Typical plan: ${t.recommendedSittings} sitting${t.recommendedSittings > 1 ? 's' : ''}${t.recommendedSittings > 1 && t.sittingInterval ? `, ${t.sittingInterval} apart` : ''}${t.durationMinutes ? ` (about ${t.durationMinutes} minutes each)` : ''}`);
        }
        if (t.postCareAdvice) lines.push(`• Aftercare: ${t.postCareAdvice}`);
        return lines.join('\n');
      });
      const closing = toDescribe.length > 1
        ? `The right option depends on your skin type and concern, and ${doctorName} will recommend the best plan after examining you.`
        : `${doctorName} will confirm whether this suits you and personalise the plan after an in-person assessment.`;
      const reply = `${sections.join('\n\n')}\n\n${closing}\n\nWould you like me to book a consultation with ${doctorName}?`;
      return { reply, appointmentObj: null };
    }
  }

  const hasBookingOrTime = lower.includes('book') || lower.includes('appointment') || lower.includes('schedule') || lower.includes('slot') || lower.includes('reserve') || !!activeTime || /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(userMsg);

  if (!hasBookingOrTime && (lower.includes('doctor') || lower.includes('timings') || lower.includes('timing') || lower.includes('open') || lower.includes('hours') || lower.includes('location') || lower.includes('address') || lower.includes('where'))) {
    const reply = `${clinicName}\n\n• Chief Physician: ${doctorName} (${doctorTitle})\n• Clinic Hours: Monday to Saturday, ${weekdayOpen} – ${weekdayClose}\n• Sunday Timings: ${isSunOpen ? `${sundayOpen} – ${sundayClose}` : 'Closed'}\n• Location (Google Maps): ${clinicMaps}\n• Address: ${clinicAddress}\n\nAvailable slots tomorrow: 10:30 AM, 11:30 AM, 02:30 PM, 04:00 PM, 05:30 PM.\n\nWould you like to book a consultation slot?`;
    return { reply, appointmentObj: null };
  }

  // Extract patient name
  const invalidNameTokens = [
    "a", "an", "the", "my", "me", "our", "tomorrow", "today", "slot", "slots", "booking", "3pm", "3 pm", 
    "11am", "4pm", "4 pm", "yes", "no", "consultation", "appointment", "laser", "hair", "removal", 
    "reduction", "treatment", "acne", "hydrafacial", "prp", "peel", "peels", "botox", "dr", "doctor", 
    "today at", "tomorrow at", "interested", "looking", "suffering", "having", "facing", "experiencing", 
    "struggling", "here", "new", "writing", "asking", "inquiring", "ready", "planning", "hoping", 
    "trying", "getting", "seeking", "going", "curious", "checking", "concerned", "okay", "sure", 
    "package", "how", "much", "pricing", "cost", "price", "charges", "approximate", "range"
  ];

  const nonNameWords = new Set([
    'hi', 'hello', 'hey', 'book', 'yes', 'no', 'ok', 'okay', 'sure', 'price', 'cost', 'slot', 'slots', 
    'mintop', 'hair', 'change', 'time', 'today', 'tomorrow', 'consultation', 'appointment', 'treatment', 
    'please', 'thanks', 'thank', 'you', 'want', 'laser', 'acne', 'peel', 'peels', 'hydrafacial', 'botox', 
    'card', 'upi', 'pay', 'payment', 'removal', 'reduction', 'dr', 'doctor', 'mrinalini', 'skin', 'monday',
    'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'phone', 'email', 'number', 'pass',
    'confirm', 'registration', 'details', 'details:', 'interested', 'looking', 'suffering', 'having', 
    'facing', 'experiencing', 'struggling', 'here', 'new', 'writing', 'asking', 'inquiring', 'ready', 
    'planning', 'hoping', 'trying', 'getting', 'seeking', 'going', 'curious', 'checking', 'concerned',
    'package', 'how', 'much', 'pricing', 'cost', 'charges', 'approximate', 'range', 'a', 'an', 'the', 'my', 'me', 'our',
    'to', 'for', 'at', 'in', 'on', 'of', 'and', 'is', 'it', 'am', 'are', 'i', 'we', 'be', 'do', 'can', 'will', 'with',
    'would', 'like', 'need', 'have', 'has', 'had', 'about', 'some', 'any', 'get', 'good', 'morning', 'afternoon', 'evening'
  ]);

  let extractedName = '';
  const explicitMatches = Array.from(userMsg.matchAll(/(?:for|patient(?: name)?(?:\s+is)?|name(?:\s+is)?|i am|i'm|this is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi));
  for (const match of explicitMatches) {
    if (match && match[1]) {
      let cand = match[1].trim();
      const tokens = cand.split(/\s+/);
      while (tokens.length > 1 && (invalidNameTokens.includes(tokens[tokens.length - 1].toLowerCase()) || nonNameWords.has(tokens[tokens.length - 1].toLowerCase()))) {
        tokens.pop();
      }
      cand = tokens.join(' ');
      const candWords = cand.toLowerCase().split(/\s+/);
      const hasInvalid = candWords.some(w => invalidNameTokens.includes(w) || nonNameWords.has(w));
      if (!hasInvalid && candWords.length >= 1 && candWords.length <= 3) {
        extractedName = cand;
        break;
      }
    }
  }

  // Check history for explicit name if not in userMsg
  if (!extractedName) {
    const historyExplicitMatches = Array.from(combinedHistoryText.matchAll(/(?:for|patient(?: name)?(?:\s+is)?|name(?:\s+is)?|i am|i'm|this is)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi));
    for (const match of historyExplicitMatches) {
      if (match && match[1]) {
        let cand = match[1].trim();
        const tokens = cand.split(/\s+/);
        while (tokens.length > 1 && (invalidNameTokens.includes(tokens[tokens.length - 1].toLowerCase()) || nonNameWords.has(tokens[tokens.length - 1].toLowerCase()))) {
          tokens.pop();
        }
        cand = tokens.join(' ');
        const candWords = cand.toLowerCase().split(/\s+/);
        const hasInvalid = candWords.some(w => invalidNameTokens.includes(w) || nonNameWords.has(w));
        if (!hasInvalid && candWords.length >= 1 && candWords.length <= 3) {
          extractedName = cand;
          break;
        }
      }
    }
  }

  // Extract candidate name from clean userMsg words if standalone
  if (!extractedName) {
    const cleanInput = userMsg
      .replace(emailPattern, ' ')
      .replace(phonePattern, ' ')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .trim();
    
    const words = cleanInput.split(/\s+/).filter(w => w.length >= 2);
    if (words.length >= 1 && words.length <= 3) {
      const candidateWords = words.filter(w => !nonNameWords.has(w.toLowerCase()));
      if (candidateWords.length >= 1 && candidateWords.length <= 3 && candidateWords.length === words.length) {
        extractedName = candidateWords.join(' ');
      }
    }
  }

  // Check previous user messages in history if still empty (only if whole message is a standalone name 1-3 words)
  if (!extractedName) {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.role === 'user' || h.role === 'customer') {
        const cleanH = h.content
          .replace(emailPattern, ' ')
          .replace(phonePattern, ' ')
          .replace(/[^a-zA-Z\s]/g, ' ')
          .trim();
        const hWords = cleanH.split(/\s+/).filter(w => w.length >= 2);
        if (hWords.length >= 1 && hWords.length <= 3) {
          const candH = hWords.filter(w => !nonNameWords.has(w.toLowerCase()));
          if (candH.length >= 1 && candH.length <= 3 && candH.length === hWords.length) {
            extractedName = candH.join(' ');
            break;
          }
        }
      }
    }
  }

  const resolvedPatientName = extractedName ? formatProperName(extractedName) : (senderName ? formatProperName(senderName) : '');
  const patientName = resolvedPatientName;

  // Calculate target date
  const finalDate = parseRequestedBookingDate(dateMatch ? dateMatch[1] : undefined, calInfo.todayStr, calInfo.tomorrowStr);
  const targetDateObj = new Date(finalDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const formattedDay = dayNames[targetDateObj.getDay()];

  // Doctor Availability, Holiday, Lunch Break & Working Hours Validation
  const runtimeDocs = getRuntimeDoctors();
  const targetDoc = runtimeDocs[0] || { doctorName: 'Dr. Mrinalini', status: 'available' as const };
  const hospitalCfg = getRuntimeHospitalConfig();

  // 1. Temporary Away / Out of Office / Break Mode
  if (hospitalCfg.status === 'offline' || targetDoc.status === 'away' || targetDoc.status === 'in_surgery') {
    const returnTime = hospitalCfg.offlineReturnTime || targetDoc.endTime || '02:00 PM';
    const reason = hospitalCfg.offlineReason || targetDoc.reason || 'Clinical Procedure / Lunch Break';
    const reply = `Doctor Status Notice:\nDr. Mrinalini is currently away for ${reason} and will be back at ${returnTime}.\n\nWould you like to reserve a consultation slot after ${returnTime}?`;
    return { reply, appointmentObj: null };
  }

  // 2. Doctor Vacation / Holiday Window Check
  const isDocHoliday = hospitalCfg.status === 'holiday' || targetDoc.status === 'holiday' || (targetDoc && isDoctorAway(targetDoc as any, finalDate));
  if (isDocHoliday) {
    const startD = hospitalCfg.holidayStartDate || targetDoc.startDate;
    const endD = hospitalCfg.holidayEndDate || targetDoc.endDate;
    const holidayRange = formatDateRange(startD, endD);
    const reasonText = (hospitalCfg.holidayReason || targetDoc.reason) ? ` (${hospitalCfg.holidayReason || targetDoc.reason})` : '';
    const returnDate = formatReadableDate(endD);
    const resumeText = returnDate ? ` Consultations will resume on ${returnDate}.` : '';
    const reply = `Doctor Availability Notice:\nDr. Mrinalini is away on holiday/leave from ${holidayRange || 'the requested dates'}${reasonText}.${resumeText}\n\nWould you like to schedule your consultation after their return?`;
    return { reply, appointmentObj: null };
  }

  // 3. Weekly Off / Sunday Closed Check
  if (formattedDay === 'Sunday' && (!hospitalProfile.timings?.isSundayOpen || !timings?.isSundayOpen)) {
    const reply = `Doctor Schedule Notice:\nOur clinic is closed for regular OPD consultations on Sundays (Emergency on-call only).\n\nWe would be happy to schedule your consultation for Monday or any weekday (Monday to Saturday, ${hospitalCfg.openingTime || '10:00 AM'} – ${hospitalCfg.closingTime || '07:00 PM'}).\n\nAvailable slots: 10:30 AM, 11:30 AM, 02:30 PM, 04:00 PM, 05:30 PM.\n\nWould you like to book a slot for Monday?`;
    return { reply, appointmentObj: null };
  }

  // 4. Requested Time Falls in Lunch Break Check
  if (activeTime && isTimeInLunchBreak(activeTime, hospitalCfg.lunchStartTime || '01:00 PM', hospitalCfg.lunchEndTime || '02:00 PM')) {
    const lStart = hospitalCfg.lunchStartTime || '01:00 PM';
    const lEnd = hospitalCfg.lunchEndTime || '02:00 PM';
    const reply = `Doctor Schedule Notice:\nDr. Mrinalini is on lunch and clinical case review break between ${lStart} and ${lEnd}.\n\nOur available consultation slots are:\n• Morning OPD: 10:30 AM, 11:30 AM\n• Afternoon & Evening: 02:30 PM, 04:00 PM, 05:30 PM\n\nWould you like to choose an available morning or afternoon slot?`;
    return { reply, appointmentObj: null };
  }

  // 5. Requested Time Falls Outside Regular Operating Hours Check
  if (activeTime && isTimeOutsideWorkingHours(activeTime, hospitalCfg.openingTime || '10:00 AM', hospitalCfg.closingTime || '07:00 PM')) {
    const opTime = hospitalCfg.openingTime || '10:00 AM';
    const clTime = hospitalCfg.closingTime || '07:00 PM';
    const reply = `Doctor Schedule Notice:\nDr. Mrinalini's consultation hours are Monday to Saturday, ${opTime} to ${clTime}. The requested time (${activeTime}) is outside our regular clinic consultation hours.\n\nOur standard consultation slots are: 10:30 AM, 11:30 AM, 02:30 PM, 04:00 PM, 05:30 PM.\n\nWhich slot works best for your schedule?`;
    return { reply, appointmentObj: null };
  }

  // ============================================================
  // MANDATORY MULTI-STEP CLINICAL INTAKE PROTOCOL
  // ============================================================
  const hasRealTreatment = treatment && treatment !== 'Clinical Consultation';
  const hasTime = !!activeTime;
  // The WhatsApp profile name only counts once the assistant has asked for it.
  const nameFromChat = !!extractedName || (bookingInProgress && /full name/i.test(lastAssistantText));
  const hasName = nameFromChat && !!patientName && patientName.length >= 2 && patientName.toLowerCase() !== 'patient';
  const inBookingFlow = bookingInProgress || isExplicitBookingRequest;
  const hasPhone = !!(phoneMatch && phoneMatch[0]);
  const hasEmail = !!(emailMatch && emailMatch[0]);
  const isBookingIntent = lower.includes('book') || lower.includes('appointment') || lower.includes('schedule') || lower.includes('slot') || lower.includes('timings') || lower.includes('timing') || lower.includes('time') || lower.includes('tomorrow') || lower.includes('today');


  // 4-Question Pricing Qualification Gate
  const isPricingQuery = lower.includes('price') || lower.includes('cost') || lower.includes('package') || lower.includes('how much') || lower.includes('charges') || lower.includes('rate') || lower.includes('fee') || lower.includes('fees');
  const userTurnsCount = history.filter(h => h.role === 'user' || h.role === 'customer').length;

  if (isPricingQuery && !activeTime && (!hasPhone && !hasEmail)) {
    if (userTurnsCount < 3) {
      if (treatment.includes('Laser')) {
        const reply = `At La Fleur Aesthetic & Wellness Clinic, treatment protocols and sitting requirements are customized based on skin type and area.\n\nTo help provide an accurate estimate, which target area you'd like to treat (e.g., full face, underarms, full body)?`;
        return { reply, appointmentObj: null };
      }
      if (treatment.includes('PRP') || treatment.includes('Hair')) {
        const reply = `At La Fleur Aesthetic & Wellness Clinic, treatment protocols and sitting requirements are customized by Dr. Mrinalini according to the stage of hair loss.\n\nTo help provide an accurate estimate, How long have you noticed hair thinning, and have you tried any therapies previously?`;
        return { reply, appointmentObj: null };
      }
      if (treatment.includes('Hydra') || treatment.includes('Facial') || treatment.includes('Glow')) {
        const reply = `At La Fleur Aesthetic & Wellness Clinic, treatment protocols and sitting requirements are customized for HydraFacial Deluxe and skin glow treatments.\n\nTo help provide an accurate estimate, could you tell us a bit more about your specific concern?`;
        return { reply, appointmentObj: null };
      }
      const reply = `At La Fleur Aesthetic & Wellness Clinic, treatment protocols and sitting requirements are customized following an in-person clinical assessment.\n\nTo help provide an accurate estimate, could you tell us a bit more about your specific concern?`;
      return { reply, appointmentObj: null };
    } else {
      if (treatment.includes('Laser')) {
        const reply = `Based on your details, here is the indicative approximate price range for Laser Hair Reduction with Dr. Mrinalini:\n\n• Single Sitting: ₹2,500 – ₹4,500\n• Structured 6-Sitting Package: ₹14,999 – ₹22,500 (sessions spaced 4–6 weeks apart)\n\nWould you like to schedule an in-person clinical consultation with Dr. Mrinalini to finalize your plan?`;
        return { reply, appointmentObj: null };
      }
      if (treatment.includes('PRP') || treatment.includes('Hair')) {
        const reply = `Based on your details, here is the indicative approximate price range for PRP Hair Therapy with Dr. Mrinalini:\n\n• Single Sitting: ₹4,000 – ₹5,800\n• Structured 4-Sitting Package: ₹15,000 – ₹19,500 (sessions spaced 3–4 weeks apart)\n\nWould you like to book a consultation slot with Dr. Mrinalini?`;
        return { reply, appointmentObj: null };
      }
    }
  }

  // STEP 4: Full Patient Intake Complete (Treatment, Slot/Time, Name)
  // Patient is already on WhatsApp, so phone number and email are not requested unless conversation history explicitly asked for them
  if (hasTime && hasName && inBookingFlow) {
    const historyAskedForPhone = (allChatTexts.includes('phone number') || allChatTexts.includes('contact number')) && !allChatTexts.includes('appointment confirmed') && !allChatTexts.includes('consultation confirmed');
    if (historyAskedForPhone && !hasPhone) {
      const reply = `Thank you, ${patientName}!\n\nPlease provide your WhatsApp Contact Phone Number and Email Address to complete your booking.`;
      return { reply, appointmentObj: null };
    }

    const historyAskedForEmail = allChatTexts.includes('email address') && !allChatTexts.includes('appointment confirmed') && !allChatTexts.includes('consultation confirmed');
    if (historyAskedForEmail && hasPhone && !hasEmail && !lower.includes('@')) {
      const capturedPhone = phoneMatch ? phoneMatch[0].trim() : '';
      const reply = `Thank you, ${patientName}!\n\nI have recorded your contact number: ${capturedPhone}.\n\nTo finalize your ${treatment} consultation for ${activeTime} on ${formattedDay}, ${finalDate}, please provide your Email Address.`;
      return { reply, appointmentObj: null };
    }

    const userPhone = (senderPhone && !isDummyPhoneNumber(senderPhone)) ? senderPhone.trim() : '';
    const finalPhone = (phoneMatch && !isDummyPhoneNumber(phoneMatch[0])) ? phoneMatch[0].trim() : userPhone;
    const finalEmail = emailMatch ? emailMatch[0].trim() : (patientName ? `${patientName.toLowerCase().replace(/\s+/g, '.')}@example.com` : '');
    const rawTime = activeTime;

    const bookingId = generateBookingId(finalDate);

    const appointmentObj: AIResponseResult['appointmentData'] = {
      booking_id: bookingId,
      patient_name: patientName || (senderName ? formatProperName(senderName) : 'Valued Patient'),
      phone_number: finalPhone,
      date: finalDate,
      time: rawTime,
      department: treatment,
      doctor: doctorName,
      current_sitting: 1,
      total_sittings: totalSittings,
      sitting_interval: sittingInterval,
      sitting_interval_days: sittingIntervalDays,
      sitting: totalSittings > 1 ? `Sitting 1 of ${totalSittings}` : 'Consultation'
    };

    const sittingInfoLine = totalSittings > 1 
      ? `\n• Treatment Plan: Sitting 1 of ${totalSittings} (${sittingInterval} interval)`
      : '';
    const emailInfoLine = emailMatch ? `\n• Email Address: ${finalEmail}` : '';

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-monkey-950817.hostingersite.com';
    const cleanPhone = finalPhone.replace(/[\s\-\(\)]/g, '');
    const payUrl = `${siteUrl}/pay/pay_${Date.now()}?name=${encodeURIComponent(appointmentObj.patient_name || 'Valued Patient')}&phone=${encodeURIComponent(cleanPhone)}&treatment=${encodeURIComponent(appointmentObj.department)}&amount=${advanceBookingFee}&date=${encodeURIComponent(appointmentObj.date)}&time=${encodeURIComponent(appointmentObj.time)}&clinicWa=${clinicWaDigits(hospitalProfile)}`;

    const feeBreakdown = balanceFee > 0
      ? `• Doctor Consultation Fee: ${clinicCurrency}${consultationFee}\n• Advance Booking Fee: ${clinicCurrency}${advanceBookingFee} (to lock your appointment slot)\n• Balance at Clinic: ${clinicCurrency}${balanceFee} (payable at clinic desk)`
      : `• Consultation Fee: ${clinicCurrency}${consultationFee} (to lock your appointment slot)`;

    const reply = `Consultation Confirmed! Appointment Confirmed!\n\n*Booking Summary*:\n• Booking ID: ${bookingId}\n• Patient Name: ${appointmentObj.patient_name}\n• Consulting Specialist: ${doctorName} (${doctorTitle})\n• Treatment/Service: ${appointmentObj.department}${sittingInfoLine}${emailInfoLine}\n• Date: ${appointmentObj.date} (${formattedDay})\n• Time: ${appointmentObj.time}\n${feeBreakdown}\n\n📍 *Clinic Address*: ${clinicAddress}\nGoogle Maps: ${clinicMaps}\n\n👉 *Pay Online to lock slot*: ${payUrl}\n\nWe look forward to seeing you!`;

    return { reply, appointmentObj };
  }

  // STEP 3: Slot selected (or number 1-5 chosen), but missing Name.
  // Nothing is reserved until the booking is confirmed, so don't claim it is.
  if (hasTime && inBookingFlow) {
    const reply = `Great choice: *${activeTime} on ${formattedDay}, ${finalDate}* for your ${treatment} consultation.\n\nMay I please have your *Full Name* to confirm this booking?`;
    return { reply, appointmentObj: null };
  }

  // STEP 2: Treatment mentioned or User asks to book / slot timings -> Offer available slots
  if (isBookingIntent || hasRealTreatment) {
    if (calInfo.isTodayClinicClosed || calInfo.remainingTodaySlots.length === 0) {
      const reply = `We would be delighted to schedule your ${treatment} consultation.\n\nOur consultation slots for today are completed.\n\nAvailable slots for tomorrow (*${calInfo.tomorrowFormatted}*):\n1. 10:30 AM\n2. 11:30 AM\n3. 02:30 PM\n4. 04:00 PM\n5. 05:30 PM\n\nWhich slot works best for you?`;
      return { reply, appointmentObj: null };
    } else {
      const reply = `We would be delighted to schedule your ${treatment} consultation.\n\nAvailable slots for today:\n${calInfo.remainingTodaySlots.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}\n\nOr tomorrow (*${calInfo.tomorrowFormatted}*):\n1. 10:30 AM\n2. 11:30 AM\n3. 02:30 PM\n4. 04:00 PM\n5. 05:30 PM\n\nWhich slot works best for you?`;
      return { reply, appointmentObj: null };
    }
  }

  // STEP 1: General Greeting & Treatment Discovery (CONCISE)
  const clinicGreetingName = clinicName.includes('Wellness') ? clinicName : `${clinicName.replace(/\s*Clinic$/i, '')} & Wellness Clinic`;
  const reply = `Hello! Welcome to ${clinicGreetingName}.\n\nI am your AI clinical assistant for ${doctorName} (${doctorTitle}).\n\nWhat concern can we help you with today?\n• Laser Hair Reduction\n• Acne & Acne Scars\n• PRP Hair Therapy\n• HydraFacial Deluxe\n• Chemical Peels & Pigmentation\n• Anti-Aging & Botox\n• In-Person Consultation\n\nPlease let us know what you are looking for, or if you would like to book a consultation!`;
  return { reply, appointmentObj: null };
}

/**
 * Free Zero-Config Cloud Inference Fallback
 * Provides real dynamic LLM output via high-speed open AI models.
 */
async function tryFreeOpenInference(
  message: string,
  systemInstruction: string,
  history: Array<{ role: string; content: string }>
): Promise<string | null> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return null;
  const modelsToTry = ['openai', 'mistral', 'qwen'];
  const cleanHistory = sanitizeConversationHistory(history, message);
  const messages = [
    { role: 'system', content: systemInstruction },
    ...cleanHistory.slice(-8).map(h => ({
      role: h.role === 'ai' || h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user',
      content: h.content
    })),
    { role: 'user', content: message }
  ];

  for (const candidate of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: candidate,
          temperature: 0.7,
          jsonMode: false
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim() && text.length > 10 && !text.includes('<!DOCTYPE') && !text.includes('Error')) {
          const lowerText = text.toLowerCase();
          const rawDigits = message.replace(/[^0-9]/g, '');
          // Reject obvious hallucinations
          if (rawDigits.length >= 7 && (lowerText.includes('providing your email') || lowerText.includes('longer than'))) {
            continue;
          }
          return text.trim();
        }
      }
    } catch {
      // Continue to next model
    }
  }
  return null;
}

export interface GlobalServerAIConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'custom';
  apiKey: string;
  model: string;
  customBaseUrl?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

const globalServerAIConfig: GlobalServerAIConfig = {
  provider: (process.env.DEFAULT_AI_PROVIDER as any) || 'gemini',
  apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '',
  model: process.env.DEFAULT_AI_MODEL || 'gemini-3.5-flash',
  customBaseUrl: process.env.CUSTOM_AI_BASE_URL || 'http://localhost:11434/v1',
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: '',
};

export function getGlobalServerAIConfig(): GlobalServerAIConfig {
  return globalServerAIConfig;
}

export function setGlobalServerAIConfig(config: Partial<GlobalServerAIConfig>) {
  Object.assign(globalServerAIConfig, config);
}

export async function syncServerAIConfigFromDatabase(): Promise<GlobalServerAIConfig> {
  if (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) {
    return globalServerAIConfig;
  }

  // 1. Check local file cache for saved prompt
  try {
    const fs = await import('fs');
    const path = await import('path');
    const promptFile = path.join(process.cwd(), 'ai-system-prompt.txt');
    if (fs.existsSync(promptFile)) {
      const filePrompt = fs.readFileSync(promptFile, 'utf8');
      if (filePrompt && filePrompt.trim()) {
        globalServerAIConfig.systemPrompt = filePrompt.trim();
      }
    }
  } catch {}

  // 2. Check Supabase DB
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { decrypt } = await import('@/lib/whatsapp/encryption');
    const supabase = supabaseAdmin();
    const { data: row } = await supabase
      .from('ai_configs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (row) {
      let decryptedKey = '';
      if (row.api_key) {
        try {
          decryptedKey = decrypt(row.api_key);
        } catch {
          decryptedKey = row.api_key;
        }
      }
      const rawModel = row.model || 'gemini-3.5-flash';
      const isLegacy = rawModel.includes('2.5') || rawModel.includes('2.0') || rawModel.includes('1.5') || rawModel.includes('preview');
      const safeModel = (row.provider === 'gemini' && isLegacy) ? 'gemini-3.5-flash' : rawModel;

      const update: Partial<GlobalServerAIConfig> = {
        provider: (row.provider as any) || 'gemini',
        model: safeModel,
        apiKey: decryptedKey || globalServerAIConfig.apiKey,
        customBaseUrl: row.custom_base_url || globalServerAIConfig.customBaseUrl,
        temperature: row.temperature !== null ? Number(row.temperature) : 0.7,
        maxTokens: row.max_tokens !== null ? Number(row.max_tokens) : 1024,
      };
      if (row.system_prompt && typeof row.system_prompt === 'string' && row.system_prompt.trim()) {
        update.systemPrompt = row.system_prompt.trim();
      }
      setGlobalServerAIConfig(update);
    }
  } catch (err) {
    console.warn('[Server AI Config DB Sync Warning]:', err);
  }
  return globalServerAIConfig;
}

export async function syncServerHospitalProfileFromDatabase(force: boolean = false): Promise<Partial<HospitalProfile>> {
  if (!force && typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) {
    return {};
  }
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const supabase = supabaseAdmin();
    let updates: Partial<HospitalProfile> = {};

    // 1. Check ai_knowledge_documents for saved Hospital Profile & Clinic Details
    try {
      const { data: profileDoc } = await supabase
        .from('ai_knowledge_documents')
        .select('content')
        .eq('title', 'Hospital Profile & Clinic Details')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profileDoc?.content) {
        const parsed = JSON.parse(profileDoc.content);
        if (parsed && typeof parsed === 'object') {
          updates = { ...updates, ...parsed };
        }
      }
    } catch {}

    // 2. Check filesystem hospital-profile.json
    try {
      const fs = await import('fs');
      const path = await import('path');
      const profilePath = path.join(process.cwd(), 'hospital-profile.json');
      if (fs.existsSync(profilePath)) {
        const fileData = fs.readFileSync(profilePath, 'utf8');
        const fileParsed = JSON.parse(fileData);
        if (fileParsed && typeof fileParsed === 'object') {
          updates = { ...fileParsed, ...updates };
        }
      }
    } catch {}

    // 3. Check payment_configs
    const { data: row } = await supabase
      .from('payment_configs')
      .select('default_consultation_fee, default_advance_token_fee, currency, merchant_name')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (row) {
      if (row.default_consultation_fee !== undefined && row.default_consultation_fee !== null) {
        const cFee = Number(row.default_consultation_fee);
        if (!isNaN(cFee) && cFee > 0) {
          updates.consultationFee = cFee;
        }
      }
      const rawBookingFee = row.default_advance_token_fee;
      if (rawBookingFee !== undefined && rawBookingFee !== null) {
        const bFee = Number(rawBookingFee);
        if (!isNaN(bFee) && bFee >= 0) {
          updates.advanceTokenFee = bFee;
        }
      }
      if (updates.consultationFee !== undefined && updates.advanceTokenFee !== undefined) {
        updates.clinicBalanceFee = Math.max(0, updates.consultationFee - updates.advanceTokenFee);
      }
      if (row.currency) {
        updates.currency = (row.currency === 'INR' || row.currency === '₹') ? '₹' : row.currency;
      }
      if (row.merchant_name && !updates.name) {
        updates.name = row.merchant_name;
      }
    }

    return updates;
  } catch (err) {
    console.warn('[Server Hospital Profile DB Sync Warning]:', err);
  }
  return {};
}

/**
 * Core AI Generation Controller
 */
export async function generateAIChatResponse(options: AIRequestOptions): Promise<AIResponseResult> {
  const isTestEnv = typeof process !== 'undefined' && (!!process.env.VITEST || process.env.NODE_ENV === 'test');
  const {
    message,
    conversationHistory = [],
    systemPrompt,
    knowledgeContext,
    llmConfig,
    existingAppointments = [],
    hospitalProfile
  } = options;

  let dbProfileUpdates: Partial<HospitalProfile> = {};
  if (!isTestEnv) {
    dbProfileUpdates = await syncServerHospitalProfileFromDatabase();
  }

  const activeHospitalProfile: HospitalProfile = {
    ...getRuntimeHospitalProfile(),
    ...dbProfileUpdates,
    ...(hospitalProfile || {})
  };
  const consultationFee = activeHospitalProfile.consultationFee ?? 500;
  const bookingFee = activeHospitalProfile.advanceTokenFee ?? 10;
  const balanceFee = Math.max(0, consultationFee - bookingFee);
  const clinicCurrency = activeHospitalProfile.currency || '₹';
  const clinicAddress = activeHospitalProfile.address 
    ? `${activeHospitalProfile.address}${activeHospitalProfile.city ? `, ${activeHospitalProfile.city}` : ''}${activeHospitalProfile.postalCode ? ` - ${activeHospitalProfile.postalCode}` : ''}`.replace(/,\s*-/g, '').trim()
    : 'Road No.11 B, Jubilee hills, Hyderabad - 500045';
  const clinicMaps = activeHospitalProfile.mapsUrl || 'https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad';
  const clinicName = activeHospitalProfile.name || 'La Fleur Aesthetic & Wellness Clinic';

  const cleanHistory = sanitizeConversationHistory(conversationHistory, message);

  // 0. Strict Out-of-Scope / Non-Business Query Interceptor (Math, Coding, Trivia, Jokes, Weather)
  if (isOutOfScopeQuery(message, cleanHistory)) {
    const fallback = generateSmartClinicalFallback(message, cleanHistory, activeHospitalProfile, options?.senderPhone, options?.senderName, options?.treatments);
    return {
      reply: removeEmojisAndSmileys(fallback.reply),
      isAppointmentCard: false,
      appointmentData: null,
      provider: 'clinical-receptionist-engine',
      model: 'strict-scope-guard'
    };
  }

  if (isTestEnv) {
    const fallback = generateSmartClinicalFallback(message, conversationHistory, activeHospitalProfile, options?.senderPhone, options?.senderName, options?.treatments);
    return {
      reply: removeEmojisAndSmileys(fallback.reply),
      isAppointmentCard: !!fallback.appointmentObj,
      appointmentData: fallback.appointmentObj,
      provider: 'clinical-receptionist-engine',
      model: 'stateful-v2'
    };
  }

  let serverConfig = getGlobalServerAIConfig();
  if ((!serverConfig.apiKey || !serverConfig.systemPrompt) && typeof window === 'undefined') {
    serverConfig = await syncServerAIConfigFromDatabase();
  }

  const provider = llmConfig?.provider || serverConfig.provider || 'gemini';
  const apiKey = (llmConfig?.apiKey && llmConfig.apiKey.trim()) || (serverConfig.apiKey && serverConfig.apiKey.trim()) || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
  let model = llmConfig?.model || serverConfig.model || (provider === 'gemini' ? 'gemini-3.5-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
  const temperature = typeof llmConfig?.temperature === 'number' ? llmConfig.temperature : (serverConfig.temperature ?? 0.7);

  const maxTokens = typeof llmConfig?.maxTokens === 'number' ? llmConfig.maxTokens : (serverConfig.maxTokens ?? 1024);

  const hospitalCfg = getRuntimeHospitalConfig();
  const activeDocName = activeHospitalProfile.leadDoctor || hospitalCfg.doctorName || 'Dr. Mrinalini';
  const activeDocTitle = activeHospitalProfile.doctorTitle || hospitalCfg.title || 'Senior Aesthetic Specialist';
  const calInfo = getClinicalCalendarInfo();

  let calendarContext = `\n\n=== CLINIC & DOCTOR PROFILE ===
Clinic Name: ${clinicName}
Consulting Doctor: ${activeDocName} (${activeDocTitle})
Clinic Working Hours: ${hospitalCfg.openingTime} - ${hospitalCfg.closingTime} (Monday to Saturday)
Lunch / Break Hours: ${hospitalCfg.lunchStartTime} - ${hospitalCfg.lunchEndTime}
Daily Consultation Slots: ${(hospitalCfg.standardSlots && hospitalCfg.standardSlots.length > 0 ? hospitalCfg.standardSlots : STANDARD_SLOTS).join(', ')}

=== REAL-TIME CLINIC CALENDAR & CLOCK (Timezone: Asia/Kolkata / IST) ===
• Current Real-Time Date: ${calInfo.todayStr} (${calInfo.todayFormatted})
• Current Real-Time Time: ${calInfo.currentTimeStr} IST
• Tomorrow's Date: ${calInfo.tomorrowStr} (${calInfo.tomorrowFormatted})
• Current Year: ${calInfo.year}
• Real-Time Slot Rule:
  - Timezone is Asia/Kolkata (IST).
  - ${calInfo.isTodayClinicClosed 
    ? 'Today\'s clinic consultation hours have completed. DO NOT suggest or offer any slots for today under any circumstances! Only suggest slots for Tomorrow (' + calInfo.tomorrowFormatted + ') onwards.' 
    : `Remaining slots for today: ${calInfo.remainingTodaySlots.join(', ') || 'None'}. Only suggest future slots.`}`;

  if (hospitalCfg.status === 'offline') {
    calendarContext += `\n\n[STATUS ALERT: CLINIC / DOCTOR IS CURRENTLY OFFLINE / BREAK]
Reason: ${hospitalCfg.offlineReason || 'Clinical Procedure / Break'}
Expected Return Time: ${hospitalCfg.offlineReturnTime || '02:00 PM'}
Instruction: Politely inform the patient that ${activeDocName} is currently in break/procedure and will be back at ${hospitalCfg.offlineReturnTime || '02:00 PM'}. Offer to record their query or book a slot after their return.`;
  } else if (hospitalCfg.status === 'holiday') {
    calendarContext += `\n\n[STATUS ALERT: DOCTOR IS ON VACATION / HOLIDAY]
Holiday Range: ${formatDateRange(hospitalCfg.holidayStartDate, hospitalCfg.holidayEndDate)}
Reason: ${hospitalCfg.holidayReason || 'Annual Leave'}
Instruction: Inform the patient that ${activeDocName} is away on holiday from ${formatDateRange(hospitalCfg.holidayStartDate, hospitalCfg.holidayEndDate)}. Offer to schedule their consultation after the return date.`;
  }

  if (Array.isArray(existingAppointments) && existingAppointments.length > 0) {
    calendarContext += `\n\n=== LIVE CRM CALENDAR: BOOKED APPOINTMENTS ===\n` + 
      existingAppointments.map((a: any) => `• ${a.date} at ${a.time} - BOOKED (${a.department || 'Consultation'}${a.sitting ? `, ${a.sitting}` : ''})`).join('\n') +
      `\n\n[SLOT AVAILABILITY RULE]: Any slot listed above is ALREADY TAKEN for that date. Never double-book or offer an already booked slot to a patient. Offer only remaining unbooked slots from the standard slots list.`;
  } else {
    calendarContext += `\n\n=== LIVE CRM CALENDAR ===\nAll standard consultation slots (10:30 AM, 11:30 AM, 02:30 PM, 04:00 PM, 05:30 PM) are currently OPEN and AVAILABLE for booking.`;
  }

  // Inject Active Doctor Holiday and Away Roster
  const currentDocs = getRuntimeDoctors();
  const awayDocs = currentDocs.filter(d => isDoctorAway(d, new Date()));
  if (awayDocs.length > 0) {
    calendarContext += `\n\n=== ACTIVE DOCTOR HOLIDAYS & AWAY ROSTER ===\n`;
    awayDocs.forEach(d => {
      calendarContext += `• ${d.doctorName} is AWAY / ON HOLIDAY from ${formatDateRange(d.startDate, d.endDate)} (${d.reason || 'Leave'}). Covering Doctor: ${d.coveringDoctor || 'Associate Specialist'}.\n`;
    });
    calendarContext += `(Notice: If a patient inquires during holiday dates, inform them of the return date and offer to book after their return).\n`;
  }

  calendarContext += `\n==========================================`;

  const effectiveSystemPrompt = (systemPrompt && systemPrompt.trim())
    || (serverConfig.systemPrompt && serverConfig.systemPrompt.trim())
    || DEFAULT_LA_FLEUR_SYSTEM_PROMPT;

  let fullSystemInstruction = `${effectiveSystemPrompt}

==================================================
CRITICAL BUSINESS & CLINICAL SCOPE BOUNDARY (MANDATORY & UNBREAKABLE):
==================================================
You are exclusively restricted to assisting patients with ${clinicName} treatments, doctor consultations, clinic timings, pricing, location, and appointment bookings.
You MUST NEVER answer questions, solve problems, or perform tasks outside of this clinic scope under any circumstances:
- NEVER calculate or answer general math expressions or arithmetic questions (e.g., '1+1', '2+2', algebra, percentages, word problems).
- NEVER write, explain, or debug computer code, scripts, or programs.
- NEVER answer general trivia, world facts, news, politics, weather, sports scores, recipes, or general science.
- NEVER tell jokes, write poems, stories, or creative prose unrelated to clinic services.
If the patient asks any question outside the clinical and business scope of ${clinicName}, you MUST POLITELY DECLINE and immediately redirect them back to clinic treatments and booking an appointment.

Standard Boundary Response:
"I am an AI assistant dedicated exclusively to assisting with clinical inquiries, treatments, and appointment bookings for ${clinicName}.\n\nHow can I help you with our aesthetic treatments or scheduling a consultation today?"
==================================================

CRITICAL CONVERSATIONAL & CLINICAL PROTOCOL GUIDELINES:
0. HIGHEST PRECEDENCE — CUSTOM SYSTEM PROMPT RULES & FORMATTING:
   - The custom System Prompt provided above takes HIGHEST PRECEDENCE for persona, treatment discovery, formatting, and reply style.
   - If the custom System Prompt specifies formatting (such as presenting treatments or clinical services in bullet points with • or numbers), YOU MUST STRICTLY FOLLOW THOSE FORMATTING INSTRUCTIONS AND PRESENT TREATMENTS IN BULLET POINTS.
   - NEVER omit, suppress, or strip bullet points when discussing treatments or when instructed by the custom prompt.
1. NATURAL WHATSAPP TONE & CONCISE DIALOGUE:
   - For standard conversation turns (such as asking for slot or patient name), keep messages natural, concise, and helpful.
   - DO NOT USE EMOJIS, SMILEY FACES, OR CASUAL SYMBOLS (such as 😊, 🌸, 🩺, etc.). Keep the tone clean, clinical, and professional.
   - Always ensure your answers are complete sentences without being cut off mid-thought.
2. DOCTOR & CLINIC IDENTITY — ZERO DOCTOR-SELECTION:
   - ${activeDocName} (${activeDocTitle}) is the sole consulting specialist at ${clinicName}.
   - ABSOLUTE PROHIBITION ON DOCTOR SELECTION: Since there is ONLY ONE DOCTOR at the clinic, NEVER offer, display, or ask doctor-selection options, doctor choices, doctor menus, or ask "Which doctor would you like to see?" or "Please choose a doctor". NEVER ask the patient to choose/select a doctor.
   - STRICT RULE ON DOCTOR NAME REPETITION: DO NOT REPEAT THE DOCTOR'S NAME AGAIN AND AGAIN in the chat.
     • Do NOT repeat "${activeDocName}" in every response, every turn, or every sentence.
     • Do NOT append the doctor's name when asking for the patient's concern, offering time slots, asking for their name, or sharing clinic hours/location.
   - WHEN TO DISPLAY THE DOCTOR'S NAME:
     1) ONLY if the user explicitly asks about the doctor (e.g. "Who is the doctor?", "Doctor details", "Doctor name", "Doctor qualification"), OR
     2) In the final appointment confirmation summary / booking card under "• Consulting Doctor: ${activeDocName}".
   - For all other messages, communicate naturally and professionally on behalf of ${clinicName} without repeating the doctor's name.
   - DO NOT use the term "Dermatologist", "3D dermascope", or "digital dermoscopy". Use "detailed clinical analysis" or "in-person consultation".
   - NEVER use the phrase: "To determine the most suitable approach for your specific condition, ${activeDocName} conducts a detailed 3D dermascope assessment during a consultation."
3. WELCOME & CLINICAL CREDENTIALS:
   - When greeting, state that you are an AI clinical assistant for ${activeDocName} at ${clinicName}, mention our tie-up with leading plastic surgeons in the city, and provide the website (${activeHospitalProfile.website || 'https://lafleurwellness.com'}) and Instagram (${activeHospitalProfile.instagram || 'https://instagram.com/lafleur.clinic'}).
4. ADVANCE BOOKING FEE & DIRECT IN-CHAT PAYMENT LINK POLICY:
   - Doctor Consultation Fee is ${clinicCurrency}${consultationFee}.
   - Advance Booking Fee is ${clinicCurrency}${bookingFee} payable via online payment gateway (Razorpay / UPI / Card) to lock and confirm the appointment slot.
   - Any remaining balance (${clinicCurrency}${balanceFee}) is payable in person at the clinic desk upon arrival.
   - CRITICAL PRICING DIFFERENTIATION & FEE INQUIRY RULE:
     • NEVER confuse or equate the consultation fee with the advance booking fee!
     • The full doctor consultation fee is strictly ${clinicCurrency}${consultationFee}.
     • The advance booking fee is strictly ${clinicCurrency}${bookingFee} (a nominal token amount paid online to lock the appointment slot).
     • NEVER state that "The doctor consultation fee is ${clinicCurrency}${bookingFee}".
     • If the patient asks "how much", "what is the fee", "check the fee", or any inquiry regarding charges, ALWAYS state:
       "The doctor consultation fee is ${clinicCurrency}${consultationFee}. An advance booking fee of ${clinicCurrency}${bookingFee} is payable online to reserve your slot, and the balance of ${clinicCurrency}${balanceFee} is payable at the clinic upon arrival."
   - PAYMENT LINK TIMING RULE: ONLY include the payment link in the final appointment confirmation summary after the patient has provided their Full Name and slot.
   - NEVER include a payment link when asking intake questions or before the patient's name is known!
   - NEVER write a payment link or URL yourself. The system appends the patient's secure payment link to the confirmation summary automatically.
5. CLINIC LOCATION & GOOGLE MAPS LINK:
   - Provide clinic Google Maps link: ${clinicMaps} (Address: ${clinicAddress}).
6. REAL-TIME CALENDAR & STRICT CLINIC CLOCK (ASIA/KOLKATA / IST):
   - Current Real-Time IST Date & Clock: ${calInfo.currentTimeStr} on ${calInfo.todayFormatted} (${calInfo.todayStr}).
   - Tomorrow's Date: ${calInfo.tomorrowFormatted} (${calInfo.tomorrowStr}).
   ${calInfo.isTodayClinicClosed ? `CRITICAL: It is currently ${calInfo.currentTimeStr} IST (after clinic hours / 5:30 PM). Today's clinic hours are OVER. You MUST NOT offer 05:30 PM today or any past slots for today. All consultation slots must be offered starting from tomorrow (${calInfo.tomorrowFormatted}) onwards.` : `Remaining slots for today (${calInfo.todayFormatted}): ${calInfo.remainingTodaySlots.join(', ')}.`}
   - NEVER offer slots in the past.
7. STREAMLINED WHATSAPP INTAKE PROTOCOL (NO PHONE OR EMAIL REQUESTS):
   - WHATSAPP NUMBER & EMAIL RULE: The patient is ALREADY chatting directly with us on WhatsApp. We ALREADY have their WhatsApp contact number, and an email address is NOT required.
   - NEVER ask the patient for their WhatsApp contact number or email address! Do not request phone number or email at any point.
   - ONLY start this intake when the patient asks to book or accepts your offer to book. If they are asking about a treatment, follow rule 8 first.
   - ONLY collect these 3 pieces of information:
     • Step 1: Clinical Concern & Treatment (If not already mentioned, ask in 1 short sentence what concern they wish to address).
     • Step 2: Date & Slot Selection (Offer numbered slots: 1. 10:30 AM, 2. 11:30 AM, 3. 02:30 PM, 4. 04:00 PM, 5. 05:30 PM. Remember: If today's clinic is closed or after 5:30 PM IST, only offer tomorrow ${calInfo.tomorrowFormatted} or later).
     • Step 3: Patient Name:
       - As soon as the patient chooses a slot, acknowledge the slot in 1 short sentence and ask ONLY for their Full Name:
         "Great choice: [Time] on [Day, Date]. May I please have your Full Name to confirm this booking?"
       - NEVER say a slot is reserved, held or booked before the confirmation summary in Step 4.
     • Step 4: Appointment Confirmation & Direct In-Chat Payment Link:
       - Once Treatment, Slot/Date, and Full Name are provided, IMMEDIATELY confirm the booking and present the short summary:
         Appointment Confirmed!
         • Patient Name: [Patient Name]
         • Consulting Doctor: ${activeDocName}
         • Treatment/Service: [Treatment]
         • Date: [Date]
         • Time: [Time]
         • Doctor Consultation Fee: ${clinicCurrency}${consultationFee}
         • Advance Booking Fee: ${clinicCurrency}${bookingFee} (to lock your slot)
         ${balanceFee > 0 ? `• Balance at Clinic: ${clinicCurrency}${balanceFee}\n` : ''}

         Clinic Address: ${clinicAddress}
         Google Maps: ${clinicMaps}

         Please complete the ${clinicCurrency}${bookingFee} advance booking fee using the secure payment link below to confirm your slot.

         We look forward to seeing you!
       - Append the invisible <!--BOOKING_JSON:...--> tag at the VERY END.
8. ANSWER FIRST, OFFER BOOKING AT THE END:
   - If a patient asks for a treatment suggestion, compares treatments, asks how a treatment works, about pain, safety, results, downtime or aftercare, or describes symptoms or treatment history (e.g. hair thinning, using Mintop, acne scars): ANSWER THE QUESTION FIRST with helpful, specific information from the treatment catalog and knowledge base.
   - Then END with ONE short question offering a consultation, e.g. "Would you like me to book a consultation with ${activeDocName}?"
   - Do NOT list time slots, ask for their name, or say you will book anything until the patient says they want to book.
9. Multi-Sitting Treatment Tracking & Intervals:
   - When explaining treatments or booking courses, state approved sittings and intervals (e.g., Laser Hair Reduction: 6 sessions spaced 4-6 weeks apart; PRP Hair Restoration: 4 sessions spaced 3-4 weeks apart; Chemical Peels: 4 sessions spaced 2-3 weeks apart; RF Skin Tightening: 4 sessions spaced 3-4 weeks apart).
   - Inform patients that after each completed sitting, automated follow-ups and next-sitting due reminders will be sent via WhatsApp.
10. STRICT TREATMENT PRICING POLICY (DO NOT QUOTE OR SHOW TREATMENT PRICES):
   - CRITICAL RULE: NEVER provide, quote, or display treatment pricing, package fees, or numerical price ranges for treatments (e.g. Laser Hair Reduction, PRP, HydraFacial, Peels, Botox, Fillers, etc.).
   - Only the doctor consultation fee (${clinicCurrency}${consultationFee}) with an advance booking fee (${clinicCurrency}${bookingFee}) is quoted to secure an appointment.
   - If a patient asks about the price, cost, charges, or package rates for any treatment:
     • Politely explain that every treatment protocol, session count, and pricing are personalized and determined exclusively following an in-person clinical assessment.
     • Mention that our consultation fee is ${clinicCurrency}${consultationFee}.
     • Invite them to book an in-person consultation slot.
11. WhatsApp Formatting: Use *bold* for highlights and • for bullet points. Do not use Markdown header hashtags like '#' or multiple asterisks '***'.
12. Final Booking Pass Tag:
   - Only upon completing intake (Treatment, Slot, Full Name), append the tag below. "date" MUST be the YYYY-MM-DD date of the slot the patient chose (today is ${calInfo.todayStr}, tomorrow is ${calInfo.tomorrowStr}) and "time" the chosen slot:
<!--BOOKING_JSON:{"patient_name":"...","phone_number":"${(options?.senderPhone && !isDummyPhoneNumber(options.senderPhone)) ? options.senderPhone : ''}","date":"YYYY-MM-DD","time":"...","department":"...","doctor":"${activeDocName}","current_sitting":1,"total_sittings":1,"sitting_interval":"As advised","sitting_interval_days":28}-->

${calendarContext}`;

  // Inject Dynamic Hospital Profile & Treatment Catalog
  const activeTreatmentsCatalog = options.treatments ?? getRuntimeTreatments();
  const hospitalCatalogText = buildHospitalKnowledgeText(activeHospitalProfile, activeTreatmentsCatalog);
  fullSystemInstruction += `\n\n${hospitalCatalogText}`;

  const activeKnowledge = (knowledgeContext && knowledgeContext.trim()) || getRuntimeKnowledgeContext();
  if (activeKnowledge && activeKnowledge.trim()) {
    fullSystemInstruction += `\n\n=== VERIFIED CLINIC KNOWLEDGE BASE (PRIMARY SOURCE OF TRUTH) ===\n${activeKnowledge}\n================================================================`;
  }

  let rawReply = '';
  let usedProvider: string = provider;
  let usedModel: string = model;

  // 1. If API Key is present, query the user-selected provider
  if (apiKey && !isTestEnv) {
    // 1.1 Google Gemini
    if (provider === 'gemini') {
      const candidateModels = [model, 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      cleanHistory.slice(-8).forEach(h => {
        contents.push({
          role: h.role === 'ai' || h.role === 'model' || h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        });
      });
      contents.push({ role: 'user', parts: [{ text: message }] });

      for (const m of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
          const res = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: fullSystemInstruction }] },
              contents,
              generationConfig: { temperature, maxOutputTokens: maxTokens }
            })
          });

          const data = await res.json();
          if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            rawReply = data.candidates[0].content.parts[0].text.trim();
            usedModel = m;
            break;
          }
          if (data.error?.code === 403 || data.error?.code === 400 || data.error?.status === 'PERMISSION_DENIED') {
            break;
          }
        } catch {
          // Try next candidate
        }
      }
    }

    // 1.2 OpenAI / Groq / Custom
    else if (provider === 'openai' || provider === 'groq' || provider === 'custom') {
      const endpoint = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : (llmConfig?.customBaseUrl?.trim() || 'http://localhost:11434/v1').replace(/\/$/, '') + '/chat/completions';

      const messages = [
        { role: 'system', content: fullSystemInstruction },
        ...cleanHistory.slice(-8).map(h => ({
          role: h.role === 'ai' || h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content
        })),
        { role: 'user', content: message }
      ];

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens
          })
        });
        const data = await res.json();
        if (res.ok && data.choices?.[0]?.message?.content) {
          rawReply = data.choices[0].message.content.trim();
        }
      } catch {
        // Fall through
      }
    }

    // 1.3 Anthropic Claude
    else if (provider === 'anthropic') {
      const messages = [
        ...cleanHistory.slice(-8).map(h => ({
          role: h.role === 'ai' || h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content
        })),
        { role: 'user', content: message }
      ];

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            system: fullSystemInstruction,
            messages,
            max_tokens: maxTokens,
            temperature
          })
        });
        const data = await res.json();
        if (res.ok && data.content?.[0]?.text) {
          rawReply = data.content[0].text.trim();
        }
      } catch {
        // Fall through
      }
    }
  }

  // 2. If no key or direct API call didn't produce a reply, attempt free open inference
  if (!rawReply) {
    const freeReply = await tryFreeOpenInference(message, fullSystemInstruction, cleanHistory);
    if (freeReply) {
      rawReply = freeReply;
      usedProvider = 'free-ai-cloud';
      usedModel = 'gpt-4o-mini';
    }
  }

  // 3. Resilient stateful multi-turn fallback if external services are unreachable
  if (!rawReply) {
    const fallback = generateSmartClinicalFallback(message, cleanHistory, activeHospitalProfile, options?.senderPhone, options?.senderName, options?.treatments);
    rawReply = fallback.reply;
    usedProvider = 'clinical-receptionist-engine';
    usedModel = 'stateful-v2';

    if (fallback.appointmentObj) {
      return {
        reply: fallback.reply,
        isAppointmentCard: true,
        appointmentData: fallback.appointmentObj,
        provider: usedProvider,
        model: usedModel
      };
    } else {
      return {
        reply: cleanAIOutputReplies(fallback.reply, message, activeHospitalProfile, null, options?.senderPhone, options?.senderName),
        isAppointmentCard: false,
        appointmentData: null,
        provider: usedProvider,
        model: usedModel
      };
    }
  }

  // Check for embedded booking JSON tag
  let isAppointmentCard = false;
  let appointmentData: AIResponseResult['appointmentData'] = null;
  let cleanReply = rawReply;

  const bookingMatch = rawReply.match(/<!--BOOKING_JSON:(\{[\s\S]*?\})-->/);
  if (bookingMatch && bookingMatch[1]) {
    try {
      const parsed = JSON.parse(bookingMatch[1]);
      if (parsed.patient_name && parsed.time) {
        const curSitting = parsed.current_sitting || 1;
        const totSittings = parsed.total_sittings || 1;
        const summaryDate = rawReply.replace(/[*_]/g, '').match(/Date:\s*([^\r\n•]+)/i)?.[1];
        const jsonDate = typeof parsed.date === 'string' && /\d/.test(parsed.date) ? parsed.date : summaryDate;
        const validatedDate = parseRequestedBookingDate(jsonDate, calInfo.todayStr, calInfo.tomorrowStr);
        const bookingId = parsed.booking_id || generateBookingId(validatedDate);
        const rawParsedPhone = parsed.phone_number || '';
        const effectivePhone = (!isDummyPhoneNumber(rawParsedPhone) && rawParsedPhone) 
          || (options?.senderPhone && !isDummyPhoneNumber(options.senderPhone) ? options.senderPhone.trim() : '');
        const effectiveName = (parsed.patient_name && parsed.patient_name.toLowerCase() !== 'patient')
          ? parsed.patient_name
          : (options?.senderName ? formatProperName(options.senderName) : 'Valued Patient');

        isAppointmentCard = true;
        appointmentData = {
          booking_id: bookingId,
          patient_name: effectiveName,
          phone_number: effectivePhone,
          date: validatedDate,
          time: parsed.time,
          department: parsed.department || 'Aesthetic Consultation',
          doctor: parsed.doctor || 'Dr. Mrinalini',
          current_sitting: curSitting,
          total_sittings: totSittings,
          sitting_interval: parsed.sitting_interval || (totSittings > 1 ? '4 weeks' : 'As advised'),
          sitting_interval_days: parsed.sitting_interval_days || 28,
          sitting: parsed.sitting || (totSittings > 1 ? `Sitting ${curSitting} of ${totSittings}` : 'Consultation')
        };
        cleanReply = rawReply.replace(/<!--BOOKING_JSON:(\{[\s\S]*?\})-->/, '').trim();
      }
    } catch {
      // Non-blocking
    }
  }

  // Fallback: If no BOOKING_JSON tag was emitted, but the response text is clearly an appointment confirmation
  if (!isAppointmentCard) {
    if (looksLikeBookingConfirmation(rawReply)) {
      const plainReply = rawReply.replace(/[*_]/g, '');
      let nameMatch = plainReply.match(/(?:•\s*)?Patient(?:\s+Name)?:\s*([^\r\n•]+)/i) || plainReply.match(/(?:•\s*)?Name:\s*([^\r\n•]+)/i);
      let phoneMatch = plainReply.match(/(?:•\s*)?(?:Contact|Phone)(?:\s+Number)?:\s*([^\r\n•]+)/i);
      const deptMatch = plainReply.match(/(?:•\s*)?(?:Treatment|Service|Concern)(?:\s*\/\s*Concern)?:\s*([^\r\n•]+)/i);
      const docMatch = plainReply.match(/(?:•\s*)?(?:Consulting Specialist|Doctor|Consultant):\s*([^\r\n•]+)/i);
      const dateMatch = plainReply.match(/(?:•\s*)?Date:\s*([^\r\n•]+)/i) || plainReply.match(/(\d{4}-\d{2}-\d{2}|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday)/i);
      const timeMatch = plainReply.match(/(?:•\s*)?Time(?:\s+Slot)?:\s*([^\r\n•]+)/i) || plainReply.match(/(10:30\s*(?:am)?|11:30\s*(?:am)?|02:00\s*(?:pm)?|02:30\s*(?:pm)?|04:00\s*(?:pm)?|05:30\s*(?:pm)?|\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
      const bookingIdMatch = plainReply.match(/(?:•\s*)?Booking(?:\s+ID|#)?:\s*([^\r\n•]+)/i);

      // Extract phone / name from conversation history if missing from response
      if (!phoneMatch) {
        const historyText = cleanHistory.map(h => h.content).concat([message]).join(' ');
        const histPhoneMatch = historyText.match(/(\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{4}[-.\s]?\d{3}[-.\s]?\d{3}|\d{7,15})|\b\d{7,15}\b/);
        if (histPhoneMatch) phoneMatch = histPhoneMatch as any;
      }

      const rawName = nameMatch ? formatProperName(nameMatch[1].trim()) : (options?.senderName ? formatProperName(options.senderName) : 'Valued Patient');
      const detectedPhone = phoneMatch ? (phoneMatch[1] || phoneMatch[0]).trim() : '';
      const rawPhone = (!isDummyPhoneNumber(detectedPhone) && detectedPhone) 
        || (options?.senderPhone && !isDummyPhoneNumber(options.senderPhone) ? options.senderPhone.trim() : '');
      const rawDept = deptMatch ? deptMatch[1].trim() : 'Clinical Consultation';
      const rawDoc = docMatch ? docMatch[1].trim() : (activeHospitalProfile.leadDoctor || 'Dr. Mrinalini');
      const rawDate = dateMatch ? parseRequestedBookingDate(dateMatch[1] ? dateMatch[1].trim() : dateMatch[0].trim(), calInfo.todayStr, calInfo.tomorrowStr) : calInfo.tomorrowStr;
      const rawTime = timeMatch ? (timeMatch[1] || timeMatch[0]).trim().replace(/\s*\(.*?\)/, '').trim() : '11:30 AM';
      const bookingId = bookingIdMatch ? bookingIdMatch[1].trim() : generateBookingId(rawDate);

      isAppointmentCard = true;
      appointmentData = {
        booking_id: bookingId,
        patient_name: rawName,
        phone_number: rawPhone,
        date: rawDate,
        time: rawTime,
        department: rawDept,
        doctor: rawDoc,
        current_sitting: 1,
        total_sittings: 1,
        sitting_interval: 'As advised',
        sitting_interval_days: 28,
        sitting: 'Consultation'
      };
    }
  }

  // Strip any booking tag left behind (e.g. invalid JSON the parser skipped),
  // so it never reaches the patient.
  cleanReply = cleanReply.replace(/<!--\s*BOOKING_JSON[\s\S]*?(?:-->|$)/gi, '').trim();
  cleanReply = toWhatsAppFormatting(cleanReply);

  cleanReply = cleanAIOutputReplies(cleanReply, message, activeHospitalProfile, appointmentData, options?.senderPhone, options?.senderName);
  cleanReply = removeEmojisAndSmileys(cleanReply);

  return {
    reply: cleanReply,
    isAppointmentCard,
    appointmentData,
    provider: usedProvider,
    model: usedModel
  };
}

