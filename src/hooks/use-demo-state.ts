"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_LA_FLEUR_SYSTEM_PROMPT,
  defaultKnowledgeItems,
  type KnowledgeItem,
} from '@/lib/ai/assistant-defaults';
import { isHiddenByDeletion, stampDeletions } from '@/lib/contacts/deleted-patients';

export interface TreatmentProtocol {
  name: string;
  totalSittings: number;
  sittingInterval: string;
  sittingIntervalDays: number;
  defaultDoctor: string;
  postCareFollowUpDays: number;
  postCareGoal: string;
  nextSittingGoal: string;
}

export const TREATMENT_PROTOCOLS: Record<string, TreatmentProtocol> = {
  "Laser Hair Reduction": {
    name: "Laser Hair Reduction",
    totalSittings: 6,
    sittingInterval: "4-6 weeks",
    sittingIntervalDays: 28,
    defaultDoctor: "Dr. Mrinalini",
    postCareFollowUpDays: 2,
    postCareGoal: "Post-laser soothing gel & skin tolerance check",
    nextSittingGoal: "Sitting due reminder (hair growth cycle sync)"
  },
  "PRP Hair Therapy": {
    name: "PRP Hair Therapy",
    totalSittings: 4,
    sittingInterval: "3-4 weeks",
    sittingIntervalDays: 21,
    defaultDoctor: "Dr. Mrinalini",
    postCareFollowUpDays: 3,
    postCareGoal: "Post-PRP scalp sensitivity & washing instructions check",
    nextSittingGoal: "Session due reminder for follicular stimulation"
  },
  "Pigmentation & Chemical Peels": {
    name: "Pigmentation & Chemical Peels",
    totalSittings: 4,
    sittingInterval: "2-3 weeks",
    sittingIntervalDays: 14,
    defaultDoctor: "Dr. Mrinalini",
    postCareFollowUpDays: 2,
    postCareGoal: "Post-peel flaking, hydration & SPF compliance review",
    nextSittingGoal: "Next peel sitting due reminder"
  },
  "Skin Tightening (RF / MNRF)": {
    name: "Skin Tightening (RF / MNRF)",
    totalSittings: 4,
    sittingInterval: "3-4 weeks",
    sittingIntervalDays: 21,
    defaultDoctor: "Dr. Mrinalini",
    postCareFollowUpDays: 3,
    postCareGoal: "Post-RF collagen stimulation & skin hydration check",
    nextSittingGoal: "Next RF contouring sitting due reminder"
  },
  "HydraFacial Deluxe": {
    name: "HydraFacial Deluxe",
    totalSittings: 3,
    sittingInterval: "4 weeks",
    sittingIntervalDays: 28,
    defaultDoctor: "Dr. Mrinalini",
    postCareFollowUpDays: 1,
    postCareGoal: "Post-HydraFacial radiance & moisture barrier check",
    nextSittingGoal: "Monthly maintenance glow session due"
  },
  "Anti-Aging & Botox": {
    name: "Anti-Aging & Botox",
    totalSittings: 1,
    sittingInterval: "2 weeks",
    sittingIntervalDays: 14,
    defaultDoctor: "Dr. Mrinalini",
    postCareFollowUpDays: 7,
    postCareGoal: "Day 7 Botox post-injection symmetry & effect review",
    nextSittingGoal: "Day 14 touch-up consultation"
  },
  "General Aesthetic Consultation": {
    name: "General Aesthetic Consultation",
    totalSittings: 1,
    sittingInterval: "As advised",
    sittingIntervalDays: 30,
    defaultDoctor: "Dr. Mrinalini",
    postCareFollowUpDays: 2,
    postCareGoal: "Post-consultation treatment plan & medication review",
    nextSittingGoal: "Treatment commencement appointment"
  }
};

export function getTreatmentProtocol(dept: string): TreatmentProtocol {
  const lower = (dept || '').toLowerCase();
  if (lower.includes('laser') || lower.includes('hair reduction')) {
    return TREATMENT_PROTOCOLS["Laser Hair Reduction"];
  }
  if (lower.includes('prp') || lower.includes('scalp') || lower.includes('gfc')) {
    return TREATMENT_PROTOCOLS["PRP Hair Therapy"];
  }
  if (lower.includes('peel') || lower.includes('pigment') || lower.includes('brightening')) {
    return TREATMENT_PROTOCOLS["Pigmentation & Chemical Peels"];
  }
  if (lower.includes('tightening') || lower.includes('rf') || lower.includes('mnrf')) {
    return TREATMENT_PROTOCOLS["Skin Tightening (RF / MNRF)"];
  }
  if (lower.includes('hydra') || lower.includes('facial') || lower.includes('glow')) {
    return TREATMENT_PROTOCOLS["HydraFacial Deluxe"];
  }
  if (lower.includes('botox') || lower.includes('wrinkle') || lower.includes('anti-aging')) {
    return TREATMENT_PROTOCOLS["Anti-Aging & Botox"];
  }
  return TREATMENT_PROTOCOLS["General Aesthetic Consultation"];
}

export type Appointment = {
  id: string;
  booking_id?: string;
  patient_name: string;
  phone_number: string;
  date: string;
  time: string;
  department: string;
  doctor?: string;
  status?: string;
  current_sitting?: number;
  total_sittings?: number;
  sitting_interval?: string;
  sitting_interval_days?: number;
  sitting?: string;
  next_sitting_date?: string;
  completed_at?: string;
  created_at?: string;
  notes?: string;
};

export type FollowUpTask = {
  id: string;
  appointment_id?: string;
  patient_name: string;
  phone_number: string;
  department: string;
  sitting_info: string;
  reason: string;
  type: 'post_care' | 'next_sitting_reminder' | 'clinical_review' | 'treatment_followup';
  due: string;
  due_date: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Sent (AI)' | 'Completed';
  created_by: 'AI Agent' | 'Doctor' | 'Staff';
  whatsapp_message_content?: string;
  total_sittings?: number;
  current_sitting?: number;
  interval_gap?: string;
  interval_days?: number;
  completed_at?: string;
};

export {
  DEFAULT_LA_FLEUR_SYSTEM_PROMPT,
  defaultKnowledgeItems,
} from '@/lib/ai/assistant-defaults';
export type { KnowledgeItem, KnowledgeItemType } from '@/lib/ai/assistant-defaults';

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  customBaseUrl?: string;
  isConfigured: boolean;
  maskedApiKey?: string;
  hasApiKey?: boolean;
}

export const defaultLLMConfig: LLMConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-3.5-flash',
  temperature: 0.7,
  maxTokens: 1024,
  customBaseUrl: '',
  isConfigured: false,
  maskedApiKey: '',
  hasApiKey: false,
};

type DemoState = {
  systemPrompt: string;
  isCalendarConnected: boolean;
  appointments: Appointment[];
  followUps: FollowUpTask[];
  knowledgeItems: KnowledgeItem[];
  llmConfig: LLMConfig;
  deletedPatientPhones: string[];
};

export const defaultAppointments: Appointment[] = [];

export const defaultFollowUps: FollowUpTask[] = [];

const defaultState: DemoState = {
  systemPrompt: DEFAULT_LA_FLEUR_SYSTEM_PROMPT,
  isCalendarConnected: true,
  appointments: defaultAppointments,
  followUps: defaultFollowUps,
  knowledgeItems: defaultKnowledgeItems,
  llmConfig: defaultLLMConfig,
  deletedPatientPhones: [],
};

// Global event emitter for same-tab reactivity
const listeners = new Set<() => void>();

let currentState: DemoState = { ...defaultState };
let isStorageInitialized = false;

// Safe client-side loader for localStorage & cloud configuration
export function loadStateFromLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const savedPrompt = localStorage.getItem('wacrm_system_prompt');
    const savedKnowledge = localStorage.getItem('wacrm_knowledge_items');
    const savedLlm = localStorage.getItem('wacrm_llm_config');
    const savedFollowUps = localStorage.getItem('wacrm_follow_ups');
    const saved = localStorage.getItem('wacrm_demo_state');
    
    let activePrompt = DEFAULT_LA_FLEUR_SYSTEM_PROMPT;
    if (savedPrompt && savedPrompt.trim().length > 0 && !savedPrompt.includes("Aivry Hospital")) {
      activePrompt = savedPrompt;
    }

    let activeKnowledge: KnowledgeItem[] = defaultKnowledgeItems;
    if (savedKnowledge) {
      try {
        const parsedK = JSON.parse(savedKnowledge);
        if (Array.isArray(parsedK) && parsedK.length > 0) {
          activeKnowledge = parsedK;
        }
      } catch {}
    }

    let activeLlm: LLMConfig = defaultLLMConfig;
    if (savedLlm) {
      try {
        const parsedL = JSON.parse(savedLlm);
        if (parsedL && parsedL.provider) {
          activeLlm = { ...defaultLLMConfig, ...parsedL };
          const isLegacy = (activeLlm.model || '').includes('2.5') || (activeLlm.model || '').includes('2.0') || (activeLlm.model || '').includes('1.5') || (activeLlm.model || '').includes('preview');
          if (activeLlm.provider === 'gemini' && isLegacy) {
            activeLlm.model = 'gemini-3.5-flash';
          }
        }
      } catch {}
    }

    let activeFollowUps: FollowUpTask[] = defaultFollowUps;
    if (savedFollowUps) {
      try {
        const parsedF = JSON.parse(savedFollowUps);
        if (Array.isArray(parsedF) && parsedF.length > 0) {
          activeFollowUps = parsedF;
        }
      } catch {}
    }

    const savedDeleted = localStorage.getItem('wacrm_deleted_patients');
    let activeDeleted: string[] = [];
    if (savedDeleted) {
      try {
        const parsedD = JSON.parse(savedDeleted);
        if (Array.isArray(parsedD)) activeDeleted = parsedD;
      } catch {}
    }

    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed) {
        const promptToUse = (parsed.systemPrompt && !parsed.systemPrompt.includes("Aivry Hospital"))
          ? parsed.systemPrompt
          : activePrompt;

        const knowledgeToUse = (Array.isArray(parsed.knowledgeItems) && parsed.knowledgeItems.length > 0)
          ? parsed.knowledgeItems
          : activeKnowledge;

        const llmToUse = parsed.llmConfig ? { ...defaultLLMConfig, ...parsed.llmConfig, ...activeLlm } : activeLlm;
        const followUpsToUse = (Array.isArray(parsed.followUps) && parsed.followUps.length > 0) ? parsed.followUps : activeFollowUps;
        const deletedToUse = (Array.isArray(parsed.deletedPatientPhones) && parsed.deletedPatientPhones.length > 0) ? parsed.deletedPatientPhones : activeDeleted;

        currentState = {
          ...defaultState,
          ...parsed,
          systemPrompt: promptToUse,
          knowledgeItems: knowledgeToUse,
          llmConfig: llmToUse,
          followUps: followUpsToUse,
          deletedPatientPhones: deletedToUse,
          appointments: Array.isArray(parsed.appointments) 
            ? parsed.appointments.filter((a: any) => !isDummyAppointment(a) && !isDeleted(a.phone_number, a.id))
            : []
        };
      }
    } else {
      currentState = {
        ...defaultState,
        systemPrompt: activePrompt,
        knowledgeItems: activeKnowledge,
        llmConfig: activeLlm,
        followUps: activeFollowUps,
        deletedPatientPhones: activeDeleted,
        appointments: []
      };
    }
  } catch (e) {
    console.error("Failed to load demo state", e);
  }

  // Auto-hydrate cloud AI configuration from Supabase on client initialization
  try {
    fetch('/api/ai/config')
      .then((res) => res.json())
      .then((data) => {
        let hasChanges = false;
        if (data && (data.isConfigured || data.hasApiKey)) {
          const rawModel = data.model || currentState.llmConfig.model || 'gemini-3.5-flash';
          const isLegacy = rawModel.includes('2.5') || rawModel.includes('2.0') || rawModel.includes('1.5') || rawModel.includes('preview');
          const safeModel = (data.provider === 'gemini' && isLegacy) ? 'gemini-3.5-flash' : rawModel;

          currentState.llmConfig = {
            ...currentState.llmConfig,
            provider: data.provider || currentState.llmConfig.provider || 'gemini',
            model: safeModel,
            customBaseUrl: data.customBaseUrl !== undefined ? data.customBaseUrl : currentState.llmConfig.customBaseUrl,
            temperature: typeof data.temperature === 'number' ? data.temperature : currentState.llmConfig.temperature,
            maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : currentState.llmConfig.maxTokens,
            isConfigured: true,
            hasApiKey: true,
            maskedApiKey: data.maskedApiKey || '',
          };
          try {
            localStorage.setItem('wacrm_llm_config', JSON.stringify(currentState.llmConfig));
          } catch {}
          window.dispatchEvent(new CustomEvent('wacrm_llm_config_updated', { detail: currentState.llmConfig }));
          hasChanges = true;
        }

        if (data && data.systemPrompt && typeof data.systemPrompt === 'string' && data.systemPrompt.trim()) {
          const remotePrompt = data.systemPrompt.trim();
          if (remotePrompt !== currentState.systemPrompt) {
            currentState.systemPrompt = remotePrompt;
            try {
              localStorage.setItem('wacrm_system_prompt', remotePrompt);
            } catch {}
            window.dispatchEvent(new CustomEvent('wacrm_system_prompt_updated', { detail: { systemPrompt: remotePrompt } }));
            hasChanges = true;
          }
        }

        if (hasChanges) {
          listeners.forEach((l) => l());
        }
      })
      .catch((err) => {
        console.warn('[Cloud AI Config Hydration]:', err);
      });
  } catch {}

  // Hydrate the knowledge base from the server. The WhatsApp webhook reads
  // the server copy, so it is the source of truth; a browser still holding
  // edits from before server sync existed pushes them up once.
  try {
    fetch('/api/ai/knowledge')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.items)) return;
        if (data.saved) {
          currentState.knowledgeItems = data.items;
          try {
            localStorage.setItem('wacrm_knowledge_items', JSON.stringify(data.items));
          } catch {}
          window.dispatchEvent(new CustomEvent('wacrm_knowledge_updated', { detail: data.items }));
          listeners.forEach((l) => l());
        } else if (JSON.stringify(currentState.knowledgeItems) !== JSON.stringify(defaultKnowledgeItems)) {
          pushKnowledgeItems(currentState.knowledgeItems);
        }
      })
      .catch((err) => {
        console.warn('[Cloud Knowledge Base Hydration]:', err);
      });
  } catch {}
}

function pushKnowledgeItems(items: KnowledgeItem[]) {
  fetch('/api/ai/knowledge', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
    .then((res) => {
      if (!res.ok) console.warn('[Cloud Knowledge Base Save]: HTTP', res.status);
    })
    .catch((err) => {
      console.warn('[Cloud Knowledge Base Save]:', err);
    });
}

const isDummyAppointment = (a: any): boolean => {
  if (!a) return true;
  const name = (a.patient_name || '').trim().toLowerCase();
  const phone = (a.phone_number || '').replace(/\D/g, '');
  const id = String(a.id || '').trim().toLowerCase();
  if (name.includes('priya sharma') || name.includes('rohan mehra')) return true;
  if (name.includes('kavita patel') || name.includes('sunita reddy') || name.includes('karan johar') || name.includes('ananya deshmukh') || name.includes('vikram malhotra')) return true;
  if (phone.includes('9876543210') || phone.includes('9812345678')) return true;
  if (String(a.phone_number || '').includes('{{') || String(a.phone_number || '').toLowerCase().includes('whatsapp_number')) return true;
  if (id === '1' || id === '2' || id === 'lf-20261006-1' || id === 'lf-20261006-2') return true;
  return false;
};

const isDeleted = (phone?: string, id?: string, createdAt?: string): boolean =>
  isHiddenByDeletion(currentState.deletedPatientPhones || [], phone, id, createdAt);

export async function syncAppointmentsFromDatabase(): Promise<Appointment[]> {
  if (typeof window === 'undefined') return currentState.appointments;
  try {
    const res = await fetch('/api/appointments');
    const data = await res.json();
    if (data && data.ok && Array.isArray(data.appointments)) {
      // Build a phone -> valid name map from incoming appointments
      const phoneToName = new Map<string, string>();
      data.appointments.forEach((a: any) => {
        const clean = (a.phone_number || '').replace(/\D/g, '');
        const key = clean.length >= 10 ? clean.slice(-10) : clean;
        if (key && a.patient_name && a.patient_name.toLowerCase() !== 'patient' && a.patient_name.toLowerCase() !== 'valued patient') {
          if (!phoneToName.has(key)) phoneToName.set(key, a.patient_name);
        }
      });

      const serverAppts: Appointment[] = data.appointments.map((a: any) => {
        const clean = (a.phone_number || '').replace(/\D/g, '');
        const key = clean.length >= 10 ? clean.slice(-10) : clean;
        let resolvedName = a.patient_name;
        if ((!resolvedName || resolvedName.toLowerCase() === 'patient' || resolvedName.toLowerCase() === 'valued patient') && key && phoneToName.has(key)) {
          resolvedName = phoneToName.get(key);
        }
        return {
          id: a.id,
          booking_id: a.booking_id || (a.notes?.match(/LF-\d{8}-\d{4}/) ? a.notes.match(/LF-\d{8}-\d{4}/)[0] : (a.id?.startsWith('LF-') ? a.id : undefined)),
          patient_name: resolvedName || 'Valued Patient',
          phone_number: a.phone_number,
          date: typeof a.date === 'string' ? a.date.split('T')[0] : a.date,
          time: a.time,
          department: a.department,
          doctor: a.doctor || 'Dr. Mrinalini',
          status: a.status || 'Confirmed (AI)',
          current_sitting: a.current_sitting || 1,
          total_sittings: a.total_sittings || 1,
          sitting_interval: a.sitting_interval || '4-6 weeks',
          sitting_interval_days: a.sitting_interval_days || 28,
          sitting: a.sitting || (a.total_sittings > 1 ? `Sitting ${a.current_sitting || 1} of ${a.total_sittings}` : 'Consultation'),
          next_sitting_date: a.next_sitting_date,
          notes: a.notes || '',
          completed_at: a.completed_at,
          created_at: a.created_at
        };
      });

      // Combine with local appointments without dummy data
      const localAppts = currentState.appointments || [];
      const mergedMap = new Map<string, Appointment>();

      // 1. Add server appts first (ground truth)
      serverAppts.forEach(sa => {
        if (!isDummyAppointment(sa) && !isDeleted(sa.phone_number, sa.id, sa.created_at)) {
          const key = sa.id ? `id_${sa.id}` : `${sa.patient_name.trim().toLowerCase()}_${sa.date}_${sa.time}`;
          mergedMap.set(key, sa);
        }
      });

      // 2. Add local non-dummy appts if not already present on server
      localAppts.forEach(la => {
        if (!isDummyAppointment(la) && !isDeleted(la.phone_number, la.id, la.created_at)) {
          const key = la.id ? `id_${la.id}` : `${la.patient_name.trim().toLowerCase()}_${la.date}_${la.time}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, la);
          }
        }
      });

      const merged = Array.from(mergedMap.values());
      const hasChanged = JSON.stringify(merged) !== JSON.stringify(currentState.appointments);
      if (hasChanged) {
        currentState.appointments = merged;
        updateState({ appointments: merged });
      }

      // Also merge follow-ups if provided
      if (Array.isArray(data.followUps) && data.followUps.length > 0) {
        const serverFu: FollowUpTask[] = data.followUps.map((f: any) => ({
          id: f.id,
          appointment_id: f.appointment_id,
          patient_name: f.patient_name,
          phone_number: f.phone_number,
          department: f.department,
          sitting_info: f.sitting_info || 'After Sitting 1 of 1',
          reason: f.reason || 'Post-consultation care check',
          type: f.type || 'post_care',
          due: f.due || 'In 2 days',
          due_date: typeof f.due_date === 'string' ? f.due_date.split('T')[0] : f.due_date,
          priority: f.priority || 'High',
          status: f.status || 'Pending',
          created_by: f.created_by || 'AI Agent',
          whatsapp_message_content: f.whatsapp_message_content
        }));

        const fuMap = new Map<string, FollowUpTask>();
        serverFu.forEach(sfu => {
          const k = sfu.id ? `id_${sfu.id}` : `${sfu.patient_name}_${sfu.due_date}_${sfu.reason}`;
          fuMap.set(k, sfu);
        });
        (currentState.followUps || []).forEach(lfu => {
          const k = lfu.id ? `id_${lfu.id}` : `${lfu.patient_name}_${lfu.due_date}_${lfu.reason}`;
          if (!fuMap.has(k)) fuMap.set(k, lfu);
        });

        const mergedFu = Array.from(fuMap.values());
        if (JSON.stringify(mergedFu) !== JSON.stringify(currentState.followUps)) {
          currentState.followUps = mergedFu;
          updateState({ followUps: mergedFu });
        }
      }

      return merged;
    }
  } catch (err) {
    console.warn('[Sync Appointments Warning]:', err);
  }
  return currentState.appointments;
}

function updateState(newState: Partial<DemoState>) {
  currentState = { ...currentState, ...newState };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('wacrm_demo_state', JSON.stringify(currentState));
      if (newState.systemPrompt !== undefined) {
        localStorage.setItem('wacrm_system_prompt', newState.systemPrompt);
        window.dispatchEvent(new CustomEvent('wacrm_system_prompt_updated', { detail: { systemPrompt: newState.systemPrompt } }));
      }
      if (newState.appointments !== undefined) {
        localStorage.setItem('wacrm_appointments', JSON.stringify(currentState.appointments));
        window.dispatchEvent(new CustomEvent('wacrm_appointments_updated', { detail: currentState.appointments }));
      }
      if (newState.followUps !== undefined) {
        localStorage.setItem('wacrm_follow_ups', JSON.stringify(currentState.followUps));
        window.dispatchEvent(new CustomEvent('wacrm_follow_ups_updated', { detail: currentState.followUps }));
      }
      if (newState.knowledgeItems !== undefined) {
        localStorage.setItem('wacrm_knowledge_items', JSON.stringify(currentState.knowledgeItems));
        window.dispatchEvent(new CustomEvent('wacrm_knowledge_updated', { detail: currentState.knowledgeItems }));
      }
      if (newState.llmConfig !== undefined) {
        localStorage.setItem('wacrm_llm_config', JSON.stringify(currentState.llmConfig));
        window.dispatchEvent(new CustomEvent('wacrm_llm_config_updated', { detail: currentState.llmConfig }));
      }
      if (newState.deletedPatientPhones !== undefined) {
        localStorage.setItem('wacrm_deleted_patients', JSON.stringify(currentState.deletedPatientPhones));
        window.dispatchEvent(new CustomEvent('wacrm_deleted_patients_updated', { detail: currentState.deletedPatientPhones }));
      }
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }
  listeners.forEach((listener) => listener());
}

export function useDemoState() {
  const [state, setState] = useState<DemoState>(defaultState);

  useEffect(() => {
    if (!isStorageInitialized && typeof window !== 'undefined') {
      isStorageInitialized = true;
      loadStateFromLocalStorage();
    }

    const handleUpdate = () => {
      setState({ 
        ...currentState, 
        appointments: [...currentState.appointments],
        followUps: [...currentState.followUps],
        knowledgeItems: [...currentState.knowledgeItems]
      });
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'wacrm_system_prompt' && e.newValue) {
        currentState.systemPrompt = e.newValue;
        setState({ ...currentState, systemPrompt: e.newValue });
        listeners.forEach(l => l());
      } else if (e.key === 'wacrm_deleted_patients' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            currentState.deletedPatientPhones = parsed;
            setState({ ...currentState, deletedPatientPhones: parsed });
            listeners.forEach(l => l());
          }
        } catch {}
      } else if (e.key === 'wacrm_knowledge_items' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            currentState.knowledgeItems = parsed;
            setState({ ...currentState, knowledgeItems: parsed });
            listeners.forEach(l => l());
          }
        } catch {}
      } else if (e.key === 'wacrm_follow_ups' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            currentState.followUps = parsed;
            setState({ ...currentState, followUps: parsed });
            listeners.forEach(l => l());
          }
        } catch {}
      } else if ((e.key === 'wacrm_demo_state' || e.key === 'wacrm_appointments') && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            currentState.appointments = parsed;
          } else if (parsed.appointments) {
            currentState = { ...currentState, ...parsed };
          }
          setState({ 
            ...currentState, 
            appointments: [...currentState.appointments],
            followUps: [...currentState.followUps],
            knowledgeItems: [...currentState.knowledgeItems]
          });
          listeners.forEach(l => l());
        } catch (err) {}
      }
    };

    const handleCustomEvent = () => {
      setState({ 
        ...currentState, 
        appointments: [...currentState.appointments],
        followUps: [...currentState.followUps],
        knowledgeItems: [...currentState.knowledgeItems]
      });
    };

    const handlePromptEvent = (e: Event) => {
      const custom = e as CustomEvent<{ systemPrompt: string }>;
      if (custom.detail?.systemPrompt) {
        setState(prev => ({ ...prev, systemPrompt: custom.detail.systemPrompt }));
      } else {
        setState({ ...currentState });
      }
    };

    const handleKnowledgeEvent = (e: Event) => {
      const custom = e as CustomEvent<KnowledgeItem[]>;
      if (Array.isArray(custom.detail)) {
        setState(prev => ({ ...prev, knowledgeItems: custom.detail }));
      } else {
        setState({ ...currentState });
      }
    };

    const handleLlmEvent = (e: Event) => {
      const custom = e as CustomEvent<LLMConfig>;
      if (custom.detail) {
        setState(prev => ({ ...prev, llmConfig: custom.detail }));
      } else {
        setState({ ...currentState });
      }
    };

    listeners.add(handleUpdate);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('wacrm_appointments_updated', handleCustomEvent);
    window.addEventListener('wacrm_follow_ups_updated', handleCustomEvent);
    window.addEventListener('wacrm_deleted_patients_updated', handleCustomEvent);
    window.addEventListener('wacrm_system_prompt_updated', handlePromptEvent);
    window.addEventListener('wacrm_knowledge_updated', handleKnowledgeEvent);
    window.addEventListener('wacrm_llm_config_updated', handleLlmEvent);
    
    // Ensure we have latest state on mount & sync with database
    handleUpdate();
    syncAppointmentsFromDatabase();

    const syncTimer = setInterval(() => {
      syncAppointmentsFromDatabase();
    }, 4000);

    return () => {
      clearInterval(syncTimer);
      listeners.delete(handleUpdate);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('wacrm_appointments_updated', handleCustomEvent);
      window.removeEventListener('wacrm_follow_ups_updated', handleCustomEvent);
      window.removeEventListener('wacrm_deleted_patients_updated', handleCustomEvent);
      window.removeEventListener('wacrm_system_prompt_updated', handlePromptEvent);
      window.removeEventListener('wacrm_knowledge_updated', handleKnowledgeEvent);
      window.removeEventListener('wacrm_llm_config_updated', handleLlmEvent);
    };
  }, []);

  const setSystemPrompt = useCallback((prompt: string) => {
    updateState({ systemPrompt: prompt });
    if (typeof window !== 'undefined') {
      fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: prompt }),
      }).catch((e) => console.warn('[Auto-sync system prompt error]:', e));
    }
  }, []);

  const resetSystemPrompt = useCallback(() => {
    updateState({ systemPrompt: DEFAULT_LA_FLEUR_SYSTEM_PROMPT });
    if (typeof window !== 'undefined') {
      fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: DEFAULT_LA_FLEUR_SYSTEM_PROMPT }),
      }).catch((e) => console.warn('[Auto-sync reset prompt error]:', e));
    }
  }, []);

  const setLLMConfig = useCallback((config: Partial<LLMConfig>) => {
    const updated = {
      ...currentState.llmConfig,
      ...config,
      isConfigured: !!(config.apiKey !== undefined ? config.apiKey.trim() : currentState.llmConfig.apiKey.trim())
    };
    updateState({ llmConfig: updated });
    return updated;
  }, []);

  const resetLLMConfig = useCallback(() => {
    updateState({ llmConfig: defaultLLMConfig });
  }, []);

  const setIsCalendarConnected = useCallback((connected: boolean) => {
    updateState({ isCalendarConnected: connected });
  }, []);

  const addAppointment = useCallback((appt: Partial<Appointment> & { patient_name: string; phone_number: string; date: string; time: string; department: string }) => {
    const protocol = getTreatmentProtocol(appt.department);
    const docName = appt.doctor || protocol.defaultDoctor;
    const currentSitting = appt.current_sitting || 1;
    const totalSittings = appt.total_sittings || protocol.totalSittings;
    const sittingInterval = appt.sitting_interval || protocol.sittingInterval;
    const intervalDays = appt.sitting_interval_days || protocol.sittingIntervalDays;
    const cleanDate = (appt.date || '').replace(/\D/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingId = appt.booking_id || `LF-${cleanDate || '20261007'}-${randomSuffix}`;

    const newAppt: Appointment = { 
      ...appt, 
      id: `appt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      booking_id: bookingId,
      doctor: docName,
      status: appt.status || 'Confirmed (AI)',
      current_sitting: currentSitting,
      total_sittings: totalSittings,
      sitting_interval: sittingInterval,
      sitting_interval_days: intervalDays,
      sitting: appt.sitting || (totalSittings > 1 ? `Sitting ${currentSitting} of ${totalSittings}` : `Consultation`),
      notes: appt.notes ? (appt.notes.includes('Booking ID:') ? appt.notes : `[Booking ID: ${bookingId}] ${appt.notes}`) : `[Booking ID: ${bookingId}]`
    };
    
    const filtered = currentState.appointments.filter(a => !(a.patient_name.toLowerCase() === newAppt.patient_name.toLowerCase() && a.date === newAppt.date));
    const updated = [newAppt, ...filtered];

    // Automatically create a post-care follow-up task queued for the AI agent
    const postCareTask: FollowUpTask = {
      id: `fu-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      appointment_id: newAppt.id,
      patient_name: newAppt.patient_name,
      phone_number: newAppt.phone_number,
      department: newAppt.department,
      sitting_info: totalSittings > 1 ? `After Sitting ${currentSitting} of ${totalSittings}` : 'Post-Consultation',
      reason: protocol.postCareGoal,
      type: 'post_care',
      due: `In ${protocol.postCareFollowUpDays} days`,
      due_date: new Date(Date.now() + protocol.postCareFollowUpDays * 86400000).toISOString().split('T')[0],
      priority: 'High',
      status: 'Pending',
      created_by: 'AI Agent'
    };

    const updatedFollowUps = [postCareTask, ...currentState.followUps];
    updateState({ appointments: updated, followUps: updatedFollowUps });

    // Sync to Supabase server
    try {
      fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAppt)
      }).catch((err) => console.warn('[Add Appointment API Sync Notice]:', err));
    } catch {}

    return newAppt;
  }, []);

  // Doctor / Staff action: Schedule Next Sitting
  const scheduleNextSitting = useCallback((
    currentApptId: string, 
    nextDate: string, 
    nextTime: string, 
    notes?: string
  ) => {
    const current = currentState.appointments.find(a => a.id === currentApptId);
    if (!current) return null;

    const protocol = getTreatmentProtocol(current.department);
    const nextSittingNum = (current.current_sitting || 1) + 1;
    const totalSittings = current.total_sittings || protocol.totalSittings;

    const cleanDate = (nextDate || '').replace(/\D/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingId = `LF-${cleanDate || '20261007'}-${randomSuffix}`;

    const nextAppt: Appointment = {
      id: `appt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      booking_id: bookingId,
      patient_name: current.patient_name,
      phone_number: current.phone_number,
      date: nextDate,
      time: nextTime,
      department: current.department,
      doctor: current.doctor || protocol.defaultDoctor,
      status: 'Confirmed (Staff)',
      current_sitting: nextSittingNum,
      total_sittings: totalSittings,
      sitting_interval: current.sitting_interval || protocol.sittingInterval,
      sitting_interval_days: current.sitting_interval_days || protocol.sittingIntervalDays,
      sitting: `Sitting ${nextSittingNum} of ${totalSittings}`,
      notes: notes ? `[Booking ID: ${bookingId}] ${notes}` : `[Booking ID: ${bookingId}] Follow-up sitting scheduled by doctor. Interval: ${current.sitting_interval || protocol.sittingInterval}`
    };

    // Update current appointment with next_sitting_date & Mark Completed
    const updatedAppts = currentState.appointments.map(a => 
      a.id === currentApptId 
        ? { ...a, next_sitting_date: nextDate, status: 'Completed' } 
        : a
    );

    // Queue interval reminder task for AI agent
    const reminderTask: FollowUpTask = {
      id: `fu-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      appointment_id: nextAppt.id,
      patient_name: nextAppt.patient_name,
      phone_number: nextAppt.phone_number,
      department: nextAppt.department,
      sitting_info: `Sitting ${nextSittingNum} of ${totalSittings}`,
      reason: `Pre-Sitting Reminder & Pre-Care (Scheduled on ${nextDate} at ${nextTime})`,
      type: 'next_sitting_reminder',
      due: `Scheduled for ${nextDate}`,
      due_date: nextDate,
      priority: 'High',
      status: 'Pending',
      created_by: 'Doctor'
    };

    updateState({ 
      appointments: [nextAppt, ...updatedAppts],
      followUps: [reminderTask, ...currentState.followUps]
    });

    try {
      fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextAppt)
      }).catch((err) => console.warn('[Schedule Next Sitting Sync Notice]:', err));
    } catch {}

    return nextAppt;
  }, []);

  // Doctor/Admin action: Mark sitting completed & shift details into Follow-Up section
  const completeSitting = useCallback((
    appointmentId: string, 
    customNextDate?: string, 
    customGapText?: string, 
    customGapDays?: number
  ) => {
    const current = currentState.appointments.find(a => a.id === appointmentId);
    if (!current) return;

    const protocol = getTreatmentProtocol(current.department);
    const currentSitting = current.current_sitting || 1;
    const totalSittings = current.total_sittings || protocol.totalSittings;
    const intervalDays = customGapDays || current.sitting_interval_days || protocol.sittingIntervalDays || 14;
    const intervalText = customGapText || current.sitting_interval || protocol.sittingInterval || '2 weeks';
    const nowIso = new Date().toISOString();

    const updatedAppts = currentState.appointments.map(a => 
      a.id === appointmentId ? { ...a, status: 'Completed', completed_at: nowIso } : a
    );

    const newTasks: FollowUpTask[] = [];

    // 1. Post-care check-in follow-up
    newTasks.push({
      id: `fu-${Date.now()}-pc`,
      appointment_id: current.id,
      patient_name: current.patient_name,
      phone_number: current.phone_number,
      department: current.department,
      sitting_info: `Completed: Sitting ${currentSitting} of ${totalSittings}`,
      reason: `Post-Sitting Care & Recovery Check (${current.department})`,
      type: 'post_care',
      due: 'In 2 days',
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      priority: 'High',
      status: 'Pending',
      created_by: 'Doctor',
      total_sittings: totalSittings,
      current_sitting: currentSitting,
      interval_gap: intervalText,
      interval_days: intervalDays,
      completed_at: nowIso,
      whatsapp_message_content: `Hello ${current.patient_name}, Dr. Mrinalini at La Fleur Clinic hopes you are doing well after your ${current.department} session today. Please follow prescribed post-care instructions and keep the area hydrated. Reply if you have any questions.`
    });

    // 2. If there are remaining sittings, create Next Sitting Due Reminder task shifted to Follow-Up section
    if (currentSitting < totalSittings) {
      const nextDueTimestamp = customNextDate 
        ? new Date(customNextDate).getTime() 
        : Date.now() + intervalDays * 86400000;
      const nextDueDateStr = !isNaN(nextDueTimestamp) 
        ? new Date(nextDueTimestamp).toISOString().split('T')[0] 
        : new Date(Date.now() + intervalDays * 86400000).toISOString().split('T')[0];

      newTasks.push({
        id: `fu-${Date.now()}-ns`,
        appointment_id: current.id,
        patient_name: current.patient_name,
        phone_number: current.phone_number,
        department: current.department,
        sitting_info: `Sitting ${currentSitting + 1} of ${totalSittings}`,
        reason: `Next Sitting ${currentSitting + 1} Due Nudge (${intervalText} interval gap)`,
        type: 'next_sitting_reminder',
        due: `Due on ${nextDueDateStr} (${intervalText} gap)`,
        due_date: nextDueDateStr,
        priority: 'High',
        status: 'Pending',
        created_by: 'Doctor',
        total_sittings: totalSittings,
        current_sitting: currentSitting + 1,
        interval_gap: intervalText,
        interval_days: intervalDays,
        completed_at: nowIso,
        whatsapp_message_content: `Dear ${current.patient_name}, Dr. Mrinalini at La Fleur Clinic recommends your Sitting ${currentSitting + 1} of ${totalSittings} for ${current.department} on ${nextDueDateStr} (${intervalText} gap). Please reply to confirm your preferred slot.`
      });
    }

    updateState({
      appointments: updatedAppts,
      followUps: [...newTasks, ...currentState.followUps]
    });

    try {
      fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointmentId, status: 'Completed', completed_at: nowIso })
      }).catch((err) => console.warn('[Complete Sitting Sync Notice]:', err));
    } catch {}
  }, []);

  // Admin / Manager action: Update appointment sittings count and interval gap
  const updateAppointmentProtocol = useCallback((
    appointmentId: string, 
    updates: Partial<Appointment>
  ) => {
    updateState({
      appointments: currentState.appointments.map(appt => 
        appt.id === appointmentId 
          ? { 
              ...appt, 
              ...updates,
              sitting: updates.total_sittings && updates.total_sittings > 1 
                ? `Sitting ${updates.current_sitting || appt.current_sitting || 1} of ${updates.total_sittings}`
                : (updates.sitting || appt.sitting)
            } 
          : appt
      )
    });

    try {
      fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointmentId, ...updates })
      }).catch((err) => console.warn('[Update Protocol Sync Notice]:', err));
    } catch {}
  }, []);

  // Follow-Up Actions: Update sittings and interval gap
  const updateFollowUpSittings = useCallback((
    followUpId: string, 
    updates: { 
      total_sittings?: number; 
      current_sitting?: number;
      interval_gap?: string; 
      interval_days?: number; 
      next_due_date?: string; 
      reason?: string;
      whatsapp_message_content?: string;
    }
  ) => {
    updateState({
      followUps: currentState.followUps.map(task => {
        if (task.id !== followUpId) return task;
        const total = updates.total_sittings || task.total_sittings || 4;
        const current = updates.current_sitting || task.current_sitting || 1;
        const gap = updates.interval_gap || task.interval_gap || '2 weeks';
        const dueDate = updates.next_due_date || task.due_date;
        return {
          ...task,
          ...updates,
          sitting_info: total > 1 ? `Sitting ${current} of ${total}` : task.sitting_info,
          due: dueDate ? `Due on ${dueDate} (${gap} gap)` : task.due,
          reason: updates.reason || task.reason,
          whatsapp_message_content: updates.whatsapp_message_content || `Dear ${task.patient_name}, Dr. Mrinalini at La Fleur Clinic recommends your Sitting ${current} of ${total} for ${task.department} on ${dueDate} (${gap} gap). Please reply to confirm your slot.`
        };
      })
    });
  }, []);

  const clearAppointments = useCallback(() => {
    updateState({ appointments: [] });
  }, []);

  const rescheduleAppointment = useCallback((patientName: string, newDate: string, newTime: string) => {
    const target = currentState.appointments.find(a => a.patient_name.toLowerCase() === patientName.toLowerCase());
    updateState({
      appointments: currentState.appointments.map(appt => 
        appt.patient_name.toLowerCase() === patientName.toLowerCase()
          ? { ...appt, date: newDate, time: newTime, status: 'Rescheduled' }
          : appt
      )
    });

    if (target?.id) {
      try {
        fetch('/api/appointments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: target.id, date: newDate, time: newTime, status: 'Rescheduled' })
        }).catch((err) => console.warn('[Reschedule Sync Notice]:', err));
      } catch {}
    }
  }, []);

  // Follow-Up Actions
  const addFollowUpTask = useCallback((task: Omit<FollowUpTask, 'id' | 'status'>) => {
    const newTask: FollowUpTask = {
      ...task,
      id: `fu-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      status: 'Pending'
    };
    updateState({ followUps: [newTask, ...currentState.followUps] });
    return newTask;
  }, []);

  const completeFollowUpTask = useCallback((id: string) => {
    updateState({
      followUps: currentState.followUps.map(task => 
        task.id === id ? { ...task, status: 'Completed', completed_at: new Date().toISOString() } : task
      )
    });
    if (id && !id.startsWith('fu-temp')) {
      fetch(`/api/follow-ups/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' })
      }).catch(err => console.warn('Complete follow up DB sync notice:', err));
    }
  }, []);

  const deleteFollowUpTask = useCallback((id: string) => {
    updateState({
      followUps: currentState.followUps.filter(task => task.id !== id)
    });
    if (id) {
      fetch(`/api/follow-ups/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }).catch(err => console.warn('Delete follow up DB sync notice:', err));
    }
  }, []);

  const sendFollowUpWhatsApp = useCallback((id: string, customMessage?: string) => {
    updateState({
      followUps: currentState.followUps.map(task => 
        task.id === id 
          ? { 
              ...task, 
              status: 'Sent (AI)', 
              whatsapp_message_content: customMessage || task.whatsapp_message_content 
            } 
          : task
      )
    });
    if (id && !id.startsWith('fu-temp')) {
      fetch(`/api/follow-ups/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Sent (AI)', whatsapp_message_content: customMessage })
      }).catch(err => console.warn('Send follow up DB sync notice:', err));
    }
  }, []);

  const clearFollowUps = useCallback(() => {
    updateState({ followUps: [] });
  }, []);

  // Knowledge Base Actions
  const addKnowledgeItem = useCallback((item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newItem: KnowledgeItem = {
      ...item,
      id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    const updated = [newItem, ...currentState.knowledgeItems];
    updateState({ knowledgeItems: updated });
    pushKnowledgeItems(updated);
    return newItem;
  }, []);

  const updateKnowledgeItem = useCallback((id: string, partial: Partial<KnowledgeItem>) => {
    const updated = currentState.knowledgeItems.map(item => 
      item.id === id 
        ? { ...item, ...partial, updatedAt: new Date().toISOString().split('T')[0] } 
        : item
    );
    updateState({ knowledgeItems: updated });
    pushKnowledgeItems(updated);
  }, []);

  const deleteKnowledgeItem = useCallback((id: string) => {
    const updated = currentState.knowledgeItems.filter(item => item.id !== id);
    updateState({ knowledgeItems: updated });
    pushKnowledgeItems(updated);
  }, []);

  const toggleKnowledgeItem = useCallback((id: string) => {
    const updated = currentState.knowledgeItems.map(item => 
      item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
    );
    updateState({ knowledgeItems: updated });
    pushKnowledgeItems(updated);
  }, []);

  const resetKnowledgeItems = useCallback(() => {
    updateState({ knowledgeItems: defaultKnowledgeItems });
    pushKnowledgeItems(defaultKnowledgeItems);
  }, []);

  // Patient & Appointment Deletion (Admin and local sync)
  const deletePatient = useCallback((phoneOrId: string) => {
    if (!phoneOrId) return;
    const cleanTarget = phoneOrId.trim().toLowerCase().replace(/[\s\-\(\)\+]/g, '');

    const updatedAppts = currentState.appointments.filter(a => {
      const cleanPhone = (a.phone_number || '').toLowerCase().replace(/[\s\-\(\)\+]/g, '');
      const cleanId = (a.id || '').toLowerCase();
      return a.id !== phoneOrId && cleanPhone !== cleanTarget && cleanId !== cleanTarget;
    });

    const updatedFollowUps = currentState.followUps.filter(f => {
      const cleanPhone = (f.phone_number || '').toLowerCase().replace(/[\s\-\(\)\+]/g, '');
      const cleanApptId = (f.appointment_id || '').toLowerCase();
      const cleanId = (f.id || '').toLowerCase();
      return (
        f.id !== phoneOrId &&
        f.appointment_id !== phoneOrId &&
        cleanPhone !== cleanTarget &&
        cleanApptId !== cleanTarget &&
        cleanId !== cleanTarget
      );
    });

    const currentDeleted = currentState.deletedPatientPhones || [];
    const updatedDeleted = Array.from(new Set([...currentDeleted, phoneOrId, cleanTarget]));
    stampDeletions([phoneOrId, cleanTarget]);

    updateState({
      appointments: updatedAppts,
      followUps: updatedFollowUps,
      deletedPatientPhones: updatedDeleted
    });
  }, []);

  const deleteAppointment = useCallback((appointmentId: string) => {
    if (!appointmentId) return;
    const cleanTarget = String(appointmentId).trim().toLowerCase();
    const updatedAppts = currentState.appointments.filter(a => {
      const aId = String(a.id || '').trim().toLowerCase();
      const bId = String(a.booking_id || '').trim().toLowerCase();
      return aId !== cleanTarget && bId !== cleanTarget;
    });
    const updatedFollowUps = currentState.followUps.filter(f => {
      const fApptId = String(f.appointment_id || '').trim().toLowerCase();
      const fId = String(f.id || '').trim().toLowerCase();
      return fApptId !== cleanTarget && fId !== cleanTarget;
    });
    updateState({
      appointments: updatedAppts,
      followUps: updatedFollowUps
    });

    try {
      fetch(`/api/appointments?id=${encodeURIComponent(appointmentId)}`, { method: 'DELETE' })
        .catch((err) => console.warn('[Delete Appointment Sync Notice]:', err));
    } catch {}
  }, []);

  return {
    ...state,
    setSystemPrompt,
    resetSystemPrompt,
    setLLMConfig,
    resetLLMConfig,
    setIsCalendarConnected,
    addAppointment,
    scheduleNextSitting,
    completeSitting,
    updateAppointmentProtocol,
    updateFollowUpSittings,
    clearAppointments,
    rescheduleAppointment,
    deletePatient,
    deleteAppointment,
    addFollowUpTask,
    completeFollowUpTask,
    deleteFollowUpTask,
    sendFollowUpWhatsApp,
    clearFollowUps,
    addKnowledgeItem,
    updateKnowledgeItem,
    deleteKnowledgeItem,
    toggleKnowledgeItem,
    resetKnowledgeItems,
    syncAppointments: syncAppointmentsFromDatabase
  };
}



