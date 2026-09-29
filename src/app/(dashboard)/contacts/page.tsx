"use client";

import { useState, useEffect } from 'react';
import { useDemoState, Appointment, getTreatmentProtocol } from '@/hooks/use-demo-state';
import { useAuth } from '@/hooks/use-auth';
import { getRuntimeTreatments, DEFAULT_TREATMENTS, Treatment, TreatmentCategory } from '@/lib/hospital/treatments';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Users, 
  Search, 
  MessageSquare, 
  Phone, 
  Plus, 
  Filter, 
  Calendar, 
  X, 
  FileSpreadsheet, 
  Upload, 
  Send,
  Sparkles,
  CheckCircle2,
  Check,
  Settings2,
  RefreshCcw,
  Clock,
  Layers,
  Repeat,
  Download,
  Tag,
  Trash2,
  AlertTriangle,
  Loader2,
  CreditCard,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

type ClinicalCategory = 'All' | 'Skin' | 'Laser' | 'Aesthetic' | 'Body' | 'Hair';

interface PatientRecord {
  sNo: number;
  id?: string;
  name: string;
  phone: string;
  category: 'Skin' | 'Laser' | 'Aesthetic' | 'Body' | 'Hair';
  treatment: string;
  appointmentTime?: string;
  appointmentDate?: string;
  doctor: string;
  currentSitting?: number;
  totalSittings?: number;
  sittingInterval?: string;
  sittingIntervalDays?: number;
  status?: string;
}

function mapTreatmentToCategory(trt: string): 'Skin' | 'Laser' | 'Aesthetic' | 'Body' | 'Hair' {
  const t = (trt || '').toLowerCase();
  if (t.includes('laser') || t.includes('carbon') || t.includes('lhr')) return 'Laser';
  if (t.includes('hair') || t.includes('prp') || t.includes('scalp') || t.includes('gfc')) return 'Hair';
  if (t.includes('body') || t.includes('contouring') || t.includes('cellulite')) return 'Body';
  if (t.includes('botox') || t.includes('filler') || t.includes('lip') || t.includes('anti-aging') || t.includes('aesthetic')) return 'Aesthetic';
  return 'Skin';
}

export default function ContactsPageMock() {
  const { accountRole, isAdmin, isSuperAdmin } = useAuth();
  const canDeletePatient = isAdmin || isSuperAdmin || accountRole === 'admin' || accountRole === 'super_admin' || accountRole === 'owner';

  const { 
    appointments, 
    addAppointment, 
    completeSitting,
    updateAppointmentProtocol,
    deletePatient,
    deletedPatientPhones = []
  } = useDemoState();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ClinicalCategory>('All');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Delete Patient Modal State (Admin only)
  const [patientToDelete, setPatientToDelete] = useState<PatientRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Send Payment Link Modal State
  const [paymentModalPatient, setPaymentModalPatient] = useState<PatientRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(500);

  // New patient modal inputs (No address/locality requested)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<'Skin' | 'Laser' | 'Aesthetic' | 'Body' | 'Hair'>('Laser');
  const [treatment, setTreatment] = useState('Laser Hair Reduction');
  const [totalSittings, setTotalSittings] = useState(6);
  const [sittingInterval, setSittingInterval] = useState('4-6 weeks');
  const [sittingIntervalDays, setSittingIntervalDays] = useState(28);
  const [apptDate, setApptDate] = useState(new Date().toISOString().split('T')[0]);
  const [apptTime, setApptTime] = useState('11:30 AM');

  // Modal for manual sittings setup
  const [editApptModal, setEditApptModal] = useState<PatientRecord | null>(null);
  const [editTotalSittings, setEditTotalSittings] = useState<number>(4);
  const [editCurrentSitting, setEditCurrentSitting] = useState<number>(1);
  const [editIntervalGap, setEditIntervalGap] = useState<string>('2 weeks');
  const [editIntervalDays, setEditIntervalDays] = useState<number>(14);

  // Complete sitting modal
  const [completeModal, setCompleteModal] = useState<PatientRecord | null>(null);
  const [completeNextDate, setCompleteNextDate] = useState<string>('');
  const [completeGapText, setCompleteGapText] = useState<string>('2 weeks');
  const [completeGapDays, setCompleteGapDays] = useState<number>(14);

  // Excel import raw text state & persistent custom patients
  const [csvText, setCsvText] = useState('');
  const [customPatients, setCustomPatients] = useState<PatientRecord[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wacrm_custom_patients');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomPatients(parsed);
        }
      }
    } catch {}
  }, []);

  const saveCustomPatients = (list: PatientRecord[]) => {
    setCustomPatients(list);
    try {
      localStorage.setItem('wacrm_custom_patients', JSON.stringify(list));
    } catch {}
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const day2Str = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  const day3Str = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  // Seed default clinical demo patients classified under categories
  const initialDemoPatients: PatientRecord[] = [
    { sNo: 1, name: "Priya Sharma", phone: "+91 98765 43210", category: "Laser", appointmentTime: "11:30 AM", appointmentDate: todayStr, treatment: "Laser Hair Reduction", doctor: "Dr. Mrinalini", currentSitting: 2, totalSittings: 6, sittingInterval: "4-6 weeks", sittingIntervalDays: 28, status: "Confirmed" },
    { sNo: 2, name: "Rohan Mehra", phone: "+91 98123 45678", category: "Hair", appointmentTime: "02:00 PM", appointmentDate: todayStr, treatment: "PRP Hair Therapy & Scalp Restoration", doctor: "Dr. Mrinalini", currentSitting: 1, totalSittings: 4, sittingInterval: "3-4 weeks", sittingIntervalDays: 21, status: "Confirmed" },
    { sNo: 3, name: "Kavita Patel", phone: "+91 97234 56789", category: "Skin", appointmentTime: "04:30 PM", appointmentDate: tomorrowStr, treatment: "Pigmentation & Chemical Peels", doctor: "Dr. Mrinalini", currentSitting: 1, totalSittings: 4, sittingInterval: "2-3 weeks", sittingIntervalDays: 14, status: "Scheduled" },
    { sNo: 4, name: "Sunita Reddy", phone: "+91 99345 67890", category: "Skin", appointmentTime: "06:00 PM", appointmentDate: tomorrowStr, treatment: "Skin Tightening (RF / MNRF)", doctor: "Dr. Mrinalini", currentSitting: 3, totalSittings: 4, sittingInterval: "3-4 weeks", sittingIntervalDays: 21, status: "Scheduled" },
    { sNo: 5, name: "Karan Johar", phone: "+91 96456 78901", category: "Aesthetic", appointmentTime: "04:45 PM", appointmentDate: day2Str, treatment: "Anti-Aging & Botox", doctor: "Dr. Mrinalini", currentSitting: 1, totalSittings: 1, sittingInterval: "As advised", sittingIntervalDays: 30, status: "Confirmed" },
    { sNo: 6, name: "Ananya Deshmukh", phone: "+91 98450 11223", category: "Skin", appointmentTime: "03:15 PM", appointmentDate: day3Str, treatment: "HydraFacial Deluxe", doctor: "Dr. Mrinalini", currentSitting: 1, totalSittings: 3, sittingInterval: "4 weeks", sittingIntervalDays: 28, status: "Scheduled" },
    { sNo: 7, name: "Vikram Malhotra", phone: "+91 98980 44556", category: "Body", appointmentTime: "05:00 PM", appointmentDate: day3Str, treatment: "Body Contouring & Cellulite", doctor: "Dr. Mrinalini", currentSitting: 1, totalSittings: 6, sittingInterval: "2 weeks", sittingIntervalDays: 14, status: "Confirmed" },
  ];

  // Check if a patient record has been deleted by an admin
  const isDeleted = (phone?: string, id?: string) => {
    if (!deletedPatientPhones || deletedPatientPhones.length === 0) return false;
    const cleanP = (phone || '').toLowerCase().replace(/[\s\-\(\)\+]/g, '');
    const cleanId = (id || '').toLowerCase();
    return deletedPatientPhones.some(d => {
      const cleanD = (d || '').toLowerCase().replace(/[\s\-\(\)\+]/g, '');
      return cleanD === cleanP || cleanD === cleanId || d === phone || d === id;
    });
  };

  // Combine dynamic appointments + custom imports + initial patients
  const combinedList: PatientRecord[] = [];
  const seenPhones = new Set<string>();

  // 1. Dynamic appointments
  appointments.forEach(appt => {
    if (!isDeleted(appt.phone_number, appt.id) && !seenPhones.has(appt.phone_number)) {
      seenPhones.add(appt.phone_number);
      combinedList.push({
        sNo: combinedList.length + 1,
        id: appt.id,
        name: appt.patient_name,
        phone: appt.phone_number,
        category: mapTreatmentToCategory(appt.department),
        appointmentTime: appt.time,
        appointmentDate: appt.date,
        treatment: appt.department,
        doctor: appt.doctor || 'Dr. Mrinalini',
        currentSitting: appt.current_sitting || 1,
        totalSittings: appt.total_sittings || 4,
        sittingInterval: appt.sitting_interval || '2 weeks',
        sittingIntervalDays: appt.sitting_interval_days || 14,
        status: appt.status || 'Confirmed'
      });
    }
  });

  // 2. Custom imported patients
  customPatients.forEach(p => {
    if (!isDeleted(p.phone, p.id) && !seenPhones.has(p.phone)) {
      seenPhones.add(p.phone);
      combinedList.push(p);
    }
  });

  // 3. Base demo patients
  initialDemoPatients.forEach(p => {
    if (!isDeleted(p.phone, p.id) && !seenPhones.has(p.phone)) {
      seenPhones.add(p.phone);
      combinedList.push({ ...p, sNo: combinedList.length + 1 });
    }
  });

  // Re-index S.No
  const allPatients = combinedList.map((c, idx) => ({ ...c, sNo: idx + 1 }));

  const categoryTabs: ClinicalCategory[] = [
    'All',
    'Skin',
    'Laser',
    'Aesthetic',
    'Body',
    'Hair'
  ];

  const filteredPatients = allPatients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phone.includes(searchTerm) || 
                          c.treatment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesCategory = true;
    if (selectedCategory !== 'All') {
      matchesCategory = c.category === selectedCategory;
    }
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeStyle = (cat: string) => {
    switch (cat) {
      case 'Laser':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
      case 'Hair':
        return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20';
      case 'Skin':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
      case 'Aesthetic':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
      case 'Body':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handleTreatmentSelect = (trtName: string) => {
    setTreatment(trtName);
    const cat = mapTreatmentToCategory(trtName);
    setCategory(cat);
    const protocol = getTreatmentProtocol(trtName);
    setTotalSittings(protocol.totalSittings || 4);
    setSittingInterval(protocol.sittingInterval || '2 weeks');
    setSittingIntervalDays(protocol.sittingIntervalDays || 14);
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Please provide patient name and WhatsApp phone number.");
      return;
    }

    const newAppt = addAppointment({
      patient_name: name.trim(),
      phone_number: phone.trim(),
      date: apptDate,
      time: apptTime,
      department: treatment,
      doctor: "Dr. Mrinalini",
      status: "Confirmed",
      current_sitting: 1,
      total_sittings: totalSittings,
      sitting_interval: sittingInterval,
      sitting_interval_days: sittingIntervalDays,
      sitting: totalSittings > 1 ? `Sitting 1 of ${totalSittings}` : 'Consultation'
    });

    const newRec: PatientRecord = {
      sNo: allPatients.length + 1,
      id: newAppt.id,
      name: name.trim(),
      phone: phone.trim(),
      category: category,
      treatment: treatment,
      appointmentTime: apptTime,
      appointmentDate: apptDate,
      doctor: 'Dr. Mrinalini',
      currentSitting: 1,
      totalSittings: totalSittings,
      sittingInterval: sittingInterval,
      sittingIntervalDays: sittingIntervalDays,
      status: 'Confirmed'
    };

    saveCustomPatients([newRec, ...customPatients]);
    toast.success(`Patient record created for ${name}! Category: ${category}`);
    setName('');
    setPhone('');
    setIsAddOpen(false);
  };

  // CSV / Excel import handler for past patient lists
  const handleImportExcelPatients = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      toast.error("Please paste Excel rows or CSV lines.");
      return;
    }

    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: PatientRecord[] = [];

    lines.forEach((line, idx) => {
      // Split by tab or comma
      const parts = line.split(/[,\t]+/).map(p => p.trim());
      if (parts.length >= 2) {
        const pName = parts[0];
        const pPhone = parts[1];
        const pCatRaw = parts[2] || 'Skin';
        const pTrt = parts[3] || parts[2] || 'Clinical Consultation';
        
        let pCat: 'Skin' | 'Laser' | 'Aesthetic' | 'Body' | 'Hair' = 'Skin';
        const catUpper = pCatRaw.toUpperCase();
        if (catUpper.includes('LASER')) pCat = 'Laser';
        else if (catUpper.includes('HAIR')) pCat = 'Hair';
        else if (catUpper.includes('AESTHETIC')) pCat = 'Aesthetic';
        else if (catUpper.includes('BODY')) pCat = 'Body';
        else pCat = 'Skin';

        parsed.push({
          sNo: allPatients.length + idx + 1,
          name: pName,
          phone: pPhone.startsWith('+') ? pPhone : `+91 ${pPhone}`,
          category: pCat,
          treatment: pTrt,
          doctor: 'Dr. Mrinalini',
          appointmentTime: 'Past Record',
          appointmentDate: 'Completed History',
          currentSitting: 4,
          totalSittings: 4,
          sittingInterval: 'Completed',
          status: 'Past Patient'
        });
      }
    });

    if (parsed.length > 0) {
      saveCustomPatients([...parsed, ...customPatients]);
      toast.success(`Successfully imported ${parsed.length} past patients from Excel! Ready for WhatsApp broadcasts.`);
      setCsvText('');
      setIsImportOpen(false);
    } else {
      toast.error("Could not parse lines. Format: Name, Phone, Category, Treatment");
    }
  };

  const handleOpenEditSittings = (patient: PatientRecord) => {
    setEditApptModal(patient);
    setEditTotalSittings(patient.totalSittings || 4);
    setEditCurrentSitting(patient.currentSitting || 1);
    setEditIntervalGap(patient.sittingInterval || '2 weeks');
    setEditIntervalDays(patient.sittingIntervalDays || 14);
  };

  const handleSaveEditSittings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editApptModal) return;

    if (editApptModal.id) {
      updateAppointmentProtocol(editApptModal.id, {
        total_sittings: editTotalSittings,
        current_sitting: editCurrentSitting,
        sitting_interval: editIntervalGap,
        sitting_interval_days: editIntervalDays
      });
    }

    toast.success(`Updated sittings for ${editApptModal.name} (${editTotalSittings} sittings, ${editIntervalGap} gap)!`);
    setEditApptModal(null);
  };

  const handleOpenCompleteModal = (patient: PatientRecord) => {
    setCompleteModal(patient);
    const gapDays = patient.sittingIntervalDays || 14;
    const gapText = patient.sittingInterval || '2 weeks';
    setCompleteGapText(gapText);
    setCompleteGapDays(gapDays);

    const nextTs = Date.now() + gapDays * 86400000;
    setCompleteNextDate(new Date(nextTs).toISOString().split('T')[0]);
  };

  const handleConfirmComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModal) return;

    if (completeModal.id) {
      completeSitting(completeModal.id, completeNextDate, completeGapText, completeGapDays);
    } else {
      const appt = addAppointment({
        patient_name: completeModal.name,
        phone_number: completeModal.phone,
        date: completeModal.appointmentDate || 'Today',
        time: completeModal.appointmentTime || '11:30 AM',
        department: completeModal.treatment,
        doctor: 'Dr. Mrinalini',
        status: 'Completed',
        current_sitting: completeModal.currentSitting || 1,
        total_sittings: completeModal.totalSittings || 4,
        sitting_interval: completeGapText,
        sitting_interval_days: completeGapDays
      });
      completeSitting(appt.id, completeNextDate, completeGapText, completeGapDays);
    }

    toast.success(`Sitting marked Completed for ${completeModal.name}! Shifted into Follow-Up Section.`);
    setCompleteModal(null);
  };

  // Admin action: Permanently delete patient and associated clinical records from database & state
  const handleConfirmDeletePatient = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);

    const targetId = patientToDelete.id || patientToDelete.phone;
    const targetPhone = patientToDelete.phone;
    const targetName = patientToDelete.name;

    try {
      // 1. Call Backend API DELETE endpoint with role check
      const res = await fetch(`/api/contacts/${encodeURIComponent(targetId)}?phone=${encodeURIComponent(targetPhone)}`, {
        method: 'DELETE',
      });

      if (!res.ok && res.status === 403) {
        toast.error("Permission Denied: Only Admins are authorized to delete patient records.");
        setIsDeleting(false);
        return;
      }

      // 2. Remove locally and synchronize deleted state
      deletePatient(targetId);
      deletePatient(targetPhone);
      const remainingCustom = customPatients.filter(p => p.phone !== targetPhone && p.id !== targetId);
      saveCustomPatients(remainingCustom);

      toast.success(`Patient "${targetName}" permanently deleted from database.`);
      setPatientToDelete(null);
    } catch (err) {
      console.error("Delete patient error:", err);
      // Fallback local cleanup
      deletePatient(targetId);
      deletePatient(targetPhone);
      const remainingCustom = customPatients.filter(p => p.phone !== targetPhone && p.id !== targetId);
      saveCustomPatients(remainingCustom);
      toast.success(`Patient "${targetName}" deleted.`);
      setPatientToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="h-6 w-6 text-primary" />
            Patient Registry & Clinical Categories
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Clinical records classified by category (<strong>Skin</strong>, <strong>Laser</strong>, <strong>Aesthetic</strong>, <strong>Body</strong>, <strong>Hair</strong>) with S.No. and broadcast sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            onClick={() => setIsImportOpen(true)}
            variant="outline"
            className="border-border text-foreground font-semibold text-xs shadow-xs gap-1.5 hover:bg-muted"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Import Past Patients (Excel)</span>
          </Button>

          <Link
            href="/broadcasts"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Broadcast to Patients</span>
          </Link>

          <Button 
            onClick={() => setIsAddOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Patient</span>
          </Button>
        </div>
      </div>

      {/* Filter & Category Tabs Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name, phone, treatment, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-muted/40 border-border text-xs focus-visible:ring-primary/20"
          />
        </div>

        {/* Category Filter Pills (Column B Excel Flow) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <Tag className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedCategory(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === tab
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Table with S.No. and Categories */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <Table className="min-w-[1050px] w-full text-xs">
          <TableHeader>
            <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[80px] text-xs font-semibold text-muted-foreground px-4 py-3 text-center">S.No.</TableHead>
              <TableHead className="w-[200px] text-xs font-semibold text-muted-foreground px-4 py-3">Patient Name</TableHead>
              <TableHead className="w-[180px] text-xs font-semibold text-muted-foreground px-4 py-3">WhatsApp Number</TableHead>
              <TableHead className="w-[140px] text-xs font-semibold text-muted-foreground px-4 py-3">Category</TableHead>
              <TableHead className="w-[140px] text-xs font-semibold text-muted-foreground px-4 py-3">Appointment</TableHead>
              <TableHead className="w-[200px] text-xs font-semibold text-muted-foreground px-4 py-3">Treatment Plan</TableHead>
              <TableHead className="w-[210px] text-xs font-semibold text-muted-foreground text-right px-4 py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPatients.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">No matching patients found</p>
                    <p className="text-xs text-muted-foreground">Try clearing your search query or filter category.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPatients.map((patient) => {
                const isCompleted = patient.status === 'Completed' || patient.status === 'Past Patient';

                return (
                  <TableRow key={patient.sNo} className="border-border hover:bg-muted/40 transition-colors">
                    {/* S.No Column (clean number badge instead of initials avatar) */}
                    <TableCell className="px-4 py-3.5 align-middle text-center">
                      <span className="inline-flex items-center justify-center h-6 min-w-[28px] px-1.5 rounded-md bg-muted text-[11px] font-mono font-bold text-foreground border border-border/80">
                        #{patient.sNo}
                      </span>
                    </TableCell>

                    {/* Patient Name */}
                    <TableCell className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <p className="text-xs font-bold text-foreground">{patient.name}</p>
                        <p className="text-[10px] text-muted-foreground">Consulting: Dr. Mrinalini</p>
                      </div>
                    </TableCell>

                    {/* WhatsApp Number with WhatsApp Icon */}
                    <TableCell className="px-4 py-3.5 align-middle font-mono text-xs text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span className="text-foreground">{patient.phone}</span>
                      </div>
                    </TableCell>

                    {/* Category Column (Skin, Laser, Aesthetic, Body, Hair) */}
                    <TableCell className="px-4 py-3.5 align-middle">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border uppercase tracking-wider ${getCategoryBadgeStyle(patient.category)}`}>
                        {patient.category}
                      </span>
                    </TableCell>

                    {/* Appointment (Time & Date) */}
                    <TableCell className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{patient.appointmentTime || '11:30 AM'}</span>
                        <span className="text-[11px] text-muted-foreground">{patient.appointmentDate || 'Upcoming'}</span>
                      </div>
                    </TableCell>

                    {/* Treatment Pill & Sittings */}
                    <TableCell className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground text-xs">
                          {patient.treatment}
                        </span>
                        {patient.totalSittings && patient.totalSittings > 1 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Layers className="h-3 w-3 text-purple-600" />
                            Sitting {patient.currentSitting || 1} of {patient.totalSittings} ({patient.sittingInterval || '2 weeks'})
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Action Controls */}
                    <TableCell className="px-4 py-3.5 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Configure Sittings */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditSittings(patient)}
                          className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Configure sittings count and interval gap"
                        >
                          <Settings2 className="h-3 w-3 text-primary" />
                        </Button>

                        {/* Complete & Shift to Follow-Ups */}
                        {!isCompleted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCompleteModal(patient)}
                            className="h-7 text-[11px] gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-semibold"
                            title="Mark sitting complete and shift to Follow-Ups"
                          >
                            <Check className="h-3 w-3" />
                            <span>Complete</span>
                          </Button>
                        ) : (
                          <Link
                            href="/follow-ups"
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold text-[10.5px] border border-purple-500/20"
                          >
                            <RefreshCcw className="h-3 w-3" />
                            <span>Follow-Up</span>
                          </Link>
                        )}

                        {/* AI Chat Button */}
                        <Link
                          href="/demo"
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>AI Chat</span>
                        </Link>

                        {/* Send Payment Link Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPaymentModalPatient(patient);
                            setPaymentAmount(500);
                          }}
                          className="h-7 text-[11px] gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                          title="Generate & Send Payment Link on WhatsApp"
                        >
                          <CreditCard className="h-3 w-3" />
                          <span>Pay Link</span>
                        </Button>

                        {/* Delete Patient Button - ONLY Admin can delete */}
                        {canDeletePatient && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPatientToDelete(patient)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete Patient Record (Admin Only)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add New Patient Modal (No address/locality requested) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Add New Patient</h3>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-3.5 mt-4 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Patient Full Name</Label>
                <Input
                  placeholder="e.g. Shalini Roy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">WhatsApp Number</Label>
                <Input
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Clinical Category</Label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const newCat = e.target.value as any;
                      setCategory(newCat);
                      if (newCat === 'Laser') handleTreatmentSelect('Laser Hair Reduction');
                      else if (newCat === 'Hair') handleTreatmentSelect('PRP Hair Therapy & Scalp Restoration');
                      else if (newCat === 'Skin') handleTreatmentSelect('HydraFacial Deluxe');
                      else if (newCat === 'Aesthetic') handleTreatmentSelect('Anti-Aging & Botox');
                      else if (newCat === 'Body') handleTreatmentSelect('Body Contouring & Cellulite Reduction');
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value="Skin">Skin</option>
                    <option value="Laser">Laser</option>
                    <option value="Aesthetic">Aesthetic</option>
                    <option value="Body">Body</option>
                    <option value="Hair">Hair</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Treatment Procedure</Label>
                  <select
                    value={treatment}
                    onChange={(e) => handleTreatmentSelect(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value="Laser Hair Reduction">Laser Hair Reduction</option>
                    <option value="Carbon Laser Hollywood Peel">Carbon Laser Hollywood Peel</option>
                    <option value="PRP Hair Therapy & Scalp Restoration">PRP Hair Therapy</option>
                    <option value="GFC Hair Restoration">GFC Hair Restoration</option>
                    <option value="HydraFacial Deluxe">HydraFacial Deluxe</option>
                    <option value="Pigmentation & Chemical Peels">Pigmentation & Peels</option>
                    <option value="Skin Tightening (RF / MNRF)">Skin Tightening (RF/MNRF)</option>
                    <option value="Anti-Aging & Botox">Anti-Aging & Botox</option>
                    <option value="Dermal Fillers & Lip Enhancement">Dermal Fillers</option>
                    <option value="Body Contouring & Cellulite Reduction">Body Contouring</option>
                    <option value="Clinical Consultation">Clinical Consultation</option>
                  </select>
                </div>
              </div>

              {/* Multi-Sitting and Interval Controls */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5">
                <div className="flex items-center gap-1 text-xs font-bold text-primary">
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Sittings & Gap Duration Setup</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Total Sittings</Label>
                    <select
                      value={totalSittings}
                      onChange={(e) => setTotalSittings(parseInt(e.target.value) || 1)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 py-0.5 text-xs shadow-xs"
                    >
                      <option value={1}>1 Sitting (Single)</option>
                      <option value={2}>2 Sittings</option>
                      <option value={3}>3 Sittings</option>
                      <option value={4}>4 Sittings</option>
                      <option value={5}>5 Sittings</option>
                      <option value={6}>6 Sittings (Full Course)</option>
                      <option value={8}>8 Sittings</option>
                      <option value={10}>10 Sittings</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Interval Gap</Label>
                    <select
                      value={sittingInterval}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSittingInterval(val);
                        if (val === '1 week') setSittingIntervalDays(7);
                        else if (val === '2 weeks') setSittingIntervalDays(14);
                        else if (val === '3 weeks') setSittingIntervalDays(21);
                        else if (val === '4 weeks' || val === '1 month') setSittingIntervalDays(28);
                        else if (val === '4-6 weeks') setSittingIntervalDays(35);
                        else if (val === '45 days') setSittingIntervalDays(45);
                        else if (val === '2 months') setSittingIntervalDays(60);
                      }}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 py-0.5 text-xs shadow-xs"
                    >
                      <option value="1 week">1 Week Gap</option>
                      <option value="2 weeks">2 Weeks Gap</option>
                      <option value="3 weeks">3 Weeks Gap</option>
                      <option value="4 weeks">4 Weeks / 1 Month Gap</option>
                      <option value="4-6 weeks">4-6 Weeks Gap</option>
                      <option value="45 days">45 Days Gap</option>
                      <option value="2 months">2 Months Gap</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Appointment Date</Label>
                  <Input
                    type="date"
                    min={todayStr}
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
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value="10:30 AM">10:30 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="04:30 PM">04:30 PM</option>
                    <option value="06:00 PM">06:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Save Patient & Book Slot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Past Patients from Excel/CSV Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Import Past Patient List (Excel/CSV)</h3>
                  <p className="text-[11px] text-muted-foreground">Add historical patient records to send mass WhatsApp broadcasts.</p>
                </div>
              </div>
              <button onClick={() => setIsImportOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleImportExcelPatients} className="space-y-3.5 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <p className="font-semibold text-foreground text-xs">Expected Excel Format (Comma or Tab Separated):</p>
                <code className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-mono">
                  Full Name, Phone Number, Category, Treatment Name
                </code>
                <p className="text-[10.5px] text-muted-foreground pt-1">
                  Example: <em>Meera Kapoor, +919811122334, Laser, Laser Hair Reduction</em>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Paste Excel Rows / CSV Text</Label>
                <textarea
                  rows={6}
                  placeholder={`Meera Kapoor, 9811122334, Laser, Laser Hair Reduction\nRajesh Khanna, 9822233445, Hair, PRP Hair Therapy\nShreya Ghoshal, 9833344556, Skin, HydraFacial Deluxe`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsImportOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import & Sync to Broadcasts</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Sittings Modal for Patient Registry */}
      {editApptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Adjust Sittings & Interval</h3>
                  <p className="text-[11px] text-muted-foreground">Clinical Protocol Management</p>
                </div>
              </div>
              <button onClick={() => setEditApptModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSittings} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <p className="font-bold text-foreground text-sm">{editApptModal.name}</p>
                <p className="text-muted-foreground font-mono">{editApptModal.phone}</p>
                <p className="text-primary font-medium">{editApptModal.treatment} • Dr. Mrinalini</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Total Sittings Count</Label>
                  <select
                    value={editTotalSittings}
                    onChange={(e) => setEditTotalSittings(parseInt(e.target.value) || 1)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value={1}>1 Sitting (Single)</option>
                    <option value={2}>2 Sittings (2 Sessions)</option>
                    <option value={3}>3 Sittings (3 Sessions)</option>
                    <option value={4}>4 Sittings (4 Sessions)</option>
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
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    {Array.from({ length: editTotalSittings }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>Sitting {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Duration / Gap Between Sittings</Label>
                <select
                  value={editIntervalGap}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditIntervalGap(val);
                    if (val === '1 week') setEditIntervalDays(7);
                    else if (val === '2 weeks') setEditIntervalDays(14);
                    else if (val === '3 weeks') setEditIntervalDays(21);
                    else if (val === '4 weeks' || val === '1 month') setEditIntervalDays(28);
                    else if (val === '4-6 weeks') setEditIntervalDays(35);
                    else if (val === '45 days') setEditIntervalDays(45);
                    else if (val === '2 months') setEditIntervalDays(60);
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value="1 week">1 Week Gap (7 Days)</option>
                  <option value="2 weeks">2 Weeks Gap (14 Days - Peels/PRP)</option>
                  <option value="3 weeks">3 Weeks Gap (21 Days)</option>
                  <option value="4 weeks">4 Weeks Gap / 1 Month (28 Days)</option>
                  <option value="4-6 weeks">4-6 Weeks Gap (35 Days - Laser)</option>
                  <option value="45 days">45 Days Gap</option>
                  <option value="2 months">2 Months Gap (60 Days)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditApptModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                  Update Sittings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Sitting Modal for Patient Registry */}
      {completeModal && (
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
              <button onClick={() => setCompleteModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmComplete} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{completeModal.name}</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{completeModal.treatment}</span>
                </div>
                <p className="text-muted-foreground font-mono">{completeModal.phone}</p>
                <p className="text-foreground pt-1">
                  Completed: <strong>Sitting {completeModal.currentSitting || 1} of {completeModal.totalSittings || 4}</strong>
                </p>
              </div>

              {(completeModal.currentSitting || 1) < (completeModal.totalSittings || 4) && (
                <div className="space-y-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                    <Repeat className="h-4 w-4" />
                    <span>Next Sitting Schedule & Interval Gap</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Interval Gap for Sitting {(completeModal.currentSitting || 1) + 1}</Label>
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
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
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
                      value={completeNextDate}
                      onChange={(e) => setCompleteNextDate(e.target.value)}
                      required
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setCompleteModal(null)}>
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

      {/* Delete Patient Confirmation Modal (Admin only) */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base text-foreground">Delete Patient Record</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to permanently delete <strong className="text-foreground">{patientToDelete.name}</strong> ({patientToDelete.phone})?
                </p>
              </div>
              <button
                onClick={() => !isDeleting && setPatientToDelete(null)}
                disabled={isDeleting}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Category:</span>
                <span className="font-semibold text-foreground">{patientToDelete.category}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Treatment:</span>
                <span className="font-semibold text-foreground">{patientToDelete.treatment}</span>
              </div>
              {patientToDelete.appointmentDate && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Appointment:</span>
                  <span className="font-semibold text-foreground">{patientToDelete.appointmentTime || '11:30 AM'} ({patientToDelete.appointmentDate})</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-destructive/90 mt-3 font-medium flex items-center gap-1.5 bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This will permanently remove the patient from the database, scheduled appointments, and follow-ups.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setPatientToDelete(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isDeleting}
                onClick={handleConfirmDeletePatient}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Patient Record</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Send Payment Link & WhatsApp Receipt Modal */}
      {paymentModalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Send Payment Gateway Link</h3>
                  <p className="text-[11px] text-muted-foreground">Razorpay / UPI Instant Checkout on WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalPatient(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{paymentModalPatient.name}</span>
                  <span className="text-emerald-600">{paymentModalPatient.treatment}</span>
                </div>
                <p className="text-muted-foreground font-mono">{paymentModalPatient.phone}</p>
                {paymentModalPatient.appointmentDate && (
                  <p className="text-muted-foreground">
                    📅 Slot: {paymentModalPatient.appointmentTime || '11:30 AM'} ({paymentModalPatient.appointmentDate})
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Amount to Collect (₹)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[300, 500, 1500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPaymentAmount(amt)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                        paymentAmount === amt
                          ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      ₹{amt} {amt === 300 ? '(Token)' : amt === 500 ? '(Consult)' : '(Full)'}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                  className="text-xs mt-1 font-mono font-bold"
                  placeholder="Custom Amount"
                />
              </div>

              {/* Generated Link Preview */}
              {(() => {
                const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                const payLink = `${origin}/pay/pay_${paymentModalPatient.id || Date.now()}?name=${encodeURIComponent(paymentModalPatient.name)}&phone=${encodeURIComponent(paymentModalPatient.phone)}&treatment=${encodeURIComponent(paymentModalPatient.treatment)}&amount=${paymentAmount}&date=${encodeURIComponent(paymentModalPatient.appointmentDate || 'Today')}&time=${encodeURIComponent(paymentModalPatient.appointmentTime || '11:30 AM')}&doctor=Dr.+Mrinalini`;
                const waMessage = `Hello ${paymentModalPatient.name}! Here is your secure payment link for ${paymentModalPatient.treatment} at La Fleur Aesthetic Clinic: ${payLink}\n\nAmount: ₹${paymentAmount}. Please complete payment to lock your appointment slot with Dr. Mrinalini.`;

                return (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                        <span>Generated Payment Link</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(payLink);
                            toast.success("Payment link copied to clipboard!");
                          }}
                          className="flex items-center gap-1 hover:underline text-primary"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{payLink}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
                      <a
                        href={`https://wa.me/${paymentModalPatient.phone.replace(/[\s\-\(\)\+]/g, '')}?text=${encodeURIComponent(waMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send via WhatsApp</span>
                      </a>

                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            await fetch('/api/payments/verify', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                patientName: paymentModalPatient.name,
                                phoneNumber: paymentModalPatient.phone,
                                treatment: paymentModalPatient.treatment,
                                amount: paymentAmount,
                                date: paymentModalPatient.appointmentDate,
                                time: paymentModalPatient.appointmentTime,
                                doctor: 'Dr. Mrinalini',
                                appointmentId: paymentModalPatient.id,
                              }),
                            });
                          } catch {}
                          toast.success(`Payment of ₹${paymentAmount} recorded and WhatsApp receipt created for ${paymentModalPatient.name}!`);
                          setPaymentModalPatient(null);
                        }}
                        variant="outline"
                        className="h-9 text-xs font-semibold border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        <span>Mark Paid & Send Receipt</span>
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
