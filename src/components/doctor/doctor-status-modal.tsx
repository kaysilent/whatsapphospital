"use client";

import React, { useState, useEffect } from 'react';
import { 
  useDoctorAvailability 
} from '@/hooks/use-doctor-availability';
import { 
  DoctorStatusType, 
  HOLIDAY_REASON_PRESETS,
  formatDateRange,
  formatReadableDate,
  getDoctorStatusMeta,
  generateDoctorAwayNotice
} from '@/lib/doctor/availability';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  User, 
  Sparkles, 
  AlertTriangle, 
  Plane, 
  Activity, 
  ShieldCheck, 
  History, 
  Trash2,
  Stethoscope,
  ArrowRight,
  MessageSquare,
  Check,
  Building2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface DoctorStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDoctorId?: string;
}

export function DoctorStatusModal({
  isOpen,
  onClose,
  defaultDoctorId
}: DoctorStatusModalProps) {
  const {
    doctors,
    activeDoctor,
    holidayHistory,
    setDoctorHoliday,
    setDoctorAvailable,
    updateDoctor,
    deleteHolidayRecord
  } = useDoctorAvailability();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    defaultDoctorId || activeDoctor?.doctorId || 'doc-mrinalini'
  );

  const currentDoc = doctors.find(d => d.doctorId === selectedDoctorId) || activeDoctor || doctors[0];

  const [status, setStatus] = useState<DoctorStatusType>('available');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('Annual Vacation / Holiday');
  const [customReason, setCustomReason] = useState<string>('');
  const [coveringDoctor, setCoveringDoctor] = useState<string>('Clinical Triage Team (WhatsApp Only)');
  const [endTime, setEndTime] = useState<string>('04:00 PM');
  const [customAutoReply, setCustomAutoReply] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');

  // Initialize form when selected doctor changes or modal opens
  useEffect(() => {
    if (currentDoc) {
      setStatus(currentDoc.status || 'available');
      const todayStr = new Date().toISOString().split('T')[0];
      const defaultEnd = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
      
      setStartDate(currentDoc.startDate || todayStr);
      setEndDate(currentDoc.endDate || defaultEnd);
      setReason(currentDoc.reason || 'Annual Vacation / Holiday');
      setEndTime(currentDoc.endTime || '04:00 PM');
      
      const otherDoc = doctors.find(d => d.doctorId !== currentDoc.doctorId);
      setCoveringDoctor(currentDoc.coveringDoctor || otherDoc?.doctorName || 'Clinical Triage Team (WhatsApp Only)');
      
      setCustomAutoReply(currentDoc.autoReplyNotice || '');
    }
  }, [currentDoc, isOpen]);

  // Sync selected doctor if defaultDoctorId prop changes
  useEffect(() => {
    if (defaultDoctorId) {
      setSelectedDoctorId(defaultDoctorId);
    }
  }, [defaultDoctorId]);

  // Quick Date Preset Helpers
  const applyDatePreset = (days: number, offsetDays = 0) => {
    const start = new Date(Date.now() + offsetDays * 86400000);
    const end = new Date(Date.now() + (offsetDays + days - 1) * 86400000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleSave = () => {
    if (!currentDoc) return;

    if (status === 'available') {
      setDoctorAvailable(currentDoc.doctorId);
      toast.success(`${currentDoc.doctorName} is now set as Active & Available in clinic.`);
      onClose();
      return;
    }

    if (status === 'holiday' || status === 'away') {
      if (!startDate || !endDate) {
        toast.error('Please specify both Start Date and End Date for the absence.');
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        toast.error('Start Date cannot be after End Date.');
        return;
      }

      const effectiveReason = reason === 'Other (Custom)' ? (customReason.trim() || 'Holiday / Leave') : reason;

      setDoctorHoliday(currentDoc.doctorId, {
        startDate,
        endDate,
        reason: effectiveReason,
        coveringDoctor,
        autoReplyNotice: customAutoReply.trim() || undefined,
        status
      });

      toast.success(
        `Leave scheduled for ${currentDoc.doctorName}: ${formatDateRange(startDate, endDate)} (${effectiveReason})`
      );
      onClose();
      return;
    }

    if (status === 'in_surgery') {
      updateDoctor(currentDoc.doctorId, {
        status: 'in_surgery',
        endTime,
        reason: 'In Surgery / Clinical Procedure'
      });
      toast.success(`${currentDoc.doctorName} marked In Surgery (Until ${endTime}).`);
      onClose();
      return;
    }

    if (status === 'off_duty') {
      updateDoctor(currentDoc.doctorId, {
        status: 'off_duty',
        reason: 'Off Duty / Shift Ended'
      });
      toast.success(`${currentDoc.doctorName} marked Off Duty.`);
      onClose();
      return;
    }
  };

  const handleEndHolidayNow = () => {
    if (!currentDoc) return;
    setDoctorAvailable(currentDoc.doctorId);
    setStatus('available');
    toast.success(`Schedule restored. ${currentDoc.doctorName} is now Active & Available.`);
  };

  // Preview notice text
  const previewNotice = customAutoReply.trim() || (
    status === 'holiday' || status === 'away'
      ? `${currentDoc?.doctorName || 'Dr. Mrinalini'} is away from clinic between ${formatDateRange(startDate, endDate)} (${reason === 'Other (Custom)' ? (customReason || 'Leave') : reason}). Consultations will resume on ${endDate ? formatReadableDate(endDate) : 'return'}. For urgent inquiries, our clinical team is assisting via WhatsApp.`
      : status === 'in_surgery'
      ? `${currentDoc?.doctorName || 'Dr. Mrinalini'} is currently in a surgical procedure until ${endTime}. Consultations will resume immediately following completion.`
      : `${currentDoc?.doctorName || 'Dr. Mrinalini'} is available for consultation appointments.`
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl w-full max-h-[92vh] overflow-hidden p-0 gap-0 border-border/70 bg-card shadow-2xl rounded-2xl flex flex-col">
        {/* Header with Doctor Badge */}
        <div className="p-5 sm:p-6 border-b border-border/80 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Doctor Schedule & Availability
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Set clinical availability, vacation schedules, or temporary leaves with precise date ranges.
              </DialogDescription>
            </div>

            {/* Clinic / Doctor Status Pill */}
            {currentDoc && (
              <div className="flex items-center gap-2 bg-background/90 px-3.5 py-2 rounded-xl border border-border/80 shadow-xs">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-left">
                  <p className="text-xs font-bold text-foreground leading-none">{currentDoc.doctorName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{currentDoc.title || 'Lead Clinician'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Active Status Banner */}
          {currentDoc && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-background/90 border border-border/80 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/20">
                  DM
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{currentDoc.doctorName}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted font-medium text-muted-foreground">
                      La Fleur Clinic
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{currentDoc.department || 'Dermatology & Aesthetic Medicine'}</p>
                </div>
              </div>

              {/* Status Badge & Toggle */}
              <div className="flex items-center gap-2.5 self-start sm:self-center">
                <span className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full border font-semibold ${getDoctorStatusMeta(currentDoc.status).badgeClass}`}>
                  <span className={`h-2 w-2 rounded-full ${getDoctorStatusMeta(currentDoc.status).dotClass}`} />
                  {currentDoc.status === 'holiday' || currentDoc.status === 'away' ? (
                    <span>On Leave: {formatDateRange(currentDoc.startDate, currentDoc.endDate) || 'Scheduled Absence'}</span>
                  ) : currentDoc.status === 'in_surgery' ? (
                    <span>In Surgery (Until {currentDoc.endTime || '4:00 PM'})</span>
                  ) : (
                    <span>Active & Available in Clinic</span>
                  )}
                </span>
                
                {currentDoc.status !== 'available' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEndHolidayNow}
                    className="text-xs h-8 px-3 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 font-semibold"
                  >
                    Mark Available Now
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/80 px-6 gap-6 text-xs font-semibold bg-muted/20 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3.5 border-b-2 transition-all flex items-center gap-2 text-xs ${
              activeTab === 'status'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Set Status & Holiday Dates</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3.5 border-b-2 transition-all flex items-center gap-2 text-xs ${
              activeTab === 'history'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Leave & Holiday History ({holidayHistory.length})</span>
          </button>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* 1. Status Type Selector Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Select Doctor Status
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Click to choose current clinical state
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      type: 'available' as const,
                      icon: '🟢',
                      title: 'Available',
                      subtitle: 'In Clinic & Active',
                      borderColor: 'border-emerald-500/30',
                      bgActive: 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
                    },
                    {
                      type: 'holiday' as const,
                      icon: '🏖️',
                      title: 'On Holiday',
                      subtitle: 'Scheduled Vacation',
                      borderColor: 'border-purple-500/30',
                      bgActive: 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30'
                    },
                    {
                      type: 'away' as const,
                      icon: '🟡',
                      title: 'Doctor Away',
                      subtitle: 'Temporary Absence',
                      borderColor: 'border-amber-500/30',
                      bgActive: 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
                    },
                    {
                      type: 'in_surgery' as const,
                      icon: '🔴',
                      title: 'In Surgery',
                      subtitle: 'Procedure in Progress',
                      borderColor: 'border-rose-500/30',
                      bgActive: 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/30'
                    }
                  ].map(item => {
                    const isSelected = status === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setStatus(item.type)}
                        className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[96px] ${
                          isSelected
                            ? `${item.bgActive} shadow-sm`
                            : 'border-border/80 bg-card hover:bg-muted/40 text-foreground hover:border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xl">{item.icon}</span>
                          {isSelected && (
                            <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <p className="font-bold text-xs sm:text-sm text-foreground">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Date Range Configuration (When to When) */}
              {(status === 'holiday' || status === 'away') && (
                <div className="space-y-5 rounded-2xl border border-primary/20 bg-primary/[0.02] p-5 sm:p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/80">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          Leave Schedule & Dates ("When to When")
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Specify the exact start date and return date for Dr. Mrinalini.
                        </p>
                      </div>
                    </div>
                    {startDate && endDate && (
                      <span className="text-xs font-bold px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 self-start sm:self-center">
                        {formatDateRange(startDate, endDate)}
                      </span>
                    )}
                  </div>

                  {/* Quick Select Presets */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Quick Preset Durations:
                    </Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { label: 'Today Only', days: 1, offset: 0 },
                        { label: 'Tomorrow', days: 1, offset: 1 },
                        { label: 'Next 3 Days', days: 3, offset: 0 },
                        { label: '1 Week (7 Days)', days: 7, offset: 0 },
                        { label: '2 Weeks (14 Days)', days: 14, offset: 0 },
                        { label: '1 Month (30 Days)', days: 30, offset: 0 }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyDatePreset(preset.days, preset.offset)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-background hover:bg-muted text-foreground border border-border/80 transition-all font-medium hover:border-primary/40 shadow-2xs"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2-Column Date Pickers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                    <div className="space-y-2">
                      <Label className="text-xs text-foreground font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>Start Date (From)</span>
                        </span>
                        <span className="text-[11px] text-destructive font-bold">* Required</span>
                      </Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-background border-border/80 text-xs sm:text-sm h-10 focus-visible:ring-primary/20 rounded-xl"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {startDate ? `Departs: ${formatReadableDate(startDate)}` : 'Select departure date'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-foreground font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>End Date (To / Return Date)</span>
                        </span>
                        <span className="text-[11px] text-destructive font-bold">* Required</span>
                      </Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-background border-border/80 text-xs sm:text-sm h-10 focus-visible:ring-primary/20 rounded-xl"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {endDate ? `Returns & Resumes: ${formatReadableDate(endDate)}` : 'Select return date'}
                      </p>
                    </div>
                  </div>

                  {/* Reason & Covering Doctor Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-border/60">
                    <div className="space-y-2">
                      <Label className="text-xs text-foreground font-semibold">Reason for Absence</Label>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full h-10 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {HOLIDAY_REASON_PRESETS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        <option value="Other (Custom)">Other (Custom Reason)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-foreground font-semibold">Covering Doctor / Backup</Label>
                      <select
                        value={coveringDoctor}
                        onChange={(e) => setCoveringDoctor(e.target.value)}
                        className="w-full h-10 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="Clinical Triage Team (WhatsApp Only)">Clinical Triage Team (WhatsApp Only)</option>
                        <option value="On-Call Locum Consultant">On-Call Locum Consultant</option>
                        <option value="Duty Medical Officer">Duty Medical Officer</option>
                      </select>
                    </div>
                  </div>

                  {reason === 'Other (Custom)' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-foreground font-semibold">Custom Absence Note</Label>
                      <Input
                        placeholder="e.g. Attending International Dermatology Summit"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        className="bg-background border-border/80 text-xs sm:text-sm h-10 rounded-xl"
                      />
                    </div>
                  )}

                  {/* 3. Live WhatsApp Auto-Reply Notice Simulation */}
                  <div className="space-y-3 pt-3 border-t border-border/80">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                        <span>WhatsApp Patient Auto-Reply Notice</span>
                      </Label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        Active on WhatsApp Bot
                      </span>
                    </div>

                    <textarea
                      rows={3}
                      value={customAutoReply}
                      onChange={(e) => setCustomAutoReply(e.target.value)}
                      placeholder={previewNotice}
                      className="w-full rounded-xl border border-border/80 bg-background p-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
                    />

                    {/* Realistic WhatsApp Chat Bubble Preview */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Live WhatsApp Patient View:
                        </span>
                        <span className="font-mono text-[10px] opacity-75">12:30 PM • Sent</span>
                      </div>
                      <div className="p-3 bg-card rounded-xl border border-border/60 shadow-2xs text-xs sm:text-sm text-foreground leading-relaxed italic">
                        "{previewNotice}"
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* In Surgery Details */}
              {status === 'in_surgery' && (
                <div className="space-y-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.02] p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/80">
                    <Clock className="h-4 w-4 text-rose-500" />
                    <h4 className="text-sm font-bold text-foreground">
                      Procedure Details & Expected Completion
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-xs text-foreground font-semibold">Estimated Procedure End Time</Label>
                      <Input
                        type="text"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        placeholder="e.g. 04:30 PM"
                        className="bg-background border-border/80 text-xs sm:text-sm h-10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-foreground font-semibold">Urgent Backup Contact</Label>
                      <Input
                        type="text"
                        value={coveringDoctor}
                        onChange={(e) => setCoveringDoctor(e.target.value)}
                        className="bg-background border-border/80 text-xs sm:text-sm h-10 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Available State Info */}
              {status === 'available' && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 flex items-start gap-4 shadow-xs">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-sm font-bold text-foreground">Dr. Mrinalini is Active in Clinic</h5>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      All online WhatsApp appointment bookings, consultation slots, and multi-sitting treatments are open for scheduling during regular clinic hours (Monday – Saturday: 10:00 AM – 7:00 PM).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Leave & Holiday Log */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/80">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Scheduled Leaves & Past Holidays</h4>
                  <p className="text-xs text-muted-foreground">Historical and upcoming vacation records for clinic staff.</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
                  {holidayHistory.length} total entries
                </span>
              </div>

              {holidayHistory.length === 0 ? (
                <div className="text-center py-14 border border-dashed border-border rounded-2xl">
                  <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-bold text-foreground">No Leave Records Found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    When you schedule vacation dates or leaves for Dr. Mrinalini, they will be archived here for audit.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {holidayHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{h.doctorName}</span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateRange(h.startDate, h.endDate)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{h.reason}</span>
                          {h.coveringDoctor && (
                            <span> • Backup: <strong className="text-primary font-medium">{h.coveringDoctor}</strong></span>
                          )}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteHolidayRecord(h.id);
                          toast.success('Holiday record removed.');
                        }}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg self-end sm:self-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-border/80 bg-muted/30 flex items-center justify-between flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="text-xs font-medium px-4 h-9 rounded-xl">
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            className="text-xs font-bold gap-2 px-5 h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Save & Apply Schedule</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
