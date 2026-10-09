"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  AlertCircle, 
  ShieldAlert, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  UserCheck, 
  CheckCircle2,
  Send,
  Sparkles,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  Volume2,
  VolumeX,
  BellRing,
  ExternalLink,
  Check,
  Inbox,
  Plus
} from 'lucide-react';
import { emergencyAudio } from '@/lib/audio/emergency-audio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface EscalationAlert {
  id: string;
  conversation_id?: string;
  contact_id?: string;
  patient_name: string;
  patient_phone: string;
  doctor_name?: string;
  doctor_phone?: string;
  department?: string;
  severity: 'CRITICAL' | 'URGENT' | 'HIGH' | string;
  emergency_text: string;
  reason?: string;
  status: 'ACTIVE' | 'DOCTOR_ALERTED' | 'DOCTOR_REPLIED' | 'RESOLVED';
  doctor_replies_count?: number;
  last_doctor_reply_text?: string;
  last_doctor_reply_at?: string;
  created_at: string;
}

export default function EscalationsPage() {
  const [alerts, setAlerts] = useState<EscalationAlert[]>([]);
  const [relaySessions, setRelaySessions] = useState<EscalationAlert[]>([]);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'relay'>('alerts');
  const [doctorReplyText, setDoctorReplyText] = useState('');
  const [selectedRelayId, setSelectedRelayId] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [alarmState, setAlarmState] = useState(emergencyAudio.getState());

  // Listen to audio alarm state
  useEffect(() => {
    const unsubscribe = emergencyAudio.subscribe((state) => {
      setAlarmState(state);
    });
    return unsubscribe;
  }, []);

  // Fetch real-time escalations from API
  const fetchEscalations = useCallback(async (showLoading = false) => {
    if (showLoading) setIsSyncing(true);
    try {
      const res = await fetch('/api/escalations');
      const data = await res.json();
      if (data && data.ok) {
        const liveAlerts: EscalationAlert[] = data.alerts || [];
        const liveRelays: EscalationAlert[] = data.relaySessions || [];
        setAlerts(liveAlerts);
        setRelaySessions(liveRelays);

        if (!selectedRelayId && liveRelays.length > 0) {
          setSelectedRelayId(liveRelays[0].id);
        }

        // Automatic Emergency Alarm Trigger:
        // If there are active critical/urgent alerts not yet resolved and alarm is not running, trigger alarm
        const activeUnresolved = liveAlerts.filter(a => a.status !== 'RESOLVED' && !resolvedIds.includes(a.id));
        if (activeUnresolved.length > 0) {
          const topAlert = activeUnresolved[0];
          if (!emergencyAudio.getState().isRunning) {
            emergencyAudio.startAlarm(
              topAlert.id, 
              `🚨 URGENT CASE: ${topAlert.patient_name} (${topAlert.patient_phone}) — ${topAlert.emergency_text}`
            );
          }
        } else if (emergencyAudio.getState().isRunning) {
          // If no active cases remain, automatically silence the alarm
          emergencyAudio.stopAlarm();
        }
      }
    } catch (err) {
      console.warn('[Fetch Escalations Notice]:', err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [selectedRelayId, resolvedIds]);

  // Initial fetch and 4s polling
  useEffect(() => {
    fetchEscalations(true);
    const interval = setInterval(() => {
      fetchEscalations(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchEscalations]);

  // Manual alarm toggle for testing audio
  const handleToggleAlarmTest = () => {
    if (alarmState.isRunning) {
      emergencyAudio.stopAlarm();
      toast.info('Emergency alarm sound silenced');
    } else {
      const activeUnresolved = alerts.filter(a => a.status !== 'RESOLVED' && !resolvedIds.includes(a.id));
      const targetAlert = activeUnresolved[0];
      const alertId = targetAlert ? targetAlert.id : 'test-alarm-1';
      const alertText = targetAlert 
        ? `🚨 URGENT CASE: ${targetAlert.patient_name} (${targetAlert.patient_phone}) — ${targetAlert.emergency_text}`
        : `🚨 LIVE CLINICAL EMERGENCY ALARM: Active monitoring test beep running.`;
      
      emergencyAudio.startAlarm(alertId, alertText);
      toast.warning('Emergency alarm audio is now playing continuous beeps');
    }
  };

  // Resolve an escalation alert
  const handleResolve = async (id: string, patientName: string) => {
    setResolvedIds(prev => [...prev, id]);
    emergencyAudio.stopAlarm(id);

    try {
      const res = await fetch('/api/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id })
      });
      const data = await res.json();
      if (data && data.ok) {
        toast.success(`Emergency alert for ${patientName} marked as resolved & silenced.`);
        fetchEscalations(false);
      } else {
        toast.error(data.error || 'Failed to update alert status');
      }
    } catch {
      toast.error('Network error resolving alert');
    }
  };

  // Create a live test emergency
  const handleCreateTestEmergency = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_test',
          testData: {
            patientName: 'Priya Sharma (Live WhatsApp)',
            patientPhone: '+91 98765 43210',
            emergencyText: 'URGENT: Experiencing sudden severe skin redness & burning sensation after treatment. Need immediate guidance!',
            severity: 'CRITICAL',
            doctorName: 'Dr. Mrinalini'
          }
        })
      });
      const data = await res.json();
      if (data && data.ok) {
        toast.warning('Live Emergency Alert created! Alarm sound activated.');
        fetchEscalations(true);
      } else {
        toast.error(data.error || 'Failed to trigger test alert');
      }
    } catch {
      toast.error('Failed to connect to server');
    } finally {
      setIsSyncing(false);
    }
  };

  // Send doctor reply in WhatsApp Relay
  const handleSendDoctorReply = async (sessionId: string) => {
    if (!doctorReplyText.trim()) {
      toast.error('Please type a guidance message to send to the patient');
      return;
    }

    setIsSendingReply(true);
    try {
      const res = await fetch('/api/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'relay_reply',
          id: sessionId,
          replyText: doctorReplyText.trim()
        })
      });
      const data = await res.json();
      if (data && data.ok) {
        toast.success('Clinical guidance delivered directly to patient on WhatsApp!');
        setDoctorReplyText('');
        fetchEscalations(false);
      } else {
        toast.error(data.error || 'Failed to deliver relay message');
      }
    } catch {
      toast.error('Network error sending WhatsApp relay');
    } finally {
      setIsSendingReply(false);
    }
  };

  const activeAlerts = alerts.filter(a => a.status !== 'RESOLVED' && !resolvedIds.includes(a.id));
  const activeRelaySessions = relaySessions.filter(r => r.status !== 'RESOLVED' && !resolvedIds.includes(r.id));
  const activeSession = relaySessions.find(s => s.id === selectedRelayId) || activeRelaySessions[0] || relaySessions[0];

  const formatTimeAgo = (iso: string) => {
    try {
      const ms = Date.now() - new Date(iso).getTime();
      const mins = Math.max(1, Math.floor(ms / 60000));
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <AlertTriangle className={`h-6 w-6 ${activeAlerts.length > 0 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-primary'}`} />
            Urgent Clinical Escalations & WhatsApp Emergency Relay
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time emergency detection: when patients message symptoms or emergencies on WhatsApp, the CRM alerts the on-duty doctor and plays an audible alarm beep until acknowledged.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh / Sync button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchEscalations(true)}
            disabled={isSyncing}
            className="h-8 text-xs font-semibold gap-1.5 shadow-xs border-border hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Live
          </Button>

          {/* Sound Alarm Test / Silence Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleAlarmTest}
            className={`h-8 text-xs font-semibold gap-1.5 shadow-xs transition-all ${
              alarmState.isRunning
                ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700 animate-pulse'
                : 'border-border text-foreground hover:bg-muted'
            }`}
          >
            {alarmState.isRunning ? (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                Silence Sound Alarm
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                Test Alarm Sound (Beep Loop)
              </>
            )}
          </Button>

          {/* Live Cases Badge */}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
            activeAlerts.length > 0
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
          }`}>
            <span className={`h-2 w-2 rounded-full ${activeAlerts.length > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
            {activeAlerts.length} Active Urgent Cases
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Zap className="h-3 w-3" />
            Doctor WhatsApp Relay Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Clinical Alerts ({activeAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('relay')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'relay'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Live Doctor-Patient WhatsApp Relay ({activeRelaySessions.length})
          </button>
        </div>

        {/* Simulate Test Case Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateTestEmergency}
          disabled={isSyncing}
          className="h-8 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground border-border hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5 text-rose-500" />
          Simulate Test Emergency
        </Button>
      </div>

      {activeTab === 'alerts' ? (
        /* Alerts View */
        activeAlerts.length === 0 ? (
          /* Empty State - All Clear */
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-500/20">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">All Clear — No Active Urgent Clinical Escalations</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1.5">
              The AI Receptionist is actively monitoring WhatsApp messages 24/7 for acute symptoms, bleeding, severe burning, or urgent inquiries. Live cases will appear here with an automatic audible alarm.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="sm"
                onClick={handleCreateTestEmergency}
                className="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-2"
              >
                <Plus className="h-4 w-4" />
                Simulate Live Test Emergency
              </Button>
              <Link href="/inbox">
                <Button size="sm" variant="outline" className="h-9 px-4 text-xs font-semibold border-border hover:bg-muted gap-2">
                  <Inbox className="h-4 w-4 text-primary" />
                  View WhatsApp Inbox
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Live Escalations Table */
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
            <Table className="w-full text-xs">
              <TableHeader>
                <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[18%] text-xs font-semibold text-muted-foreground px-3 py-3">Patient & Contact</TableHead>
                  <TableHead className="w-[13%] text-xs font-semibold text-muted-foreground px-2 py-3">Severity / Urgency</TableHead>
                  <TableHead className="w-[28%] text-xs font-semibold text-muted-foreground px-3 py-3">Flagged AI Symptom Alert</TableHead>
                  <TableHead className="w-[17%] text-xs font-semibold text-muted-foreground px-2 py-3">Doctor Assigned & Relay</TableHead>
                  <TableHead className="w-[10%] text-xs font-semibold text-muted-foreground px-2 py-3">Status / SLA</TableHead>
                  <TableHead className="w-[14%] text-xs font-semibold text-muted-foreground text-right px-3 py-3">Intervention Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAlerts.map((esc) => {
                  const isResolved = resolvedIds.includes(esc.id);
                  const isCritical = esc.severity === 'CRITICAL' || esc.severity.includes('Emergency');
                  const cleanPhone = esc.patient_phone.replace(/\D/g, '');

                  return (
                    <TableRow 
                      key={esc.id} 
                      className={`border-border hover:bg-muted/40 transition-colors ${
                        isResolved ? 'opacity-40 bg-muted/20' : isCritical ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      {/* Patient Column */}
                      <TableCell className="px-3 py-3 align-middle whitespace-normal">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border ${
                            isCritical 
                              ? 'bg-rose-500/15 text-rose-600 border-rose-500/30' 
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}>
                            {(esc.patient_name || 'PT').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {esc.patient_name}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground">{esc.patient_phone}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Severity Column */}
                      <TableCell className="px-2 py-3 align-middle whitespace-normal">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {esc.severity || 'URGENT'}
                        </span>
                      </TableCell>

                      {/* Flagged AI Symptom Alert Column */}
                      <TableCell className="px-3 py-3 align-middle whitespace-normal">
                        <div className="space-y-0.5">
                          <p className="text-xs text-foreground font-medium leading-snug break-words">
                            {esc.emergency_text}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-semibold text-primary">{esc.department || 'Urgent Care'}</span> • {formatTimeAgo(esc.created_at)}
                          </p>
                        </div>
                      </TableCell>

                      {/* Doctor Assigned & Relay Column */}
                      <TableCell className="px-2 py-3 align-middle whitespace-normal">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <UserCheck className="h-3 w-3 text-primary shrink-0" />
                            <span className="break-words leading-tight">{esc.doctor_name || 'Dr. Mrinalini'}</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedRelayId(esc.id);
                              setActiveTab('relay');
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/20 transition-colors cursor-pointer"
                            title="Click to view live WhatsApp relay"
                          >
                            <Zap className="h-2.5 w-2.5 shrink-0" />
                            WhatsApp Relay Live
                          </button>
                        </div>
                      </TableCell>

                      {/* SLA Window Column */}
                      <TableCell className="px-2 py-3 align-middle whitespace-normal">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 whitespace-nowrap">
                          <Clock className="h-3 w-3 shrink-0" />
                          Immediate
                        </span>
                      </TableCell>

                      {/* Actions Column */}
                      <TableCell className="px-3 py-3 align-middle whitespace-normal text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {cleanPhone && (
                            <a href={`tel:${cleanPhone}`}>
                              <Button
                                size="sm"
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] gap-1 shadow-xs shrink-0 font-medium"
                              >
                                <PhoneCall className="h-3 w-3" />
                                Call
                              </Button>
                            </a>
                          )}
                          <Link href={esc.conversation_id ? `/inbox?conversationId=${esc.conversation_id}` : '/inbox'}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px] gap-1 border-border text-foreground hover:bg-muted shrink-0 font-medium"
                            >
                              <MessageSquare className="h-3 w-3 text-primary" />
                              Chat
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[11px] shrink-0 font-bold bg-white text-rose-600 hover:bg-rose-50 border-rose-200"
                            onClick={() => handleResolve(esc.id, esc.patient_name)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-0.5 text-rose-600" />
                            Resolve & Silence
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      ) : (
        /* Emergency Relay Live Inspector */
        activeRelaySessions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-500/20">
              <Zap className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Doctor-Patient WhatsApp Relay Ready</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1.5">
              When a patient reports a medical concern on WhatsApp, the system automatically alerts the doctor and relays direct doctor instructions to the patient's phone.
            </p>
            <div className="mt-6">
              <Button
                size="sm"
                onClick={handleCreateTestEmergency}
                className="h-9 px-4 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm gap-2"
              >
                <Zap className="h-4 w-4" />
                Launch Test Relay Session
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Relay List */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active WhatsApp Relay Sessions ({activeRelaySessions.length})
              </h2>
              <div className="space-y-2">
                {activeRelaySessions.map((session) => {
                  const isSelected = session.id === (activeSession?.id || selectedRelayId);
                  return (
                    <button
                      key={session.id}
                      onClick={() => setSelectedRelayId(session.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-bold text-foreground">{session.patient_name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{formatTimeAgo(session.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {session.emergency_text}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px]">
                        <span className="text-primary font-medium">{session.doctor_name || 'Dr. Mrinalini'}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {session.doctor_replies_count || 0} relayed
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Session Conversation & Live Reply Box */}
            {activeSession && (
              <div className="lg:col-span-8 rounded-xl border border-border bg-card flex flex-col shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      {(activeSession.patient_name || 'PT').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{activeSession.patient_name}</h3>
                        <span className="text-xs text-muted-foreground font-mono">{activeSession.patient_phone}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Doctor Assigned: <span className="font-semibold text-primary">{activeSession.doctor_name || 'Dr. Mrinalini'}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(activeSession.id, activeSession.patient_name)}
                    className="h-8 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
                    Mark Resolved
                  </Button>
                </div>

                <div className="p-5 space-y-4 flex-1 overflow-y-auto max-h-[380px]">
                  {/* Patient Inbound Emergency Message */}
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                      PT
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-foreground">
                      <p className="font-semibold text-rose-600 dark:text-rose-400 text-[11px] mb-1">
                        Patient Emergency WhatsApp Inquiry ({formatTimeAgo(activeSession.created_at)})
                      </p>
                      <p className="leading-relaxed whitespace-pre-wrap">{activeSession.emergency_text}</p>
                    </div>
                  </div>

                  {/* Doctor Relayed Reply */}
                  {activeSession.last_doctor_reply_text ? (
                    <div className="flex items-start justify-end gap-3">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-foreground text-right">
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px] mb-1">
                          Relayed to Patient WhatsApp ({formatTimeAgo(activeSession.last_doctor_reply_at || activeSession.created_at)})
                        </p>
                        <p className="leading-relaxed whitespace-pre-wrap text-left">{activeSession.last_doctor_reply_text}</p>
                      </div>
                      <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                        DR
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/40 border border-border rounded-xl text-center text-xs text-muted-foreground">
                      Doctor has been alerted on WhatsApp. Type clinical guidance below to dispatch an immediate reply directly to the patient's phone.
                    </div>
                  )}
                </div>

                {/* Direct Doctor Reply Box */}
                <div className="p-4 border-t border-border bg-muted/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Type clinical guidance from ${activeSession.doctor_name || 'Dr. Mrinalini'} to relay directly to patient WhatsApp...`}
                      value={doctorReplyText}
                      onChange={(e) => setDoctorReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendDoctorReply(activeSession.id);
                        }
                      }}
                      className="text-xs bg-card"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSendDoctorReply(activeSession.id)}
                      disabled={isSendingReply || !doctorReplyText.trim()}
                      className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Relay WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
