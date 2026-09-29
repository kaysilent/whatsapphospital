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
}

export interface AIResponseResult {
  reply: string;
  isAppointmentCard: boolean;
  appointmentData: {
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

import { 
  DEFAULT_DOCTORS, 
  DOCTOR_STORAGE_KEY, 
  DoctorAvailability, 
  isDoctorAway, 
  formatDateRange,
  getRuntimeHospitalConfig,
  HospitalConfig
} from '@/lib/doctor/availability';

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
 * Helper to compute real-time dynamic date objects & strings
 */
export function getClinicalCalendarInfo(baseDate: Date = new Date()) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const today = new Date(baseDate);
  const todayStr = today.toISOString().split('T')[0];
  const todayDayName = dayNames[today.getDay()];
  const todayFormatted = `${todayDayName}, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;
  
  const currentTimeStr = today.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const tomorrow = new Date(today.getTime() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowDayName = dayNames[tomorrow.getDay()];
  const tomorrowFormatted = `${tomorrowDayName}, ${tomorrow.getDate()} ${monthNames[tomorrow.getMonth()]} ${tomorrow.getFullYear()}`;
  
  return {
    today,
    todayStr,
    todayDayName,
    todayFormatted,
    currentTimeStr,
    tomorrow,
    tomorrowStr,
    tomorrowDayName,
    tomorrowFormatted,
    year: today.getFullYear(),
  };
}

/**
 * Intelligent date parser for user date inputs
 */
export function parseRequestedBookingDate(dateInput: string | undefined, todayStr: string, tomorrowStr: string, today: Date): string {
  if (!dateInput) return tomorrowStr;
  const lower = dateInput.toLowerCase().trim();
  if (lower === 'today') return todayStr;
  if (lower === 'tomorrow') return tomorrowStr;

  const daysMap: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };

  for (const [dayName, dayIndex] of Object.entries(daysMap)) {
    if (lower.includes(dayName)) {
      const currentDayIndex = today.getDay();
      let diff = dayIndex - currentDayIndex;
      if (diff <= 0) diff += 7; // next occurrence
      const targetDate = new Date(today.getTime() + diff * 86400000);
      return targetDate.toISOString().split('T')[0];
    }
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    if (lower >= todayStr) return lower;
    return todayStr; // Past date clamped to today
  }

  // Ordinal day "24th", "25", "4th"
  const dayMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?/);
  if (dayMatch) {
    const dayNum = parseInt(dayMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const currYear = today.getFullYear();
      const currMonth = today.getMonth();
      let target = new Date(currYear, currMonth, dayNum);
      const targetStr = target.toISOString().split('T')[0];
      if (targetStr < todayStr) {
        // Roll to next month if day is in past
        target = new Date(currYear, currMonth + 1, dayNum);
      }
      return target.toISOString().split('T')[0];
    }
  }

  return tomorrowStr;
}

/**
 * Helper to clean and format patient names properly (e.g., 'Arbaz Khan', avoiding duplicates like 'Arbazarbaz').
 */
export function formatProperName(raw: string): string {
  if (!raw) return 'Patient';
  let clean = raw.trim()
    .replace(/^(?:my name is|i am|i'm|this is|patient name is|patient:?|name:?|for)\s+/i, '')
    .trim();
  
  // Remove special symbols and digits
  clean = clean.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Patient';

  // 1. Check if the whole string is duplicated (e.g. 'arbaz khanarbaz khan' or 'arbazarbaz' or 'eses')
  const len = clean.length;
  if (len >= 4 && len % 2 === 0) {
    const half = clean.slice(0, len / 2);
    if (half.toLowerCase() === clean.slice(len / 2).toLowerCase()) {
      clean = half.trim();
    }
  }

  const words = clean.split(/\s+/);
  // 2. Check if words or word-pairs are repeated
  if (words.length === 2 && words[0].toLowerCase() === words[1].toLowerCase()) {
    clean = words[0];
  } else if (words.length === 4 && `${words[0]} ${words[1]}`.toLowerCase() === `${words[2]} ${words[3]}`.toLowerCase()) {
    clean = `${words[0]} ${words[1]}`;
  } else if (words.length === 2) {
    if (words[0].length >= 4 && words[0].length % 2 === 0) {
      const h = words[0].slice(0, words[0].length / 2);
      if (h.toLowerCase() === words[0].slice(words[0].length / 2).toLowerCase()) {
        words[0] = h;
      }
    }
    if (words[1].length >= 4 && words[1].length % 2 === 0) {
      const h = words[1].slice(0, words[1].length / 2);
      if (h.toLowerCase() === words[1].slice(words[1].length / 2).toLowerCase()) {
        words[1] = h;
      }
    }
    clean = words.join(' ');
  }

  return clean
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Sanitizes and rewrites any hallucinated model meta-phrases about duplicated names or formats.
 */
export function cleanAIOutputReplies(reply: string, currentMessage?: string): string {
  if (!reply || typeof reply !== "string") return "";
  let text = reply;

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
      text = text.replace(/(?:To ensure accuracy|For our records|To ensure your booking|Please provide your Full Name)[^\r\n]*(?:without duplication|without any repetition|duplicated format|standard format)[^\r\n]*\.?(?:\r?\n)*/gi, "To ensure your booking details are accurate, please provide your WhatsApp Phone Number and Email Address.\n\n");
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
 * Intelligent Stateful Multi-Turn Clinical Fallback Engine
 * Tracks history, extracts entities, and maintains conversational state across turns.
 */
export function generateSmartClinicalFallback(
  userMsg: string, 
  history: Array<{ role: string; content: string }> = [],
  customHospitalProfile?: Partial<HospitalProfile>
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

  const hospitalProfile: HospitalProfile = {
    ...getRuntimeHospitalProfile(),
    ...(customHospitalProfile || {})
  };
  const clinicName = hospitalProfile.name || 'La Fleur Aesthetic & Wellness Clinic';
  const doctorName = hospitalProfile.leadDoctor || 'Dr. Mrinalini';
  const doctorTitle = hospitalProfile.doctorTitle || 'Senior Aesthetic Specialist';
  const clinicAddress = hospitalProfile.address 
    ? `${hospitalProfile.address}${hospitalProfile.city ? `, ${hospitalProfile.city}` : ''}${hospitalProfile.postalCode ? ` - ${hospitalProfile.postalCode}` : ''}`.replace(/,\s*-/g, '').trim()
    : 'Suite 402, Green Glen Towers, Outer Ring Road, Bangalore - 560103';
  const clinicMaps = hospitalProfile.mapsUrl || 'https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Bangalore';
  const consultationFee = hospitalProfile.consultationFee ?? 500;
  const clinicCurrency = hospitalProfile.currency || '₹';

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
    const reply = `Today's Date: ${calInfo.todayFormatted} (${calInfo.todayStr}).\n\nOur clinic is open for consultations Monday to Saturday (10:00 AM – 07:00 PM).\nWe have slots available for today (${calInfo.todayStr}), tomorrow (${calInfo.tomorrowStr}), and upcoming dates.\n\nWould you like to schedule an appointment with ${doctorName}?`;
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
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{3,4}|\+?\d{7,15}|\b\d{7,15}\b/;
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
  const activeTreatments = getRuntimeTreatments().filter(t => t.isActive);

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

  if (lower.includes('doctor') || lower.includes('timings') || lower.includes('timing') || lower.includes('open') || lower.includes('hours') || lower.includes('location') || lower.includes('address') || lower.includes('where')) {
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
    'package', 'how', 'much', 'pricing', 'cost', 'charges', 'approximate', 'range', 'a', 'an', 'the', 'my', 'me', 'our'
  ]);

  let extractedName = '';
  const explicitMatches = Array.from(userMsg.matchAll(/(?:for|patient(?: name)?(?:\s+is)?|name(?:\s+is)?|i am|i'm|this is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi));
  for (const match of explicitMatches) {
    if (match && match[1]) {
      const cand = match[1].trim();
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
        const cand = match[1].trim();
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
    const candidateWords = words.filter(w => !nonNameWords.has(w.toLowerCase()));
    if (candidateWords.length >= 1 && candidateWords.length <= 3) {
      extractedName = candidateWords.join(' ');
    }
  }

  // Check previous user messages in history if still empty
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
        const candH = hWords.filter(w => !nonNameWords.has(w.toLowerCase()));
        if (candH.length >= 1 && candH.length <= 3) {
          extractedName = candH.join(' ');
          break;
        }
      }
    }
  }

  const patientName = extractedName ? formatProperName(extractedName) : '';

  // Calculate target date
  const finalDate = parseRequestedBookingDate(dateMatch ? dateMatch[1] : undefined, calInfo.todayStr, calInfo.tomorrowStr, calInfo.today);
  const targetDateObj = new Date(finalDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const formattedDay = dayNames[targetDateObj.getDay()];

  // Doctor Availability & Holiday Check
  const runtimeDocs = getRuntimeDoctors();
  const targetDoc = runtimeDocs[0] || { doctorName: 'Dr. Mrinalini', status: 'available' as const };
  const hospitalCfg = getRuntimeHospitalConfig();

  if (hospitalCfg.status === 'offline') {
    const returnTime = hospitalCfg.offlineReturnTime || '02:00 PM';
    const reason = hospitalCfg.offlineReason || 'Clinical Procedure / Break';
    const reply = `Doctor Status Notice:\nDr. Mrinalini is currently away for ${reason} and will be back at ${returnTime}.\n\nWould you like to reserve a consultation slot after ${returnTime}?`;
    return { reply, appointmentObj: null };
  }

  if (hospitalCfg.status === 'holiday') {
    const holidayRange = formatDateRange(hospitalCfg.holidayStartDate, hospitalCfg.holidayEndDate);
    const reasonText = hospitalCfg.holidayReason ? ` (${hospitalCfg.holidayReason})` : '';
    const reply = `Doctor Availability Notice:\nDr. Mrinalini is away on holiday from ${holidayRange || 'this week'}${reasonText}.\n\nWould you like to schedule your consultation after their return?`;
    return { reply, appointmentObj: null };
  }

  if (targetDoc && isDoctorAway(targetDoc as any, finalDate)) {
    const holidayRange = formatDateRange(targetDoc.startDate, targetDoc.endDate);
    const reasonText = targetDoc.reason ? ` (${targetDoc.reason})` : '';
    const reply = `Doctor Availability Notice:\nDr. Mrinalini is away on leave from ${holidayRange || 'this week'}${reasonText}.\n\nWould you like to schedule your consultation after ${targetDoc.endDate || 'their return'}?`;
    return { reply, appointmentObj: null };
  }

  // ============================================================
  // MANDATORY MULTI-STEP CLINICAL INTAKE PROTOCOL
  // ============================================================
  const hasRealTreatment = treatment && treatment !== 'Clinical Consultation';
  const hasTime = !!activeTime;
  const hasName = !!patientName && patientName.length >= 2 && patientName.toLowerCase() !== 'patient';
  const hasPhone = !!(phoneMatch && phoneMatch[0]);
  const hasEmail = !!(emailMatch && emailMatch[0]);
  const isBookingIntent = lower.includes('book') || lower.includes('appointment') || lower.includes('schedule') || lower.includes('slot') || lower.includes('timings') || lower.includes('timing') || lower.includes('time') || lower.includes('tomorrow') || lower.includes('today');

  // 4-Question Pricing Qualification Gate
  const isPricingQuery = lower.includes('price') || lower.includes('cost') || lower.includes('package') || lower.includes('how much') || lower.includes('charges') || lower.includes('rate');
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

  // STEP 4: Full Patient Intake Complete (Treatment, Slot/Time, Name, Phone, and Email / Direct Booking)
  const isDirectBookingCommand = lower.includes('book') && hasTime && hasName && hasPhone;
  if (hasTime && hasName && ((hasPhone && hasEmail) || isDirectBookingCommand)) {
    const finalPhone = phoneMatch ? phoneMatch[0].trim() : '+91 98765 43210';
    const finalEmail = emailMatch ? emailMatch[0].trim() : `${patientName.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    const rawTime = activeTime;

    const appointmentObj: AIResponseResult['appointmentData'] = {
      patient_name: patientName,
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
      : `\n• Type: Clinical Assessment`;

    const reply = `Appointment Confirmed! (Consultation Confirmed)\n\nYour consultation has been reserved at ${clinicName}:\n\n• Patient Name: ${appointmentObj.patient_name}\n• Contact Number: ${finalPhone}\n• Email: ${finalEmail}\n• Treatment / Concern: ${appointmentObj.department}${sittingInfoLine}\n• Consulting Specialist: ${doctorName}\n• Date: ${appointmentObj.date} (${formattedDay})\n• Time Slot: ${appointmentObj.time}\n\n• Booking Fee Policy:\nA single booking fee of ${clinicCurrency}${consultationFee} is payable online via Razorpay, UPI, or Card to lock and secure your appointment slot.\n\n• Clinic Location (Google Maps):\n${clinicMaps}\nAddress: ${clinicAddress}.\n\nOur clinic team will share pre-procedure care instructions before your appointment.`;

    return { reply, appointmentObj };
  }

  // STEP 3: Slot selected (or number 1-5 chosen), but missing Name, Phone, or Email
  if (hasTime) {
    if (!hasName) {
      const reply = `Great! I have reserved the ${activeTime} slot on ${formattedDay}, ${finalDate} for your ${treatment} consultation with ${doctorName}.\n\nTo complete your appointment registration, please provide:\n• Your Full Name\n• WhatsApp Phone Number\n• Email Address (for booking pass & invoice confirmation)`;
      return { reply, appointmentObj: null };
    }
    if (hasPhone && !hasEmail) {
      const capturedPhone = phoneMatch ? phoneMatch[0].trim() : '';
      const reply = `Thank you, ${patientName}!\n\nI have recorded your WhatsApp contact number: ${capturedPhone}.\n\nTo finalize your ${treatment} consultation for ${activeTime} on ${formattedDay}, ${finalDate}, please provide your Email Address (for your digital booking pass & payment invoice).`;
      return { reply, appointmentObj: null };
    }
    if (!hasPhone && hasEmail) {
      const capturedEmail = emailMatch ? emailMatch[0].trim() : '';
      const reply = `Thank you, ${patientName}!\n\nI have recorded your email: ${capturedEmail}.\n\nTo finalize your ${treatment} consultation for ${activeTime} on ${formattedDay}, ${finalDate}, please provide your WhatsApp Contact Phone Number.`;
      return { reply, appointmentObj: null };
    }
    // Missing both phone and email
    const reply = `Thank you, ${patientName}!\n\nTo finalize your ${treatment} consultation booking for ${activeTime} on ${formattedDay}, ${finalDate}, please provide:\n• WhatsApp Contact Phone Number\n• Email Address (for your booking pass & payment invoice)`;
    return { reply, appointmentObj: null };
  }

  // STEP 2: Treatment mentioned or User asks to book / slot timings -> Offer numbered slots 1 to 5
  if (isBookingIntent || hasRealTreatment) {
    const reply = `We would be delighted to schedule your ${treatment} consultation with ${doctorName}.\n\nAvailable consultation slots for tomorrow, ${calInfo.tomorrowFormatted}:\n1. 10:30 AM\n2. 11:30 AM\n3. 02:30 PM\n4. 04:00 PM\n5. 05:30 PM\n\nPlease reply with your preferred slot number (1–5) or time, and let us know if you prefer a different date!`;
    return { reply, appointmentObj: null };
  }

  // STEP 1: General Greeting & Treatment Discovery
  const reply = `Hello! Welcome to ${clinicName}.\n\nI am your AI clinical assistant for ${doctorName} (${doctorTitle}). We are tied up with leading plastic surgeons in the city.\n\nWebsite: ${hospitalProfile.website || 'https://lafleurwellness.com'}\nInstagram: ${hospitalProfile.instagram || 'https://instagram.com/lafleur.clinic'}\n\nWhat clinical treatment or skin/hair concern can we help you with today?\n• Laser Hair Reduction\n• Acne & Acne Scar Treatments\n• PRP Hair Restoration & Scalp Therapy\n• HydraFacial Deluxe & Skin Glow\n• Chemical Brightening Peels & Pigmentation\n• Anti-Aging, Botox & Dermal Fillers\n• In-Person Clinical Consultation\n\nPlease let us know what you are looking for, or if you would like to book a consultation!`;
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
}

const globalServerAIConfig: GlobalServerAIConfig = {
  provider: (process.env.DEFAULT_AI_PROVIDER as any) || 'gemini',
  apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '',
  model: process.env.DEFAULT_AI_MODEL || 'gemini-2.5-flash',
  customBaseUrl: process.env.CUSTOM_AI_BASE_URL || 'http://localhost:11434/v1',
  temperature: 0.7,
  maxTokens: 1024,
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
      const update: Partial<GlobalServerAIConfig> = {
        provider: (row.provider as any) || 'gemini',
        model: row.model || 'gemini-2.5-flash',
        apiKey: decryptedKey || globalServerAIConfig.apiKey,
        customBaseUrl: row.custom_base_url || globalServerAIConfig.customBaseUrl,
        temperature: row.temperature !== null ? Number(row.temperature) : 0.7,
        maxTokens: row.max_tokens !== null ? Number(row.max_tokens) : 1024,
      };
      setGlobalServerAIConfig(update);
    }
  } catch (err) {
    console.warn('[Server AI Config DB Sync Warning]:', err);
  }
  return globalServerAIConfig;
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

  const activeHospitalProfile: HospitalProfile = {
    ...getRuntimeHospitalProfile(),
    ...(hospitalProfile || {})
  };
  const clinicFee = activeHospitalProfile.consultationFee ?? 500;
  const clinicCurrency = activeHospitalProfile.currency || '₹';
  const clinicAddress = activeHospitalProfile.address 
    ? `${activeHospitalProfile.address}${activeHospitalProfile.city ? `, ${activeHospitalProfile.city}` : ''}${activeHospitalProfile.postalCode ? ` - ${activeHospitalProfile.postalCode}` : ''}`.replace(/,\s*-/g, '').trim()
    : 'Suite 402, Green Glen Towers, Outer Ring Road, Bangalore - 560103';
  const clinicMaps = activeHospitalProfile.mapsUrl || 'https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Bangalore';
  const clinicName = activeHospitalProfile.name || 'La Fleur Aesthetic & Wellness Clinic';

  if (isTestEnv) {
    const fallback = generateSmartClinicalFallback(message, conversationHistory, activeHospitalProfile);
    return {
      reply: removeEmojisAndSmileys(fallback.reply),
      isAppointmentCard: !!fallback.appointmentObj,
      appointmentData: fallback.appointmentObj,
      provider: 'clinical-receptionist-engine',
      model: 'stateful-v2'
    };
  }

  let serverConfig = getGlobalServerAIConfig();
  if (!serverConfig.apiKey && (!llmConfig?.apiKey || !llmConfig.apiKey.trim())) {
    serverConfig = await syncServerAIConfigFromDatabase();
  }

  const provider = llmConfig?.provider || serverConfig.provider || 'gemini';
  const apiKey = (llmConfig?.apiKey && llmConfig.apiKey.trim()) || (serverConfig.apiKey && serverConfig.apiKey.trim()) || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
  let model = llmConfig?.model || serverConfig.model || (provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
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

=== REAL-TIME CLINIC CALENDAR & CLOCK ===
• Current Real-Time Date: ${calInfo.todayStr} (${calInfo.todayFormatted})
• Current Real-Time Time: ${calInfo.currentTimeStr}
• Tomorrow's Date: ${calInfo.tomorrowStr} (${calInfo.tomorrowFormatted})
• Current Year: ${calInfo.year}
• Real-Time Slot Rule: When offering appointment slots for TODAY (${calInfo.todayStr}), only suggest slots that are AFTER the current time (${calInfo.currentTimeStr}). Do not offer past hours. If clinic hours have passed for today, offer slots starting from tomorrow.`;

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

  let fullSystemInstruction = `${systemPrompt || `You are an intelligent, empathetic, highly professional WhatsApp clinic assistant for ${clinicName}.`}

CRITICAL CONVERSATIONAL & CLINICAL PROTOCOL GUIDELINES:
1. STRICT TONE & NO EMOJIS:
   - DO NOT USE ANY EMOJIS, SMILEY FACES, OR CASUAL SYMBOLS (such as 😊, 🌸, 🩺, :), etc.). Keep the tone clean, clinical, polished, and medical.
   - Always ensure your answers are complete sentences without being cut off mid-thought.
2. DOCTOR & CLINIC IDENTITY:
   - The sole consulting specialist is ${activeDocName} (${activeDocTitle}).
   - DO NOT repeat the doctor's name unnecessarily in every single sentence. Mention only when relevant.
   - DO NOT use the term "Dermatologist", "3D dermascope", or "digital dermoscopy". Use "detailed clinical analysis" or "in-person consultation".
   - NEVER use the phrase: "To determine the most suitable approach for your specific condition, ${activeDocName} conducts a detailed 3D dermascope assessment during a consultation."
3. WELCOME & CLINICAL CREDENTIALS:
   - When greeting, state that you are an AI clinical assistant for ${activeDocName} at ${clinicName}, mention our tie-up with leading plastic surgeons in the city, and provide the website (${activeHospitalProfile.website || 'https://lafleurwellness.com'}) and Instagram (${activeHospitalProfile.instagram || 'https://instagram.com/lafleur.clinic'}).
4. FIXED BOOKING FEE POLICY:
   - Fixed booking fee is ${clinicCurrency}${clinicFee} payable via online payment gateway (Razorpay / UPI / Card) to lock and confirm the appointment slot.
5. CLINIC LOCATION & GOOGLE MAPS LINK:
   - Provide clinic Google Maps link: ${clinicMaps} (Address: ${clinicAddress}).
6. REAL-TIME CALENDAR & DATES:
   - Current Real-Time Date: ${calInfo.todayFormatted} (${calInfo.todayStr}).
   - Tomorrow's Date: ${calInfo.tomorrowFormatted} (${calInfo.tomorrowStr}).
   - If a patient asks what is today's date, state that today is ${calInfo.todayFormatted}.
   - All appointments MUST be scheduled for Today (${calInfo.todayStr}) or a Future Date. NEVER use past or placeholder dates.
7. MANDATORY 4-STEP INTAKE PROTOCOL - GATHER COMPLETE DETAILS BEFORE CONFIRMING ANY BOOKING:
   You MUST guide the patient step-by-step and gather ALL 4 pieces of information across the conversation:
   - Step 1: Clinical Concern & Treatment Discovery (Ask what concern they want to address: Laser Hair Reduction, Acne Scars, PRP Hair Therapy, HydraFacial Deluxe, Chemical Peels, Anti-Aging & Botox, or In-Person Consultation).
   - Step 2: Date & Slot Selection (Offer numbered slots: 1. 10:30 AM, 2. 11:30 AM, 3. 02:30 PM, 4. 04:00 PM, 5. 05:30 PM. If the user replies with a number like '4', '1', '2', recognize it as Slot 4 = 04:00 PM. Never say '44 is not valid').
   - Step 3: Patient Registration Details:
     • Full Name: Accept whatever name the patient provides directly (e.g. 'Arbaz' or 'Arbaz Khan'). Acknowledge their name warmly and accurately (for example: "Thank you, Arbaz!" or "Thank you, Arbaz Khan!") and ask for their WhatsApp phone number and email address.
     • WhatsApp Contact Phone Number (e.g. '+91 98765 43210')
     • Email Address (e.g. 'patient@example.com' - for sending the digital booking pass and payment invoice)
     If the user provides only their name, ask for their phone number and email address before proceeding.
   - Step 4: Comprehensive Confirmation Summary & Payment Link:
     • ONLY when Treatment, Slot/Date, Full Name, Phone Number, and Email Address are all present, confirm the booking and append the invisible <!--BOOKING_JSON:...--> tag at the VERY END.
     CRITICAL: NEVER confirm an appointment or output the <!--BOOKING_JSON:...--> tag prematurely if phone number, email, or name are missing.
8. SYMPTOM SHARING VS BOOKING:
   - If a patient describes symptoms or previous treatment history (e.g. hair thinning, using Mintop, acne scars), acknowledge their clinical history, explain the treatment protocol, and offer consultation timings.
9. Multi-Sitting Treatment Tracking & Intervals:
   - When explaining treatments or booking courses, state approved sittings and intervals (e.g., Laser Hair Reduction: 6 sessions spaced 4-6 weeks apart; PRP Hair Restoration: 4 sessions spaced 3-4 weeks apart; Chemical Peels: 4 sessions spaced 2-3 weeks apart; RF Skin Tightening: 4 sessions spaced 3-4 weeks apart).
   - Inform patients that after each completed sitting, automated follow-ups and next-sitting due reminders will be sent via WhatsApp.
10. PRICING RULES:
   - When discussing treatment pricing, provide approximate ranges rather than fixed guarantees.
11. WhatsApp Formatting: Use *bold* for highlights and • for bullet points. Do not use Markdown header hashtags like '#' or multiple asterisks '***'.
12. Final Booking Pass Tag:
   - Only upon completing all 4 intake steps (Treatment, Slot, Full Name, Phone, Email), append:
<!--BOOKING_JSON:{"patient_name":"...","phone_number":"...","date":"${calInfo.tomorrowStr}","time":"...","department":"...","doctor":"${activeDocName}","current_sitting":1,"total_sittings":6,"sitting_interval":"4-6 weeks","sitting_interval_days":28}-->

${calendarContext}`;

  // Inject Dynamic Hospital Profile & Treatment Catalog
  const activeTreatmentsCatalog = getRuntimeTreatments();
  const hospitalCatalogText = buildHospitalKnowledgeText(activeHospitalProfile, activeTreatmentsCatalog);
  fullSystemInstruction += `\n\n${hospitalCatalogText}`;

  const activeKnowledge = (knowledgeContext && knowledgeContext.trim()) || getRuntimeKnowledgeContext();
  if (activeKnowledge && activeKnowledge.trim()) {
    fullSystemInstruction += `\n\n=== VERIFIED CLINIC KNOWLEDGE BASE (PRIMARY SOURCE OF TRUTH) ===\n${activeKnowledge}\n================================================================`;
  }

  const cleanHistory = sanitizeConversationHistory(conversationHistory, message);
  let rawReply = '';
  let usedProvider: string = provider;
  let usedModel: string = model;

  // 1. If API Key is present, query the user-selected provider
  if (apiKey && !isTestEnv) {
    // 1.1 Google Gemini
    if (provider === 'gemini') {
      const candidateModels = [model, 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'].filter((v, i, a) => a.indexOf(v) === i);
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
    const fallback = generateSmartClinicalFallback(message, cleanHistory, activeHospitalProfile);
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
        const validatedDate = parseRequestedBookingDate(parsed.date, calInfo.todayStr, calInfo.tomorrowStr, calInfo.today);
        isAppointmentCard = true;
        appointmentData = {
          patient_name: parsed.patient_name,
          phone_number: parsed.phone_number || '+91 98765 43210',
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

  cleanReply = cleanAIOutputReplies(cleanReply, message);
  cleanReply = removeEmojisAndSmileys(cleanReply);

  return {
    reply: cleanReply,
    isAppointmentCard,
    appointmentData,
    provider: usedProvider,
    model: usedModel
  };
}

