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
import { Users, Search, MessageSquare, Phone, Plus, Filter, UserCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ContactsPageMock() {
  const { appointments } = useDemoState();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  // Seed default clinical demo patients if empty
  const defaultPatients = [
    { name: "Rahul Sharma", phone: "+91 98765 43210", address: "Sector 14, Ring Road", time: "10:30 AM", category: "Cardiology", date: "Today" },
    { name: "Priya Patel", phone: "+91 98123 45678", address: "Green Glen Layout, Apt 4B", time: "11:15 AM", category: "Pediatrics", date: "Today" },
    { name: "Amit Kumar Verma", phone: "+91 97234 56789", address: "Civil Lines, Block C", time: "02:00 PM", category: "General", date: "Tomorrow" },
    { name: "Sunita Reddy", phone: "+91 99345 67890", address: "Indira Nagar, 5th Cross", time: "03:30 PM", category: "Orthopedics", date: "Tomorrow" },
    { name: "Karan Johar", phone: "+91 96456 78901", address: "Koramangala, 4th Block", time: "04:45 PM", category: "Neurology", date: "Tomorrow" },
  ];

  // Deduplicate patients by phone number to create a unique contacts list
  const uniqueContactsMap = new Map();

  // Add demo state appointments first
  appointments.forEach(appt => {
    if (!uniqueContactsMap.has(appt.phone_number)) {
      const mockAddress = `${appt.phone_number.replace(/\D/g, '').slice(0, 4) || '104'} Healthcare Ave, Apt ${appt.patient_name.length}`;
      uniqueContactsMap.set(appt.phone_number, {
        name: appt.patient_name,
        phone: appt.phone_number,
        address: mockAddress,
        time: appt.time,
        category: appt.department,
        date: appt.date
      });
    }
  });

  // Add defaults if not already present
  defaultPatients.forEach(p => {
    if (!uniqueContactsMap.has(p.phone)) {
      uniqueContactsMap.set(p.phone, p);
    }
  });

  const allContacts = Array.from(uniqueContactsMap.values());

  const departments = ['All', 'General', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Neurology'];

  const filteredContacts = allContacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phone.includes(searchTerm) || 
                          c.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || c.category === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="h-6 w-6 text-primary" />
            Patient Registry
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Centralized directory of patient profiles captured from WhatsApp conversations & appointments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs sm:text-sm shadow-xs">
            <Plus className="h-4 w-4 mr-1.5" />
            Add New Patient
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient name, phone number, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-muted/40 border-border text-xs focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                selectedDept === dept
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-muted-foreground">Patient</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">WhatsApp Number</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground hidden md:table-cell">Address / Locality</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground hidden sm:table-cell">Appointment</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Department</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">No matching patients found</p>
                    <p className="text-xs text-muted-foreground">Try clearing your search query or department filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact, idx) => (
                <TableRow key={idx} className="border-border hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{contact.name}</p>
                        <p className="text-[11px] text-muted-foreground md:hidden">{contact.address}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {contact.phone}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                    {contact.address}
                  </TableCell>
                  <TableCell className="text-xs hidden sm:table-cell">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{contact.time}</span>
                      <span className="text-[10px] text-muted-foreground">{contact.date}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      {contact.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 px-2.5 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      Chat
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
