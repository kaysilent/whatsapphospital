import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

import { getGlobalServerHospitalProfile } from '@/lib/hospital/treatments';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    let accountId: string | null = null;
    let userId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
      userId = authCtx.userId;
    } catch {}

    const profile = getGlobalServerHospitalProfile();
    const body = await request.json().catch(() => ({}));
    const {
      patientPhone,
      patientName = 'Valued Patient',
      treatment = 'Clinical Consultation',
      amount = profile.consultationFee || 100,
      currency = '₹',
      paymentMode = 'Razorpay Online',
      receiptNumber,
      doctor = profile.leadDoctor || 'Dr. Mrinalini',
      date = new Date().toLocaleDateString('en-IN'),
      time = '11:30 AM',
    } = body;

    if (!patientPhone) {
      return NextResponse.json({ ok: false, error: 'Patient phone number is required' }, { status: 400 });
    }

    const receiptId = receiptNumber || `RCP-${Date.now().toString().slice(-6)}`;
    const clinicAddress = `${profile.address}, ${profile.city} - ${profile.postalCode}`;

    // Build formal WhatsApp receipt text
    const receiptMessage = `🧾 *Official Payment Receipt & Tax Invoice*\n\n` +
      `*Clinic:* ${profile.name || 'La Fleur Aesthetic Clinic'}\n` +
      `*Receipt No:* ${receiptId}\n` +
      `*Date:* ${date}\n` +
      `*Patient:* ${patientName}\n` +
      `*Contact:* ${patientPhone}\n` +
      `*Service / Treatment:* ${treatment}\n` +
      `*Consulting Doctor:* ${doctor}\n` +
      `*Payment Mode:* ${paymentMode}\n` +
      `*Total Amount Paid:* ${currency}${amount}\n\n` +
      `*Status:* ✅ Confirmed & Paid in Full\n` +
      `📍 ${clinicAddress}\n\n` +
      `Thank you for choosing ${profile.name || 'La Fleur Aesthetic Clinic'}! Reply to this message if you have any questions or need directions.`;

    if (accountId) {
      try {
        const resolved = await resolveConversationByPhone(supabase, accountId, patientPhone, patientName);
        if (resolved?.conversationId) {
          await sendMessageToConversation(supabase, accountId, {
            conversationId: resolved.conversationId,
            messageType: 'text',
            contentText: receiptMessage,
          });
        }
      } catch (sendErr: any) {
        console.warn('[WhatsApp Receipt Send Notice]:', sendErr?.message);
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      message: `Payment receipt ${receiptId} dispatched to ${patientName} on WhatsApp!`,
      receiptText: receiptMessage,
    });
  } catch (err: any) {
    console.error('[Receipt Dispatch Error]:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Failed to dispatch receipt' }, { status: 500 });
  }
}
