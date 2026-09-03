"use client";

import { useState } from 'react';
import { useDemoState } from '@/hooks/use-demo-state';
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
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AppointmentsPage() {
  const { appointments } = useDemoState();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Seed default clinical appointments if empty
  const defaultAppointments = [
    { id: "demo-1", patient_name: "Rahul Sharma", phone_number: "+91 98765 43210", date: "2026-09-03", time: "10:30", department: "Cardiology", doctor: "Dr. Rajesh Gupta", status: "Confirmed" },
    { id: "demo-2", patient_name: "Priya Patel", phone_number: "+91 98123 45678", date: "2026-09-03", time: "11:15", department: "Pediatrics", doctor: "Dr. Shalini Roy", status: "In-Progress" },
    { id: "demo-3", patient_name: "Amit Kumar Verma", phone_number: "+91 97234 56789", date: "2026-09-04", time: "14:00", department: "General Medicine", doctor: "Dr. Ananya Rao", status: "Scheduled" },
    { id: "demo-4", patient_name: "Sunita Reddy", phone_number: "+91 99345 67890", date: "2026-09-04", time: "15:30", department: "Orthopedics", doctor: "Dr. Vikrant Seth", status: "Scheduled" },
  ];

  // Merge live AI booked appointments with defaults
  const allAppointments = [
    ...appointments.map(a => ({
      ...a,
      doctor: a.department === "Cardiology" ? "Dr. Rajesh Gupta" : "Dr. Ananya Rao",
      status: "Confirmed (AI)"
    })),
    ...defaultAppointments.filter(d => !appointments.some(a => a.phone_number === d.phone_number))
  ];

  const filteredAppointments = allAppointments.filter(appt => {
    const matchesSearch = appt.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          appt.phone_number.includes(searchTerm) ||
                          appt.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || appt.status.includes(statusFilter);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Calendar className="h-6 w-6 text-primary" />
            Appointments Schedule
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage hospital consultations, doctor schedules, and live AI WhatsApp bookings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs sm:text-sm shadow-xs">
            <Plus className="h-4 w-4 mr-1.5" />
            Book Walk-in Appointment
          </Button>
        </div>
      </div>

      {/* Mini Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Total Bookings</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{allAppointments.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">AI Confirmed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {allAppointments.filter(a => a.status.includes('Confirmed')).length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Scheduled</p>
          <p className="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-400">
            {allAppointments.filter(a => a.status.includes('Scheduled')).length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-muted-foreground">No-Show Risk</p>
          <p className="mt-1 text-2xl font-bold text-muted-foreground">0%</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, phone, doctor or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-muted/40 border-border text-xs focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          {['All', 'Confirmed', 'Scheduled'].map((status) => (
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

      {/* Appointments Data Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-muted-foreground">Patient</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">WhatsApp Contact</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Date & Slot</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Doctor / Department</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAppointments.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">No appointments match your filters</p>
                    <p className="text-xs text-muted-foreground">Book appointments live in the AI Emulator demo or add walk-ins.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAppointments.map((appt) => (
                <TableRow key={appt.id} className="border-border hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {appt.patient_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-foreground">{appt.patient_name}</span>
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
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground flex items-center gap-1">
                        <Stethoscope className="h-3 w-3 text-primary" />
                        {appt.doctor}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{appt.department}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {appt.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs gap-1.5"
                    >
                      <Send className="h-3 w-3 text-primary" />
                      Reminder
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
