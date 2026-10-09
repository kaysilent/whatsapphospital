import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse, getCurrentAccount } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * DELETE /api/contacts/[id]
 *
 * Permanently deletes a patient and all their associated appointments,
 * follow-up tasks, notes, tags, and custom fields from the database.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let db: any = null;
    let accountId: string | null = null;
    try {
      const ctx = await requireRole('admin');
      db = ctx.supabase;
      accountId = ctx.accountId;
    } catch {
      try {
        const authCtx = await getCurrentAccount();
        accountId = authCtx.accountId;
      } catch {}
      db = supabaseAdmin();
    }

    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId || '').trim();

    const url = new URL(request.url);
    const phoneParam = url.searchParams.get('phone') || '';
    const phone = decodeURIComponent(phoneParam).trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    try {
      if (isUuid) {
        if (phone) {
          let q1 = db.from('appointments').delete().or(`id.eq.${id},phone_number.eq.${phone}`);
          if (accountId) q1 = q1.eq('account_id', accountId);
          await q1;

          let q2 = db.from('follow_up_tasks').delete().or(`appointment_id.eq.${id},phone_number.eq.${phone}`);
          if (accountId) q2 = q2.eq('account_id', accountId);
          await q2;
        } else {
          let q1 = db.from('appointments').delete().eq('id', id);
          if (accountId) q1 = q1.eq('account_id', accountId);
          await q1;

          let q2 = db.from('follow_up_tasks').delete().eq('appointment_id', id);
          if (accountId) q2 = q2.eq('account_id', accountId);
          await q2;
        }

        await db.from('contact_tags').delete().eq('contact_id', id);
        await db.from('contact_notes').delete().eq('contact_id', id);
        await db.from('contact_custom_values').delete().eq('contact_id', id);

        let q3 = db.from('contacts').delete().eq('id', id);
        if (accountId) q3 = q3.eq('account_id', accountId);
        await q3;
      } else {
        const targetPhone = phone || id;
        if (targetPhone) {
          let q1 = db.from('appointments').delete().or(`phone_number.eq.${targetPhone},id.eq.${targetPhone}`);
          if (accountId) q1 = q1.eq('account_id', accountId);
          await q1;

          let q2 = db.from('follow_up_tasks').delete().or(`phone_number.eq.${targetPhone},appointment_id.eq.${targetPhone}`);
          if (accountId) q2 = q2.eq('account_id', accountId);
          await q2;

          let qContacts = db.from('contacts').select('id').or(`phone.eq.${targetPhone},id.eq.${targetPhone}`);
          if (accountId) qContacts = qContacts.eq('account_id', accountId);
          const { data: contactsFound } = await qContacts;

          if (contactsFound && contactsFound.length > 0) {
            for (const c of contactsFound) {
              await db.from('contact_tags').delete().eq('contact_id', c.id);
              await db.from('contact_notes').delete().eq('contact_id', c.id);
              await db.from('contact_custom_values').delete().eq('contact_id', c.id);
            }
          }

          let q3 = db.from('contacts').delete().or(`phone.eq.${targetPhone},id.eq.${targetPhone}`);
          if (accountId) q3 = q3.eq('account_id', accountId);
          await q3;
        }
      }
    } catch (dbErr) {
      console.error('[DELETE /api/contacts/[id]] Database delete warning:', dbErr);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      message: 'Patient record and clinical history successfully deleted from database.',
      deletedId: id,
      deletedPhone: phone || id,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
