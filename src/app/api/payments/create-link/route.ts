import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createPaymentLink, DEFAULT_PAYMENT_CONFIG, PaymentConfig } from '@/lib/payments/gateway';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      patientName,
      phoneNumber,
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
        { error: 'Missing required patientName or phoneNumber' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const origin = url.origin;

    let accountId: string | null = null;
    let config: PaymentConfig = DEFAULT_PAYMENT_CONFIG;
    let supabase = await createClient();

    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
      supabase = authCtx.supabase;

      // Load custom payment config if saved
      const { data: dbConfig } = await supabase
        .from('payment_configs')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (dbConfig) {
        config = { ...DEFAULT_PAYMENT_CONFIG, ...dbConfig };
      }
    } catch {
      // Demo session or public booking link generation
    }

    // Generate Payment Link
    const generated = await createPaymentLink(
      {
        patientName,
        phoneNumber,
        treatment,
        amount: Number(amount) || config.default_consultation_fee || 500,
        appointmentId,
        date,
        time,
        doctor,
        notes,
        origin,
      },
      config
    );

    // Save pending payment record in Supabase
    try {
      const { data: savedPay } = await supabase
        .from('payments')
        .insert({
          account_id: accountId,
          appointment_id: appointmentId && appointmentId.length === 36 ? appointmentId : null,
          patient_name: patientName,
          phone_number: phoneNumber,
          treatment: treatment,
          amount: generated.amount,
          currency: generated.currency,
          gateway: generated.gateway,
          status: 'pending',
          payment_link_id: generated.paymentId,
          payment_link_url: generated.linkUrl,
          appointment_date: date || null,
          appointment_time: time || null,
          doctor: doctor,
          notes: notes,
        })
        .select('id')
        .maybeSingle();

      // Update appointment if appointmentId provided
      if (appointmentId && appointmentId.length === 36) {
        await supabase
          .from('appointments')
          .update({
            payment_status: 'pending',
            payment_amount: generated.amount,
            payment_link: generated.linkUrl,
            payment_id: generated.paymentId,
          })
          .eq('id', appointmentId);
      }

      return NextResponse.json({
        ok: true,
        success: true,
        paymentId: generated.paymentId,
        paymentLinkUrl: generated.linkUrl,
        amount: generated.amount,
        currency: generated.currency,
        gateway: generated.gateway,
        upiString: generated.upiString,
        qrCodeUrl: generated.qrCodeUrl,
        expiresAt: generated.expiresAt,
        dbId: savedPay?.id || generated.paymentId,
      });
    } catch (dbErr) {
      console.warn('[Payments create-link DB insert notice]:', dbErr);
      return NextResponse.json({
        ok: true,
        success: true,
        paymentId: generated.paymentId,
        paymentLinkUrl: generated.linkUrl,
        amount: generated.amount,
        currency: generated.currency,
        gateway: generated.gateway,
        upiString: generated.upiString,
        qrCodeUrl: generated.qrCodeUrl,
        expiresAt: generated.expiresAt,
      });
    }
  } catch (err: any) {
    console.error('Error generating payment link:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
