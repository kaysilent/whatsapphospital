"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  DoctorAvailability,
  DoctorHolidayRecord,
  HospitalConfig,
  DEFAULT_DOCTORS,
  DEFAULT_HOSPITAL_CONFIG,
  DOCTOR_STORAGE_KEY,
  HOLIDAY_HISTORY_STORAGE_KEY,
  HOSPITAL_CONFIG_STORAGE_KEY,
  isDoctorAway,
  generateDoctorAwayNotice,
  formatDateRange
} from '@/lib/doctor/availability';
import { useAuth } from '@/hooks/use-auth';

const EVENT_NAME = 'doctor-availability-changed';

export function useDoctorAvailability() {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<DoctorAvailability[]>(DEFAULT_DOCTORS);
  const [holidayHistory, setHolidayHistory] = useState<DoctorHolidayRecord[]>([]);
  const [hospitalConfig, setHospitalConfig] = useState<HospitalConfig>(DEFAULT_HOSPITAL_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage
  const loadState = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedConfig = localStorage.getItem(HOSPITAL_CONFIG_STORAGE_KEY);
      if (storedConfig) {
        setHospitalConfig({ ...DEFAULT_HOSPITAL_CONFIG, ...JSON.parse(storedConfig) });
      } else {
        setHospitalConfig(DEFAULT_HOSPITAL_CONFIG);
      }

      const storedDocs = localStorage.getItem(DOCTOR_STORAGE_KEY);
      if (storedDocs) {
        const parsed = JSON.parse(storedDocs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = DEFAULT_DOCTORS.map(defDoc => {
            const found = parsed.find((p: any) => p.doctorId === defDoc.doctorId || p.id === defDoc.id || p.doctorName === defDoc.doctorName);
            return found ? { ...defDoc, ...found } : defDoc;
          });
          setDoctors(merged);
        } else {
          setDoctors(DEFAULT_DOCTORS);
        }
      } else {
        setDoctors(DEFAULT_DOCTORS);
      }

      const storedHistory = localStorage.getItem(HOLIDAY_HISTORY_STORAGE_KEY);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          setHolidayHistory(parsedHistory);
        }
      }
    } catch (e) {
      console.error('Failed to load doctor availability:', e);
      setDoctors(DEFAULT_DOCTORS);
      setHospitalConfig(DEFAULT_HOSPITAL_CONFIG);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadState();

    const handleCustomEvent = () => {
      loadState();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === DOCTOR_STORAGE_KEY || e.key === HOLIDAY_HISTORY_STORAGE_KEY || e.key === HOSPITAL_CONFIG_STORAGE_KEY) {
        loadState();
      }
    };

    window.addEventListener(EVENT_NAME, handleCustomEvent);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(EVENT_NAME, handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadState]);

  // Persist doctors state
  const saveDoctors = useCallback((newDoctors: DoctorAvailability[]) => {
    setDoctors(newDoctors);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DOCTOR_STORAGE_KEY, JSON.stringify(newDoctors));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(EVENT_NAME));
        }, 0);
      } catch (e) {
        console.error('Failed to save doctor availability:', e);
      }
    }
  }, []);

  // Persist hospital config
  const updateHospitalConfig = useCallback((updates: Partial<HospitalConfig>) => {
    setHospitalConfig((prev) => {
      const updated: HospitalConfig = {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(HOSPITAL_CONFIG_STORAGE_KEY, JSON.stringify(updated));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(EVENT_NAME));
          }, 0);
        } catch (e) {
          console.error('Failed to save hospital config:', e);
        }
      }
      return updated;
    });
  }, []);

  // Quick helper to set hospital status
  const setHospitalStatus = useCallback((
    status: 'online' | 'offline' | 'holiday',
    details?: {
      offlineReturnTime?: string;
      offlineReason?: string;
      holidayStartDate?: string;
      holidayEndDate?: string;
      holidayReason?: string;
    }
  ) => {
    updateHospitalConfig({
      status,
      offlineReturnTime: details?.offlineReturnTime,
      offlineReason: details?.offlineReason,
      holidayStartDate: details?.holidayStartDate,
      holidayEndDate: details?.holidayEndDate,
      holidayReason: details?.holidayReason
    });
  }, [updateHospitalConfig]);

  // Persist holiday history
  const saveHolidayHistory = useCallback((newHistory: DoctorHolidayRecord[]) => {
    setHolidayHistory(newHistory);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(HOLIDAY_HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(EVENT_NAME));
        }, 0);
      } catch (e) {
        console.error('Failed to save doctor holiday history:', e);
      }
    }
  }, []);

  // Get active doctor (defaults to Dr. Mrinalini)
  const currentDoctorName = profile?.full_name || 'Dr. Mrinalini';
  const activeDoctor = doctors.find(
    d => d.doctorName.toLowerCase().trim() === currentDoctorName.toLowerCase().trim()
  ) || doctors[0] || DEFAULT_DOCTORS[0];

  // Helper to find a doctor by name
  const getDoctorByName = useCallback((name: string): DoctorAvailability | undefined => {
    if (!name) return undefined;
    const clean = name.toLowerCase().trim();
    return doctors.find(d => 
      d.doctorName.toLowerCase().trim() === clean ||
      d.doctorName.toLowerCase().includes(clean) ||
      clean.includes(d.doctorName.toLowerCase())
    );
  }, [doctors]);

  // Check if a doctor is away by name and target date
  const isDoctorAwayByName = useCallback((
    doctorName: string, 
    targetDate: string | Date = new Date()
  ): { isAway: boolean; doctor?: DoctorAvailability; notice?: string; dateRange?: string } => {
    const doc = getDoctorByName(doctorName);
    if (!doc) return { isAway: false };

    const away = isDoctorAway(doc, targetDate);
    if (!away) return { isAway: false, doctor: doc };

    const notice = doc.autoReplyNotice || generateDoctorAwayNotice(doc);
    const dateRange = formatDateRange(doc.startDate, doc.endDate);

    return {
      isAway: true,
      doctor: doc,
      notice,
      dateRange
    };
  }, [getDoctorByName]);

  // Update a doctor's full status or properties
  const updateDoctor = useCallback((doctorId: string, updates: Partial<DoctorAvailability>) => {
    const updated = doctors.map(doc => {
      if (doc.doctorId === doctorId || doc.id === doctorId) {
        const merged: DoctorAvailability = {
          ...doc,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        if (!merged.autoReplyNotice && (merged.status === 'away' || merged.status === 'holiday')) {
          merged.autoReplyNotice = generateDoctorAwayNotice(merged);
        }
        return merged;
      }
      return doc;
    });

    saveDoctors(updated);
  }, [doctors, saveDoctors]);

  // Set Doctor on Holiday / Away with date range
  const setDoctorHoliday = useCallback((
    doctorId: string,
    params: {
      startDate: string;
      endDate: string;
      reason?: string;
      coveringDoctor?: string;
      autoReplyNotice?: string;
      status?: 'away' | 'holiday';
    }
  ) => {
    const targetDoc = doctors.find(d => d.doctorId === doctorId || d.id === doctorId);
    if (!targetDoc) return;

    const status = params.status || 'holiday';
    const tempDoc: DoctorAvailability = {
      ...targetDoc,
      status,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason || 'Annual Leave / Holiday',
      coveringDoctor: params.coveringDoctor,
      autoReplyNotice: params.autoReplyNotice,
      updatedAt: new Date().toISOString()
    };

    if (!tempDoc.autoReplyNotice) {
      tempDoc.autoReplyNotice = generateDoctorAwayNotice(tempDoc);
    }

    // Add to history records
    const newRecord: DoctorHolidayRecord = {
      id: `hol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      doctorId: targetDoc.doctorId,
      doctorName: targetDoc.doctorName,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason || 'Annual Leave / Holiday',
      coveringDoctor: tempDoc.coveringDoctor,
      status: 'active',
      notes: tempDoc.autoReplyNotice,
      createdAt: new Date().toISOString()
    };

    saveHolidayHistory([newRecord, ...holidayHistory.filter(h => h.id !== newRecord.id)]);
    updateDoctor(doctorId, tempDoc);
  }, [doctors, holidayHistory, saveHolidayHistory, updateDoctor]);

  // Quick update for the currently active doctor
  const updateActiveDoctor = useCallback((updates: Partial<DoctorAvailability>) => {
    if (activeDoctor?.doctorId) {
      updateDoctor(activeDoctor.doctorId, updates);
    }
  }, [activeDoctor, updateDoctor]);

  // Quick reset to "Available"
  const setDoctorAvailable = useCallback((doctorId: string) => {
    updateDoctor(doctorId, {
      status: 'available',
      startDate: undefined,
      endDate: undefined,
      startTime: undefined,
      endTime: undefined,
      reason: undefined,
      coveringDoctor: undefined,
      autoReplyNotice: undefined
    });
  }, [updateDoctor]);

  // Delete/Cancel a holiday record
  const deleteHolidayRecord = useCallback((recordId: string) => {
    const updated = holidayHistory.filter(h => h.id !== recordId);
    saveHolidayHistory(updated);
  }, [holidayHistory, saveHolidayHistory]);

  const activeAwayDoctors = doctors.filter(d => isDoctorAway(d, new Date()));
  const activeHolidaysCount = activeAwayDoctors.length;

  return {
    doctors,
    activeDoctor,
    hospitalConfig,
    holidayHistory,
    isLoaded,
    activeAwayDoctors,
    activeHolidaysCount,
    getDoctorByName,
    isDoctorAwayByName,
    updateDoctor,
    updateActiveDoctor,
    updateHospitalConfig,
    setHospitalStatus,
    setDoctorHoliday,
    setDoctorAvailable,
    deleteHolidayRecord,
    refreshAvailability: loadState
  };
}

