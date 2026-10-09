"use client";

import { useState } from 'react';
import { 
  useDemoState, 
  Appointment, 
  getTreatmentProtocol, 
  TREATMENT_PROTOCOLS 
} from '@/hooks/use-demo-state';
import { useDoctorAvailability } from '@/hooks/use-doctor-availability';
import { DoctorStatusModal } from '@/components/doctor/doctor-status-modal';
import { formatDateRange, formatReadableDate, getDoctorStatusMeta } from '@/lib/doctor/availability';
import { generateGoogleCalendarEventUrl } from '@/lib/calendar/google-calendar';
import { getRuntimeTreatments, Treatment, DEFAULT_TREATMENTS } from '@/lib/hospital/treatments';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Calendar, 
  Clock, 
  UserCheck, 
  Search, 
  Plus, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Stethoscope,
  Send,
  Bot,
  Sparkles,
  ArrowRight,
  Layers,
  Repeat,
  X,
  Check,
  Plane,
  CalendarDays,
  ShieldAlert,
  CalendarCheck2,
  LayoutGrid,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  Sliders,
  Settings2,
  RefreshCcw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

const DAYS_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AppointmentsPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { 
    appointments, 
    addAppointment, 
    scheduleNextSitting, 
    completeSitting,
    updateAppointmentProtocol,
    syncAppointments,
    deleteAppointment
  } = useDemoState();

  const {
    doctors,
    activeAwayDoctors,
    isDoctorAwayByName,
    hospitalConfig
  } = useDoctorAvailability();

  // View mode switcher: 'table' vs 'calendar'
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDoctorStatusOpen, setIsDoctorStatusOpen] = useState(false);
  const [selectedDoctorForStatus, setSelectedDoctorForStatus] = useState<string | undefined>();

  // Calendar navigation state
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string>(new Date().toISOString().split('T')[0]);

  // New appointment form state
  const [patientName, setPatientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [apptDate, setApptDate] = useState(new Date().toISOString().split('T')[0]);
  const [apptTime, setApptTime] = useState('11:30 AM');
  const [department, setDepartment] = useState('Laser Hair Reduction');
  const [doctor, setDoctor] = useState('Dr. Mrinalini');
  const [currentSitting, setCurrentSitting] = useState(1);
  const [totalSittings, setTotalSittings] = useState(6);
  const [sittingInterval, setSittingInterval] = useState('4-6 weeks');
  const [sittingIntervalDays, setSittingIntervalDays] = useState(28);
  const [availableTreatments, setAvailableTreatments] = useState<Treatment[]>(DEFAULT_TREATMENTS);

  // Edit Sittings & Protocol Modal State (Super Admin / Admin / Manager)
  const [editProtocolAppt, setEditProtocolAppt] = useState<Appointment | null>(null);
  const [editTotalSittings, setEditTotalSittings] = useState<number>(4);
  const [editCurrentSitting, setEditCurrentSitting] = useState<number>(1);
  const [editSittingInterval, setEditSittingInterval] = useState<string>('2 weeks');
  const [editSittingIntervalDays, setEditSittingIntervalDays] = useState<number>(14);

  // Complete Appointment & Shift to Follow-Up Modal State
  const [completeApptModal, setCompleteApptModal] = useState<Appointment | null>(null);
  const [completeNextDate, setCompleteNextDate] = useState<string>('');
  const [completeGapText, setCompleteGapText] = useState<string>('2 weeks');
  const [completeGapDays, setCompleteGapDays] = useState<number>(14);

  // Load active treatments from catalogue
  useState(() => {
    if (typeof window !== 'undefined') {
      const active = getRuntimeTreatments().filter(t => t.isActive);
      if (active.length > 0) {
        setAvailableTreatments(active);
      }
    }
  });

  // Selected appointment details modal
  const [inspectionAppt, setInspectionAppt] = useState<Appointment | null>(null);

  // Schedule Next Sitting Modal state
  const [isNextSittingOpen, setIsNextSittingOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('11:30 AM');
  const [nextNotes, setNextNotes] = useState('');

  const handleDepartmentChange = (dept: string) => {
    setDepartment(dept);
    setDoctor('Dr. Mrinalini');

    // First check dynamic catalogue
    const matchingTrt = availableTreatments.find(t => t.name.toLowerCase() === dept.toLowerCase());
    if (matchingTrt) {
      setTotalSittings(matchingTrt.recommendedSittings || 1);
      setSittingInterval(matchingTrt.sittingInterval || 'As advised');
      setSittingIntervalDays(matchingTrt.sittingIntervalDays || 30);
    } else {
      const protocol = getTreatmentProtocol(dept);
      setTotalSittings(protocol.totalSittings || 4);
      setSittingInterval(protocol.sittingInterval || '1 month');
      setSittingIntervalDays(protocol.sittingIntervalDays || 30);
    }
    setCurrentSitting(1);
  };

  const handleIntervalChange = (val: string) => {
    setSittingInterval(val);
    if (val === '1 week') setSittingIntervalDays(7);
    else if (val === '2 weeks') setSittingIntervalDays(14);
    else if (val === '3 weeks') setSittingIntervalDays(21);
    else if (val === '4 weeks' || val === '1 month') setSittingIntervalDays(28);
    else if (val === '4-6 weeks') setSittingIntervalDays(35);
    else if (val === '45 days') setSittingIntervalDays(45);
    else if (val === '2 months') setSittingIntervalDays(60);
  };

  const filteredAppointments = appointments.filter(appt => {
    const matchesSearch = appt.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (appt.booking_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          appt.phone_number.includes(searchTerm) ||
                          appt.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (appt.sitting || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || (appt.status || 'Confirmed').includes(statusFilter);
    return matchesSearch && matchesStatus;
  });

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phoneNumber.trim()) {
      toast.error("Please enter patient name and WhatsApp phone number.");
      return;
    }

    addAppointment({
      patient_name: patientName.trim(),
      phone_number: phoneNumber.trim(),
      date: apptDate,
      time: apptTime,
      department: department,
      doctor: 'Dr. Mrinalini',
      status: "Confirmed (Staff)",
      current_sitting: currentSitting,
      total_sittings: totalSittings,
      sitting_interval: sittingInterval,
      sitting_interval_days: sittingIntervalDays,
      sitting: totalSittings > 1 ? `Sitting ${currentSitting} of ${totalSittings}` : 'Consultation'
    });

    toast.success(`Appointment confirmed for ${patientName}! AI Follow-up protocol queued (Day 0, -7 Days, -2 Days).`);
    setPatientName('');
    setPhoneNumber('');
    setIsAddOpen(false);
  };

  const handleOpenNextSittingModal = (appt: Appointment) => {
    setSelectedAppt(appt);
    const intervalDays = appt.sitting_interval_days || 30;
    
    let baseTimestamp = Date.now();
    try {
      const parsed = new Date(appt.date).getTime();
      if (!isNaN(parsed)) baseTimestamp = parsed;
    } catch {}
    
    const suggestedTimestamp = baseTimestamp + intervalDays * 86400000;
    const suggestedDateStr = new Date(suggestedTimestamp).toISOString().split('T')[0];
    
    setNextDate(suggestedDateStr);
    setNextTime(appt.time || '11:30 AM');
    setNextNotes(`Follow-up Sitting ${(appt.current_sitting || 1) + 1} with Dr. Mrinalini (${appt.sitting_interval || '1 month'} interval).`);
    setIsNextSittingOpen(true);
  };

  const handleConfirmNextSitting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt || !nextDate) return;

    const nextAppt = scheduleNextSitting(selectedAppt.id, nextDate, nextTime, nextNotes);
    if (nextAppt) {
      toast.success(`Sitting ${nextAppt.current_sitting} scheduled for ${selectedAppt.patient_name} on ${nextDate}! AI Reminder Queued.`);
    }
    setIsNextSittingOpen(false);
    setSelectedAppt(null);
  };

  const handleOpenEditProtocol = (appt: Appointment) => {
    setEditProtocolAppt(appt);
    setEditTotalSittings(appt.total_sittings || 4);
    setEditCurrentSitting(appt.current_sitting || 1);
    setEditSittingInterval(appt.sitting_interval || '2 weeks');
    setEditSittingIntervalDays(appt.sitting_interval_days || 14);
  };

  const handleSaveEditProtocol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProtocolAppt) return;
    updateAppointmentProtocol(editProtocolAppt.id, {
      total_sittings: editTotalSittings,
      current_sitting: editCurrentSitting,
      sitting_interval: editSittingInterval,
      sitting_interval_days: editSittingIntervalDays
    });
    toast.success(`Updated treatment protocol for ${editProtocolAppt.patient_name} (${editTotalSittings} sittings, ${editSittingInterval} gap)!`);
    setEditProtocolAppt(null);
  };

  const handleOpenCompleteModal = (appt: Appointment) => {
    setCompleteApptModal(appt);
    const gapDays = appt.sitting_interval_days || 14;
    const gapText = appt.sitting_interval || '2 weeks';
    setCompleteGapText(gapText);
    setCompleteGapDays(gapDays);
    
    const nextTimestamp = Date.now() + gapDays * 86400000;
    setCompleteNextDate(new Date(nextTimestamp).toISOString().split('T')[0]);
  };

  const handleConfirmComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeApptModal) return;
    
    completeSitting(completeApptModal.id, completeNextDate, completeGapText, completeGapDays);
    toast.success(`Sitting marked Completed for ${completeApptModal.patient_name}! Shifted into Follow-Up Section.`);
    setCompleteApptModal(null);
  };

  const handleCompleteSitting = (appt: Appointment) => {
    handleOpenCompleteModal(appt);
  };

  const handleSendReminder = async (appt: Appointment) => {
    const mapsLink = "https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad";
    const msg = `Appointment Reminder (5:00 PM Update):\n\nDear ${appt.patient_name}, your consultation with Dr. Mrinalini is scheduled for ${appt.date} at ${appt.time} for ${appt.department || 'Clinical Consultation'}.\n\n• Pre-Care Guidance: Avoid active exfoliants, keep area clean, and stay hydrated.\n• Clinic Google Maps Location:\n${mapsLink}\nRoad No.11 B, Jubilee hills, Hyderabad - 500045.\n\nPlease reply CONFIRM to acknowledge.`;

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: appt.phone_number,
          name: appt.patient_name,
          message_type: 'text',
          content_text: msg,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send WhatsApp reminder');
      } else {
        toast.success(`WhatsApp Pre-Care & Timing Reminder sent to ${appt.patient_name} (${appt.phone_number})!`);
      }
    } catch (err) {
      console.error('Send reminder error:', err);
      toast.error('Network error sending WhatsApp reminder');
    }
  };

  // Calendar grid computation helpers
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = `${MONTH_NAMES[month]} ${year}`;

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Helper for deterministic local YYYY-MM-DD
  const formatYMD = (y: number, m: number, d: number) => 
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Days grid: previous month padding + current month days + next month padding
  const calendarCells = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dateStr = formatYMD(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), prevMonthDate.getDate());
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
      dateObj: prevMonthDate
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = formatYMD(year, month, d);
    calendarCells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      dateObj
    });
  }

  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonthDate = new Date(year, month + 1, i);
    const dateStr = formatYMD(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), nextMonthDate.getDate());
    calendarCells.push({
      dateStr,
      dayNum: i,
      isCurrentMonth: false,
      dateObj: nextMonthDate
    });
  }

  const now = new Date();
  const todayStr = formatYMD(now.getFullYear(), now.getMonth(), now.getDate());

  // Appointments for the currently selected day in calendar view
  const selectedDayAppointments = appointments.filter(a => {
    const aDate = a.date.toLowerCase() === 'today' ? todayStr : a.date.toLowerCase() === 'tomorrow' ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : a.date;
    return aDate === selectedCalendarDay;
  });

  const isSelectedDayDoctorAway = isDoctorAwayByName('Dr. Mrinalini', selectedCalendarDay);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Calendar className="h-6 w-6 text-primary" />
            Appointments & Multi-Sitting CRM
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Consultations with <strong>Dr. Mrinalini</strong>, multi-sitting tracking, intervals, and automated follow-up cadences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dual View Toggle Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-card border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Calendar View</span>
            </button>
          </div>

          <Button
            onClick={async () => {
              setIsSyncing(true);
              await syncAppointments();
              setTimeout(() => {
                setIsSyncing(false);
                toast.success('Appointments synced with WhatsApp server!');
              }, 400);
            }}
            variant="outline"
            disabled={isSyncing}
            className="text-xs font-semibold gap-1.5 shadow-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Server'}</span>
          </Button>

          <Button
            onClick={() => {
              handleDepartmentChange('Laser Hair Reduction');
              setApptDate(selectedCalendarDay || todayStr);
              setIsAddOpen(true);
            }}
            variant="outline"
            className="text-xs font-semibold gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4 text-primary" />
            <span>Add Manual Booking</span>
          </Button>

          <Button
            onClick={() => {
              setSelectedDoctorForStatus('doc-mrinalini');
              setIsDoctorStatusOpen(true);
            }}
            variant="outline"
            className="text-xs font-semibold gap-1.5 shadow-xs border-purple-500/30 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10"
          >
            <Plane className="h-4 w-4" />
            <span>Out of Office / Leave</span>
          </Button>

          <Link
            href="/calendar"
            className="inline-flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-3.5 py-2 shadow-xs transition-colors gap-1.5"
          >
            <Clock className="h-4 w-4" />
            <span>Clinic Work Hours & Timings</span>
          </Link>
        </div>
      </div>

      {/* Mini Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Total Bookings</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{appointments.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Multi-Sitting Courses</p>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {appointments.filter(a => (a.total_sittings || 1) > 1).length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Consulting Doctor</p>
          <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
            Dr. Mrinalini
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">AI Follow-Up Engine</p>
          <p className="mt-1 text-lg font-bold text-primary flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active (3-Stage)
          </p>
        </div>
      </div>

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patient name, phone, treatment, or sitting..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-muted/40 border-border text-xs focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
              {['All', 'Confirmed', 'Scheduled', 'Completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    statusFilter === status
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Appointments Data Table with S.No instead of Initials, and Dr. Mrinalini */}
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-16 text-xs font-bold text-muted-foreground text-center">S.No</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Patient Name</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">WhatsApp Contact</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Date & Slot</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Treatment & Doctor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Sitting Progress & Interval</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right">Doctor Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="size-8 text-muted-foreground/60" />
                        <p className="text-sm font-medium text-foreground">No appointments match your search</p>
                        <p className="text-xs text-muted-foreground">Book appointments live in the AI Emulator demo or add manually.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((appt, idx) => {
                    const totalSittingsNum = appt.total_sittings || 1;
                    const currentSittingNum = appt.current_sitting || 1;
                    const isMultiSitting = totalSittingsNum > 1;
                    const isCompleted = appt.status === 'Completed';
                    const hasNextSitting = isMultiSitting && currentSittingNum < totalSittingsNum;

                    return (
                      <TableRow key={appt.id} className={`border-border hover:bg-muted/40 transition-colors ${isCompleted ? 'bg-muted/20 opacity-80' : ''}`}>
                        {/* S.No Badge */}
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center h-6 min-w-[28px] px-1.5 rounded-md bg-muted text-[11px] font-mono font-bold text-foreground border border-border/80">
                            #{idx + 1}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-foreground">{appt.patient_name}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-primary/10 text-[10px] font-mono font-bold text-primary border border-primary/20">
                                {appt.booking_id || (appt.id.startsWith('LF-') ? appt.id : `LF-${(appt.date || '').replace(/\D/g, '') || '20261007'}-${appt.id.slice(-4)}`)}
                              </span>
                              {appt.id.startsWith('appt-') && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                                  <Sparkles className="h-2.5 w-2.5" /> Booked by AI
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {appt.phone_number}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-foreground font-medium">
                              <Clock className="h-3 w-3 text-primary" />
                              {appt.time}
                            </span>
                            <span className="text-xs text-muted-foreground">{appt.date}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                              <Stethoscope className="h-3 w-3 text-emerald-600" />
                              Dr. Mrinalini
                            </span>
                            <span className="text-[11px] text-muted-foreground">{appt.department}</span>
                          </div>
                        </TableCell>
                        
                        {/* Sitting Progress & Interval Column */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                                isMultiSitting 
                                  ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                <Layers className="h-3 w-3" />
                                {appt.sitting || (isMultiSitting ? `Sitting ${currentSittingNum} of ${totalSittingsNum}` : 'Consultation')}
                              </span>
                            </div>
                            {isMultiSitting && (
                              <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                                <Repeat className="h-2.5 w-2.5 text-primary" />
                                <span>Interval: <strong>{appt.sitting_interval || '1 month'}</strong></span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            isCompleted
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            <CheckCircle2 className="h-3 w-3" />
                            {appt.status || "Confirmed"}
                          </span>
                        </TableCell>

                        {/* Doctor Action Controls */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1-Click Google Calendar Export */}
                            <a
                              href={generateGoogleCalendarEventUrl({
                                title: `Appointment: ${appt.patient_name} - ${appt.department || 'Dermatology'}`,
                                description: `Consultation with Dr. Mrinalini for ${appt.patient_name}.\nTreatment: ${appt.department}\nSitting: ${currentSittingNum}/${totalSittingsNum}\nStatus: ${appt.status || 'Confirmed'}`,
                                location: 'La Fleur Aesthetic & Wellness Clinic, Mumbai',
                                startDate: appt.date.toLowerCase() === 'today' ? new Date().toISOString().split('T')[0] : appt.date.toLowerCase() === 'tomorrow' ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : appt.date,
                                startTime: appt.time || '11:00 AM',
                                patientName: appt.patient_name,
                                patientPhone: appt.phone_number || 'WhatsApp Confirmed',
                                doctorName: 'Dr. Mrinalini',
                                treatmentName: appt.department || 'Consultation',
                                appointmentId: String(appt.id)
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-7 px-2 rounded-lg border border-border/80 bg-background hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-600 text-[11px] font-medium text-muted-foreground transition-colors shadow-2xs"
                              title="Export / Add to Google Calendar"
                            >
                              <Calendar className="h-3 w-3 mr-1 text-blue-500" />
                              <span>GCal</span>
                            </a>

                            {/* Edit Sittings & Protocol Modal Trigger (Super Admin / Admin / Manager) */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditProtocol(appt)}
                              className="h-7 text-[11px] gap-1 hover:border-primary hover:text-primary"
                              title="Manually configure sittings count and interval gap (Admin / Manager)"
                            >
                              <Settings2 className="h-3 w-3 text-primary" />
                              <span>Sittings</span>
                            </Button>

                            {hasNextSitting && !isCompleted && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleOpenNextSittingModal(appt)}
                                className="h-7 text-[11px] gap-1 bg-primary text-primary-foreground font-medium shadow-2xs"
                                title="Schedule Next Sitting at recommended interval"
                              >
                                <Calendar className="h-3 w-3" />
                                Next Sitting
                              </Button>
                            )}

                            {!isCompleted ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompleteSitting(appt)}
                                className="h-7 text-[11px] gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-semibold"
                                title="Mark sitting complete and shift details into Follow-Up section"
                              >
                                <Check className="h-3 w-3 text-emerald-600" />
                                Complete
                              </Button>
                            ) : (
                              <Link
                                href="/follow-ups"
                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-semibold text-[11px] border border-purple-500/30 transition-colors shadow-2xs"
                                title="Shifted to Follow-Up Section — Click to view in Follow-Ups"
                              >
                                <RefreshCcw className="h-3 w-3 text-purple-600" />
                                <span>In Follow-Ups ➔</span>
                              </Link>
                            )}

                            {/* Delete Appointment Button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete the appointment for ${appt.patient_name}?`)) {
                                  deleteAppointment(appt.id);
                                  toast.success(`Appointment for ${appt.patient_name} deleted`);
                                }
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 dark:hover:bg-red-950/40 transition-colors"
                              title="Delete Appointment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* VIEW 2: INTERACTIVE CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Month Navigation Banner */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground capitalize">
                  {monthName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Consultation roster for Dr. Mrinalini • Click any date to view appointments or book a slot.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(currentCalendarDate);
                  d.setMonth(d.getMonth() - 1);
                  setCurrentCalendarDate(d);
                }}
                className="p-2 rounded-xl border border-border hover:bg-muted text-foreground transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setCurrentCalendarDate(d);
                  setSelectedCalendarDay(d.toISOString().split('T')[0]);
                }}
                className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => {
                  const d = new Date(currentCalendarDate);
                  d.setMonth(d.getMonth() + 1);
                  setCurrentCalendarDate(d);
                }}
                className="p-2 rounded-xl border border-border hover:bg-muted text-foreground transition-colors"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 7-Column Monthly Calendar Grid */}
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-bold text-muted-foreground py-2.5">
              {DAYS_NAME.map((d, i) => (
                <div key={d} className={i === 0 || i === 6 ? 'text-amber-600 dark:text-amber-400' : ''}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid Days */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
              {calendarCells.map((cell) => {
                const dayAppts = appointments.filter(a => {
                  const aDate = a.date.toLowerCase() === 'today' ? todayStr : a.date.toLowerCase() === 'tomorrow' ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : a.date;
                  return aDate === cell.dateStr;
                });

                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedCalendarDay;
                const docAwayInfo = isDoctorAwayByName('Dr. Mrinalini', cell.dateStr);

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setSelectedCalendarDay(cell.dateStr)}
                    className={`min-h-[115px] p-2 flex flex-col justify-between transition-all cursor-pointer group ${
                      !cell.isCurrentMonth
                        ? 'bg-muted/10 opacity-40'
                        : isSelected
                        ? 'bg-primary/5 ring-2 ring-primary ring-inset'
                        : isToday
                        ? 'bg-emerald-500/[0.04]'
                        : 'bg-card hover:bg-muted/30'
                    }`}
                  >
                    {/* Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
                        isToday
                          ? 'bg-emerald-600 text-white font-extrabold'
                          : isSelected
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'text-foreground'
                      }`}>
                        {cell.dayNum}
                      </span>

                      {dayAppts.length > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {dayAppts.length} {dayAppts.length === 1 ? 'Appt' : 'Appts'}
                        </span>
                      )}
                    </div>

                    {/* Doctor Vacation Indicator if away */}
                    {docAwayInfo.isAway && (
                      <div className="my-1 px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[9.5px] font-semibold text-purple-700 dark:text-purple-300 truncate">
                        🏖️ Doctor Away ({docAwayInfo.doctor?.reason || 'Leave'})
                      </div>
                    )}

                    {/* Appointment Chips List */}
                    <div className="space-y-1 my-1 overflow-hidden">
                      {dayAppts.slice(0, 2).map((a, i) => (
                        <div
                          key={a.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectionAppt(a);
                          }}
                          className="p-1 rounded bg-background border border-border/80 text-[10.5px] font-medium text-foreground hover:border-primary transition-all truncate shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold truncate text-primary">{a.patient_name.split(' ')[0]}</span>
                            <span className="text-[9.5px] text-muted-foreground shrink-0">{a.time.replace(' ', '')}</span>
                          </div>
                        </div>
                      ))}
                      {dayAppts.length > 2 && (
                        <p className="text-[9.5px] font-bold text-muted-foreground text-center">
                          +{dayAppts.length - 2} more
                        </p>
                      )}
                    </div>

                    {/* Bottom Day Status */}
                    <div className="text-[9.5px] text-muted-foreground flex justify-between items-center pt-1 border-t border-border/40">
                      <span>{dayAppts.length === 0 ? 'Open' : `${dayAppts.length} Booked`}</span>
                      <span className="opacity-0 group-hover:opacity-100 text-primary font-bold transition-opacity">+</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Schedule Inspector Pane */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Consultation Schedule for {formatReadableDate(selectedCalendarDay) || selectedCalendarDay}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Doctor on Duty: <strong className="text-foreground">Dr. Mrinalini</strong> (Chief Dermatologist)
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setApptDate(selectedCalendarDay);
                  setIsAddOpen(true);
                }}
                className="bg-primary text-primary-foreground font-semibold text-xs shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Book Slot for {selectedCalendarDay}
              </Button>
            </div>

            {/* If Doctor is away on this date */}
            {isSelectedDayDoctorAway.isAway && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 flex items-start gap-2.5 text-xs text-purple-800 dark:text-purple-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Dr. Mrinalini is on Leave / Holiday on this date</p>
                  <p className="text-[11px] text-purple-700/90 dark:text-purple-300/80">
                    Range: {isSelectedDayDoctorAway.dateRange} ({isSelectedDayDoctorAway.doctor?.reason || 'Leave'}). WhatsApp AI automatically notifies patients.
                  </p>
                </div>
              </div>
            )}

            {/* List of appointments on selected day */}
            {selectedDayAppointments.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                <p className="font-semibold text-foreground">No appointments booked for this day yet.</p>
                <p>Click "Book Slot" above to schedule a consultation with Dr. Mrinalini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedDayAppointments.map((appt, idx) => (
                  <div key={appt.id} className="p-4 rounded-xl border border-border/80 bg-background space-y-2.5 shadow-2xs hover:border-primary/50 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-6 px-1.5 rounded bg-muted text-xs font-mono font-bold text-foreground flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-foreground">{appt.patient_name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-semibold text-primary">
                              {appt.booking_id || (appt.id.startsWith('LF-') ? appt.id : `LF-${(appt.date || '').replace(/\D/g, '') || '20261007'}-${appt.id.slice(-4)}`)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">• {appt.phone_number}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {appt.time}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 pt-1 border-t border-border/60">
                      <p className="font-medium text-foreground">{appt.department}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Layers className="h-3 w-3 text-purple-600" />
                        <span>{appt.sitting || 'Consultation'}</span>
                        {appt.sitting_interval && <span>• Interval: {appt.sitting_interval}</span>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenNextSittingModal(appt)}
                        className="text-[11px] h-7 px-2.5 font-semibold text-primary"
                      >
                        Next Sitting
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteSitting(appt)}
                        className="text-[11px] h-7 px-2.5 hover:text-emerald-600 hover:border-emerald-500 font-semibold"
                      >
                        Complete
                      </Button>

                      <Link
                        href={`/inbox?phone=${encodeURIComponent(appt.phone_number || '')}&name=${encodeURIComponent(appt.patient_name || '')}`}
                        className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs hover:bg-emerald-500/20 font-semibold"
                        title="Open Live WhatsApp Chat in Inbox"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Link>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete the appointment for ${appt.patient_name}?`)) {
                            deleteAppointment(appt.id);
                            toast.success(`Appointment for ${appt.patient_name} deleted`);
                          }
                        }}
                        className="text-[11px] h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                        title="Delete Appointment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Schedule Next Sitting Modal Dialog */}
      {isNextSittingOpen && selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Schedule Next Sitting</h3>
              </div>
              <button onClick={() => setIsNextSittingOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmNextSitting} className="space-y-3.5 mt-4">
              <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>{selectedAppt.patient_name}</span>
                  <span className="text-primary">{selectedAppt.department}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11.5px]">
                  <span>Previous: Sitting {selectedAppt.current_sitting || 1} of {selectedAppt.total_sittings || 1}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Next: Sitting {(selectedAppt.current_sitting || 1) + 1} of {selectedAppt.total_sittings || 1}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  Doctor: <strong className="text-foreground">Dr. Mrinalini</strong> • Interval: <strong className="text-foreground">{selectedAppt.sitting_interval || '1 month'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Recommended Date</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Time Slot</Label>
                  <select
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="10:30 AM">10:30 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:30 PM">02:30 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                    <option value="05:30 PM">05:30 PM</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Clinical Notes / Goals</Label>
                <Input
                  value={nextNotes}
                  onChange={(e) => setNextNotes(e.target.value)}
                  placeholder="e.g. Laser Session 3 — Check follicle reduction"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsNextSittingOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                  Confirm Next Sitting & Sync AI
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Manual Booking Modal Dialog */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Schedule Consultation / Sittings</h3>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Patient Full Name</Label>
                  <Input
                    placeholder="e.g. Pooja Hegde"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">WhatsApp Mobile Number</Label>
                  <Input
                    placeholder="e.g. +91 98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Department / Treatment</Label>
                <select
                  value={department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {availableTreatments.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.currency}{t.price.toLocaleString('en-IN')})
                    </option>
                  ))}
                  <option value="General Dermatological Consultation">General Dermatological Consultation</option>
                </select>
              </div>

              {/* Sittings & Interval Dropdowns */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Repeat className="h-4 w-4" />
                  <span>Multi-Sitting Course & Follow-Up Interval Setup</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Dropdown 1: Number of Sittings */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Number of Sittings</Label>
                    <select
                      value={totalSittings}
                      onChange={(e) => setTotalSittings(parseInt(e.target.value) || 1)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value={1}>1 Sitting (Single Consultation / Session)</option>
                      <option value={2}>2 Sittings</option>
                      <option value={3}>3 Sittings</option>
                      <option value={4}>4 Sittings (Recommended for Peels/PRP)</option>
                      <option value={5}>5 Sittings</option>
                      <option value={6}>6 Sittings (Standard Laser Course)</option>
                      <option value={8}>8 Sittings</option>
                      <option value={10}>10 Sittings</option>
                    </select>
                  </div>

                  {/* Dropdown 2: Interval Between Each Sitting */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Interval Between Each Sitting</Label>
                    <select
                      value={sittingInterval}
                      onChange={(e) => handleIntervalChange(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="2 weeks">2 Weeks</option>
                      <option value="3 weeks">3 Weeks</option>
                      <option value="1 month">1 Month (30 Days)</option>
                      <option value="45 days">45 Days</option>
                      <option value="2 months">2 Months (60 Days)</option>
                    </select>
                  </div>
                </div>

                {/* AI Follow-Up Cadence Box */}
                <div className="rounded-lg bg-background/80 border border-border/80 p-2.5 text-[11px] text-muted-foreground space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                    Automated WhatsApp Follow-Up Lifecycle:
                  </p>
                  <p>1. <strong>Day 0 (End of Today):</strong> AI sends summary ({totalSittings} sittings, {sittingInterval} interval) and asks patient to book next sitting.</p>
                  <p>2. <strong>7 Days Prior:</strong> Reminder sent if patient has not booked a slot.</p>
                  <p>3. <strong>2 Days Prior:</strong> Final booking reminder sent.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Consultation Date</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Time Slot</Label>
                  <select
                    value={apptTime}
                    onChange={(e) => setApptTime(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="10:30 AM">10:30 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:30 PM">02:30 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                    <option value="05:30 PM">05:30 PM</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Consulting Doctor</Label>
                <div className="p-2 rounded-lg bg-muted/40 border border-border text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Dr. Mrinalini (Chief Dermatologist)</span>
                  <span className="text-[10px] text-emerald-600 font-semibold px-2 py-0.5 rounded bg-emerald-500/10">Sole Specialist</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                  Confirm & Queue AI Follow-Ups
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Appointment Inspector Modal */}
      {inspectionAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Appointment Details</h3>
              </div>
              <button onClick={() => setInspectionAppt(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{inspectionAppt.patient_name}</span>
                  <span className="text-primary">{inspectionAppt.time}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">{inspectionAppt.phone_number}</span>
                  <span className="font-mono font-bold text-[10.5px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Booking ID: {inspectionAppt.booking_id || (inspectionAppt.id.startsWith('LF-') ? inspectionAppt.id : `LF-${(inspectionAppt.date || '').replace(/\D/g, '') || '20261007'}-${inspectionAppt.id.slice(-4)}`)}
                  </span>
                </div>
                <p className="text-foreground pt-1">Date: <strong>{inspectionAppt.date}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border border-border/80 bg-background">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Treatment</span>
                  <p className="font-semibold text-foreground mt-0.5">{inspectionAppt.department}</p>
                </div>
                <div className="p-2.5 rounded-lg border border-border/80 bg-background">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Doctor</span>
                  <p className="font-semibold text-emerald-600 mt-0.5">Dr. Mrinalini</p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-border/80 bg-background space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Course & Sitting</span>
                <p className="font-semibold text-foreground">{inspectionAppt.sitting || 'Consultation'}</p>
                {inspectionAppt.sitting_interval && (
                  <p className="text-[11px] text-muted-foreground">Interval: {inspectionAppt.sitting_interval}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const target = inspectionAppt;
                  setInspectionAppt(null);
                  handleOpenEditProtocol(target);
                }}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1 text-primary" />
                Edit Sittings
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const target = inspectionAppt;
                  setInspectionAppt(null);
                  handleOpenCompleteModal(target);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Complete & Shift to Follow-Ups
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Edit Protocol & Sittings Modal (Super Admin / Admin / Manager) */}
      {editProtocolAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Configure Sittings & Protocol</h3>
                  <p className="text-[11px] text-muted-foreground">Admin & Manager Clinical Overrides</p>
                </div>
              </div>
              <button onClick={() => setEditProtocolAppt(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProtocol} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <p className="font-bold text-foreground text-sm">{editProtocolAppt.patient_name}</p>
                <p className="text-muted-foreground font-mono">{editProtocolAppt.phone_number}</p>
                <p className="text-primary font-medium">{editProtocolAppt.department} with Dr. Mrinalini</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Total Sittings Count</Label>
                  <select
                    value={editTotalSittings}
                    onChange={(e) => setEditTotalSittings(parseInt(e.target.value) || 1)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value={1}>1 Sitting (Single Session)</option>
                    <option value={2}>2 Sittings (Introductory)</option>
                    <option value={3}>3 Sittings</option>
                    <option value={4}>4 Sittings (Standard Cycle)</option>
                    <option value={5}>5 Sittings</option>
                    <option value={6}>6 Sittings (Full Course)</option>
                    <option value={8}>8 Sittings</option>
                    <option value={10}>10 Sittings</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Current Sitting #</Label>
                  <select
                    value={editCurrentSitting}
                    onChange={(e) => setEditCurrentSitting(parseInt(e.target.value) || 1)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {Array.from({ length: editTotalSittings }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>Sitting {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Interval Gap Between Each Sitting</Label>
                <select
                  value={editSittingInterval}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditSittingInterval(val);
                    if (val === '1 week') setEditSittingIntervalDays(7);
                    else if (val === '2 weeks') setEditSittingIntervalDays(14);
                    else if (val === '3 weeks') setEditSittingIntervalDays(21);
                    else if (val === '4 weeks' || val === '1 month') setEditSittingIntervalDays(28);
                    else if (val === '4-6 weeks') setEditSittingIntervalDays(35);
                    else if (val === '45 days') setEditSittingIntervalDays(45);
                    else if (val === '2 months') setEditSittingIntervalDays(60);
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="1 week">1 Week Gap (7 Days)</option>
                  <option value="2 weeks">2 Weeks Gap (14 Days - Peels/PRP)</option>
                  <option value="3 weeks">3 Weeks Gap (21 Days)</option>
                  <option value="4 weeks">4 Weeks Gap / 1 Month (28 Days - Laser/Facial)</option>
                  <option value="4-6 weeks">4-6 Weeks Gap (35 Days)</option>
                  <option value="45 days">45 Days Gap</option>
                  <option value="2 months">2 Months Gap (60 Days)</option>
                </select>
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-[11px] text-muted-foreground space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  AI Protocol Preview:
                </p>
                <p>Course: <strong>Sitting {editCurrentSitting} of {editTotalSittings}</strong></p>
                <p>Cadence: <strong>{editSittingInterval} gap</strong> ({editSittingIntervalDays} days)</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditProtocolAppt(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                  Save Sittings Protocol
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Complete Appointment & Shift to Follow-Ups Modal */}
      {completeApptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Mark Sitting Completed</h3>
                  <p className="text-[11px] text-muted-foreground">Shifts record into Follow-Up Section</p>
                </div>
              </div>
              <button onClick={() => setCompleteApptModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmComplete} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{completeApptModal.patient_name}</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{completeApptModal.department}</span>
                </div>
                <p className="text-muted-foreground font-mono">{completeApptModal.phone_number}</p>
                <p className="text-foreground pt-1">
                  Completed: <strong>{completeApptModal.sitting || `Sitting ${completeApptModal.current_sitting || 1} of ${completeApptModal.total_sittings || 4}`}</strong>
                </p>
              </div>

              {(completeApptModal.current_sitting || 1) < (completeApptModal.total_sittings || 4) && (
                <div className="space-y-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                    <Repeat className="h-4 w-4" />
                    <span>Next Sitting Schedule & Interval Gap</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Interval Gap for Sitting {(completeApptModal.current_sitting || 1) + 1}</Label>
                    <select
                      value={completeGapText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCompleteGapText(val);
                        let days = 14;
                        if (val === '1 week') days = 7;
                        else if (val === '2 weeks') days = 14;
                        else if (val === '3 weeks') days = 21;
                        else if (val === '4 weeks' || val === '1 month') days = 28;
                        else if (val === '4-6 weeks') days = 35;
                        else if (val === '45 days') days = 45;
                        else if (val === '2 months') days = 60;
                        setCompleteGapDays(days);
                        const nextTs = Date.now() + days * 86400000;
                        setCompleteNextDate(new Date(nextTs).toISOString().split('T')[0]);
                      }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="1 week">1 Week Gap (7 Days)</option>
                      <option value="2 weeks">2 Weeks Gap (14 Days)</option>
                      <option value="3 weeks">3 Weeks Gap (21 Days)</option>
                      <option value="4 weeks">4 Weeks Gap / 1 Month (28 Days)</option>
                      <option value="4-6 weeks">4-6 Weeks Gap (35 Days)</option>
                      <option value="45 days">45 Days Gap</option>
                      <option value="2 months">2 Months Gap (60 Days)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Calculated Next Sitting Target Date</Label>
                    <Input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={completeNextDate}
                      onChange={(e) => setCompleteNextDate(e.target.value)}
                      required
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-background/80 border border-border p-2.5 text-[11px] text-muted-foreground space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1">
                  <RefreshCcw className="h-3 w-3 text-primary" />
                  Follow-Up Section Actions Triggered:
                </p>
                <p>• Post-Care Recovery Check WhatsApp message generated for Dr. Mrinalini.</p>
                <p>• Next Sitting Due reminder queued with {completeGapText} interval gap.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setCompleteApptModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Confirm Complete & Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Status & Holiday Modal */}
      <DoctorStatusModal
        isOpen={isDoctorStatusOpen}
        onClose={() => setIsDoctorStatusOpen(false)}
        defaultDoctorId={selectedDoctorForStatus}
      />
    </div>
  );
}
