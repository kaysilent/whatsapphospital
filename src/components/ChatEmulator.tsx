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
  Stethoscope, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

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
};

interface BookingContext {
  patient_name?: string;
  phone_number?: string;
  department?: string;
  date?: string;
  time?: string;
}

interface ChatEmulatorProps {
  onBookAppointment?: (appt: { patient_name: string; phone_number: string; date: string; time: string; department: string }) => void;
  onRescheduleAppointment?: (patient_name: string, new_date: string, new_time: string) => void;
  onExtractEntity?: (data: any) => void;
  systemPrompt?: string;
}

export const initialSuggestions = [
  { label: "📅 Book Dr. Gupta (Cardiology)", text: "Book an appointment for Arbaz Khan tomorrow 10:30 AM in Cardiology" },
  { label: "👶 Book Pediatrics Checkup", text: "Book appointment for baby Priya (+91 98123 45678) tomorrow 11:15 AM in Pediatrics" },
  { label: "🕒 Check OPD Timings", text: "What are the hospital OPD consultation timings and emergency hours?" },
  { label: "🚨 Emergency Triage Alert", text: "Emergency: Patient experiencing acute chest pain radiating to left arm" },
];

export default function ChatEmulator({ 
  onBookAppointment, 
  onRescheduleAppointment, 
  onExtractEntity,
  systemPrompt 
}: ChatEmulatorProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'm-1',
      role: 'ai', 
      content: "👋 Hello! Welcome to **Aivry Hospital** WhatsApp Reception.\n\nI am your 24/7 AI Health Assistant. How may I assist you today? You can book an appointment, check doctor timings, or ask any medical query.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState<BookingContext>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const resetChat = () => {
    setContext({});
    setMessages([
      { 
        id: `m-${Date.now()}`,
        role: 'ai', 
        content: "👋 Hello! Welcome to **Aivry Hospital** WhatsApp Reception.\n\nI am your 24/7 AI Health Assistant. How may I assist you today? You can book an appointment, check doctor timings, or ask any medical query.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Conversational Natural AI Dialog Engine (Multi-Turn Human Receptionist)
  const generateConversationalReply = (text: string, currentCtx: BookingContext) => {
    const raw = text.trim();
    const lower = raw.toLowerCase();
    const newCtx = { ...currentCtx };

    // 1. Detect Emergency / Critical Symptoms
    if (
      lower.includes('emergency') || 
      lower.includes('chest pain') || 
      lower.includes('heart attack') || 
      lower.includes('breathless') || 
      lower.includes('bleeding') || 
      lower.includes('unconscious') ||
      lower.includes('severe accident')
    ) {
      if (onExtractEntity) {
        onExtractEntity({
          intent: "emergency_triage",
          entities: { symptom: raw, urgency: "CRITICAL_IMMEDIATE" },
          triage_level: "CRITICAL_EMERGENCY",
          confidence: 0.99
        });
      }
      return {
        content: `🚨 **EMERGENCY CASUALTY ALERT ACTIVATED**\n\nOur on-duty ER Medical Officer (Dr. Rajesh Gupta) and trauma team have been alerted.\n\n📍 **Casualty Desk Hotline:** +91 99999 00108\n🚑 **Ambulance Dispatch:** Available 24/7 at Gate 1\n\nPlease proceed directly to the Emergency Room (ER) immediately. A trauma nurse has been notified.`,
        isAppointmentCard: false
      };
    }

    // 2. Detect OPD / Timings Queries
    if (lower.includes('timing') || lower.includes('opd') || lower.includes('hours') || lower.includes('when open') || lower.includes('schedule time')) {
      if (onExtractEntity) {
        onExtractEntity({
          intent: "check_opd_hours",
          entities: { department: "All Departments" },
          triage_level: "NORMAL",
          confidence: 0.97
        });
      }
      return {
        content: `🏥 **Aivry Hospital OPD Consultation Hours:**\n\n• **Morning OPD:** 09:00 AM – 01:00 PM\n• **Evening OPD:** 04:00 PM – 08:00 PM\n• **Emergency & Casualty:** Open 24/7 (All 365 Days)\n\nWould you like me to book a slot with one of our specialists today or tomorrow?`,
        isAppointmentCard: false
      };
    }

    // 3. Extract Phone Number if present
    const phoneMatch = raw.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}/);
    if (phoneMatch) {
      newCtx.phone_number = phoneMatch[0];
    }

    // 4. Extract Department if present
    if (lower.includes('cardio') || lower.includes('heart')) {
      newCtx.department = 'Cardiology';
    } else if (lower.includes('pediatric') || lower.includes('child') || lower.includes('baby')) {
      newCtx.department = 'Pediatrics';
    } else if (lower.includes('ortho') || lower.includes('bone') || lower.includes('joint') || lower.includes('fracture')) {
      newCtx.department = 'Orthopedics';
    } else if (lower.includes('neuro') || lower.includes('brain') || lower.includes('headache')) {
      newCtx.department = 'Neurology';
    } else if (lower.includes('derma') || lower.includes('skin') || lower.includes('rash')) {
      newCtx.department = 'Dermatology';
    } else if (lower.includes('ent') || lower.includes('ear') || lower.includes('throat')) {
      newCtx.department = 'ENT';
    } else if (lower.includes('general') || lower.includes('fever') || lower.includes('cough') || lower.includes('cold') || lower.includes('physician')) {
      newCtx.department = 'General Medicine';
    }

    // 5. Extract Date
    if (lower.includes('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      newCtx.date = d.toISOString().split('T')[0];
    } else if (lower.includes('today')) {
      newCtx.date = new Date().toISOString().split('T')[0];
    } else {
      const dateMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        newCtx.date = dateMatch[0];
      }
    }

    // 6. Extract Time
    const timeMatch = raw.match(/(?:1[0-2]|0?[1-9]):[0-5][0-9]\s*(?:am|pm|AM|PM)?|\d{1,2}\s*(?:am|pm|AM|PM)/i);
    if (timeMatch) {
      newCtx.time = timeMatch[0].toUpperCase();
    }

    // 7. Extract Name
    const nameMatch = raw.match(/(?:my name is|i am|patient is|name is|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (nameMatch) {
      newCtx.patient_name = nameMatch[1];
    } else if (!newCtx.patient_name && !lower.includes('book') && !lower.includes('appointment') && !lower.includes('hello') && !lower.includes('hi') && raw.split(/\s+/).length <= 3 && !phoneMatch && !timeMatch) {
      const cleanName = raw.replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanName.length >= 2 && !['yes', 'no', 'ok', 'okay', 'sure', 'thanks', 'thank you'].includes(cleanName.toLowerCase())) {
        newCtx.patient_name = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      }
    }

    // Save updated context
    setContext(newCtx);

    // 8. Auto-Book if we have a Name + (Department OR Date/Time OR intent to book)
    const hasBookingIntent = lower.includes('book') || lower.includes('appointment') || newCtx.date || newCtx.time || (newCtx.patient_name && newCtx.department);

    if (hasBookingIntent) {
      const confirmedName = newCtx.patient_name || (newCtx.phone_number ? `Patient (${newCtx.phone_number.slice(-4)})` : "Arbaz Khan");
      const confirmedDept = newCtx.department || "Cardiology";
      const confirmedDate = newCtx.date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const confirmedTime = newCtx.time || "10:30 AM";
      const confirmedPhone = newCtx.phone_number || "+91 98765 43210";
      const doctorName = confirmedDept === 'Pediatrics' ? 'Dr. Shalini Roy' : confirmedDept === 'Orthopedics' ? 'Dr. Vivek Menon' : 'Dr. Rajesh Gupta';

      const apptData = {
        patient_name: confirmedName,
        phone_number: confirmedPhone,
        date: confirmedDate,
        time: confirmedTime,
        department: confirmedDept
      };

      // IMMEDIATELY dispatch booking event & trigger callback
      if (onBookAppointment) {
        onBookAppointment(apptData);
      }

      if (onExtractEntity) {
        onExtractEntity({
          intent: "book_appointment",
          entities: apptData,
          triage_level: "NORMAL",
          confidence: 0.99
        });
      }

      // Reset context after confirmed booking
      setContext({});

      return {
        content: `✅ **Appointment Successfully Booked!**\n\nThank you, **${confirmedName}**. Your consultation has been confirmed with **${doctorName}** (${confirmedDept}) and stored in the clinic dashboard.\n\n📅 **Date:** ${confirmedDate}\n🕒 **Time Slot:** ${confirmedTime}\n📍 **Room:** OPD Block A, Room 204\n📱 **WhatsApp Sync:** ${confirmedPhone}`,
        isAppointmentCard: true,
        appointmentData: apptData
      };
    }

    // If user provided Name only (e.g. "arbaz"):
    if (newCtx.patient_name && !newCtx.department) {
      return {
        content: `Nice to meet you, **${newCtx.patient_name}**! 👋\n\nWhich department would you like to book with?\n• **Cardiology** (Heart / Chest)\n• **Pediatrics** (Child Care)\n• **Orthopedics** (Bones & Joints)\n• **General Medicine** (Checkup)\n\nReply with a specialty or time (e.g. *Cardiology tomorrow 10:30 AM*) to confirm your slot!`,
        isAppointmentCard: false
      };
    }

    // Default friendly greeting
    return {
      content: `Hello! 👋 How can I help you today at **Aivry Hospital**?\n\n• To book an appointment: type **"Book Dr. Gupta tomorrow 10:30 AM"** or your name.\n• To check timings: type **OPD hours**\n• For emergency: type **Emergency casualty**`,
      isAppointmentCard: false
    };
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputValue).trim();
    if (!textToSend) return;

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

    // Simulate realistic typing delay (400ms)
    setTimeout(() => {
      const resp = generateConversationalReply(textToSend, context);
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: resp.content,
        time: aiTime,
        isAppointmentCard: resp.isAppointmentCard,
        appointmentData: resp.appointmentData
      }]);
      setIsTyping(false);
    }, 450);
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
                <Bot className="h-5 w-5 text-[#008069]" />
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1.5 ring-white" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs tracking-tight text-white">Aivry Hospital AI</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-200 fill-emerald-300 text-white" />
              </div>
              <p className="text-[9.5px] text-emerald-100/90 font-medium">Official Business Account</p>
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
                <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>

                {/* Rich Appointment Confirmation Card inside WhatsApp */}
                {msg.isAppointmentCard && msg.appointmentData && (
                  <div className="mt-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 space-y-1.5 text-xs text-foreground">
                    <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Booking Confirmation
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300">Confirmed</span>
                    </div>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/20">
                      <p><strong className="text-foreground">Patient:</strong> {msg.appointmentData.patient_name}</p>
                      <p><strong className="text-foreground">Specialty:</strong> {msg.appointmentData.department}</p>
                      <p><strong className="text-foreground">Date & Slot:</strong> {msg.appointmentData.date} at {msg.appointmentData.time}</p>
                      <p><strong className="text-foreground">Phone:</strong> {msg.appointmentData.phone_number}</p>
                    </div>
                  </div>
                )}

                {/* In-Message Interactive Action Chips */}
                {msg.id === 'm-1' && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "Book an appointment for Arbaz Khan tomorrow 10:30 AM in Cardiology")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>📅 Book Doctor Appointment</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "What are the hospital OPD consultation timings and casualty hours?")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>🕒 Check OPD Consultation Timings</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "Emergency: Severe chest pain and breathlessness")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>🚨 Emergency Casualty Assistance</span>
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
            placeholder="Type a message or symptom..." 
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
