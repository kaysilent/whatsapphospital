import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_TREATMENTS, 
  Treatment 
} from '@/lib/hospital/treatments';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadTreatments, sanitizeTreatments, saveTreatments } from '@/lib/ai/knowledge-store';

// The catalog is stored per account (ai_knowledge_documents) so the AI
// receptionist — including the WhatsApp webhook, which has no browser —
// quotes the treatments and prices configured in Settings. Writes use the
// service-role client scoped by ctx.accountId because doctors may edit the
// catalog, while the documents table's RLS only lets admins write.
async function currentTreatments(accountId: string): Promise<Treatment[]> {
  return (await loadTreatments(supabaseAdmin(), accountId)) ?? [...DEFAULT_TREATMENTS];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const ctx = await requireRole('staff');
    const saved = await loadTreatments(supabaseAdmin(), ctx.accountId);
    const runtimeTreatments = saved ?? [...DEFAULT_TREATMENTS];
    let filtered = [...runtimeTreatments];

    if (activeOnly) {
      filtered = filtered.filter(t => t.isActive);
    }

    if (category && category !== 'All') {
      filtered = filtered.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      saved: !!saved,
      treatments: filtered,
      totalCount: runtimeTreatments.length,
      activeCount: runtimeTreatments.filter(t => t.isActive).length,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole('manager');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Manager role or higher required to add treatments.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Check if it's a reset action
    if (body.action === 'reset') {
      await saveTreatments(supabaseAdmin(), ctx.accountId, DEFAULT_TREATMENTS, ctx.userId);
      return NextResponse.json({
        success: true,
        message: 'Treatments reset to default catalog successfully.',
        treatments: DEFAULT_TREATMENTS,
      });
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Treatment name is required' }, { status: 400 });
    }

    const newTreatment: Treatment = {
      id: body.id || `trt-${Date.now()}`,
      name: body.name.trim(),
      category: body.category || 'Skin',
      description: body.description?.trim() || '',
      durationMinutes: Number(body.durationMinutes) || 30,
      price: Number(body.price) || 0,
      currency: body.currency || '₹',
      recommendedSittings: Number(body.recommendedSittings) || 1,
      sittingInterval: body.sittingInterval || 'As advised',
      sittingIntervalDays: Number(body.sittingIntervalDays) || 30,
      preCareAdvice: body.preCareAdvice?.trim() || '',
      postCareAdvice: body.postCareAdvice?.trim() || '',
      isActive: body.isActive !== false,
      isPopular: !!body.isPopular,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const runtimeTreatments = [newTreatment, ...(await currentTreatments(ctx.accountId))];
    await saveTreatments(supabaseAdmin(), ctx.accountId, runtimeTreatments, ctx.userId);

    return NextResponse.json({
      success: true,
      message: `Treatment "${newTreatment.name}" added successfully.`,
      treatment: newTreatment,
      treatments: runtimeTreatments,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireRole('manager');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Manager role or higher required to update treatments.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // If batch replacement
    if (Array.isArray(body.treatments)) {
      const treatments = sanitizeTreatments(body.treatments);
      if (!treatments) {
        return NextResponse.json({ error: 'Invalid treatments payload' }, { status: 400 });
      }
      await saveTreatments(supabaseAdmin(), ctx.accountId, treatments, ctx.userId);
      return NextResponse.json({
        success: true,
        message: 'Treatments updated successfully.',
        treatments,
      });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'Treatment ID is required for update' }, { status: 400 });
    }

    const runtimeTreatments = await currentTreatments(ctx.accountId);
    const index = runtimeTreatments.findIndex(t => t.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
    }

    runtimeTreatments[index] = {
      ...runtimeTreatments[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    await saveTreatments(supabaseAdmin(), ctx.accountId, runtimeTreatments, ctx.userId);

    return NextResponse.json({
      success: true,
      message: `Treatment "${runtimeTreatments[index].name}" updated successfully.`,
      treatment: runtimeTreatments[index],
      treatments: runtimeTreatments,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireRole('manager');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Manager role or higher required to delete treatments.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Treatment ID is required' }, { status: 400 });
    }

    const runtimeTreatments = await currentTreatments(ctx.accountId);
    const existing = runtimeTreatments.find(t => t.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
    }

    const remaining = runtimeTreatments.filter(t => t.id !== id);
    await saveTreatments(supabaseAdmin(), ctx.accountId, remaining, ctx.userId);

    return NextResponse.json({
      success: true,
      message: `Treatment "${existing.name}" removed successfully.`,
      treatments: remaining,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
