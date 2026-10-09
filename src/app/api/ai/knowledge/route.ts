import { NextRequest, NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditBackendSettings } from '@/lib/auth/roles';
import { defaultKnowledgeItems } from '@/lib/ai/assistant-defaults';
import {
  loadSavedKnowledgeItems,
  sanitizeKnowledgeItems,
  saveKnowledgeItems,
} from '@/lib/ai/knowledge-store';

export const runtime = 'nodejs';

/**
 * GET /api/ai/knowledge — the account's AI knowledge base items.
 * Falls back to the built-in defaults when nothing has been saved;
 * `saved` tells the client which case it got.
 */
export async function GET() {
  try {
    const ctx = await requireRole('staff');
    const saved = await loadSavedKnowledgeItems(ctx.supabase, ctx.accountId);
    return NextResponse.json({ items: saved ?? defaultKnowledgeItems, saved: !!saved });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PUT /api/ai/knowledge — replace the account's knowledge base items.
 * The WhatsApp webhook reads these, so edits made in Settings reach
 * real patients and not only the in-browser emulator.
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireRole('staff');
    if (!canEditBackendSettings(ctx.role)) {
      return NextResponse.json(
        { error: 'Admin role required to edit the AI knowledge base.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const items = sanitizeKnowledgeItems(body?.items);
    if (!items) {
      return NextResponse.json({ error: 'Invalid knowledge items payload' }, { status: 400 });
    }

    await saveKnowledgeItems(ctx.supabase, ctx.accountId, items, ctx.userId);
    return NextResponse.json({ ok: true, count: items.length });
  } catch (err) {
    return toErrorResponse(err);
  }
}
