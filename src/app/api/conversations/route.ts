import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const queryPhone = searchParams.get('phone')
    const queryName = searchParams.get('name')

    let accountId: string | null = null
    let userId: string | null = null

    try {
      const ctx = await getCurrentAccount()
      accountId = ctx.accountId
      userId = ctx.userId
    } catch {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
      }
    }

    // If queryPhone is provided, find or create conversation for this phone
    if (queryPhone && accountId) {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase/admin')
        const resolved = await resolveConversationByPhone(
          supabaseAdmin(),
          accountId,
          queryPhone,
          queryName || null,
        )
        // Return resolved conversation info
        return NextResponse.json({
          success: true,
          resolvedConversationId: resolved.conversationId,
          contactId: resolved.contactId,
        })
      } catch (resolveErr: any) {
        console.warn('Could not resolve conversation by phone:', resolveErr?.message)
      }
    }

    // Query conversations with contacts
    let query = supabase
      .from('conversations')
      .select(`
        id,
        account_id,
        user_id,
        contact_id,
        status,
        unread_count,
        last_message_at,
        created_at,
        updated_at,
        contact:contacts(id, name, phone, avatar_url, updated_at)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    let { data: convRows, error: convError } = await query

    if ((!convRows || convRows.length === 0) && !convError) {
      const { supabaseAdmin } = await import('@/lib/supabase/admin')
      const adminDb = supabaseAdmin()
      let adminQuery = adminDb
        .from('conversations')
        .select(`
          id,
          account_id,
          user_id,
          contact_id,
          status,
          unread_count,
          last_message_at,
          created_at,
          updated_at,
          contact:contacts(id, name, phone, avatar_url, updated_at)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (accountId && accountId !== '00000000-0000-0000-0000-000000000002') {
        adminQuery = adminQuery.eq('account_id', accountId)
      }
      const { data: fallbackRows } = await adminQuery
      if (fallbackRows && fallbackRows.length > 0) {
        convRows = fallbackRows
      }
    }

    if (convError) {
      console.error('Error fetching conversations:', convError)
      return NextResponse.json(
        { success: false, error: convError.message, conversations: [] },
        { status: 500 },
      )
    }

    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const dbForMsgs = supabaseAdmin()

    // Fetch latest message for each conversation
    const conversations = await Promise.all(
      (convRows || []).map(async (conv: any) => {
        const contact = Array.isArray(conv.contact) ? conv.contact[0] : conv.contact
        
        // Fetch last message
        const { data: lastMsgs } = await dbForMsgs
          .from('messages')
          .select('id, content_text, sender_type, status, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMsg = lastMsgs?.[0]

        return {
          id: conv.id,
          contactId: conv.contact_id,
          patientName: contact?.name || contact?.phone || 'Unknown Patient',
          patientPhone: contact?.phone || 'No phone',
          patientAvatar: contact?.avatar_url || null,
          department: 'General OPD',
          lastMessage: lastMsg?.content_text || 'No messages yet',
          lastMessageTime: lastMsg?.created_at
            ? new Date(lastMsg.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
            : (conv.created_at ? new Date(conv.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Just now'),
          unreadCount: conv.unread_count || 0,
          aiActive: true,
          isEmergency: (lastMsg?.content_text || '').toLowerCase().includes('emergency') || 
                       (lastMsg?.content_text || '').toLowerCase().includes('pain') ||
                       (lastMsg?.content_text || '').toLowerCase().includes('urgent'),
          status: conv.status || 'open',
          lastMessageSender: lastMsg?.sender_type || 'system',
          updatedAt: conv.last_message_at || conv.updated_at || conv.created_at,
        }
      })
    )

    return NextResponse.json({
      success: true,
      conversations,
    })
  } catch (error) {
    console.error('Error in conversations GET:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        conversations: [],
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { phone, name } = body

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    let cleanPhone = phone.toString().replace(/\D/g, '')
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone
    }

    let accountId: string | null = null
    let userId: string | null = null

    try {
      const ctx = await getCurrentAccount()
      accountId = ctx.accountId
      userId = ctx.userId
    } catch {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        const { supabaseAdmin } = await import('@/lib/supabase/admin')
        const { data: prof } = await supabaseAdmin()
          .from('profiles')
          .select('account_id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (prof?.account_id) accountId = prof.account_id
      }
    }

    if (!accountId) {
      accountId = '56702d02-aecf-489a-a9cf-632b068f3d29'
    }

    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const adminDb = supabaseAdmin()

    if (!userId) {
      const { data: acc } = await adminDb
        .from('accounts')
        .select('owner_user_id')
        .eq('id', accountId)
        .maybeSingle()
      userId = acc?.owner_user_id || '7177280f-a0ad-4958-8588-5f80a8575007'
    }

    // 1. Find or create contact
    let contactId: string | null = null
    const last10 = cleanPhone.slice(-10)

    const { data: existingContact } = await adminDb
      .from('contacts')
      .select('id, name')
      .eq('account_id', accountId)
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.ilike.%${last10}%`)
      .limit(1)
      .maybeSingle()

    if (existingContact) {
      contactId = existingContact.id
      if (name && name.trim() && name !== existingContact.name && name !== 'New Patient') {
        await adminDb
          .from('contacts')
          .update({ name: name.trim(), updated_at: new Date().toISOString() })
          .eq('id', existingContact.id)
      }
    } else {
      const { data: newContact, error: createContactErr } = await adminDb
        .from('contacts')
        .insert({
          account_id: accountId,
          user_id: userId,
          phone: `+${cleanPhone}`,
          name: name?.trim() || `Patient (+${cleanPhone})`
        })
        .select('id')
        .single()

      if (createContactErr) {
        console.warn('Contact insert race or error:', createContactErr)
        const { data: racedContact } = await adminDb
          .from('contacts')
          .select('id')
          .eq('account_id', accountId)
          .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.ilike.%${last10}%`)
          .limit(1)
          .maybeSingle()
        if (racedContact) {
          contactId = racedContact.id
        } else {
          return NextResponse.json({ error: 'Failed to create patient contact' }, { status: 500 })
        }
      } else {
        contactId = newContact.id
      }
    }

    // 2. Find or create conversation
    let conversationId: string | null = null
    const { data: existingConv } = await adminDb
      .from('conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true })
      .limit(1)

    if (existingConv && existingConv.length > 0) {
      conversationId = existingConv[0].id
    } else {
      const { data: newConv, error: createConvErr } = await adminDb
        .from('conversations')
        .insert({
          account_id: accountId,
          user_id: userId,
          contact_id: contactId,
          status: 'open',
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (createConvErr) {
        console.warn('Conversation insert race or error:', createConvErr)
        const { data: racedConv } = await adminDb
          .from('conversations')
          .select('id')
          .eq('account_id', accountId)
          .eq('contact_id', contactId)
          .order('created_at', { ascending: true })
          .limit(1)
        if (racedConv && racedConv.length > 0) {
          conversationId = racedConv[0].id
        } else {
          return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
        }
      } else {
        conversationId = newConv.id
      }
    }

    return NextResponse.json({
      success: true,
      conversationId,
      contactId,
    })
  } catch (error: any) {
    console.error('Error opening conversation:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to open conversation' },
      { status: 500 }
    )
  }
}
