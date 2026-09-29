"use client";

import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  ShieldAlert, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  UserCheck, 
  CheckCircle2,
  Activity,
  Send,
  Sparkles,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  Bot,
  Volume2,
  VolumeX,
  BellRing
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

interface EmergencyRelayItem {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorPhone: string;
  emergencyText: string;
  patientTime: string;
  doctorReplies: {
    text: string;
    time: string;
    status: 'relayed_to_patient' | 'sent';
  }[];
  status: 'active' | 'resolved';
}

export default function EscalationsPage() {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'relay'>('alerts');
  const [simDoctorReply, setSimDoctorReply] = useState('');
  const [selectedRelayId, setSelectedRelayId] = useState<string>('relay-1');
  const [alarmState, setAlarmState] = useState(emergencyAudio.getState());

  useEffect(() => {
    const unsubscribe = emergencyAudio.subscribe((state) => {
      setAlarmState(state);
    });
    return unsubscribe;
  }, []);

  const [relaySessions, setRelaySessions] = useState<EmergencyRelayItem[]>([
    {
      id: "relay-1",
      patientName: "Vikram Malhotra",
      patientPhone: "+91 98991 22334",
      doctorName: "Dr. Rajesh Gupta",
      doctorPhone: "+91 98765 43210",
      emergencyText: "URGENT: Experiencing sudden severe rash and burning sensation 2 hours after chemical peel session!",
      patientTime: "12:32 PM",
      status: "active",
      doctorReplies: [
        {
          text: "Wash face gently with cool running water immediately. Apply the prescribed soothing barrier cream liberally and avoid sunlight. I am reviewing your chart now and will call you in 5 mins.",
          time: "12:35 PM",
          status: "relayed_to_patient"
        }
      ]
    },
    {
      id: "relay-2",
      patientName: "Meenakshi Sundaram",
      patientPhone: "+91 98112 33445",
      doctorName: "Dr. Shalini Roy",
      doctorPhone: "+91 98765 43211",
      emergencyText: "Bleeding slightly from scalp injection sites after today's PRP session. Is this normal?",
      patientTime: "11:45 AM",
      status: "active",
      doctorReplies: [
        {
          text: "Mild pin-prick spotting can occur for 2-3 hours. Please use a clean sterile gauze and apply gentle firm pressure for 5 minutes. Do not rub or wash scalp today. Let me know if spotting persists.",
          time: "11:48 AM",
          status: "relayed_to_patient"
        }
      ]
    }
  ]);

  const escalations = [
    {
      id: "esc-1",
      patient: "Vikram Malhotra",
      phone: "+91 98991 22334",
      alert: "Reported sudden severe rash & burning sensation post-peel via WhatsApp",
      severity: "Emergency (Red)",
      sla: "Immediate",
      department: "Dermatology / Emergency",
      time: "4 mins ago",
      assignedTo: "Dr. Rajesh Gupta (ER On-Duty)",
      relayActive: true
    },
    {
      id: "esc-2",
      patient: "Aarti Mehra",
      phone: "+91 97110 55667",
      alert: "High grade fever (103.5°F) in 2-year old infant unresponsive to paracetamol",
      severity: "Urgent (Yellow)",
      sla: "10 mins remaining",
      department: "Pediatrics",
      time: "14 mins ago",
      assignedTo: "Dr. Shalini Roy",
      relayActive: false
    },
    {
      id: "esc-3",
      patient: "Kiran Bedi",
      phone: "+91 96554 11223",
      alert: "Post-surgery wound bleeding inquiry; patient anxious",
      severity: "High Priority",
      sla: "25 mins remaining",
      department: "Orthopedics",
      time: "32 mins ago",
      assignedTo: "Dr. Vikrant Seth",
      relayActive: false
    }
  ];

  const handleResolve = (id: string) => {
    setResolvedIds(prev => {
      const next = [...prev, id];
      // If resolving the emergency case or all active cases, stop the alarm
      emergencyAudio.stopAlarm(id);
      return next;
    });
  };

  const handleToggleAlarmTest = () => {
    if (alarmState.isRunning) {
      emergencyAudio.stopAlarm();
    } else {
      emergencyAudio.startAlarm("esc-1", "🚨 ACTIVE EMERGENCY: Vikram Malhotra — Reported severe burning & rash post-peel via WhatsApp!");
    }
  };

  const handleSendDoctorReply = (sessionId: string) => {
    if (!simDoctorReply.trim()) return;

    setRelaySessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          doctorReplies: [
            ...s.doctorReplies,
            {
              text: simDoctorReply.trim(),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'relayed_to_patient'
            }
          ]
        };
      }
      return s;
    }));

    setSimDoctorReply('');
  };

  const activeSession = relaySessions.find(s => s.id === selectedRelayId) || relaySessions[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400 animate-pulse" />
            Urgent Clinical Escalations & WhatsApp Emergency Relay
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time emergency detection: when patients message an emergency on WhatsApp, the CRM alerts the on-duty doctor and plays an audible alarm beep until the clinical team checks and handles the alert.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            {escalations.filter(e => !resolvedIds.includes(e.id)).length} Active Urgent Cases
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Zap className="h-3 w-3" />
            Doctor WhatsApp Relay Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'alerts'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Clinical Alerts ({escalations.filter(e => !resolvedIds.includes(e.id)).length})
        </button>
        <button
          onClick={() => setActiveTab('relay')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'relay'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Live Doctor-Patient WhatsApp Relay ({relaySessions.length})
        </button>
      </div>

      {activeTab === 'alerts' ? (
        /* Escalations Table */
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <Table className="w-full text-xs">
            <TableHeader>
              <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[18%] text-xs font-semibold text-muted-foreground px-3 py-3">Patient & Contact</TableHead>
                <TableHead className="w-[13%] text-xs font-semibold text-muted-foreground px-2 py-3">Severity / Urgency</TableHead>
                <TableHead className="w-[28%] text-xs font-semibold text-muted-foreground px-3 py-3">Flagged AI Symptom Alert</TableHead>
                <TableHead className="w-[17%] text-xs font-semibold text-muted-foreground px-2 py-3">Doctor Assigned & Relay</TableHead>
                <TableHead className="w-[10%] text-xs font-semibold text-muted-foreground px-2 py-3">SLA Window</TableHead>
                <TableHead className="w-[14%] text-xs font-semibold text-muted-foreground text-right px-3 py-3">Intervention Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escalations.map((esc) => {
                const isResolved = resolvedIds.includes(esc.id);
                const isEmergency = esc.severity.includes('Emergency');
                return (
                  <TableRow 
                    key={esc.id} 
                    className={`border-border hover:bg-muted/40 transition-colors ${
                      isResolved ? 'opacity-40 bg-muted/20' : isEmergency ? 'bg-rose-500/5' : ''
                    }`}
                  >
                    {/* Patient Column */}
                    <TableCell className="px-3 py-3 align-middle whitespace-normal">
                      <div className="flex items-center gap-2">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                          isEmergency 
                            ? 'bg-rose-500/15 text-rose-600 border-rose-500/30' 
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {esc.patient.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold text-foreground truncate ${isResolved ? 'line-through text-muted-foreground' : ''}`}>
                            {esc.patient}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground">{esc.phone}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Severity Column */}
                    <TableCell className="px-2 py-3 align-middle whitespace-normal">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                        isEmergency
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}>
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {esc.severity}
                      </span>
                    </TableCell>

                    {/* Flagged AI Symptom Alert Column */}
                    <TableCell className="px-3 py-3 align-middle whitespace-normal">
                      <div className="space-y-0.5">
                        <p className="text-xs text-foreground font-medium leading-snug break-words">
                          {esc.alert}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-primary">{esc.department}</span> • {esc.time}
                        </p>
                      </div>
                    </TableCell>

                    {/* Doctor Assigned & Relay Column */}
                    <TableCell className="px-2 py-3 align-middle whitespace-normal">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                          <UserCheck className="h-3 w-3 text-primary shrink-0" />
                          <span className="break-words leading-tight">{esc.assignedTo}</span>
                        </div>
                        {esc.relayActive && (
                          <button
                            onClick={() => {
                              setSelectedRelayId('relay-1');
                              setActiveTab('relay');
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/20 transition-colors cursor-pointer"
                            title="Click to view live WhatsApp relay"
                          >
                            <Zap className="h-2.5 w-2.5 shrink-0" />
                            WhatsApp Relay Live
                          </button>
                        )}
                      </div>
                    </TableCell>

                    {/* SLA Window Column */}
                    <TableCell className="px-2 py-3 align-middle whitespace-normal">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 whitespace-nowrap">
                        <Clock className="h-3 w-3 shrink-0" />
                        {esc.sla}
                      </span>
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell className="px-3 py-3 align-middle whitespace-normal text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                        {esc.relayActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shrink-0 font-medium"
                            onClick={() => {
                              setSelectedRelayId('relay-1');
                              setActiveTab('relay');
                            }}
                          >
                            <MessageSquare className="h-3 w-3" />
                            Relay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] gap-1 shadow-xs shrink-0 font-medium"
                          disabled={isResolved}
                        >
                          <PhoneCall className="h-3 w-3" />
                          Call
                        </Button>
                        <Button
                          size="sm"
                          variant={isResolved ? "ghost" : "outline"}
                          className="h-7 px-2 text-[11px] shrink-0 font-medium"
                          onClick={() => handleResolve(esc.id)}
                          disabled={isResolved}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-0.5" />
                          {isResolved ? "Done" : "Ack"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Emergency Relay Live Inspector & Simulator */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Relay List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active WhatsApp Relay Sessions
            </h2>
            <div className="space-y-2">
              {relaySessions.map((session) => {
                const isSelected = session.id === selectedRelayId;
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedRelayId(session.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-foreground">{session.patientName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{session.patientTime}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {session.emergencyText}
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px]">
                      <span className="text-primary font-medium">{session.doctorName}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {session.doctorReplies.length} reply relayed
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Protocol Explanation Card */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                How WhatsApp Emergency Relay Works
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-[11px] leading-relaxed">
                <li><strong className="text-foreground">Patient:</strong> Sends an urgent symptom message on WhatsApp.</li>
                <li><strong className="text-foreground">CRM AI:</strong> Detects clinical emergency keywords and alerts on-duty doctor on their WhatsApp instantly.</li>
                <li><strong className="text-foreground">Doctor:</strong> Replies directly via WhatsApp with clinical guidance.</li>
                <li><strong className="text-foreground">Webhook Engine:</strong> Intercepts doctor reply and delivers it to patient under the official Clinic identity.</li>
              </ol>
            </div>
          </div>

          {/* Real-time Relay Flow Visualizer */}
          <div className="lg:col-span-8 rounded-xl border border-border bg-card shadow-xs p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  Relay Flow: {activeSession.patientName} ↔ {activeSession.doctorName}
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Patient Phone: <span className="font-mono text-foreground">{activeSession.patientPhone}</span> • Doctor Phone: <span className="font-mono text-foreground">{activeSession.doctorPhone}</span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Zap className="h-3 w-3" /> Live Synced
              </span>
            </div>

            {/* Visual Message Stream */}
            <div className="space-y-4 bg-muted/10 p-4 rounded-xl border border-border/60 min-h-[260px]">
              {/* Step 1: Patient Inbound */}
              <div className="flex gap-3 items-start">
                <div className="h-7 w-7 rounded-full bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0 font-bold text-xs border border-rose-500/30">
                  P
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{activeSession.patientName} (Patient)</span>
                    <span className="text-[10px] text-muted-foreground">{activeSession.patientTime}</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 text-[9px] font-bold">EMERGENCY DETECTED</span>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-rose-500/30 text-xs text-foreground max-w-md shadow-xs">
                    {activeSession.emergencyText}
                  </div>
                </div>
              </div>

              {/* Step 2: System Auto Reassurance to Patient */}
              <div className="flex gap-3 items-start pl-6">
                <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Clinic AI Auto-Reassurance</span>
                    <span className="text-[10px] text-muted-foreground">Immediate</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground max-w-md italic">
                    "⚠️ Urgent message noted. We have dispatched an immediate alert to our on-duty doctor ({activeSession.doctorName}). If you have life-threatening distress, call emergency services (112/108) immediately."
                  </div>
                </div>
              </div>

              {/* Step 3: Dispatched to Doctor's WhatsApp */}
              <div className="flex gap-3 items-start pl-6">
                <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">WhatsApp Alert Sent to {activeSession.doctorName}</span>
                    <span className="text-[10px] text-muted-foreground">Immediate</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-foreground font-mono max-w-md">
                    🚨 CLINICAL EMERGENCY ALERT<br />
                    Patient: {activeSession.patientName} ({activeSession.patientPhone})<br />
                    Message: "{activeSession.emergencyText}"<br />
                    👉 Reply directly to this WhatsApp message to respond to the patient.
                  </div>
                </div>
              </div>

              {/* Step 4: Doctor Reply Relayed to Patient */}
              {activeSession.doctorReplies.map((reply, idx) => (
                <div key={idx} className="flex gap-3 items-start pl-6">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs border border-emerald-500/30">
                    Dr
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {activeSession.doctorName}'s WhatsApp Reply
                      </span>
                      <span className="text-[10px] text-muted-foreground">{reply.time}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 text-[9px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" /> RELAYED TO PATIENT
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-foreground max-w-md shadow-xs">
                      <p className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-wider">
                        Delivered to patient WhatsApp as:
                      </p>
                      <p className="font-medium">
                        👩‍⚕️ <strong>[{activeSession.doctorName}]:</strong> {reply.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Simulation Console */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Simulate Doctor's WhatsApp Response
                </p>
                <span className="text-[10px] text-muted-foreground">
                  Simulates doctor texting back to Meta WhatsApp webhook
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={simDoctorReply}
                  onChange={(e) => setSimDoctorReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendDoctorReply(activeSession.id);
                    }
                  }}
                  placeholder={`Type as ${activeSession.doctorName} (e.g. 'Take anti-allergy tablet and apply ice...')`}
                  className="text-xs h-9"
                />
                <Button
                  size="sm"
                  onClick={() => handleSendDoctorReply(activeSession.id)}
                  disabled={!simDoctorReply.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-9 shrink-0 shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  Relay to Patient
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

