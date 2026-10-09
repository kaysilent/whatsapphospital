import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || cleanEmail.split('@')[0]).trim();

    const cookieStore = await cookies();
    const pendingCookies: Array<{ name: string; value: string; options?: any }> = [];

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Authentication service not configured on server' },
        { status: 500 }
      );
    }

    // 1. Check if user already exists using Supabase Admin
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const admin = supabaseAdmin();

    let existingUserId: string | null = null;
    try {
      const { data: usersData } = await admin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
      if (existingUser) {
        existingUserId = existingUser.id;
      }
    } catch (adminListErr) {
      console.warn('[Signup Admin Check Warning]:', adminListErr);
    }

    if (existingUserId) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in.' },
        { status: 400 }
      );
    }

    // 2. Create the user with Supabase Admin (auto-confirm email for immediate access)
    let createdAuthUser = null;
    try {
      const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
        },
      });

      if (createErr) {
        return NextResponse.json(
          { error: createErr.message || 'Failed to create user account' },
          { status: 400 }
        );
      }

      createdAuthUser = createData.user;
    } catch (adminCreateErr: any) {
      console.error('[Signup Admin Create Error]:', adminCreateErr);
      return NextResponse.json(
        { error: adminCreateErr.message || 'Error creating clinic account' },
        { status: 500 }
      );
    }

    if (!createdAuthUser) {
      return NextResponse.json(
        { error: 'Failed to create clinic user' },
        { status: 500 }
      );
    }

    // 3. Authenticate and create session cookies
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
              } catch (err) {}
            });
          },
        },
      }
    );

    const { data: signinData, error: signinErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: createdAuthUser.id,
        email: createdAuthUser.email,
        full_name: cleanName,
        role: 'super_admin',
      },
      session: signinData?.session ? {
        access_token: signinData.session.access_token,
        refresh_token: signinData.session.refresh_token,
        expires_at: signinData.session.expires_at,
      } : undefined,
    });

    // Set demo session cookie as authenticated marker
    response.cookies.set('wacrm_demo_session', '1', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });

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
    console.error('[API Auth Signup Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal signup service error' },
      { status: 500 }
    );
  }
}
