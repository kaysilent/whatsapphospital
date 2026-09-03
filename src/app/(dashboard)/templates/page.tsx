"use client";

import { useState } from 'react';
import { 
  MessageSquareText, 
  Plus, 
  CheckCircle2, 
  Copy, 
  Sparkles, 
  Send, 
  FileText, 
  Clock,
  ShieldCheck,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Template {
  id: string;
  name: string;
  category: "UTILITY" | "MARKETING";
  status: "APPROVED" | "PENDING";
  language: string;
  header: string;
  body: string;
  footer: string;
  variables: string[];
}

export default function TemplatesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const templates: Template[] = [
    {
      id: "tmpl_appt_confirm",
      name: "appointment_confirmation_v2",
      category: "UTILITY",
      status: "APPROVED",
      language: "en_US",
      header: "Appointment Confirmed — Aivry Hospital",
      body: "Hello {{patient_name}}, your appointment with {{doctor_name}} ({{department}}) is confirmed for {{date}} at {{time}}.\n\nPlease arrive 10 minutes prior with any previous medical records.",
      footer: "Reply 'RESCHEDULE' to change your slot.",
      variables: ["patient_name", "doctor_name", "department", "date", "time"]
    },
    {
      id: "tmpl_lab_ready",
      name: "lab_report_ready_v1",
      category: "UTILITY",
      status: "APPROVED",
      language: "en_US",
      header: "Lab Results Ready 🧪",
      body: "Dear {{patient_name}}, your {{test_name}} diagnostic reports are now ready.\n\nYou can access the secure PDF link or consult your doctor for a detailed review.",
      footer: "Aivry Diagnostics Lab",
      variables: ["patient_name", "test_name"]
    },
    {
      id: "tmpl_followup_rx",
      name: "prescription_followup_v1",
      category: "UTILITY",
      status: "APPROVED",
      language: "en_US",
      header: "Doctor Follow-Up & Prescription",
      body: "Hi {{patient_name}}, this is a follow-up from {{doctor_name}} regarding your recent visit. How are you feeling with your prescribed medications?\n\nIf you have any symptoms, reply directly to this chat.",
      footer: "Aivry Patient Care Team",
      variables: ["patient_name", "doctor_name"]
    },
    {
      id: "tmpl_health_camp",
      name: "free_cardiac_camp_broadcast",
      category: "MARKETING",
      status: "APPROVED",
      language: "en_US",
      header: "Free Cardiac Health Checkup Camp ❤️",
      body: "Aivry Hospital is organizing a complimentary Cardiac Screening Camp on {{date}} from 9 AM to 4 PM. Includes Free ECG, Lipid Profile & Senior Doctor Consultation.",
      footer: "Book your free slot by replying 'CAMP'",
      variables: ["date"]
    }
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.body.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <MessageSquareText className="h-6 w-6 text-primary" />
            Meta WhatsApp Message Templates
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Pre-approved Meta WhatsApp templates for automated booking confirmations, lab notifications, and broadcasts.
          </p>
        </div>

        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs sm:text-sm shadow-xs">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Meta Template
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates by name or keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-card border-border text-xs focus-visible:ring-primary/20"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((tmpl) => (
          <div 
            key={tmpl.id}
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all space-y-4"
          >
            <div className="space-y-3">
              {/* Header metadata */}
              <div className="flex items-start justify-between gap-2 border-b border-border/70 pb-3">
                <div>
                  <h3 className="text-xs font-bold font-mono text-foreground">{tmpl.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span>{tmpl.language}</span>
                    <span>•</span>
                    <span className="font-semibold">{tmpl.category}</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-3 w-3" />
                  Meta Approved
                </span>
              </div>

              {/* WhatsApp Message Bubble Simulation */}
              <div className="rounded-lg bg-muted/40 border border-border/80 p-3.5 space-y-2 font-sans text-xs">
                {tmpl.header && (
                  <p className="font-bold text-foreground">{tmpl.header}</p>
                )}
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {tmpl.body}
                </p>
                {tmpl.footer && (
                  <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 mt-2">
                    {tmpl.footer}
                  </p>
                )}
              </div>

              {/* Variables preview */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground font-semibold">Variables:</span>
                {tmpl.variables.map((v) => (
                  <span 
                    key={v}
                    className="inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary"
                  >
                    &#123;&#123;{v}&#125;&#125;
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t border-border/70 pt-3 text-xs">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleCopy(tmpl.id, tmpl.body)}
              >
                {copiedId === tmpl.id ? (
                  <span className="flex items-center text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Copied
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy Body
                  </span>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
              >
                <Send className="h-3 w-3" />
                Use in Broadcast
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
