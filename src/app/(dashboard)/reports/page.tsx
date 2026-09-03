"use client";

import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  ArrowUpRight,
  Stethoscope,
  HeartPulse
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
  const departments = [
    { name: "Cardiology", percentage: 38, count: 563, color: "bg-emerald-500" },
    { name: "Pediatrics", percentage: 26, count: 385, color: "bg-teal-500" },
    { name: "Orthopedics", percentage: 20, count: 296, color: "bg-sky-500" },
    { name: "General Medicine", percentage: 16, count: 238, color: "bg-indigo-500" },
  ];

  const peakHours = [
    { hour: "08:00 - 10:00 AM", volume: "High (24%)", count: "356 msgs" },
    { hour: "10:00 - 01:00 PM", volume: "Peak (42%)", count: "622 msgs" },
    { hour: "02:00 - 05:00 PM", volume: "Moderate (16%)", count: "237 msgs" },
    { hour: "05:00 - 09:00 PM", volume: "Evening Surge (18%)", count: "267 msgs" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-primary" />
            Hospital Analytics & Reports
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Performance metrics for WhatsApp communications, AI automation rate, and clinic consultation volume.
          </p>
        </div>

        <Button variant="outline" size="sm" className="text-xs gap-1.5 shadow-xs">
          Export Full PDF Report
        </Button>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Total Patient Inquiries</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">1,482</p>
          <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +18.4% vs last month
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">AI Automated Triage</span>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">92.4%</p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Resolved without staff escalation
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Booking Conversion</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">34.8%</p>
          <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" /> 516 confirmed slots
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Avg Response Time</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">1.8 sec</p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            24/7 instant WhatsApp response
          </p>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Volume Share */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                Department Inbound Share
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Distribution of patient inquiries across specialties.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {departments.map((dept) => (
              <div key={dept.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">{dept.name}</span>
                  <span className="text-muted-foreground font-mono">{dept.count} inquiries ({dept.percentage}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${dept.color} transition-all duration-500`}
                    style={{ width: `${dept.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Consultation Traffic */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Peak Inbound Consultation Hours
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Optimal staff staffing windows based on message volume.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {peakHours.map((slot) => (
              <div 
                key={slot.hour}
                className="flex items-center justify-between rounded-lg border border-border bg-card-2/60 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-semibold text-foreground">{slot.hour}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">{slot.count}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {slot.volume}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
