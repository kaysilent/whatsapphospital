import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_TREATMENTS, 
  Treatment 
} from '@/lib/hospital/treatments';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';

// Server-side in-memory cache for demo/runtime
let runtimeTreatments: Treatment[] = [...DEFAULT_TREATMENTS];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let filtered = [...runtimeTreatments];

    if (activeOnly) {
      filtered = filtered.filter(t => t.isActive);
    }

    if (category && category !== 'All') {
      filtered = filtered.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      treatments: filtered,
      totalCount: runtimeTreatments.length,
      activeCount: runtimeTreatments.filter(t => t.isActive).length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
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
      runtimeTreatments = [...DEFAULT_TREATMENTS];
      return NextResponse.json({
        success: true,
        message: 'Treatments reset to default catalog successfully.',
        treatments: runtimeTreatments,
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

    runtimeTreatments.unshift(newTreatment);

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
      runtimeTreatments = body.treatments;
      return NextResponse.json({
        success: true,
        message: 'Treatments updated successfully.',
        treatments: runtimeTreatments,
      });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'Treatment ID is required for update' }, { status: 400 });
    }

    const index = runtimeTreatments.findIndex(t => t.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
    }

    runtimeTreatments[index] = {
      ...runtimeTreatments[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

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

    const existing = runtimeTreatments.find(t => t.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
    }

    runtimeTreatments = runtimeTreatments.filter(t => t.id !== id);

    return NextResponse.json({
      success: true,
      message: `Treatment "${existing.name}" removed successfully.`,
      treatments: runtimeTreatments,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
