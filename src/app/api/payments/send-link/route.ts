import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createPaymentLink, DEFAULT_PAYMENT_CONFIG, PaymentConfig } from '@/lib/payments/gateway';
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils';
import { engineSendText } from '@/lib/automations/meta-send';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      patientName,
      phoneNumber = body.phone || body.patientPhone,
      treatment = 'Clinical Consultation',
      amount = 500,
      appointmentId,
      date,
      time,
      doctor = 'Dr. Mrinalini',
      notes,
    } = body;

    if (!patientName || !phoneNumber) {
      return NextResponse.json(
        { error: 'Patient name and WhatsApp phone number are required' },
        { status: 400 }
      );
    }

    const cleanPhone = sanitizePhoneForMeta(phoneNumber);
    const url = new URL(request.url);
    const origin = url.origin;

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
      // Demo session / Unauthenticated fallback
    }

    const adminDb = supabaseAdmin();
    if (!accountId) {
      const { data: primaryAcc } = await adminDb.from('accounts').select('id').limit(1).maybeSingle();
      accountId = primaryAcc?.id || '56702d02-aecf-489a-a9cf-632b068f3d29';
    }

    // 1. Generate Payment Link
    const paymentAmount = Number(amount) || config.default_consultation_fee || 500;
    const generated = await createPaymentLink(
      {
        patientName,
        phoneNumber: cleanPhone,
        treatment,
        amount: paymentAmount,
        appointmentId,
        date,
        time,
        doctor,
        notes,
        origin,
      },
      config
    );

    // 2. Persist Payment Record in Supabase
    try {
      await adminDb.from('payments').insert({
        account_id: accountId,
        appointment_id: appointmentId && appointmentId.length === 36 ? appointmentId : null,
        patient_name: patientName,
        phone_number: cleanPhone,
        treatment: treatment,
        amount: generated.amount,
        currency: generated.currency || 'INR',
        gateway: generated.gateway || 'razorpay',
        status: 'pending',
        payment_link_id: generated.paymentId,
        payment_link_url: generated.linkUrl,
        appointment_date: date || null,
        appointment_time: time || null,
        doctor: doctor,
        notes: notes,
      });

      if (appointmentId && appointmentId.length === 36) {
        await adminDb
          .from('appointments')
          .update({
            payment_status: 'pending',
            payment_amount: generated.amount,
            payment_link: generated.linkUrl,
            payment_id: generated.paymentId,
          })
          .eq('id', appointmentId);
      }
    } catch (dbErr) {
      console.warn('[send-link DB insert notice]:', dbErr);
    }

    // 3. Construct WhatsApp Message
    const waMessage = `Hello ${patientName}! 🌸\n\nHere is your official appointment booking payment link for *${treatment}* with *${doctor}* at La Fleur Aesthetic Clinic:\n\n🔗 *Payment Link:* ${generated.linkUrl}\n\n💳 *Amount Due:* ₹${paymentAmount}\n📅 *Date & Slot:* ${date || 'Upcoming'} at ${time || '11:30 AM'}\n\nPlease tap the link to complete your payment via Razorpay or Instant UPI (Google Pay / PhonePe / Paytm). Your appointment receipt will be automatically generated.`;

    // 4. Find or Create Contact & Conversation for WhatsApp Dispatch
    let contactId: string | null = null;
    let conversationId: string | null = null;

    try {
      const last10 = cleanPhone.slice(-10);
      const { data: existingContact } = await adminDb
        .from('contacts')
        .select('id')
        .eq('account_id', accountId)
        .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.ilike.%${last10}%`)
        .limit(1)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact } = await adminDb
          .from('contacts')
          .insert({
            account_id: accountId,
            phone: cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`,
            name: patientName,
          })
          .select('id')
          .maybeSingle();
        contactId = newContact?.id || null;
      }

      if (contactId) {
        const { data: existingConv } = await adminDb
          .from('conversations')
          .select('id')
          .eq('account_id', accountId)
          .eq('contact_id', contactId)
          .maybeSingle();

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv } = await adminDb
            .from('conversations')
            .insert({
              account_id: accountId,
              contact_id: contactId,
              contact_phone: cleanPhone,
              last_message_text: waMessage,
            })
            .select('id')
            .maybeSingle();
          conversationId = newConv?.id || null;
        }
      }

      // 5. Send via WhatsApp Meta Cloud API Engine
      if (accountId && contactId && conversationId) {
        await engineSendText({
          accountId,
          userId: 'system',
          conversationId,
          contactId,
          text: waMessage,
        });
      }
    } catch (waErr: any) {
      console.warn('[send-link Meta Cloud API dispatch notice]:', waErr?.message);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      paymentId: generated.paymentId,
      paymentUrl: generated.linkUrl,
      amount: generated.amount,
      patientName,
      phoneNumber: cleanPhone,
      whatsappMessage: waMessage,
    });
  } catch (err: any) {
    console.error('Error in /api/payments/send-link:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate and dispatch payment link' },
      { status: 500 }
    );
  }
}
