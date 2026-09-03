import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { 
      message, 
      systemPrompt, 
      knowledgeContext, 
      llmConfig, 
      conversationHistory = [] 
    } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const provider = llmConfig?.provider || 'gemini';
    const apiKey = llmConfig?.apiKey?.trim() || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = llmConfig?.model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
    const temperature = typeof llmConfig?.temperature === 'number' ? llmConfig.temperature : 0.7;
    const maxTokens = typeof llmConfig?.maxTokens === 'number' ? llmConfig.maxTokens : 1024;

    // Combine instructions with RAG knowledge base context if available
    let combinedSystemInstruction = systemPrompt || 'You are an intelligent clinic WhatsApp assistant.';
    if (knowledgeContext && knowledgeContext.trim()) {
      combinedSystemInstruction += `\n\n=== OFFICIAL CLINICAL KNOWLEDGE BASE & PRICING ===\nUse the following verified clinic information to answer patient inquiries accurately:\n${knowledgeContext}\n===================================================`;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No LLM API Key configured. Please add your Gemini or OpenAI API Key in Settings.' },
        { status: 400 }
      );
    }

    // 1. GOOGLE GEMINI CHAT
    if (provider === 'gemini') {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      // History
      conversationHistory.slice(-8).forEach((h: { role: string; content: string }) => {
        contents.push({
          role: h.role === 'ai' || h.role === 'model' || h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        });
      });

      // Current user prompt
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: combinedSystemInstruction }]
          },
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          }
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return NextResponse.json(
          { error: data.error?.message || `Gemini API error (Status ${res.status})` },
          { status: 400 }
        );
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return NextResponse.json({
        content: reply,
        provider: 'gemini',
        model
      });
    }

    // 2. OPENAI / GROQ / CUSTOM
    if (provider === 'openai' || provider === 'groq' || provider === 'custom') {
      const defaultEndpoint = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : (llmConfig?.customBaseUrl?.trim() || 'http://localhost:11434/v1').replace(/\/$/, '') + '/chat/completions';

      const messages = [
        { role: 'system', content: combinedSystemInstruction },
        ...conversationHistory.slice(-8).map((h: { role: string; content: string }) => ({
          role: h.role === 'ai' ? 'assistant' : h.role,
          content: h.content
        })),
        { role: 'user', content: message }
      ];

      const res = await fetch(defaultEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return NextResponse.json(
          { error: data.error?.message || `${provider} API error` },
          { status: 400 }
        );
      }

      const reply = data.choices?.[0]?.message?.content?.trim() || '';
      return NextResponse.json({
        content: reply,
        provider,
        model
      });
    }

    // 3. ANTHROPIC CLAUDE
    if (provider === 'anthropic') {
      const messages = [
        ...conversationHistory.slice(-8).map((h: { role: string; content: string }) => ({
          role: h.role === 'ai' ? 'assistant' : h.role,
          content: h.content
        })),
        { role: 'user', content: message }
      ];

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          system: combinedSystemInstruction,
          messages,
          max_tokens: maxTokens,
          temperature
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return NextResponse.json(
          { error: data.error?.message || `Anthropic API error` },
          { status: 400 }
        );
      }

      const reply = data.content?.[0]?.text?.trim() || '';
      return NextResponse.json({
        content: reply,
        provider: 'anthropic',
        model
      });
    }

    return NextResponse.json({ error: 'Unsupported LLM provider' }, { status: 400 });
  } catch (err: any) {
    console.error('[AI Chat API Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal AI service error' }, { status: 500 });
  }
}
