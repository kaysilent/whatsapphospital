import { NextRequest, NextResponse } from 'next/server';
import { 
  getGlobalServerAIConfig, 
  setGlobalServerAIConfig, 
  syncServerAIConfigFromDatabase 
} from '@/lib/ai/generate-reply';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditBackendSettings } from '@/lib/auth/roles';
import { isSafeUrl } from '@/lib/security/ssrf-guard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

export const runtime = 'nodejs';

const ALLOWED_PROVIDERS = ['gemini', 'openai', 'anthropic', 'groq', 'custom', 'deepseek', 'openrouter', 'ollama'];

// GET - Retrieve active server AI configuration from Supabase DB & memory
export async function GET() {
  try {
    // 1. Sync latest config from Supabase database
    const config = await syncServerAIConfigFromDatabase();

    const hasKey = !!(config.apiKey && config.apiKey.trim());
    let maskedKey = '';
    if (hasKey) {
      const keyStr = config.apiKey.trim();
      if (keyStr.length > 10) {
        maskedKey = `${keyStr.slice(0, 6)}••••••••${keyStr.slice(-4)}`;
      } else {
        maskedKey = '••••••••••••';
      }
    }

    return NextResponse.json({
      provider: config.provider || 'gemini',
      model: config.model || 'gemini-2.5-flash',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1024,
      customBaseUrl: config.customBaseUrl || '',
      hasApiKey: hasKey,
      isConfigured: hasKey,
      maskedApiKey: maskedKey,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (err: any) {
    console.error('[AI Config GET Error]:', err);
    const fallback = getGlobalServerAIConfig();
    return NextResponse.json({
      provider: fallback.provider,
      model: fallback.model,
      temperature: fallback.temperature,
      maxTokens: fallback.maxTokens,
      customBaseUrl: fallback.customBaseUrl,
      hasApiKey: !!fallback.apiKey,
      isConfigured: !!fallback.apiKey,
    });
  }
}

// POST - Update global server AI configuration & persist to Supabase Database
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole('admin');
    if (!canEditBackendSettings(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin privilege required to update AI configuration.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { provider, apiKey, model, customBaseUrl, temperature, maxTokens } = body;

    const update: any = {};
    if (provider) {
      if (!ALLOWED_PROVIDERS.includes(provider)) {
        return NextResponse.json({ error: `Invalid AI provider: ${provider}` }, { status: 400 });
      }
      update.provider = provider;
    }

    if (apiKey !== undefined && typeof apiKey === 'string') {
      update.apiKey = apiKey.trim();
    }

    if (model && typeof model === 'string') {
      update.model = model.trim().slice(0, 100);
    }

    if (customBaseUrl !== undefined) {
      if (customBaseUrl) {
        const urlCheck = isSafeUrl(customBaseUrl);
        if (!urlCheck.safe) {
          return NextResponse.json({ error: `Invalid custom base URL: ${urlCheck.reason}` }, { status: 400 });
        }
        update.customBaseUrl = customBaseUrl.trim();
      } else {
        update.customBaseUrl = '';
      }
    }

    if (typeof temperature === 'number') {
      update.temperature = Math.max(0, Math.min(2, temperature));
    }

    if (typeof maxTokens === 'number') {
      update.maxTokens = Math.max(50, Math.min(8192, maxTokens));
    }

    // 1. Update in-memory runtime
    setGlobalServerAIConfig(update);

    // 2. Persist to Supabase `ai_configs` table
    const supabase = supabaseAdmin();
    let accountId = ctx.accountId;
    if (!accountId) {
      const { data: primaryAcc } = await supabase.from('accounts').select('id').limit(1).maybeSingle();
      accountId = primaryAcc?.id;
    }

    if (accountId) {
      // Check existing row to preserve existing encrypted key if user didn't re-type it
      const { data: existingRow } = await supabase
        .from('ai_configs')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      let encryptedApiKey = existingRow?.api_key || null;
      if (update.apiKey) {
        try {
          encryptedApiKey = encrypt(update.apiKey);
        } catch (e) {
          console.warn('[Encryption Notice]:', e);
          encryptedApiKey = update.apiKey;
        }
      }

      const dbRow: any = {
        account_id: accountId,
        provider: update.provider || existingRow?.provider || 'gemini',
        model: update.model || existingRow?.model || 'gemini-2.5-flash',
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (encryptedApiKey !== null) {
        dbRow.api_key = encryptedApiKey;
      }
      if (update.customBaseUrl !== undefined) {
        dbRow.custom_base_url = update.customBaseUrl;
      }
      if (update.temperature !== undefined) {
        dbRow.temperature = update.temperature;
      }
      if (update.maxTokens !== undefined) {
        dbRow.max_tokens = update.maxTokens;
      }

      const { error: upsertErr } = await supabase
        .from('ai_configs')
        .upsert(dbRow, { onConflict: 'account_id' });

      if (upsertErr) {
        console.error('[Supabase ai_configs Upsert Error]:', upsertErr);
      } else {
        console.log('[Supabase ai_configs]: Successfully saved to cloud database for account', accountId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Server AI configuration saved to online database and synchronized across all devices.',
      config: {
        provider: update.provider || getGlobalServerAIConfig().provider,
        model: update.model || getGlobalServerAIConfig().model,
        hasApiKey: !!(update.apiKey || getGlobalServerAIConfig().apiKey),
        isConfigured: !!(update.apiKey || getGlobalServerAIConfig().apiKey),
      }
    });
  } catch (err: any) {
    console.error('[AI Config API Error]:', err);
    return toErrorResponse(err);
  }
}
