'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomField, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users,
  Tags,
  Filter,
  Upload,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  FileSpreadsheet,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  UserPlus,
  Phone,
  CheckSquare,
  Square,
  Plus
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  cleanPhoneNumber,
  getPhoneKey,
  getUnifiedPatientList,
  UnifiedPatient,
} from '@/lib/contacts/patient-filter';

type AudienceType = 'all' | 'tags' | 'custom_field' | 'csv';
type CustomFieldOperator = 'is' | 'is_not' | 'contains';

interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

export interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
  selectedContactPhones?: string[];
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

const BUILTIN_CLINICAL_FIELDS: CustomField[] = [
  { id: 'builtin_department', user_id: '', account_id: '', field_name: 'Treatment / Procedure (e.g. PRP, HydraFacial, Laser)', field_type: 'text', created_at: '' },
  { id: 'builtin_category', user_id: '', account_id: '', field_name: 'Clinical Category (Skin, Hair, Laser, Aesthetic, Body)', field_type: 'text', created_at: '' },
  { id: 'builtin_doctor', user_id: '', account_id: '', field_name: 'Consulting Doctor (Dr. Mrinalini)', field_type: 'text', created_at: '' },
  { id: 'builtin_status', user_id: '', account_id: '', field_name: 'Appointment Status (Confirmed, Completed, Follow-up)', field_type: 'text', created_at: '' },
];

export function Step2SelectAudience({
  audience,
  onUpdate,
  onNext,
  onBack,
}: Step2Props) {
  const t = useTranslations('Broadcasts.wizard');

  const OPERATOR_OPTIONS = useMemo<{ value: CustomFieldOperator; label: string }[]>(() => [
    { value: 'is', label: t('selectAudience.operatorIs') },
    { value: 'is_not', label: t('selectAudience.operatorIsNot') },
    { value: 'contains', label: t('selectAudience.operatorContains') },
  ], [t]);

  const audienceOptions = useMemo<{
    type: AudienceType;
    label: string;
    description: string;
    icon: typeof Users;
  }[]>(() => [
    {
      type: 'all',
      label: t('selectAudience.method.all'),
      description: 'Select registered patients from your clinic database.',
      icon: Users,
    },
    {
      type: 'tags',
      label: t('selectAudience.method.tags'),
      description: t('selectAudience.tagDesc'),
      icon: Tags,
    },
    {
      type: 'custom_field',
      label: 'Patient Category / Attributes',
      description: 'Filter by Treatment, Category, Doctor, or Custom Fields.',
      icon: Filter,
    },
    {
      type: 'csv',
      label: 'Excel / CSV Import',
      description: 'Upload an Excel (.xlsx, .xls) or CSV file with patient phone numbers',
      icon: FileSpreadsheet,
    },
  ], [t]);

  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>(BUILTIN_CLINICAL_FIELDS);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Registered Patients list for All Contacts view
  const [registeredPatients, setRegisteredPatients] = useState<UnifiedPatient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Quick Add Patient Modal
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientDept, setNewPatientDept] = useState('Laser Hair Reduction');

  // CSV/Excel upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileStats, setFileStats] = useState<{ total: number; valid: number; skipped: number } | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // Load registered patients across all clinic databases & storage
  const loadUnifiedPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const list = await getUnifiedPatientList();
      setRegisteredPatients(list);
      return list;
    } catch (err) {
      console.error('[Error loading unified patients]:', err);
      return [];
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    loadUnifiedPatients();
  }, [loadUnifiedPatients]);

  useEffect(() => {
    async function fetchTags() {
      setLoadingTags(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.from('tags').select('*').order('name');
        setTags(data ?? []);
      } catch {
        // Tag fallback
      } finally {
        setLoadingTags(false);
      }
    }
    fetchTags();
  }, []);

  useEffect(() => {
    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');
        const dbFields = data ?? [];
        setCustomFields([...BUILTIN_CLINICAL_FIELDS, ...dbFields]);
      } catch {
        setCustomFields(BUILTIN_CLINICAL_FIELDS);
      } finally {
        setLoadingFields(false);
      }
    }
    fetchFields();
  }, []);

  // Selected patient phones resolution
  // If audience.selectedContactPhones is undefined, all registered patients are selected by default.
  const isAllSelected = useMemo(() => {
    if (audience.selectedContactPhones === undefined) return true;
    if (registeredPatients.length === 0) return true;
    return registeredPatients.every(p => audience.selectedContactPhones?.includes(p.phone));
  }, [audience.selectedContactPhones, registeredPatients]);

  const selectedCount = useMemo(() => {
    if (audience.selectedContactPhones === undefined) {
      return registeredPatients.length;
    }
    return audience.selectedContactPhones.length;
  }, [audience.selectedContactPhones, registeredPatients.length]);

  const isPatientSelected = useCallback((phone: string) => {
    if (audience.selectedContactPhones === undefined) return true;
    return audience.selectedContactPhones.includes(phone);
  }, [audience.selectedContactPhones]);

  const handleTogglePatient = (phone: string) => {
    const current = audience.selectedContactPhones !== undefined
      ? audience.selectedContactPhones
      : registeredPatients.map(p => p.phone);

    let updated: string[];
    if (current.includes(phone)) {
      updated = current.filter(p => p !== phone);
    } else {
      updated = [...current, phone];
    }

    onUpdate({
      ...audience,
      selectedContactPhones: updated,
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      onUpdate({
        ...audience,
        selectedContactPhones: [],
      });
    } else {
      // Select all
      onUpdate({
        ...audience,
        selectedContactPhones: registeredPatients.map(p => p.phone),
      });
    }
  };

  const handleAddDirectPatient = () => {
    const trimmedName = newPatientName.trim();
    const cleanP = cleanPhoneNumber(newPatientPhone);

    if (!cleanP || cleanP.length < 8) {
      toast.error('Please enter a valid phone number (at least 8-10 digits)');
      return;
    }

    const newPat: UnifiedPatient = {
      id: `custom_${Date.now()}`,
      name: trimmedName || 'Valued Patient',
      phone: newPatientPhone.trim(),
      cleanPhone: cleanP,
      department: newPatientDept,
      doctor: 'Dr. Mrinalini',
      status: 'Confirmed',
      category: 'Clinical',
      source: 'custom',
    };

    // Save to localStorage custom patients
    try {
      const existing = JSON.parse(localStorage.getItem('wacrm_custom_patients') || '[]');
      const updated = [newPat, ...(Array.isArray(existing) ? existing : [])];
      localStorage.setItem('wacrm_custom_patients', JSON.stringify(updated));
    } catch {}

    // Update registered patients state
    setRegisteredPatients(prev => [newPat, ...prev.filter(p => getPhoneKey(p.phone) !== getPhoneKey(newPat.phone))]);

    // Select this patient
    const currentSelected = audience.selectedContactPhones !== undefined
      ? audience.selectedContactPhones
      : registeredPatients.map(p => p.phone);

    onUpdate({
      ...audience,
      selectedContactPhones: Array.from(new Set([...currentSelected, newPat.phone])),
    });

    setNewPatientName('');
    setNewPatientPhone('');
    setIsAddPatientOpen(false);
    toast.success(`Patient "${newPat.name}" added and selected for broadcast!`);
  };

  // Filtered patients for the table search
  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery.trim()) return registeredPatients;
    const q = patientSearchQuery.toLowerCase();
    return registeredPatients.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      (p.department && p.department.toLowerCase().includes(q)) ||
      (p.doctor && p.doctor.toLowerCase().includes(q))
    );
  }, [registeredPatients, patientSearchQuery]);

  // Resilient count estimation across DB contacts, appointments & runtime patients
  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const allContacts = await getUnifiedPatientList();

      // Exclude tags set
      let excludeSet = new Set<string>();
      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        try {
          const supabase = createClient();
          const { data: excludeRows } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.excludeTagIds);
          excludeSet = new Set((excludeRows ?? []).map((r) => r.contact_id));
        } catch {}
      }

      if (audience.type === 'all') {
        const effective = allContacts.filter(c => !excludeSet.has(c.id));
        if (audience.selectedContactPhones !== undefined) {
          const selectedSet = new Set(audience.selectedContactPhones.map(p => getPhoneKey(p)));
          const count = effective.filter(c => selectedSet.has(getPhoneKey(c.phone))).length;
          setEstimatedCount(count);
        } else {
          setEstimatedCount(effective.length);
        }
        return;
      }

      if (audience.type === 'csv') {
        setEstimatedCount(audience.csvContacts?.length || 0);
        return;
      }

      if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);
          const baseIds = new Set((data ?? []).map((r) => r.contact_id));
          const effective = [...baseIds].filter(id => !excludeSet.has(id));
          setEstimatedCount(effective.length);
        } catch {
          setEstimatedCount(0);
        }
        return;
      }

      if (audience.type === 'custom_field' && audience.customField?.fieldId && audience.customField.value) {
        const { fieldId, operator, value } = audience.customField;
        const targetVal = value.trim().toLowerCase();

        // Check if built-in field
        if (fieldId.startsWith('builtin_')) {
          const matched = allContacts.filter(c => {
            if (excludeSet.has(c.id)) return false;
            let fieldVal = '';
            if (fieldId === 'builtin_department') fieldVal = (c.department || '').toLowerCase();
            else if (fieldId === 'builtin_category') fieldVal = (c.category || '').toLowerCase();
            else if (fieldId === 'builtin_doctor') fieldVal = (c.doctor || 'Dr. Mrinalini').toLowerCase();
            else if (fieldId === 'builtin_status') fieldVal = (c.status || 'Confirmed').toLowerCase();

            if (operator === 'is') return fieldVal === targetVal;
            if (operator === 'is_not') return fieldVal !== targetVal;
            return fieldVal.includes(targetVal);
          });
          setEstimatedCount(matched.length);
          return;
        }

        // Database custom field
        try {
          const supabase = createClient();
          let q = supabase
            .from('contact_custom_values')
            .select('contact_id')
            .eq('custom_field_id', fieldId);
          if (operator === 'is') q = q.eq('value', value);
          else if (operator === 'is_not') q = q.neq('value', value);
          else q = q.ilike('value', `%${value}%`);
          const { data } = await q;
          const baseIds = new Set((data ?? []).map((r) => r.contact_id));
          const effective = [...baseIds].filter((id: string) => !excludeSet.has(id));
          setEstimatedCount(effective.length);
        } catch {
          setEstimatedCount(0);
        }
        return;
      }

      setEstimatedCount(allContacts.length);
    } catch {
      setEstimatedCount(0);
    } finally {
      setLoadingCount(false);
    }
  }, [
    audience.type,
    audience.tagIds,
    audience.customField,
    audience.csvContacts,
    audience.excludeTagIds,
    audience.selectedContactPhones,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function updateCustomField(patch: Partial<CustomFieldFilter>) {
    const prev = audience.customField ?? {
      fieldId: 'builtin_department',
      operator: 'contains' as CustomFieldOperator,
      value: '',
    };
    onUpdate({ ...audience, customField: { ...prev, ...patch } });
  }

  // File Upload Handlers (Excel / CSV)
  async function handleFileUpload(file: File) {
    if (!file) return;
    setIsParsingFile(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('The spreadsheet contains no sheets.');
      }
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('No data rows found in the uploaded file.');
      }

      const sampleRow = rawRows[0];
      const keys = Object.keys(sampleRow);
      
      const phoneKey = keys.find(k => /phone|mobile|whatsapp|contact|number|cell|tel|mob/i.test(k)) || keys[0];
      const nameKey = keys.find(k => /name|patient|customer|client|full_name|person/i.test(k)) || (keys.length > 1 && keys[1] !== phoneKey ? keys[1] : undefined);

      const parsedMap = new Map<string, { phone: string; name?: string }>();
      let skippedCount = 0;

      for (const row of rawRows) {
        const rawPhone = row[phoneKey];
        const cleanedPhone = cleanPhoneNumber(rawPhone);

        if (cleanedPhone && cleanedPhone.length >= 8 && cleanedPhone.length <= 16) {
          const rawName = nameKey ? String(row[nameKey] ?? '').trim() : '';
          parsedMap.set(cleanedPhone, {
            phone: cleanedPhone,
            name: rawName || undefined,
          });
        } else {
          skippedCount++;
        }
      }

      const validList = Array.from(parsedMap.values());

      if (validList.length === 0) {
        throw new Error('No valid phone numbers found. Please check column headers.');
      }

      setFileStats({
        total: rawRows.length,
        valid: validList.length,
        skipped: skippedCount,
      });

      onUpdate({
        ...audience,
        type: 'csv',
        csvContacts: validList,
      });

      toast.success(`Successfully imported ${validList.length} contacts from ${file.name}`);
    } catch (err) {
      console.error('File parse error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveCsvContact(phone: string) {
    const updated = (audience.csvContacts ?? []).filter(c => c.phone !== phone);
    onUpdate({
      ...audience,
      csvContacts: updated,
    });
    setFileStats(prev => prev ? { ...prev, valid: updated.length } : null);
    toast.info(`Contact ${phone} removed.`);
  }

  function handleDownloadSample(format: 'xlsx' | 'csv') {
    const sampleData = [
      { 'Patient Name': 'Arbaz Khan', 'Phone Number': '+918147866324', 'Notes': 'Clinical Consultation' },
      { 'Patient Name': 'Dr. Mrinalini', 'Phone Number': '+918639295134', 'Notes': 'Dermatology' },
      { 'Patient Name': 'Sunita Sharma', 'Phone Number': '+919812345678', 'Notes': 'PRP Hair Therapy' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample_Contacts');

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, 'broadcast_sample_contacts.xlsx');
    } else {
      XLSX.writeFile(workbook, 'broadcast_sample_contacts.csv', { bookType: 'csv' });
    }
    toast.success(`Sample template (${format.toUpperCase()}) downloaded!`);
  }

  function handleExportAudience(format: 'xlsx' | 'csv') {
    const list = audience.csvContacts ?? [];
    if (list.length === 0) {
      toast.error('No contacts to export.');
      return;
    }
    const exportData = list.map((c, idx) => ({
      '#': idx + 1,
      'Patient Name': c.name || 'N/A',
      'Phone Number': c.phone,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audience_Contacts');

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, `broadcast_audience_${Date.now()}.xlsx`);
    } else {
      XLSX.writeFile(workbook, `broadcast_audience_${Date.now()}.csv`, { bookType: 'csv' });
    }
    toast.success(`Audience exported as ${format.toUpperCase()}`);
  }

  const filteredCsvContacts = useMemo(() => {
    const list = audience.csvContacts ?? [];
    if (!contactSearchQuery.trim()) return list;
    const q = contactSearchQuery.toLowerCase();
    return list.filter(c => c.phone.includes(q) || (c.name && c.name.toLowerCase().includes(q)));
  }, [audience.csvContacts, contactSearchQuery]);

  const isValid =
    (audience.type === 'all' && selectedCount > 0) ||
    (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) ||
    (audience.type === 'custom_field' &&
      !!audience.customField?.fieldId &&
      audience.customField.value.length > 0) ||
    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('selectAudience.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which patient group or imported list to send this broadcast to.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {audienceOptions.map((option) => {
          const isSelected = audience.type === option.type;
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              type="button"
              onClick={() =>
                onUpdate({
                  ...audience,
                  type: option.type,
                  tagIds: option.type === 'tags' ? audience.tagIds : undefined,
                  customField: option.type === 'custom_field' ? (audience.customField || { fieldId: 'builtin_department', operator: 'contains', value: '' }) : undefined,
                  csvContacts: option.type === 'csv' ? audience.csvContacts : undefined,
                })
              }
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                  : 'border-border bg-card/50 hover:border-primary/50 hover:bg-card'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{option.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Audience Type 0: All Contacts / Registered Patients Selection & Management ── */}
      {audience.type === 'all' && (
        <div className="space-y-4 rounded-xl border border-border bg-card/50 p-5 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Select Patients for Broadcast ({selectedCount} of {registeredPatients.length} Selected)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check or uncheck individual patients, or click Select All to broadcast to the entire list.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8 text-xs font-medium border-border"
              >
                {isAllSelected ? (
                  <>
                    <Square className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    Select All ({registeredPatients.length})
                  </>
                )}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddPatientOpen(true)}
                className="h-8 text-xs bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                + Add Direct Patient
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search registered patients by name, phone, or treatment…"
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs border-border bg-muted/40"
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Showing {filteredPatients.length} of {registeredPatients.length}
            </span>
          </div>

          {/* Patient Selection Table */}
          {loadingPatients ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Loading registered patients database…</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-8 rounded-lg border border-dashed border-border text-center space-y-3 bg-muted/20">
              <Users className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
              <div>
                <p className="text-xs font-medium text-foreground">No patients matching search or list empty.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click "+ Add Direct Patient" to add a patient contact directly to this broadcast.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddPatientOpen(true)}
                className="h-7 text-xs bg-primary text-primary-foreground font-medium"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Patient Now
              </Button>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground sticky top-0 border-b border-border z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center font-semibold">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                      />
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Patient Name</th>
                    <th className="py-2.5 px-3 font-semibold">WhatsApp Number</th>
                    <th className="py-2.5 px-3 font-semibold">Treatment / Department</th>
                    <th className="py-2.5 px-3 font-semibold">Doctor</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredPatients.map((p) => {
                    const selected = isPatientSelected(p.phone);
                    return (
                      <tr 
                        key={p.phone} 
                        onClick={() => handleTogglePatient(p.phone)}
                        className={`cursor-pointer transition-colors ${
                          selected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30 opacity-75'
                        }`}
                      >
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleTogglePatient(p.phone)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground">
                          {p.name}
                        </td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-emerald-500" />
                            {p.phone}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 truncate max-w-[180px]">
                            {p.department || 'General'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {p.doctor || 'Dr. Mrinalini'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {p.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Audience Type 1: Tags ── */}
      {audience.type === 'tags' && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">{t('selectAudience.selectTags')}</p>
          {loadingTags ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : tags.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('selectAudience.noTagsFound')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = audience.tagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground hover:border-border'
                    }`}
                  >
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Audience Type 2: Custom Field & Clinical Attributes ── */}
      {audience.type === 'custom_field' && (
        <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Filter by Patient Category or Attribute
            </p>
            <span className="text-[11px] text-muted-foreground">Clinical & Custom Metadata</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)]">
            <select
              value={audience.customField?.fieldId ?? 'builtin_department'}
              onChange={(e) => updateCustomField({ fieldId: e.target.value })}
              className="h-9 rounded-lg border border-border bg-muted px-2.5 text-xs sm:text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <optgroup label="Clinical Attributes">
                {BUILTIN_CLINICAL_FIELDS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name}
                  </option>
                ))}
              </optgroup>
              {customFields.filter(f => !f.id.startsWith('builtin_')).length > 0 && (
                <optgroup label="Custom Fields">
                  {customFields.filter(f => !f.id.startsWith('builtin_')).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.field_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <select
              value={audience.customField?.operator ?? 'contains'}
              onChange={(e) =>
                updateCustomField({
                  operator: e.target.value as CustomFieldOperator,
                })
              }
              className="h-9 rounded-lg border border-border bg-muted px-2.5 text-xs sm:text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {OPERATOR_OPTIONS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={audience.customField?.value ?? ''}
              onChange={(e) => updateCustomField({ value: e.target.value })}
              placeholder="e.g. PRP, Hair, Skin, Confirmed..."
              className="h-9 rounded-lg border border-border bg-muted px-2.5 text-xs sm:text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary font-medium"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Filter patients who match this specific procedure, category, or custom property.
          </p>
        </div>
      )}

      {/* ── Audience Type 3: Excel / CSV Import (Full Featured) ── */}
      {audience.type === 'csv' && (
        <div className="space-y-4 rounded-xl border border-border bg-card/50 p-5 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Upload Excel or CSV Contact List
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supports .xlsx, .xls, and .csv files with phone numbers & names.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleDownloadSample('xlsx')}
                className="h-8 text-xs border-border text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Sample Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleDownloadSample('csv')}
                className="h-8 text-xs border-border text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Sample CSV
              </Button>
            </div>
          </div>

          {/* Drag & drop upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            {isParsingFile ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Parsing spreadsheet & validating phone numbers…</p>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Click to browse or drag & drop your Excel or CSV file
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  File should include columns like <b>Phone Number</b> and <b>Patient Name</b>
                </p>
              </>
            )}
          </div>

          {/* File Upload Summary & Preview Table */}
          {audience.csvContacts && audience.csvContacts.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {fileName ? `${fileName} — ` : ''}{audience.csvContacts.length} Contacts Ready
                    </p>
                    {fileStats && (
                      <p className="text-[11px] text-muted-foreground">
                        {fileStats.total} total rows in file • {fileStats.valid} valid numbers • {fileStats.skipped} skipped
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => handleExportAudience('xlsx')}
                    className="h-7 text-xs border-border"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export Excel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => {
                      onUpdate({ ...audience, csvContacts: [] });
                      setFileName(null);
                      setFileStats(null);
                    }}
                    className="h-7 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear List
                  </Button>
                </div>
              </div>

              {/* Search contacts in list */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search imported patients by name or phone…"
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs border-border bg-muted/50"
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Showing {filteredCsvContacts.length} of {audience.csvContacts.length}
                </span>
              </div>

              {/* Preview table */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground sticky top-0 border-b border-border">
                    <tr>
                      <th className="py-2 px-3 font-medium">#</th>
                      <th className="py-2 px-3 font-medium">Patient Name</th>
                      <th className="py-2 px-3 font-medium">WhatsApp Phone</th>
                      <th className="py-2 px-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCsvContacts.slice(0, 50).map((c, idx) => (
                      <tr key={c.phone + idx} className="hover:bg-muted/30">
                        <td className="py-1.5 px-3 text-muted-foreground">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-medium text-foreground">{c.name || '—'}</td>
                        <td className="py-1.5 px-3 font-mono text-muted-foreground">+{c.phone}</td>
                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCsvContact(c.phone)}
                            className="text-muted-foreground hover:text-red-400 p-1"
                            title="Remove recipient"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exclude list — applies when filtering contacts and tags exist */}
      {audience.type !== 'csv' && tags.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <X className="h-4 w-4 text-red-400" />
            <p className="text-sm font-medium text-foreground">
              {t('selectAudience.excludeTags')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isExcluded = audience.excludeTagIds?.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleExcludeTag(tag.id)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isExcluded
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-border bg-muted text-muted-foreground hover:border-border'
                  }`}
                >
                  <span
                    className="mr-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Audience Summary */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Audience Summary</p>
        {loadingCount ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Calculating reach…</span>
          </div>
        ) : estimatedCount !== null ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {estimatedCount.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">patients will receive this broadcast</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select an audience or upload a contact list to see the estimated reach.
          </p>
        )}
      </div>

      {/* Quick Add Direct Patient Modal */}
      {isAddPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Add Direct Patient to Broadcast
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddPatientOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <Label className="text-xs font-semibold">Patient Name</Label>
                <Input
                  placeholder="e.g. Priya Sharma"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">WhatsApp Phone Number *</Label>
                <Input
                  placeholder="e.g. +91 98765 43210"
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Treatment / Clinical Category</Label>
                <Input
                  placeholder="e.g. Laser Hair Reduction, PRP, HydraFacial"
                  value={newPatientDept}
                  onChange={(e) => setNewPatientDept(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddPatientOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddDirectPatient}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                Add & Select Patient
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t('back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t('next')}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}
