"use client";

import { useState } from 'react';
import { UserPlus, MessageSquare, Phone, Clock, Plus, ArrowRight, UserCheck, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PipelineCard {
  id: string;
  name: string;
  phone: string;
  department: string;
  summary: string;
  timeAgo: string;
  priority: 'Normal' | 'High';
}

interface Column {
  id: string;
  title: string;
  badgeColor: string;
  cards: PipelineCard[];
}

export default function PipelinesPage() {
  const [columns, setColumns] = useState<Column[]>([
    {
      id: "inbound",
      title: "New WhatsApp Inbound",
      badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
      cards: [
        { id: "c1", name: "Neha Joshi", phone: "+91 98321 00011", department: "Dermatology", summary: "Inquired about laser skin treatment consultation cost", timeAgo: "10m ago", priority: "Normal" },
        { id: "c2", name: "Deepak Chopra", phone: "+91 98452 33221", department: "Cardiology", summary: "Chest discomfort reported; requesting Dr. Gupta's slot", timeAgo: "25m ago", priority: "High" }
      ]
    },
    {
      id: "triage",
      title: "AI Triage & Pre-Consult",
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      cards: [
        { id: "c3", name: "Ramesh Chand", phone: "+91 99112 44556", department: "Orthopedics", summary: "AI collected knee X-Ray history; awaiting doctor time preference", timeAgo: "1h ago", priority: "Normal" }
      ]
    },
    {
      id: "scheduled",
      title: "Appointment Booked",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      cards: [
        { id: "c4", name: "Rahul Sharma", phone: "+91 98765 43210", department: "Cardiology", summary: "Slot confirmed for Today 10:30 AM with Dr. Gupta", timeAgo: "2h ago", priority: "High" },
        { id: "c5", name: "Priya Patel", phone: "+91 98123 45678", department: "Pediatrics", summary: "Slot confirmed for Today 11:15 AM with Dr. Roy", timeAgo: "3h ago", priority: "Normal" }
      ]
    },
    {
      id: "consulted",
      title: "Consulted / Care Given",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
      cards: [
        { id: "c6", name: "Anil Kapoor", phone: "+91 97788 99001", department: "General Medicine", summary: "Prescription sent over WhatsApp; follow-up in 7 days", timeAgo: "1d ago", priority: "Normal" }
      ]
    }
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <UserPlus className="h-6 w-6 text-primary" />
            Patient Inquiries & Triage Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Visual Kanban board tracking patient journey from initial WhatsApp message to post-consultation care.
          </p>
        </div>

        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs sm:text-sm shadow-xs">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Direct Lead
        </Button>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col rounded-xl border border-border bg-card/60 p-3 shadow-xs">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-3 px-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                {column.title}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${column.badgeColor}`}>
                {column.cards.length}
              </span>
            </div>

            {/* Cards List */}
            <div className="space-y-3 min-h-[300px]">
              {column.cards.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/80 text-xs text-muted-foreground">
                  No patients in this stage
                </div>
              ) : (
                column.cards.map((card) => (
                  <div
                    key={card.id}
                    className="group relative rounded-lg border border-border bg-card p-3.5 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{card.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {card.phone}
                        </p>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                        card.priority === 'High' 
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {card.priority}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {card.summary}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[10px]">
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                        <Stethoscope className="h-2.5 w-2.5" />
                        {card.department}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {card.timeAgo}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
