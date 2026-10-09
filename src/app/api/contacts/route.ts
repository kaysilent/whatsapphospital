import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentAccount } from '@/lib/auth/account';

export const runtime = 'nodejs';

/**
 * GET /api/contacts
 * Returns live contacts from Supabase contacts table.
 */
export async function GET(request: Request) {
  try {
    let accountId: string | null = null;
    try {
      const authCtx = await getCurrentAccount();
      accountId = authCtx.accountId;
    } catch {}

    const admin = supabaseAdmin();
    let query = admin
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data: rawContacts, error } = await query;
    let contactsList: any[] = rawContacts || [];

    // Also fallback without tenancy if zero results
    if (contactsList.length === 0 && accountId) {
      const { data: fallbackContacts } = await admin
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (fallbackContacts && fallbackContacts.length > 0) {
        contactsList = fallbackContacts;
      }
    }

    // Helper to clean phone
    const cleanPhone = (p?: string) => {
      if (!p) return '';
      let s = String(p).replace(/[^\d+]/g, '');
      if (s.startsWith('+')) s = s.slice(1);
      s = s.replace(/^0+/, '');
      if (/^[6-9]\d{9}$/.test(s)) s = '91' + s;
      return s;
    };

    const existingPhones = new Set<string>();
    contactsList.forEach(c => {
      const p = cleanPhone(c.phone);
      if (p) existingPhones.add(p);
      const digits10 = (c.phone || '').replace(/\D/g, '').slice(-10);
      if (digits10) existingPhones.add(digits10);
    });

    // Also fetch appointments to discover patients
    try {
      let apptQuery = admin
        .from('appointments')
        .select('*')
        .order('date', { ascending: false });
      if (accountId) {
        apptQuery = apptQuery.or(`account_id.eq.${accountId},account_id.is.null`);
      }
      const { data: appointments } = await apptQuery;
      
      const missingAppointments: any[] = [];
      for (const appt of appointments || []) {
        const pClean = cleanPhone(appt.phone_number);
        const digits10 = (appt.phone_number || '').replace(/\D/g, '').slice(-10);
        
        // Skip dummy placeholders
        if (!pClean || pClean.length < 8 || pClean.includes('9876543210')) continue;

        if (!existingPhones.has(pClean) && (!digits10 || !existingPhones.has(digits10))) {
          existingPhones.add(pClean);
          if (digits10) existingPhones.add(digits10);

          const syntheticContact = {
            id: appt.id || `appt_${pClean}`,
            account_id: appt.account_id || accountId,
            name: appt.patient_name || 'Valued Patient',
            phone: appt.phone_number,
            department: appt.department || 'Clinical Consultation',
            treatment: appt.department,
            doctor: appt.doctor || 'Dr. Mrinalini',
            status: appt.status || 'Confirmed',
            notes: appt.notes || `Patient booking (${appt.department})`,
            created_at: appt.created_at || new Date().toISOString()
          };

          contactsList.push(syntheticContact);
          missingAppointments.push({
            account_id: appt.account_id || accountId,
            user_id: 'system',
            name: appt.patient_name || 'Valued Patient',
            phone: appt.phone_number,
            notes: appt.notes || `Patient with appointment (${appt.department || 'Consultation'})`
          });
        }
      }

      // Asynchronously upsert missing patients to contacts table
      if (missingAppointments.length > 0) {
        Promise.all(
          missingAppointments.map(item =>
            admin.from('contacts').insert(item).then(() => {}).catch(() => {})
          )
        ).catch(() => {});
      }
    } catch (apptErr) {
      console.warn('[API /contacts Appointment merge notice]:', apptErr);
    }

    return NextResponse.json({
      ok: true,
      contacts: contactsList
    });
  } catch (error: any) {
    console.error('[API /contacts GET Error]:', error);
    return NextResponse.json({
      ok: false,
      contacts: [],
      error: error?.message || 'Failed to fetch contacts'
    }, { status: 500 });
  }
}

/**
 * POST /api/contacts
 * Creates a new contact in Supabase contacts table.
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

    const body = await request.json().catch(() => ({}));
    const { name, phone, email, notes } = body;

    if (!name || !phone) {
      return NextResponse.json({ ok: false, error: 'Name and phone are required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const payload = {
      account_id: accountId,
      user_id: userId || 'system',
      name,
      phone,
      email: email || null,
      notes: notes || null
    };

    let contact: any = null;
    const { data, error } = await admin
      .from('contacts')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('[API /contacts POST Warning]:', error.message);
      if (error.code === '23503' || error.message?.includes('foreign key')) {
        const { data: retryData } = await admin
          .from('contacts')
          .insert({ ...payload, account_id: null, user_id: 'system' })
          .select()
          .single();
        contact = retryData;
      }
    } else {
      contact = data;
    }

    return NextResponse.json({
      ok: true,
      contact: contact || payload
    });
  } catch (error: any) {
    console.error('[API /contacts POST Error]:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Failed to create contact'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/contacts
 * Deletes a contact by id or phone query param.
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
    const phone = searchParams.get('phone');

    if (!id && !phone) {
      return NextResponse.json({ ok: false, error: 'Contact id or phone is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    if (id) {
      let query = admin.from('contacts').delete().eq('id', id);
      if (accountId) query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      await query;
    }
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      let query = admin.from('contacts').delete().ilike('phone', `%${cleanPhone.slice(-10)}%`);
      if (accountId) query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      await query;
    }

    return NextResponse.json({ ok: true, deleted: id || phone });
  } catch (error: any) {
    console.error('[API /contacts DELETE Error]:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Failed to delete contact'
    }, { status: 500 });
  }
}
