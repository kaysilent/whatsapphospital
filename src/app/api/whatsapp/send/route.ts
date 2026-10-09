import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  sendMessageToConversation,
  validateSendMessageParams,
  SendMessageError,
} from '@/lib/whatsapp/send-message'
import { sanitizePhoneForMeta } from '@/lib/whatsapp/phone-utils'

// The dashboard's outbound-send endpoint. It owns auth, per-user rate
// limiting, and the two ways the UI targets a thread — an existing
// `conversation_id` (inbox) or a `contact_id` (Contact detail →
// find-or-create the conversation). The actual Meta plumbing (validate
// → send → persist → pause flows) lives in the shared
// `sendMessageToConversation` core, which the public `/api/v1/messages`
// endpoint reuses. This route is a thin adapter: resolve the
// conversation, delegate, then map `SendMessageError` back onto the
// dashboard's internal `{ error }` shape.
export async function POST(request: Request) {
  try {
    // Requires the 'agent' role, matching both `canSendMessages` and the
    // `messages_modify` RLS policy (migration 017).
    //
    // Resolving `account_id` off the profile — which any 'viewer' has —
    // was previously the only gate. RLS did block the message INSERT, but
    // the send core calls Meta BEFORE it persists, so a viewer's request
    // still delivered a real WhatsApp message to the customer and merely
    // failed to record it (surfacing as "sent to Meta but failed to save
    // to DB"). RLS can't un-send that, so the role check belongs here.
    const { supabase, accountId, userId } = await requireRole('agent')

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${userId}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      // `conversation_id` targets an existing thread (inbox). `contact_id`
      // or `phone` lets a caller initiate from a contact that may have no conversation
      // yet — we find-or-create one below.
      conversation_id: conversationIdInput,
      contact_id,
      phone,
      name,
      message_type,
      content_text,
      media_url,
      filename,
      template_name,
      template_language,
      template_params,
      template_message_params,
      interactive_payload,
      reply_to_message_id,
    } = body

    if ((!conversationIdInput && !contact_id && !phone) || !message_type) {
      return NextResponse.json(
        {
          error:
            'Either conversation_id, contact_id, or phone, plus message_type, are required',
        },
        { status: 400 }
      )
    }

    // Validate the message shape up front — before the contact_id path
    // finds-or-creates a conversation — so an invalid payload 400s
    // without leaving an orphan empty conversation behind.
    try {
      validateSendMessageParams({
        messageType: message_type,
        contentText: content_text,
        mediaUrl: media_url,
        templateName: template_name,
        interactivePayload: interactive_payload,
      })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    // Resolve the target conversation.
    let conversationId: string | null = null

    if (conversationIdInput) {
      // 1. Try scoped user client
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationIdInput)
        .eq('account_id', accountId)
        .maybeSingle()

      if (data) {
        conversationId = data.id
      } else {
        // 2. Admin client fallback for resilience
        const { supabaseAdmin } = await import('@/lib/supabase/admin')
        const { data: adminConv } = await supabaseAdmin()
          .from('conversations')
          .select('id')
          .eq('id', conversationIdInput)
          .maybeSingle()
        if (adminConv) {
          conversationId = adminConv.id
        }
      }
    }

    if (!conversationId && contact_id) {
      const { data: contactRow, error: contactErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('id', contact_id)
        .eq('account_id', accountId)
        .maybeSingle()

      if (contactErr || !contactRow) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        )
      }

      const resolved = await findOrCreateConversation(
        supabase,
        accountId,
        userId,
        contact_id
      )
      if (!resolved) {
        return NextResponse.json(
          { error: 'Failed to open a conversation for this contact' },
          { status: 500 }
        )
      }
      conversationId = resolved
    }

    // If still not resolved and a raw phone is provided (e.g. from follow-up reminder modal or inbox header)
    if (!conversationId && phone && !contact_id) {
      const { supabaseAdmin } = await import('@/lib/supabase/admin')
      const { findExistingContact } = await import('@/lib/contacts/dedupe')
      const adminDb = supabaseAdmin()
      const cleanPhone = sanitizePhoneForMeta(phone)
      const last10 = cleanPhone.slice(-10)
      let resolvedContactId: string | null = null

      // 1. First, check if a conversation already exists by phone directly
      try {
        const { data: directPhoneConv } = await adminDb
          .from('conversations')
          .select('id')
          .or(`contact_phone.eq.${cleanPhone},contact_phone.eq.+${cleanPhone},contact_phone.ilike.%${last10}%`)
          .limit(1)
          .maybeSingle()
        if (directPhoneConv) {
          conversationId = directPhoneConv.id
        }
      } catch {}

      // 2. Try to find existing contact by phone
      if (!conversationId) {
        try {
          const existingContact = await findExistingContact(adminDb, accountId, phone)
          if (existingContact) {
            resolvedContactId = existingContact.id
          } else {
            const { data: directContact } = await adminDb
              .from('contacts')
              .select('id')
              .eq('account_id', accountId)
              .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.ilike.%${last10}%`)
              .limit(1)
              .maybeSingle()

            if (directContact) {
              resolvedContactId = directContact.id
            } else {
              const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`
              const { data: newContact } = await adminDb
                .from('contacts')
                .insert({
                  account_id: accountId,
                  user_id: userId,
                  phone: formattedPhone,
                  name: name || 'WhatsApp Patient',
                })
                .select('id')
                .maybeSingle()
              if (newContact) resolvedContactId = newContact.id
            }
          }
        } catch {}

        if (resolvedContactId) {
          conversationId = await findOrCreateConversation(
            supabase,
            accountId,
            userId,
            resolvedContactId,
            cleanPhone
          )
        }
      }

      // 3. Fallback: If still no conversationId, use phone directly as synthetic conversation ID
      if (!conversationId) {
        conversationId = cleanPhone
      }
    }

    // Delegate to the shared send core (validates, sends to Meta with
    // phone-variant retry, persists, pauses active flow runs). Its
    // `SendMessageError` carries a machine code + HTTP status; the
    // dashboard maps it to the internal `{ error }` shape.
    // Auto-fetch the language for the dynamically selected template from our local sync
    let finalTemplateName = template_name
    let finalLanguage = template_language || 'en_US'
    if (message_type === 'template' && template_name) {
      // Meta requires exact (usually lowercase) template names.
      finalTemplateName = template_name.toLowerCase()

      const { data: tmpl } = await supabase
        .from('message_templates')
        .select('language')
        .eq('account_id', accountId)
        .eq('name', finalTemplateName)
        .limit(1)
        .maybeSingle()

      if (tmpl && 'language' in tmpl && tmpl.language) {
        finalLanguage = tmpl.language as string
      }
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation could not be found or created for this request' },
        { status: 400 }
      )
    }

    try {
      const result = await sendMessageToConversation(supabase, accountId, {
        conversationId,
        messageType: message_type,
        contentText: content_text,
        mediaUrl: media_url,
        filename,
        templateName: finalTemplateName,
        templateLanguage: finalLanguage,
        templateParams: template_params,
        templateMessageParams: template_message_params,
        interactivePayload: interactive_payload,
        replyToMessageId: reply_to_message_id,
      })

      return NextResponse.json({
        success: true,
        message_id: result.messageId,
        whatsapp_message_id: result.whatsappMessageId,
        conversation_id: conversationId,
      })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.status }
        )
      }
      throw err
    }
  } catch (error) {
    // requireRole throws Unauthorized/Forbidden; toErrorResponse maps
    // those to 401/403 and collapses anything else to a generic 500.
    console.error('Error in WhatsApp send POST:', error)
    return toErrorResponse(error)
  }
}

type SendSupabase = Awaited<ReturnType<typeof createClient>>

/**
 * Return the contact's conversation id in this account, creating one if
 * it doesn't exist yet. Mirrors the webhook's find-or-create so an
 * inbound-then-outbound (or outbound-first) sequence converges on a single
 * thread per contact. Runs under the caller's RLS — the conversations_insert
 * policy requires account agent membership, which the caller already is.
 */
async function findOrCreateConversation(
  supabase: SendSupabase,
  accountId: string,
  userId: string,
  contactId: string,
  contactPhone?: string,
): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('contact_id', contactId)
      .maybeSingle()

    if (existing) return existing.id

    const insertPayload: Record<string, any> = {
      account_id: accountId,
      user_id: userId,
      contact_id: contactId,
    }
    if (contactPhone) insertPayload.contact_phone = contactPhone

    const { data: created, error } = await supabase
      .from('conversations')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (created) return created.id
    if (error) {
      console.warn('RLS conversation creation error, falling back to admin:', error.message)
    }
  } catch {}

  // Fallback to service-role admin client
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const admin = supabaseAdmin()
    const { data: existingAdmin } = await admin
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .limit(1)
      .maybeSingle()

    if (existingAdmin) return existingAdmin.id

    const insertPayload: Record<string, any> = {
      account_id: accountId,
      user_id: userId,
      contact_id: contactId,
      status: 'open',
    }
    if (contactPhone) insertPayload.contact_phone = contactPhone

    const { data: createdAdmin, error: adminErr } = await admin
      .from('conversations')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (createdAdmin) return createdAdmin.id
    if (adminErr) {
      console.error('Admin error creating conversation for contact send:', adminErr.message)
    }
  } catch (adminErr: any) {
    console.error('Admin findOrCreateConversation error:', adminErr?.message)
  }

  return null
}
