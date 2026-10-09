import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const pendingCookies: Array<{ name: string; value: string; options?: any }> = [];

    let supabaseAuthUser = null;
    let supabaseSession = null;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Authentication service not configured on server' },
        { status: 500 }
      );
    }

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach((cookie) => {
                pendingCookies.push(cookie);
                try {
                  cookieStore.set(cookie.name, cookie.value, cookie.options);
                } catch (err) {
                  // Ignore cookieStore errors in API route context
                }
              });
            },
          },
        }
      );

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return NextResponse.json(
          { error: error.message || 'Invalid email or password' },
          { status: 401 }
        );
      }

      if (data?.user) {
        supabaseAuthUser = data.user;
        supabaseSession = data.session;
      }
    } catch (err: any) {
      console.error('[API Auth Login] Supabase error:', err);
      return NextResponse.json(
        { error: err.message || 'Authentication service error' },
        { status: 500 }
      );
    }

    if (!supabaseAuthUser) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    // Determine user profile & role from Supabase DB
    let userRole = 'admin';
    let userFullName = supabaseAuthUser.user_metadata?.full_name || '';

    try {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const admin = supabaseAdmin();
      const { data: profile } = await admin
        .from('profiles')
        .select('account_role, full_name, role')
        .eq('user_id', supabaseAuthUser.id)
        .maybeSingle();

      if (profile) {
        userRole = profile.account_role || profile.role || userRole;
        if (profile.full_name) userFullName = profile.full_name;
      }
    } catch (e) {
      console.warn('[API Auth Login] Profile lookup notice:', e);
    }

    if (!userFullName) {
      const cleanEmail = supabaseAuthUser.email || email;
      userFullName = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    }

    // Build the successful JSON response
    const response = NextResponse.json({
      success: true,
      user: {
        id: supabaseAuthUser.id,
        email: supabaseAuthUser.email,
        full_name: userFullName,
        role: userRole,
      },
      session: supabaseSession ? {
        access_token: supabaseSession.access_token,
        refresh_token: supabaseSession.refresh_token,
        expires_at: supabaseSession.expires_at,
      } : undefined
    });

    // Set demo session cookie as authenticated session marker
    response.cookies.set('wacrm_demo_session', '1', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Explicitly set all Supabase cookies onto the response object
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: options?.maxAge ?? 60 * 60 * 24 * 7,
        ...options,
      });
    });

    return response;
  } catch (err: any) {
    console.error('[API Auth Login Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
