import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_PAYMENT_CONFIG, formatThankYouMessage } from '@/lib/payments/gateway';
import { syncAppointmentToGoogleCalendar } from '@/lib/calendar/google-calendar';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let event: any = {};
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Razorpay Webhook HMAC Signature Verification
    const rzpSignature = request.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (rzpSignature && webhookSecret) {
      const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (expected !== rzpSignature) {
        console.warn('[Razorpay Webhook Signature Mismatch]');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
      }
    }

    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    // 1. Razorpay Webhook Event Handling (e.g. payment_link.paid, payment.captured)
    if (event.event === 'payment_link.paid' || event.event === 'payment.captured' || event.event === 'order.paid') {
      const payload = event.payload?.payment_link?.entity || event.payload?.payment?.entity || event.payload?.order?.entity;
      const paymentLinkId = payload?.id || payload?.order_id;
      const amountPaise = payload?.amount || 0;
      const amount = amountPaise / 100;
      const customerPhone = payload?.customer?.contact || payload?.contact || '';
      const customerName = payload?.customer?.name || '';
      const rzpPaymentId = payload?.payment_id || payload?.id;

      const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      if (paymentLinkId || customerPhone) {
        await supabase
          .from('payments')
          .update({
            status: 'paid',
            gateway_payment_id: rzpPaymentId,
            receipt_number: receiptId,
            paid_at: nowIso,
            updated_at: nowIso,
          })
          .or(`payment_link_id.eq.${paymentLinkId},phone_number.eq.${customerPhone}`);

        const { data: updatedAppt } = await supabase
          .from('appointments')
          .update({
            payment_status: 'paid',
            receipt_number: receiptId,
            payment_id: rzpPaymentId,
            updated_at: nowIso,
          })
          .eq('phone_number', customerPhone)
          .select()
          .maybeSingle();

        if (updatedAppt) {
          syncAppointmentToGoogleCalendar(updatedAppt, 'create').catch(() => {});
        }
      }

      return NextResponse.json({ ok: true, received: true, event: event.event });
    }

    // 2. Stripe Webhook Handling (checkout.session.completed)
    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const session = event.data?.object;
      const clientRef = session?.client_reference_id;
      const customerPhone = session?.customer_details?.phone || '';

      if (clientRef || customerPhone) {
        const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        await supabase
          .from('payments')
          .update({
            status: 'paid',
            gateway_payment_id: session?.payment_intent || session?.id,
            receipt_number: receiptId,
            paid_at: nowIso,
            updated_at: nowIso,
          })
          .or(`payment_link_id.eq.${clientRef},phone_number.eq.${customerPhone}`);
      }

      return NextResponse.json({ ok: true, received: true, type: event.type });
    }

    return NextResponse.json({ ok: true, received: true, ignored: true });
  } catch (err: any) {
    console.error('[Webhook error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
