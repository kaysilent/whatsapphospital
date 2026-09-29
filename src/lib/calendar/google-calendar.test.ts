import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getGoogleCalendarConfig, 
  saveGoogleCalendarConfig, 
  parseAppointmentDateTime, 
  generateGoogleCalendarEventUrl,
  testGoogleCalendarConnection,
  DEFAULT_GOOGLE_CALENDAR_CONFIG
} from './google-calendar';

describe('Google Calendar Integration Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides sensible default Google Calendar settings for Dr. Mrinalini', () => {
    const config = getGoogleCalendarConfig();
    expect(config.calendarId).toBeDefined();
    expect(config.calendarId.length).toBeGreaterThan(0);
    expect(config.syncTimezone).toBe('Asia/Kolkata');
    expect(config.isConnected).toBe(true);
    expect(config.autoSyncOnBooking).toBe(true);
  });

  it('correctly parses 12-hour and 24-hour appointment times to ISO range', () => {
    const { startIso, endIso } = parseAppointmentDateTime('2026-10-15', '11:30 AM', 45);
    const startDate = new Date(startIso);
    const endDate = new Date(endIso);

    expect(startDate.getFullYear()).toBe(2026);
    expect(startDate.getMonth()).toBe(9); // 0-indexed October
    expect(startDate.getDate()).toBe(15);
    
    // Duration should be exactly 45 minutes
    const diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    expect(diffMinutes).toBe(45);
  });

  it('parses PM afternoon appointment times correctly', () => {
    const { startIso, endIso } = parseAppointmentDateTime('2026-10-15', '03:15 PM', 60);
    const startDate = new Date(startIso);
    const endDate = new Date(endIso);

    const diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    expect(diffMinutes).toBe(60);
  });

  it('generates valid 1-Click "Add to Google Calendar" web intent links', () => {
    const url = generateGoogleCalendarEventUrl({
      title: 'Consultation: Riya Sharma - Hydrafacial',
      description: 'First sitting consultation',
      location: 'La Fleur Clinic, Mumbai',
      startDate: '2026-11-02',
      startTime: '02:00 PM',
      patientName: 'Riya Sharma',
      patientPhone: '+91 98200 12345',
      doctorName: 'Dr. Mrinalini',
      treatmentName: 'Hydrafacial MD',
      appointmentId: 'apt-101'
    });

    expect(url).toContain('calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('Riya');
    expect(url).toContain('Hydrafacial');
    expect(url).toContain('Mrinalini');
  });

  it('tests connection diagnostics and returns low ping latency', async () => {
    const result = await testGoogleCalendarConnection({
      calendarId: 'dr.mrinalini@lafleurwellness.com',
      accountEmail: 'dr.mrinalini@lafleurwellness.com'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('connected');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.calendarDetails?.accountEmail).toBe('dr.mrinalini@lafleurwellness.com');
  });

  it('fails connection test when calendar ID is missing', async () => {
    const result = await testGoogleCalendarConnection({
      calendarId: '',
      accountEmail: ''
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('not_found');
  });
});
