/**
 * Canonical Patient Filtering & Deduplication Utility
 * Ensures Patient Registry, Broadcast Audience Selection, and Campaign Dispatch
 * always share the exact same active registered patients count and list.
 */

export function cleanPhoneNumber(raw: any): string {
  if (raw === undefined || raw === null) return '';
  let str = String(raw).trim();
  str = str.replace(/[^\d+]/g, '');
  if (str.startsWith('+')) str = str.slice(1);
  str = str.replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(str)) {
    str = '91' + str;
  }
  return str;
}

export function getPhoneKey(phone?: string): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function isDeletedPatient(
  phone?: string,
  id?: string,
  name?: string,
  extraDeletedList?: string[]
): boolean {
  const cleanP = (phone || '').toLowerCase().replace(/[\s\-\(\)\+]/g, '');
  const cleanId = (id || '').toLowerCase();
  const cleanName = (name || '').toLowerCase();

  // Filter dummy or invalid placeholder records
  if (
    cleanP.includes('9876543210') ||
    cleanP.includes('9812345678') ||
    cleanId === '1' ||
    cleanId === '2'
  ) {
    return true;
  }
  if (
    cleanP.includes('{{') ||
    cleanP.includes('whatsapp_number') ||
    cleanP.includes('dummy') ||
    cleanP.length < 8
  ) {
    return true;
  }
  if (cleanName.includes('priya sharma') || cleanName.includes('rohan mehra')) {
    return true;
  }

  // Check extra deleted list passed in
  if (extraDeletedList && extraDeletedList.length > 0) {
    const isMatch = extraDeletedList.some((d) => {
      const cleanD = (d || '').toLowerCase().replace(/[\s\-\(\)\+]/g, '');
      return cleanD === cleanP || cleanD === cleanId || d === phone || d === id;
    });
    if (isMatch) return true;
  }

  // Check localStorage for deleted patients in browser environment
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('wacrm_deleted_patients');
      if (stored) {
        const deletedList: string[] = JSON.parse(stored);
        if (Array.isArray(deletedList) && deletedList.length > 0) {
          return deletedList.some((d) => {
            const cleanD = (d || '').toLowerCase().replace(/[\s\-\(\)\+]/g, '');
            return cleanD === cleanP || cleanD === cleanId || d === phone || d === id;
          });
        }
      }
    } catch {}
  }

  return false;
}

export interface UnifiedPatient {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string;
  department?: string;
  doctor?: string;
  status?: string;
  category?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  source?: string;
}

/**
 * Filter and deduplicate a list of contacts/patients into the exact active registered list.
 */
export function filterActivePatients<T extends { phone?: string; id?: string; name?: string }>(
  rawList: T[],
  extraDeletedList?: string[]
): T[] {
  const result: T[] = [];
  const seenPhoneKeys = new Set<string>();

  for (const item of rawList) {
    if (isDeletedPatient(item.phone, item.id, item.name, extraDeletedList)) {
      continue;
    }
    const phoneKey = getPhoneKey(item.phone);
    if (!phoneKey || seenPhoneKeys.has(phoneKey)) {
      continue;
    }
    seenPhoneKeys.add(phoneKey);
    result.push(item);
  }

  return result;
}

/**
 * Unified Patient Loader: aggregates and deduplicates all active clinic patients
 * from localStorage (appointments, custom patients, demo state, pipelines) and APIs.
 */
export async function getUnifiedPatientList(extraDeletedList?: string[]): Promise<UnifiedPatient[]> {
  const seenPhoneKeys = new Set<string>();
  const patientList: UnifiedPatient[] = [];

  const addPatient = (rawPhone?: string, rawName?: string, extra?: any, source = 'system') => {
    if (!rawPhone) return;
    const cleanP = cleanPhoneNumber(rawPhone);
    const phoneKey = getPhoneKey(rawPhone);
    if (!phoneKey || !cleanP) return;

    if (isDeletedPatient(rawPhone, extra?.id, rawName, extraDeletedList)) {
      return;
    }

    if (seenPhoneKeys.has(phoneKey)) {
      // If already present, enrich details if better
      const existing = patientList.find(p => getPhoneKey(p.phone) === phoneKey);
      if (existing) {
        if ((!existing.name || existing.name === 'Valued Patient') && rawName && rawName !== 'Valued Patient') {
          existing.name = rawName;
        }
        if (!existing.department && extra?.department) existing.department = extra.department;
        if (!existing.doctor && extra?.doctor) existing.doctor = extra.doctor;
      }
      return;
    }

    seenPhoneKeys.add(phoneKey);
    const resolvedName = (rawName && rawName.trim() && rawName.toLowerCase() !== 'patient' && rawName.toLowerCase() !== 'valued patient')
      ? rawName.trim()
      : 'Valued Patient';

    patientList.push({
      id: extra?.id || `patient_${phoneKey}`,
      name: resolvedName,
      phone: rawPhone,
      cleanPhone: cleanP,
      department: extra?.department || extra?.treatment || 'General Dermatology',
      doctor: extra?.doctor || 'Dr. Mrinalini',
      status: extra?.status || 'Confirmed',
      category: extra?.category || 'Clinical',
      appointmentDate: extra?.appointmentDate || extra?.date,
      appointmentTime: extra?.appointmentTime || extra?.time,
      source,
    });
  };

  // 1. Load from browser localStorage
  if (typeof window !== 'undefined') {
    // a. Appointments
    try {
      const storedAppts = localStorage.getItem('wacrm_appointments');
      if (storedAppts) {
        const parsed = JSON.parse(storedAppts);
        if (Array.isArray(parsed)) {
          for (const a of parsed) {
            addPatient(a.phone_number || a.phone, a.patient_name || a.name, a, 'appointment');
          }
        }
      }
    } catch {}

    // b. Demo State Appointments
    try {
      const storedDemo = localStorage.getItem('wacrm_demo_state');
      if (storedDemo) {
        const parsed = JSON.parse(storedDemo);
        if (parsed?.appointments && Array.isArray(parsed.appointments)) {
          for (const a of parsed.appointments) {
            addPatient(a.phone_number || a.phone, a.patient_name || a.name, a, 'demo_state');
          }
        }
      }
    } catch {}

    // c. Custom Patients
    try {
      const storedCustom = localStorage.getItem('wacrm_custom_patients');
      if (storedCustom) {
        const parsed = JSON.parse(storedCustom);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            addPatient(p.phone || p.phone_number, p.name, p, 'custom');
          }
        }
      }
    } catch {}

    // d. Pipeline Cards
    try {
      const storedPipeline = localStorage.getItem('wacrm_pipeline_cards_v1');
      if (storedPipeline) {
        const parsed = JSON.parse(storedPipeline);
        if (Array.isArray(parsed)) {
          for (const card of parsed) {
            addPatient(card.phone, card.name, {
              id: card.id,
              department: card.department || card.service,
              status: card.stage,
            }, 'pipeline');
          }
        }
      }
    } catch {}
  }

  // 2. Fetch live appointments API if in browser
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/appointments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.appointments)) {
          for (const a of data.appointments) {
            addPatient(a.phone_number || a.phone, a.patient_name, a, 'api_appointments');
          }
        }
      }
    } catch {}

    // 3. Fetch live contacts API
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.contacts)) {
          for (const c of data.contacts) {
            addPatient(c.phone || c.phone_number, c.name, c, 'api_contacts');
          }
        }
      }
    } catch {}
  }

  return patientList;
}

