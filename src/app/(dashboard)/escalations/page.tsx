"use client";

import { useState } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  ShieldAlert, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  UserCheck, 
  CheckCircle2,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function EscalationsPage() {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const escalations = [
    {
      id: "esc-1",
      patient: "Vikram Malhotra",
      phone: "+91 98991 22334",
      alert: "Reported sudden radiating chest pressure & shortness of breath via WhatsApp",
      severity: "Emergency (Red)",
      sla: "Immediate",
      department: "Cardiology / Emergency",
      time: "4 mins ago",
      assignedTo: "Dr. Rajesh Gupta (ER On-Duty)"
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
      assignedTo: "Dr. Shalini Roy"
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
      assignedTo: "Dr. Vikrant Seth"
    }
  ];

  const handleResolve = (id: string) => {
    setResolvedIds(prev => [...prev, id]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400 animate-pulse" />
            Urgent Clinical Escalations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time emergency triggers flagged by AI WhatsApp analysis requiring immediate doctor intervention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            {escalations.filter(e => !resolvedIds.includes(e.id)).length} Active Urgent Cases
          </span>
        </div>
      </div>

      {/* Escalations Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-muted-foreground">Patient</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Severity</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Flagged AI Symptom Alert</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Doctor Assigned</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">SLA Window</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Intervention</TableHead>
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
                  <TableCell>
                    <div>
                      <p className="text-xs font-bold text-foreground">{esc.patient}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{esc.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      isEmergency
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      <AlertCircle className="h-3 w-3" />
                      {esc.severity}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-xs text-foreground font-medium">{esc.alert}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{esc.department} • {esc.time}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                      {esc.assignedTo}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <Clock className="h-3 w-3" />
                      {esc.sla}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-xs"
                        disabled={isResolved}
                      >
                        <PhoneCall className="h-3 w-3" />
                        Call Now
                      </Button>
                      <Button
                        size="sm"
                        variant={isResolved ? "ghost" : "outline"}
                        className="h-8 text-xs"
                        onClick={() => handleResolve(esc.id)}
                        disabled={isResolved}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {isResolved ? "Handled" : "Acknowledge"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
