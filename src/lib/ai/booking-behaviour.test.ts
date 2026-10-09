import { describe, expect, it } from 'vitest';

import {
  findMentionedTreatments,
  generateSmartClinicalFallback,
  looksLikeBookingConfirmation,
  parseRequestedBookingDate,
  toWhatsAppFormatting,
} from '@/lib/ai/generate-reply';
import { DEFAULT_TREATMENTS } from '@/lib/hospital/treatments';

// Thursday 2026-10-08 in clinic (IST) time.
const TODAY = '2026-10-08';
const TOMORROW = '2026-10-09';
const parse = (input: string) => parseRequestedBookingDate(input, TODAY, TOMORROW);

describe('parseRequestedBookingDate', () => {
  it('handles relative words and ISO dates', () => {
    expect(parse('today')).toBe(TODAY);
    expect(parse('tomorrow')).toBe(TOMORROW);
    expect(parse('2026-10-15')).toBe('2026-10-15');
  });

  it('reads numeric dates day-first, as written in India', () => {
    expect(parse('10/11/2026')).toBe('2026-11-10');
    expect(parse('25-12')).toBe('2026-12-25');
  });

  it('uses the explicit date even when a weekday is also given', () => {
    expect(parse('Monday, 19 October 2026')).toBe('2026-10-19');
    expect(parse('October 7, 2027')).toBe('2027-10-07');
  });

  it('rolls dates without a year that already passed to next year', () => {
    expect(parse('Oct 1')).toBe('2027-10-01');
    expect(parse('5 Jan')).toBe('2027-01-05');
  });

  it('resolves weekday names to the next occurrence', () => {
    expect(parse('Saturday')).toBe('2026-10-10');
    expect(parse('Thursday')).toBe('2026-10-15');
  });

  it('does not mistake ordinary words for months or weekdays', () => {
    expect(parse('next month 5th')).toBe('2026-11-05');
    expect(parse('may I come on the 20th')).toBe('2026-10-20');
    expect(parse('Saturday at 10.30 am')).toBe('2026-10-10');
  });

  it('falls back to tomorrow for unparseable input', () => {
    expect(parse('YYYY-MM-DD')).toBe(TOMORROW);
    expect(parse('')).toBe(TOMORROW);
  });
});

describe('looksLikeBookingConfirmation', () => {
  it('accepts a real confirmation summary', () => {
    const summary = 'Appointment Confirmed!\n• Patient Name: Arbaz Khan\n• Date: 2026-10-10\n• Time: 11:30 AM';
    expect(looksLikeBookingConfirmation(summary)).toBe(true);
    expect(looksLikeBookingConfirmation(summary.replace(/(Patient Name|Date|Time):/g, '*$1:*'))).toBe(true);
  });

  it('rejects treatment answers and requests for details', () => {
    expect(looksLikeBookingConfirmation('For acne scars we recommend MNRF. Would you like the consultation details?')).toBe(false);
    expect(looksLikeBookingConfirmation('Please share your booking details and preferred time.')).toBe(false);
    expect(looksLikeBookingConfirmation('Appointment confirmed once you share your name.')).toBe(false);
  });
});

describe('toWhatsAppFormatting', () => {
  it('converts Markdown into WhatsApp formatting', () => {
    expect(toWhatsAppFormatting('## Treatment Plan')).toBe('*Treatment Plan*');
    expect(toWhatsAppFormatting('**Date:** Monday')).toBe('*Date:* Monday');
    expect(toWhatsAppFormatting('- one\n* two')).toBe('• one\n• two');
    expect(toWhatsAppFormatting('[Map](https://maps.google.com/x)')).toBe('Map: https://maps.google.com/x');
  });

  it('leaves WhatsApp formatting untouched', () => {
    const text = '*Booking Summary*\n• Date: 2026-10-10';
    expect(toWhatsAppFormatting(text)).toBe(text);
  });
});

describe('findMentionedTreatments', () => {
  it('finds every treatment a comparison question mentions', () => {
    const names = findMentionedTreatments('which is better, hydrafacial or chemical peel?', DEFAULT_TREATMENTS).map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['HydraFacial Deluxe', 'Pigmentation & Chemical Peels']));
  });

  it('does not match keywords inside other words', () => {
    expect(findMentionedTreatments('i slipped and hurt my lip', DEFAULT_TREATMENTS).map(t => t.name)).toEqual(['Dermal Fillers & Lip Enhancement']);
    expect(findMentionedTreatments('hello there', DEFAULT_TREATMENTS)).toEqual([]);
  });
});

describe('fallback receptionist: answer first, offer booking at the end', () => {
  const adviceQuestions = [
    'What treatment do you suggest for acne scars?',
    'I have hair fall, what can I do?',
    'Which is better, hydrafacial or chemical peel?',
    'Is laser hair removal painful?',
  ];

  for (const question of adviceQuestions) {
    it(`answers "${question}" without starting a booking`, () => {
      const res = generateSmartClinicalFallback(question, [], undefined, '919812300000', 'Kay');
      expect(res.appointmentObj).toBeNull();
      expect(res.reply).not.toMatch(/delighted to schedule|which slot|full name|reserved/i);
      expect(res.reply).toMatch(/Typical plan/);
      expect(res.reply.trim()).toMatch(/Would you like me to book a consultation with .+\?$/);
    });
  }

  it('still offers slots when the patient states what they want', () => {
    const res = generateSmartClinicalFallback('I want laser hair removal', []);
    expect(res.reply).toContain('10:30 AM');
  });

  it('does not book just because a time is mentioned and the WhatsApp name is known', () => {
    const res = generateSmartClinicalFallback('Is the clinic open at 4:00 pm?', [], undefined, '919812300000', 'Kay');
    expect(res.appointmentObj).toBeNull();
  });

  it('does not claim a slot is reserved before the booking is confirmed', () => {
    const history = [
      { role: 'user', content: 'I want laser hair removal' },
      { role: 'ai', content: 'Available slots: 1. 10:30 AM 2. 11:30 AM. Which slot works best for you?' },
    ];
    const res = generateSmartClinicalFallback('2', history);
    expect(res.reply).toMatch(/Full Name/);
    expect(res.reply).not.toMatch(/reserved/i);
    expect(res.appointmentObj).toBeNull();
  });
});
