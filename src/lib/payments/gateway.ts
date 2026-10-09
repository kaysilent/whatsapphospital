/**
 * Payment Gateway Engine for WhatsApp Hospital CRM
 * Supports Razorpay, Stripe, UPI Direct, and Hosted Patient Checkout.
 */

export interface PaymentConfig {
  gateway_provider: 'razorpay' | 'stripe' | 'upi' | 'mock';
  is_enabled: boolean;
  is_test_mode: boolean;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  razorpay_webhook_secret?: string;
  stripe_publishable_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  upi_vpa: string;
  merchant_name: string;
  currency: string;
  booking_fee?: number;
  default_consultation_fee: number;
  default_advance_token_fee: number;
  require_payment_for_booking: boolean;
  auto_send_whatsapp_receipt: boolean;
  thank_you_message_template: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  auto_settlement_schedule?: string;
  is_bank_verified?: boolean;
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  gateway_provider: 'razorpay',
  is_enabled: true,
  is_test_mode: false,
  razorpay_key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_Tkiy8JNohenPgb',
  razorpay_key_secret: process.env.RAZORPAY_KEY_SECRET || 'SgkpZgohcWUhxN8QfXI96ZTO',
  razorpay_webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  stripe_publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  stripe_secret_key: process.env.STRIPE_SECRET_KEY || '',
  upi_vpa: 'lafleur@okhdfcbank',
  merchant_name: 'La Fleur Aesthetic Clinic',
  currency: 'INR',
  booking_fee: 10,
  default_consultation_fee: 500,
  default_advance_token_fee: 10,
  require_payment_for_booking: true,
  auto_send_whatsapp_receipt: true,
  bank_name: 'HDFC Bank (Commercial Healthcare)',
  account_number: '•••• •••• •••• 9102',
  ifsc_code: 'HDFC0001824',
  account_holder_name: 'Dr. Mrinalini Aesthetic Clinic Pvt Ltd',
  auto_settlement_schedule: 'T+1 Daily at 18:00 IST',
  is_bank_verified: true,
  thank_you_message_template: `🎉 *Payment Received & Appointment Confirmed!*

Dear {patient_name}, your payment of ₹{amount} for {treatment} with Dr. Mrinalini has been successfully received.

📅 Date: {date}
⏰ Time: {time}
👨‍⚕️ Consulting: {doctor}
🧾 Receipt No: {receipt_id}
💳 Payment Mode: {payment_mode}

📍 Clinic Location:
Road No.11 B, Jubilee hills, Hyderabad - 500045
Maps: https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad

We look forward to welcoming you! Please arrive 10 minutes prior to your scheduled slot.`,
};

export interface CreatePaymentLinkParams {
  patientName: string;
  phoneNumber: string;
  treatment: string;
  amount: number;
  appointmentId?: string;
  date?: string;
  time?: string;
  doctor?: string;
  notes?: string;
  origin?: string;
}

export interface GeneratedPaymentLink {
  paymentId: string;
  linkUrl: string;
  amount: number;
  currency: string;
  gateway: 'razorpay' | 'stripe' | 'upi' | 'mock';
  upiString?: string;
  qrCodeUrl?: string;
  expiresAt: string;
}

/**
 * Generate a payment link for a patient booking.
 * Generates either a Razorpay live/test link, Stripe checkout, or a hosted patient checkout portal.
 */
export async function createPaymentLink(
  params: CreatePaymentLinkParams,
  config: PaymentConfig = DEFAULT_PAYMENT_CONFIG
): Promise<GeneratedPaymentLink> {
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanPhone = params.phoneNumber.replace(/[\s\-\(\)]/g, '');
  const baseUrl = params.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  const hostedCheckoutUrl = `${baseUrl}/pay/${paymentId}?name=${encodeURIComponent(params.patientName)}&phone=${encodeURIComponent(cleanPhone)}&treatment=${encodeURIComponent(params.treatment)}&amount=${params.amount}&date=${encodeURIComponent(params.date || '')}&time=${encodeURIComponent(params.time || '')}&doctor=${encodeURIComponent(params.doctor || 'Dr. Mrinalini')}&apptId=${encodeURIComponent(params.appointmentId || '')}`;

  // If Razorpay API credentials are provided and not default mock
  if (config.gateway_provider === 'razorpay' && config.razorpay_key_id && config.razorpay_key_secret && !config.razorpay_key_id.includes('lafleur_clinic')) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${config.razorpay_key_id}:${config.razorpay_key_secret}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100), // paise
          currency: 'INR',
          accept_partial: false,
          description: `Consultation & Booking Fee - ${params.treatment} at La Fleur Clinic`,
          customer: {
            name: params.patientName,
            contact: cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`,
          },
          notify: {
            sms: true,
            email: false,
            whatsapp: true,
          },
          reminder_enable: true,
          callback_url: `${baseUrl}/pay/success?payment_id=${paymentId}`,
          callback_method: 'get',
        }),
      });

      if (rzpRes.ok) {
        const rzpData = await rzpRes.json();
        return {
          paymentId: rzpData.id || paymentId,
          linkUrl: rzpData.short_url || hostedCheckoutUrl,
          amount: params.amount,
          currency: 'INR',
          gateway: 'razorpay',
          expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        };
      }
    } catch (e) {
      console.warn('[Razorpay API Link Generation failed, falling back to hosted checkout]:', e);
    }
  }

  // Generate UPI Intent deep-link string for instant mobile payments
  const upiString = `upi://pay?pa=${encodeURIComponent(config.upi_vpa)}&pn=${encodeURIComponent(config.merchant_name)}&am=${params.amount}&cu=INR&tn=${encodeURIComponent(`Booking Fee - ${params.treatment} (${params.patientName})`)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiString)}`;

  return {
    paymentId,
    linkUrl: hostedCheckoutUrl,
    amount: params.amount,
    currency: config.currency || 'INR',
    gateway: config.gateway_provider,
    upiString,
    qrCodeUrl,
    expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
  };
}

/**
 * Format automated WhatsApp Thank You & Confirmation message.
 */
export function formatThankYouMessage(
  template: string,
  data: {
    patient_name: string;
    treatment: string;
    amount: number | string;
    currency?: string;
    date: string;
    time: string;
    doctor: string;
    receipt_id: string;
    payment_mode?: string;
  }
): string {
  let msg = template || DEFAULT_PAYMENT_CONFIG.thank_you_message_template;
  msg = msg.replace(/{patient_name}/g, data.patient_name || 'Valued Patient');
  msg = msg.replace(/{treatment}/g, data.treatment || 'Consultation');
  msg = msg.replace(/{amount}/g, String(data.amount));
  msg = msg.replace(/{currency}/g, data.currency || '₹');
  msg = msg.replace(/{date}/g, data.date || 'Scheduled Date');
  msg = msg.replace(/{time}/g, data.time || 'Scheduled Time');
  msg = msg.replace(/{doctor}/g, data.doctor || 'Dr. Mrinalini');
  msg = msg.replace(/{receipt_id}/g, data.receipt_id || `REC-${Date.now().toString().slice(-6)}`);
  msg = msg.replace(/{payment_mode}/g, data.payment_mode || 'Razorpay / UPI');
  return msg;
}

/**
 * Diagnostic tool: Test connectivity and authentication with Razorpay API
 */
export async function testRazorpayConnection(
  keyId: string,
  keySecret: string
): Promise<{ success: boolean; message: string; latencyMs: number; mode: 'live' | 'test' | 'mock' }> {
  const start = Date.now();
  const cleanKey = (keyId || '').trim();
  const cleanSecret = (keySecret || '').trim();

  if (!cleanKey || !cleanSecret) {
    return {
      success: false,
      message: 'Both Razorpay Key ID and Key Secret are required to test connection.',
      latencyMs: 0,
      mode: 'test',
    };
  }

  if (cleanKey.includes('lafleur_clinic')) {
    return {
      success: true,
      message: 'Simulated sandbox test mode active and healthy (Ready for appointments).',
      latencyMs: 15,
      mode: 'mock',
    };
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${cleanKey}:${cleanSecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/payments?count=1', {
      headers: { Authorization: authHeader },
    });
    const latencyMs = Date.now() - start;

    if (res.ok) {
      const mode = cleanKey.startsWith('rzp_live') ? 'live' : 'test';
      return {
        success: true,
        message: `Successfully connected to Razorpay API in ${mode.toUpperCase()} mode!`,
        latencyMs,
        mode,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      const desc = errData.error?.description || `Authentication failed with status ${res.status}`;
      return {
        success: false,
        message: `${desc}. Please verify your Key ID and Key Secret from Razorpay Dashboard > Settings > API Keys.`,
        latencyMs,
        mode: cleanKey.startsWith('rzp_live') ? 'live' : 'test',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error reaching api.razorpay.com',
      latencyMs: Date.now() - start,
      mode: 'test',
    };
  }
}
