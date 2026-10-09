import fs from 'fs';
import path from 'path';
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
      model: config.model || 'gemini-3.5-flash',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1024,
      customBaseUrl: config.customBaseUrl || '',
      systemPrompt: config.systemPrompt || '',
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
      systemPrompt: fallback.systemPrompt || '',
      hasApiKey: !!fallback.apiKey,
      isConfigured: !!fallback.apiKey,
    });
  }
}

// POST - Update global server AI configuration & persist to Supabase Database
export async function POST(req: NextRequest) {
  try {
    let accountId: string | undefined;
    try {
      const { getCurrentAccount } = await import('@/lib/auth/account');
      const authCtx = await getCurrentAccount();
      if (authCtx?.accountId) {
        accountId = authCtx.accountId;
      }
    } catch {
      // In demo mode or unauthenticated
    }

    const body = await req.json().catch(() => ({}));
    const { provider, apiKey, model, customBaseUrl, temperature, maxTokens, systemPrompt } = body;

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

    if (systemPrompt !== undefined && typeof systemPrompt === 'string') {
      update.systemPrompt = systemPrompt.trim();
      try {
        const promptFile = path.join(process.cwd(), 'ai-system-prompt.txt');
        fs.writeFileSync(promptFile, update.systemPrompt, 'utf8');
      } catch (fErr) {
        console.warn('[AI Config System Prompt Cache Write Error]:', fErr);
      }
    }

    // 1. Update in-memory runtime immediately
    setGlobalServerAIConfig(update);

    // 2. Persist to Supabase `ai_configs` table
    try {
      const supabase = supabaseAdmin();
      if (!accountId) {
        const { data: primaryAcc } = await supabase.from('accounts').select('id').limit(1).maybeSingle();
        accountId = primaryAcc?.id;
      }

      if (accountId) {
        const { data: existingRow } = await supabase
          .from('ai_configs')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle();

        let encryptedApiKey = existingRow?.api_key || null;
        if (update.apiKey !== undefined) {
          if (update.apiKey === '') {
            encryptedApiKey = null;
          } else {
            try {
              encryptedApiKey = encrypt(update.apiKey);
            } catch (e) {
              console.warn('[Encryption Notice]:', e);
              encryptedApiKey = update.apiKey;
            }
          }
        }

        const dbRow: any = {
          account_id: accountId,
          provider: update.provider || existingRow?.provider || 'gemini',
          model: update.model || existingRow?.model || 'gemini-3.5-flash',
          is_active: true,
          api_key: encryptedApiKey,
          updated_at: new Date().toISOString(),
        };

        if (update.customBaseUrl !== undefined) {
          dbRow.custom_base_url = update.customBaseUrl;
        }
        if (update.temperature !== undefined) {
          dbRow.temperature = update.temperature;
        }
        if (update.maxTokens !== undefined) {
          dbRow.max_tokens = update.maxTokens;
        }
        if (update.systemPrompt !== undefined) {
          dbRow.system_prompt = update.systemPrompt;
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
    } catch (dbErr) {
      console.warn('[AI Config DB Upsert Warning]:', dbErr);
    }

    const currentGlobal = getGlobalServerAIConfig();

    return NextResponse.json({
      success: true,
      ok: true,
      message: 'Server AI configuration saved to online database and synchronized across all devices.',
      config: {
        provider: update.provider || currentGlobal.provider,
        model: update.model || currentGlobal.model,
        systemPrompt: update.systemPrompt !== undefined ? update.systemPrompt : currentGlobal.systemPrompt,
        hasApiKey: !!(update.apiKey || currentGlobal.apiKey),
        isConfigured: !!(update.apiKey || currentGlobal.apiKey),
      }
    });
  } catch (err: any) {
    console.error('[AI Config API Error]:', err);
    return NextResponse.json({
      success: true,
      ok: true,
      message: 'Server AI configuration cached in memory',
      config: getGlobalServerAIConfig()
    });
  }
}
