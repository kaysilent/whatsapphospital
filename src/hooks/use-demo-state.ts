"use client";

import { useState, useEffect, useCallback } from 'react';

export type Appointment = {
  id: string;
  patient_name: string;
  phone_number: string;
  date: string;
  time: string;
  department: string;
};

type DemoState = {
  systemPrompt: string;
  isCalendarConnected: boolean;
  appointments: Appointment[];
};

const defaultState: DemoState = {
  systemPrompt: "You are an AI receptionist for the Exercise Hospital. Your goal is to help users book and reschedule appointments, or connect them to a human receptionist. Be polite, concise, and helpful. You must collect details step-by-step. To book an appointment, ask for the patient's name, phone number, preferred date (YYYY-MM-DD), preferred time (HH:MM), and department (e.g., Cardiology, General) one at a time. Once you have gathered ALL 5 pieces of information, call book_appointment. If they want to reschedule, ask for the patient's name, new date, and new time, then call reschedule_appointment. If they want to call the receptionist, inform them that a receptionist will call them shortly at their number.",
  isCalendarConnected: false,
  appointments: [
    { id: '1', patient_name: 'Alice Johnson', phone_number: '+1234567890', date: '2026-09-10', time: '09:00', department: 'Cardiology' },
    { id: '2', patient_name: 'Bob Smith', phone_number: '+1987654321', date: '2026-09-10', time: '10:30', department: 'General' },
    { id: '3', patient_name: 'Charlie Davis', phone_number: '+1122334455', date: '2026-09-11', time: '14:15', department: 'Pediatrics' },
  ]
};

// Global event emitter for same-tab reactivity
const listeners = new Set<() => void>();

let currentState: DemoState = { ...defaultState };

// Initialize from local storage if in browser
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('wacrm_demo_state');
    if (saved) {
      currentState = JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load demo state", e);
  }
}

function updateState(newState: Partial<DemoState>) {
  currentState = { ...currentState, ...newState };
  if (typeof window !== 'undefined') {
    localStorage.setItem('wacrm_demo_state', JSON.stringify(currentState));
  }
  listeners.forEach((listener) => listener());
}

export function useDemoState() {
  const [state, setState] = useState<DemoState>(currentState);

  useEffect(() => {
    const handleUpdate = () => {
      setState(currentState);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'wacrm_demo_state' && e.newValue) {
        try {
          currentState = JSON.parse(e.newValue);
          setState(currentState);
          listeners.forEach(l => l());
        } catch (err) {}
      }
    };

    listeners.add(handleUpdate);
    window.addEventListener('storage', handleStorage);
    
    // Ensure we have the latest state on mount
    handleUpdate();

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setSystemPrompt = useCallback((prompt: string) => {
    updateState({ systemPrompt: prompt });
  }, []);

  const setIsCalendarConnected = useCallback((connected: boolean) => {
    updateState({ isCalendarConnected: connected });
  }, []);

  const addAppointment = useCallback((appt: Omit<Appointment, 'id'>) => {
    const newAppt = { ...appt, id: Math.random().toString(36).substr(2, 9) };
    updateState({ appointments: [newAppt, ...currentState.appointments] });
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
