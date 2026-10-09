"use client";

import React from 'react';
import Link from 'next/link';
import { useDemoState } from '@/hooks/use-demo-state';
import { Calendar, Clock, ArrowRight, UserCheck, Phone, Sparkles } from 'lucide-react';

export function UpcomingAppointments() {
  const { appointments } = useDemoState();

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Live Clinic Bookings
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time appointments confirmed by AI WhatsApp Receptionist.</p>
        </div>
        <Link 
          href="/appointments"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          View All ({appointments.length}) <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="p-5 flex-1">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">No Bookings Yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Appointments booked by patients over WhatsApp or added by staff will appear here.
              </p>
            </div>
            <Link 
              href="/appointments" 
              className="mt-2 inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              Manage Appointments
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.slice(0, 5).map((appt) => (
              <div 
                key={appt.id} 
                className="flex items-center justify-between rounded-lg border border-border bg-card-2/60 p-3.5 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {appt.patient_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-foreground truncate">{appt.patient_name}</p>
                      <span className="font-mono text-[9.5px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold border border-primary/20">
                        {appt.booking_id || (appt.id.startsWith('LF-') ? appt.id : `LF-${(appt.date || '').replace(/\D/g, '') || '20261007'}-${appt.id.slice(-4)}`)}
                      </span>
                      {appt.id.startsWith('appt-') && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="h-2 w-2" /> AI
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone className="h-2.5 w-2.5" />
                        {appt.phone_number}
                      </span>
                      <span>•</span>
                      <span className="text-primary font-medium">{appt.department}</span>
                      {appt.total_sittings && appt.total_sittings > 1 && (
                        <>
                          <span>•</span>
                          <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.2 font-semibold text-[9.5px]">
                            {appt.sitting || `Sitting ${appt.current_sitting || 1}/${appt.total_sittings}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Clock className="h-2.5 w-2.5" />
                    {appt.time}
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">{appt.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
