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
  MoreVertical, 
  ArrowLeft, 
  Paperclip, 
  Smile, 
  Mic, 
  Calendar, 
  Clock, 
  Stethoscope, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

const GEMINI_API_KEY = 'AQ.Ab8RN6LKBRFMCfygB5mXTnPNPg9XGMplRdHDutJDoOrp1Ld-Qw';

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

interface ChatEmulatorProps {
  onBookAppointment?: (appt: { patient_name: string; phone_number: string; date: string; time: string; department: string }) => void;
  onRescheduleAppointment?: (patient_name: string, new_date: string, new_time: string) => void;
  onExtractEntity?: (data: any) => void;
  systemPrompt?: string;
}

export const initialSuggestions = [
  { label: "📅 Book Dr. Gupta (Cardiology)", text: "Book an appointment for Rahul (+91 98765 43210) tomorrow 10:30 AM in Cardiology" },
  { label: "👶 Book Pediatrics Checkup", text: "Book appointment for baby Priya (+91 98123 45678) on 2026-09-04 at 11:15 AM in Pediatrics" },
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
      content: "👋 Hello! Welcome to **Aivry Hospital** WhatsApp Reception.\n\nI am your 24/7 AI Health Assistant. How may I assist you today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const resetChat = () => {
    setMessages([
      { 
        id: `m-${Date.now()}`,
        role: 'ai', 
        content: "👋 Hello! Welcome to **Aivry Hospital** WhatsApp Reception.\n\nI am your 24/7 AI Health Assistant. How may I assist you today?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const processMockResponse = (input: string) => {
    const lowerInput = input.toLowerCase();
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (lowerInput.includes('book') || lowerInput.includes('appointment')) {
      const apptData = {
        patient_name: lowerInput.includes('priya') ? "Priya Patel" : "Rahul Sharma",
        phone_number: lowerInput.includes('priya') ? "+91 98123 45678" : "+91 98765 43210",
        date: "2026-09-04",
        time: lowerInput.includes('priya') ? "11:15" : "10:30",
        department: lowerInput.includes('pediatric') ? "Pediatrics" : "Cardiology"
      };

      if (onBookAppointment) onBookAppointment(apptData);
      if (onExtractEntity) {
        onExtractEntity({
          intent: "book_appointment",
          entities: apptData,
          triage_level: "NORMAL",
          confidence: 0.98
        });
      }

      return {
        content: `✅ **Appointment Confirmed!**\n\nYour consultation has been scheduled with ${apptData.department === 'Pediatrics' ? 'Dr. Shalini Roy' : 'Dr. Rajesh Gupta'}. Your slot is booked in the hospital system.`,
        isAppointmentCard: true,
        appointmentData: apptData
      };
    } else if (lowerInput.includes('emergency') || lowerInput.includes('chest pain') || lowerInput.includes('acute')) {
      if (onExtractEntity) {
        onExtractEntity({
          intent: "emergency_triage",
          entities: { symptom: "Acute chest pain", urgency: "IMMEDIATE" },
          triage_level: "CRITICAL_EMERGENCY",
          confidence: 0.99
        });
      }
      return {
        content: `🚨 **EMERGENCY TRIAGE ALERT ACTIVATED**\n\nOur on-duty ER Doctor (Dr. Rajesh Gupta) has been alerted immediately with your number.\n\n📍 **Casualty Hotline:** +91 99999 00108\n🚑 **Ambulance:** Dispatched upon request.\n\nPlease proceed to the Emergency Room at Gate 1 immediately.`,
        isAppointmentCard: false
      };
    } else if (lowerInput.includes('timing') || lowerInput.includes('opd') || lowerInput.includes('hours')) {
      if (onExtractEntity) {
        onExtractEntity({
          intent: "check_opd_hours",
          entities: { department: "All Departments" },
          triage_level: "NORMAL",
          confidence: 0.96
        });
      }
      return {
        content: `🏥 **Hospital Consultation Timings:**\n\n• **Morning OPD:** 09:00 AM – 01:00 PM\n• **Evening OPD:** 04:00 PM – 08:00 PM\n• **Emergency & Trauma:** Open 24/7, 365 Days\n\nWould you like to book a specific doctor consultation?`,
        isAppointmentCard: false
      };
    } else {
      if (onExtractEntity) {
        onExtractEntity({
          intent: "general_query",
          entities: { query: input },
          triage_level: "NORMAL",
          confidence: 0.92
        });
      }
      return {
        content: `Thank you for contacting Aivry Hospital. To schedule a visit, simply provide the **Patient Name, Phone, Preferred Date, and Specialty** (e.g. Cardiology, Pediatrics, General).`,
        isAppointmentCard: false
      };
    }
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

    if (!GEMINI_API_KEY) {
      setTimeout(() => {
        const resp = processMockResponse(textToSend);
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: resp.content,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAppointmentCard: resp.isAppointmentCard,
          appointmentData: resp.appointmentData
        }]);
        setIsTyping(false);
      }, 1000);
      return;
    }

    try {
      let geminiContents = newMessages.map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      if (geminiContents.length > 0 && geminiContents[0].role === 'model') {
        geminiContents.shift();
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt || "You are an AI hospital receptionist for Aivry Hospital. Help book appointments and answer clinical queries with utmost clarity." }]
          },
          contents: geminiContents,
          tools: [{
            function_declarations: [{
              name: "book_appointment",
              description: "Books a hospital appointment once name, date, time, and department are known.",
              parameters: {
                type: "OBJECT",
                properties: {
                  patient_name: { type: "STRING", description: "Full name of the patient" },
                  phone_number: { type: "STRING", description: "Phone number of the patient" },
                  date: { type: "STRING", description: "Date of appointment YYYY-MM-DD" },
                  time: { type: "STRING", description: "Time of appointment HH:MM" },
                  department: { type: "STRING", description: "The hospital department" }
                },
                required: ["patient_name", "phone_number", "date", "time", "department"]
              }
            }]
          }]
        })
      });

      const data = await response.json();
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data?.candidates?.length > 0) {
        const part = data.candidates[0].content.parts[0];
        if (part.functionCall && part.functionCall.name === 'book_appointment') {
          const args = part.functionCall.args;
          const apptData = {
            patient_name: args.patient_name || 'Rahul Sharma',
            phone_number: args.phone_number || '+91 98765 43210',
            date: args.date || '2026-09-04',
            time: args.time || '10:30',
            department: args.department || 'Cardiology'
          };
          if (onBookAppointment) onBookAppointment(apptData);
          if (onExtractEntity) {
            onExtractEntity({
              intent: "book_appointment",
              entities: apptData,
              triage_level: "NORMAL",
              confidence: 0.99
            });
          }
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: `✅ **Appointment Confirmed!**\n\nYour consultation is successfully booked with Dr. Rajesh Gupta (${apptData.department}). It is now synchronized with the hospital dashboard.`,
            time: aiTime,
            isAppointmentCard: true,
            appointmentData: apptData
          }]);
        } else if (part.text) {
          if (onExtractEntity) {
            onExtractEntity({
              intent: "consultation_query",
              entities: { text: textToSend },
              triage_level: "NORMAL",
              confidence: 0.95
            });
          }
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: part.text,
            time: aiTime
          }]);
        }
      } else {
        const fallback = processMockResponse(textToSend);
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: fallback.content,
          time: aiTime,
          isAppointmentCard: fallback.isAppointmentCard,
          appointmentData: fallback.appointmentData
        }]);
      }
    } catch {
      const fallback = processMockResponse(textToSend);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: fallback.content,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAppointmentCard: fallback.isAppointmentCard,
        appointmentData: fallback.appointmentData
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
                <Bot className="h-5 w-5 text-[#008069]" />
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-1.5 ring-white" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs tracking-tight text-white">Aivry Hospital</span>
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
              className="hover:text-white"
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
                        <Calendar className="h-3.5 w-3.5" /> Booking Slip
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-emerald-500/20 px-1.5 py-0.5 rounded">Confirmed</span>
                    </div>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/20">
                      <p><strong className="text-foreground">Patient:</strong> {msg.appointmentData.patient_name}</p>
                      <p><strong className="text-foreground">Department:</strong> {msg.appointmentData.department}</p>
                      <p><strong className="text-foreground">Slot:</strong> {msg.appointmentData.date} at {msg.appointmentData.time}</p>
                    </div>
                  </div>
                )}

                {/* In-Message Interactive Action Chips */}
                {msg.id === 'm-1' && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "Book an appointment for Rahul Sharma tomorrow 10:30 AM in Cardiology")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>📅 Book Doctor Appointment</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "What are the hospital OPD timings and casualty hours?")}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-medium transition-colors flex items-center justify-between"
                    >
                      <span>🕒 Check OPD Consultation Timings</span>
                      <span className="text-[10px] opacity-70">Tap →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(undefined, "Emergency casualty contact & ambulance")}
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
