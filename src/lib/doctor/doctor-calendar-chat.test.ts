import { describe, it, expect } from 'vitest';
import { generateAIChatResponse } from '@/lib/ai/generate-reply';
import { setGlobalServerHospitalConfig, setGlobalServerDoctors } from './availability';

describe('Doctor Calendar & Working Hours AI Integration', () => {
  it('rejects requested booking time during lunch break (01:00 PM - 02:00 PM)', async () => {
    setGlobalServerHospitalConfig({
      status: 'online',
      openingTime: '10:00 AM',
      closingTime: '07:00 PM',
      lunchStartTime: '01:00 PM',
      lunchEndTime: '02:00 PM'
    });

    const res = await generateAIChatResponse({
      message: 'Hi, I would like to book an appointment with Dr. Mrinalini today at 1:30 PM for consultation',
      conversationHistory: []
    });

    expect(res.reply).toContain('lunch');
    expect(res.reply).toContain('01:00 PM');
    expect(res.reply).toContain('02:00 PM');
    expect(res.appointmentData).toBeFalsy();
  });

  it('rejects requested booking time outside working hours (e.g. 08:30 PM)', async () => {
    setGlobalServerHospitalConfig({
      status: 'online',
      openingTime: '10:00 AM',
      closingTime: '07:00 PM',
      lunchStartTime: '01:00 PM',
      lunchEndTime: '02:00 PM'
    });

    const res = await generateAIChatResponse({
      message: 'Can I book an appointment with doctor today at 8:30 PM?',
      conversationHistory: []
    });

    expect(res.reply).toContain('outside our regular');
    expect(res.reply).toContain('10:00 AM');
    expect(res.reply).toContain('07:00 PM');
    expect(res.appointmentData).toBeFalsy();
  });

  it('informs patient when doctor is away on vacation/holiday with date range', async () => {
    setGlobalServerHospitalConfig({
      status: 'holiday',
      holidayStartDate: '2026-10-10',
      holidayEndDate: '2026-10-15',
      holidayReason: 'Annual Leave / Vacation'
    });

    const res = await generateAIChatResponse({
      message: 'I want to book an appointment for tomorrow',
      conversationHistory: []
    });

    expect(res.reply).toContain('holiday');
    expect(res.reply).toContain('Oct 10, 2026');
    expect(res.reply).toContain('Oct 15, 2026');
    expect(res.appointmentData).toBeFalsy();
  });

  it('informs patient when doctor is offline on break with return time', async () => {
    setGlobalServerHospitalConfig({
      status: 'offline',
      offlineReturnTime: '03:30 PM',
      offlineReason: 'Clinical OT Procedure'
    });

    const res = await generateAIChatResponse({
      message: 'Is Dr. Mrinalini available now for consultation?',
      conversationHistory: []
    });

    expect(res.reply).toContain('03:30 PM');
    expect(res.reply).toContain('Clinical OT Procedure');
    expect(res.appointmentData).toBeFalsy();
  });

  it('resets to normal available status when online', async () => {
    setGlobalServerHospitalConfig({
      status: 'online',
      holidayStartDate: '',
      holidayEndDate: '',
      openingTime: '10:00 AM',
      closingTime: '07:00 PM',
      lunchStartTime: '01:00 PM',
      lunchEndTime: '02:00 PM'
    });
    setGlobalServerDoctors([{
      id: 'doc-mrinalini',
      doctorId: 'doc-mrinalini',
      doctorName: 'Dr. Mrinalini',
      title: 'Chief Dermatologist & Aesthetic Physician',
      department: 'Dermatology, Trichology & Aesthetic Medicine',
      status: 'available',
      updatedAt: new Date().toISOString()
    }]);

    const res = await generateAIChatResponse({
      message: 'What are your clinic consultation timings?',
      conversationHistory: []
    });

    expect(res.reply).toContain('10:00 AM');
    expect(res.reply).toContain('07:00 PM');
  });
});
