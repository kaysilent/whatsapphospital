/**
 * Emergency Detection, Doctor WhatsApp Alerting & Bidirectional Relay Engine
 * 
 * 1. Detects critical clinical emergencies from patient WhatsApp messages.
 * 2. Immediately alerts the on-duty Doctor via WhatsApp with patient details & context.
 * 3. Listens for the Doctor's direct WhatsApp reply and automatically relays it to the patient.
 * 4. Logs full audit trail in CRM and confirms delivery back to the Doctor.
 */

export interface EmergencyDetectionResult {
  isEmergency: boolean;
  reason: string;
  severity: 'CRITICAL' | 'URGENT' | 'HIGH';
  matchedKeywords: string[];
}

export interface EmergencyRelaySession {
  id: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  doctor_phone: string;
  department: string;
  sitting_info?: string;
  emergency_text: string;
  severity: 'CRITICAL' | 'URGENT' | 'HIGH';
  status: 'ACTIVE' | 'DOCTOR_ALERTED' | 'DOCTOR_REPLIED' | 'RESOLVED';
  doctor_replies_count: number;
  last_doctor_reply_text?: string;
  last_doctor_reply_at?: string;
  created_at: string;
}

const CRITICAL_KEYWORDS = [
  'emergency', 'help immediately', 'severe bleeding', 'heavy bleeding', 'blood oozing',
  'chest pain', 'chest tightness', 'cannot breathe', 'difficulty breathing', 'breathing difficulty', 
  'shortness of breath', 'trouble breathing', 'breathless', 'choking', 'unconscious', 'fainted', 
  'seizure', 'anaphylaxis', 'severe allergic reaction', 'allergic reaction', 'severe burn', 
  'blisters everywhere', 'face swelling', 'face swelling rapidly', 'lip swelling', 'throat swelling', 
  'eye injury', 'excruciating pain', '108', 'ambulance'
];

const URGENT_KEYWORDS = [
  'urgent', 'urgent doctor', 'bleeding', 'infection', 'pus oozing', 'pus', 'severe swelling',
  'swelling', 'high fever', 'fever', 'burning sensation', 'severe burning', 'burning', 
  'redness spreading', 'blisters', 'rash all over', 'severe rash', 'extreme pain', 
  'vomiting blood', 'wound opened', 'stitches opened', 'help me doctor', 'complication',
  'connect with doctor', 'connect to doctor', 'connect me with doctor', 'connect me to doctor',
  'talk to doctor', 'talk to the doctor', 'talk with doctor', 'talk with the doctor',
  'speak to doctor', 'speak to the doctor', 'speak with doctor', 'speak with the doctor',
  'call doctor', 'call the doctor', 'need doctor', 'doctor needed', 'doctor urgent',
  'urgent doctor call', 'speak with dr', 'talk with dr', 'connect with dr', 'talk to dr',
  'speak to dr', 'connect to dr', 'human doctor', 'transfer to doctor'
];

// Whole-word / whole-phrase matchers. Plain substring matching flagged
// ordinary WhatsApp messages as emergencies — '108' inside a phone number or
// booking ID, 'pus' inside 'campus' — and an emergency hit skips the AI reply.
function keywordMatcher(kw: string): RegExp {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
}

const CRITICAL_MATCHERS = CRITICAL_KEYWORDS.map((kw) => [kw, keywordMatcher(kw)] as const);
const URGENT_MATCHERS = URGENT_KEYWORDS.map((kw) => [kw, keywordMatcher(kw)] as const);

/**
 * Detects if a message constitutes an acute medical or post-procedure emergency
 */
export function detectEmergencyKeywords(text: string): EmergencyDetectionResult {
  if (!text || typeof text !== 'string') {
    return { isEmergency: false, reason: '', severity: 'HIGH', matchedKeywords: [] };
  }

  const lower = text.toLowerCase();
  const matchedCritical: string[] = [];
  const matchedUrgent: string[] = [];

  for (const [kw, re] of CRITICAL_MATCHERS) {
    if (re.test(lower)) {
      matchedCritical.push(kw);
    }
  }

  for (const [kw, re] of URGENT_MATCHERS) {
    if (re.test(lower) && !matchedCritical.includes(kw)) {
      matchedUrgent.push(kw);
    }
  }

  if (matchedCritical.length > 0) {
    return {
      isEmergency: true,
      reason: `Critical Clinical Trigger: ${matchedCritical.join(', ')}`,
      severity: 'CRITICAL',
      matchedKeywords: matchedCritical
    };
  }

  if (matchedUrgent.length > 0) {
    return {
      isEmergency: true,
      reason: `Urgent Symptom Alert: ${matchedUrgent.join(', ')}`,
      severity: 'URGENT',
      matchedKeywords: matchedUrgent
    };
  }

  return {
    isEmergency: false,
    reason: '',
    severity: 'HIGH',
    matchedKeywords: []
  };
}

/**
 * Formats high-priority WhatsApp alert sent to Doctor's personal phone
 */
export function formatDoctorEmergencyAlert(params: {
  patientName: string;
  patientPhone: string;
  department?: string;
  sittingInfo?: string;
  messageText: string;
  reason: string;
  doctorName?: string;
}): string {
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  const deptLine = params.department ? `• *Treatment Context:* ${params.department}${params.sittingInfo ? ` (${params.sittingInfo})` : ''}` : '• *Department:* Urgent Patient Care';

  return `🚨 *URGENT PATIENT EMERGENCY ALERT*
━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Patient:* ${params.patientName} (${params.patientPhone})
${deptLine}
⚠️ *Flagged Concern:* ${params.reason}
⏰ *Time:* ${timeStr}

💬 *Patient's Message:*
"${params.messageText}"
━━━━━━━━━━━━━━━━━━━━━━━━
👉 *TO REPLY TO PATIENT DIRECTLY:*
Simply reply to this WhatsApp message or type:
*#reply [Your clinical guidance/advice]*

The CRM will instantly relay your message directly to ${params.patientName}'s WhatsApp.`;
}

/**
 * Immediate triage response sent to the patient while the doctor is alerted
 */
export function formatPatientEmergencyAutoReply(doctorName = 'On-Call Doctor'): string {
  return `🚨 *Emergency Alert Dispatched to Doctor*

We have immediately alerted *${doctorName}* on WhatsApp with your message. The doctor is reviewing your concern and will reply directly through this chat shortly.

⚠️ *Immediate Safety Guidance:*
• If you are experiencing difficulty breathing, chest pain, or severe acute distress, please contact emergency services (*112 / 108*) or proceed to the nearest emergency hospital immediately.
• Keep the treated area clean and do not apply unprescribed chemicals or ointments.

*Doctor ${doctorName} is being connected now.*`;
}

/**
 * Message relayed from the Doctor directly to the Patient
 */
export function formatDoctorRelayedMessageToPatient(doctorName: string, doctorMessage: string): string {
  const cleanMessage = doctorMessage.replace(/^#reply\s*/i, '').trim();
  return `👨‍⚕️ *Clinical Direct Message from ${doctorName}:*

${cleanMessage}

━━━━━━━━━━━━━━━━━━━━━━━━
_For emergencies, the clinic hotline is also available 24/7._`;
}

/**
 * Delivery confirmation sent back to the Doctor
 */
export function formatDoctorDeliveryConfirmation(patientName: string, patientPhone: string): string {
  const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  return `✅ *Delivered to Patient* (${timeStr})
Your message has been delivered to *${patientName}* (${patientPhone}) via WhatsApp. Further messages from the patient will continue to be relayed to you.`;
}
