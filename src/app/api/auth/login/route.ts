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

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    if (error || !data?.user) {
      return NextResponse.json(
        { error: error?.message || 'Invalid login credentials' },
        { status: 400 }
      );
    }

    // Build the JSON response
    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      }
    });

    // Explicitly set all cookies onto the response object so Set-Cookie headers are sent
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: options?.maxAge ?? 60 * 60 * 24 * 7, // 7 days
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
