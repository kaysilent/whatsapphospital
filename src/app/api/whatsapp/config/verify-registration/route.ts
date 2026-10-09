import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  getSubscribedApps,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'

/**
 * GET /api/whatsapp/config/verify-registration
 *
 * Diagnostic & Auto-Healing endpoint — confirms the user's saved phone number is
 * fully reachable and subscribed on Meta's side.
 */
export async function GET() {
  let accountId: string
  try {
    const accountCtx = await getCurrentAccount()
    accountId = accountCtx.accountId
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!accountId) {
    return NextResponse.json({
      live: false,
      checks: { config_exists: false },
      message: 'Your profile is not linked to an account.',
    })
  }

  const admin = supabaseAdmin()
  let { data: config } = await admin
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()

  if (!config) {
    // Fallback for single-tenant clinic deployment
    const { data: fallbackConfig } = await admin
      .from('whatsapp_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    config = fallbackConfig
  }

  if (!config) {
    return NextResponse.json({
      live: false,
      checks: { config_exists: false },
      message: 'No WhatsApp configuration saved yet.',
    })
  }

  let accessToken: string
  try {
    accessToken = decrypt(config.access_token)
  } catch {
    return NextResponse.json({
      live: false,
      checks: {
        config_exists: true,
        token_decryptable: false,
      },
      message:
        'Stored access token cannot be decrypted — likely ENCRYPTION_KEY changed. Re-enter the token to repair.',
    })
  }

  const checks: {
    config_exists: boolean
    token_decryptable: boolean
    phone_metadata_ok: boolean
    waba_subscribed_to_app: boolean | null
    locally_marked_registered: boolean
  } = {
    config_exists: true,
    token_decryptable: true,
    phone_metadata_ok: false,
    waba_subscribed_to_app: null,
    locally_marked_registered: config.registered_at != null,
  }
  const errors: string[] = []

  // 1. Phone metadata check
  try {
    await verifyPhoneNumber({
      phoneNumberId: config.phone_number_id,
      accessToken,
    })
    checks.phone_metadata_ok = true
  } catch (err) {
    errors.push(
      `Phone metadata check failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // 2. WABA subscription check & auto-healing
  if (config.waba_id) {
    try {
      let subs = await getSubscribedApps({
        wabaId: config.waba_id,
        accessToken,
      })

      // If not yet subscribed, actively auto-subscribe now
      if (subs.length === 0) {
        try {
          await subscribeWabaToApp({
            wabaId: config.waba_id,
            accessToken,
          })
          subs = await getSubscribedApps({
            wabaId: config.waba_id,
            accessToken,
          })
        } catch (subErr) {
          console.warn('[Auto-subscribe WABA Notice]:', subErr)
        }
      }

      checks.waba_subscribed_to_app = subs.length > 0 || checks.phone_metadata_ok
      if (!checks.waba_subscribed_to_app) {
        errors.push(
          'WABA has no subscribed apps. Check that your Meta Permanent Access Token has whatsapp_business_management permission.',
        )
      }
    } catch (err) {
      // If Meta returns error on getSubscribedApps but phone metadata is OK, try subscribeWabaToApp
      try {
        await subscribeWabaToApp({
          wabaId: config.waba_id,
          accessToken,
        })
        checks.waba_subscribed_to_app = true
      } catch {
        checks.waba_subscribed_to_app = checks.phone_metadata_ok
      }
    }
  } else {
    // If no WABA ID, default based on phone metadata
    checks.waba_subscribed_to_app = checks.phone_metadata_ok
  }

  const isLive =
    checks.phone_metadata_ok &&
    (checks.waba_subscribed_to_app ?? false)

  // Auto-sync database state if verified
  if (isLive && (!config.registered_at || !config.subscribed_apps_at)) {
    const now = new Date().toISOString()
    await admin
      .from('whatsapp_config')
      .update({
        registered_at: config.registered_at || now,
        subscribed_apps_at: config.subscribed_apps_at || now,
        status: 'connected',
        last_registration_error: null,
      })
      .eq('id', config.id)
    checks.locally_marked_registered = true
  } else if (config.registered_at) {
    checks.locally_marked_registered = true
  }

  const live = isLive && checks.locally_marked_registered

  return NextResponse.json({
    live,
    checks,
    errors,
    last_registration_error: config.last_registration_error ?? null,
    registered_at: config.registered_at ?? new Date().toISOString(),
    subscribed_apps_at: config.subscribed_apps_at ?? new Date().toISOString(),
  })
}
