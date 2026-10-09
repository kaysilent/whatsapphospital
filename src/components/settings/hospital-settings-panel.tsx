'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
  CreditCard,
  Layers, 
  Phone, 
  PhoneCall,
  ExternalLink,
  MessageSquare,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Tag,
  Settings,
  FolderPlus,
  AlertTriangle
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
import { 
  Department,
  DEFAULT_DEPARTMENTS,
  getRuntimeDepartments,
  saveDepartments,
  matchDepartmentName
} from '@/lib/hospital/departments';
import { useAuth } from '@/hooks/use-auth';
import { canEditClinicalConfig } from '@/lib/auth/roles';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function getDeptBadgeStyle(cat: string) {
  const lower = (cat || '').toLowerCase();
  if (lower.includes('skin') || lower.includes('derma')) {
    return { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' };
  }
  if (lower.includes('laser')) {
    return { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' };
  }
  if (lower.includes('hair') || lower.includes('tricho')) {
    return { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' };
  }
  if (lower.includes('aging') || lower.includes('cosmeto') || lower.includes('aesthetic') || lower.includes('botox')) {
    return { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' };
  }
  if (lower.includes('body') || lower.includes('wellness')) {
    return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' };
  }
  if (lower.includes('consult')) {
    return { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' };
  }
  return { bg: 'bg-primary/10 dark:bg-primary/20', text: 'text-primary', border: 'border-primary/30' };
}

export function HospitalSettingsPanel() {
  const { accountRole } = useAuth();
  const canEdit = canEditClinicalConfig(accountRole || 'staff');

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'treatments' | 'departments'>('treatments');
  const [profile, setProfile] = useState<HospitalProfile>(DEFAULT_HOSPITAL_PROFILE);
  const [treatments, setTreatments] = useState<Treatment[]>(DEFAULT_TREATMENTS);
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
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
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [deptSearchQuery, setDeptSearchQuery] = useState('');

  // Treatment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [treatmentFormData, setTreatmentFormData] = useState<Partial<Treatment>>({
    name: '',
    category: 'Dermatology & Skin Care',
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

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deptFormData, setDeptFormData] = useState<Partial<Department>>({
    name: '',
    description: '',
    leadSpecialist: 'Dr. Mrinalini',
    isActive: true,
  });

  // Dedicated Category Manager & Safe Deletion State
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Department | null>(null);
  const [fallbackCategoryId, setFallbackCategoryId] = useState<string>('');
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Load saved data on mount
  useEffect(() => {
    setProfile(getRuntimeHospitalProfile());
    setTreatments(getRuntimeTreatments());
    setDepartments(getRuntimeDepartments());

    fetch('/api/hospital/profile')
      .then(res => res.json())
      .then(data => {
        if (data?.profile) {
          setProfile(data.profile);
          saveHospitalProfile(data.profile);
        }
      })
      .catch(() => {});

    fetch('/api/hospital/departments')
      .then(res => res.json())
      .then(data => {
        if (data?.departments && Array.isArray(data.departments) && data.departments.length > 0) {
          setDepartments(data.departments);
          saveDepartments(data.departments);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    saveHospitalProfile(profile);
    try {
      const res = await fetch('/api/hospital/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile);
        saveHospitalProfile(data.profile);
      }
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

  const handleSaveDepartments = async (updated: Department[]) => {
    setDepartments(updated);
    saveDepartments(updated);
    try {
      await fetch('/api/hospital/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: updated }),
      });
    } catch {}

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleOpenAddModal = () => {
    setEditingTreatment(null);
    setTreatmentFormData({
      name: '',
      category: departments[0]?.name || 'Dermatology & Skin Care',
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
    const matchedCategory = matchDepartmentName(t.category, departments);
    setTreatmentFormData({
      ...t,
      category: matchedCategory,
    });
    setIsModalOpen(true);
  };

  const handleSaveTreatmentModal = () => {
    if (!treatmentFormData.name?.trim()) return;
    const assignedCategory = treatmentFormData.category || (departments[0]?.name || 'Dermatology & Skin Care');

    if (editingTreatment) {
      const updated = treatments.map(t => 
        t.id === editingTreatment.id 
          ? {
              ...t,
              ...treatmentFormData,
              name: treatmentFormData.name!.trim(),
              category: assignedCategory,
              updatedAt: new Date().toISOString(),
            } as Treatment
          : t
      );
      handleSaveTreatments(updated);
    } else {
      const newTreatment: Treatment = {
        id: `trt-${Date.now()}`,
        name: treatmentFormData.name!.trim(),
        category: assignedCategory,
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

  // Department Handlers
  const handleOpenAddDeptModal = () => {
    setEditingDepartment(null);
    setDeptFormData({
      name: '',
      description: '',
      leadSpecialist: profile.leadDoctor || 'Dr. Mrinalini',
      isActive: true,
    });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDeptModal = (d: Department) => {
    setEditingDepartment(d);
    setDeptFormData({ ...d });
    setIsDeptModalOpen(true);
  };

  const handleSaveDeptModal = () => {
    if (!deptFormData.name?.trim()) return;

    if (editingDepartment) {
      const updated = departments.map(d =>
        d.id === editingDepartment.id
          ? {
              ...d,
              ...deptFormData,
              name: deptFormData.name!.trim(),
              description: deptFormData.description?.trim() || '',
              leadSpecialist: deptFormData.leadSpecialist?.trim() || profile.leadDoctor,
              updatedAt: new Date().toISOString(),
            } as Department
          : d
      );
      handleSaveDepartments(updated);
    } else {
      const newDept: Department = {
        id: `dept-${Date.now()}`,
        name: deptFormData.name!.trim(),
        description: deptFormData.description?.trim() || '',
        leadSpecialist: deptFormData.leadSpecialist?.trim() || profile.leadDoctor,
        isActive: deptFormData.isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      handleSaveDepartments([newDept, ...departments]);
    }
    setIsDeptModalOpen(false);
  };

  const handleOpenDeleteCategory = (dept: Department) => {
    setCategoryToDelete(dept);
    const remaining = departments.filter(d => d.id !== dept.id);
    setFallbackCategoryId(remaining[0]?.name || 'Dermatology & Skin Care');
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    const targetDept = categoryToDelete;
    const remainingDepts = departments.filter(d => d.id !== targetDept.id);

    try {
      const targetCategoryName = targetDept.name;
      const targetFallback = fallbackCategoryId || (remainingDepts[0]?.name || 'Dermatology & Skin Care');

      // Reassign any treatments belonging to this deleted category
      const updatedTreatments = treatments.map(t => {
        const mapped = matchDepartmentName(t.category, departments);
        if (
          t.category.toLowerCase() === targetCategoryName.toLowerCase() ||
          mapped.toLowerCase() === targetCategoryName.toLowerCase()
        ) {
          return {
            ...t,
            category: targetFallback,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      });

      const hadTreatmentsToReassign = updatedTreatments.some(
        (t, idx) => t.category !== treatments[idx]?.category
      );
      if (hadTreatmentsToReassign) {
        handleSaveTreatments(updatedTreatments);
      }

      // Call delete API
      await fetch(`/api/hospital/departments?id=${encodeURIComponent(targetDept.id)}`, {
        method: 'DELETE',
      }).catch(() => {});

      handleSaveDepartments(remainingDepts);

      if (selectedCategory.toLowerCase() === targetDept.name.toLowerCase()) {
        setSelectedCategory('All');
      }

      setCategoryToDelete(null);
    } catch (err) {
      console.error('Delete category error:', err);
      // Fallback
      handleSaveDepartments(remainingDepts);
      setCategoryToDelete(null);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleDeleteDepartment = (id: string) => {
    const dept = departments.find(d => d.id === id);
    if (dept) {
      handleOpenDeleteCategory(dept);
    } else {
      const updated = departments.filter(d => d.id !== id);
      handleSaveDepartments(updated);
    }
  };

  const handleToggleDeptActive = (id: string) => {
    const updated = departments.map(d =>
      d.id === id ? { ...d, isActive: !d.isActive, updatedAt: new Date().toISOString() } : d
    );
    handleSaveDepartments(updated);
  };

  const handleResetDeptsToDefault = () => {
    if (confirm('Reset clinical departments to standard default list (6 clinic specialties)?')) {
      handleSaveDepartments(DEFAULT_DEPARTMENTS);
    }
  };

  // Dynamically derived list of categories based on active Clinical Departments
  const availableCategories = useMemo(() => {
    const activeDeptNames = departments.filter(d => d.isActive).map(d => d.name);
    const uniqueTreatmentDepts = Array.from(
      new Set(treatments.map(t => matchDepartmentName(t.category, departments)))
    );
    const combined = Array.from(new Set([...activeDeptNames, ...uniqueTreatmentDepts]));
    return ['All', ...combined];
  }, [departments, treatments]);

  // Filtered Treatments
  const filteredTreatments = useMemo(() => {
    return treatments.filter(t => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (selectedCategory === 'All') return matchesSearch;
      
      const mappedCategory = matchDepartmentName(t.category, departments);
      const matchesCategory = 
        t.category.toLowerCase() === selectedCategory.toLowerCase() ||
        mappedCategory.toLowerCase() === selectedCategory.toLowerCase();
      
      return matchesSearch && matchesCategory;
    });
  }, [treatments, searchQuery, selectedCategory, departments]);

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    return departments.filter(d =>
      d.name.toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
      d.leadSpecialist.toLowerCase().includes(deptSearchQuery.toLowerCase())
    );
  }, [departments, deptSearchQuery]);

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
                Manage clinic contact details, consultation policies, clinical departments, and treatments catalog synced with AI Receptionist.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
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
            <>
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground shadow-xs transition-colors"
              >
                <Tag className="h-3.5 w-3.5 text-primary" />
                <span>Manage Categories</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddDeptModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-xs transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>+ Add Category</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Treatment
              </button>
            </>
          )}

          {activeSubTab === 'departments' && canEdit && (
            <button
              type="button"
              onClick={handleOpenAddDeptModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Category / Specialty
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {savedSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Hospital details and configuration successfully updated and synchronized with AI Receptionist!</span>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-border gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('treatments')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
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
          onClick={() => setActiveSubTab('departments')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'departments'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="h-4 w-4" />
          Categories & Specialties ({departments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('profile')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
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
                  placeholder="Search treatment by name, specialty, or clinical keywords..."
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

            {/* Dynamic Category Filter Chips linked with Clinical Departments */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span>Categories & Specialties:</span>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={handleOpenAddDeptModal}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Add Category
                    </button>
                    <span className="text-muted-foreground/30">|</span>
                    <button
                      type="button"
                      onClick={() => setIsCategoryManagerOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Settings className="h-3 w-3" />
                      Manage / Delete Categories
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {availableCategories.map(cat => {
                  const count = cat === 'All' 
                    ? treatments.length 
                    : treatments.filter(t => {
                        const mapped = matchDepartmentName(t.category, departments);
                        return t.category.toLowerCase() === cat.toLowerCase() || mapped.toLowerCase() === cat.toLowerCase();
                      }).length;
                  const isSelected = selectedCategory === cat;
                  const matchedDept = departments.find(d => d.name.toLowerCase() === cat.toLowerCase());

                  return (
                    <div key={cat} className="group relative inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
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

                      {/* Quick Delete icon on non-All category chip */}
                      {canEdit && cat !== 'All' && matchedDept && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeleteCategory(matchedDept);
                          }}
                          title={`Delete "${cat}" category`}
                          className="opacity-0 group-hover:opacity-100 ml-1 p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-md transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Inline Add Category Chip */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenAddDeptModal}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-all whitespace-nowrap"
                    title="Add a new treatment category"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Category</span>
                  </button>
                )}
              </div>
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
                  Try selecting another department filter or add a new custom treatment for your clinic.
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
                const badgeStyle = getDeptBadgeStyle(t.category);
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
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                            <Layers className="h-3 w-3" />
                            {t.category}
                          </span>
                          {t.isPopular && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
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
      {/* SUB-TAB 2: CLINICAL DEPARTMENTS */}
      {/* ========================================================================= */}
      {activeSubTab === 'departments' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Departments</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">{departments.length}</span>
                <span className="text-[11px] text-muted-foreground">specialties</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active on WhatsApp</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {departments.filter(d => d.isActive).length}
                </span>
                <span className="text-[11px] text-emerald-600/80">routing live</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lead Specialist</span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground truncate">{profile.leadDoctor}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">AI Routing</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400">Synced</span>
                <span className="text-[11px] text-purple-600/80">Auto-Triage</span>
              </div>
            </div>
          </div>

          {/* Search & Actions Header */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search department by name, specialist, or clinical keywords..."
                  value={deptSearchQuery}
                  onChange={e => setDeptSearchQuery(e.target.value)}
                  className="w-full text-xs bg-background border border-input rounded-xl pl-9 pr-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Reset Departments Button */}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleResetDeptsToDefault}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  title="Reset to default 6 clinical specialties"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Default Specialties</span>
                </button>
              )}
            </div>
          </div>

          {/* Departments Grid */}
          {filteredDepartments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">No clinical departments match your search</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a new clinical department or specialty to categorize patient inquiries and appointments.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleOpenAddDeptModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Department
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartments.map((dept) => {
                const badgeStyle = getDeptBadgeStyle(dept.name);

                return (
                  <div
                    key={dept.id}
                    className={`group rounded-2xl border bg-card p-5 space-y-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                      !dept.isActive ? 'opacity-60 bg-muted/30' : ''
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Badges & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                          <Layers className="h-3 w-3" />
                          Specialty
                        </span>

                        {/* Active Toggle */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleToggleDeptActive(dept.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                              dept.isActive
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                            }`}
                          >
                            {dept.isActive ? 'Active' : 'Disabled'}
                          </button>
                        )}
                      </div>

                      {/* Title & Specialist */}
                      <div>
                        <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          {dept.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-medium">
                          <Stethoscope className="h-3.5 w-3.5 text-primary" />
                          <span>Specialist: <strong>{dept.leadSpecialist}</strong></span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {dept.description || 'Clinical specialty and procedures.'}
                      </p>
                    </div>

                    {/* Bottom Actions */}
                    {canEdit && (
                      <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-border">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDeptModal(dept)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(dept.id)}
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
      {/* SUB-TAB 3: HOSPITAL PROFILE & CONTACT */}
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

                {/* Doctor Personal WhatsApp for Urgent Relay */}
                <div className="space-y-1.5 sm:col-span-2 p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <PhoneCall className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      <span>Doctor WhatsApp Number (Urgent Patient Relay)</span>
                    </label>
                    <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold bg-rose-500/15 px-2 py-0.5 rounded">
                      Direct WhatsApp Bridge
                    </span>
                  </div>
                  <input
                    type="text"
                    value={profile.doctorWhatsapp || ''}
                    placeholder="e.g. +91 81478 66324"
                    disabled={!canEdit}
                    onChange={e => setProfile(prev => ({ ...prev, doctorWhatsapp: e.target.value }))}
                    className="w-full text-xs bg-background border border-rose-500/30 rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-rose-500 font-medium"
                  />
                  <p className="text-[10.5px] text-muted-foreground">
                    When a patient has an urgent medical concern or asks to connect with the doctor on WhatsApp, the AI automatically dispatches an alert to this number. When the doctor replies to that WhatsApp message, their guidance is instantly forwarded directly to the patient.
                  </p>
                </div>
              </div>
            </div>

            {/* About Clinic & Clinical Specialty */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">About Clinic & Clinical Specialty</h3>
                </div>
                <Link
                  href="/settings?tab=payments"
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20"
                >
                  <CreditCard className="h-3 w-3" />
                  Manage Consultation Fee in Payment Gateway →
                </Link>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Clinical Specialty & Profile Overview</label>
                <textarea
                  rows={4}
                  value={profile.aboutText}
                  disabled={!canEdit}
                  onChange={e => setProfile(prev => ({ ...prev, aboutText: e.target.value }))}
                  placeholder="Premier center for evidence-based clinical aesthetics, advanced laser skin rejuvenation, anti-aging therapies, and personalized hair restoration under Dr. Mrinalini..."
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground">
                  This description is indexed by the AI assistant to summarize clinic offerings and medical capabilities to patients on WhatsApp.
                </p>
              </div>

              {/* Consultation & Booking Advance Fees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Doctor Consultation Fee (₹)</span>
                    <span className="text-[10px] text-primary font-medium">Quoted by AI</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={profile.consultationFee ?? 500}
                    disabled={!canEdit}
                    onChange={e => {
                      const val = Number(e.target.value) || 0;
                      setProfile(prev => ({
                        ...prev,
                        consultationFee: val,
                        clinicBalanceFee: Math.max(0, val - (prev.advanceTokenFee || 100))
                      }));
                    }}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-medium"
                  />
                  <p className="text-[10.5px] text-muted-foreground">
                    Full doctor consultation fee quoted to patients on WhatsApp.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Advance Booking Fee (₹)</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Razorpay Link Amount</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={profile.advanceTokenFee ?? 100}
                    disabled={!canEdit}
                    onChange={e => {
                      const val = Number(e.target.value) || 0;
                      setProfile(prev => ({
                        ...prev,
                        advanceTokenFee: val,
                        clinicBalanceFee: Math.max(0, (prev.consultationFee || 500) - val)
                      }));
                    }}
                    className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70 focus:ring-1 focus:ring-primary font-medium"
                  />
                  <p className="text-[10.5px] text-muted-foreground">
                    Online token fee charged via Razorpay link to lock the appointment slot.
                  </p>
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
                    <p className="text-slate-300">💳 <strong>Consultation Fee:</strong> ₹{profile.consultationFee ?? 500} (Advance Booking: ₹{profile.advanceTokenFee ?? 100})</p>
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
                All changes to the hospital profile, clinical departments, and treatments catalog are immediately indexed into the AI Knowledge Engine.
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3 text-primary" />
                    <span>Category / Department *</span>
                  </label>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenAddDeptModal();
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      New Category
                    </button>
                  )}
                </div>
                <select
                  value={treatmentFormData.category || (departments[0]?.name || 'Dermatology & Skin Care')}
                  onChange={e => setTreatmentFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary font-medium"
                >
                  {departments.map(d => (
                    <option key={d.id || d.name} value={d.name}>
                      {d.name} {d.leadSpecialist ? `(${d.leadSpecialist})` : ''}
                    </option>
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

      {/* ========================================================================= */}
      {/* CATEGORY / DEPARTMENT ADD / EDIT MODAL DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={isDeptModalOpen} onOpenChange={setIsDeptModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              {editingDepartment ? `Edit Category: ${editingDepartment.name}` : 'Add New Category / Specialty'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure category name (e.g. Skin, Laser, Aesthetic, Body, Hair, Wellness, Consultation), supervising doctor, and clinical scope for patient triage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category / Department Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dermatology & Skin Care, Laser & Aesthetics, Body Contouring, Hair Restoration"
                  value={deptFormData.name || ''}
                  onChange={e => setDeptFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Lead Specialist / Supervising Doctor</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Mrinalini"
                  value={deptFormData.leadSpecialist || ''}
                  onChange={e => setDeptFormData(prev => ({ ...prev, leadSpecialist: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Clinical Scope & Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe treatments and clinical scope covered in this category..."
                  value={deptFormData.description || ''}
                  onChange={e => setDeptFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deptFormData.isActive !== false}
                    onChange={e => setDeptFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Active & Open for WhatsApp Inquiries</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsDeptModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDeptModal}
              disabled={!deptFormData.name?.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {editingDepartment ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DEDICATED CATEGORY MANAGER MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Tag className="h-4 w-4 text-primary" />
                  Clinical Categories & Specialties Manager
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Manage clinical categories (Skin, Laser, Aesthetic, Body, Hair, Wellness, Consultation). Add new categories or delete existing ones.
                </DialogDescription>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenAddDeptModal();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Add Category</span>
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-3 py-3">
            {departments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
                <Tag className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">No categories found. Click "+ Add Category" to create your first category.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60 rounded-2xl border border-border bg-card overflow-hidden">
                {departments.map((dept) => {
                  const badgeStyle = getDeptBadgeStyle(dept.name);
                  const linkedCount = treatments.filter(t => {
                    const mapped = matchDepartmentName(t.category, departments);
                    return t.category.toLowerCase() === dept.name.toLowerCase() || mapped.toLowerCase() === dept.name.toLowerCase();
                  }).length;

                  return (
                    <div
                      key={dept.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                            <Layers className="h-3 w-3" />
                            {dept.name}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                            {linkedCount} treatment{linkedCount === 1 ? '' : 's'} linked
                          </span>
                          {!dept.isActive && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600">
                              Disabled
                            </span>
                          )}
                        </div>
                        {dept.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {dept.description}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/80">
                          Specialist: <strong>{dept.leadSpecialist}</strong>
                        </p>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenEditDeptModal(dept);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenDeleteCategory(dept);
                            }}
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

          <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-border">
            {canEdit && (
              <button
                type="button"
                onClick={handleResetDeptsToDefault}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Default Categories
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCategoryManagerOpen(false)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-colors ml-auto"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DELETE CATEGORY CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-600">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Delete Category: {categoryToDelete?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently remove this category from the hospital catalog?
            </DialogDescription>
          </DialogHeader>

          {categoryToDelete && (
            <div className="space-y-4 py-2">
              {(() => {
                const linkedTreatments = treatments.filter(t => {
                  const mapped = matchDepartmentName(t.category, departments);
                  return (
                    t.category.toLowerCase() === categoryToDelete.name.toLowerCase() ||
                    mapped.toLowerCase() === categoryToDelete.name.toLowerCase()
                  );
                });
                const remainingDepts = departments.filter(d => d.id !== categoryToDelete.id);

                return (
                  <>
                    {linkedTreatments.length > 0 ? (
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs space-y-2 text-amber-900 dark:text-amber-200">
                        <p className="font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>{linkedTreatments.length} treatment{linkedTreatments.length > 1 ? 's' : ''} currently belong to this category:</span>
                        </p>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 truncate">
                          ({linkedTreatments.map(t => t.name).join(', ')})
                        </p>

                        {remainingDepts.length > 0 && (
                          <div className="pt-2 border-t border-amber-500/20 space-y-1">
                            <label className="text-[11px] font-semibold block text-foreground">
                              Reassign these treatments to:
                            </label>
                            <select
                              value={fallbackCategoryId}
                              onChange={e => setFallbackCategoryId(e.target.value)}
                              className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground font-medium"
                            >
                              {remainingDepts.map(d => (
                                <option key={d.id} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No treatments are currently linked to this category. It will be safely removed immediately.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              disabled={isDeletingCategory}
              onClick={() => setCategoryToDelete(null)}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeletingCategory}
              onClick={handleConfirmDeleteCategory}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeletingCategory ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
