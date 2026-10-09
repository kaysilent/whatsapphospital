import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentAccount } from '@/lib/auth/account';
import { detectEmergencyKeywords } from '@/lib/whatsapp/emergency-relay';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export const runtime = 'nodejs';

/**
 * GET /api/escalations
 * Returns real-time clinical emergencies, patient symptom escalations, and active doctor relay sessions.
 */
export async function GET() {
  try {
    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {}

    const admin = supabaseAdmin();

    // 1. Fetch active emergency relay sessions from Supabase
    let query = admin
      .from('emergency_relay_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data: rawSessions, error } = await query;

    if (error && error.code !== '42P01') {
      console.warn('[API /escalations GET Error]:', error.message);
    }

    const sessions: any[] = rawSessions || [];

    // Filter active alerts vs resolved
    const activeSessions = sessions.filter((s: any) => s.status !== 'RESOLVED');
    const resolvedSessions = sessions.filter((s: any) => s.status === 'RESOLVED');

    // 2. Also check recent conversations with unread urgent patient messages
    let convQuery = admin
      .from('conversations')
      .select(`
        id,
        account_id,
        contact_id,
        status,
        unread_count,
        last_message_text,
        last_message_at,
        created_at,
        contact:contacts(id, name, phone)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(10);

    if (accountId) {
      convQuery = convQuery.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data: recentConvs } = await convQuery;

    const inferredAlerts: any[] = [];
    if (Array.isArray(recentConvs)) {
      for (const conv of recentConvs) {
        const text = conv.last_message_text || '';
        const phone = (conv.contact as any)?.phone || '';
        const name = (conv.contact as any)?.name || 'WhatsApp Patient';

        // Check if already in activeSessions
        const alreadyInSessions = activeSessions.some((s: any) => 
          s.conversation_id === conv.id || 
          (s.patient_phone && phone && s.patient_phone.replace(/\D/g, '') === phone.replace(/\D/g, ''))
        );

        if (!alreadyInSessions && text) {
          const check = detectEmergencyKeywords(text);
          if (check.isEmergency) {
            inferredAlerts.push({
              id: `inferred-${conv.id}`,
              conversation_id: conv.id,
              contact_id: conv.contact_id,
              patient_name: name,
              patient_phone: phone,
              doctor_name: 'Dr. Mrinalini',
              doctor_phone: '+91 98765 00001',
              department: 'Dermatology & Aesthetic Care',
              severity: check.severity,
              emergency_text: text,
              reason: check.reason,
              status: 'ACTIVE',
              doctor_replies_count: 0,
              created_at: conv.last_message_at || conv.created_at || new Date().toISOString()
            });
          }
        }
      }
    }

    // Combine all active alerts
    const allActiveAlerts = [...activeSessions, ...inferredAlerts];

    return NextResponse.json({
      ok: true,
      alerts: allActiveAlerts,
      relaySessions: activeSessions,
      resolvedSessions: resolvedSessions.slice(0, 10),
      activeCount: allActiveAlerts.length,
      hasCritical: allActiveAlerts.some((a: any) => a.severity === 'CRITICAL' || a.severity === 'URGENT')
    });
  } catch (err: any) {
    console.error('[API /escalations GET Error]:', err);
    return NextResponse.json({
      ok: false,
      alerts: [],
      relaySessions: [],
      error: err?.message || 'Failed to fetch escalations'
    }, { status: 500 });
  }
}

/**
 * POST /api/escalations
 * Handles resolving alerts, creating test cases, or relaying doctor replies to WhatsApp.
 */
export async function POST(request: Request) {
  try {
    let accountId: string | null = null;
    let userId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
      userId = authCtx.userId;
    } catch {}

    const body = await request.json();
    const { action, id, replyText, testData } = body;
    const admin = supabaseAdmin();

    if (action === 'resolve') {
      if (!id) {
        return NextResponse.json({ ok: false, error: 'Missing alert ID' }, { status: 400 });
      }

      if (id.startsWith('inferred-')) {
        // Inferred conversation alert: mark conversation as read/open
        const convId = id.replace('inferred-', '');
        await admin
          .from('conversations')
          .update({ unread_count: 0, updated_at: new Date().toISOString() })
          .eq('id', convId)
          .catch(() => {});
      } else {
        // Update emergency_relay_sessions
        await admin
          .from('emergency_relay_sessions')
          .update({ 
            status: 'RESOLVED',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }

      return NextResponse.json({ ok: true, message: 'Alert resolved and silenced successfully' });
    }

    if (action === 'create_test') {
      const patientName = testData?.patientName || 'Live Test Patient';
      const patientPhone = testData?.patientPhone || '+91 98765 43210';
      const emergencyText = testData?.emergencyText || 'URGENT: Experiencing sudden severe rash and skin burning sensation 2 hours post-treatment.';
      const severity = testData?.severity || 'CRITICAL';
      const doctorName = testData?.doctorName || 'Dr. Mrinalini';

      const { data: newSession, error: insertErr } = await admin
        .from('emergency_relay_sessions')
        .insert({
          account_id: accountId,
          patient_name: patientName,
          patient_phone: patientPhone,
          doctor_name: doctorName,
          doctor_phone: '+91 98765 00001',
          department: 'Dermatology & Urgent Care',
          severity: severity,
          emergency_text: emergencyText,
          status: 'DOCTOR_ALERTED',
          doctor_replies_count: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, session: newSession });
    }

    if (action === 'relay_reply') {
      if (!id || !replyText) {
        return NextResponse.json({ ok: false, error: 'Missing session ID or reply text' }, { status: 400 });
      }

      const { data: session } = await admin
        .from('emergency_relay_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!session) {
        return NextResponse.json({ ok: false, error: 'Emergency session not found' }, { status: 404 });
      }

      // If session has a conversation_id and account_id, dispatch to patient's WhatsApp
      const targetAccountId = session.account_id || accountId;
      if (session.conversation_id && targetAccountId) {
        try {
          const formattedMsg = `👨‍⚕️ *Clinical Direct Message from ${session.doctor_name || 'Dr. Mrinalini'}:*\n\n${replyText}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n_Clinic Medical Team_`;
          await sendMessageToConversation(admin, targetAccountId, {
            conversationId: session.conversation_id,
            messageType: 'text',
            contentText: formattedMsg,
          });
        } catch (e: any) {
          console.warn('[Relay Doctor Reply Send Warning]:', e?.message);
        }
      }

      // Update session record
      const replyEntry = {
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'relayed_to_patient'
      };

      await admin
        .from('emergency_relay_sessions')
        .update({
          status: 'DOCTOR_REPLIED',
          doctor_replies_count: (session.doctor_replies_count || 0) + 1,
          last_doctor_reply_text: replyText,
          last_doctor_reply_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      return NextResponse.json({ ok: true, reply: replyEntry });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /escalations POST Error]:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Operation failed' }, { status: 500 });
  }
}
