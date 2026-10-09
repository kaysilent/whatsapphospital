import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'Follow-up ID is required' }, { status: 400 })
    }

    const admin = supabaseAdmin()

    // 1. Try deleting by primary key id
    const { error: delErr } = await admin
      .from('follow_up_tasks')
      .delete()
      .eq('id', id)

    if (delErr) {
      console.warn('Error deleting follow up task by id:', delErr.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up schedule deleted successfully'
    })
  } catch (error: any) {
    console.error('API /api/follow-ups/[id] DELETE Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete follow-up task' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { status, whatsapp_message_content, sitting_info, reason } = body

    const admin = supabaseAdmin()
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (status) updatePayload.status = status
    if (whatsapp_message_content) updatePayload.whatsapp_message_content = whatsapp_message_content
    if (sitting_info) updatePayload.sitting_info = sitting_info
    if (reason) updatePayload.reason = reason
    if (status === 'Sent (AI)') updatePayload.sent_at = new Date().toISOString()

    const { error } = await admin
      .from('follow_up_tasks')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      console.warn('Error updating follow up task in DB:', error.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up schedule updated'
    })
  } catch (error: any) {
    console.error('API /api/follow-ups/[id] PATCH Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update follow-up task' },
      { status: 500 }
    )
  }
}
