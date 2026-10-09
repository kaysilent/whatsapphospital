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
  BookOpen
} from 'lucide-react';
import { useDemoState, DEFAULT_LA_FLEUR_SYSTEM_PROMPT, KnowledgeItem, defaultLLMConfig, Appointment } from '@/hooks/use-demo-state';
import { getRuntimeHospitalProfile } from '@/lib/hospital/treatments';
import { detectEmergencyKeywords } from '@/lib/whatsapp/emergency-relay';
import { emergencyAudio } from '@/lib/audio/emergency-audio';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  time: string;
  isAppointmentCard?: boolean;
  appointmentData?: Partial<Appointment> & {
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

// WhatsApp rich text parser that handles bold, italic, bullets cleanly
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

        const tokens: React.ReactNode[] = [];
        let keyCounter = 0;

        const regex = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*[^*\s]|[^*])\*|_([^_]+)_|~([^~]+)~|`([^`]+)`)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(trimmed)) !== null) {
          if (match.index > lastIndex) {
            tokens.push(trimmed.substring(lastIndex, match.index).replace(/\*{2,}/g, ''));
          }

          if (match[2]) {
            tokens.push(<strong key={keyCounter++} className="font-semibold text-foreground">{match[2]}</strong>);
          } else if (match[3]) {
            tokens.push(<strong key={keyCounter++} className="font-semibold text-foreground">{match[3]}</strong>);
          } else if (match[4]) {
            tokens.push(<em key={keyCounter++} className="italic">{match[4]}</em>);
          } else if (match[5]) {
            tokens.push(<del key={keyCounter++} className="line-through opacity-75">{match[5]}</del>);
          } else if (match[6]) {
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
  
  const clinicTitle = isLaFleur 
    ? "La Fleur Aesthetic Clinic" 
    : systemPrompt.includes("Aivry") 
    ? "Aivry Hospital" 
    : "AI WhatsApp Assistant";

  const [mounted, setMounted] = useState(false);

  const getGreetingMessage = (): Message => {
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      id: 'm-init',
      role: 'ai',
      content: isLaFleur
        ? `Hello! Welcome to **La Fleur Aesthetic & Wellness Clinic**.\n\nI am your AI clinical assistant. How can I help you today? We are tied up with some of the leading plastic surgeons in the city.\n\nWebsite: https://lafleurwellness.com\nInstagram: https://instagram.com/lafleur.clinic\n\nYou can ask about our clinical treatments, check available consultation slots with Dr. Mrinalini, or book an appointment.`
        : `Hello! Welcome to **${clinicTitle}** WhatsApp Reception.\n\nI am your AI clinical assistant. How may I assist you today?`,
      time: currentTime
    };
  };

  const [messages, setMessages] = useState<Message[]>([getGreetingMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPaidToken, setIsPaidToken] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    setIsPaidToken(false);
    setMessages([getGreetingMessage()]);
  };

  // 100% LLM-driven message processing
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputValue).trim();
    if (!textToSend) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const userMessage: Message = { 
      id: `u-${Date.now()}`,
      role: 'user', 
      content: textToSend,
      time: currentTime
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');

    // Check for clinical emergency triggers and fire continuous audio alarm
    const detection = detectEmergencyKeywords(textToSend);
    if (detection.isEmergency) {
      emergencyAudio.startAlarm(
        `chat-emulator-${Date.now()}`,
        `🚨 Inbound WhatsApp Emergency: Patient reported ${detection.reason}`
      );
    }

    setIsTyping(true);

    // Assemble Knowledge Base context
    const enabledDocs = knowledgeItems.filter(k => k.isEnabled);
    const kbContext = enabledDocs.map(d => `[${d.title}]: ${d.content}`).join('\n\n');

    try {
      const activeHospitalProfile = getRuntimeHospitalProfile();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          systemPrompt,
          knowledgeContext: kbContext,
          llmConfig,
          existingAppointments: appointments,
          hospitalProfile: activeHospitalProfile,
          conversationHistory: messages.slice(-10)
        })
      });

      const data = await res.json();
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      if (res.ok && data.content) {
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
        }]);
      } else {
        const errMsg = data.message || data.error || 'Failed to generate response from LLM.';
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: `⚠️ **AI Engine Notice**\n\n${errMsg}\n\nPlease check your Google Gemini API key under **Settings → AI Assistant**.`,
          time: aiTime
        }]);
      }
    } catch (err: any) {
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: `⚠️ Could not reach the AI service (${err.message || 'Network error'}). Please verify your connection and API Key in Settings → AI Assistant.`,
        time: aiTime
      }]);
    } finally {
      setIsTyping(false);
    }
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
                <span>WhatsApp AI Receptionist</span>
                {mounted && llmConfig.isConfigured && (
                  <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider">
                    ⚡ {llmConfig.provider}
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
              className="hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="wa-body">
          {/* Encryption Notice */}
          <div className="text-center my-1.5">
            <span className="inline-flex items-center gap-1 text-[9.5px] bg-[#ffeecd] dark:bg-amber-950/40 text-[#54656f] dark:text-amber-200/80 px-2.5 py-1 rounded-md shadow-2xs border border-amber-200/40 dark:border-amber-900/30">
              🔒 End-to-end encrypted with La Fleur Clinic AI
            </span>
          </div>

          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} my-1`}>
                <div className={`wa-bubble ${isUser ? 'wa-bubble-user' : 'wa-bubble-ai'} ${m.isAppointmentCard ? 'ring-2 ring-emerald-500/40' : ''}`}>
                  {/* Message Text with WhatsApp formatting */}
                  <div className="text-[12.5px] leading-relaxed">
                    {renderFormattedWhatsAppText(m.content)}
                  </div>

                  {/* Visual WhatsApp Appointment & Journey Card with Razorpay Token */}
                  {m.isAppointmentCard && m.appointmentData && (
                    <div className="mt-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 p-2.5 text-xs text-foreground space-y-2">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[11.5px]">
                          <Calendar className="h-3.5 w-3.5" /> Confirmed Booking Pass
                        </span>
                        <div className="flex items-center gap-1">
                          {m.appointmentData.booking_id && (
                            <span className="rounded bg-emerald-800 text-white px-1.5 py-0.5 text-[9px] font-mono font-bold">
                              {m.appointmentData.booking_id}
                            </span>
                          )}
                          <span className="rounded bg-emerald-600 text-white px-1.5 py-0.5 text-[9px] font-bold">
                            SYNCED
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-[11px]">
                        {m.appointmentData.booking_id && (
                          <div className="flex items-center justify-between bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            <span className="text-muted-foreground font-medium">Booking ID:</span>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{m.appointmentData.booking_id}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Patient:</span>
                          <span className="font-semibold text-foreground">{m.appointmentData.patient_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Slot:</span>
                          <span className="font-medium text-foreground">{m.appointmentData.date} at {m.appointmentData.time}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Consulting:</span>
                          <span className="font-medium text-foreground">Dr. Mrinalini</span>
                        </div>
                        {m.appointmentData.total_sittings && m.appointmentData.total_sittings > 1 ? (
                          <div className="flex items-center justify-between pt-1 border-t border-emerald-500/15">
                            <span className="text-muted-foreground">Course Plan:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Sitting {m.appointmentData.current_sitting || 1} of {m.appointmentData.total_sittings}
                              {m.appointmentData.sitting_interval && ` (${m.appointmentData.sitting_interval} gap)`}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Razorpay Token Advance & Clinic Payment Breakdown */}
                      <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                        {/* Dynamic WhatsApp Payment Link Box */}
                        {(() => {
                          const userPhone = m.appointmentData?.phone_number && !m.appointmentData.phone_number.includes('9876543210')
                            ? m.appointmentData.phone_number
                            : '';
                          const patientDisplayName = m.appointmentData?.patient_name && m.appointmentData.patient_name !== 'Patient'
                            ? m.appointmentData.patient_name
                            : 'Valued Patient';
                          const payLink = typeof window !== 'undefined'
                            ? `${window.location.origin}/pay/pay_${m.id}?name=${encodeURIComponent(patientDisplayName)}&phone=${encodeURIComponent(userPhone)}&treatment=${encodeURIComponent(m.appointmentData?.department || 'Clinical Consultation')}&amount=100&date=${encodeURIComponent(m.appointmentData?.date || 'Today')}&time=${encodeURIComponent(m.appointmentData?.time || '11:30 AM')}&doctor=Dr.+Mrinalini`
                            : `/pay/pay_${m.id}`;

                          return (
                            <>
                              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10.5px] space-y-1">
                                <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Payment Gateway Link Generated
                                  </span>
                                  <span className="bg-emerald-600 text-white px-1.5 py-0.2 rounded text-[9.5px]">₹100 Booking Fee</span>
                                </div>
                                <a
                                  href={payLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-600 dark:text-blue-400 underline font-mono truncate block"
                                >
                                  {payLink}
                                </a>
                              </div>

                              <div className="space-y-1 text-[10.5px]">
                                <div className="flex items-center justify-between text-muted-foreground">
                                  <span>• Booking Fee (Razorpay/UPI):</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹100</span>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                  <span>• Appointment Status:</span>
                                  <span className="font-semibold text-foreground">Confirmed upon payment</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setIsPaidToken(true);
                                    const txnId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                                    const recNo = `REC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

                                    // Verify on backend
                                    try {
                                      await fetch('/api/payments/verify', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          paymentId: `pay_${m.id}`,
                                          gatewayPaymentId: txnId,
                                          patientName: patientDisplayName,
                                          phoneNumber: userPhone,
                                          treatment: m.appointmentData?.department || 'Clinical Consultation',
                                          amount: 100,
                                          date: m.appointmentData?.date || 'Scheduled Date',
                                          time: m.appointmentData?.time || '11:30 AM',
                                          doctor: 'Dr. Mrinalini',
                                        }),
                                      });
                                    } catch {}

                                    // Trigger AI Thank-You Receipt Message
                                    setMessages(prev => [...prev, {
                                      id: `rzp-${Date.now()}`,
                                      role: 'ai',
                                      content: `🎉 *Payment Received & Appointment Confirmed!*

Dear ${m.appointmentData?.patient_name || 'Valued Patient'}, your booking payment of ₹100 for ${m.appointmentData?.department || 'Consultation'} with Dr. Mrinalini has been successfully received via Razorpay (Txn ID: ${txnId}).

📅 Date: ${m.appointmentData?.date || 'Confirmed Date'}
⏰ Time: ${m.appointmentData?.time || '11:30 AM'}
👨‍⚕️ Consulting: Dr. Mrinalini
🧾 Receipt No: ${recNo}
💳 Payment Mode: Razorpay / UPI Instant

📍 Clinic Location:
Road No.11 B, Jubilee hills, Hyderabad - 500045
Google Maps: https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad

We look forward to seeing you! Please arrive 10 minutes prior to your scheduled slot.`,
                                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                                    }]);
                                  }}
                                  className={`flex-1 py-1.5 px-2 rounded-lg text-[10.5px] font-bold text-center transition-all ${
                                    isPaidToken
                                      ? 'bg-emerald-600 text-white cursor-default'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  }`}
                                >
                                  {isPaidToken ? '✓ ₹100 Paid (Razorpay)' : '💳 Pay ₹100 (Instant)'}
                                </button>

                                <a
                                  href={payLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="py-1.5 px-2.5 rounded-lg text-[10.5px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 flex items-center gap-1"
                                >
                                  <span>Open Portal</span>
                                </a>

                                <a
                                  href="https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="py-1.5 px-2 rounded-lg text-[10.5px] font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 hover:underline flex items-center gap-0.5"
                                >
                                  📍 Maps
                                </a>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Meta Time & Status Ticks */}
                  <div className="wa-bubble-meta">
                    <span>{m.time}</span>
                    {isUser && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-800 rounded-xl w-16 shadow-xs my-1 animate-pulse border border-slate-200/60 dark:border-slate-700">
              <div className="h-1.5 w-1.5 bg-[#00a884] rounded-full animate-bounce" />
              <div className="h-1.5 w-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="h-1.5 w-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Test Prompt Chips */}
        <div className="px-2 py-1.5 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { label: "💰 Ask Price (Early Turn)", text: "What is the price of Laser Hair Reduction?" },
            { label: "🌿 Skin Concern", text: "I have dull skin and pigmentation on my cheeks" },
            { label: "📅 Sittings & Gap", text: "How many sessions and what is the interval between PRP sittings?" },
            { label: "🚨 Clinical Emergency", text: "URGENT: Severe burning sensation and rash after chemical peel!" },
            { label: "✅ Book Tomorrow", text: "Book an appointment for Priya Verma tomorrow at 11:30 AM for HydraFacial Deluxe, phone 9876543210" }
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputValue(chip.text);
              }}
              className="text-[10px] whitespace-nowrap bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-2 py-1 rounded-full shadow-2xs transition-colors shrink-0"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* WhatsApp Chat Input Footer */}
        <form onSubmit={handleSendMessage} className="wa-footer">
          <div className="flex items-center gap-1 text-[#54656f] dark:text-slate-400">
            <Smile className="h-5 w-5 cursor-pointer hover:text-[#00a884]" />
            <Paperclip className="h-4 w-4 cursor-pointer hover:text-[#00a884]" />
          </div>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="wa-input"
          />

          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="wa-send-btn disabled:opacity-40"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
