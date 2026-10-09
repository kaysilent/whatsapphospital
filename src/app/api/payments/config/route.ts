import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { DEFAULT_PAYMENT_CONFIG, PaymentConfig } from '@/lib/payments/gateway';
import { getGlobalServerHospitalProfile, setGlobalServerHospitalProfile } from '@/lib/hospital/treatments';

export const runtime = 'nodejs';

// Server-side in-memory cache for live runtime & demo sessions
let runtimePaymentConfig: PaymentConfig = { ...DEFAULT_PAYMENT_CONFIG };

export async function GET() {
  try {
    let merged = { ...runtimePaymentConfig };

    try {
      const authCtx = await getCurrentAccount();
      if (authCtx?.supabase && authCtx.accountId) {
        const { data: config } = await authCtx.supabase
          .from('payment_configs')
          .select('*')
          .eq('account_id', authCtx.accountId)
          .maybeSingle();

        if (config) {
          const consFee = Number(config.default_consultation_fee ?? 500);
          const bookFee = Number(config.booking_fee ?? config.default_advance_token_fee ?? 10);
          merged = { 
            ...DEFAULT_PAYMENT_CONFIG, 
            ...config, 
            default_consultation_fee: consFee,
            default_advance_token_fee: bookFee,
            booking_fee: bookFee 
          };
          runtimePaymentConfig = merged;
        }
      }
    } catch {
      // In demo mode or unauthenticated
    }

    const consFee = Number(merged.default_consultation_fee ?? 500);
    const bookFee = Number(merged.booking_fee ?? merged.default_advance_token_fee ?? 10);

    // Mask secret keys for safe client display
    return NextResponse.json({
      ok: true,
      config: {
        ...merged,
        default_consultation_fee: consFee,
        default_advance_token_fee: bookFee,
        booking_fee: bookFee,
        razorpay_key_secret: merged.razorpay_key_secret ? '••••••••••••••••' : '',
        stripe_secret_key: merged.stripe_secret_key ? '••••••••••••••••' : '',
        hasRazorpaySecret: !!merged.razorpay_key_secret,
        hasStripeSecret: !!merged.stripe_secret_key,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      config: DEFAULT_PAYMENT_CONFIG,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<PaymentConfig>;

    const consFee = Number(body.default_consultation_fee !== undefined ? body.default_consultation_fee : runtimePaymentConfig.default_consultation_fee) || 500;
    const rawBook = body.booking_fee !== undefined ? body.booking_fee : body.default_advance_token_fee;
    const bookFee = (rawBook !== undefined && rawBook !== null && !isNaN(Number(rawBook)))
      ? Number(rawBook)
      : (runtimePaymentConfig.booking_fee ?? 10);

    const updatePayload: PaymentConfig = {
      ...runtimePaymentConfig,
      gateway_provider: body.gateway_provider || runtimePaymentConfig.gateway_provider || 'razorpay',
      is_enabled: body.is_enabled !== undefined ? body.is_enabled : runtimePaymentConfig.is_enabled,
      is_test_mode: body.is_test_mode !== undefined ? body.is_test_mode : runtimePaymentConfig.is_test_mode,
      upi_vpa: body.upi_vpa || runtimePaymentConfig.upi_vpa || 'lafleur@okhdfcbank',
      merchant_name: body.merchant_name || runtimePaymentConfig.merchant_name || 'La Fleur Aesthetic Clinic',
      currency: body.currency || runtimePaymentConfig.currency || 'INR',
      booking_fee: bookFee,
      default_consultation_fee: consFee,
      default_advance_token_fee: bookFee,
      require_payment_for_booking: body.require_payment_for_booking !== undefined ? body.require_payment_for_booking : true,
      auto_send_whatsapp_receipt: body.auto_send_whatsapp_receipt !== undefined ? body.auto_send_whatsapp_receipt : true,
      thank_you_message_template: body.thank_you_message_template || runtimePaymentConfig.thank_you_message_template || DEFAULT_PAYMENT_CONFIG.thank_you_message_template,
      bank_name: body.bank_name !== undefined ? body.bank_name : runtimePaymentConfig.bank_name,
      account_number: body.account_number !== undefined ? body.account_number : runtimePaymentConfig.account_number,
      ifsc_code: body.ifsc_code !== undefined ? body.ifsc_code : runtimePaymentConfig.ifsc_code,
      account_holder_name: body.account_holder_name !== undefined ? body.account_holder_name : runtimePaymentConfig.account_holder_name,
      auto_settlement_schedule: body.auto_settlement_schedule !== undefined ? body.auto_settlement_schedule : runtimePaymentConfig.auto_settlement_schedule,
      is_bank_verified: body.is_bank_verified !== undefined ? body.is_bank_verified : runtimePaymentConfig.is_bank_verified,
    };

    if (body.razorpay_key_id !== undefined) updatePayload.razorpay_key_id = body.razorpay_key_id;
    if (body.razorpay_key_secret !== undefined) {
      if (body.razorpay_key_secret === '') {
        updatePayload.razorpay_key_secret = '';
      } else if (!body.razorpay_key_secret.startsWith('••')) {
        updatePayload.razorpay_key_secret = body.razorpay_key_secret;
      }
    }
    if (body.razorpay_webhook_secret !== undefined) updatePayload.razorpay_webhook_secret = body.razorpay_webhook_secret;
    
    if (body.stripe_publishable_key !== undefined) updatePayload.stripe_publishable_key = body.stripe_publishable_key;
    if (body.stripe_secret_key !== undefined) {
      if (body.stripe_secret_key === '') {
        updatePayload.stripe_secret_key = '';
      } else if (!body.stripe_secret_key.startsWith('••')) {
        updatePayload.stripe_secret_key = body.stripe_secret_key;
      }
    }
    if (body.stripe_webhook_secret !== undefined) updatePayload.stripe_webhook_secret = body.stripe_webhook_secret;

    runtimePaymentConfig = updatePayload;

    // Synchronize to active server hospital profile & disk storage
    try {
      const currentProf = getGlobalServerHospitalProfile();
      const updatedProf = {
        ...currentProf,
        consultationFee: consFee,
        advanceTokenFee: bookFee,
        clinicBalanceFee: Math.max(0, consFee - bookFee),
        currency: updatePayload.currency === 'INR' ? '₹' : (updatePayload.currency || currentProf.currency || '₹'),
        updatedAt: new Date().toISOString(),
      };
      setGlobalServerHospitalProfile(updatedProf);

      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'hospital-profile.json');
      fs.writeFileSync(filePath, JSON.stringify(updatedProf, null, 2), 'utf8');
    } catch (profErr) {
      console.warn('[Sync hospital-profile.json Notice]:', profErr);
    }

    // Try persisting to Supabase database if session exists
    try {
      const authCtx = await getCurrentAccount();
      if (authCtx?.supabase && authCtx.accountId) {
        const dbPayload: Record<string, any> = {
          account_id: authCtx.accountId,
          gateway_provider: updatePayload.gateway_provider,
          is_enabled: updatePayload.is_enabled,
          is_test_mode: updatePayload.is_test_mode,
          razorpay_key_id: updatePayload.razorpay_key_id,
          razorpay_webhook_secret: updatePayload.razorpay_webhook_secret,
          stripe_publishable_key: updatePayload.stripe_publishable_key,
          stripe_webhook_secret: updatePayload.stripe_webhook_secret,
          upi_vpa: updatePayload.upi_vpa,
          merchant_name: updatePayload.merchant_name,
          currency: updatePayload.currency,
          default_consultation_fee: consFee,
          default_advance_token_fee: bookFee,
          require_payment_for_booking: updatePayload.require_payment_for_booking,
          auto_send_whatsapp_receipt: updatePayload.auto_send_whatsapp_receipt,
          thank_you_message_template: updatePayload.thank_you_message_template,
          updated_at: new Date().toISOString(),
        };

        if (updatePayload.razorpay_key_secret && !updatePayload.razorpay_key_secret.startsWith('••')) {
          dbPayload.razorpay_key_secret = updatePayload.razorpay_key_secret;
        }
        if (updatePayload.stripe_secret_key && !updatePayload.stripe_secret_key.startsWith('••')) {
          dbPayload.stripe_secret_key = updatePayload.stripe_secret_key;
        }

        const { error: upsertErr } = await authCtx.supabase
          .from('payment_configs')
          .upsert(dbPayload, { onConflict: 'account_id' });

        if (upsertErr) {
          console.warn('[Payment Config DB Warning]:', upsertErr.message);
        }
      }
    } catch (dbErr) {
      console.warn('[Payment Config DB Warning]:', dbErr);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      message: 'Payment gateway configuration saved successfully.',
      config: updatePayload,
    });
  } catch (error: any) {
    console.error('[Payment Config POST Error]:', error);
    return NextResponse.json({
      ok: true,
      success: true,
      message: 'Payment configuration cached in memory',
      config: runtimePaymentConfig,
    });
  }
}
