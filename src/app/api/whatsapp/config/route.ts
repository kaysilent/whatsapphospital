import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  requireRole,
  getCurrentAccount,
  UnauthorizedError,
  ForbiddenError,
  toErrorResponse,
} from '@/lib/auth/account'
import {
  registerPhoneNumber,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

/**
 * Resolve the caller's account_id from their profile. Inlined here
 * (rather than going through `@/lib/auth/account.getCurrentAccount`)
 * because the GET handler wants to return shaped 200s for every
 * non-auth failure mode, not throw — keeping the helper minimal lets
 * the existing response branches stay as-is.
 *
 * Returns null if the user has no profile or no account; callers
 * should treat that the same as "not connected".
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  try {
    const admin = supabaseAdmin()
    const { data } = await admin
      .from('profiles')
      .select('account_id')
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle()
    if (data?.account_id) return data.account_id as string

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (userProfile?.account_id) return userProfile.account_id as string
  } catch (err) {
    console.warn('[resolveAccountId] error:', err)
  }

  return null
}

// Lazy-initialised service-role client. We need it to detect a
// phone_number_id already claimed by a *different* user — under RLS,
// the user's own session can't see other users' rows, so the conflict
// would be invisible without the service role.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

// In-memory runtime cache for seamless single-tenant / server persistence
let runtimeWhatsAppConfig: any = null

/**
 * GET /api/whatsapp/config
 *
 * Used by the "Test API Connection" button and by the page to check
 * whether the saved config is healthy. Returns 200 in all non-auth cases
 * so the UI can render an appropriate message rather than show a 500.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    let accountId: string | null = null
    try {
      const authCtx = await getCurrentAccount()
      accountId = authCtx.accountId
    } catch {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        accountId = await resolveAccountId(supabase, user.id)
      }
    }

    // 1. Try finding by accountId if resolved
    let config: any = null
    if (accountId) {
      const { data } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('id, phone_number_id, waba_id, access_token, status, registered_at, subscribed_apps_at, last_registration_error')
        .eq('account_id', accountId)
        .maybeSingle()
      config = data
    }

    // 2. If not found by accountId, find the most recently saved whatsapp_config row (for single-tenant / clinic deployment)
    if (!config) {
      const { data } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('id, phone_number_id, waba_id, access_token, status, registered_at, subscribed_apps_at, last_registration_error')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      config = data
    }

    // 3. If still not found, check in-memory runtime cache
    if (!config && runtimeWhatsAppConfig) {
      config = runtimeWhatsAppConfig
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          config: null,
          message: 'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.',
        },
        { status: 200 }
      )
    }

    const safeConfig = {
      id: config.id,
      phone_number_id: config.phone_number_id,
      waba_id: config.waba_id,
      status: config.status || 'connected',
      registered_at: config.registered_at,
      subscribed_apps_at: config.subscribed_apps_at,
      last_registration_error: config.last_registration_error,
      has_access_token: !!config.access_token,
    }

    // Try to decrypt the stored token with the current ENCRYPTION_KEY.
    let accessToken: string
    try {
      accessToken = decrypt(config.access_token)
    } catch (err) {
      console.error('[whatsapp/config GET] Token decryption failed:', err)
      return NextResponse.json(
        {
          connected: false,
          reason: 'token_corrupted',
          needs_reset: true,
          config: safeConfig,
          message:
            'The stored access token cannot be decrypted with the current ENCRYPTION_KEY. Click "Reset Configuration" below, then re-save.',
        },
        { status: 200 }
      )
    }

    // Validate credentials against Meta
    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      })
      return NextResponse.json({
        connected: true,
        config: safeConfig,
        phone_info: phoneInfo
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('[whatsapp/config GET] Meta API verification failed:', message)
      return NextResponse.json(
        {
          connected: false,
          reason: 'meta_api_error',
          config: safeConfig,
          message: `Meta API rejected the credentials: ${message}`,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error)
    return NextResponse.json(
      {
        connected: false,
        reason: 'server_error',
        config: null,
        message: error instanceof Error ? error.message : 'Internal server error while checking WhatsApp configuration',
      },
      { status: 200 }
    )
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Saves or updates the WhatsApp config for the authenticated user.
 * Verifies credentials with Meta first, then encrypts and stores.
 */
export async function POST(request: Request) {
  try {
    let accountId: string | null = null
    let userId: string = 'system'

    try {
      const authCtx = await getCurrentAccount()
      accountId = authCtx.accountId
      userId = authCtx.userId
    } catch {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        accountId = await resolveAccountId(supabase, user.id)
      }
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Could not resolve your account session. Please log in again.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { phone_number_id, waba_id, access_token, verify_token, pin } = body

    if (!phone_number_id || !phone_number_id.trim()) {
      return NextResponse.json(
        { error: 'Phone Number ID is required.' },
        { status: 400 }
      )
    }

    // Resolve the token to use (either newly entered or existing encrypted token in DB)
    const { data: existing } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('id, registered_at, phone_number_id, access_token')
      .eq('account_id', accountId)
      .maybeSingle()

    let effectiveToken: string | null = null

    if (access_token && typeof access_token === 'string' && access_token.trim() && access_token !== '••••••••••••••••') {
      effectiveToken = access_token.trim()
    } else if (existing?.access_token) {
      try {
        effectiveToken = decrypt(existing.access_token)
      } catch (err) {
        console.warn('Could not decrypt existing token:', err)
      }
    }

    if (!effectiveToken) {
      return NextResponse.json(
        { error: 'An Access Token is required to connect WhatsApp.' },
        { status: 400 }
      )
    }

    // Verify credentials with Meta BEFORE saving
    let phoneInfo
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id.trim(),
        accessToken: effectiveToken,
      })
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Unknown Meta API error'
      if (message.includes('expired') || message.includes('OAuthException') || message.includes('Code 190')) {
        message = 'The Meta Access Token has expired or is invalid. Please generate a fresh Permanent System User Token in Meta Business Suite.'
      } else if (message.includes('100') || message.includes('Param error')) {
        message = `Meta rejected Phone Number ID "${phone_number_id}". Please check your Phone Number ID in Meta Developer Portal.`
      } else if (message.includes('200') || message.includes('permission')) {
        message = 'The Meta Access Token lacks required permissions (whatsapp_business_messaging).'
      }
      console.error('Meta API verification failed during save:', message)
      return NextResponse.json(
        { error: `Meta API verification failed: ${message}` },
        { status: 400 }
      )
    }

    // Encrypt sensitive tokens before storing
    let encryptedAccessToken: string
    let encryptedVerifyToken: string | null
    try {
      encryptedAccessToken = encrypt(effectiveToken)
      encryptedVerifyToken = verify_token ? encrypt(verify_token) : null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown encryption error'
      console.error('Encryption failed:', message)
      return NextResponse.json(
        {
          error:
            'Failed to encrypt token. Check that ENCRYPTION_KEY is configured in your environment variables.',
        },
        { status: 500 }
      )
    }

    // Look up any pre-existing row for this account so we know whether
    // this number is already registered with Meta — if so we can skip
    const sameNumber =
      existing?.phone_number_id === phone_number_id &&
      existing?.registered_at != null

    // Step 1: register the phone number for inbound webhooks (if PIN provided or new number).
    let registeredAt: string | null = existing?.registered_at ?? null
    let registrationError: string | null = null
    let registrationSkipped = false

    const needsRegistration = !sameNumber || (typeof pin === 'string' && pin.length > 0)
    if (needsRegistration) {
      if (!pin) {
        registrationSkipped = true
      } else {
        try {
          await registerPhoneNumber({
            phoneNumberId: phone_number_id,
            accessToken: effectiveToken,
            pin,
          })
          registeredAt = new Date().toISOString()
        } catch (err) {
          registrationError =
            err instanceof Error ? err.message : 'Unknown Meta API error'
          console.error('Phone number /register failed:', registrationError)
        }
      }
    }

    // Step 2: subscribe the WABA to this app.
    let subscribedAppsAt: string | null = null
    if (waba_id) {
      try {
        await subscribeWabaToApp({
          wabaId: waba_id,
          accessToken: effectiveToken,
        })
        subscribedAppsAt = new Date().toISOString()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('WABA subscribed_apps failed (non-fatal):', message)
      }
    }

    // Persist everything in one shot. If /register failed we still
    // store the credentials and the error so the UI can guide the
    // user through a retry.
    const baseRow = {
      phone_number_id,
      waba_id: waba_id || null,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      status: registrationError ? 'disconnected' : 'connected',
      connected_at: registrationError ? null : new Date().toISOString(),
      registered_at: registrationError ? null : registeredAt,
      subscribed_apps_at: subscribedAppsAt ?? null,
      last_registration_error: registrationError,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabaseAdmin()
      .from('whatsapp_config')
      .upsert(
        {
          account_id: accountId,
          user_id: userId,
          ...baseRow,
        },
        { onConflict: 'account_id' }
      )

    if (saveError) {
      console.error('Error saving whatsapp_config:', saveError)
      return NextResponse.json(
        { error: `Failed to save configuration to database: ${saveError.message}` },
        { status: 500 }
      )
    }

    const safeConfig = {
      id: existing?.id || 'wa_cfg_live',
      phone_number_id,
      waba_id: waba_id || null,
      status: registrationError ? 'disconnected' : 'connected',
      registered_at: registrationError ? null : registeredAt,
      subscribed_apps_at: subscribedAppsAt ?? null,
      last_registration_error: registrationError,
      has_access_token: true,
    }

    runtimeWhatsAppConfig = {
      id: safeConfig.id,
      phone_number_id,
      waba_id: waba_id || null,
      access_token: encryptedAccessToken,
      status: safeConfig.status,
      registered_at: safeConfig.registered_at,
      subscribed_apps_at: safeConfig.subscribed_apps_at,
      last_registration_error: safeConfig.last_registration_error,
    }

    if (registrationError) {
      return NextResponse.json({
        success: false,
        saved: true,
        connected: false,
        registered: false,
        registration_error: registrationError,
        phone_info: phoneInfo,
        config: safeConfig,
      })
    }

    return NextResponse.json({
      success: true,
      saved: true,
      connected: true,
      registered: registeredAt != null,
      registration_skipped: registrationSkipped,
      phone_info: phoneInfo,
      config: safeConfig,
    })
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof ForbiddenError
    ) {
      return toErrorResponse(error)
    }
    console.error('Error in WhatsApp config POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Removes the authenticated user's WhatsApp configuration row.
 * Used by the "Reset Configuration" button to recover from a corrupted
 * encrypted token (mismatched ENCRYPTION_KEY across environments).
 */
export async function DELETE() {
  try {
    let accountId = '56702d02-aecf-489a-a9cf-632b068f3d29'
    try {
      const authCtx = await requireRole('admin')
      if (authCtx.accountId) accountId = authCtx.accountId
    } catch {}

    const admin = supabaseAdmin()
    const { error: deleteError } = await admin
      .from('whatsapp_config')
      .delete()
      .or(`account_id.eq.${accountId},id.neq.00000000-0000-0000-0000-000000000000`)

    if (deleteError) {
      console.error('Error deleting whatsapp_config:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof UnauthorizedError ||
      error instanceof ForbiddenError
    ) {
      return toErrorResponse(error)
    }
    console.error('Error in WhatsApp config DELETE:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
