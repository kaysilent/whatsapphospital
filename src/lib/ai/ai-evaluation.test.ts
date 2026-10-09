import { describe, it, expect } from 'vitest';
import { generateAIChatResponse, removeEmojisAndSmileys, formatProperName, cleanAIOutputReplies, sanitizeConversationHistory, isOutOfScopeQuery } from './generate-reply';
import { DEFAULT_DOCTORS, getRuntimeHospitalConfig } from '../doctor/availability';
import { getRuntimeHospitalProfile, getRuntimeTreatments } from '../hospital/treatments';

describe('WhatsApp Hospital AI Response Engine & Quality Evaluation', () => {
  it('detects and strictly blocks out-of-scope math, coding, trivia, and jokes', () => {
    // Math expressions
    expect(isOutOfScopeQuery('1+1')).toBe(true);
    expect(isOutOfScopeQuery('2+2')).toBe(true);
    expect(isOutOfScopeQuery('1 + 1')).toBe(true);
    expect(isOutOfScopeQuery('what is 2 + 2')).toBe(true);
    expect(isOutOfScopeQuery('what is 1+1')).toBe(true);
    expect(isOutOfScopeQuery('calculate 10*5')).toBe(true);
    expect(isOutOfScopeQuery('2 plus 2')).toBe(true);
    expect(isOutOfScopeQuery('100 / 4')).toBe(true);

    // Coding & programming
    expect(isOutOfScopeQuery('write python code')).toBe(true);
    expect(isOutOfScopeQuery('create a javascript function to sort an array')).toBe(true);

    // Trivia & general out-of-scope queries
    expect(isOutOfScopeQuery('tell me a joke')).toBe(true);
    expect(isOutOfScopeQuery('who is the prime minister of india')).toBe(true);
    expect(isOutOfScopeQuery('what is the capital of france')).toBe(true);
    expect(isOutOfScopeQuery('what is the weather in Delhi')).toBe(true);

    // Valid clinic & intake queries must NOT be blocked
    expect(isOutOfScopeQuery('Hi')).toBe(false);
    expect(isOutOfScopeQuery('Hello, I want to book an appointment')).toBe(false);
    expect(isOutOfScopeQuery('What is the price of laser hair removal?')).toBe(false);
    expect(isOutOfScopeQuery('Dr. Mrinalini timings on Sunday')).toBe(false);
    expect(isOutOfScopeQuery('4')).toBe(false); // Slot selection
    expect(isOutOfScopeQuery('Arbaz Khan')).toBe(false); // Patient name
    expect(isOutOfScopeQuery('9876543210')).toBe(false); // Phone number
    expect(isOutOfScopeQuery('sarah@example.com')).toBe(false); // Email
  });

  it('strictly redirects math calculation queries to clinic services', async () => {
    const res1 = await generateAIChatResponse({
      message: '1+1',
      conversationHistory: []
    });
    expect(res1.reply).toContain('La Fleur Aesthetic');
    expect(res1.reply).toContain('Dr. Mrinalini');
    expect(res1.reply).not.toContain('2');
    expect(res1.isAppointmentCard).toBe(false);

    const res2 = await generateAIChatResponse({
      message: 'what is 2+2',
      conversationHistory: []
    });
    expect(res2.reply).toContain('La Fleur Aesthetic');
    expect(res2.reply).toContain('Dr. Mrinalini');
    expect(res2.reply).not.toContain('4');
    expect(res2.isAppointmentCard).toBe(false);
  });

  it('formats proper patient names and deduplicates concatenated inputs', () => {
    expect(formatProperName('arbaz')).toBe('Arbaz');
    expect(formatProperName('Arbazarbaz')).toBe('Arbaz');
    expect(formatProperName('arbaz khan')).toBe('Arbaz Khan');
    expect(formatProperName('arbaz khanarbaz khan')).toBe('Arbaz Khan');
    expect(formatProperName('Arbaz Arbaz')).toBe('Arbaz');
    expect(formatProperName('eses')).toBe('Es');
    expect(formatProperName('DR MRINALINI')).toBe('Dr Mrinalini');
    expect(formatProperName('for Sarah')).toBe('Sarah');
    expect(formatProperName('my name is Rohit Verma')).toBe('Rohit Verma');
  });

  it('sanitizes conversation history and strips trailing duplicate user messages', () => {
    const history = [
      { role: 'user', content: 'Hi' },
      { role: 'ai', content: 'Hello!' },
      { role: 'user', content: 'arbaz' }
    ];
    const cleaned = sanitizeConversationHistory(history, 'arbaz');
    expect(cleaned).toHaveLength(2);
    expect(cleaned[cleaned.length - 1].content).toBe('Hello!');
  });

  it('cleans and rewrites hallucinated duplication complaints from model output', () => {
    const rawHallucination1 = 'Thank you for providing "arbazarbaz". For our records, we require your full name, typically with a first and last name, rather than a duplicated format.\n\nPlease provide your Full Name (e.g., Arbaz Khan) so I can complete your booking for GFC Hair Restoration on Tuesday, 29 September 2026, at 02:30 PM.';
    const cleaned1 = cleanAIOutputReplies(rawHallucination1, 'arbaz');
    expect(cleaned1).toContain('Thank you, Arbaz!');
    expect(cleaned1).not.toContain('arbazarbaz');
    expect(cleaned1).not.toContain('rather than a duplicated format');

    const rawHallucination2 = 'Thank you for providing "arbaz khanarbaz khan". To ensure accuracy for your booking, please provide your Full Name in the standard format (e.g., Arbaz Khan), without duplication.';
    const cleaned2 = cleanAIOutputReplies(rawHallucination2, 'arbaz khan');
    expect(cleaned2).toContain('Thank you, Arbaz Khan!');
    expect(cleaned2).not.toContain('arbaz khanarbaz khan');
    expect(cleaned2).not.toContain('without duplication');
  });

  it('runs complete 5-turn multi-step clinical intake protocol', async () => {
    // Turn 1: Greeting
    const turn1 = await generateAIChatResponse({
      message: 'Hi',
      conversationHistory: []
    });
    expect(turn1.reply).toContain('La Fleur');
    expect(turn1.reply).toContain('Dr. Mrinalini');
    expect(turn1.isAppointmentCard).toBe(false);

    // Turn 2: Treatment Inquiry
    const turn2 = await generateAIChatResponse({
      message: 'I want laser hair removal',
      conversationHistory: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: turn1.reply }
      ]
    });
    expect(turn2.reply).toContain('Laser Hair Reduction');
    expect(turn2.reply).toContain('10:30 AM');
    expect(turn2.reply).toContain('04:00 PM');
    expect(turn2.isAppointmentCard).toBe(false);

    // Turn 3: Slot 4 selected
    const turn3 = await generateAIChatResponse({
      message: '4',
      conversationHistory: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: turn1.reply },
        { role: 'user', content: 'I want laser hair removal' },
        { role: 'assistant', content: turn2.reply }
      ]
    });
    expect(turn3.reply).toContain('04:00 PM');
    expect(turn3.reply).toContain('Full Name');
    expect(turn3.isAppointmentCard).toBe(false);

    // Turn 4: Patient provides Name only ('arbaz')
    const turn4 = await generateAIChatResponse({
      message: 'arbaz',
      conversationHistory: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: turn1.reply },
        { role: 'user', content: 'I want laser hair removal' },
        { role: 'assistant', content: turn2.reply },
        { role: 'user', content: '4' },
        { role: 'assistant', content: turn3.reply }
      ]
    });
    // Verified: Immediate confirmation on Name without asking for Phone or Email (already on WhatsApp)
    expect(turn4.reply).toContain('Arbaz');
    expect(turn4.reply).not.toContain('Arbazarbaz');
    expect(turn4.isAppointmentCard).toBe(true);
    expect(turn4.appointmentData?.patient_name).toBe('Arbaz');
    expect(turn4.appointmentData?.time).toBe('04:00 PM');
    expect(turn4.appointmentData?.department).toBe('Laser Hair Reduction');
    expect(turn4.reply).toContain('Appointment Confirmed');
    expect(turn4.reply).toContain('500');
    expect(turn4.reply).toContain('Pay Online');
    expect(turn4.reply).toContain('Road No.11 B, Jubilee hills');
  });

  it('dynamically adapts to custom fee, custom address, and custom maps URL from dashboard hospitalProfile', async () => {
    const customProfile = {
      name: 'La Fleur Aesthetic Clinic & Spa',
      leadDoctor: 'Dr. Mrinalini',
      consultationFee: 100,
      currency: '₹',
      address: '7th Cross, Indiranagar, 100 Feet Road',
      city: 'Bangalore',
      postalCode: '560038',
      mapsUrl: 'https://maps.google.com/?q=La+Fleur+Indiranagar+Bangalore'
    };

    const response = await generateAIChatResponse({
      message: 'Book appointment for Arbaz Khan tomorrow at 04:00 PM for Laser Hair Reduction, phone 814866324, email arbaz@gmail.com',
      hospitalProfile: customProfile
    });

    expect(response.isAppointmentCard).toBe(true);
    expect(response.appointmentData?.patient_name).toBe('Arbaz Khan');
    expect(response.reply).toContain('₹100');
    expect(response.reply).not.toContain('₹500');
    expect(response.reply).toContain('7th Cross, Indiranagar');
    expect(response.reply).toContain('https://maps.google.com/?q=La+Fleur+Indiranagar+Bangalore');
  });

  it('handles individual phone number then email input steps smoothly', async () => {
    // Patient has selected slot 3 (02:30 PM) and provided name "Arbaz Khan"
    const history = [
      { role: 'user', content: 'I want a consultation' },
      { role: 'assistant', content: 'Available slots: 1. 10:30 AM, 2. 11:30 AM, 3. 02:30 PM, 4. 04:00 PM, 5. 05:30 PM' },
      { role: 'user', content: '3' },
      { role: 'assistant', content: 'Great! I have reserved 02:30 PM. Please provide your Full Name, Phone Number, and Email.' },
      { role: 'user', content: 'Arbaz Khan' },
      { role: 'assistant', content: 'Thank you, Arbaz Khan! Please provide your WhatsApp Contact Phone Number and Email Address.' }
    ];

    // User provides 9-digit phone number: "814866324"
    const phoneTurn = await generateAIChatResponse({
      message: '814866324',
      conversationHistory: history
    });

    expect(phoneTurn.isAppointmentCard).toBe(false);
    expect(phoneTurn.reply).toContain('814866324');
    expect(phoneTurn.reply).toContain('Email Address');
    expect(phoneTurn.reply).not.toContain('providing your email address');

    // Next turn: User provides Email
    const emailTurn = await generateAIChatResponse({
      message: 'arbaz@gmail.com',
      conversationHistory: [
        ...history,
        { role: 'user', content: '814866324' },
        { role: 'assistant', content: phoneTurn.reply }
      ]
    });

    expect(emailTurn.isAppointmentCard).toBe(true);
    expect(emailTurn.appointmentData?.patient_name).toBe('Arbaz Khan');
    expect(emailTurn.appointmentData?.phone_number).toBe('814866324');
    expect(emailTurn.reply).toContain('Appointment Confirmed');
    expect(emailTurn.reply).toContain('arbaz@gmail.com');
  });

  const testCases = [
    {
      name: 'Greeting & Clinic Details',
      input: 'Hello, can you tell me about the clinic and who the doctor is?',
      history: [],
      check: (res: any) => {
        expect(res.reply).toContain('Dr. Mrinalini');
        expect(res.reply).not.toContain('Dr. Sarah');
        expect(res.reply).not.toContain('Dr. John');
      }
    },
    {
      name: 'Hospital Operating Hours & Timings',
      input: 'What are your clinic timings and working hours?',
      history: [],
      check: (res: any) => {
        expect(res.reply).toMatch(/10:00\s*AM/i);
        expect(res.reply).toMatch(/07:00\s*PM|7:00\s*PM/i);
      }
    },
    {
      name: 'Sunday Timings Query',
      input: 'Are you open on Sunday and what time?',
      history: [],
      check: (res: any) => {
        expect(res.reply.toLowerCase()).toContain('sunday');
        expect(res.reply).toMatch(/closed|10:00|11:00/i);
        expect(res.reply).toContain('Dr. Mrinalini');
      }
    },
    {
      name: 'Hair Loss & PRP Treatment Query',
      input: 'I am experiencing severe hair loss. What treatments do you offer and what is the cost?',
      history: [],
      check: (res: any) => {
        expect(res.reply.toLowerCase()).toMatch(/prp|gfc|hair|scalp/);
        expect(res.reply).toMatch(/Dr\. Mrinalini/);
      }
    },
    {
      name: 'HydraFacial & Skin Care Query',
      input: 'I want to know about HydraFacial for glowing skin. How many sessions and price?',
      history: [],
      check: (res: any) => {
        expect(res.reply.toLowerCase()).toMatch(/hydrafacial|skin|glow/);
      }
    },
    {
      name: 'Laser Hair Reduction Query',
      input: 'Do you provide laser hair removal? How many sessions are required?',
      history: [],
      check: (res: any) => {
        expect(res.reply.toLowerCase()).toMatch(/laser|hair|session/);
      }
    },
    {
      name: 'Emergency / Urgent Severe Condition Query',
      input: 'My face is swelling up and I have severe breathing difficulty after an allergic reaction!',
      history: [],
      check: (res: any) => {
        expect(res.reply.toLowerCase()).toMatch(/emergency|urgent|immediate/);
      }
    },
    {
      name: 'Current Real-Time Date Query',
      input: 'What is the current date today and what are your available slots?',
      history: [],
      check: (res: any) => {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        expect(res.reply).toContain(todayStr);
        expect(res.reply).toContain('schedule an appointment');
      }
    },
    {
      name: 'Multi-Turn Appointment Booking for Tomorrow with Full Details',
      input: 'Please confirm for Sarah, phone 9876543210, email sarah@example.com',
      history: [
        { role: 'user', content: 'Hi, I need to see Dr. Mrinalini for acne treatment' },
        { role: 'assistant', content: 'We offer specialized Acne & Clarifying Treatment. Available slots for tomorrow:\n1. 10:30 AM\n2. 11:30 AM\n3. 02:30 PM\n4. 04:00 PM\n5. 05:30 PM' },
        { role: 'user', content: '2' },
        { role: 'assistant', content: 'Great! I have reserved the 11:30 AM slot. Please provide your Full Name, Phone, and Email.' }
      ],
      check: (res: any) => {
        const tomorrowDate = new Date(Date.now() + 86400000);
        const tomorrowStr = tomorrowDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        expect(res.isAppointmentCard).toBe(true);
        expect(res.appointmentData).toBeDefined();
        expect(res.appointmentData.patient_name).toBe('Sarah');
        expect(res.appointmentData.time).toMatch(/11:30/);
        expect(res.appointmentData.date).toBe(tomorrowStr);
        expect(res.reply).toContain('500');
        expect(res.reply).toContain('Pay Online');
        expect(res.reply).toContain('Road No.11 B, Jubilee hills');
      }
    },
    {
      name: 'Appointment Booking for Today with Phone and Email',
      input: 'Please book for today at 02:00 PM for Rohit, phone +91 9876543210, email rohit@test.com',
      history: [
        { role: 'user', content: 'Hi, I want Laser Hair Reduction' },
        { role: 'assistant', content: 'We offer Laser Hair Reduction courses with Dr. Mrinalini. Would you like to book a slot?' }
      ],
      check: (res: any) => {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        expect(res.isAppointmentCard).toBe(true);
        expect(res.appointmentData).toBeDefined();
        expect(res.appointmentData.patient_name).toBe('Rohit');
        expect(res.appointmentData.date).toBe(todayStr);
        expect(res.appointmentData.doctor).toContain('Dr. Mrinalini');
        expect(res.reply).toContain('Laser Hair Reduction');
      }
    }
  ];

  testCases.forEach((tc) => {
    it(`evaluates: ${tc.name}`, async () => {
      const startTime = performance.now();
      const response = await generateAIChatResponse({
        message: tc.input,
        conversationHistory: tc.history
      });
      const durationMs = performance.now() - startTime;

      // 1. Latency requirement: sub-second for deterministic / fallback engine
      console.log(`[AI Latency Test] ${tc.name}: ${durationMs.toFixed(2)} ms`);
      expect(durationMs).toBeLessThan(3000);

      // 2. Strict Clinical Quality: No Emojis & No Smileys
      const stripped = removeEmojisAndSmileys(response.reply);
      expect(response.reply).toBe(stripped);

      // 3. Custom assertion per test case
      tc.check(response);
    });
  });

  it('verifies strict Dr. Mrinalini exclusivity', () => {
    const doctors = DEFAULT_DOCTORS;
    expect(doctors.length).toBe(1);
    expect(doctors[0].doctorName).toBe('Dr. Mrinalini');
  });

  it('verifies default hospital profile & treatments', () => {
    const profile = getRuntimeHospitalProfile();
    const treatments = getRuntimeTreatments();

    expect(profile.leadDoctor).toBe('Dr. Mrinalini');
    expect(profile.name).toContain('La Fleur');
    expect(treatments.length).toBeGreaterThan(0);
  });
});
