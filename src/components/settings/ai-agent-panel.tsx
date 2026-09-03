"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDemoState, DEFAULT_LA_FLEUR_SYSTEM_PROMPT } from '@/hooks/use-demo-state';
import { 
  Bot, 
  Save, 
  RotateCcw, 
  Check, 
  Sparkles, 
  ExternalLink, 
  ShieldAlert, 
  CheckCircle2, 
  Calendar,
  Layers,
  HeartPulse,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LlmConfigPanel } from '@/components/settings/llm-config-panel';

const HOSPITAL_PROMPT = `You are an intelligent, empathetic AI receptionist for Aivry Hospital. Your goal is to help patients book and reschedule doctor appointments, check OPD consultation timings, or handle emergency triage. Be polite, concise, natural, and helpful like a real human receptionist. Collect booking details step-by-step: patient's name, phone number, department (e.g. Cardiology, Pediatrics, General Medicine, Orthopedics, Neurology), preferred date, and preferred time slot. Once details are confirmed, complete the booking.`;

export function AiAgentPanel() {
  const { 
    systemPrompt, 
    setSystemPrompt, 
    resetSystemPrompt, 
    isCalendarConnected, 
    setIsCalendarConnected,
    knowledgeItems = [] 
  } = useDemoState();
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const [isSaved, setIsSaved] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState<string | null>(null);

  useEffect(() => {
    setLocalPrompt(systemPrompt);
  }, [systemPrompt]);

  const handleSave = () => {
    setSystemPrompt(localPrompt);
    setIsSaved(true);
    setSaveStatusText("System prompt saved & applied live to WhatsApp AI Agent!");
    setTimeout(() => {
      setIsSaved(false);
      setSaveStatusText(null);
    }, 3500);
  };

  const handleResetToLaFleur = () => {
    setLocalPrompt(DEFAULT_LA_FLEUR_SYSTEM_PROMPT);
    setSystemPrompt(DEFAULT_LA_FLEUR_SYSTEM_PROMPT);
    setIsSaved(true);
    setSaveStatusText("Reset to official La Fleur Aesthetic Clinic Prompt!");
    setTimeout(() => {
      setIsSaved(false);
      setSaveStatusText(null);
    }, 3500);
  };

  const handleApplyHospitalPreset = () => {
    setLocalPrompt(HOSPITAL_PROMPT);
    setSystemPrompt(HOSPITAL_PROMPT);
    setIsSaved(true);
    setSaveStatusText("Applied General Hospital Receptionist preset!");
    setTimeout(() => {
      setIsSaved(false);
      setSaveStatusText(null);
    }, 3500);
  };

  const isLaFleur = localPrompt.includes("La Fleur") || localPrompt.includes("LA FLEUR");
  const wordCount = localPrompt.trim().split(/\s+/).filter(Boolean).length;
  const charCount = localPrompt.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            WhatsApp AI Agent Configuration
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure the AI assistant persona, treatment discovery rules, and clinical safeguards.
          </p>
        </div>

        <Link
          href="/demo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Open Live WhatsApp Simulator</span>
          <ExternalLink className="h-3 w-3 ml-0.5" />
        </Link>
      </div>

      {/* Success Notification Alert */}
      {saveStatusText && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{saveStatusText}</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20">Active</span>
        </div>
      )}

      {/* LLM Model & API Key Provider Manager */}
      <LlmConfigPanel />

      {/* System Prompt Card */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-foreground">System Prompt (Active Persona)</h4>
              {isLaFleur ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                  🌸 La Fleur Clinic Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  Custom Mode
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Controls treatment suggestions, booking logic, multi-sitting workflows, pre/post-care, and medical safety handovers.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToLaFleur}
              className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              title="Reset to official La Fleur prompt"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to La Fleur
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleApplyHospitalPreset}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              Hospital Preset
            </Button>
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            rows={14}
            placeholder="Enter the system prompt instructions for your WhatsApp AI Agent..."
            className="w-full rounded-lg border border-input bg-muted/20 px-3.5 py-3 text-xs leading-relaxed font-mono shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Character count: <strong>{charCount.toLocaleString()}</strong> • Words: <strong>{wordCount.toLocaleString()}</strong></span>
            <span>Real-time instant sync with WhatsApp Simulator</span>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Changes apply immediately to your WhatsApp chatbot and live web simulator.
          </p>

          <Button
            type="button"
            onClick={handleSave}
            className={`h-9 px-5 text-xs font-semibold shadow-xs transition-all gap-1.5 ${
              isSaved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Prompt Saved!
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save System Prompt
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Safety & Feature Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs">
            <HeartPulse className="h-4 w-4" />
            <span>Clinical Safeguards</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Strict non-doctor boundaries. AI will never diagnose, prescribe, or give medical clearances.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
            <Layers className="h-4 w-4" />
            <span>Multi-Sitting Journeys</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Automatic tracking of treatment sittings, intervals, pre-care, and post-care instructions.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs">
            <ShieldAlert className="h-4 w-4" />
            <span>Human Handover</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Automatic escalation to clinic staff for pregnancy, complications, or custom quotes.
          </p>
        </div>
      </div>

      {/* Knowledge Base & Grounding Card */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Knowledge Base & Document Grounding
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {knowledgeItems.filter(k => k.isEnabled).length} Sources Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upload PDF files, brochures, doctor directories, or crawl website URLs so the AI assistant accurately references your clinic's documentation.
            </p>
          </div>

          <Link
            href="/settings?tab=knowledge"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors shrink-0 gap-1.5"
          >
            <span>Manage Knowledge Base</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Knowledge items quick preview pill list */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          {knowledgeItems.slice(0, 3).map(k => (
            <div key={k.id} className="flex items-center gap-1.5 rounded-md bg-muted/40 border border-border px-2.5 py-1 text-xs">
              <span className="text-[10px]">{k.type === 'file' ? '📄' : k.type === 'url' ? '🌐' : '✍️'}</span>
              <span className="font-medium text-foreground max-w-[180px] truncate">{k.title}</span>
              <span className="text-[10px] text-muted-foreground">({k.characterCount.toLocaleString()} chars)</span>
            </div>
          ))}
          {knowledgeItems.length > 3 && (
            <span className="text-[11px] text-muted-foreground font-medium">
              +{knowledgeItems.length - 3} more sources
            </span>
          )}
        </div>
      </div>

      {/* Google Calendar Integration */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Calendar Availability & Sync
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Connect Google Calendar to automatically verify real-time slot availability before offering booking times.
            </p>
          </div>

          <button
            onClick={() => setIsCalendarConnected(!isCalendarConnected)}
            className={`inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-8 px-3.5 py-1.5 shrink-0 ${
              isCalendarConnected 
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isCalendarConnected ? 'Disconnect Calendar' : 'Connect Google Calendar'}
          </button>
        </div>

        {isCalendarConnected && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 pt-1">
            <CheckCircle2 className="h-4 w-4" />
            <span>Live Calendar Sync Active (clinic-coordinator@lafleur.com)</span>
          </div>
        )}
      </div>
    </div>
  );
}

