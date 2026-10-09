import { describe, it, expect } from 'vitest';
import { generateAIChatResponse, cleanAIOutputReplies } from './generate-reply';

describe('Hospital Fee Dynamic Synchronization', () => {
  it('uses updated consultation fee in AI chat response for fee query', async () => {
    const res = await generateAIChatResponse({
      message: 'What is the consultation fee?',
      hospitalProfile: {
        consultationFee: 100,
      }
    });
    console.log('AI Reply output:\n', res.reply);
    expect(res.reply).toContain('100');
    expect(res.reply).not.toMatch(/₹\s*500\b|500\s*(?:fee|booking|rupees)/i);
  });

  it('handles various fee queries correctly', async () => {
    const queries = [
      'What is the fee?',
      'what is the fee',
      'What is the doctor fee?',
      'How much is the fee?',
      'What are the consultation charges?',
      'fee?',
      'fees',
      'consultancy fee',
      'consultancy price',
      'what is the consultancy price',
      'how much is consultation'
    ];
    for (const q of queries) {
      const res = await generateAIChatResponse({
        message: q,
        hospitalProfile: {
          consultationFee: 100,
        }
      });
      expect(res.reply).toContain('100');
      expect(res.reply).not.toMatch(/₹\s*500\b|500\s*(?:fee|booking|rupees)/i);
    }
  });
  it('formats appointment confirmation with direct in-chat payment link and 100 fee', async () => {
    const res = await generateAIChatResponse({
      message: 'Book appointment for Arbaz Khan tomorrow at 11:30 AM for Clinical Consultation, phone +91 81478 66324, email arbaz59468@gmail.com',
      hospitalProfile: {
        consultationFee: 100,
      }
    });
    console.log('Booking Reply:\n', res.reply);
    expect(res.isAppointmentCard).toBe(true);
    expect(res.reply).toContain('100');
    expect(res.reply).not.toMatch(/₹\s*500\b|500\s*(?:fee|booking|rupees)/i);
    expect(res.reply).toContain('/pay/');
    expect(res.reply).toContain('Pay Online');
    expect(res.reply).not.toContain('sent to your email');
  });

  it('cleans up hallucinated sent-to-email text into in-chat payment link', () => {
    const hallucinatedText = `Here is your complete appointment summary:\n\nAppointment Details:\n• Patient Name: Arbaz Khan\n• Contact Number: +91 81478 66324\n• Email Address: arbaz59468@gmail.com\n• Consulting Specialist: Dr. Mrinalini (MD, Senior Aesthetic Specialist & Chief Physician)\n• Treatment/Service: Clinical Consultation\n• Date: Wednesday, 7 October 2026\n• Time: 11:30 AM\n• Booking Fee: ₹500 (Payable via our online payment gateway to secure your slot)\n\nClinic Address & Location:\nSuite 402, Green Glen Towers, Outer Ring Road, Bangalore - 560103\nGoogle Maps Link: https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Bangalore\n\nNext Steps:\nAn invoice and secure payment link for the ₹500 booking fee have been generated and sent to your email (arbaz59468@gmail.com). Please complete the payment to finalize and confirm your slot on our calendar.\n\nOnce completed, your digital booking pass will be sent to this WhatsApp number. We look forward to seeing you tomorrow.`;

    const cleaned = cleanAIOutputReplies(hallucinatedText, '', { consultationFee: 100 });
    console.log('Cleaned Text:\n', cleaned);
    expect(cleaned).toContain('₹100');
    expect(cleaned).not.toMatch(/₹\s*500\b|500\s*(?:fee|booking|rupees)/i);
    expect(cleaned).toContain('/pay/');
    expect(cleaned).toContain('Pay Online');
    expect(cleaned).not.toContain('sent to your email');
  });

  it('uses senderPhone in payment link and appointmentData when patient does not type phone', async () => {
    const res = await generateAIChatResponse({
      message: 'Book appointment for Priya Verma tomorrow at 11:30 AM for Clinical Consultation',
      senderPhone: '+919123456789',
      senderName: 'Priya Verma',
      hospitalProfile: {
        consultationFee: 100,
      }
    });
    expect(res.isAppointmentCard).toBe(true);
    expect(res.appointmentData?.phone_number).toBe('+919123456789');
    expect(res.appointmentData?.patient_name).toBe('Priya Verma');
    expect(res.reply).toMatch(/phone=(?:%2B)?919123456789/);
    expect(res.reply).not.toContain('9876543210');
  });

  it('never emits dummy phone 9876543210 when no phone is available', async () => {
    const res = await generateAIChatResponse({
      message: 'Book appointment for Rahul tomorrow at 11:30 AM for Clinical Consultation',
      hospitalProfile: {
        consultationFee: 100,
      }
    });
    expect(res.isAppointmentCard).toBe(true);
    expect(res.appointmentData?.phone_number).not.toContain('9876543210');
    expect(res.reply).not.toContain('9876543210');
  });

  it('quotes 500 consultation fee on fee query, but generates payment link with 100 advance booking fee', async () => {
    // 1. Fee Inquiry -> replies with consultation fee 500
    const feeRes = await generateAIChatResponse({
      message: 'What is the consultation fee for doctor?',
      hospitalProfile: {
        consultationFee: 500,
        advanceTokenFee: 100,
      }
    });
    expect(feeRes.reply).toContain('500');
    expect(feeRes.reply).toContain('100');

    // 2. Booking confirmed -> payment link generated with amount=100 (advance booking fee)
    const bookRes = await generateAIChatResponse({
      message: 'Book appointment for Sameer tomorrow at 11:30 AM for Clinical Consultation, phone +91 81478 66324',
      hospitalProfile: {
        consultationFee: 500,
        advanceTokenFee: 100,
      }
    });
    expect(bookRes.isAppointmentCard).toBe(true);
    expect(bookRes.reply).toContain('500'); // Mentions consultation fee
    expect(bookRes.reply).toContain('100'); // Mentions advance booking fee
    expect(bookRes.reply).toContain('amount=100'); // Payment link is strictly for the booking fee!
  });

  it('correctly uses 10 advance booking fee and 500 consultation fee with 490 balance', async () => {
    // 1. Fee inquiry "how much"
    const howMuchRes = await generateAIChatResponse({
      message: 'how much',
      hospitalProfile: {
        consultationFee: 500,
        advanceTokenFee: 10,
        clinicBalanceFee: 490,
      }
    });
    expect(howMuchRes.reply).toContain('500');
    expect(howMuchRes.reply).toContain('10');
    expect(howMuchRes.reply).toContain('490');

    // 2. Fee query "checkk it once the fee is 10"
    const checkFeeRes = await generateAIChatResponse({
      message: 'checkk it once the fee is 10',
      hospitalProfile: {
        consultationFee: 500,
        advanceTokenFee: 10,
        clinicBalanceFee: 490,
      }
    });
    expect(checkFeeRes.reply).toContain('500');
    expect(checkFeeRes.reply).toContain('10');

    // 3. Booking confirmed -> payment link generated with amount=10
    const bookRes = await generateAIChatResponse({
      message: 'Book appointment for Sameer tomorrow at 11:30 AM for Clinical Consultation, phone +91 81478 66324',
      hospitalProfile: {
        consultationFee: 500,
        advanceTokenFee: 10,
        clinicBalanceFee: 490,
      }
    });
    expect(bookRes.isAppointmentCard).toBe(true);
    expect(bookRes.reply).toContain('500');
    expect(bookRes.reply).toContain('10');
    expect(bookRes.reply).toContain('amount=10');
  });
});

