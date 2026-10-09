import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const searchParam = searchParams.get('search');

    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {
      // Unauthenticated or demo session
    }

    let query = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    if (statusParam && statusParam !== 'ALL') {
      query = query.eq('status', statusParam.toLowerCase());
    }

    const { data: rawPayments, error } = await query;

    if (error) {
      console.warn('[Payments API Query Notice]:', error.message);
    }

    const paymentsList = (rawPayments || []).map((p: any) => {
      const isPaid = (p.status || '').toLowerCase() === 'paid';
      const amt = Number(p.amount) || 0;
      const fee = Math.round(amt * 0.02); // Standard 2% gateway fee
      const net = Math.max(0, amt - fee);
      
      // Determine payment mode label
      let mode = 'Razorpay Online';
      const gw = (p.gateway || '').toLowerCase();
      if (gw.includes('upi') || (p.payment_mode || '').toLowerCase().includes('upi')) {
        mode = 'UPI (Google Pay / PhonePe)';
      } else if (gw.includes('stripe')) {
        mode = 'Credit / Debit Card (Stripe)';
      } else if (gw.includes('pos') || gw.includes('cash')) {
        mode = 'Clinic POS / Cash';
      }

      // Format human-readable timestamp
      let formattedTime = 'Recent';
      if (p.paid_at || p.created_at) {
        try {
          const d = new Date(p.paid_at || p.created_at);
          formattedTime = d.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {}
      }

      return {
        id: p.id,
        txnNumber: p.receipt_number || p.gateway_payment_id || `TXN-${p.id.slice(0, 8).toUpperCase()}`,
        patientName: p.patient_name || 'Patient',
        patientPhone: p.phone_number || '',
        service: p.treatment || p.service || 'Clinical Consultation',
        amount: amt,
        currency: p.currency === 'INR' ? '₹' : (p.currency || '₹'),
        paymentMode: mode,
        gatewayFee: fee,
        netAmount: net,
        status: isPaid ? 'Paid' : (p.status === 'refunded' ? 'Refunded' : 'Pending'),
        rawStatus: p.status,
        timestamp: formattedTime,
        rawTimestamp: p.paid_at || p.created_at,
        receiptSent: !!p.receipt_number,
        gatewayPaymentId: p.gateway_payment_id || p.payment_link_id || '',
        paymentLinkId: p.payment_link_id || '',
        appointmentId: p.appointment_id || null,
        doctor: p.doctor || 'Dr. Mrinalini',
      };
    });

    // Calculate real financial overview metrics from actual database transactions
    const grossRevenue = paymentsList.reduce((acc: number, t: any) => acc + (t.status === 'Paid' ? t.amount : 0), 0);
    const pendingFloat = paymentsList.reduce((acc: number, t: any) => acc + (t.status === 'Pending' ? t.amount : 0), 0);
    const verifiedBookings = paymentsList.filter((t: any) => t.status === 'Paid').length;

    return NextResponse.json({
      ok: true,
      payments: paymentsList,
      metrics: {
        grossRevenue,
        settledPayouts: grossRevenue > 0 ? Math.max(0, grossRevenue - pendingFloat) : 0,
        pendingFloat,
        verifiedBookings,
        totalCount: paymentsList.length,
      },
    });
  } catch (err: any) {
    console.error('[Payments API Error]:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to load payments', payments: [], metrics: { grossRevenue: 0, settledPayouts: 0, pendingFloat: 0, verifiedBookings: 0, totalCount: 0 } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {}

    const body = await request.json().catch(() => ({}));
    const {
      patientName,
      patientPhone,
      treatment,
      amount,
      currency = 'INR',
      gateway = 'razorpay',
      status = 'paid',
      paymentMode = 'Clinic POS / UPI',
      notes,
      appointmentId,
      doctor = 'Dr. Mrinalini',
    } = body;

    if (!patientName || !patientPhone || !treatment || !amount) {
      return NextResponse.json(
        { ok: false, error: 'patientName, patientPhone, treatment, and amount are required' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount) || 0;
    const receiptNum = `RCP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowIso = new Date().toISOString();

    const insertPayload = {
      account_id: accountId,
      patient_name: patientName,
      phone_number: patientPhone,
      treatment: treatment,
      amount: numAmount,
      currency: currency,
      gateway: gateway,
      status: status.toLowerCase(),
      receipt_number: receiptNum,
      gateway_payment_id: `pay_manual_${Date.now()}`,
      appointment_id: appointmentId && appointmentId.length === 36 ? appointmentId : null,
      doctor: doctor,
      notes: notes || `Recorded via Clinic Accounting Portal (${paymentMode})`,
      paid_at: status.toLowerCase() === 'paid' ? nowIso : null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: savedPayment, error } = await supabase
      .from('payments')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[Record Payment DB Error]:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      success: true,
      payment: savedPayment,
      receiptNumber: receiptNum,
    });
  } catch (err: any) {
    console.error('[Record Payment Error]:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Failed to record payment' }, { status: 500 });
  }
}
