import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * DELETE /api/contacts/[id]
 *
 * Permanently deletes a patient and all their associated appointments,
 * follow-up tasks, notes, tags, and custom fields from the database.
 *
 * RESTRICTION: Only users with 'admin' (or higher) role are permitted.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Strict RBAC: Only Admin can delete patient records
    const ctx = await requireRole('admin');
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId || '').trim();

    const url = new URL(request.url);
    const phoneParam = url.searchParams.get('phone') || '';
    const phone = decodeURIComponent(phoneParam).trim();

    const db = ctx.supabase;
    const accountId = ctx.accountId;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 2. Cascade cleanup on appointments & follow up tasks in Supabase
    try {
      if (isUuid) {
        // Delete appointments by ID or matching phone
        if (phone) {
          await db
            .from('appointments')
            .delete()
            .or(`id.eq.${id},phone_number.eq.${phone}`)
            .eq('account_id', accountId);

          await db
            .from('follow_up_tasks')
            .delete()
            .or(`appointment_id.eq.${id},phone_number.eq.${phone}`)
            .eq('account_id', accountId);
        } else {
          await db
            .from('appointments')
            .delete()
            .eq('id', id)
            .eq('account_id', accountId);

          await db
            .from('follow_up_tasks')
            .delete()
            .eq('appointment_id', id)
            .eq('account_id', accountId);
        }

        // Clean relational tables for contacts
        await db.from('contact_tags').delete().eq('contact_id', id);
        await db.from('contact_notes').delete().eq('contact_id', id);
        await db.from('contact_custom_values').delete().eq('contact_id', id);

        // Delete from contacts table
        await db
          .from('contacts')
          .delete()
          .eq('id', id)
          .eq('account_id', accountId);
      } else {
        // Phone-based deletion or custom ID
        const targetPhone = phone || id;
        if (targetPhone) {
          await db
            .from('appointments')
            .delete()
            .eq('phone_number', targetPhone)
            .eq('account_id', accountId);

          await db
            .from('follow_up_tasks')
            .delete()
            .eq('phone_number', targetPhone)
            .eq('account_id', accountId);

          // Find contact rows with this phone to delete relations
          const { data: contactsFound } = await db
            .from('contacts')
            .select('id')
            .eq('phone', targetPhone)
            .eq('account_id', accountId);

          if (contactsFound && contactsFound.length > 0) {
            for (const c of contactsFound) {
              await db.from('contact_tags').delete().eq('contact_id', c.id);
              await db.from('contact_notes').delete().eq('contact_id', c.id);
              await db.from('contact_custom_values').delete().eq('contact_id', c.id);
            }
          }

          await db
            .from('contacts')
            .delete()
            .eq('phone', targetPhone)
            .eq('account_id', accountId);
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
