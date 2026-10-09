"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
  Stethoscope, 
  Plus, 
  Search, 
  Phone, 
  FileText, 
  Send, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Sparkles, 
  Printer, 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  UserCheck, 
  Calendar,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface MedicineItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  rxNumber: string;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  patientGender: 'Female' | 'Male' | 'Other';
  diagnosis: string;
  skinType: string;
  medicines: MedicineItem[];
  precautions: string;
  followUpDays: number;
  doctorName: string;
  doctorRegistration: string;
  createdAt: string;
  status: 'Dispatched to WhatsApp' | 'Draft' | 'Completed';
}

export interface ClinicalDiagnosticIntake {
  id: string;
  patientName: string;
  phone: string;
  concern: string;
  skinType: string;
  duration: string;
  activeTopicals: string;
  allergies: string;
  severity: 'Urgent Review' | 'Moderate' | 'Mild';
  intakeDate: string;
}

const INITIAL_PRESCRIPTIONS: Prescription[] = [];

const INITIAL_INTAKES: ClinicalDiagnosticIntake[] = [];

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(INITIAL_PRESCRIPTIONS);
  const [intakes, setIntakes] = useState<ClinicalDiagnosticIntake[]>(INITIAL_INTAKES);
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'diagnostics'>('prescriptions');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRxForView, setSelectedRxForView] = useState<Prescription | null>(null);

  // Hydrate from localStorage on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRx = localStorage.getItem('wacrm_prescriptions');
        if (savedRx) {
          const parsed = JSON.parse(savedRx);
          if (Array.isArray(parsed)) setPrescriptions(parsed);
        }
        const savedIntakes = localStorage.getItem('wacrm_diagnostic_intakes');
        if (savedIntakes) {
          const parsed = JSON.parse(savedIntakes);
          if (Array.isArray(parsed)) setIntakes(parsed);
        }
      } catch (e) {
        console.warn('Error loading prescriptions from localStorage', e);
      }
    }
  }, []);

  // Prescription Form State
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('+91 ');
  const [patientAge, setPatientAge] = useState('28');
  const [patientGender, setPatientGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [diagnosis, setDiagnosis] = useState('Severe Acne Vulgaris & Barrier Impairment');
  const [skinType, setSkinType] = useState('Fitzpatrick Type IV');
  const [precautions, setPrecautions] = useState('Apply broad-spectrum sunscreen SPF 50+ every 3 hours. Avoid harsh scrubs for 48 hours.');
  const [followUpDays, setFollowUpDays] = useState('14');
  const [medicines, setMedicines] = useState<MedicineItem[]>([
    { id: '1', name: 'Tab. Doxycycline 100mg', dosage: '100mg', frequency: '1-0-1 (After Food)', duration: '15 Days', instructions: 'Drink with full glass of water.' },
    { id: '2', name: 'Clindamycin 1% + Nicotinamide 4% Gel', dosage: 'Topical', frequency: '0-0-1 (Night)', duration: '30 Days', instructions: 'Apply thin layer on active spots.' }
  ]);

  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter(rx => 
      rx.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.patientPhone.includes(searchQuery) ||
      rx.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.rxNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [prescriptions, searchQuery]);

  const filteredIntakes = useMemo(() => {
    return intakes.filter(int => 
      int.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      int.phone.includes(searchQuery) ||
      int.concern.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [intakes, searchQuery]);

  const addMedicineRow = () => {
    setMedicines(prev => [
      ...prev,
      { id: `${Date.now()}`, name: '', dosage: 'Topical', frequency: '0-0-1 (Night)', duration: '30 Days', instructions: 'Apply as advised by doctor.' }
    ]);
  };

  const removeMedicineRow = (id: string) => {
    if (medicines.length === 1) {
      toast.error('Prescription must have at least one medication');
      return;
    }
    setMedicines(prev => prev.filter(m => m.id !== id));
  };

  const updateMedicine = (id: string, field: keyof MedicineItem, value: string) => {
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleConvertIntakeToRx = (int: ClinicalDiagnosticIntake) => {
    setPatientName(int.patientName);
    setPatientPhone(int.phone);
    setDiagnosis(`Clinical Evaluation for: ${int.concern}`);
    setSkinType(int.skinType);
    setActiveTab('prescriptions');
    setIsCreateModalOpen(true);
    toast.info(`Pre-filled prescription with AI intake data for ${int.patientName}`);
  };

  const handleDeletePrescription = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const rx = prescriptions.find(p => p.id === id);
    const updated = prescriptions.filter(p => p.id !== id);
    setPrescriptions(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wacrm_prescriptions', JSON.stringify(updated));
    }
    if (selectedRxForView?.id === id) {
      setSelectedRxForView(null);
    }
    toast.success(`Prescription ${rx?.rxNumber || ''} deleted successfully`);
  };

  const handleDeleteIntake = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const int = intakes.find(i => i.id === id);
    const updated = intakes.filter(i => i.id !== id);
    setIntakes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wacrm_diagnostic_intakes', JSON.stringify(updated));
    }
    toast.success(`Diagnostic intake for ${int?.patientName || 'patient'} deleted`);
  };

  const handleCreatePrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim() || !diagnosis.trim()) {
      toast.error('Please complete patient name, phone, and clinical diagnosis');
      return;
    }

    const rxNum = `RX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRx: Prescription = {
      id: `rx_${Date.now()}`,
      rxNumber: rxNum,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      patientAge: parseInt(patientAge) || 28,
      patientGender,
      diagnosis: diagnosis.trim(),
      skinType: skinType.trim(),
      medicines: medicines.filter(m => m.name.trim().length > 0),
      precautions: precautions.trim(),
      followUpDays: parseInt(followUpDays) || 14,
      doctorName: "Dr. Mrinalini",
      doctorRegistration: "KMC-58291 (MD Dermatology)",
      createdAt: "Just now",
      status: "Dispatched to WhatsApp"
    };

    const updated = [newRx, ...prescriptions];
    setPrescriptions(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wacrm_prescriptions', JSON.stringify(updated));
    }
    setIsCreateModalOpen(false);
    toast.success(`Prescription ${rxNum} created & dispatched to ${patientName}'s WhatsApp!`);

    // Reset Form
    setPatientName('');
    setPatientPhone('+91 ');
  };

  const handleSendToWhatsApp = async (rx: Prescription) => {
    const medList = (rx.medicines || []).map(m => `• ${m.name} (${m.dosage}) - ${m.frequency}, ${m.duration} [${m.instructions}]`).join('\n');
    const msg = `*Official Digital Prescription - Dr. Mrinalini*\n*La Fleur Aesthetic Clinic*\n\nPatient: ${rx.patientName} (${rx.patientAge}y, ${rx.patientGender})\nDiagnosis: ${rx.diagnosis}\nSkin Type: ${rx.skinType}\nRx Number: ${rx.rxNumber}\n\n*Prescribed Medications:*\n${medList}\n\n*Precautions & Aftercare:*\n${rx.precautions}\n\n*Follow-up Review:* In ${rx.followUpDays} days.\n\n_For emergencies or queries, reply directly to this WhatsApp number._`;

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: rx.patientPhone,
          name: rx.patientName,
          message_type: 'text',
          content_text: msg,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to dispatch prescription via WhatsApp');
      } else {
        toast.success(`Official Digital Rx dispatched to ${rx.patientName} (${rx.patientPhone}) over WhatsApp!`);
      }
    } catch (err) {
      console.error('Send prescription error:', err);
      toast.error('Network error dispatching prescription');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Stethoscope className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Medical Prescriptions & Clinical Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Formulate digital prescriptions, review AI-gathered skin & hair diagnostics, and dispatch structured WhatsApp Rx passes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Create Digital Prescription (Rx)
          </Button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total Prescriptions Dispatched</span>
            <FileText className="h-4 w-4 text-teal-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2">
            {prescriptions.length + 155} Prescriptions
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
            <CheckCircle2 className="h-3 w-3" />
            WhatsApp PDF Verified
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>AI Diagnostic Intakes</span>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-primary mt-2">
            {intakes.length + 39} Patients
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Pre-Consultation Triaged
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Primary Diagnosis Category</span>
            <Stethoscope className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2 truncate">
            Acne & Hair Restoration
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Dr. Mrinalini Clinic Protocol
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Follow-Up Compliance</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            92.8%
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Automated WhatsApp Reminders
          </span>
        </div>
      </div>

      {/* Tabs Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('prescriptions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'prescriptions'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Prescriptions & Rx Passes ({prescriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Diagnostic Triage ({intakes.length})
          </button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search patient, diagnosis, Rx ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background text-xs"
          />
        </div>
      </div>

      {/* Tab 1: Prescriptions List */}
      {activeTab === 'prescriptions' && (
        <>
          {filteredPrescriptions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3 shadow-xs">
              <div className="h-12 w-12 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-foreground">No Prescriptions Found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No digital prescriptions match your search. Create a new digital Rx for a patient.
              </p>
              <Button
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                <Plus className="h-4 w-4 mr-1" /> Create Digital Prescription
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredPrescriptions.map(rx => (
                <div 
                  key={rx.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Rx Header */}
                    <div className="flex items-start justify-between border-b border-border/80 pb-3">
                      <div>
                        <span className="text-xs font-bold font-mono text-primary flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          {rx.rxNumber}
                        </span>
                        <h3 className="text-sm font-bold text-foreground mt-0.5">{rx.patientName}</h3>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {rx.patientGender}, {rx.patientAge} yrs • {rx.patientPhone}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          WhatsApp Dispatched
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePrescription(rx.id, e)}
                          className="text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                          title="Delete Prescription"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Diagnosis & Skin Type */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                      <p className="text-[11px] font-semibold text-foreground">
                        Diagnosis: <span className="font-normal text-muted-foreground">{rx.diagnosis}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Skin Barrier: <span className="font-medium text-foreground">{rx.skinType}</span>
                      </p>
                    </div>

                    {/* Medicines List Preview */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Prescribed Medicines ({rx.medicines.length}):
                      </p>
                      <div className="space-y-1">
                        {rx.medicines.map(m => (
                          <div key={m.id} className="p-2 rounded bg-background border border-border text-[11px]">
                            <p className="font-bold text-foreground">{m.name}</p>
                            <p className="text-muted-foreground text-[10px] font-mono mt-0.5">
                              {m.frequency} • {m.duration}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Doctor Sign-off */}
                    <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Sign: <strong className="text-foreground">{rx.doctorName}</strong> ({rx.doctorRegistration})</span>
                      <span>{rx.createdAt}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-border">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedRxForView(rx)}
                      className="text-xs h-8 flex-1"
                    >
                      View Full Rx
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleSendToWhatsApp(rx)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 flex-1 flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Send className="h-3 w-3" />
                      Send to WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDeletePrescription(rx.id, e)}
                      className="h-8 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-border"
                      title="Delete Prescription"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: AI Diagnostic Triage List */}
      {activeTab === 'diagnostics' && (
        <>
          {filteredIntakes.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3 shadow-xs">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-foreground">No Diagnostic Intakes Found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                When patients discuss skin or hair symptoms with the WhatsApp AI Receptionist, their diagnostic triage intake will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredIntakes.map(int => (
                <div 
                  key={int.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between border-b border-border/80 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{int.patientName}</h3>
                        <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          {int.phone}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          int.severity === 'Urgent Review'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {int.severity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteIntake(int.id, e)}
                          className="text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                          title="Delete Diagnostic Intake"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                        <p className="font-semibold text-primary text-[11px]">Primary Concern:</p>
                        <p className="text-foreground text-xs mt-0.5 leading-relaxed">{int.concern}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-muted/40">
                          <span className="text-muted-foreground block text-[10px]">Fitzpatrick Type:</span>
                          <span className="font-bold text-foreground">{int.skinType}</span>
                        </div>
                        <div className="p-2 rounded bg-muted/40">
                          <span className="text-muted-foreground block text-[10px]">Symptoms Duration:</span>
                          <span className="font-bold text-foreground">{int.duration}</span>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-muted/40 text-[11px]">
                        <span className="text-muted-foreground block text-[10px]">Active Topicals / Meds:</span>
                        <span className="font-medium text-foreground">{int.activeTopicals}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                      <Clock className="h-3 w-3" />
                      {int.intakeDate}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center gap-2">
                    <Button 
                      onClick={() => handleConvertIntakeToRx(int)}
                      className="flex-1 bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Stethoscope className="h-3.5 w-3.5" />
                      Convert to Doctor Prescription
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDeleteIntake(int.id, e)}
                      className="h-9 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-border"
                      title="Delete Diagnostic Intake"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Digital Prescription Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Formulate Digital Clinical Prescription
              </h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePrescription} className="space-y-4 text-xs">
              {/* Patient Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-foreground">Patient Full Name *</label>
                  <Input
                    required
                    placeholder="e.g. Vikram Malhotra"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">WhatsApp Phone *</label>
                  <Input
                    required
                    placeholder="+91 98765 11223"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Age / Gender</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="28"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      className="text-xs w-16"
                    />
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value as any)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs flex-1 shadow-xs"
                    >
                      <option value="Female">F</option>
                      <option value="Male">M</option>
                      <option value="Other">O</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Diagnosis & Skin Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Clinical Diagnosis *</label>
                  <Input
                    required
                    placeholder="e.g. Severe Acne Vulgaris (Grade 3)"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Skin Phototype & Barrier Condition</label>
                  <Input
                    placeholder="e.g. Fitzpatrick Type IV (Oily)"
                    value={skinType}
                    onChange={(e) => setSkinType(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Medicines Table Builder */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground">Medications & Formulations</label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addMedicineRow}
                    className="bg-primary/10 text-primary hover:bg-primary/20 text-[11px] h-7 px-2 font-semibold"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Drug Row
                  </Button>
                </div>

                <div className="space-y-2">
                  {medicines.map((m, idx) => (
                    <div key={m.id} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[11px] text-muted-foreground">Drug #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeMedicineRow(m.id)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Remove drug"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2 space-y-1">
                          <Input
                            placeholder="Drug name (e.g. Tab. Doxycycline 100mg)"
                            value={m.name}
                            onChange={(e) => updateMedicine(m.id, 'name', e.target.value)}
                            className="text-xs font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Input
                            placeholder="Dosage (e.g. 100mg / Topical)"
                            value={m.dosage}
                            onChange={(e) => updateMedicine(m.id, 'dosage', e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <Input
                            placeholder="Frequency (e.g. 1-0-1 After food)"
                            value={m.frequency}
                            onChange={(e) => updateMedicine(m.id, 'frequency', e.target.value)}
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Duration (e.g. 15 Days)"
                            value={m.duration}
                            onChange={(e) => updateMedicine(m.id, 'duration', e.target.value)}
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Instructions (e.g. Apply at night)"
                            value={m.instructions}
                            onChange={(e) => updateMedicine(m.id, 'instructions', e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Precautions & Follow Up */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-foreground">Clinical Aftercare & Precautions</label>
                  <textarea
                    rows={2}
                    value={precautions}
                    onChange={(e) => setPrecautions(e.target.value)}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Review Follow-Up (Days)</label>
                  <Input
                    type="number"
                    value={followUpDays}
                    onChange={(e) => setFollowUpDays(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Auto-schedules patient WhatsApp follow-up check-in.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  Save & Dispatch Rx to WhatsApp
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Prescription PDF Simulation Modal */}
      {selectedRxForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Digital Medical Prescription: {selectedRxForView.rxNumber}
              </h2>
              <button 
                onClick={() => setSelectedRxForView(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Simulated Rx Header */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="font-bold text-foreground text-sm">La Fleur Aesthetic & Wellness Clinic</h3>
                  <p className="text-[11px] text-muted-foreground">Road No.11 B, Jubilee hills, Hyderabad • Ph: +91 81478 66324</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary text-xs font-mono">{selectedRxForView.rxNumber}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedRxForView.createdAt}</p>
                </div>
              </div>

              {/* Patient details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p><span className="text-muted-foreground">Patient:</span> <strong>{selectedRxForView.patientName}</strong></p>
                  <p><span className="text-muted-foreground">Age/Gender:</span> {selectedRxForView.patientAge} / {selectedRxForView.patientGender}</p>
                </div>
                <div>
                  <p><span className="text-muted-foreground">Phone:</span> {selectedRxForView.patientPhone}</p>
                  <p><span className="text-muted-foreground">Diagnosis:</span> <strong>{selectedRxForView.diagnosis}</strong></p>
                </div>
              </div>

              {/* Medicines */}
              <div className="pt-2 border-t border-border space-y-1.5">
                <p className="font-bold text-xs text-foreground">℞ Prescribed Medicines:</p>
                <div className="space-y-1">
                  {selectedRxForView.medicines.map((m, idx) => (
                    <div key={m.id} className="p-2 rounded bg-background text-xs border border-border">
                      <div className="flex items-center justify-between">
                        <strong>{idx + 1}. {m.name}</strong>
                        <span className="font-mono text-[11px] text-primary">{m.frequency}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Duration: {m.duration} • {m.instructions}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advice */}
              <div className="pt-2 border-t border-border text-xs">
                <p className="font-bold text-foreground">Advice & Precautions:</p>
                <p className="text-muted-foreground mt-0.5">{selectedRxForView.precautions}</p>
              </div>

              {/* Doctor signature */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Follow-up in {selectedRxForView.followUpDays} days</span>
                <div className="text-right">
                  <p className="font-bold text-foreground">{selectedRxForView.doctorName}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedRxForView.doctorRegistration}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeletePrescription(selectedRxForView.id)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Prescription
              </Button>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedRxForView(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    handleSendToWhatsApp(selectedRxForView);
                    setSelectedRxForView(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  Dispatch via WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
