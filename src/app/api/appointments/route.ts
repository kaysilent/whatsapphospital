import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentAccount } from '@/lib/auth/account';
import { parseRequestedBookingDate, formatProperName, getClinicalCalendarInfo } from '@/lib/ai/generate-reply';
import { syncAppointmentToGoogleCalendar } from '@/lib/calendar/google-calendar';

export const runtime = 'nodejs';

/**
 * GET /api/appointments
 * Retrieves all real-time appointments and follow-up tasks from Supabase.
 */
export async function GET() {
  try {
    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {}

    const admin = supabaseAdmin();
    
    let apptQuery = admin
      .from('appointments')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (accountId) {
      apptQuery = apptQuery.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data: rawAppointments, error: apptError } = await apptQuery;

    let contactsQuery = admin.from('contacts').select('id, name, phone');
    if (accountId) {
      contactsQuery = contactsQuery.or(`account_id.eq.${accountId},account_id.is.null`);
    }
    const { data: rawContacts } = await contactsQuery;

    // Helper to get normalized 10-digit phone key
    const getPhoneKey = (phone?: string) => {
      const digits = (phone || '').replace(/\D/g, '');
      return digits.length >= 10 ? digits.slice(-10) : digits;
    };

    // Build phone-to-name lookup map from live contacts and appointments with valid names
    const phoneToName = new Map<string, string>();
    (rawContacts || []).forEach((c: any) => {
      const key = getPhoneKey(c.phone);
      if (key && c.name && c.name.toLowerCase() !== 'patient' && c.name.toLowerCase() !== 'valued patient' && c.name !== 'WhatsApp Patient') {
        phoneToName.set(key, c.name.trim());
      }
    });

    (rawAppointments || []).forEach((a: any) => {
      const key = getPhoneKey(a.phone_number);
      if (key && a.patient_name && a.patient_name.toLowerCase() !== 'patient' && a.patient_name.toLowerCase() !== 'valued patient') {
        if (!phoneToName.has(key)) {
          phoneToName.set(key, a.patient_name.trim());
        }
      }
    });

    let fuQuery = admin
      .from('follow_up_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountId) {
      fuQuery = fuQuery.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data: followUps } = await fuQuery;

    // Filter out dummy template placeholder numbers like {{WHATSAPP_NUMBER}}
    const validRawAppointments = (rawAppointments || []).filter((a: any) => {
      const p = (a.phone_number || '').toLowerCase();
      if (p.includes('{{') || p.includes('whatsapp_number') || p.includes('9876543210')) return false;
      return true;
    });

    const formattedAppointments = validRawAppointments.map((a: any) => {
      const phoneKey = getPhoneKey(a.phone_number);
      let resolvedName = a.patient_name;
      if ((!resolvedName || resolvedName.toLowerCase() === 'patient' || resolvedName.toLowerCase() === 'valued patient') && phoneKey) {
        if (phoneToName.has(phoneKey)) {
          resolvedName = phoneToName.get(phoneKey);
          // Asynchronously update appointment record in database to repair the name permanently
          if (a.id) {
            admin.from('appointments').update({ patient_name: resolvedName }).eq('id', a.id).then(() => {}).catch(() => {});
          }
        }
      }
      resolvedName = formatProperName(resolvedName || 'Valued Patient');

      const cleanDate = (a.date || '').replace(/\D/g, '').slice(0, 8);
      const randomSuffix = (a.id || '').replace(/\D/g, '').slice(-4) || '1001';
      const bookingId = a.booking_id || (a.notes?.match(/LF-\d{8}-\d{4}/) ? a.notes.match(/LF-\d{8}-\d{4}/)[0] : (a.id?.startsWith('LF-') ? a.id : `LF-${cleanDate || '20261007'}-${randomSuffix}`));
      const derivedSitting = a.sitting || (a.total_sittings > 1 ? `Sitting ${a.current_sitting || 1} of ${a.total_sittings}` : 'Consultation');
      return {
        ...a,
        patient_name: resolvedName,
        booking_id: bookingId,
        sitting: derivedSitting
      };
    });

    return NextResponse.json({
      ok: true,
      appointments: formattedAppointments,
      followUps: followUps || []
    });
  } catch (error: any) {
    console.error('[API /appointments GET Error]:', error);
    return NextResponse.json({
      ok: false,
      appointments: [],
      followUps: [],
      error: error?.message || 'Failed to fetch appointments'
    }, { status: 500 });
  }
}

/**
 * POST /api/appointments
 * Creates an appointment in Supabase and generates the corresponding follow-up task.
 */
export async function POST(request: Request) {
  try {
    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {}

    const body = await request.json().catch(() => ({}));
    const {
      patient_name,
      phone_number,
      date,
      time,
      department = 'Clinical Consultation',
      doctor = 'Dr. Mrinalini',
      status = 'Confirmed (Staff)',
      current_sitting = 1,
      total_sittings = 1,
      sitting_interval = '4-6 weeks',
      sitting_interval_days = 28,
      sitting,
      notes = ''
    } = body;

    if (!patient_name || !phone_number || !date || !time) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required appointment fields (patient_name, phone_number, date, time)'
      }, { status: 400 });
    }

    const admin = supabaseAdmin();
    // Clinic calendar (IST) dates, not UTC.
    const { todayStr: todayIso, tomorrowStr: tomorrowIso } = getClinicalCalendarInfo();
    const safeDate = parseRequestedBookingDate(date, todayIso, tomorrowIso);

    const validStatuses = ['Confirmed (AI)', 'Confirmed (Staff)', 'Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'];
    const safeStatus = validStatuses.includes(status) ? status : (status === 'Confirmed' ? 'Confirmed (Staff)' : 'Confirmed (Staff)');

    const computedSitting = sitting || (total_sittings > 1 ? `Sitting ${current_sitting} of ${total_sittings}` : 'Consultation');
    const cleanDate = (safeDate || '').replace(/\D/g, '').slice(0, 8);
    const bookingId = body.booking_id || `LF-${cleanDate || '20261007'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalNotes = notes ? (notes.includes('Booking ID') ? notes : `${notes} [Booking ID: ${bookingId}]`) : `[Booking ID: ${bookingId}]`;

    const apptPayload = {
      account_id: accountId,
      patient_name,
      phone_number,
      date: safeDate,
      time,
      department,
      doctor,
      status: safeStatus,
      current_sitting,
      total_sittings,
      sitting_interval,
      sitting_interval_days,
      notes: finalNotes
    };

    let appt: any = null;
    const { data: insertedData, error: insertError } = await admin
      .from('appointments')
      .insert(apptPayload)
      .select()
      .single();

    if (insertError) {
      console.warn('[API /appointments Insert Warning]:', insertError.message);
      if (insertError.code === '23503' || insertError.message?.includes('foreign key')) {
        const { data: retryData } = await admin
          .from('appointments')
          .insert({ ...apptPayload, account_id: null })
          .select()
          .single();
        appt = retryData;
      }
    } else {
      appt = insertedData;
    }

    // Automatically create a post-care follow up task
    const fuDueDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const fuPayload = {
      account_id: accountId,
      appointment_id: appt?.id || null,
      patient_name,
      phone_number,
      department,
      sitting_info: total_sittings > 1 ? `After Sitting ${current_sitting} of ${total_sittings}` : 'Post-Consultation',
      reason: 'Post-consultation treatment care & recovery review',
      type: 'post_care',
      due: 'In 2 days',
      due_date: fuDueDate,
      priority: 'High',
      status: 'Pending',
      created_by: 'Staff',
      whatsapp_message_content: `Hello ${patient_name}, Dr. Mrinalini at La Fleur Clinic hopes you are doing well after your ${department} appointment. Please let us know if you have any questions.`
    };

    let fuTask: any = null;
    const { data: fuData, error: fuErr } = await admin
      .from('follow_up_tasks')
      .insert(fuPayload)
      .select()
      .single();

    if (fuErr && fuErr.code === '23503') {
      const { data: retryFu } = await admin
        .from('follow_up_tasks')
        .insert({ ...fuPayload, account_id: null, appointment_id: null })
        .select()
        .single();
      fuTask = retryFu;
    } else {
      fuTask = fuData;
    }

    // Automatically sync appointment with Google Calendar
    syncAppointmentToGoogleCalendar(appt || apptPayload, 'create').catch((gErr) => {
      console.warn('[Appointments POST GCal Sync Notice]:', gErr?.message);
    });

    return NextResponse.json({
      ok: true,
      appointment: appt || body,
      followUp: fuTask || null
    });
  } catch (error: any) {
    console.error('[API /appointments POST Error]:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Failed to create appointment'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/appointments
 * Updates an appointment record (status, date/time, sitting, etc.).
 */
export async function PATCH(request: Request) {
  try {
    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {}

    const body = await request.json().catch(() => ({}));
    const { id, ...rawUpdates } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Appointment id is required' }, { status: 400 });
    }

    const updates = { ...rawUpdates };
    delete updates.sitting;
    if (updates.status === 'Confirmed') {
      updates.status = 'Confirmed (Staff)';
    }

    const admin = supabaseAdmin();
    let query = admin
      .from('appointments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.warn('[API /appointments PATCH Warning]:', error.message);
    }

    const resolvedAppt = data || { id, ...updates };

    // Automatically sync appointment update with Google Calendar
    syncAppointmentToGoogleCalendar(resolvedAppt, 'update').catch((gErr) => {
      console.warn('[Appointments PATCH GCal Sync Notice]:', gErr?.message);
    });

    return NextResponse.json({
      ok: true,
      appointment: resolvedAppt
    });
  } catch (error: any) {
    console.error('[API /appointments PATCH Error]:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Failed to update appointment'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/appointments
 * Deletes an appointment by id.
 */
export async function DELETE(request: Request) {
  try {
    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {}

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Appointment id is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    let query = admin.from('appointments').delete().eq('id', id);
    if (accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    await query;

    // Automatically sync appointment deletion with Google Calendar
    syncAppointmentToGoogleCalendar({ id, patient_name: 'Patient', date: '', time: '' }, 'delete').catch((gErr) => {
      console.warn('[Appointments DELETE GCal Sync Notice]:', gErr?.message);
    });

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error: any) {
    console.error('[API /appointments DELETE Error]:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Failed to delete appointment'
    }, { status: 500 });
  }
}
