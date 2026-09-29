import { describe, it, expect } from 'vitest';
import { 
  TREATMENT_PROTOCOLS, 
  getTreatmentProtocol, 
  Appointment, 
  FollowUpTask 
} from '@/hooks/use-demo-state';
import { 
  generateSmartClinicalFallback, 
  AIResponseResult 
} from '@/lib/ai/generate-reply';
import { 
  detectEmergencyKeywords, 
  formatDoctorEmergencyAlert, 
  formatPatientEmergencyAutoReply, 
  formatDoctorRelayedMessageToPatient,
  formatDoctorDeliveryConfirmation
} from '@/lib/whatsapp/emergency-relay';
import { emergencyAudio } from '@/lib/audio/emergency-audio';

describe('Comprehensive WhatsApp Hospital CRM Test Suite', () => {

  describe('1. Treatment Protocol & Sitting Interval Mappings', () => {
    it('correctly maps Laser Hair Reduction protocol', () => {
      const protocol = getTreatmentProtocol('Laser Hair Reduction (Full Face & Body)');
      expect(protocol.name).toBe('Laser Hair Reduction');
      expect(protocol.totalSittings).toBe(6);
      expect(protocol.sittingInterval).toBe('4-6 weeks');
      expect(protocol.sittingIntervalDays).toBe(28);
      expect(protocol.defaultDoctor).toBe('Dr. Mrinalini');
    });

    it('correctly maps PRP Hair Therapy protocol', () => {
      const protocol = getTreatmentProtocol('PRP Scalp Injection Session');
      expect(protocol.name).toBe('PRP Hair Therapy');
      expect(protocol.totalSittings).toBe(4);
      expect(protocol.sittingInterval).toBe('3-4 weeks');
      expect(protocol.sittingIntervalDays).toBe(21);
    });

    it('correctly maps Pigmentation & Chemical Peels protocol', () => {
      const protocol = getTreatmentProtocol('Chemical Brightening Peel');
      expect(protocol.name).toBe('Pigmentation & Chemical Peels');
      expect(protocol.totalSittings).toBe(4);
      expect(protocol.sittingInterval).toBe('2-3 weeks');
      expect(protocol.sittingIntervalDays).toBe(14);
    });

    it('correctly maps HydraFacial Deluxe protocol', () => {
      const protocol = getTreatmentProtocol('HydraFacial Deluxe');
      expect(protocol.name).toBe('HydraFacial Deluxe');
      expect(protocol.totalSittings).toBe(3);
      expect(protocol.sittingIntervalDays).toBe(28);
    });

    it('correctly maps Anti-Aging & Botox protocol', () => {
      const protocol = getTreatmentProtocol('Botox & Anti-Aging');
      expect(protocol.name).toBe('Anti-Aging & Botox');
      expect(protocol.totalSittings).toBe(1);
      expect(protocol.sittingIntervalDays).toBe(14);
    });

    it('correctly maps Skin Tightening (RF / MNRF) protocol', () => {
      const protocol = getTreatmentProtocol('Microneedling RF Skin Tightening');
      expect(protocol.name).toBe('Skin Tightening (RF / MNRF)');
      expect(protocol.totalSittings).toBe(4);
      expect(protocol.sittingIntervalDays).toBe(21);
    });
  });

  describe('2. Multi-Sitting Next Appointment Scheduling & Follow-Up Automation', () => {
    it('calculates the next appointment date across month boundaries', () => {
      const baseDate = new Date('2026-10-15T00:00:00Z');
      const intervalDays = 28; // 4 weeks -> Nov 12
      const nextDate = new Date(baseDate.getTime() + intervalDays * 86400000);
      expect(nextDate.toISOString().split('T')[0]).toBe('2026-11-12');
    });

    it('calculates next sitting date for 2-week chemical peel interval', () => {
      const baseDate = new Date('2026-10-01T00:00:00Z');
      const intervalDays = 14;
      const nextDate = new Date(baseDate.getTime() + intervalDays * 86400000);
      expect(nextDate.toISOString().split('T')[0]).toBe('2026-10-15');
    });

    it('generates immediate post-care and next sitting reminder tasks on completion', () => {
      const appointment: Appointment = {
        id: 'apt-101',
        patient_name: 'Priya Verma',
        phone_number: '+91 98765 43210',
        date: '2026-10-01',
        time: '11:30 AM',
        department: 'Laser Hair Reduction',
        current_sitting: 2,
        total_sittings: 6,
        sitting_interval: '4-6 weeks',
        sitting_interval_days: 28,
        status: 'Booked'
      };

      const protocol = getTreatmentProtocol(appointment.department);

      // Task 1: Post care
      const postCareTask: FollowUpTask = {
        id: 'task-post',
        appointment_id: appointment.id,
        patient_name: appointment.patient_name,
        phone_number: appointment.phone_number,
        department: appointment.department,
        sitting_info: `Sitting ${appointment.current_sitting} of ${appointment.total_sittings}`,
        reason: protocol.postCareGoal,
        type: 'post_care',
        due: `In ${protocol.postCareFollowUpDays} days`,
        due_date: '2026-10-03',
        priority: 'High',
        status: 'Pending',
        created_by: 'AI Agent'
      };

      // Task 2: Next sitting reminder
      const nextSittingTask: FollowUpTask = {
        id: 'task-next',
        appointment_id: appointment.id,
        patient_name: appointment.patient_name,
        phone_number: appointment.phone_number,
        department: appointment.department,
        sitting_info: `Sitting ${(appointment.current_sitting || 1) + 1} of ${appointment.total_sittings}`,
        reason: protocol.nextSittingGoal,
        type: 'next_sitting_reminder',
        due: `In ${protocol.sittingIntervalDays} days (${protocol.sittingInterval})`,
        due_date: '2026-10-29',
        priority: 'Medium',
        status: 'Pending',
        created_by: 'AI Agent'
      };

      expect(postCareTask.reason).toContain('Post-laser soothing gel');
      expect(nextSittingTask.sitting_info).toBe('Sitting 3 of 6');
      expect(nextSittingTask.due_date).toBe('2026-10-29');
    });
  });

  describe('3. Clinical Emergency Detection & Bidirectional WhatsApp Relay', () => {
    it('detects diverse acute emergency keywords in patient messages', () => {
      const emergencySamples = [
        "URGENT: I am having severe rash and burning sensation on my face after today's peel!",
        "Help, sudden chest pain and breathing difficulty",
        "Pus oozing and heavy bleeding from treatment site",
        "My face is swelling rapidly and it is burning",
        "Severe allergic reaction blisters everywhere"
      ];

      for (const msg of emergencySamples) {
        expect(detectEmergencyKeywords(msg).isEmergency).toBe(true);
      }

      const nonEmergencySamples = [
        "Hi, can you tell me what time Dr. Ananya is available tomorrow?",
        "How much does hydrafacial cost?",
        "I would like to reschedule my appointment to Friday"
      ];

      for (const msg of nonEmergencySamples) {
        expect(detectEmergencyKeywords(msg).isEmergency).toBe(false);
      }
    });

    it('formats clinical emergency alert sent to doctor WhatsApp', () => {
      const alert = formatDoctorEmergencyAlert({
        patientName: 'Vikram Malhotra',
        patientPhone: '+91 98991 22334',
        messageText: 'Severe skin burning and redness post chemical peel',
        reason: 'Urgent Symptom Alert: burning sensation'
      });

      expect(alert).toContain('EMERGENCY ALERT');
      expect(alert).toContain('Vikram Malhotra');
      expect(alert).toContain('+91 98991 22334');
      expect(alert).toContain('TO REPLY TO PATIENT DIRECTLY:');
    });

    it('formats immediate reassurance auto-reply sent to patient', () => {
      const autoReply = formatPatientEmergencyAutoReply('Dr. Rajesh Gupta');
      expect(autoReply).toContain('Emergency Alert Dispatched to Doctor');
      expect(autoReply).toContain('Dr. Rajesh Gupta');
      expect(autoReply).toContain('112');
    });

    it('formats doctor WhatsApp reply relayed to patient with clinic credentials', () => {
      const doctorReply = "Apply the cold compress for 10 mins and use the barrier repair balm. I will call you shortly.";
      const relayed = formatDoctorRelayedMessageToPatient('Dr. Rajesh Gupta', doctorReply);

      expect(relayed).toContain('Dr. Rajesh Gupta');
      expect(relayed).toContain('Apply the cold compress');
    });

    it('handles #reply prefix from doctor seamlessly', () => {
      const doctorReplyWithPrefix = "#reply Please wash with cool water and avoid touching the rash. Calling you in 2 mins.";
      const relayed = formatDoctorRelayedMessageToPatient('Dr. Shalini Roy', doctorReplyWithPrefix);

      expect(relayed).not.toContain('#reply');
      expect(relayed).toContain('Please wash with cool water');
      expect(relayed).toContain('Dr. Shalini Roy');
    });

    it('formats confirmation sent back to doctor upon successful patient delivery', () => {
      const confirmation = formatDoctorDeliveryConfirmation('Vikram Malhotra', '+91 98991 22334');
      expect(confirmation).toContain('Delivered to Patient');
      expect(confirmation).toContain('Vikram Malhotra');
    });
  });

  describe('4. Pricing: 4-Question Qualification Gate & Approximate Ranges', () => {
    it('gates pricing on early turns (Turns 1-3) and asks engaging leading questions', () => {
      // Turn 1: Patient immediately asks for price
      const resultTurn1 = generateSmartClinicalFallback('What is the price of Laser Hair Reduction?', []);

      expect(resultTurn1.reply).toContain('treatment protocols and sitting requirements are customized');
      expect(resultTurn1.reply).toContain('To help provide an accurate estimate');
      expect(resultTurn1.reply).toContain('which target area you\'d like to treat');
      // Must NOT dump raw prices on turn 1
      expect(resultTurn1.reply).not.toContain('₹14,999 – ₹22,500');
    });

    it('gates pricing on Turn 2 when patient asks cost in follow-up', () => {
      const conversationHistory = [
        { role: 'user', content: 'Hi, I am interested in PRP for hair' },
        { role: 'assistant', content: 'Hello! Are you noticing thinning on the crown or hairline?' }
      ];
      const resultTurn2 = generateSmartClinicalFallback('How much does it cost?', conversationHistory);

      expect(resultTurn2.reply).toContain('treatment protocols and sitting requirements are customized');
      expect(resultTurn2.reply).toContain('To help provide an accurate estimate');
      expect(resultTurn2.reply).toContain('How long have you noticed hair thinning');
      expect(resultTurn2.reply).not.toContain('₹15,000 – ₹19,500');
    });

    it('provides approximate price range after 4 qualification turns for Laser', () => {
      const conversationHistory = [
        { role: 'user', content: 'Hi, I want to know about laser hair removal' },
        { role: 'assistant', content: 'Hello! For laser hair reduction, which area would you like to treat?' },
        { role: 'user', content: 'I want to treat my full face and underarms' },
        { role: 'assistant', content: 'Great. Have you had any laser sessions before or any sensitive skin issues?' },
        { role: 'user', content: 'No, this will be my first time' },
        { role: 'assistant', content: 'Understood. Our doctor uses FDA-approved triple-wavelength diode.' },
        { role: 'user', content: 'Okay, what is the approximate price range now?' }
      ];

      const resultTurn4 = generateSmartClinicalFallback(
        'Okay, what is the approximate price range now?', 
        conversationHistory
      );

      expect(resultTurn4.reply.toLowerCase()).toContain('indicative approximate price range');
      expect(resultTurn4.reply).toContain('Single Sitting');
      expect(resultTurn4.reply).toContain('₹2,500 – ₹4,500');
      expect(resultTurn4.reply).toContain('Structured 6-Sitting Package');
      expect(resultTurn4.reply).toContain('₹14,999 – ₹22,500');
      expect(resultTurn4.reply).toContain('spaced 4–6 weeks apart');
      expect(resultTurn4.reply).toContain('Dr. Mrinalini');
    });

    it('provides approximate price range after 4 qualification turns for PRP', () => {
      const conversationHistory = [
        { role: 'user', content: 'Hi, I have hair loss concerns' },
        { role: 'assistant', content: 'Hello! Are you noticing thinning on the crown or hairline?' },
        { role: 'user', content: 'Mainly on the crown area for 6 months' },
        { role: 'assistant', content: 'Have you tried any topical minoxidil or oral supplements?' },
        { role: 'user', content: 'I tried minoxidil 5% for a month' },
        { role: 'assistant', content: 'Got it. PRP works synergistically with growth factor concentrates.' },
        { role: 'user', content: 'What is the package pricing for PRP?' }
      ];

      const result = generateSmartClinicalFallback(
        'What is the package pricing for PRP?', 
        conversationHistory
      );

      expect(result.reply.toLowerCase()).toContain('indicative approximate price range');
      expect(result.reply).toContain('PRP Hair Therapy');
      expect(result.reply).toContain('₹4,000 – ₹5,800');
      expect(result.reply).toContain('₹15,000 – ₹19,500');
      expect(result.reply).toContain('spaced 3–4 weeks apart');
    });
  });

  describe('5. Proactive Leading Questions on General Messages', () => {
    it('asks tailored leading question when patient mentions a skin concern', () => {
      const result = generateSmartClinicalFallback('I have dull skin and pigmentation on my cheeks', []);
      expect(result.reply).toContain('Pigmentation & Chemical Peels');
      expect(result.reply).toContain('Dr. Mrinalini');
    });

    it('asks leading question on greeting to start discovery', () => {
      const result = generateSmartClinicalFallback('Hi there', []);
      expect(result.reply.toLowerCase()).toContain('welcome to la fleur aesthetic & wellness clinic');
      expect(result.reply).toContain('Dr. Mrinalini');
    });

    it('asks leading question when patient asks about doctor timings', () => {
      const result = generateSmartClinicalFallback('What are the clinic timings?', []);
      expect(result.reply).toContain('Monday to Saturday, 10:00 AM – 07:00 PM');
      expect(result.reply).toContain('Dr. Mrinalini');
    });
  });

  describe('6. Automated Booking Extraction & Structured Sitting Metadata', () => {
    it('extracts complete multi-sitting booking object when details provided', () => {
      const msg = 'Book an appointment for Priya Verma tomorrow at 11:30 AM for Laser Hair Reduction, phone +919876543210';
      const result = generateSmartClinicalFallback(msg, []);

      expect(result.appointmentObj).not.toBeNull();
      expect(result.appointmentObj?.patient_name).toBe('Priya Verma');
      expect(result.appointmentObj?.department).toBe('Laser Hair Reduction');
      expect(result.appointmentObj?.current_sitting).toBe(1);
      expect(result.appointmentObj?.total_sittings).toBe(6);
      expect(result.appointmentObj?.sitting_interval).toBe('4-6 weeks');
      expect(result.appointmentObj?.sitting_interval_days).toBe(28);
      expect(result.reply).toContain('Consultation Confirmed');
      expect(result.reply).toContain('Sitting 1 of 6');
    });
  });

  describe('7. Emergency Audio Alarm Synthesizer & Looping Beep Service', () => {
    it('starts continuous looping alarm on emergency trigger', () => {
      emergencyAudio.startAlarm('esc-test-1', '🚨 Patient reported severe burning post peel');
      const state = emergencyAudio.getState();
      expect(state.isRunning).toBe(true);
      expect(state.alertId).toBe('esc-test-1');
      expect(state.alertText).toContain('severe burning post peel');
    });

    it('toggles audio mute safely', () => {
      const initialMute = emergencyAudio.getState().isMuted;
      const newMute = emergencyAudio.toggleMute();
      expect(newMute).toBe(!initialMute);
      // Reset mute back
      emergencyAudio.setMute(false);
      expect(emergencyAudio.getState().isMuted).toBe(false);
    });

    it('silences and stops alarm when admin checks/acknowledges', () => {
      emergencyAudio.startAlarm('esc-test-2', 'Urgent bleeding');
      expect(emergencyAudio.getState().isRunning).toBe(true);
      
      emergencyAudio.stopAlarm('esc-test-2');
      const state = emergencyAudio.getState();
      expect(state.isRunning).toBe(false);
      expect(state.alertId).toBeNull();
    });
  });

});
