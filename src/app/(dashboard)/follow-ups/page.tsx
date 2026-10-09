"use client";

import { useState } from 'react';
import { useDemoState, FollowUpTask } from '@/hooks/use-demo-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  RefreshCcw, 
  Send, 
  CheckCircle2, 
  Clock, 
  Phone, 
  AlertCircle, 
  Sparkles, 
  Calendar,
  Layers,
  Repeat,
  Bot,
  Plus,
  X,
  Check,
  Settings2,
  Sliders,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  CalendarCheck,
  MapPin,
  CalendarClock,
  Loader2,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

type FollowUpStage = 'day_0_protocol' | 'week_prior' | 'two_days_prior' | 'previous_day_5pm';

export default function FollowUpsPage() {
  const { 
    followUps, 
    completeFollowUpTask, 
    deleteFollowUpTask,
    sendFollowUpWhatsApp, 
    addFollowUpTask,
    updateFollowUpSittings
  } = useDemoState();

  const [activeFilter, setActiveFilter] = useState<'All' | 'next_sitting_reminder' | 'post_care' | 'clinical_review' | 'completed_shifted'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedStageTab, setSelectedStageTab] = useState<FollowUpStage>('day_0_protocol');

  // Modal 1: Manual Sittings & Duration Configuration Modal
  const [editSittingsModal, setEditSittingsModal] = useState<FollowUpTask | null>(null);
  const [editTotalSittings, setEditTotalSittings] = useState<number>(4);
  const [editCurrentSitting, setEditCurrentSitting] = useState<number>(2);
  const [editIntervalGap, setEditIntervalGap] = useState<string>('1 month');
  const [editIntervalDays, setEditIntervalDays] = useState<number>(30);
  const [editNextDueDate, setEditNextDueDate] = useState<string>('');

  // Modal 2: Send WhatsApp Follow-up Message Modal
  const [sendWhatsAppModal, setSendWhatsAppModal] = useState<FollowUpTask | null>(null);
  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState<string>('');

  // New follow-up form state
  const [patientName, setPatientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState('Laser Hair Reduction');
  const [totalSittingsInput, setTotalSittingsInput] = useState<number>(4);
  const [intervalGapInput, setIntervalGapInput] = useState<string>('1 month');
  const [intervalDaysInput, setIntervalDaysInput] = useState<number>(30);
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High');

  const filteredTasks = followUps.filter(task => {
    let matchesFilter = true;
    if (activeFilter === 'completed_shifted') {
      matchesFilter = !!task.completed_at || (task.sitting_info || '').toLowerCase().includes('completed');
    } else if (activeFilter !== 'All') {
      matchesFilter = task.type === activeFilter;
    }

    const matchesSearch = task.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.phone_number.includes(searchTerm) ||
                          task.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (task.sitting_info || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStageMessage = (task: FollowUpTask, stage: FollowUpStage): string => {
    const mapsLink = "https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad";
    const sittings = task.total_sittings || 4;
    const interval = task.interval_gap || '1 month';

    switch (stage) {
      case 'day_0_protocol':
        return `Hello ${task.patient_name}, thank you for visiting La Fleur Clinic today. Dr. Mrinalini has prescribed a ${sittings}-sitting course for ${task.department} with a gap of ${interval} between each sitting. Would you like to reserve your next sitting slot in advance? Please reply with your preferred day and time.`;
      
      case 'week_prior':
        return `Hello ${task.patient_name}, gentle reminder from La Fleur Clinic: Your next sitting for ${task.department} is due in 1 week (as per your ${interval} interval plan with Dr. Mrinalini). Would you like to book your appointment slot for this upcoming week?`;

      case 'two_days_prior':
        return `Hello ${task.patient_name}, this is a quick follow-up from La Fleur Clinic. Your scheduled sitting for ${task.department} is due in 2 days. Reply to this message if you would like us to hold a consultation slot for you.`;

      case 'previous_day_5pm':
        return `Appointment Reminder (5:00 PM Update):\n\nDear ${task.patient_name}, your consultation with Dr. Mrinalini is scheduled for tomorrow at ${task.due || '11:30 AM'} for ${task.department}.\n\n• Pre-Care Guidance: Avoid active exfoliants, keep area clean, and stay hydrated.\n• Clinic Google Maps Location:\n${mapsLink}\nRoad No.11 B, Jubilee hills, Hyderabad - 500045.\n\nPlease reply CONFIRM to acknowledge.`;

      default:
        return task.whatsapp_message_content || `Dear ${task.patient_name}, Dr. Mrinalini is checking in regarding your ${task.department} follow-up.`;
    }
  };

  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const handleOpenSendWhatsApp = (task: FollowUpTask, stage: FollowUpStage = 'day_0_protocol') => {
    setSendWhatsAppModal(task);
    setCustomWhatsAppMsg(getStageMessage(task, stage));
  };

  const handleConfirmSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendWhatsAppModal) return;
    setSendingWhatsApp(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: sendWhatsAppModal.phone_number,
          name: sendWhatsAppModal.patient_name,
          message_type: 'text',
          content_text: customWhatsAppMsg,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'whatsapp_not_configured' || data.error?.includes('not configured')) {
          toast.info(`WhatsApp reminder queued for ${sendWhatsAppModal.patient_name}. (Connect Meta API in Settings for live WhatsApp delivery)`);
          sendFollowUpWhatsApp(sendWhatsAppModal.id, customWhatsAppMsg);
          setSendWhatsAppModal(null);
        } else {
          toast.error(data.error || 'Failed to dispatch WhatsApp follow-up');
        }
      } else {
        toast.success(`WhatsApp follow-up sent to ${sendWhatsAppModal.patient_name} (${sendWhatsAppModal.phone_number})!`);
        sendFollowUpWhatsApp(sendWhatsAppModal.id, customWhatsAppMsg);
        setSendWhatsAppModal(null);
      }
    } catch (err) {
      console.error('Follow-up WhatsApp error:', err);
      toast.success(`Follow-up reminder recorded for ${sendWhatsAppModal.patient_name}!`);
      sendFollowUpWhatsApp(sendWhatsAppModal.id, customWhatsAppMsg);
      setSendWhatsAppModal(null);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleOpenEditSittings = (task: FollowUpTask) => {
    setEditSittingsModal(task);
    setEditTotalSittings(task.total_sittings || 4);
    setEditCurrentSitting(task.current_sitting || 2);
    setEditIntervalGap(task.interval_gap || '1 month');
    setEditIntervalDays(task.interval_days || 30);
    
    let baseDueDate = task.due_date;
    if (!baseDueDate) {
      const days = task.interval_days || 30;
      baseDueDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    }
    setEditNextDueDate(baseDueDate);
  };

  const handleSaveEditSittings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSittingsModal) return;

    updateFollowUpSittings(editSittingsModal.id, {
      total_sittings: editTotalSittings,
      current_sitting: editCurrentSitting,
      interval_gap: editIntervalGap,
      interval_days: editIntervalDays,
      next_due_date: editNextDueDate,
      reason: `Sitting ${editCurrentSitting} of ${editTotalSittings} Due Nudge (${editIntervalGap} interval gap)`
    });

    toast.success(`Updated sittings protocol for ${editSittingsModal.patient_name} (${editTotalSittings} sittings, ${editIntervalGap} gap)!`);
    setEditSittingsModal(null);
  };

  const handleDeleteFollowUp = (id: string, name: string) => {
    deleteFollowUpTask(id);
    toast.success(`Deleted follow-up schedule for ${name}`);
  };

  const handleAutoTriggerAll = async () => {
    const pending = followUps.filter(f => f.status === 'Pending');
    if (pending.length === 0) {
      toast.info("All WhatsApp follow-ups and interval reminders are already sent!");
      return;
    }
    toast.info(`Dispatching ${pending.length} WhatsApp reminders via Meta API...`);
    let sentCount = 0;
    for (const p of pending) {
      const msg = p.whatsapp_message_content || getStageMessage(p, 'day_0_protocol');
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: p.phone_number,
            name: p.patient_name,
            message_type: 'text',
            content_text: msg,
          }),
        });
        if (res.ok) {
          sentCount++;
          sendFollowUpWhatsApp(p.id, msg);
        }
      } catch (err) {
        console.error('Auto trigger error for', p.patient_name, err);
      }
    }
    toast.success(`Dispatched ${sentCount} of ${pending.length} WhatsApp reminders via Meta API!`);
  };

  const handleCreateCustomFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phoneNumber.trim()) {
      toast.error("Please enter patient name and phone number.");
      return;
    }

    const nextTs = Date.now() + intervalDaysInput * 86400000;
    const calcDueDate = new Date(nextTs).toISOString().split('T')[0];

    addFollowUpTask({
      patient_name: patientName.trim(),
      phone_number: phoneNumber.trim(),
      department: department,
      sitting_info: `Sitting 2 of ${totalSittingsInput}`,
      reason: `Prescribed ${totalSittingsInput} sittings with ${intervalGapInput} gap`,
      type: 'next_sitting_reminder',
      due: `In ${intervalDaysInput} days`,
      due_date: calcDueDate,
      priority: priority,
      created_by: 'Doctor',
      total_sittings: totalSittingsInput,
      current_sitting: 2,
      interval_gap: intervalGapInput,
      interval_days: intervalDaysInput,
      whatsapp_message_content: `Hello ${patientName.trim()}, Dr. Mrinalini at La Fleur Clinic has prescribed a ${totalSittingsInput}-sitting course with ${intervalGapInput} gap. Would you like to schedule your next sitting?`
    });

    toast.success(`Follow-up protocol queued for ${patientName} (${totalSittingsInput} sittings, ${intervalGapInput} gap)!`);
    setPatientName('');
    setPhoneNumber('');
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <RefreshCcw className="h-6 w-6 text-primary" />
            Clinical Follow-Ups & Automated Reminder Engine
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Automated 4-stage reminder schedule (<strong>Day 0</strong>, <strong>-7 Days</strong>, <strong>-2 Days</strong>, and <strong>5:00 PM Pre-Care</strong> with Google Maps) for <strong>Dr. Mrinalini</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsAddOpen(true)}
            className="text-xs gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            Add Patient Sittings Schedule
          </Button>

          <Button 
            onClick={handleAutoTriggerAll}
            size="sm" 
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Trigger Due Reminders ({followUps.filter(f => f.status === 'Pending').length})
          </Button>
        </div>
      </div>

      {/* 4-Stage Automated Schedule Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-purple-500/5 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Doctor-Configured 4-Stage AI Reminder Flow</h2>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            Prescribed: Sittings (1–10) & Interval Gap (1 wk, 2 wks, 3 wks, 1 mo, 45d, 2 mo)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Stage 1: Day 0 */}
          <div className="p-3 rounded-xl bg-card border border-border space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary text-[11px] uppercase tracking-wider">Stage 1 • Day 0 (Today)</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <p className="font-semibold text-foreground text-xs">End of Today AI Nudge</p>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">
              States prescribed sittings (e.g. 4 sittings) & interval (e.g. 1 month) and asks if patient would like to book follow-up.
            </p>
          </div>

          {/* Stage 2: 1 Week Prior */}
          <div className="p-3 rounded-xl bg-card border border-border space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-600 dark:text-purple-400 text-[11px] uppercase tracking-wider">Stage 2 • 1 Week Prior</span>
              <span className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
            <p className="font-semibold text-foreground text-xs">-7 Days Follow-Up</p>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">
              If no prior response, AI follows up 1 week prior to the target due date to remind patient to lock in their slot.
            </p>
          </div>

          {/* Stage 3: 2 Days Prior */}
          <div className="p-3 rounded-xl bg-card border border-border space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px] uppercase tracking-wider">Stage 3 • 2 Days Prior</span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <p className="font-semibold text-foreground text-xs">-2 Days Final Nudge</p>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">
              Final reminder sent 2 days prior to the interval window; leaves decision to patient if not answered.
            </p>
          </div>

          {/* Stage 4: 5 PM Previous Day */}
          <div className="p-3 rounded-xl bg-card border border-border space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider">Stage 4 • 5:00 PM Eve</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="font-semibold text-foreground text-xs">Pre-Care & Maps Link</p>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">
              Sent at 5:00 PM previous day with confirmed time, clinic Google Maps link, and pre-care instructions.
            </p>
          </div>
        </div>
      </div>

      {/* Mini Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Active Schedules</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{followUps.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Next Sitting Due</p>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {followUps.filter(f => f.type === 'next_sitting_reminder').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">5 PM Pre-Care Queue</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {followUps.filter(f => f.type === 'post_care').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Consulting Specialist</p>
          <p className="mt-1 text-lg font-bold text-foreground flex items-center gap-1.5 truncate">
            <Stethoscope className="h-4 w-4 text-emerald-600" />
            Dr. Mrinalini
          </p>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search patient name, procedure, sitting, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-muted/40 border-border text-xs focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {[
            { key: 'All', label: 'All Schedules', count: followUps.length },
            { key: 'next_sitting_reminder', label: 'Next Sitting Due (Intervals)', count: followUps.filter(f => f.type === 'next_sitting_reminder').length },
            { key: 'post_care', label: '5 PM Pre-Care & Post-Care', count: followUps.filter(f => f.type === 'post_care').length },
            { key: 'completed_shifted', label: 'Shifted Completed', count: followUps.filter(f => !!f.completed_at || (f.sitting_info || '').toLowerCase().includes('completed')).length },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key as any)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === tab.key
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeFilter === tab.key
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-background text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Follow-Ups Data Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <Table className="min-w-[1150px] w-full text-xs">
          <TableHeader>
            <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-14 text-xs font-bold text-muted-foreground text-center">S.No</TableHead>
              <TableHead className="w-[200px] text-xs font-semibold text-muted-foreground px-4 py-3">Patient & Treatment</TableHead>
              <TableHead className="w-[150px] text-xs font-semibold text-muted-foreground px-4 py-3">WhatsApp Contact</TableHead>
              <TableHead className="w-[200px] text-xs font-semibold text-muted-foreground px-4 py-3">Sittings & Interval Gap</TableHead>
              <TableHead className="w-[240px] text-xs font-semibold text-muted-foreground px-4 py-3">Automated Reminders</TableHead>
              <TableHead className="w-[130px] text-xs font-semibold text-muted-foreground px-4 py-3">Due Target</TableHead>
              <TableHead className="w-[110px] text-xs font-semibold text-muted-foreground px-4 py-3">Status</TableHead>
              <TableHead className="w-[300px] text-xs font-semibold text-muted-foreground text-right px-4 py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCcw className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">No follow-ups found</p>
                    <p className="text-xs text-muted-foreground">Follow-ups are automatically generated when treatment sessions are completed.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task, idx) => {
                const isCompleted = task.status === 'Completed';
                const isSent = task.status === 'Sent (AI)';
                const isIntervalReminder = task.type === 'next_sitting_reminder';

                return (
                  <TableRow key={task.id} className={`border-border hover:bg-muted/30 transition-colors ${isCompleted ? 'opacity-50 bg-muted/20' : ''}`}>
                    {/* S.No Badge */}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center h-6 min-w-[28px] px-1.5 rounded-md bg-muted text-[11px] font-mono font-bold text-foreground border border-border/80">
                        #{idx + 1}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <p className={`text-xs font-bold text-foreground truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                          {task.patient_name}
                        </p>
                        <p className="text-[11px] text-primary font-medium truncate">{task.department}</p>
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-middle font-mono text-xs text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{task.phone_number}</span>
                      </div>
                    </TableCell>

                    {/* Sitting Context & Gap Duration */}
                    <TableCell className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold w-fit ${
                          isIntervalReminder
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        }`}>
                          <Repeat className="h-3 w-3 text-purple-600 dark:text-purple-400 shrink-0" />
                          {task.sitting_info || 'Sitting 2 of 4'}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground">
                          Interval Gap: <strong>{task.interval_gap || '1 month'}</strong> ({task.interval_days || 30} days)
                        </span>
                      </div>
                    </TableCell>

                    {/* Follow-up Goal & Reason */}
                    <TableCell className="px-4 py-3.5 align-middle max-w-[240px] whitespace-normal break-words">
                      <p className="text-xs font-medium text-foreground leading-relaxed">{task.reason}</p>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                        <Stethoscope className="h-3 w-3" /> Dr. Mrinalini
                      </span>
                    </TableCell>

                    {/* Due Timeline */}
                    <TableCell className="px-4 py-3.5 align-middle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        {task.due_date || task.due}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4 py-3.5 align-middle whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isCompleted
                          ? 'bg-muted text-muted-foreground'
                          : isSent
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                      }`}>
                        {isSent ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {task.status}
                      </span>
                    </TableCell>

                    {/* Outreach Actions & Stage Trigger */}
                    <TableCell className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Adjust Sittings */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 hover:border-primary hover:text-primary"
                          onClick={() => handleOpenEditSittings(task)}
                          title="Adjust sittings count and interval gap (e.g. 1 month, 45 days)"
                        >
                          <Settings2 className="h-3 w-3 text-primary" />
                          <span>Sittings</span>
                        </Button>

                        {/* Send Stage Message Dropdown / Button */}
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="h-7 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
                          onClick={() => handleOpenSendWhatsApp(task, 'day_0_protocol')}
                          title="Send Day 0 / Follow-up reminder via WhatsApp"
                        >
                          <Send className="h-3 w-3" />
                          <span>Send WA</span>
                        </Button>

                        {/* Complete Done */}
                        <Button 
                          size="sm" 
                          variant={isCompleted ? "ghost" : "outline"}
                          className={`h-7 text-[11px] gap-1 ${isCompleted ? 'text-muted-foreground' : 'text-foreground hover:border-primary shadow-2xs'}`}
                          onClick={() => {
                            completeFollowUpTask(task.id);
                            toast.success(`Marked follow-up for ${task.patient_name} as Done`);
                          }}
                          title="Mark task completed"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Done</span>
                        </Button>

                        {/* Delete Follow-Up Schedule */}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-7 px-2 text-[11px] gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md border border-rose-200/80 dark:border-rose-900/40 hover:border-rose-300 transition-colors font-medium"
                          onClick={() => handleDeleteFollowUp(task.id, task.patient_name)}
                          title="Delete this follow-up schedule permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          <span>Delete</span>
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

      {/* Modal 1: Manual Sittings & Interval Setup */}
      {editSittingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Set Sittings & Interval Gap</h3>
                  <p className="text-[11px] text-muted-foreground">Doctor-Prescribed Follow-Up Cadence</p>
                </div>
              </div>
              <button onClick={() => setEditSittingsModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSittings} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <p className="font-bold text-foreground text-sm">{editSittingsModal.patient_name}</p>
                <p className="text-muted-foreground font-mono">{editSittingsModal.phone_number}</p>
                <p className="text-primary font-medium">{editSittingsModal.department} • Dr. Mrinalini</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Dropdown 1: Number of Sittings */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Total Sittings Count</Label>
                  <select
                    value={editTotalSittings}
                    onChange={(e) => setEditTotalSittings(parseInt(e.target.value) || 1)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value={1}>1 Sitting (Single)</option>
                    <option value={2}>2 Sittings</option>
                    <option value={3}>3 Sittings</option>
                    <option value={4}>4 Sittings (Standard)</option>
                    <option value={5}>5 Sittings</option>
                    <option value={6}>6 Sittings (Full Course)</option>
                    <option value={8}>8 Sittings</option>
                    <option value={10}>10 Sittings</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Target Sitting #</Label>
                  <select
                    value={editCurrentSitting}
                    onChange={(e) => setEditCurrentSitting(parseInt(e.target.value) || 1)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    {Array.from({ length: editTotalSittings }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>Sitting {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dropdown 2: Interval Between Sittings */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Interval Between Sittings</Label>
                <select
                  value={editIntervalGap}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditIntervalGap(val);
                    let days = 30;
                    if (val === '1 week') days = 7;
                    else if (val === '2 weeks') days = 14;
                    else if (val === '3 weeks') days = 21;
                    else if (val === '1 month' || val === '4 weeks') days = 30;
                    else if (val === '45 days') days = 45;
                    else if (val === '2 months') days = 60;
                    setEditIntervalDays(days);
                    const nextTs = Date.now() + days * 86400000;
                    setEditNextDueDate(new Date(nextTs).toISOString().split('T')[0]);
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value="1 week">1 Week Gap</option>
                  <option value="2 weeks">2 Weeks Gap</option>
                  <option value="3 weeks">3 Weeks Gap</option>
                  <option value="1 month">1 Month Gap (30 Days)</option>
                  <option value="45 days">45 Days Gap</option>
                  <option value="2 months">2 Months Gap (60 Days)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Calculated Next Sitting Target Date</Label>
                <Input
                  type="date"
                  value={editNextDueDate}
                  onChange={(e) => setEditNextDueDate(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditSittingsModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                  Update Sittings Protocol
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Send WhatsApp Follow-Up with Stage Selection */}
      {sendWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Send WhatsApp Follow-Up / Reminder</h3>
                  <p className="text-[11px] text-muted-foreground">{sendWhatsAppModal.patient_name} • {sendWhatsAppModal.phone_number}</p>
                </div>
              </div>
              <button onClick={() => setSendWhatsAppModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Stage Template Selector */}
            <div className="mt-3.5 space-y-1.5">
              <Label className="text-xs font-semibold">Select Reminder Stage Template</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStageTab('day_0_protocol');
                    setCustomWhatsAppMsg(getStageMessage(sendWhatsAppModal, 'day_0_protocol'));
                  }}
                  className={`p-2 rounded-lg border text-left text-xs font-semibold transition-all ${
                    selectedStageTab === 'day_0_protocol'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                  }`}
                >
                  <p className="font-bold">1. Day 0 (Today)</p>
                  <p className="text-[10px] text-muted-foreground font-normal">Sittings & interval reminder</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStageTab('week_prior');
                    setCustomWhatsAppMsg(getStageMessage(sendWhatsAppModal, 'week_prior'));
                  }}
                  className={`p-2 rounded-lg border text-left text-xs font-semibold transition-all ${
                    selectedStageTab === 'week_prior'
                      ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                      : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                  }`}
                >
                  <p className="font-bold">2. -7 Days Prior</p>
                  <p className="text-[10px] text-muted-foreground font-normal">1 week prior slot nudge</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStageTab('two_days_prior');
                    setCustomWhatsAppMsg(getStageMessage(sendWhatsAppModal, 'two_days_prior'));
                  }}
                  className={`p-2 rounded-lg border text-left text-xs font-semibold transition-all ${
                    selectedStageTab === 'two_days_prior'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                      : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                  }`}
                >
                  <p className="font-bold">3. -2 Days Prior</p>
                  <p className="text-[10px] text-muted-foreground font-normal">Final interval reminder</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStageTab('previous_day_5pm');
                    setCustomWhatsAppMsg(getStageMessage(sendWhatsAppModal, 'previous_day_5pm'));
                  }}
                  className={`p-2 rounded-lg border text-left text-xs font-semibold transition-all ${
                    selectedStageTab === 'previous_day_5pm'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                  }`}
                >
                  <p className="font-bold">4. 5:00 PM Eve</p>
                  <p className="text-[10px] text-muted-foreground font-normal">Pre-care & Google Map</p>
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirmSendWhatsApp} className="space-y-3.5 mt-3 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Message Preview (Editable)</Label>
                <textarea
                  rows={5}
                  value={customWhatsAppMsg}
                  onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setSendWhatsAppModal(null)} disabled={sendingWhatsApp}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={sendingWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5">
                  {sendingWhatsApp ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending via Meta API...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send via WhatsApp AI</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Custom Patient Sittings Schedule */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Add Patient Sittings Schedule</h3>
                  <p className="text-[11px] text-muted-foreground">Setup automated follow-up reminders</p>
                </div>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomFollowUp} className="space-y-3.5 mt-4 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Patient Name</Label>
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">WhatsApp Number</Label>
                <Input
                  placeholder="e.g. +91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Treatment Procedure</Label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value="Laser Hair Reduction">Laser Hair Reduction</option>
                  <option value="PRP Hair Therapy & Scalp Restoration">PRP Hair Therapy</option>
                  <option value="HydraFacial Deluxe">HydraFacial Deluxe</option>
                  <option value="Pigmentation & Chemical Peels">Pigmentation & Peels</option>
                  <option value="Skin Tightening (RF / MNRF)">Skin Tightening (RF/MNRF)</option>
                  <option value="Anti-Aging & Botox">Anti-Aging & Botox</option>
                  <option value="Body Contouring & Cellulite Reduction">Body Contouring</option>
                </select>
              </div>

              {/* Two Dropdowns for Sittings & Gap */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Total Sittings</Label>
                  <select
                    value={totalSittingsInput}
                    onChange={(e) => setTotalSittingsInput(parseInt(e.target.value) || 1)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-0.5 text-xs shadow-xs"
                  >
                    <option value={1}>1 Sitting</option>
                    <option value={2}>2 Sittings</option>
                    <option value={3}>3 Sittings</option>
                    <option value={4}>4 Sittings</option>
                    <option value={5}>5 Sittings</option>
                    <option value={6}>6 Sittings</option>
                    <option value={8}>8 Sittings</option>
                    <option value={10}>10 Sittings</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Interval Gap</Label>
                  <select
                    value={intervalGapInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIntervalGapInput(val);
                      let days = 30;
                      if (val === '1 week') days = 7;
                      else if (val === '2 weeks') days = 14;
                      else if (val === '3 weeks') days = 21;
                      else if (val === '1 month') days = 30;
                      else if (val === '45 days') days = 45;
                      else if (val === '2 months') days = 60;
                      setIntervalDaysInput(days);
                    }}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-0.5 text-xs shadow-xs"
                  >
                    <option value="1 week">1 Week</option>
                    <option value="2 weeks">2 Weeks</option>
                    <option value="3 weeks">3 Weeks</option>
                    <option value="1 month">1 Month (30d)</option>
                    <option value="45 days">45 Days</option>
                    <option value="2 months">2 Months (60d)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Queue AI Reminder Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
