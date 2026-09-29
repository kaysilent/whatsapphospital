import { describe, it, expect } from 'vitest';
import {
  formatReadableDate,
  formatDateRange,
  isDateWithinRange,
  isDoctorAway,
  generateDoctorAwayNotice,
  getDoctorStatusMeta,
  DoctorAvailability,
  DEFAULT_DOCTORS
} from './availability';

describe('Doctor Availability & Holiday System', () => {
  describe('formatReadableDate & formatDateRange', () => {
    it('formats single dates into human-readable strings', () => {
      expect(formatReadableDate('2026-09-24')).toContain('24');
      expect(formatReadableDate('2026-09-24')).toContain('Sep');
      expect(formatReadableDate('2026-09-24')).toContain('2026');
    });

    it('formats date ranges ("when to when")', () => {
      const range = formatDateRange('2026-09-24', '2026-09-28');
      expect(range).toContain('24');
      expect(range).toContain('28');
      expect(range).toContain('Sep');
    });

    it('handles same start and end date', () => {
      const singleDay = formatDateRange('2026-09-24', '2026-09-24');
      expect(singleDay).toContain('Sep 24, 2026');
    });

    it('handles missing start or end dates gracefully', () => {
      expect(formatDateRange('2026-09-24', undefined)).toContain('From');
      expect(formatDateRange(undefined, '2026-09-28')).toContain('Until');
      expect(formatDateRange(undefined, undefined)).toBe('');
    });
  });

  describe('isDateWithinRange', () => {
    it('returns true when date is within range', () => {
      expect(isDateWithinRange('2026-09-25', '2026-09-24', '2026-09-28')).toBe(true);
    });

    it('returns true on start and end date boundaries', () => {
      expect(isDateWithinRange('2026-09-24', '2026-09-24', '2026-09-28')).toBe(true);
      expect(isDateWithinRange('2026-09-28', '2026-09-24', '2026-09-28')).toBe(true);
    });

    it('returns false when date is outside range', () => {
      expect(isDateWithinRange('2026-09-23', '2026-09-24', '2026-09-28')).toBe(false);
      expect(isDateWithinRange('2026-09-29', '2026-09-24', '2026-09-28')).toBe(false);
    });
  });

  describe('isDoctorAway', () => {
    it('returns false for available doctor', () => {
      const doc: DoctorAvailability = {
        id: 'doc-ananya',
        doctorId: 'doc-ananya',
        doctorName: 'Dr. Ananya Sharma',
        title: 'Chief Physician',
        department: 'Dermatology',
        status: 'available',
        updatedAt: new Date().toISOString()
      };
      expect(isDoctorAway(doc, '2026-09-25')).toBe(false);
    });

    it('returns true when doctor is on holiday during active date range', () => {
      const doc: DoctorAvailability = {
        id: 'doc-shalini',
        doctorId: 'doc-shalini',
        doctorName: 'Dr. Shalini Roy',
        title: 'Trichologist',
        department: 'Hair Restoration',
        status: 'holiday',
        startDate: '2026-09-24',
        endDate: '2026-09-28',
        reason: 'Annual Vacation',
        coveringDoctor: 'Dr. Meera Kapoor',
        updatedAt: new Date().toISOString()
      };
      expect(isDoctorAway(doc, '2026-09-25')).toBe(true);
      expect(isDoctorAway(doc, '2026-09-24')).toBe(true);
      expect(isDoctorAway(doc, '2026-09-28')).toBe(true);
      expect(isDoctorAway(doc, '2026-09-30')).toBe(false);
    });

    it('returns true for away status without dates', () => {
      const doc: DoctorAvailability = {
        id: 'doc-meera',
        doctorId: 'doc-meera',
        doctorName: 'Dr. Meera Kapoor',
        title: 'Laser Specialist',
        department: 'Cosmetic Dermatology',
        status: 'away',
        reason: 'Emergency',
        updatedAt: new Date().toISOString()
      };
      expect(isDoctorAway(doc, new Date())).toBe(true);
    });
  });

  describe('generateDoctorAwayNotice', () => {
    it('generates clear holiday notice with dates and covering doctor', () => {
      const doc: DoctorAvailability = {
        id: 'doc-ananya',
        doctorId: 'doc-ananya',
        doctorName: 'Dr. Ananya Sharma',
        title: 'CMO',
        department: 'Aesthetics',
        status: 'holiday',
        startDate: '2026-09-24',
        endDate: '2026-09-28',
        reason: 'Medical Conference',
        coveringDoctor: 'Dr. Shalini Roy',
        updatedAt: new Date().toISOString()
      };
      const notice = generateDoctorAwayNotice(doc);
      expect(notice).toContain('Dr. Ananya Sharma');
      expect(notice).toContain('Medical Conference');
      expect(notice).toContain('Dr. Shalini Roy');
    });

    it('generates in_surgery notice with time', () => {
      const doc: DoctorAvailability = {
        id: 'doc-meera',
        doctorId: 'doc-meera',
        doctorName: 'Dr. Meera Kapoor',
        title: 'Laser Specialist',
        department: 'Lasers',
        status: 'in_surgery',
        endTime: '04:30 PM',
        updatedAt: new Date().toISOString()
      };
      const notice = generateDoctorAwayNotice(doc);
      expect(notice).toContain('procedure/surgery');
      expect(notice).toContain('04:30 PM');
    });
  });

  describe('getDoctorStatusMeta', () => {
    it('returns correct visual metadata for all status types', () => {
      expect(getDoctorStatusMeta('available').label).toBe('Active & Available');
      expect(getDoctorStatusMeta('holiday').label).toBe('Away on Holiday');
      expect(getDoctorStatusMeta('away').label).toBe('Doctor Away');
      expect(getDoctorStatusMeta('in_surgery').label).toBe('In Surgery');
      expect(getDoctorStatusMeta('off_duty').label).toBe('Off Duty');
    });
  });

  describe('DEFAULT_DOCTORS', () => {
    it('includes Dr. Mrinalini as primary sole doctor', () => {
      expect(DEFAULT_DOCTORS.length).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_DOCTORS[0].doctorName).toBe('Dr. Mrinalini');
      expect(DEFAULT_DOCTORS[0].status).toBe('available');
    });
  });
});
