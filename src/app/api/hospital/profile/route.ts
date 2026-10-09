import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_HOSPITAL_PROFILE, 
  HospitalProfile,
  getGlobalServerHospitalProfile,
  setGlobalServerHospitalProfile,
} from '@/lib/hospital/treatments';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    let current = getGlobalServerHospitalProfile();
    try {
      const supabase = supabaseAdmin();

      // 1. Fetch full profile document from ai_knowledge_documents if saved
      const { data: profileDoc } = await supabase
        .from('ai_knowledge_documents')
        .select('content')
        .eq('title', 'Hospital Profile & Clinic Details')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profileDoc?.content) {
        try {
          const parsed = JSON.parse(profileDoc.content);
          if (parsed && typeof parsed === 'object') {
            current = { ...current, ...parsed };
            setGlobalServerHospitalProfile(current);
          }
        } catch {}
      }

      // 2. Fetch payment config fee and currency
      const { data: payRow } = await supabase
        .from('payment_configs')
        .select('default_consultation_fee, default_advance_token_fee, currency, merchant_name')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (payRow) {
        const consFee = Number(payRow.default_consultation_fee);
        const advFee = Number(payRow.default_advance_token_fee);
        current = {
          ...current,
          ...((!isNaN(consFee) && consFee > 0) ? { consultationFee: consFee } : {}),
          ...((!isNaN(advFee) && advFee > 0) ? { advanceTokenFee: advFee } : {}),
          currency: payRow.currency === 'INR' || payRow.currency === '₹' ? '₹' : (payRow.currency || current.currency),
          name: payRow.merchant_name || current.name,
        };
        current.clinicBalanceFee = Math.max(0, (current.consultationFee || 500) - (current.advanceTokenFee || 100));
        setGlobalServerHospitalProfile(current);
      }
    } catch (e) {
      console.warn('[Hospital Profile GET Sync]:', e);
    }

    return NextResponse.json({
      success: true,
      profile: current,
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

    const updated = {
      ...getGlobalServerHospitalProfile(),
      ...body,
      updatedAt: new Date().toISOString(),
    };
    setGlobalServerHospitalProfile(updated);

    try {
      const supabase = supabaseAdmin();
      let accountId = ctx.accountId;
      if (!accountId) {
        const { data: primaryAcc } = await supabase.from('accounts').select('id').limit(1).maybeSingle();
        accountId = primaryAcc?.id;
      }

      if (accountId) {
        // Persist full profile JSON into ai_knowledge_documents
        const { data: existingDoc } = await supabase
          .from('ai_knowledge_documents')
          .select('id')
          .eq('account_id', accountId)
          .eq('title', 'Hospital Profile & Clinic Details')
          .maybeSingle();

        if (existingDoc?.id) {
          await supabase
            .from('ai_knowledge_documents')
            .update({
              content: JSON.stringify(updated),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingDoc.id);
        } else {
          await supabase
            .from('ai_knowledge_documents')
            .insert({
              account_id: accountId,
              title: 'Hospital Profile & Clinic Details',
              content: JSON.stringify(updated),
            });
        }

        // Persist consultation fee & advance token fee to Supabase `payment_configs`
        const feeToSave = typeof body.consultationFee === 'number' && body.consultationFee > 0 ? body.consultationFee : (updated.consultationFee || 500);
        const advFeeToSave = typeof body.advanceTokenFee === 'number' && body.advanceTokenFee > 0 ? body.advanceTokenFee : (updated.advanceTokenFee || 100);
        await supabase
          .from('payment_configs')
          .upsert({
            account_id: accountId,
            default_consultation_fee: feeToSave,
            default_advance_token_fee: advFeeToSave,
            booking_fee: advFeeToSave,
            merchant_name: body.name || updated.name,
            currency: body.currency === '₹' ? 'INR' : (body.currency || 'INR'),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'account_id' });
      }
    } catch (dbErr) {
      console.warn('[Hospital Profile DB Upsert Warning]:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Hospital details updated successfully and synchronized with AI engine.',
      profile: updated,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
