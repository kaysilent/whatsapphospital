"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
  LayoutGrid, 
  Plus, 
  Phone, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Stethoscope, 
  Search, 
  Filter, 
  TrendingUp, 
  DollarSign, 
  Sparkles, 
  Flame, 
  Trash2,
  CheckCheck,
  RotateCcw,
  AlertTriangle,
  X,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Department, 
  DEFAULT_DEPARTMENTS, 
  getRuntimeDepartments, 
  matchDepartmentName 
} from '@/lib/hospital/departments';

export interface PipelineCard {
  id: string;
  name: string;
  phone: string;
  department: string;
  service: string;
  dealValue: number;
  currency: string;
  summary: string;
  timeAgo: string;
  priority: 'High' | 'Medium' | 'Normal';
  source: 'WhatsApp AI' | 'Direct Walk-in' | 'Meta Ad' | 'Website';
  stageId: string;
  clinicalNote?: string;
}

export interface KanbanStage {
  id: string;
  title: string;
  description: string;
  badgeColor: string;
  dotColor: string;
}

const STAGES: KanbanStage[] = [
  {
    id: "inbound",
    title: "1. WhatsApp Inbound",
    description: "New inquiries captured via WhatsApp AI",
    badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20",
    dotColor: "bg-sky-500"
  },
  {
    id: "triage",
    title: "2. AI Clinical Triage",
    description: "Intake collected: skin type, symptoms & duration",
    badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dotColor: "bg-amber-500"
  },
  {
    id: "confirmed",
    title: "3. Confirmed & Paid Slot",
    description: "Booking locked with ₹ token advance",
    badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dotColor: "bg-emerald-500"
  },
  {
    id: "won",
    title: "4. Treatment Delivered",
    description: "Consultation & procedure completed",
    badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    dotColor: "bg-purple-500"
  },
  {
    id: "retention",
    title: "5. Post-Care & Sittings",
    description: "Routine follow-up & multi-sitting package",
    badgeColor: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20",
    dotColor: "bg-teal-500"
  }
];

const INITIAL_CARDS: PipelineCard[] = [
  {
    id: "card_1",
    name: "Neha Joshi",
    phone: "+91 98321 00011",
    department: "Laser & Aesthetics",
    service: "Full Body Laser Hair Reduction (6 Sittings)",
    dealValue: 24000,
    currency: "₹",
    summary: "Inquired about laser session intervals and skin cooling safety. AI shared package details.",
    timeAgo: "15m ago",
    priority: "High",
    source: "WhatsApp AI",
    stageId: "inbound",
    clinicalNote: "Fitzpatrick Skin Type IV, coarse hair follicles, no active photosensitizing drugs."
  },
  {
    id: "card_2",
    name: "Pooja Hegde",
    phone: "+91 98112 33445",
    department: "Trichology & Hair Restoration",
    service: "PRP + GFC Hair Follicle Therapy",
    dealValue: 16000,
    currency: "₹",
    summary: "Slot confirmed for Tomorrow 11:30 AM with Dr. Mrinalini. ₹500 booking fee verified via Razorpay.",
    timeAgo: "2h ago",
    priority: "High",
    source: "WhatsApp AI",
    stageId: "confirmed",
    clinicalNote: "Norwood Scale Grade 2 diffuse thinning; baseline photos scheduled for consultation."
  }
];

const PIPELINE_STORAGE_KEY = 'wacrm_pipeline_cards_v1';

export default function PipelinesPage() {
  const [cards, setCards] = useState<PipelineCard[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(PIPELINE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return INITIAL_CARDS;
  });

  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCardForNotes, setSelectedCardForNotes] = useState<PipelineCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<PipelineCard | null>(null);

  // Sync cards to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(cards));
    } catch {}
  }, [cards]);

  // Load and subscribe to dynamic hospital clinical departments
  useEffect(() => {
    const loadDepartments = () => {
      const activeDepts = getRuntimeDepartments();
      setDepartments(activeDepts);
    };

    loadDepartments();

    // Fetch from API to ensure backend sync
    fetch('/api/hospital/departments')
      .then(res => res.json())
      .then(data => {
        if (data?.departments && Array.isArray(data.departments) && data.departments.length > 0) {
          setDepartments(data.departments);
        }
      })
      .catch(() => {});

    const handleUpdate = () => loadDepartments();
    window.addEventListener('departments-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('departments-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const activeDepartments = useMemo(() => {
    return departments.filter(d => d.isActive !== false);
  }, [departments]);

  // New Lead Form State
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('+91 ');
  const [newLeadDept, setNewLeadDept] = useState('Dermatology & Skin Care');
  const [newLeadService, setNewLeadService] = useState('Doctor Consultation & Diagnosis');
  const [newLeadValue, setNewLeadValue] = useState('3500');
  const [newLeadPriority, setNewLeadPriority] = useState<'High' | 'Medium' | 'Normal'>('High');
  const [newLeadStage, setNewLeadStage] = useState('inbound');
  const [newLeadSummary, setNewLeadSummary] = useState('');

  // Keep newLeadDept default in sync with loaded active departments
  useEffect(() => {
    if (activeDepartments.length > 0 && !activeDepartments.some(d => d.name === newLeadDept)) {
      setNewLeadDept(activeDepartments[0].name);
    }
  }, [activeDepartments, newLeadDept]);

  // Calculations
  const totalPipelineValue = useMemo(() => {
    return cards.reduce((acc, card) => acc + card.dealValue, 0);
  }, [cards]);

  const wonDealsValue = useMemo(() => {
    return cards
      .filter(c => c.stageId === 'won' || c.stageId === 'retention')
      .reduce((acc, card) => acc + card.dealValue, 0);
  }, [cards]);

  const activeLeadsCount = cards.length;

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchesSearch = 
        card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.phone.includes(searchQuery) ||
        card.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.department.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (departmentFilter === 'All') return true;

      const filterDeptNormalized = matchDepartmentName(departmentFilter, departments).toLowerCase();
      const cardDeptNormalized = matchDepartmentName(card.department, departments).toLowerCase();

      return (
        card.department.toLowerCase() === departmentFilter.toLowerCase() ||
        filterDeptNormalized === cardDeptNormalized ||
        card.department.toLowerCase().includes(departmentFilter.toLowerCase()) ||
        departmentFilter.toLowerCase().includes(card.department.toLowerCase())
      );
    });
  }, [cards, searchQuery, departmentFilter, departments]);

  // Stage card movement
  const moveCard = (cardId: string, direction: 'next' | 'prev') => {
    setCards(prevCards => {
      return prevCards.map(card => {
        if (card.id !== cardId) return card;
        const currentIndex = STAGES.findIndex(s => s.id === card.stageId);
        if (direction === 'next' && currentIndex < STAGES.length - 1) {
          const nextStage = STAGES[currentIndex + 1];
          toast.success(`Moved ${card.name} to ${nextStage.title}`);
          return { ...card, stageId: nextStage.id, timeAgo: 'Just now' };
        }
        if (direction === 'prev' && currentIndex > 0) {
          const prevStage = STAGES[currentIndex - 1];
          toast.info(`Moved ${card.name} back to ${prevStage.title}`);
          return { ...card, stageId: prevStage.id, timeAgo: 'Just now' };
        }
        return card;
      });
    });
  };

  // Delete Card Handler
  const confirmDeleteCard = (card: PipelineCard) => {
    const deletedCard = card;
    setCards(prev => prev.filter(c => c.id !== card.id));
    setCardToDelete(null);
    toast.success(`Lead for "${deletedCard.name}" removed from pipeline.`, {
      action: {
        label: 'Undo',
        onClick: () => {
          setCards(prev => [deletedCard, ...prev]);
          toast.info(`Restored ${deletedCard.name} to pipeline.`);
        }
      }
    });
  };

  // Complete Journey Handler (Stage 5)
  const completePatientJourney = (card: PipelineCard) => {
    const completedCard = card;
    setCards(prev => prev.filter(c => c.id !== card.id));
    toast.success(`🎉 Patient journey for ${completedCard.name} marked Complete & Discharged!`, {
      description: `Procedure package finished. Record archived from active pipeline.`,
      action: {
        label: 'Undo',
        onClick: () => {
          setCards(prev => [completedCard, ...prev]);
          toast.info(`Restored ${completedCard.name} to Stage 5.`);
        }
      }
    });
  };

  const handleResetSampleLeads = () => {
    setCards(INITIAL_CARDS);
    toast.success('Reset pipeline cards to initial sample leads.');
  };

  const handleAddDirectLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      toast.error('Please provide a patient name and phone number');
      return;
    }

    const newCard: PipelineCard = {
      id: `card_${Date.now()}`,
      name: newLeadName.trim(),
      phone: newLeadPhone.trim(),
      department: newLeadDept,
      service: newLeadService.trim() || 'Clinical Consultation',
      dealValue: parseFloat(newLeadValue) || 500,
      currency: '₹',
      summary: newLeadSummary.trim() || 'Direct lead logged by clinic reception.',
      timeAgo: 'Just now',
      priority: newLeadPriority,
      source: 'Direct Walk-in',
      stageId: newLeadStage,
      clinicalNote: 'Patient inquiry registered at clinic desk. Awaiting doctor evaluation.'
    };

    setCards(prev => [newCard, ...prev]);
    setIsAddModalOpen(false);
    toast.success(`Direct lead for ${newLeadName} added to ${STAGES.find(s => s.id === newLeadStage)?.title}`);

    // Reset Form
    setNewLeadName('');
    setNewLeadPhone('+91 ');
    setNewLeadService('Doctor Consultation & Diagnosis');
    setNewLeadValue('3500');
    setNewLeadSummary('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Sales & Patient Pipeline Kanban
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Track patient journeys from initial WhatsApp inquiry to AI triage, booked consultation, and completed procedures.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {cards.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSampleLeads}
              className="text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Sample Leads
            </Button>
          )}
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Direct Patient Lead
          </Button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total Pipeline Value</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2 font-mono">
            ₹{totalPipelineValue.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3" />
            Across 5 Clinical Stages
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Realized Clinic Revenue</span>
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-2 font-mono">
            ₹{wonDealsValue.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Delivered & Paid Sittings
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Active Pipeline Leads</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2">
            {activeLeadsCount} Patients
          </p>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 block">
            WhatsApp AI Synced
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Booking Conversion Rate</span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            84.6%
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            AI Automated Pre-Triage
          </span>
        </div>
      </div>

      {/* Filter and Search Bar with Dynamic Clinical Departments */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/60">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search patient, phone, department, procedure..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-border text-xs focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />
          
          {/* 'All' Filter Chip */}
          <button
            onClick={() => setDepartmentFilter('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              departmentFilter === 'All'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              departmentFilter === 'All' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/80 text-muted-foreground'
            }`}>
              {cards.length}
            </span>
          </button>

          {/* Dynamic Active Clinical Department Chips */}
          {activeDepartments.map(dept => {
            const count = cards.filter(c => {
              const filterDeptNorm = matchDepartmentName(dept.name, departments).toLowerCase();
              const cardDeptNorm = matchDepartmentName(c.department, departments).toLowerCase();
              return c.department.toLowerCase() === dept.name.toLowerCase() ||
                     filterDeptNorm === cardDeptNorm ||
                     c.department.toLowerCase().includes(dept.name.toLowerCase()) ||
                     dept.name.toLowerCase().includes(c.department.toLowerCase());
            }).length;

            const isSelected = departmentFilter === dept.name;

            return (
              <button
                key={dept.id}
                onClick={() => setDepartmentFilter(dept.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{dept.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/80 text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanban Board Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start overflow-x-auto pb-6">
        {STAGES.map((stage, sIndex) => {
          const stageCards = filteredCards.filter(c => c.stageId === stage.id);
          const stageValue = stageCards.reduce((acc, c) => acc + c.dealValue, 0);

          return (
            <div 
              key={stage.id} 
              className="flex flex-col rounded-xl border border-border bg-card/70 p-3 shadow-xs min-h-[500px]"
            >
              {/* Column Header */}
              <div className="pb-3 border-b border-border/80 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${stage.dotColor}`} />
                    {stage.title}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stage.badgeColor}`}>
                    {stageCards.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                  <span>₹{stageValue.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] truncate max-w-[120px]">{stage.description}</span>
                </div>
              </div>

              {/* Cards Stream */}
              <div className="space-y-3 flex-1">
                {stageCards.length === 0 ? (
                  <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 text-xs text-muted-foreground p-3 text-center">
                    <p className="text-[11px]">No active leads in this stage</p>
                  </div>
                ) : (
                  stageCards.map(card => (
                    <div 
                      key={card.id}
                      className="group relative rounded-lg border border-border bg-card p-3.5 shadow-xs hover:border-primary/50 hover:shadow-sm transition-all space-y-2.5"
                    >
                      {/* Top row: Name, Priority & Quick Delete */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground hover:text-primary transition-colors truncate">
                            {card.name}
                          </p>
                          <a 
                            href={`https://wa.me/${card.phone.replace(/[^0-9]/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="h-3 w-3" />
                            {card.phone}
                          </a>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            card.priority === 'High'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {card.priority}
                          </span>

                          {/* Delete Patient Lead Button - Always Visible & Clearly Highlighted */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardToDelete(card);
                            }}
                            title="Delete Patient Lead"
                            aria-label={`Delete ${card.name}`}
                            className="p-1 rounded-md text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-xs"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Clinical Department Badge & Service */}
                      <div className="p-2 rounded bg-muted/40 border border-border/60">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span className="font-medium text-primary truncate max-w-[140px]">
                            {card.department}
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            ₹{card.dealValue.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-foreground truncate">
                          {card.service}
                        </p>
                      </div>

                      {/* Summary */}
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {card.summary}
                      </p>

                      {/* Clinical Note Pill if available */}
                      {card.clinicalNote && (
                        <button
                          onClick={() => setSelectedCardForNotes(card)}
                          className="w-full text-left p-1.5 rounded bg-primary/5 border border-primary/15 text-[10px] text-primary hover:bg-primary/10 transition-colors flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1 font-medium truncate">
                            <Stethoscope className="h-2.5 w-2.5 shrink-0" />
                            Diagnostic Note
                          </span>
                          <span className="text-[9px] underline">View</span>
                        </button>
                      )}

                      {/* Card Footer: Movement & Completion Controls */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {card.timeAgo}
                        </span>

                        <div className="flex items-center gap-1">
                          {sIndex > 0 && (
                            <button
                              onClick={() => moveCard(card.id, 'prev')}
                              title="Move to Previous Stage"
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* If Stage 5 (Post-Care & Sittings), provide "Complete Journey" action */}
                          {sIndex === STAGES.length - 1 ? (
                            <button
                              onClick={() => completePatientJourney(card)}
                              title="Mark Patient Journey as Complete & Archive"
                              className="p-1 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition-colors flex items-center gap-1 font-semibold px-2 py-0.5"
                            >
                              <CheckCheck className="h-3 w-3" />
                              <span>Complete</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => moveCard(card.id, 'next')}
                              title="Advance to Next Stage"
                              className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-0.5 font-medium px-1.5"
                            >
                              <span>Next</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Deleting Lead */}
      {cardToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Remove Lead from Pipeline?
              </h2>
              <button 
                onClick={() => setCardToDelete(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Are you sure you want to delete <strong className="text-foreground">{cardToDelete.name}</strong> from active pipeline tracking?
              </p>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/80 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-semibold text-foreground">{cardToDelete.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-mono text-foreground">{cardToDelete.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="text-primary font-medium">{cardToDelete.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Procedure:</span>
                  <span className="text-foreground">{cardToDelete.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Value:</span>
                  <span className="font-bold text-foreground">₹{cardToDelete.dealValue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCardToDelete(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="button"
                  variant="destructive"
                  onClick={() => confirmDeleteCard(cardToDelete)}
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Yes, Delete Lead
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Direct Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add Direct Patient Lead
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddDirectLead} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Patient Full Name *</label>
                  <Input
                    required
                    placeholder="e.g. Ananya Sharma"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">WhatsApp Phone Number *</label>
                  <Input
                    required
                    placeholder="+91 98765 43210"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground flex items-center justify-between">
                    <span>Clinical Department</span>
                    <span className="text-[10px] text-muted-foreground">Dynamic</span>
                  </label>
                  <select
                    value={newLeadDept}
                    onChange={(e) => setNewLeadDept(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {activeDepartments.map(dept => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Target Service / Procedure</label>
                  <Input
                    placeholder="e.g. HydraFacial Deluxe"
                    value={newLeadService}
                    onChange={(e) => setNewLeadService(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Estimated Value (₹)</label>
                  <Input
                    type="number"
                    placeholder="3500"
                    value={newLeadValue}
                    onChange={(e) => setNewLeadValue(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Priority</label>
                  <select
                    value={newLeadPriority}
                    onChange={(e) => setNewLeadPriority(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Initial Stage</label>
                  <select
                    value={newLeadStage}
                    onChange={(e) => setNewLeadStage(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    {STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Clinical Summary & Inquiry Details</label>
                <textarea
                  rows={2}
                  placeholder="Patient stated concern, previous treatments, or preferred consultation time..."
                  value={newLeadSummary}
                  onChange={(e) => setNewLeadSummary(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Add Lead to Kanban
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clinical Diagnostic Note View Modal */}
      {selectedCardForNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                Pre-Consultation Clinical Diagnostic Note
              </h2>
              <button 
                onClick={() => setSelectedCardForNotes(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <p className="font-bold text-foreground">{selectedCardForNotes.name}</p>
                <p className="text-muted-foreground font-mono">{selectedCardForNotes.phone} • {selectedCardForNotes.department}</p>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-foreground">Diagnostic Triage Findings:</p>
                <p className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-foreground leading-relaxed">
                  {selectedCardForNotes.clinicalNote}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border mt-3">
                <Button 
                  variant="outline"
                  onClick={() => {
                    const card = selectedCardForNotes;
                    setSelectedCardForNotes(null);
                    setCardToDelete(card);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Patient
                </Button>
                <Button 
                  onClick={() => setSelectedCardForNotes(null)}
                  className="bg-primary text-primary-foreground text-xs font-medium"
                >
                  Close Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
