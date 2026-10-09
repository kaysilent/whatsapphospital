import { NextRequest, NextResponse } from 'next/server';
import { generateAIChatResponse } from '@/lib/ai/generate-reply';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      systemPrompt, 
      knowledgeContext, 
      llmConfig, 
      conversationHistory = [],
      existingAppointments = [],
      hospitalProfile
    } = body;

    let message = body.message;
    if (!message && Array.isArray(body.messages) && body.messages.length > 0) {
      const lastMsg = body.messages[body.messages.length - 1];
      message = typeof lastMsg === 'string' ? lastMsg : (lastMsg?.content || '');
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await generateAIChatResponse({
      message,
      conversationHistory,
      systemPrompt: (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) ? systemPrompt.trim() : undefined,
      knowledgeContext,
      llmConfig,
      existingAppointments,
      hospitalProfile,
      senderPhone: body.senderPhone || body.phone,
      senderName: body.senderName || body.name || body.patientName
    });

    return NextResponse.json({
      content: result.reply,
      reply: result.reply,
      isAppointmentCard: result.isAppointmentCard,
      appointmentData: result.appointmentData,
      provider: result.provider,
      model: result.model
    });
  } catch (err: any) {
    console.error('[AI Chat API Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal AI service error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'online', 
    service: 'WhatsApp Hospital AI Engine',
    doctor: 'Dr. Mrinalini' 
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
