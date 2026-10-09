import { NextRequest, NextResponse } from 'next/server';
import { syncServerAIConfigFromDatabase, getGlobalServerAIConfig } from '@/lib/ai/generate-reply';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { provider, apiKey, model, customBaseUrl } = body;

    let cleanKey = (apiKey && typeof apiKey === 'string' && apiKey !== 'USE_SERVER_SAVED_KEY')
      ? apiKey.trim()
      : '';

    let activeProvider = provider;
    let activeModel = model;

    if (!cleanKey) {
      const serverConfig = await syncServerAIConfigFromDatabase();
      cleanKey = serverConfig.apiKey || '';
      if (!activeProvider) activeProvider = serverConfig.provider;
      if (!activeModel) activeModel = serverConfig.model;
      if (!customBaseUrl) customBaseUrl = serverConfig.customBaseUrl;
    }

    if (!cleanKey) {
      return NextResponse.json(
        { error: 'No API key provided or found in the online database. Please enter an API key.' },
        { status: 400 }
      );
    }

    provider = activeProvider || 'gemini';
    model = activeModel;

    const startTime = Date.now();

    // 1. GOOGLE GEMINI TEST
    if (provider === 'gemini') {
      const targetModel = model || 'gemini-3.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${cleanKey}`;
      
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Respond with exactly the word "ONLINE" to confirm API connection.' }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0.1
          }
        })
      });

      const data = await res.json();
      const elapsed = Date.now() - startTime;

      if (!res.ok || data.error) {
        let errorMsg = data.error?.message || `Google Gemini API returned status ${res.status}`;
        if (errorMsg.includes('Quota exceeded') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          errorMsg = 'Google Gemini API Quota Exceeded. Please generate a new API key in Google AI Studio (aistudio.google.com) or switch to Groq / OpenAI in Settings → AI Configuration.';
        }
        return NextResponse.json(
          { error: errorMsg },
          { status: 400 }
        );
      }

      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'ONLINE';
      return NextResponse.json({
        success: true,
        provider: 'Google Gemini',
        model: targetModel,
        responseTimeMs: elapsed,
        sampleOutput: replyText,
        message: `Connected successfully to Google Gemini (${targetModel}) in ${elapsed}ms!`
      });
    }

    // 2. OPENAI TEST
    if (provider === 'openai') {
      const targetModel = model || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Respond with "ONLINE".' }],
          max_tokens: 10
        })
      });

      const data = await res.json();
      const elapsed = Date.now() - startTime;

      if (!res.ok || data.error) {
        return NextResponse.json(
          { error: data.error?.message || `OpenAI returned status ${res.status}` },
          { status: 400 }
        );
      }

      const replyText = data.choices?.[0]?.message?.content?.trim() || 'ONLINE';
      return NextResponse.json({
        success: true,
        provider: 'OpenAI',
        model: targetModel,
        responseTimeMs: elapsed,
        sampleOutput: replyText,
        message: `Connected successfully to OpenAI (${targetModel}) in ${elapsed}ms!`
      });
    }

    // 3. ANTHROPIC CLAUDE TEST
    if (provider === 'anthropic') {
      const targetModel = model || 'claude-3-5-sonnet-20241022';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Respond with "ONLINE".' }],
          max_tokens: 10
        })
      });

      const data = await res.json();
      const elapsed = Date.now() - startTime;

      if (!res.ok || data.error) {
        return NextResponse.json(
          { error: data.error?.message || `Anthropic returned status ${res.status}` },
          { status: 400 }
        );
      }

      const replyText = data.content?.[0]?.text?.trim() || 'ONLINE';
      return NextResponse.json({
        success: true,
        provider: 'Anthropic Claude',
        model: targetModel,
        responseTimeMs: elapsed,
        sampleOutput: replyText,
        message: `Connected successfully to Anthropic Claude (${targetModel}) in ${elapsed}ms!`
      });
    }

    // 4. GROQ TEST
    if (provider === 'groq') {
      const targetModel = model || 'llama-3.3-70b-versatile';
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Respond with "ONLINE".' }],
          max_tokens: 10
        })
      });

      const data = await res.json();
      const elapsed = Date.now() - startTime;

      if (!res.ok || data.error) {
        return NextResponse.json(
          { error: data.error?.message || `Groq returned status ${res.status}` },
          { status: 400 }
        );
      }

      const replyText = data.choices?.[0]?.message?.content?.trim() || 'ONLINE';
      return NextResponse.json({
        success: true,
        provider: 'Groq Cloud',
        model: targetModel,
        responseTimeMs: elapsed,
        sampleOutput: replyText,
        message: `Connected successfully to Groq (${targetModel}) in ${elapsed}ms!`
      });
    }

    // 5. CUSTOM OPENAI-COMPATIBLE API (Ollama / DeepSeek / LocalAI / Azure)
    if (provider === 'custom') {
      const baseUrl = customBaseUrl?.trim() || 'http://localhost:11434/v1';
      const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const targetModel = model || 'deepseek-chat';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Respond with "ONLINE".' }],
          max_tokens: 10
        })
      });

      const data = await res.json();
      const elapsed = Date.now() - startTime;

      if (!res.ok || data.error) {
        return NextResponse.json(
          { error: data.error?.message || `Custom API returned status ${res.status}` },
          { status: 400 }
        );
      }

      const replyText = data.choices?.[0]?.message?.content?.trim() || 'ONLINE';
      return NextResponse.json({
        success: true,
        provider: 'Custom LLM',
        model: targetModel,
        responseTimeMs: elapsed,
        sampleOutput: replyText,
        message: `Connected successfully to Custom LLM (${targetModel}) in ${elapsed}ms!`
      });
    }

    return NextResponse.json(
      { error: 'Unknown LLM Provider specified' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[Test LLM Key Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to connect to LLM provider. Check your network and API key.' },
      { status: 500 }
    );
  }
}
