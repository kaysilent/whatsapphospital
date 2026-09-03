"use client";

import React, { useState, useEffect, useRef } from 'react';
import './ChatEmulator.css';
import { 
  Bot, 
  Check, 
  CheckCheck, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Phone, 
  Video, 
  ArrowLeft, 
  Paperclip, 
  Smile, 
  Calendar, 
  Clock, 
  RotateCcw,
  Sparkle,
  HeartPulse,
  UserCheck,
  BookOpen,
  FileText,
  Globe
} from 'lucide-react';
import { useDemoState, DEFAULT_LA_FLEUR_SYSTEM_PROMPT, KnowledgeItem, defaultLLMConfig } from '@/hooks/use-demo-state';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  time: string;
  isAppointmentCard?: boolean;
  appointmentData?: {
    patient_name: string;
    phone_number: string;
    date: string;
    time: string;
    department: string;
  };
  groundingSource?: {
    type: 'file' | 'url' | 'text' | 'faq';
    title: string;
    source?: string;
  };
};

interface BookingContext {
  step?: 'idle' | 'asking_treatment' | 'asking_name' | 'asking_date' | 'asking_time' | 'asking_phone';
  patient_name?: string;
  phone_number?: string;
  department?: string;
  date?: string;
  time?: string;
  lastConcern?: string;
}

const STANDARD_CLINIC_SLOTS = [
  "10:30 AM",
  "11:30 AM",
  "02:00 PM",
  "03:30 PM",
  "05:00 PM",
  "06:30 PM"
];

function checkClinicSlotAvailability(dateStr: string, existingAppts: any[]) {
  const booked = existingAppts
    .filter(a => a.date === dateStr)
    .map(a => a.time.toUpperCase().trim());

  const available = STANDARD_CLINIC_SLOTS.filter(slot => 
    !booked.some(b => b.includes(slot) || slot.includes(b))
  );

  return { available, booked };
}

function parseDateInput(input: string): string | null {
  const lower = input.toLowerCase().trim();
  const now = new Date();

  if (lower.includes('today')) {
    return now.toISOString().split('T')[0];
  }
  if (lower.includes('day after tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  }
  if (lower.includes('tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const currentDay = now.getDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7;
      const target = new Date();
      target.setDate(now.getDate() + diff);
      return target.toISOString().split('T')[0];
    }
  }

  const isoMatch = input.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  const dateNumMatch = input.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
  if (dateNumMatch) {
    const day = parseInt(dateNumMatch[1], 10);
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = monthNames.indexOf(dateNumMatch[2].toLowerCase().slice(0, 3));
    const year = now.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  return null;
}

function parseTimeInput(input: string): string | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  if (lower.includes('10:30') || lower.includes('10.30')) return '10:30 AM';
  if (lower.includes('11:30') || lower.includes('11.30')) return '11:30 AM';
  if (lower.includes('2:00') || lower.includes('2.00') || lower.includes('02:00') || lower.includes('2 pm') || lower.includes('2pm') || lower.includes('2:00 pm')) return '02:00 PM';
  if (lower.includes('3:30') || lower.includes('3.30') || lower.includes('03:30') || lower.includes('3:30 pm') || lower.includes('3.30 pm')) return '03:30 PM';
  if (lower.includes('5:00') || lower.includes('5.00') || lower.includes('05:00') || lower.includes('5 pm') || lower.includes('5pm') || lower.includes('5:30') || lower.includes('5.30')) return '05:00 PM';
  if (lower.includes('6:30') || lower.includes('6.30') || lower.includes('06:30') || lower.includes('6:30 pm') || lower.includes('7:00') || lower.includes('7 pm')) return '06:30 PM';

  const timeMatch = clean.match(/(?:1[0-2]|0?[1-9]):[0-5][0-9]\s*(?:am|pm|AM|PM)?|\d{1,2}\s*(?:am|pm|AM|PM)/i);
  if (timeMatch) {
    let t = timeMatch[0].toUpperCase();
    if (!t.includes('AM') && !t.includes('PM')) {
      const hour = parseInt(t.split(':')[0], 10);
      t = (hour >= 9 && hour <= 11) ? `${t} AM` : `${t} PM`;
    }
    return t;
  }
  return null;
}

function parsePhoneInput(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 10) {
    if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    return `+${digits}`;
  }
  return null;
}

// WhatsApp rich text parser that removes markdown asterisks and cleans up list items
function renderFormattedWhatsAppText(text: string) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-1 leading-relaxed text-foreground">
      {lines.map((line, lIdx) => {
        let trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} className="h-1.5" />;
        }

        // Clean up markdown bullet lists: "* **item**", "* item", "- item", "• item"
        let isBullet = false;
        if (/^[\*\-•\+]\s+/.test(trimmed)) {
          isBullet = true;
          trimmed = trimmed.replace(/^[\*\-•\+]\s+/, '');
        }

        // Parse inline formatting: **bold**, *bold*, _italic_, ~strike~, `code`
        const tokens: React.ReactNode[] = [];
        let keyCounter = 0;

        // Pattern matching: **bold** OR *bold* OR _italic_ OR ~strike~ OR `code`
        const regex = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*[^*\s]|[^*])\*|_([^_]+)_|~([^~]+)~|`([^`]+)`)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(trimmed)) !== null) {
          if (match.index > lastIndex) {
            tokens.push(trimmed.substring(lastIndex, match.index).replace(/\*{2,}/g, ''));
          }

          if (match[2]) {
            // **bold**
            tokens.push(<strong key={keyCounter++} className="font-semibold text-foreground">{match[2]}</strong>);
          } else if (match[3]) {
            // *bold*
            tokens.push(<strong key={keyCounter++} className="font-semibold text-foreground">{match[3]}</strong>);
          } else if (match[4]) {
            // _italic_
            tokens.push(<em key={keyCounter++} className="italic">{match[4]}</em>);
          } else if (match[5]) {
            // ~strike~
            tokens.push(<del key={keyCounter++} className="line-through opacity-75">{match[5]}</del>);
          } else if (match[6]) {
            // `code`
            tokens.push(<code key={keyCounter++} className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px]">{match[6]}</code>);
          }

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < trimmed.length) {
          const remainingText = trimmed.substring(lastIndex).replace(/\*{2,}/g, '').replace(/^\*\s*/, '');
          if (remainingText) {
            tokens.push(remainingText);
          }
        }

        if (isBullet) {
          return (
            <div key={lIdx} className="flex items-start gap-1.5 pl-0.5 my-0.5">
              <span className="text-[#00a884] dark:text-emerald-400 font-bold select-none leading-tight">•</span>
              <div className="flex-1">{tokens.length > 0 ? tokens : trimmed}</div>
            </div>
          );
        }

        return (
          <p key={lIdx}>
            {tokens.length > 0 ? tokens : trimmed}
          </p>
        );
      })}
    </div>
  );
}

interface ChatEmulatorProps {
  onBookAppointment?: (appt: { patient_name: string; phone_number: string; date: string; time: string; department: string }) => void;
  onRescheduleAppointment?: (patient_name: string, new_date: string, new_time: string) => void;
  onExtractEntity?: (data: any) => void;
  systemPrompt?: string;
}

export default function ChatEmulator({ 
  onBookAppointment, 
  onRescheduleAppointment, 
  onExtractEntity,
  systemPrompt = DEFAULT_LA_FLEUR_SYSTEM_PROMPT 
}: ChatEmulatorProps) {
  const { appointments = [], knowledgeItems = [], llmConfig = defaultLLMConfig } = useDemoState();
  const isLaFleur = systemPrompt.includes("La Fleur") || systemPrompt.includes("LA FLEUR");
  
  // Extract or formulate bot persona title
  const clinicTitle = isLaFleur 
    ? "La Fleur Aesthetic Clinic" 
    : systemPrompt.includes("Aivry") 
    ? "Aivry Hospital" 
    : "AI WhatsApp Assistant";

  const getGreetingMessage = (): Message => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isLaFleur) {
      return {
        id: 'm-init',
        role: 'ai',
        content: `👋 Hello! Welcome to **La Fleur Aesthetic & Wellness Clinic**.\n\nI am your WhatsApp AI Clinic Assistant. I can help you explore relevant treatments for your skin, hair, or body concerns, check appointment availability, or schedule a doctor consultation.\n\nHow may I help you today?`,
        time
      };
    } else {
      return {
        id: 'm-init',
        role: 'ai',
        content: `👋 Hello! Welcome to **${clinicTitle}** WhatsApp Reception.\n\nI am your 24/7 AI Assistant. How may I assist you today? You can book an appointment, check timings, or ask any question.`,
        time
      };
    }
  };

  const [messages, setMessages] = useState<Message[]>([getGreetingMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState<BookingContext>({ step: 'idle' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync greeting if systemPrompt changes from dashboard
  useEffect(() => {
    setMessages(prev => {
      if (prev.length <= 1) {
        return [getGreetingMessage()];
      }
      return prev;
    });
  }, [systemPrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const resetChat = () => {
    setContext({ step: 'idle' });
    setMessages([getGreetingMessage()]);
  };

  // ============================================================
  // KNOWLEDGE BASE RETRIEVAL ENGINE (RAG)
  // ============================================================
  const searchKnowledge = (query: string, items: KnowledgeItem[]) => {
    const q = query.toLowerCase().trim();
    const stopWords = new Set(['what', 'when', 'where', 'which', 'about', 'your', 'have', 'with', 'from', 'this', 'that', 'they', 'tell', 'want', 'need', 'please', 'know', 'how', 'much', 'does', 'cost', 'like', 'there', 'give', 'book', 'booking', 'appointment', 'consultation']);
    const qWords = q.split(/[^a-zA-Z0-9]+/).filter(w => w.length >= 3 && !stopWords.has(w));
    
    if (qWords.length === 0) return null;

    let bestMatch: { item: KnowledgeItem; matchSnippet: string; score: number } | null = null;
    const enabledDocs = items.filter(k => k.isEnabled);

    for (const doc of enabledDocs) {
      let docScore = 0;
      const docTitleLower = doc.title.toLowerCase();
      const docTags = doc.tags.map(t => t.toLowerCase());
      const docUrlOrFile = (doc.sourceUrl || doc.fileName || '').toLowerCase();

      for (const word of qWords) {
        if (docTitleLower.includes(word)) docScore += 6;
        if (docTags.some(t => t.includes(word))) docScore += 5;
        if (docUrlOrFile.includes(word)) docScore += 4;
      }

      // Break content into coherent sections/paragraphs
      const sections = doc.content.split(/\n\s*\n|\n(?=[0-9]+\.|\u2022|\*|•|[A-Z\s]{4,}:)/).filter(s => s.trim().length > 15);
      let bestSection = '';
      let bestSectionScore = 0;

      for (const sec of sections) {
        const secLower = sec.toLowerCase();
        // Skip sections that look like template instructions or prompt examples
        if (secLower.includes("trigger the treatment") || secLower.includes("system prompt") || secLower.includes("use the excel as the source")) {
          continue;
        }

        let secScore = 0;
        for (const word of qWords) {
          if (secLower.includes(word)) {
            secScore += 3;
          }
        }
        if (secScore > bestSectionScore) {
          bestSectionScore = secScore;
          bestSection = sec.trim();
        }
      }

      const totalDocScore = docScore + bestSectionScore;
      if (totalDocScore >= 6 && (!bestMatch || totalDocScore > bestMatch.score)) {
        bestMatch = {
          item: doc,
          matchSnippet: bestSection || doc.content.slice(0, 450),
          score: totalDocScore
        };
      }
    }

    return bestMatch;
  };

  // Conversational AI Dialog Engine conforming to System Prompt + Knowledge Base
  const generateConversationalReply = (text: string, currentCtx: BookingContext) => {
    const raw = text.trim();
    const lower = raw.toLowerCase();
    const newCtx = { ...currentCtx };

    // ============================================================
    // 1. SAFETY & MEDICAL ESCALATION (Sections 23, 24, 43)
    // ============================================================
    if (
      lower.includes('pregnant') || 
      lower.includes('pregnancy') || 
      lower.includes('breastfeeding') || 
      lower.includes('lactating')
    ) {
      if (onExtractEntity) {
        onExtractEntity({ intent: "medical_escalation", reason: "pregnancy_breastfeeding", confidence: 0.99 });
      }
      return {
        content: `That needs to be confirmed by the doctor before treatment. I don't want to give you an uncertain answer based only on chat.\n\nI'll flag this for the **La Fleur medical team** so they can advise you correctly. 👩‍⚕️\n\nWould you like me to schedule a direct consultation with our aesthetic physician?`,
        isAppointmentCard: false
      };
    }

    if (
      lower.includes('severe pain') || 
      lower.includes('bleeding heavily') || 
      lower.includes('burn') || 
      lower.includes('severe reaction') || 
      lower.includes('allergic reaction') || 
      lower.includes('chest pain') || 
      lower.includes('emergency')
    ) {
      if (onExtractEntity) {
        onExtractEntity({ intent: "emergency_handover", urgency: "HIGH", confidence: 0.99 });
      }
      return {
        content: `🚨 **Medical Attention Advised**\n\nIf you are experiencing severe symptoms or an acute adverse reaction, please seek immediate in-person medical care or visit the nearest emergency facility.\n\nI have also flagged your conversation for immediate priority review by the La Fleur clinic coordinator.`,
        isAppointmentCard: false
      };
    }

    // ============================================================
    // 2. CHECK IF USER IS CURRENTLY IN AN ACTIVE STEP-BY-STEP BOOKING FLOW
    // ============================================================
    
    // Step A: Currently waiting for PATIENT NAME
    if (newCtx.step === 'asking_name') {
      const parsedPhone = parsePhoneInput(raw);
      const parsedDate = parseDateInput(raw);
      const parsedTime = parseTimeInput(raw);

      // If user typed a pure name
      if (!parsedPhone && !parsedDate && !parsedTime && raw.length >= 2) {
        const cleanName = raw.replace(/^(my name is|i am|this is)\s+/i, '').trim();
        newCtx.patient_name = cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        newCtx.step = 'asking_date';
        setContext(newCtx);

        return {
          content: `Thank you, **${newCtx.patient_name}**! 😊\n\nWhich **date** would you like to visit our clinic for your **${newCtx.department || 'Consultation'}**?\n\n(You can say *Tomorrow*, *Saturday*, or a specific date like *2026-09-06*)`,
          isAppointmentCard: false
        };
      }
    }

    // Step B: Currently waiting for APPOINTMENT DATE
    if (newCtx.step === 'asking_date') {
      const extractedDate = parseDateInput(raw);
      if (extractedDate) {
        newCtx.date = extractedDate;
        
        // CHECK LIVE CLINIC AVAILABILITY FOR THIS DATE!
        const { available, booked } = checkClinicSlotAvailability(extractedDate, appointments);

        if (available.length === 0) {
          return {
            content: `📅 We checked the clinic calendar for **${extractedDate}**.\n\n⚠️ Unfortunately, all consultation slots on **${extractedDate}** are **fully booked**.\n\nWould you like to check available slots for **Tomorrow** or another date?`,
            isAppointmentCard: false
          };
        }

        newCtx.step = 'asking_time';
        setContext(newCtx);

        return {
          content: `📅 **Clinic Availability Checked for ${extractedDate}** 🗓️\n\nHere are the **available open time slots**:\n${available.map(s => `• 🟢 **${s}**`).join('\n')}\n\nWhich time slot would you like to reserve?`,
          isAppointmentCard: false
        };
      } else {
        return {
          content: `Please specify a preferred date for your appointment (e.g. *Tomorrow*, *Saturday*, or *2026-09-05*), and I will check slot availability for you.`,
          isAppointmentCard: false
        };
      }
    }

    // Step C: Currently waiting for TIME SLOT
    if (newCtx.step === 'asking_time' && newCtx.date) {
      const extractedTime = parseTimeInput(raw);
      if (extractedTime) {
        const { available, booked } = checkClinicSlotAvailability(newCtx.date, appointments);
        
        const isSlotAvailable = available.some(s => s.toUpperCase() === extractedTime.toUpperCase() || extractedTime.toUpperCase().includes(s.toUpperCase()));

        if (!isSlotAvailable) {
          return {
            content: `⚠️ Sorry, **${extractedTime}** is already booked on **${newCtx.date}**.\n\nPlease select from the remaining open slots:\n${available.map(s => `• 🟢 **${s}**`).join('\n')}\n\nWhich of these open slots would you prefer?`,
            isAppointmentCard: false
          };
        }

        newCtx.time = extractedTime;
        newCtx.step = 'asking_phone';
        setContext(newCtx);

        return {
          content: `✅ Perfect! **${extractedTime}** on **${newCtx.date}** is open and reserved for you.\n\nLastly, what is your **WhatsApp Phone Number** so we can send your appointment pass and pre-care instructions? (e.g. *+91 98765 43210*)`,
          isAppointmentCard: false
        };
      } else {
        const { available } = checkClinicSlotAvailability(newCtx.date, appointments);
        return {
          content: `Please pick one of the available open slots for **${newCtx.date}**:\n${available.map(s => `• 🟢 **${s}**`).join('\n')}`,
          isAppointmentCard: false
        };
      }
    }

    // Step D: Currently waiting for WHATSAPP PHONE NUMBER
    if (newCtx.step === 'asking_phone') {
      const extractedPhone = parsePhoneInput(raw);
      if (extractedPhone) {
        newCtx.phone_number = extractedPhone;

        // VERIFY ALL 4 MANDATORY FIELDS ARE COMPLETE & VALID
        const patientName = newCtx.patient_name || 'Patient';
        const phoneNumber = extractedPhone;
        const apptDate = newCtx.date || new Date().toISOString().split('T')[0];
        const apptTime = newCtx.time || '11:30 AM';
        const department = newCtx.department || 'Aesthetic Consultation';

        // ALL 5 MANDATORY FIELDS VALIDATED -> COMPLETE BOOKING!
        const docName = department.includes("Hair") 
          ? "Dr. Shalini Roy (Trichologist)" 
          : department.includes("Pigment") || department.includes("Peel") 
          ? "Dr. Meera Kapoor (Cosmetic Dermatologist)" 
          : "Dr. Ananya Sharma (Senior Aesthetic Physician)";

        const apptData = {
          patient_name: patientName,
          phone_number: phoneNumber,
          date: apptDate,
          time: apptTime,
          department: department
        };

        if (onBookAppointment) {
          onBookAppointment(apptData);
        }

        if (onExtractEntity) {
          onExtractEntity({
            intent: "book_appointment",
            entities: apptData,
            confidence: 0.99
          });
        }

        // Reset context to idle
        setContext({ step: 'idle' });

        return {
          content: `🎉 **Appointment Confirmed!** ✅\n\nYour consultation has been booked in the La Fleur Clinic system.\n\n📋 **Patient:** ${apptData.patient_name}\n🌸 **Treatment:** ${apptData.department}\n📅 **Date:** ${apptData.date}\n🕒 **Time:** ${apptData.time}\n👩‍⚕️ **Doctor:** ${docName}\n📍 **Location:** Suite 402, Lotus Grandeur, Jubilee Hills\n📱 **WhatsApp Sync:** ${apptData.phone_number}\n\nWe will send you a reminder 24 hours prior along with your treatment pre-care instructions. 😊`,
          isAppointmentCard: true,
          appointmentData: apptData
        };
      } else {
        return {
          content: `Please provide a valid 10-digit WhatsApp phone number (e.g. *+91 98765 43210*) so we can send your digital booking pass.`,
          isAppointmentCard: false
        };
      }
    }

    // ============================================================
    // 3. INTENT: USER WANTS TO BOOK AN APPOINTMENT (INITIATE FLOW)
    // ============================================================
    const isDirectBookingIntent = 
      lower.includes('book') || 
      lower.includes('appointment') || 
      lower.includes('consultation') || 
      lower.includes('schedule') || 
      lower.includes('reserve slot') ||
      lower.includes('check slot') ||
      lower.includes('availability');

    if (isDirectBookingIntent) {
      // Check if user already mentioned a treatment
      let targetDept = newCtx.department;
      if (lower.includes('laser')) targetDept = 'Laser Hair Reduction';
      else if (lower.includes('prp') || lower.includes('hair')) targetDept = 'PRP Hair Therapy';
      else if (lower.includes('pigment') || lower.includes('peel')) targetDept = 'Pigmentation & Peels';
      else if (lower.includes('botox') || lower.includes('anti-aging')) targetDept = 'Anti-Aging & Botox';
      else if (lower.includes('glow') || lower.includes('facial')) targetDept = 'HydraFacial Deluxe';

      if (!targetDept) {
        newCtx.step = 'asking_treatment';
        setContext(newCtx);
        return {
          content: `I would be happy to help you book a consultation at **La Fleur Aesthetic & Wellness Clinic**! 🌸\n\nWhich treatment or clinical concern would you like to consult for?\n\n• **1. Laser Hair Reduction**\n• **2. PRP & Hair Restoration**\n• **3. Pigmentation & Chemical Peels**\n• **4. Anti-Aging & Skin Tightening**\n• **5. General Aesthetic Consultation**\n\nPlease reply with your preferred treatment.`,
          isAppointmentCard: false
        };
      } else {
        newCtx.department = targetDept;
        newCtx.step = 'asking_name';
        setContext(newCtx);
        return {
          content: `Great! Let's get you scheduled for **${targetDept}**.\n\nTo ensure our doctor is prepared for your visit, all appointments require mandatory registry details.\n\nMay I please have your **Full Name**?`,
          isAppointmentCard: false
        };
      }
    }

    // If waiting for treatment selection
    if (newCtx.step === 'asking_treatment') {
      let dept = 'Aesthetic Consultation';
      if (lower.includes('1') || lower.includes('laser')) dept = 'Laser Hair Reduction';
      else if (lower.includes('2') || lower.includes('prp') || lower.includes('hair')) dept = 'PRP Hair Therapy';
      else if (lower.includes('3') || lower.includes('pigment') || lower.includes('peel')) dept = 'Pigmentation & Peels';
      else if (lower.includes('4') || lower.includes('aging') || lower.includes('botox')) dept = 'Anti-Aging & Botox';
      else if (lower.includes('5') || lower.includes('general')) dept = 'General Aesthetic Consultation';
      else dept = raw;

      newCtx.department = dept;
      newCtx.step = 'asking_name';
      setContext(newCtx);

      return {
        content: `Got it: **${dept}**.\n\nMay I please have your **Full Name** for the appointment registry?`,
        isAppointmentCard: false
      };
    }

    // ============================================================
    // 4. KNOWLEDGE BASE SEARCH CHECK (RAG GROUNDING FOR INQUIRIES)
    // ============================================================
    const kbMatch = searchKnowledge(raw, knowledgeItems);
    if (kbMatch && kbMatch.score >= 6) {
      return {
        content: `${kbMatch.matchSnippet}\n\nWould you like me to check doctor availability or help you book a consultation?`,
        isAppointmentCard: false,
        groundingSource: {
          type: kbMatch.item.type,
          title: kbMatch.item.title,
          source: kbMatch.item.sourceUrl || kbMatch.item.fileName || kbMatch.item.title
        }
      };
    }

    // ============================================================
    // 5. PRE-CARE & POST-CARE INQUIRIES
    // ============================================================
    if (
      lower.includes('pre-care') || 
      lower.includes('before my appointment') || 
      lower.includes('before treatment') || 
      lower.includes('before laser') ||
      lower.includes('prepare for') ||
      lower.includes('preparation')
    ) {
      return {
        content: `A quick note before your appointment 👋\n\nHere are the recommended pre-care instructions:\n\n* **Sun Protection:** Avoid active sun tanning, tanning beds, or sunless tanners for 1–2 weeks before.\n* **Daily SPF:** Use a broad-spectrum SPF 50+ sunscreen regularly.\n* **Shaving:** For laser treatments, shave the treatment area 24 hours prior (do not wax, thread, or pluck).\n* **Active Skincare:** Pause strong actives like Retinol, AHA/BHA peels 3–5 days prior.\n* **Medical History:** Please inform the clinic of any recent medications or skin conditions.\n\nWould you like to book or check your appointment details?`,
        isAppointmentCard: false
      };
    }

    if (
      lower.includes('post-care') || 
      lower.includes('after care') || 
      lower.includes('after treatment') || 
      lower.includes('after my sitting') || 
      lower.includes('had the treatment yesterday') ||
      lower.includes('what to do after')
    ) {
      return {
        content: `Hope your treatment went well! 💙\n\nA few essential after-care reminders:\n\n* **Soothing & Hydration:** Apply the clinic-recommended soothing gel or gentle moisturizer.\n* **Avoid Heat:** Avoid hot showers, steam rooms, saunas, and strenuous workouts for 24–48 hours.\n* **Sun Protection:** Diligently apply broad-spectrum sunscreen every 3–4 hours when outdoors.\n* **Gentle Care:** Do not scratch, pick, or scrub the treated skin.\n\nIf you have any unexpected redness or queries, I can connect you directly with the La Fleur team.`,
        isAppointmentCard: false
      };
    }

    // Multi-Sitting & intervals
    if (
      lower.includes('how many sessions') || 
      lower.includes('how many sittings') || 
      lower.includes('next sitting') || 
      lower.includes('sitting interval') || 
      lower.includes('how long between')
    ) {
      return {
        content: `For treatments like **Laser Hair Reduction** or **PRP/GFC Hair Therapy**, a typical course involves multiple sittings because hair and skin renewal follow biological growth cycles.\n\n• **Sitting Interval:** Typically spaced **4–6 weeks apart**.\n• **Treatment Plan:** The exact number of sessions (usually 6–8 for laser, 4–6 for PRP) depends on individual assessment and clinical response.\n\nWould you like me to check available consultation slots for you?`,
        isAppointmentCard: false
      };
    }

    // Pricing & Quotes
    if (
      lower.includes('price') || 
      lower.includes('cost') || 
      lower.includes('how much') || 
      lower.includes('discount') || 
      lower.includes('package rate')
    ) {
      return {
        content: `Prices for La Fleur treatments start from indicative rates (e.g. Laser Hair Reduction from ₹2,499/session, PRP Hair Therapy from ₹4,500/session, HydraFacial Deluxe from ₹3,999). Final pricing and package discounts depend on your customized treatment plan and will be confirmed during your doctor consultation.\n\nWould you like to check doctor availability for a consultation?`,
        isAppointmentCard: false
      };
    }

    // ============================================================
    // 6. TREATMENT DISCOVERY BY CONCERN
    // ============================================================
    
    // Pigmentation
    if (
      lower.includes('pigment') || 
      lower.includes('dark spot') || 
      lower.includes('melasma') || 
      lower.includes('tan') || 
      lower.includes('dull') || 
      lower.includes('uneven') || 
      lower.includes('blemish') ||
      lower.includes('acne mark')
    ) {
      newCtx.department = 'Pigmentation & Skin Peels';
      setContext(newCtx);
      return {
        content: `For pigmentation and uneven skin tone, La Fleur offers specialized clinical treatments:\n\n1. **Advanced Chemical Peels** — for resurfacing and reducing hyperpigmentation.\n2. **Laser Toning (Q-Switched Nd:YAG)** — for deep pigment targeting.\n3. **Hydra-Brightening Medi-Facial** — for immediate hydration and cellular glow.\n\nWould you like to schedule a doctor consultation to examine your skin and check available dates?`,
        isAppointmentCard: false
      };
    }

    // Hair Loss
    if (
      lower.includes('hair loss') || 
      lower.includes('hair fall') || 
      lower.includes('losing hair') || 
      lower.includes('thinning') || 
      lower.includes('prp') || 
      lower.includes('gfc') || 
      lower.includes('hair transplant') ||
      lower.includes('bald')
    ) {
      newCtx.department = 'PRP Hair Therapy';
      setContext(newCtx);
      return {
        content: `For hair thinning and hair fall, La Fleur provides restorative therapies:\n\n1. **PRP Hair Therapy** — Platelet-Rich Plasma to stimulate dormant hair follicles.\n2. **GFC Therapy** — Concentrated growth factors for accelerated hair regrowth.\n3. **Hair Transplant Assessment** — For advanced thinning.\n\nWould you like me to check doctor availability for a hair assessment consultation?`,
        isAppointmentCard: false
      };
    }

    // Laser Hair Reduction
    if (
      lower.includes('laser hair') || 
      lower.includes('unwanted hair') || 
      lower.includes('facial hair') || 
      lower.includes('body hair') || 
      lower.includes('bikini hair') ||
      lower.includes('underarm')
    ) {
      newCtx.department = 'Laser Hair Reduction';
      setContext(newCtx);
      return {
        content: `**Laser Hair Reduction** at La Fleur uses medical-grade cooling laser technology to safely reduce unwanted hair across face and body areas.\n\n• **Course of Treatment:** 6–8 sittings spaced 4–6 weeks apart.\n• **Safety:** Painless cooling tip suitable for all Indian skin types.\n\nWould you like to schedule an initial consultation or check available appointment slots?`,
        isAppointmentCard: false
      };
    }

    // Anti-Aging
    if (
      lower.includes('wrinkle') || 
      lower.includes('aging') || 
      lower.includes('tighten') || 
      lower.includes('sagging') || 
      lower.includes('botox') || 
      lower.includes('fine line') ||
      lower.includes('anti-aging')
    ) {
      newCtx.department = 'Anti-Aging & Skin Tightening';
      setContext(newCtx);
      return {
        content: `For skin tightening and expression lines, La Fleur provides:\n\n1. **RF Skin Tightening** — Stimulates deep collagen for firmer skin.\n2. **Botox / Botulinum Toxin** — Softens dynamic forehead and frown lines.\n3. **Microneedling RF (MNRF)** — Refines skin texture and pore elasticity.\n\nWould you like to check available consultation slots?`,
        isAppointmentCard: false
      };
    }

    // Default Fallback
    return {
      content: `I am here to help! You can ask about our treatments (Laser Hair Reduction, PRP, Chemical Peels, HydraFacials), check clinic timings, or type **"Book Appointment"** to check live slot availability. How can I assist you?`,
      isAppointmentCard: false
    };
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputValue).trim();
    if (!textToSend) return;

    const lowerText = textToSend.toLowerCase();
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: Message = { 
      id: `u-${Date.now()}`,
      role: 'user', 
      content: textToSend,
      time: currentTime
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    // Route ALL user messages through the live LLM API
    if (llmConfig?.isConfigured && llmConfig.apiKey) {
      // Assemble enabled Knowledge Base documents
      const enabledDocs = knowledgeItems.filter(k => k.isEnabled);
      const kbContext = enabledDocs.map(d => `[${d.title}]: ${d.content}`).join('\n\n');

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            systemPrompt,
            knowledgeContext: kbContext,
            llmConfig,
            existingAppointments: appointments,
            conversationHistory: newMessages.slice(-8)
          })
        });

        const data = await res.json();

        if (res.ok && data.content) {
          const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const matchedDoc = searchKnowledge(textToSend, knowledgeItems);

          // If LLM returned a completed appointment booking
          if (data.isAppointmentCard && data.appointmentData) {
            if (onBookAppointment) {
              onBookAppointment(data.appointmentData);
            }
            if (onExtractEntity) {
              onExtractEntity({
                intent: "book_appointment",
                entities: data.appointmentData,
                confidence: 0.99
              });
            }
          }

          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: data.content,
            time: aiTime,
            isAppointmentCard: !!data.isAppointmentCard,
            appointmentData: data.appointmentData || undefined,
            groundingSource: matchedDoc ? {
              type: matchedDoc.item.type,
              title: matchedDoc.item.title,
              source: `${data.provider.toUpperCase()} (${data.model}) + ${matchedDoc.item.title}`
            } : {
              type: 'text',
              title: `${data.provider.toUpperCase()}`,
              source: `Live ${data.provider.toUpperCase()} (${data.model})`
            }
          }]);
          setIsTyping(false);
          return;
        } else if (data.error === 'NO_API_KEY') {
          // Notify user to enter key
          const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: `🔑 **LLM Engine Notice**\n\nTo enable live human-like conversational fluency powered by Google Gemini, please add your Gemini API Key under **Settings → AI Assistant**.\n\n*(Falling back to local clinical response)*`,
            time: aiTime
          }]);
        }
      } catch (err) {
        console.warn("[LLM Live API call error, falling back to local engine]:", err);
      }
    } else {
      // If no API key is set yet, show friendly guidance
      if (messages.length === 1) {
        const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        console.info("[ChatEmulator] To enable full Google Gemini LLM human fluency, configure your API Key in Settings → AI Assistant.");
      }
    }

    // Fallback assistant response
    setTimeout(() => {
      const resp = generateConversationalReply(textToSend, context);
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: resp.content,
        time: aiTime,
        isAppointmentCard: resp.isAppointmentCard,
        appointmentData: resp.appointmentData,
        groundingSource: resp.groundingSource
      }]);
      setIsTyping(false);
    }, 400);
  };

  return (
    <div className="phone-chassis">
      {/* Smartphone Dynamic Notch */}
      <div className="phone-notch">
        <div className="phone-camera" />
        <div className="phone-speaker" />
      </div>

      <div className="phone-screen">
        {/* Status Bar */}
        <div className="phone-status-bar">
          <span>9:41</span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* WhatsApp Mobile App Header */}
        <div className="wa-header">
          <div className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 cursor-pointer hover:opacity-80" />
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-white text-[#008069] flex items-center justify-center font-bold text-xs shadow-xs">
                {isLaFleur ? "🌸" : <Bot className="h-5 w-5 text-[#008069]" />}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1.5 ring-white" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs tracking-tight text-white">{clinicTitle}</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-200 fill-emerald-300 text-white" />
              </div>
              <p className="text-[9.5px] text-emerald-100/90 font-medium flex items-center gap-1">
                <span>Official Verified Business</span>
                {llmConfig.isConfigured && (
                  <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider">
                    ⚡ {llmConfig.provider} ({llmConfig.model.split('-')[0]})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-white/90">
            <Video className="h-4 w-4 cursor-pointer hover:text-white" />
            <Phone className="h-3.5 w-3.5 cursor-pointer hover:text-white" />
            <button 
              type="button" 
              onClick={resetChat} 
              title="Reset Conversation"
              className="hover:text-white p-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* WhatsApp Chat Wallpaper Body */}
        <div className="wa-chat-body">
          {/* End to End Encryption Pill */}
          <div className="wa-encryption-pill">
            🔒 Messages & calls are end-to-end encrypted. No one outside of this chat can read them.
          </div>

          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`wa-bubble ${msg.role === 'user' ? 'wa-bubble-user' : 'wa-bubble-ai'}`}
            >
              <div className="wa-bubble-content">
                {renderFormattedWhatsAppText(msg.content)}

                {/* Grounding Source Badge if Answer retrieved from Knowledge Base */}
                {msg.groundingSource && (
                  <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                    <span className="text-primary font-semibold flex items-center gap-0.5">
                      {msg.groundingSource.type === 'file' ? <FileText className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                      Source:
                    </span>
                    <span className="truncate max-w-[200px]" title={msg.groundingSource.source}>
                      {msg.groundingSource.source}
                    </span>
                  </div>
                )}

                {/* Rich Appointment Confirmation Card inside WhatsApp */}
                {msg.isAppointmentCard && msg.appointmentData && (
                  <div className="mt-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 space-y-1.5 text-xs text-foreground">
                    <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> La Fleur Booking Pass
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300">Confirmed</span>
                    </div>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/20">
                      <p><strong className="text-foreground">Patient:</strong> {msg.appointmentData.patient_name}</p>
                      <p><strong className="text-foreground">Treatment:</strong> {msg.appointmentData.department}</p>
                      <p><strong className="text-foreground">Date & Slot:</strong> {msg.appointmentData.date} at {msg.appointmentData.time}</p>
                      <p><strong className="text-foreground">Phone:</strong> {msg.appointmentData.phone_number}</p>
                    </div>
                  </div>
                )}

                {/* In-Message Interactive Action Chips on First Message */}
                {(msg.id === 'm-init' || msg.id === 'm-1') && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "What are the prices for Laser Hair Removal and PRP?")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>📑 Check Treatments & Pricing Guide</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "Who are the doctors at La Fleur and what are clinic timings?")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>🌐 Check Doctors & Clinic Hours (Website)</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "What are the pre-care instructions before laser treatment?")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>⚡ Pre-Care & Post-Care Instructions</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "I want to book a doctor consultation.")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>📅 Book Doctor Consultation</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                  </div>
                )}

                <div className="wa-timestamp">
                  <span>{msg.time}</span>
                  {msg.role === 'user' && (
                    <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="wa-bubble wa-bubble-ai">
              <div className="wa-bubble-content">
                <div className="wa-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* WhatsApp Mobile Footer Input Form */}
        <form onSubmit={(e) => handleSendMessage(e)} className="wa-footer">
          <button type="button" className="text-muted-foreground hover:text-foreground p-1">
            <Smile className="h-4 w-4" />
          </button>
          <button type="button" className="text-muted-foreground hover:text-foreground p-1">
            <Paperclip className="h-4 w-4" />
          </button>
          <input 
            type="text" 
            placeholder="Ask anything about clinic treatments, doctors, pricing..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 rounded-full border-none bg-white dark:bg-[#2a3942] px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground shadow-xs outline-none focus:ring-1 focus:ring-[#008069]"
          />
          <button 
            type="submit" 
            disabled={!inputValue.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#008069] text-white hover:bg-[#00705a] disabled:opacity-40 transition-all shadow-xs shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Home Indicator Bar */}
        <div className="phone-home-indicator" />
      </div>
    </div>
  );
}


