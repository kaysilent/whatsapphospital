import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_HOSPITAL_PROFILE, 
  HospitalProfile 
} from '@/lib/hospital/treatments';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';

// Server-side in-memory cache for demo/runtime
let runtimeProfile: HospitalProfile = { ...DEFAULT_HOSPITAL_PROFILE };

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      profile: runtimeProfile,
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
        { error: 'Forbidden: Manager role or higher required to update hospital details.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid hospital profile payload' }, { status: 400 });
    }

    runtimeProfile = {
      ...runtimeProfile,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: 'Hospital details updated successfully.',
      profile: runtimeProfile,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
