import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_DOCTORS, 
  DoctorAvailability,
  isDoctorAway,
  formatDateRange,
  generateDoctorAwayNotice 
} from '@/lib/doctor/availability';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';

// In-memory runtime cache for server-side endpoints
let runtimeDoctors: DoctorAvailability[] = [...DEFAULT_DOCTORS];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorName = searchParams.get('doctor');
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (doctorName) {
      const clean = doctorName.toLowerCase().trim();
      const doc = runtimeDoctors.find(d => 
        d.doctorName.toLowerCase().trim() === clean ||
        d.doctorName.toLowerCase().includes(clean) ||
        clean.includes(d.doctorName.toLowerCase())
      );

      if (!doc) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
      }

      const away = isDoctorAway(doc, targetDate);
      return NextResponse.json({
        doctor: doc,
        isAway: away,
        targetDate,
        dateRange: formatDateRange(doc.startDate, doc.endDate),
        notice: away ? (doc.autoReplyNotice || generateDoctorAwayNotice(doc)) : 'Doctor is available.'
      });
    }

    return NextResponse.json({
      doctors: runtimeDoctors,
      activeAwayCount: runtimeDoctors.filter(d => isDoctorAway(d, targetDate)).length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole('manager');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Clinical manager role or higher required to update schedule.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { doctorId, status, startDate, endDate, reason, coveringDoctor, autoReplyNotice } = body;

    if (!doctorId || typeof doctorId !== 'string') {
      return NextResponse.json({ error: 'Valid doctorId is required' }, { status: 400 });
    }

    // Date sanity check (if provided, should be ISO YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && typeof startDate === 'string' && !dateRegex.test(startDate)) {
      return NextResponse.json({ error: 'startDate must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (endDate && typeof endDate === 'string' && !dateRegex.test(endDate)) {
      return NextResponse.json({ error: 'endDate must be in YYYY-MM-DD format' }, { status: 400 });
    }

    const cleanStatus = status === 'away' || status === 'holiday' || status === 'available' ? status : undefined;

    runtimeDoctors = runtimeDoctors.map(doc => {
      if (doc.doctorId === doctorId || doc.id === doctorId) {
        return {
          ...doc,
          status: cleanStatus || doc.status,
          startDate: startDate !== undefined ? String(startDate).slice(0, 10) : doc.startDate,
          endDate: endDate !== undefined ? String(endDate).slice(0, 10) : doc.endDate,
          reason: reason !== undefined ? String(reason).slice(0, 200) : doc.reason,
          coveringDoctor: coveringDoctor !== undefined ? String(coveringDoctor).slice(0, 100) : doc.coveringDoctor,
          autoReplyNotice: autoReplyNotice !== undefined ? String(autoReplyNotice).slice(0, 500) : doc.autoReplyNotice,
          updatedAt: new Date().toISOString()
        };
      }
      return doc;
    });

    return NextResponse.json({ success: true, doctors: runtimeDoctors });
  } catch (error: any) {
    return toErrorResponse(error);
  }
}
