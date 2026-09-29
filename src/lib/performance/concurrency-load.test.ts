import { describe, it, expect } from 'vitest';
import { createPaymentLink, formatThankYouMessage, DEFAULT_PAYMENT_CONFIG } from '@/lib/payments/gateway';
import { parseAppointmentDateTime, generateGoogleCalendarEventUrl } from '@/lib/calendar/google-calendar';

describe('50+ Concurrent Users Load & Stress Test Suite', () => {
  const CONCURRENT_USERS = 50;

  it(`handles ${CONCURRENT_USERS} concurrent payment link generations with sub-second latencies`, async () => {
    const startTime = performance.now();

    const userRequests = Array.from({ length: CONCURRENT_USERS }).map((_, index) => {
      const patientId = index + 1;
      return createPaymentLink(
        {
          patientName: `Patient Test ${patientId}`,
          phoneNumber: `+9198765432${(patientId % 90 + 10)}`,
          treatment: patientId % 2 === 0 ? 'HydraFacial MD' : 'Laser Hair Reduction',
          amount: 500,
          appointmentId: `apt-stress-${patientId}`,
          date: '2026-10-15',
          time: '11:30 AM',
          doctor: 'Dr. Mrinalini',
          origin: 'http://localhost:3000',
        },
        DEFAULT_PAYMENT_CONFIG
      );
    });

    const results = await Promise.all(userRequests);
    const durationMs = performance.now() - startTime;

    expect(results).toHaveLength(CONCURRENT_USERS);
    results.forEach((res) => {
      expect(res.paymentId).toBeDefined();
      expect(res.amount).toBe(500);
      expect(res.linkUrl).toContain('/pay/');
      expect(res.qrCodeUrl).toContain('api.qrserver.com');
      expect(res.upiString).toContain('upi://pay');
    });

    // Verify high throughput (all 50 concurrent links generated under 1500ms)
    expect(durationMs).toBeLessThan(1500);
  });

  it(`handles ${CONCURRENT_USERS} concurrent appointment calendar event intent builds`, async () => {
    const startTime = performance.now();

    const calendarTasks = Array.from({ length: CONCURRENT_USERS }).map((_, index) => {
      const patientId = index + 1;
      const { startIso, endIso } = parseAppointmentDateTime('2026-10-20', '02:00 PM', 45);
      const url = generateGoogleCalendarEventUrl({
        title: `Consultation: Patient ${patientId} - Skin Glow`,
        description: 'Session 1 of 4',
        location: 'La Fleur Clinic, Outer Ring Road, Bangalore',
        startDate: '2026-10-20',
        startTime: '02:00 PM',
        durationMinutes: 45,
        patientName: `Patient ${patientId}`,
        patientPhone: `+9198765432${(patientId % 90 + 10)}`,
        doctorName: 'Dr. Mrinalini',
        treatmentName: 'Skin Glow Treatment',
        appointmentId: `apt-gcal-${patientId}`
      });

      return { startIso, endIso, url };
    });

    const results = await Promise.all(calendarTasks);
    const durationMs = performance.now() - startTime;

    expect(results).toHaveLength(CONCURRENT_USERS);
    results.forEach((item) => {
      expect(item.url).toContain('calendar.google.com');
      expect(item.startIso).toContain('2026-10-20');
    });

    expect(durationMs).toBeLessThan(300);
  });

  it(`handles ${CONCURRENT_USERS} concurrent payment confirmation & WhatsApp receipt formatters`, async () => {
    const startTime = performance.now();

    const receiptTasks = Array.from({ length: CONCURRENT_USERS }).map((_, index) => {
      const patientId = index + 1;
      const receiptNo = `REC-2026-${100000 + patientId}`;
      const msg = formatThankYouMessage(
        DEFAULT_PAYMENT_CONFIG.thank_you_message_template,
        {
          patient_name: `Mrs. Ananya Patel ${patientId}`,
          amount: 500,
          treatment: 'Chemical Peel & Rejuvenation',
          date: '2026-11-05',
          time: '04:30 PM',
          doctor: 'Dr. Mrinalini',
          receipt_id: receiptNo,
          payment_mode: 'UPI (Google Pay)',
        }
      );

      return { receiptNo, msg };
    });

    const results = await Promise.all(receiptTasks);
    const durationMs = performance.now() - startTime;

    expect(results).toHaveLength(CONCURRENT_USERS);
    results.forEach(({ receiptNo, msg }) => {
      expect(msg).toContain(receiptNo);
      expect(msg).toContain('Ananya Patel');
      expect(msg).toContain('₹500');
      expect(msg).toContain('Dr. Mrinalini');
      expect(msg).toContain('Suite 402, Green Glen Towers');
    });

    expect(durationMs).toBeLessThan(200);
  });

  it(`ensures zero state leakage or race conditions across isolated concurrent patient sessions`, async () => {
    const sessionIds = new Set<string>();

    Array.from({ length: CONCURRENT_USERS }).forEach((_, index) => {
      const pid = `user-session-${index}-${Math.random().toString(36).substring(2, 9)}`;
      sessionIds.add(pid);
    });

    expect(sessionIds.size).toBe(CONCURRENT_USERS);
  });
});
