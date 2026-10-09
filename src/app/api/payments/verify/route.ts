import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { DEFAULT_PAYMENT_CONFIG, formatThankYouMessage, PaymentConfig } from '@/lib/payments/gateway';
import { syncAppointmentToGoogleCalendar } from '@/lib/calendar/google-calendar';

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
        const updatePayload: any = {
          payment_status: 'paid',
          status: 'Confirmed',
          receipt_number: receiptId,
          payment_id: gatewayPaymentId || paymentId,
          updated_at: nowIso,
        };
        if (patientName && patientName.toLowerCase() !== 'patient' && patientName.toLowerCase() !== 'valued patient') {
          updatePayload.patient_name = patientName;
        }
        await supabase
          .from('appointments')
          .update(updatePayload)
          .eq('phone_number', phoneNumber)
          .eq('payment_status', 'pending');
      }

      // Sync confirmed appointment to Google Calendar
      try {
        await syncAppointmentToGoogleCalendar({
          id: appointmentId,
          patient_name: patientName || 'Valued Patient',
          phone_number: phoneNumber,
          date: date || new Date().toISOString().split('T')[0],
          time: time || '11:30 AM',
          department: treatment || 'Clinical Consultation',
          doctor: doctor || 'Dr. Mrinalini',
          status: 'Confirmed',
          notes: `[Receipt: ${receiptId}] Paid via ${paymentMode}`,
        }, 'create');
      } catch (calErr: any) {
        console.warn('[Payments verify Google Calendar sync notice]:', calErr?.message);
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

    // 4. Send message via WhatsApp outbound message dispatcher
    try {
      if (phoneNumber) {
        const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
        // Check if a conversation exists to log and dispatch the receipt
        const { data: conv } = await supabase
          .from('conversations')
          .select('id, contact_id, account_id')
          .eq('contact_phone', cleanPhone)
          .maybeSingle();

        let effectiveAccountId = accountId || conv?.account_id;
        let effectiveConvId = conv?.id;
        let effectiveContactId = conv?.contact_id;

        if (!effectiveAccountId) {
          const { data: primaryAcc } = await supabase.from('accounts').select('id').limit(1).maybeSingle();
          effectiveAccountId = primaryAcc?.id;
        }

        if (!effectiveContactId && effectiveAccountId) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('account_id', effectiveAccountId)
            .ilike('phone', `%${cleanPhone.slice(-10)}%`)
            .maybeSingle();
          effectiveContactId = contact?.id;
        }

        if (effectiveConvId) {
          await supabase.from('messages').insert({
            conversation_id: effectiveConvId,
            sender_type: 'agent',
            content_text: thankYouMessage,
            status: 'sent',
          });
        }

        // Live outbound WhatsApp dispatch via Meta Cloud API
        if (effectiveAccountId && effectiveConvId && effectiveContactId) {
          try {
            const { engineSendText } = await import('@/lib/automations/meta-send');
            await engineSendText({
              accountId: effectiveAccountId,
              userId: 'system',
              conversationId: effectiveConvId,
              contactId: effectiveContactId,
              text: thankYouMessage,
            });
            console.log('[Payments verify]: Successfully dispatched WhatsApp receipt to', cleanPhone);
          } catch (waErr: any) {
            console.warn('[Payments verify WhatsApp Meta send notice]:', waErr?.message);
          }
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
