"use client";

import { useState, useEffect, useCallback } from 'react';

export type Appointment = {
  id: string;
  patient_name: string;
  phone_number: string;
  date: string;
  time: string;
  department: string;
  doctor?: string;
  status?: string;
};

type DemoState = {
  systemPrompt: string;
  isCalendarConnected: boolean;
  appointments: Appointment[];
};

const defaultAppointments: Appointment[] = [
  { id: '1', patient_name: 'Rahul Sharma', phone_number: '+91 98765 43210', date: '2026-09-04', time: '10:30 AM', department: 'Cardiology', doctor: 'Dr. Rajesh Gupta', status: 'Confirmed (AI)' },
  { id: '2', patient_name: 'Priya Patel', phone_number: '+91 98123 45678', date: '2026-09-04', time: '11:15 AM', department: 'Pediatrics', doctor: 'Dr. Shalini Roy', status: 'Confirmed (AI)' },
  { id: '3', patient_name: 'Amit Verma', phone_number: '+91 97234 56789', date: '2026-09-05', time: '02:00 PM', department: 'General Medicine', doctor: 'Dr. Ananya Rao', status: 'Scheduled' },
  { id: '4', patient_name: 'Sunita Reddy', phone_number: '+91 99345 67890', date: '2026-09-05', time: '03:30 PM', department: 'Orthopedics', doctor: 'Dr. Vivek Menon', status: 'Scheduled' },
];

const defaultState: DemoState = {
  systemPrompt: "You are an intelligent, empathetic AI receptionist for Aivry Hospital. Your goal is to help patients book and reschedule doctor appointments, check OPD consultation timings, or handle emergency triage. Be polite, concise, natural, and helpful like a real human receptionist. Collect booking details step-by-step: patient's name, phone number, department (e.g. Cardiology, Pediatrics, General Medicine, Orthopedics, Neurology), preferred date, and preferred time slot. Once details are confirmed, complete the booking.",
  isCalendarConnected: true,
  appointments: defaultAppointments
};

// Global event emitter for same-tab reactivity
const listeners = new Set<() => void>();

let currentState: DemoState = { ...defaultState };

// Initialize from local storage if in browser
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('wacrm_demo_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.appointments)) {
        currentState = {
          ...defaultState,
          ...parsed,
          appointments: parsed.appointments.length > 0 ? parsed.appointments : defaultAppointments
        };
      }
    }
  } catch (e) {
    console.error("Failed to load demo state", e);
  }
}

function updateState(newState: Partial<DemoState>) {
  currentState = { ...currentState, ...newState };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('wacrm_demo_state', JSON.stringify(currentState));
      localStorage.setItem('wacrm_appointments', JSON.stringify(currentState.appointments));
      window.dispatchEvent(new CustomEvent('wacrm_appointments_updated', { detail: currentState.appointments }));
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }
  listeners.forEach((listener) => listener());
}

export function useDemoState() {
  const [state, setState] = useState<DemoState>(currentState);

  useEffect(() => {
    const handleUpdate = () => {
      setState({ ...currentState, appointments: [...currentState.appointments] });
    };

    const handleStorage = (e: StorageEvent) => {
      if ((e.key === 'wacrm_demo_state' || e.key === 'wacrm_appointments') && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            currentState.appointments = parsed;
          } else if (parsed.appointments) {
            currentState = { ...currentState, ...parsed };
          }
          setState({ ...currentState, appointments: [...currentState.appointments] });
          listeners.forEach(l => l());
        } catch (err) {}
      }
    };

    const handleCustomEvent = (e: Event) => {
      setState({ ...currentState, appointments: [...currentState.appointments] });
    };

    listeners.add(handleUpdate);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('wacrm_appointments_updated', handleCustomEvent);
    
    // Ensure we have latest state on mount
    handleUpdate();

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('wacrm_appointments_updated', handleCustomEvent);
    };
  }, []);

  const setSystemPrompt = useCallback((prompt: string) => {
    updateState({ systemPrompt: prompt });
  }, []);

  const setIsCalendarConnected = useCallback((connected: boolean) => {
    updateState({ isCalendarConnected: connected });
  }, []);

  const addAppointment = useCallback((appt: Omit<Appointment, 'id'>) => {
    const docName = appt.department === "Pediatrics" ? "Dr. Shalini Roy" : appt.department === "Orthopedics" ? "Dr. Vivek Menon" : "Dr. Rajesh Gupta";
    const newAppt: Appointment = { 
      ...appt, 
      id: `appt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      doctor: docName,
      status: 'Confirmed (AI)'
    };
    
    // Check if duplicate, else prepend to list
    const filtered = currentState.appointments.filter(a => !(a.patient_name.toLowerCase() === newAppt.patient_name.toLowerCase() && a.date === newAppt.date));
    const updated = [newAppt, ...filtered];
    updateState({ appointments: updated });
    return newAppt;
  }, []);

  const clearAppointments = useCallback(() => {
    updateState({ appointments: [] });
  }, []);

  const rescheduleAppointment = useCallback((patientName: string, newDate: string, newTime: string) => {
    updateState({
      appointments: currentState.appointments.map(appt => 
        appt.patient_name.toLowerCase() === patientName.toLowerCase()
          ? { ...appt, date: newDate, time: newTime }
          : appt
      )
    });
  }, []);

  return {
    ...state,
    setSystemPrompt,
    setIsCalendarConnected,
    addAppointment,
    clearAppointments,
    rescheduleAppointment
  };
}
