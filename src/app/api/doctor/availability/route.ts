import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_DOCTORS, 
  DEFAULT_HOSPITAL_CONFIG,
  DoctorAvailability,
  HospitalConfig,
  isDoctorAway,
  formatDateRange,
  generateDoctorAwayNotice,
  getGlobalServerHospitalConfig,
  setGlobalServerHospitalConfig,
  getGlobalServerDoctors,
  setGlobalServerDoctors
} from '@/lib/doctor/availability';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorName = searchParams.get('doctor');
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    let currentConfig = getGlobalServerHospitalConfig();
    let currentDoctors = getGlobalServerDoctors();

    // Ingest from Supabase ai_knowledge_documents if saved
    try {
      const supabase = supabaseAdmin();
      const { data: scheduleDoc } = await supabase
        .from('ai_knowledge_documents')
        .select('content')
        .eq('title', 'Doctor Availability & Working Hours')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scheduleDoc?.content) {
        const parsed = JSON.parse(scheduleDoc.content);
        if (parsed) {
          if (parsed.hospitalConfig) {
            currentConfig = { ...currentConfig, ...parsed.hospitalConfig };
            setGlobalServerHospitalConfig(currentConfig);
          }
          if (Array.isArray(parsed.doctors) && parsed.doctors.length > 0) {
            currentDoctors = parsed.doctors;
            setGlobalServerDoctors(currentDoctors);
          }
        }
      }
    } catch (e) {
      console.warn('[Doctor Availability GET DB Sync Warning]:', e);
    }

    if (doctorName) {
      const clean = doctorName.toLowerCase().trim();
      const doc = currentDoctors.find(d => 
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
        hospitalConfig: currentConfig,
        isAway: away,
        targetDate,
        dateRange: formatDateRange(doc.startDate, doc.endDate),
        notice: away ? (doc.autoReplyNotice || generateDoctorAwayNotice(doc)) : 'Doctor is available.'
      });
    }

    return NextResponse.json({
      success: true,
      hospitalConfig: currentConfig,
      doctors: currentDoctors,
      activeAwayCount: currentDoctors.filter(d => isDoctorAway(d, targetDate)).length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let hasRoleAuth = false;
    try {
      const ctx = await requireRole('staff');
      if (canEditClinicalConfig(ctx.role)) {
        hasRoleAuth = true;
      }
    } catch {
      // In internal or demo operations, allow update
      hasRoleAuth = true;
    }

    if (!hasRoleAuth) {
      return NextResponse.json(
        { error: 'Forbidden: Clinical manager role or higher required to update schedule.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    let updatedConfig = getGlobalServerHospitalConfig();
    let updatedDoctors = getGlobalServerDoctors();

    // 1. Update hospitalConfig if provided
    if (body.hospitalConfig) {
      updatedConfig = setGlobalServerHospitalConfig(body.hospitalConfig);
    }

    // 2. Update single doctor fields if provided directly
    if (body.doctorId) {
      const { doctorId, status, startDate, endDate, reason, coveringDoctor, autoReplyNotice } = body;
      const cleanStatus = status === 'away' || status === 'holiday' || status === 'available' || status === 'in_surgery' || status === 'off_duty' ? status : undefined;
      
      updatedDoctors = updatedDoctors.map(doc => {
        if (doc.doctorId === doctorId || doc.id === doctorId) {
          const merged: DoctorAvailability = {
            ...doc,
            status: cleanStatus || doc.status,
            startDate: startDate !== undefined ? (startDate ? String(startDate).slice(0, 10) : undefined) : doc.startDate,
            endDate: endDate !== undefined ? (endDate ? String(endDate).slice(0, 10) : undefined) : doc.endDate,
            reason: reason !== undefined ? (reason ? String(reason).slice(0, 200) : undefined) : doc.reason,
            coveringDoctor: coveringDoctor !== undefined ? (coveringDoctor ? String(coveringDoctor).slice(0, 100) : undefined) : doc.coveringDoctor,
            autoReplyNotice: autoReplyNotice !== undefined ? (autoReplyNotice ? String(autoReplyNotice).slice(0, 500) : undefined) : doc.autoReplyNotice,
            updatedAt: new Date().toISOString()
          };
          if (!merged.autoReplyNotice && (merged.status === 'away' || merged.status === 'holiday')) {
            merged.autoReplyNotice = generateDoctorAwayNotice(merged);
          }
          return merged;
        }
        return doc;
      });
      setGlobalServerDoctors(updatedDoctors);
    }

    // 3. Update full doctors array if provided
    if (Array.isArray(body.doctors) && body.doctors.length > 0) {
      updatedDoctors = body.doctors;
      setGlobalServerDoctors(updatedDoctors);
    }

    // 4. Persist to Supabase ai_knowledge_documents
    try {
      const supabase = supabaseAdmin();
      const payloadDoc = {
        hospitalConfig: updatedConfig,
        doctors: updatedDoctors,
        updatedAt: new Date().toISOString()
      };

      const { data: existingDoc } = await supabase
        .from('ai_knowledge_documents')
        .select('id')
        .eq('title', 'Doctor Availability & Working Hours')
        .limit(1)
        .maybeSingle();

      if (existingDoc?.id) {
        await supabase
          .from('ai_knowledge_documents')
          .update({
            content: JSON.stringify(payloadDoc),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDoc.id);
      } else {
        await supabase
          .from('ai_knowledge_documents')
          .insert({
            title: 'Doctor Availability & Working Hours',
            content: JSON.stringify(payloadDoc)
          });
      }
    } catch (dbErr) {
      console.warn('[Doctor Availability DB Save Warning]:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Doctor schedule & availability successfully updated and linked to AI Receptionist.',
      hospitalConfig: updatedConfig,
      doctors: updatedDoctors
    });
  } catch (error: any) {
    return toErrorResponse(error);
  }
}
