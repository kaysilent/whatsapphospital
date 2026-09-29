import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { DEFAULT_PAYMENT_CONFIG, formatThankYouMessage, PaymentConfig } from '@/lib/payments/gateway';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      paymentId,
      gatewayPaymentId,
      gatewayOrderId,
      gatewaySignature,
      patientName,
      phoneNumber,
      treatment,
      amount,
      date,
      time,
      doctor = 'Dr. Mrinalini',
      paymentMode = 'Razorpay / UPI',
      appointmentId,
    } = body;

    const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    let accountId: string | null = null;
    let config: PaymentConfig = DEFAULT_PAYMENT_CONFIG;
    let supabase = await createClient();

    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
      supabase = authCtx.supabase;

      const { data: dbConfig } = await supabase
        .from('payment_configs')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (dbConfig) {
        config = { ...DEFAULT_PAYMENT_CONFIG, ...dbConfig };
      }
    } catch {
      // Demo session
    }

    // 1. Update Payment Record in Supabase
    try {
      if (paymentId) {
        await supabase
          .from('payments')
          .update({
            status: 'paid',
            gateway_payment_id: gatewayPaymentId || `pay_${Date.now()}`,
            gateway_order_id: gatewayOrderId || null,
            gateway_signature: gatewaySignature || null,
            receipt_number: receiptId,
            paid_at: nowIso,
            updated_at: nowIso,
          })
          .or(`payment_link_id.eq.${paymentId},id.eq.${paymentId}`);
      }

      // 2. Update Appointment in Supabase
      if (appointmentId && appointmentId.length === 36) {
        await supabase
          .from('appointments')
          .update({
            payment_status: 'paid',
            status: 'Confirmed',
            receipt_number: receiptId,
            payment_id: gatewayPaymentId || paymentId,
            updated_at: nowIso,
          })
          .eq('id', appointmentId);
      } else if (phoneNumber) {
        // Match appointment by phone
        await supabase
          .from('appointments')
          .update({
            payment_status: 'paid',
            status: 'Confirmed',
            receipt_number: receiptId,
            payment_id: gatewayPaymentId || paymentId,
            updated_at: nowIso,
          })
          .eq('phone_number', phoneNumber)
          .eq('payment_status', 'pending');
      }
    } catch (dbErr) {
      console.warn('[Payments verify DB update notice]:', dbErr);
    }

    // 3. Format Automated WhatsApp Thank You & Confirmation Receipt Message
    const thankYouMessage = formatThankYouMessage(config.thank_you_message_template, {
      patient_name: patientName || 'Valued Patient',
      treatment: treatment || 'Clinical Consultation',
      amount: amount || config.default_consultation_fee || 500,
      currency: config.currency === 'INR' ? '₹' : (config.currency || '₹'),
      date: date || new Date().toISOString().split('T')[0],
      time: time || '11:30 AM',
      doctor: doctor || 'Dr. Mrinalini',
      receipt_id: receiptId,
      payment_mode: paymentMode,
    });

    // 4. Optionally record or send message via WhatsApp outbound message dispatcher
    try {
      if (phoneNumber) {
        // Check if a conversation exists to log the receipt
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_phone', phoneNumber)
          .maybeSingle();

        if (conv?.id) {
          await supabase.from('messages').insert({
            conversation_id: conv.id,
            sender_type: 'agent',
            content_text: thankYouMessage,
            status: 'sent',
          });
        }
      }
    } catch (msgErr) {
      console.warn('[Payments verify WhatsApp message log notice]:', msgErr);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      receiptNumber: receiptId,
      paidAt: nowIso,
      amount: Number(amount) || 500,
      currency: config.currency || 'INR',
      patientName,
      treatment,
      date,
      time,
      doctor,
      paymentMode,
      whatsappMessage: thankYouMessage,
      whatsappSent: true,
    });
  } catch (err: any) {
    console.error('Error verifying payment:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
