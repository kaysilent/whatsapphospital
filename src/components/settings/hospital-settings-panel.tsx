'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Stethoscope, 
  Sparkles, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Save, 
  RotateCcw, 
  Clock, 
  IndianRupee, 
  Layers, 
  ShieldCheck, 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  AlertCircle, 
  Flame, 
  Check, 
  X,
  ExternalLink,
  MessageSquare,
  CalendarDays,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  Treatment, 
  TreatmentCategory, 
  HospitalProfile, 
  DEFAULT_HOSPITAL_PROFILE, 
  DEFAULT_TREATMENTS,
  DEFAULT_HOSPITAL_TIMINGS,
  DEFAULT_WEEKLY_SCHEDULE,
  DaySchedule,
  HospitalTimingsConfig,
  getRuntimeHospitalProfile,
  getRuntimeTreatments,
  saveHospitalProfile,
  saveTreatments
} from '@/lib/hospital/treatments';
import { useAuth } from '@/hooks/use-auth';
import { canEditClinicalConfig } from '@/lib/auth/roles';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const CATEGORIES: Array<TreatmentCategory | 'All'> = [
  'All',
  'Skin',
  'Laser',
  'Aesthetic',
  'Body',
  'Hair',
  'Wellness',
  'Consultation',
];

const CATEGORY_COLORS: Record<TreatmentCategory, { bg: string; text: string; border: string }> = {
  Skin: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
  Laser: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  Aesthetic: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  Body: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  Hair: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  Wellness: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30' },
  Consultation: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
};

export function HospitalSettingsPanel() {
  const { accountRole } = useAuth();
  const canEdit = canEditClinicalConfig(accountRole || 'staff');

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'treatments'>('treatments');
  const [profile, setProfile] = useState<HospitalProfile>(DEFAULT_HOSPITAL_PROFILE);
  const [treatments, setTreatments] = useState<Treatment[]>(DEFAULT_TREATMENTS);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showDayByDaySchedule, setShowDayByDaySchedule] = useState(false);

  // Timing update helpers
  const updateTimings = (updates: Partial<HospitalTimingsConfig>) => {
    setProfile(prev => {
      const currentTimings = prev.timings || DEFAULT_HOSPITAL_TIMINGS;
      const nextTimings = { ...currentTimings, ...updates };
      return {
        ...prev,
        timings: nextTimings,
      };
    });
  };

  const handleDayScheduleUpdate = (index: number, updates: Partial<DaySchedule>) => {
    setProfile(prev => {
      const currentTimings = prev.timings || DEFAULT_HOSPITAL_TIMINGS;
      const nextSchedule = [...(currentTimings.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE)];
      nextSchedule[index] = { ...nextSchedule[index], ...updates };
      return {
        ...prev,
        timings: {
          ...currentTimings,
          weeklySchedule: nextSchedule,
        },
      };
    });
  };

  const handleAutoGenerateSummary = () => {
    const currentTimings = profile.timings || DEFAULT_HOSPITAL_TIMINGS;
    const generatedSummary = `Monday – Saturday: ${currentTimings.weekdayOpen || '10:00 AM'} – ${currentTimings.weekdayClose || '07:00 PM'} (Lunch: ${currentTimings.lunchStart || '01:00 PM'} – ${currentTimings.lunchEnd || '02:00 PM'}) · ${currentTimings.isSundayOpen ? `Sunday: ${currentTimings.sundayOpen || '10:00 AM'} – ${currentTimings.sundayClose || '02:00 PM'}` : 'Sunday: Closed'}`;
    setProfile(prev => ({ ...prev, openingHoursSummary: generatedSummary }));
  };

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TreatmentCategory | 'All'>('All');

  // Treatment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [treatmentFormData, setTreatmentFormData] = useState<Partial<Treatment>>({
    name: '',
    category: 'Skin',
    description: '',
    durationMinutes: 30,
    price: 2500,
    currency: '₹',
    recommendedSittings: 1,
    sittingInterval: 'As advised',
    sittingIntervalDays: 30,
    preCareAdvice: '',
    postCareAdvice: '',
    isActive: true,
    isPopular: false,
  });

  // Load saved data on mount
  useEffect(() => {
    setProfile(getRuntimeHospitalProfile());
    setTreatments(getRuntimeTreatments());
  }, []);

  const handleSaveProfile = async () => {
    saveHospitalProfile(profile);
    try {
      await fetch('/api/hospital/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
    } catch {}

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleSaveTreatments = async (updated: Treatment[]) => {
    setTreatments(updated);
    saveTreatments(updated);
    try {
      await fetch('/api/hospital/treatments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatments: updated }),
      });
    } catch {}

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleOpenAddModal = () => {
    setEditingTreatment(null);
    setTreatmentFormData({
      name: '',
      category: 'Skin',
      description: '',
      durationMinutes: 30,
      price: 2500,
      currency: '₹',
      recommendedSittings: 1,
      sittingInterval: 'As advised',
      sittingIntervalDays: 30,
      preCareAdvice: '',
      postCareAdvice: '',
      isActive: true,
      isPopular: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: Treatment) => {
    setEditingTreatment(t);
    setTreatmentFormData({ ...t });
    setIsModalOpen(true);
  };

  const handleSaveTreatmentModal = () => {
    if (!treatmentFormData.name?.trim()) return;

    if (editingTreatment) {
      // Edit existing
      const updated = treatments.map(t => 
        t.id === editingTreatment.id 
          ? {
              ...t,
              ...treatmentFormData,
              name: treatmentFormData.name!.trim(),
              updatedAt: new Date().toISOString(),
            } as Treatment
          : t
      );
      handleSaveTreatments(updated);
    } else {
      // Create new
      const newTreatment: Treatment = {
        id: `trt-${Date.now()}`,
        name: treatmentFormData.name!.trim(),
        category: treatmentFormData.category || 'Skin',
        description: treatmentFormData.description?.trim() || '',
        durationMinutes: Number(treatmentFormData.durationMinutes) || 30,
        price: Number(treatmentFormData.price) || 0,
        currency: treatmentFormData.currency || '₹',
        recommendedSittings: Number(treatmentFormData.recommendedSittings) || 1,
        sittingInterval: treatmentFormData.sittingInterval?.trim() || 'As advised',
        sittingIntervalDays: Number(treatmentFormData.sittingIntervalDays) || 30,
        preCareAdvice: treatmentFormData.preCareAdvice?.trim() || '',
        postCareAdvice: treatmentFormData.postCareAdvice?.trim() || '',
        isActive: treatmentFormData.isActive !== false,
        isPopular: !!treatmentFormData.isPopular,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      handleSaveTreatments([newTreatment, ...treatments]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteTreatment = (id: string) => {
    if (confirm('Are you sure you want to remove this treatment from the hospital catalogue?')) {
      const updated = treatments.filter(t => t.id !== id);
      handleSaveTreatments(updated);
    }
  };

  const handleToggleActive = (id: string) => {
    const updated = treatments.map(t => 
      t.id === id ? { ...t, isActive: !t.isActive, updatedAt: new Date().toISOString() } : t
    );
    handleSaveTreatments(updated);
  };

  const handleResetToDefault = () => {
    if (confirm('Reset treatments to standard clinic catalog (11 default aesthetic & dermatology treatments)?')) {
      handleSaveTreatments(DEFAULT_TREATMENTS);
    }
  };

  // Filtered Treatments
  const filteredTreatments = useMemo(() => {
    return treatments.filter(t => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [treatments, searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    const total = treatments.length;
    const active = treatments.filter(t => t.isActive).length;
    const popular = treatments.filter(t => t.isPopular && t.isActive).length;
    const avgPrice = total > 0 ? Math.round(treatments.reduce((acc, t) => acc + t.price, 0) / total) : 0;
    return { total, active, popular, avgPrice };
  }, [treatments]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Hospital & Treatments Manager
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  <Stethoscope className="h-3 w-3" />
                  {profile.leadDoctor}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage clinic contact details, consultation policies, and treatments catalog synced with AI Receptionist.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {activeSubTab === 'profile' && canEdit && (
            <button
              type="button"
              onClick={handleSaveProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save Hospital Profile
            </button>
          )}

          {activeSubTab === 'treatments' && canEdit && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Treatment
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {savedSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Hospital details and treatments catalog successfully updated and synchronized with AI Receptionist!</span>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('treatments')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'treatments'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Treatments & Services Catalog ({treatments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('profile')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Hospital Profile & Contact Info
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: TREATMENTS CATALOG */}
      {/* ========================================================================= */}
      {activeSubTab === 'treatments' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Services</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">{stats.total}</span>
                <span className="text-[11px] text-muted-foreground">treatments</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active on WhatsApp</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.active}</span>
                <span className="text-[11px] text-emerald-600/80">available</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Featured / Popular</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.popular}</span>
                <span className="text-[11px] text-purple-600/80">highlighted</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Avg. Treatment Fee</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">₹{stats.avgPrice.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-muted-foreground">estimate</span>
              </div>
            </div>
          </div>

          {/* Search, Filter & Actions Header */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search treatment by name, category, or symptoms..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-background border border-input rounded-xl pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Reset Catalog Button */}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  title="Reset to default 11 hospital treatments"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Default Catalog</span>
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map(cat => {
                const count = cat === 'All' ? treatments.length : treatments.filter(t => t.category === cat).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/80 text-muted-foreground border'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Treatments Grid */}
          {filteredTreatments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">No treatments match your criteria</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Try searching for another keyword or add a new custom treatment for your clinic.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add New Treatment
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTreatments.map(t => {
                const colors = CATEGORY_COLORS[t.category] || CATEGORY_COLORS.Skin;
                return (
                  <div
                    key={t.id}
                    className={`group rounded-2xl border bg-card p-5 space-y-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                      !t.isActive ? 'opacity-60 bg-muted/30' : ''
                    } ${t.isPopular ? 'ring-1 ring-purple-500/30' : ''}`}
                  >
                    <div className="space-y-3">
                      {/* Top Badges & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                            {t.category}
                          </span>
                          {t.isPopular && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <Flame className="h-2.5 w-2.5 fill-amber-500" />
                              Popular
                            </span>
                          )}
                        </div>

                        {/* Active Toggle */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(t.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                              t.isActive
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                            }`}
                          >
                            {t.isActive ? 'Active' : 'Disabled'}
                          </button>
                        )}
                      </div>

                      {/* Title & Price */}
                      <div>
                        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          {t.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-base font-black text-foreground">
                            {t.currency}{t.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t.durationMinutes} mins
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {t.description}
                      </p>

                      {/* Sittings & Protocol */}
                      <div className="rounded-xl bg-muted/50 p-2.5 text-[11px] text-foreground space-y-1 border border-border/60">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Layers className="h-3 w-3 text-primary" />
                            Protocol:
                          </span>
                          <span className="text-primary font-bold">
                            {t.recommendedSittings} Sitting{t.recommendedSittings > 1 ? 's' : ''} ({t.sittingInterval})
                          </span>
                        </div>
                        {t.postCareAdvice && (
                          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 truncate">
                            <strong className="text-foreground">Post-Care:</strong> {t.postCareAdvice}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    {canEdit && (
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTreatment(t.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: HOSPITAL PROFILE & CONTACT */}
      {/* ========================================================================= */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Hospital Details Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Clinic Identity & Basic Info</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Hospital / Clinic Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Clinic Tagline / Subtitle</label>
                  <input
                    type="text"
                    value={profile.tagline}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, tagline: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Sole Lead Doctor</label>
                  <input
                    type="text"
                    value={profile.leadDoctor}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, leadDoctor: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Doctor Qualification & Title</label>
                  <input
                    type="text"
                    value={profile.doctorTitle}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, doctorTitle: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Contact Channels & Location */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Phone className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-foreground">Contact Channels & Physical Address</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Official WhatsApp Number</label>
                  <input
                    type="text"
                    value={profile.whatsapp}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Clinic Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Street Address / Suite / Landmark</label>
                  <input
                    type="text"
                    value={profile.address}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">City</label>
                  <input
                    type="text"
                    value={profile.city}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Postal / ZIP Code</label>
                  <input
                    type="text"
                    value={profile.postalCode}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, postalCode: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Emergency Hotline</label>
                  <input
                    type="text"
                    value={profile.emergencyContact}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, emergencyContact: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Website URL</label>
                  <input
                    type="text"
                    value={profile.website}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Policies & Consultation Fees */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <IndianRupee className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Policies & Consultation Charges</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Consultation Fee (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      value={profile.consultationFee}
                      disabled={!canEdit}
                      onChange={e => setProfile(prev => ({ ...prev, consultationFee: Number(e.target.value) }))}
                      className="w-full text-xs bg-background border border-input rounded-xl pl-7 pr-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Consultation Currency</label>
                  <input
                    type="text"
                    value={profile.currency}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">About Clinic & Clinical Specialty</label>
                  <textarea
                    rows={3}
                    value={profile.aboutText}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, aboutText: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Hospital & Clinic Timings Section */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Hospital Timings & Operating Hours</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Configure standard clinic opening/closing hours, lunch break, and daily OPD schedules.
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={handleAutoGenerateSummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-primary transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Auto-Sync Summary</span>
                  </button>
                )}
              </div>

              {/* Standard Daily Timings Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Weekday Opening Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM"
                    value={profile.timings?.weekdayOpen || '10:00 AM'}
                    disabled={!canEdit}
                    onChange={e => updateTimings({ weekdayOpen: e.target.value })}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Weekday Closing Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 07:00 PM"
                    value={profile.timings?.weekdayClose || '07:00 PM'}
                    disabled={!canEdit}
                    onChange={e => updateTimings({ weekdayClose: e.target.value })}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Lunch Break Starts</label>
                  <input
                    type="text"
                    placeholder="e.g. 01:00 PM"
                    value={profile.timings?.lunchStart || '01:00 PM'}
                    disabled={!canEdit}
                    onChange={e => updateTimings({ lunchStart: e.target.value })}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Lunch Break Ends</label>
                  <input
                    type="text"
                    placeholder="e.g. 02:00 PM"
                    value={profile.timings?.lunchEnd || '02:00 PM'}
                    disabled={!canEdit}
                    onChange={e => updateTimings({ lunchEnd: e.target.value })}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>
              </div>

              {/* Sunday & Weekend Schedule */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!profile.timings?.isSundayOpen}
                      disabled={!canEdit}
                      onChange={e => updateTimings({ isSundayOpen: e.target.checked })}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span>Open on Sunday / Weekend OPD</span>
                  </label>

                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    profile.timings?.isSundayOpen 
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' 
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {profile.timings?.isSundayOpen ? 'Sunday Open' : 'Sunday Closed'}
                  </span>
                </div>

                {profile.timings?.isSundayOpen && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Sunday Open Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 10:00 AM"
                        value={profile.timings?.sundayOpen || '10:00 AM'}
                        disabled={!canEdit}
                        onChange={e => updateTimings({ sundayOpen: e.target.value })}
                        className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Sunday Close Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 02:00 PM"
                        value={profile.timings?.sundayClose || '02:00 PM'}
                        disabled={!canEdit}
                        onChange={e => updateTimings({ sundayClose: e.target.value })}
                        className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Emergency & Summary Fields */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Emergency Coverage / After-Hours Note</label>
                  <input
                    type="text"
                    placeholder="e.g. 24/7 on-call emergency coverage for post-procedure patients."
                    value={profile.timings?.emergencyTimingNote || ''}
                    disabled={!canEdit}
                    onChange={e => updateTimings({ emergencyTimingNote: e.target.value })}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">Working Hours Summary (Displayed on WhatsApp)</label>
                    <span className="text-[10px] text-muted-foreground">Auto-sent to patients inquiring about hours</span>
                  </div>
                  <input
                    type="text"
                    value={profile.openingHoursSummary}
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, openingHoursSummary: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>
              </div>

              {/* Day-by-Day Schedule Customizer (Collapsible) */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowDayByDaySchedule(!showDayByDaySchedule)}
                  className="flex items-center justify-between w-full p-2.5 rounded-xl bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span>Detailed Day-by-Day Schedule (Monday – Sunday)</span>
                  </span>
                  {showDayByDaySchedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showDayByDaySchedule && (
                  <div className="space-y-2.5 pt-3 animate-fade-in">
                    {(profile.timings?.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE).map((ds, idx) => (
                      <div
                        key={ds.day}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                          ds.isOpen ? 'bg-card border-border' : 'bg-muted/30 border-dashed border-border opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:w-36 shrink-0">
                          <input
                            type="checkbox"
                            checked={ds.isOpen}
                            disabled={!canEdit}
                            onChange={e => handleDayScheduleUpdate(idx, { isOpen: e.target.checked })}
                            className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
                          />
                          <span className="font-bold text-foreground">{ds.day}</span>
                        </div>

                        {ds.isOpen ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-muted-foreground block">Hours</span>
                              <input
                                type="text"
                                value={`${ds.openTime} – ${ds.closeTime}`}
                                disabled={!canEdit}
                                onChange={e => {
                                  const parts = e.target.value.split(/[–\-]/);
                                  handleDayScheduleUpdate(idx, {
                                    openTime: parts[0]?.trim() || ds.openTime,
                                    closeTime: parts[1]?.trim() || ds.closeTime,
                                  });
                                }}
                                className="w-full text-[11px] bg-background border border-input rounded-lg px-2 py-1 text-foreground"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <span className="text-[10px] text-muted-foreground block">Lunch Break</span>
                              <input
                                type="text"
                                value={ds.hasLunchBreak ? `${ds.lunchStart || '01:00 PM'} – ${ds.lunchEnd || '02:00 PM'}` : 'No Break'}
                                disabled={!canEdit}
                                onChange={e => {
                                  const parts = e.target.value.split(/[–\-]/);
                                  handleDayScheduleUpdate(idx, {
                                    hasLunchBreak: true,
                                    lunchStart: parts[0]?.trim() || ds.lunchStart,
                                    lunchEnd: parts[1]?.trim() || ds.lunchEnd,
                                  });
                                }}
                                className="w-full text-[11px] bg-background border border-input rounded-lg px-2 py-1 text-foreground"
                              />
                            </div>

                            <div className="space-y-0.5 col-span-2 sm:col-span-1">
                              <span className="text-[10px] text-muted-foreground block">OPD Focus / Notes</span>
                              <input
                                type="text"
                                value={ds.notes || ''}
                                disabled={!canEdit}
                                placeholder="e.g. Consultations & Laser"
                                onChange={e => handleDayScheduleUpdate(idx, { notes: e.target.value })}
                                className="w-full text-[11px] bg-background border border-input rounded-lg px-2 py-1 text-foreground"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 text-muted-foreground italic text-[11px]">
                            Clinic Closed / Weekly Holiday
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live AI WhatsApp Preview */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-foreground">Live AI WhatsApp Greeting</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                How AI Receptionist automatically greets patients using your saved hospital profile:
              </p>

              <div className="rounded-2xl bg-[#0b141a] p-4 text-xs font-sans text-slate-100 space-y-2.5 shadow-inner border border-emerald-900/30">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-700/60 text-[11px] text-emerald-400 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{profile.name} · WhatsApp Business</span>
                </div>
                <div className="bg-[#202c33] rounded-2xl rounded-tl-sm p-3 space-y-2 text-[12px] leading-relaxed">
                  <p>
                    Hello and welcome to <strong>{profile.name}</strong> ({profile.tagline}).
                  </p>
                  <p>
                    Consultations and procedures are led by <strong>{profile.leadDoctor}</strong> ({profile.doctorTitle}).
                  </p>
                  <div className="p-2 rounded-lg bg-[#111b21] text-[11px] space-y-1 border border-slate-700/40">
                    <p className="text-slate-300">📍 <strong>Clinic Address:</strong> {profile.address}, {profile.city}</p>
                    <p className="text-slate-300">🕒 <strong>Hours:</strong> {profile.openingHoursSummary}</p>
                    <p className="text-slate-300">💳 <strong>Consultation Fee:</strong> ₹{profile.consultationFee}</p>
                  </div>
                  <p className="text-slate-200">
                    How may we assist you today? You can inquire about treatments, schedule a consultation, or request post-procedure guidance.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs">
              <h4 className="text-xs font-bold text-foreground">AI Knowledge Sync</h4>
              <p className="text-[11px] text-muted-foreground">
                All changes to the hospital profile and treatments catalog are immediately indexed into the AI Knowledge Engine.
              </p>
              <div className="pt-2">
                <a
                  href="/calendar"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Doctor Schedule & On-Duty Status
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TREATMENT ADD / EDIT MODAL DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {editingTreatment ? `Edit Treatment: ${editingTreatment.name}` : 'Add New Hospital Treatment'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure procedure pricing, expected duration, sittings protocol, and pre/post-care instructions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Treatment Name *</label>
                <input
                  type="text"
                  placeholder="e.g. HydraFacial Deluxe Glow, Botox Anti-Aging"
                  value={treatmentFormData.name || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category *</label>
                <select
                  value={treatmentFormData.category || 'Skin'}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, category: e.target.value as TreatmentCategory }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Price (₹ INR) *</label>
                <input
                  type="number"
                  placeholder="e.g. 3500"
                  value={treatmentFormData.price || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Duration (Minutes)</label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={treatmentFormData.durationMinutes || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Recommended Sittings</label>
                <input
                  type="number"
                  placeholder="e.g. 3"
                  value={treatmentFormData.recommendedSittings || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, recommendedSittings: Number(e.target.value) }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Sitting Interval / Gap</label>
                <input
                  type="text"
                  placeholder="e.g. Every 3-4 weeks, Every 6 months, As advised"
                  value={treatmentFormData.sittingInterval || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, sittingInterval: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Clinical Description & Benefits</label>
                <textarea
                  rows={2}
                  placeholder="Detailed description of the procedure, technologies used, and clinical results..."
                  value={treatmentFormData.description || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Pre-Care Advice</label>
                <input
                  type="text"
                  placeholder="e.g. Avoid retinoids for 48 hours prior, shave area 24 hours prior..."
                  value={treatmentFormData.preCareAdvice || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, preCareAdvice: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Post-Care Advice</label>
                <input
                  type="text"
                  placeholder="e.g. Apply broad-spectrum SPF 50+ sunscreen, avoid gym/steam for 24 hours..."
                  value={treatmentFormData.postCareAdvice || ''}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, postCareAdvice: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 sm:col-span-2 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={treatmentFormData.isActive !== false}
                    onChange={e => setTreatmentFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Active & Bookable</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!treatmentFormData.isPopular}
                    onChange={e => setTreatmentFormData(prev => ({ ...prev, isPopular: e.target.checked }))}
                    className="h-4 w-4 rounded border-input text-amber-500 focus:ring-amber-500"
                  />
                  <span>Mark as Featured / Popular</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTreatmentModal}
              disabled={!treatmentFormData.name?.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {editingTreatment ? 'Save Changes' : 'Add Treatment'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
