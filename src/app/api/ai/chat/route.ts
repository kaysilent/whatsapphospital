import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { 
      message, 
      systemPrompt, 
      knowledgeContext, 
      llmConfig, 
      conversationHistory = [],
      existingAppointments = []
    } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const provider = llmConfig?.provider || 'gemini';
    const apiKey = llmConfig?.apiKey?.trim() || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = llmConfig?.model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
    const temperature = typeof llmConfig?.temperature === 'number' ? llmConfig.temperature : 0.7;
    const maxTokens = typeof llmConfig?.maxTokens === 'number' ? llmConfig.maxTokens : 1024;

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'NO_API_KEY',
          message: 'No LLM API Key is configured yet. Please add your Google Gemini, OpenAI, Claude, or Groq API Key in Settings → AI Assistant.' 
        },
        { status: 400 }
      );
    }

    // Prepare calendar availability info for the LLM
    const standardSlots = ["10:30 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM", "06:30 PM"];
    let calendarContext = `\n\n=== CLINIC STANDARD CONSULTATION SLOTS ===\nAvailable Slots: ${standardSlots.join(', ')}`;
    if (Array.isArray(existingAppointments) && existingAppointments.length > 0) {
      calendarContext += `\nExisting Booked Appointments: ` + existingAppointments.map((a: any) => `${a.date} at ${a.time} (${a.department})`).join('; ');
    }
    calendarContext += `\n==========================================`;

    // Construct full system instruction
    let fullSystemInstruction = `${systemPrompt || 'You are an intelligent, empathetic, highly professional WhatsApp clinic assistant for La Fleur Aesthetic & Wellness Clinic.'}

CRITICAL CONVERSATIONAL & FLUENCY GUIDELINES:
1. Speak naturally with warm human fluency, genuine empathy, and elegance — never sound like a robotic chatbot or rigid form.
2. Follow all persona rules, treatment discovery protocols, pre-care/post-care instructions, and medical safeguards from your system prompt.
3. Use the verified Knowledge Base below for treatment information, prices, and doctor timings. If unsure, politely guide them to clinic coordinators.
4. When helping a patient book a consultation:
   - Inquire warmly about their preferred concern or treatment.
   - Gently collect their Full Name, Preferred Date, Preferred Time Slot, and 10-digit WhatsApp Phone Number in natural conversational turns.
   - Cross-check standard clinic slots (${standardSlots.join(', ')}).
5. When (and ONLY when) ALL 5 mandatory details are collected and explicitly confirmed (Patient Name, WhatsApp Phone, Date, Time Slot, and Treatment), append this invisible JSON tag at the VERY END of your reply so the CRM system records the booking:
<!--BOOKING_JSON:{"patient_name":"...","phone_number":"...","date":"YYYY-MM-DD","time":"...","department":"..."}-->

${calendarContext}`;

    if (knowledgeContext && knowledgeContext.trim()) {
      fullSystemInstruction += `\n\n=== OFFICIAL VERIFIED CLINIC KNOWLEDGE BASE & PRICING ===\n${knowledgeContext}\n=========================================================`;
    }

    let rawReply = '';

    // 1. GOOGLE GEMINI CHAT
    if (provider === 'gemini') {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      // History
      conversationHistory.slice(-10).forEach((h: { role: string; content: string }) => {
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
            parts: [{ text: fullSystemInstruction }]
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

      rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    // 2. OPENAI / GROQ / CUSTOM
    else if (provider === 'openai' || provider === 'groq' || provider === 'custom') {
      const defaultEndpoint = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : (llmConfig?.customBaseUrl?.trim() || 'http://localhost:11434/v1').replace(/\/$/, '') + '/chat/completions';

      const messages = [
        { role: 'system', content: fullSystemInstruction },
        ...conversationHistory.slice(-10).map((h: { role: string; content: string }) => ({
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

      rawReply = data.choices?.[0]?.message?.content?.trim() || '';
    }

    // 3. ANTHROPIC CLAUDE
    else if (provider === 'anthropic') {
      const messages = [
        ...conversationHistory.slice(-10).map((h: { role: string; content: string }) => ({
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
          system: fullSystemInstruction,
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

      rawReply = data.content?.[0]?.text?.trim() || '';
    }

    // Check for embedded booking JSON tag
    let isAppointmentCard = false;
    let appointmentData = null;
    let cleanReply = rawReply;

    const bookingMatch = rawReply.match(/<!--BOOKING_JSON:(\{[\s\S]*?\})-->/);
    if (bookingMatch && bookingMatch[1]) {
      try {
        const parsed = JSON.parse(bookingMatch[1]);
        if (parsed.patient_name && parsed.phone_number && parsed.date && parsed.time) {
          isAppointmentCard = true;
          appointmentData = {
            patient_name: parsed.patient_name,
            phone_number: parsed.phone_number,
            date: parsed.date,
            time: parsed.time,
            department: parsed.department || 'Aesthetic Consultation'
          };
          cleanReply = rawReply.replace(/<!--BOOKING_JSON:(\{[\s\S]*?\})-->/, '').trim();
        }
      } catch (e) {
        console.warn("[Booking JSON Parse Warning]:", e);
      }
    }

    return NextResponse.json({
      content: cleanReply,
      isAppointmentCard,
      appointmentData,
      provider,
      model
    });
  } catch (err: any) {
    console.error('[AI Chat API Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal AI service error' }, { status: 500 });
  }
}
