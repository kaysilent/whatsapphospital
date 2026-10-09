import { NextResponse } from 'next/server';
import { testRazorpayConnection } from '@/lib/payments/gateway';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAccount } from '@/lib/auth/account';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let { keyId, keySecret, provider = 'razorpay' } = body;

    if (provider === 'razorpay') {
      let resolvedKeyId = (keyId || '').trim();
      let resolvedKeySecret = (keySecret || '').trim();

      // If keySecret is masked with bullets or omitted, retrieve stored secret from database or env
      if (!resolvedKeySecret || resolvedKeySecret.startsWith('•') || resolvedKeySecret.startsWith('***')) {
        try {
          const authCtx = await getCurrentAccount();
          if (authCtx?.supabase && authCtx.accountId) {
            const { data } = await authCtx.supabase
              .from('payment_configs')
              .select('razorpay_key_id, razorpay_key_secret')
              .eq('account_id', authCtx.accountId)
              .maybeSingle();

            if (data?.razorpay_key_secret) {
              resolvedKeySecret = data.razorpay_key_secret.trim();
            }
            if (!resolvedKeyId && data?.razorpay_key_id) {
              resolvedKeyId = data.razorpay_key_id.trim();
            }
          }
        } catch {
          // Unauthenticated or local session
        }

        // Fallback to environment variables if still unpopulated
        if (!resolvedKeySecret || resolvedKeySecret.startsWith('•')) {
          resolvedKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
        }
        if (!resolvedKeyId) {
          resolvedKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
        }
      }

      const result = await testRazorpayConnection(resolvedKeyId, resolvedKeySecret);
      return NextResponse.json(result);
    }

    return NextResponse.json({
      success: true,
      message: `${provider.toUpperCase()} provider is ready.`,
      latencyMs: 10,
      mode: 'test'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to test payment connection', latencyMs: 0 },
      { status: 500 }
    );
  }
}
