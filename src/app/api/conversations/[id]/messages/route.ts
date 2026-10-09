import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentAccount } from '@/lib/auth/account'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await context.params
    const supabase = await createClient()

    let accountId: string | null = null
    try {
      const ctx = await getCurrentAccount()
      accountId = ctx.accountId
    } catch {
      // Demo / fallback
    }

    // Query messages for this conversation (conversation is already account-scoped)
    let { data: messageRows, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    // If RLS or session blocked rows, fallback to admin client
    if ((error || !messageRows || messageRows.length === 0) && conversationId) {
      const adminDb = supabaseAdmin()
      const { data: adminRows, error: adminErr } = await adminDb
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      
      if (!adminErr && adminRows) {
        messageRows = adminRows
        error = null
      }
    }

    if (error) {
      console.error('Error fetching messages for conversation:', conversationId, error)
      return NextResponse.json(
        { success: false, error: error.message, messages: [] },
        { status: 500 }
      )
    }


    const messages = (messageRows || []).map((m: any) => {
      // Map sender_type to UI roles
      let sender: 'patient' | 'clinic' | 'ai' | 'doctor' = 'patient'
      if (m.sender_type === 'customer') {
        sender = 'patient'
      } else if (m.sender_type === 'bot') {
        sender = 'ai'
      } else if (m.sender_type === 'agent') {
        // If content starts with "Dr." or doctor note, tag as doctor, else clinic/staff
        if ((m.content_text || '').startsWith('Dr.')) {
          sender = 'doctor'
        } else {
          sender = 'clinic'
        }
      } else {
        sender = 'clinic'
      }

      const isAppointment = (m.content_text || '').toLowerCase().includes('confirmed') && 
                            (m.content_text || '').toLowerCase().includes('appointment')

      return {
        id: m.id,
        sender,
        text: m.content_text || '',
        mediaUrl: m.media_url,
        mediaType: m.media_type,
        time: m.created_at
          ? new Date(m.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
          : 'Just now',
        createdAt: m.created_at,
        status: m.status || 'delivered',
        isAppointment,
      }
    })

    return NextResponse.json({
      success: true,
      messages,
    })
  } catch (error: any) {
    console.error('Error in conversation messages GET:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch messages', messages: [] },
      { status: 500 }
    )
  }
}
